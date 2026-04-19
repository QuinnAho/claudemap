#!/usr/bin/env node
import path from 'path'
import { fileURLToPath } from 'url'
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
import { renderGraph } from '../lib/mcp-client.js'
import { buildScopedGraphFromRoot } from '../lib/scoped-map.js'
import { GRAPH_SOURCES } from '../lib/contracts/graph-sources.js'
import { runCommand, exitOnError } from '../lib/command-harness/run-command.js'
import { success } from '../lib/contracts/errors.js'
import { loadEnrichmentFileStrict, cleanupEnrichmentFile, readEnrichmentArg } from '../lib/command-harness/enrichment-io.js'

function formatRenderMode(skipRender, mcpClient, graphSource) {
  if (skipRender) {
    return 'skipped'
  }

  if (mcpClient?.fallbackReason) {
    return `full-render (stdio fallback:file-shim) (${graphSource})`
  }

  return `full-render (${graphSource})`
}

async function renderMapGraph(mcpClient, mapPaths, graphData) {
  if (!mcpClient) {
    return
  }

  mcpClient.graphPath = mapPaths.graphPath
  mcpClient.statePath = mapPaths.statePath
  await renderGraph(mcpClient, graphData)
}

function scopeTouchedByChanges(priorScopedCache, changedPaths) {
  if (!priorScopedCache || !changedPaths || changedPaths.size === 0) {
    return false
  }

  const priorFiles = priorScopedCache.files || priorScopedCache.graph?.files || []

  for (const file of priorFiles) {
    const filePath = file.relativePath || file.path
    if (filePath && changedPaths.has(filePath)) {
      return true
    }
  }

  return false
}

async function refreshScopedMaps(projectRoot, manifest, rootGraph, mcpClient, options = {}) {
  const changedPaths = options.changedPaths || new Set()
  const rootRestructured = options.rootRestructured === true
  let refreshedCount = 0
  let staleCount = 0
  let needsRebuildCount = 0
  let skippedCount = 0

  for (const mapEntry of manifest.maps) {
    if (mapEntry.id === DEFAULT_MAP_ID || !mapEntry.scope) {
      continue
    }

    const resolvedScope = resolveScopeAgainstGraph(mapEntry.scope, rootGraph)

    if (!resolvedScope) {
      mapEntry.scope = {
        ...mapEntry.scope,
        stale: true,
        needsRebuild: true,
      }
      staleCount += 1
      continue
    }

    const priorCache = readCache(projectRoot, { relativePath: mapEntry.cachePath })
    const scopeTouched = rootRestructured || scopeTouchedByChanges(priorCache, changedPaths)

    if (!scopeTouched && priorCache?.graph?.meta?.source === GRAPH_SOURCES.CLAUDE_SCOPED) {
      // Scope untouched and we previously had an architect-enriched graph.
      // Preserve it. Just clear any stale flag and update the scope descriptor.
      mapEntry.scope = {
        ...createScopeDescriptor(rootGraph, resolvedScope.system.id),
        stale: false,
        needsRebuild: false,
      }
      skippedCount += 1
      continue
    }

    const nextScope = createScopeDescriptor(rootGraph, resolvedScope.system.id)
    const scopedGraph = buildScopedGraphFromRoot(rootGraph, resolvedScope.system.id)

    mapEntry.scope = {
      ...nextScope,
      stale: false,
      // Mark for architect rebuild on next open because we just rebuilt
      // this scoped map from the root filter, which loses scoped-specific grouping.
      needsRebuild: priorCache?.graph?.meta?.source === GRAPH_SOURCES.CLAUDE_SCOPED,
    }
    writeCache(projectRoot, scopedGraph, scopedGraph.files, { relativePath: mapEntry.cachePath })

    if (mcpClient) {
      await renderMapGraph(mcpClient, resolveMapPaths(projectRoot, mapEntry), scopedGraph)
    }

    if (mapEntry.scope.needsRebuild) {
      needsRebuildCount += 1
    }

    refreshedCount += 1
  }

  return { refreshedCount, staleCount, needsRebuildCount, skippedCount }
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

async function handleUpdate({ ctx, args }) {
  const projectRoot = ctx.projectRoot
  const forceRefresh = args.forceRefresh || false
  const skipRender = args.noRender || false
  const enrichmentFile = args.enrichmentFile
  const responseText = enrichmentFile ? loadEnrichmentFileStrict(enrichmentFile) : null
  const enrichmentStrict = Boolean(enrichmentFile)
  let manifest = writeManifest(projectRoot, readManifest(projectRoot))
  const rootMapEntry = findMapById(manifest, DEFAULT_MAP_ID)
  const rootMapPaths = resolveMapPaths(projectRoot, rootMapEntry)
  const snapshot = collectProjectSnapshot(projectRoot)
  const cache = readCache(projectRoot, { relativePath: rootMapEntry.cachePath })
  const hasExplicitEnrichmentInput = Boolean(responseText) || hasEnrichmentResponseOverride()
  const mcpClient = ctx.mcp

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
        { rootRestructured: true },
      )
      manifest = writeManifest(projectRoot, manifest)

      if (enrichmentFile) {
        cleanupEnrichmentFile(enrichmentFile)
      }

      console.log(
        forceRefresh
          ? 'Forced refresh requested. Ran a full ClaudeMap analysis.'
          : 'No existing cache found. Ran a full ClaudeMap analysis instead.',
      )
      console.log(`Updated - ${snapshot.totalFiles} files added, 0 removed, 0 changed`)
      console.log(`Project root: ${projectRoot}`)
      console.log(`Active map: ${manifest.activeMapId}`)
      console.log(`Refresh mode: ${formatRenderMode(skipRender, mcpClient, rootGraphSelection.graph.meta?.source || 'generated')}`)
      console.log(
        `Maps refreshed: root + ${scopedRefresh.refreshedCount} scoped (${scopedRefresh.staleCount} stale)`,
      )
      return success()
    }

    const diff = diffFiles(snapshot.files, cache)
    const hasChanges = diff.added.length || diff.removed.length || diff.changed.length
    const hasRefinementRequest = hasExplicitEnrichmentInput

    if (!hasChanges && !hasRefinementRequest) {
      console.log('No changes detected')
      console.log(`Project root: ${projectRoot}`)
      console.log(`Active map: ${manifest.activeMapId}`)
      return success()
    }

    const changedPaths = new Set()
    for (const fileRecord of diff.added || []) {
      const changedPath = fileRecord.relativePath || fileRecord.path
      if (changedPath) changedPaths.add(changedPath)
    }
    for (const fileRecord of diff.removed || []) {
      const changedPath = fileRecord.relativePath || fileRecord.path
      if (changedPath) changedPaths.add(changedPath)
    }
    for (const fileRecord of diff.changed || []) {
      const changedPath = fileRecord.relativePath || fileRecord.path
      if (changedPath) changedPaths.add(changedPath)
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

    const scopedRefresh = await refreshScopedMaps(projectRoot, manifest, nextRootGraph, mcpClient, {
      changedPaths,
      rootRestructured: hasRefinementRequest && !preferredGraphSelection.preservedExisting,
    })
    manifest = writeManifest(projectRoot, manifest)

    if (enrichmentFile) {
      cleanupEnrichmentFile(enrichmentFile)
    }

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
        `Refresh mode: ${formatRenderMode(skipRender, mcpClient, nextRootGraph.meta?.source || 'generated')}`,
      )
    }

    console.log(
      `Maps refreshed: root + ${scopedRefresh.refreshedCount} scoped (${scopedRefresh.staleCount} stale)`,
    )
    return success()
  } catch (error) {
    throw error
  }
}

