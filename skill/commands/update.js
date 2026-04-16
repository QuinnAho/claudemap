#!/usr/bin/env node
import path from 'path'
import { resolveMapPaths } from '../lib/active-map.js'
import { readCache, writeCache } from '../lib/cache.js'
import { diffFiles } from '../lib/differ.js'
import {
  enrichGraph,
  hasEnrichmentResponseOverride,
  selectPreferredGraph,
} from '../lib/enrichment.js'
import { collectProjectSnapshot } from '../lib/file-walker.js'
import {
  DEFAULT_MAP_ID,
  createScopeDescriptor,
  findMapById,
  readManifest,
  resolveScopeAgainstGraph,
  writeManifest,
} from '../lib/map-manifest.js'
import { closeMcpClient, connectMcpClient, renderGraph } from '../lib/mcp-client.js'
import { buildScopedGraphFromRoot } from '../lib/scoped-map.js'

function resolveProjectRoot(argv) {
  const optionsWithValues = new Set(['--enrichment-file'])
  const projectRootArg = argv.find((argument, index) => {
    if (argument.startsWith('--')) {
      return false
    }

    const previousArgument = argv[index - 1]
    return !optionsWithValues.has(previousArgument)
  })
  return path.resolve(
    projectRootArg || process.env.CLAUDEMAP_PROJECT_ROOT || process.env.INIT_CWD || process.cwd(),
  )
}

function hasFlag(argv, flagName) {
  return argv.includes(`--${flagName}`)
}

function getOptionValue(argv, optionName) {
  const optionIndex = argv.indexOf(`--${optionName}`)

  if (optionIndex === -1) {
    return null
  }

  return argv[optionIndex + 1] || null
}

function printUsage() {
  console.log('ClaudeMap refresh')
  console.log(
    '  claudemap-refresh [project-root] [--force-refresh] [--no-render] [--stdio-mcp] [--enrichment-file <file>]',
  )
}

function formatRenderMode(mcpClient, baseMode) {
  if (mcpClient?.fallbackReason) {
    return `${baseMode} (stdio fallback:file-shim)`
  }

  return baseMode
}

async function renderMapGraph(mcpClient, mapPaths, graphData) {
  if (!mcpClient) {
    return
  }

  mcpClient.graphPath = mapPaths.graphPath
  mcpClient.statePath = mapPaths.statePath
  await renderGraph(mcpClient, graphData)
}

async function refreshScopedMaps(projectRoot, manifest, rootGraph, mcpClient) {
  let refreshedCount = 0
  let staleCount = 0

  for (const mapEntry of manifest.maps) {
    if (mapEntry.id === DEFAULT_MAP_ID || !mapEntry.scope) {
      continue
    }

    const resolvedScope = resolveScopeAgainstGraph(mapEntry.scope, rootGraph)

    if (!resolvedScope) {
      mapEntry.scope = {
        ...mapEntry.scope,
        stale: true,
      }
      staleCount += 1
      continue
    }

    const nextScope = createScopeDescriptor(rootGraph, resolvedScope.systemId)
    const scopedGraph = buildScopedGraphFromRoot(rootGraph, resolvedScope.systemId)

    mapEntry.scope = nextScope
    writeCache(projectRoot, scopedGraph, scopedGraph.files, { relativePath: mapEntry.cachePath })

    if (mcpClient) {
      await renderMapGraph(mcpClient, resolveMapPaths(projectRoot, mapEntry), scopedGraph)
    }

    refreshedCount += 1
  }

  return { refreshedCount, staleCount }
}

async function buildRootGraph(snapshot, cache, options) {
  const nextGraph = await enrichGraph(snapshot, options)

  if (!cache) {
    return {
      graph: nextGraph,
      preservedExisting: false,
      existingSource: null,
      candidateSource: nextGraph.meta?.source || 'generated',
    }
  }

  return selectPreferredGraph(cache.graph, nextGraph, {
    forceRefresh: options.forceRefresh,
    allowLowerPriorityOverwrite: options.allowLowerPriorityOverwrite,
  })
}

