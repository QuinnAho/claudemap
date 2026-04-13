#!/usr/bin/env node
import path from 'path'
import { collectProjectSnapshot } from '../lib/file-walker.js'
import { readCache, writeCache } from '../lib/cache.js'
import { diffFiles, diffGraphs } from '../lib/differ.js'
import {
  enrichGraph,
  hasEnrichmentResponseOverride,
  selectPreferredGraph,
} from '../lib/enrichment.js'
import {
  applyGraphPatch,
  closeMcpClient,
  connectMcpClient,
  renderGraph,
} from '../lib/mcp-client.js'

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
    '  claudemap-refresh [project-root] [--force-refresh] [--demo-cache] [--no-render] [--stdio-mcp] [--enrichment-file <file>]',
  )
}

async function applyIncrementalGraphUpdate(mcpClient, previousGraph, nextGraph) {
  const graphChanges = diffGraphs(previousGraph, nextGraph)
  const operationCount =
    graphChanges.addedNodes.length +
    graphChanges.removedNodes.length +
    graphChanges.updatedNodes.length +
    graphChanges.addedEdges.length +
    graphChanges.removedEdges.length

  if (operationCount > 250) {
    await renderGraph(mcpClient, nextGraph)
    return { mode: 'full-render', graphChanges }
  }

  await applyGraphPatch(mcpClient, {
    changes: graphChanges,
    meta: nextGraph.meta,
    files: nextGraph.files,
    runtime: nextGraph.runtime,
  })

  return { mode: 'graph-patch', graphChanges }
}

async function main() {
  const argv = process.argv.slice(2)

  if (hasFlag(argv, 'help') || hasFlag(argv, 'h')) {
    printUsage()
    return
  }

  const projectRoot = resolveProjectRoot(argv)
  const useDemoFallback = hasFlag(argv, 'demo-cache')
  const forceRefresh = hasFlag(argv, 'force-refresh')
  const skipRender = hasFlag(argv, 'no-render')
  const useStdioMcp = hasFlag(argv, 'stdio-mcp')
  const enrichmentFile = getOptionValue(argv, 'enrichment-file')
  const responseText = enrichmentFile ? await readFileIfExists(enrichmentFile) : null
  const snapshot = collectProjectSnapshot(projectRoot)
  const cache = readCache(projectRoot)
  const hasExplicitEnrichmentInput = Boolean(responseText) || hasEnrichmentResponseOverride()

  if (!cache || forceRefresh) {
    const graphData = await enrichGraph(snapshot, { useDemoFallback, responseText })
    writeCache(projectRoot, graphData, snapshot.files)

    if (!skipRender) {
      const mcpClient = await connectMcpClient({ mode: useStdioMcp ? 'stdio' : 'file-shim' })
      await renderGraph(mcpClient, graphData)
      await closeMcpClient(mcpClient)
    }

    console.log(forceRefresh ? 'Forced refresh requested. Ran a full ClaudeMap analysis.' : 'No existing cache found. Ran a full ClaudeMap analysis instead.')
    console.log(`Updated - ${snapshot.totalFiles} files added, 0 removed, 0 changed`)
    return
  }

  const diff = diffFiles(snapshot.files, cache)
  const hasChanges = diff.added.length || diff.removed.length || diff.changed.length

  if (!hasChanges) {
    console.log('No changes detected')
    return
  }

  const graphData = await enrichGraph(snapshot, { useDemoFallback, responseText })
  const preferredGraphSelection = selectPreferredGraph(cache.graph, graphData, {
    forceRefresh,
    allowLowerPriorityOverwrite: useDemoFallback || hasExplicitEnrichmentInput,
  })

  if (preferredGraphSelection.preservedExisting) {
    if (!skipRender) {
      const mcpClient = await connectMcpClient({ mode: useStdioMcp ? 'stdio' : 'file-shim' })
      await renderGraph(mcpClient, preferredGraphSelection.graph)
      await closeMcpClient(mcpClient)
    }

    console.log(
      `Updated - ${diff.added.length} files added, ${diff.removed.length} removed, ${diff.changed.length} changed`,
    )
    console.log(`Project root: ${projectRoot}`)
    console.log(
      `Refresh mode: preserved existing ${preferredGraphSelection.existingSource} graph over ${preferredGraphSelection.candidateSource}`,
    )
    console.log('Graph cache was not replaced. Use --force-refresh to allow a lower-priority regeneration.')
    return
  }

  let renderMode = 'skipped'
  let graphChanges = null

  if (!skipRender) {
    const mcpClient = await connectMcpClient({ mode: useStdioMcp ? 'stdio' : 'file-shim' })
    const result = await applyIncrementalGraphUpdate(mcpClient, cache.graph, preferredGraphSelection.graph)
    renderMode = result.mode
    graphChanges = result.graphChanges
    if (mcpClient.fallbackReason) {
      renderMode = `${renderMode} (stdio fallback:file-shim)`
    }
    await closeMcpClient(mcpClient)
  }

  writeCache(projectRoot, preferredGraphSelection.graph, snapshot.files)

  console.log(
    `Updated - ${diff.added.length} files added, ${diff.removed.length} removed, ${diff.changed.length} changed`,
  )
  console.log(`Project root: ${projectRoot}`)
  console.log(`Refresh mode: ${renderMode} (${preferredGraphSelection.graph.meta?.source || 'generated'})`)

  if (graphChanges) {
    console.log(
      `Graph delta - ${graphChanges.addedNodes.length} nodes added, ${graphChanges.removedNodes.length} removed, ${graphChanges.updatedNodes.length} updated, ${graphChanges.addedEdges.length} edges added, ${graphChanges.removedEdges.length} removed`,
    )
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