export const UPDATE_COMMAND = {
  name: 'update',
  slashName: 'refresh',
  summary: 'Refresh the bundled ClaudeMap graph for the current project after local code changes.',
  argumentHint: '[project-root]',
  disableModelInvocation: true,
  body: `Use the bundled ClaudeMap refresh command to update the graph for the current working directory.

Steps:
1. Treat the current working directory as the target project root unless the user gave a different path.
2. Resolve the bundled command script at \`.claude/skills/claudemap-runtime/skill/commands/refresh.js\`.
3. Run the refresh command with Node for the target project root.
4. Report added, removed, and changed file counts plus the refresh mode and scoped map refresh summary.
5. Preserve any cached Claude-authored graph unless the user explicitly asks for a force refresh.
6. Scoped maps are refreshed change-aware: maps whose files did not change keep their architect-authored graph, maps whose files did change are rebuilt from the root graph filter and flagged \`needsRebuild\` so the next \`/create-map\` pass can rerun the architect for them.`,
  positional: {
    name: 'projectRoot',
    required: false,
  },
  flags: [
    { name: 'force-refresh', type: 'boolean' },
    { name: 'no-render', type: 'boolean' },
    { name: 'stdio-mcp', type: 'boolean' },
    { name: 'enrichment-file', type: 'string' },
  ],
  withMcp: {
    mode: 'auto',
    required: false,
  },
  handler: handleUpdate,
}

export async function main(argv = process.argv.slice(2)) {
  return runCommand(UPDATE_COMMAND, argv)
}

function isDirectExecution(fileUrl) {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(fileUrl)
}

if (isDirectExecution(import.meta.url)) {
  main().catch(exitOnError)
}