async function main() {
  const argv = process.argv.slice(2)

  if (hasFlag(argv, 'help') || hasFlag(argv, 'h')) {
    printUsage()
    return
  }

  const projectRoot = resolveProjectRoot(argv)
  const forceRefresh = hasFlag(argv, 'force-refresh')
  const skipRender = hasFlag(argv, 'no-render')
  const useStdioMcp = hasFlag(argv, 'stdio-mcp')
  const enrichmentFile = getOptionValue(argv, 'enrichment-file')
  const responseText = enrichmentFile ? await loadEnrichmentFileStrict(enrichmentFile) : null
  const enrichmentStrict = Boolean(enrichmentFile)
  let manifest = writeManifest(projectRoot, readManifest(projectRoot))
  const rootMapEntry = findMapById(manifest, DEFAULT_MAP_ID)
  const rootMapPaths = resolveMapPaths(projectRoot, rootMapEntry)
  const snapshot = collectProjectSnapshot(projectRoot)
  const cache = readCache(projectRoot, { relativePath: rootMapEntry.cachePath })
  const hasExplicitEnrichmentInput = Boolean(responseText) || hasEnrichmentResponseOverride()
  const mcpClient = skipRender
    ? null
    : await connectMcpClient({
        mode: useStdioMcp ? 'stdio' : 'file-shim',
        graphPath: rootMapPaths.graphPath,
        statePath: rootMapPaths.statePath,
      })

  try {
    if (!cache || forceRefresh) {
      const rootGraphSelection = await buildRootGraph(snapshot, null, {
        responseText,
        forceRefresh,
        allowLowerPriorityOverwrite: hasExplicitEnrichmentInput,
        strict: enrichmentStrict,
      })

      writeCache(projectRoot, rootGraphSelection.graph, snapshot.files, {
        relativePath: rootMapEntry.cachePath,
      })

      if (mcpClient) {
        await renderMapGraph(mcpClient, rootMapPaths, rootGraphSelection.graph)
      }

      const scopedRefresh = await refreshScopedMaps(
        projectRoot,
        manifest,
        rootGraphSelection.graph,
        mcpClient,
      )
      manifest = writeManifest(projectRoot, manifest)

      console.log(
        forceRefresh
          ? 'Forced refresh requested. Ran a full ClaudeMap analysis.'
          : 'No existing cache found. Ran a full ClaudeMap analysis instead.',
      )
      console.log(`Updated - ${snapshot.totalFiles} files added, 0 removed, 0 changed`)
      console.log(`Project root: ${projectRoot}`)
      console.log(`Active map: ${manifest.activeMapId}`)
      console.log(`Refresh mode: ${formatRenderMode(mcpClient, skipRender ? 'skipped' : 'full-render')}`)
      console.log(
        `Maps refreshed: root + ${scopedRefresh.refreshedCount} scoped (${scopedRefresh.staleCount} stale)`,
      )
      return
    }

    const diff = diffFiles(snapshot.files, cache)
    const hasChanges = diff.added.length || diff.removed.length || diff.changed.length
    const hasRefinementRequest = hasExplicitEnrichmentInput

    if (!hasChanges && !hasRefinementRequest) {
      console.log('No changes detected')
      console.log(`Project root: ${projectRoot}`)
      console.log(`Active map: ${manifest.activeMapId}`)
      return
    }

    const preferredGraphSelection = await buildRootGraph(snapshot, cache, {
      responseText,
      forceRefresh,
      allowLowerPriorityOverwrite: hasExplicitEnrichmentInput,
      strict: enrichmentStrict,
    })
    const nextRootGraph = preferredGraphSelection.graph

    if (mcpClient) {
      await renderMapGraph(mcpClient, rootMapPaths, nextRootGraph)
    }

    if (!preferredGraphSelection.preservedExisting) {
      writeCache(projectRoot, nextRootGraph, snapshot.files, {
        relativePath: rootMapEntry.cachePath,
      })
    }

    const scopedRefresh = await refreshScopedMaps(projectRoot, manifest, nextRootGraph, mcpClient)
    manifest = writeManifest(projectRoot, manifest)

    if (hasChanges) {
      console.log(
        `Updated - ${diff.added.length} files added, ${diff.removed.length} removed, ${diff.changed.length} changed`,
      )
    } else {
      console.log('No file changes detected. Applied graph refinement feedback.')
    }
    console.log(`Project root: ${projectRoot}`)
    console.log(`Active map: ${manifest.activeMapId}`)

    if (preferredGraphSelection.preservedExisting) {
      console.log(
        `Refresh mode: preserved existing ${preferredGraphSelection.existingSource} graph over ${preferredGraphSelection.candidateSource}`,
      )
      console.log('Graph cache was not replaced. Use --force-refresh to allow a lower-priority regeneration.')
    } else {
      console.log(
        `Refresh mode: ${formatRenderMode(mcpClient, skipRender ? 'skipped' : 'full-render')} (${nextRootGraph.meta?.source || 'generated'})`,
      )
    }

    console.log(
      `Maps refreshed: root + ${scopedRefresh.refreshedCount} scoped (${scopedRefresh.staleCount} stale)`,
    )
  } finally {
    if (mcpClient) {
      await closeMcpClient(mcpClient)
    }
  }
}

main().catch((error) => {
  console.error(`ClaudeMap refresh failed: ${error.message}`)
  process.exitCode = 1
})

async function readFileIfExists(filePath) {
  const resolvedPath = path.resolve(filePath)
  return (await import('fs/promises')).readFile(resolvedPath, 'utf8')
}

async function loadEnrichmentFileStrict(filePath) {
  const fs = await import('fs/promises')
  const resolvedPath = path.resolve(filePath)
  let rawContent

  try {
    rawContent = await fs.readFile(resolvedPath, 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(
        `Enrichment file not found: ${resolvedPath}. Save the @claudemap-architect subagent output to that file before running update.`,
      )
    }

    throw error
  }

  if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
    throw new Error(
      `Enrichment file is empty: ${resolvedPath}. The @claudemap-architect subagent must return valid graph JSON before update runs. Refusing to fall back to the heuristic graph silently.`,
    )
  }

  return rawContent
}
