#!/usr/bin/env node
import path from 'path'
import { fileURLToPath } from 'url'
import { collectProjectSnapshot } from '../lib/file-walker.js'
import {
  enrichGraph,
  hasEnrichmentResponseOverride,
  selectPreferredGraph,
} from '../lib/enrichment.js'
import { isCacheStale, readCache, writeCache } from '../lib/cache.js'
import { launchClaudeMapWindow } from '../lib/launcher.js'
import { resolveMapPaths } from '../lib/active-map.js'
import {
  DEFAULT_MAP_ID,
  ensureManifestForSetup,
  findMapById,
  setActiveMapId,
  writeManifest,
} from '../lib/map-manifest.js'
import { renderGraph } from '../lib/mcp-client.js'
import { GRAPH_SOURCES } from '../lib/contracts/graph-sources.js'
import { runCommand, exitOnError } from '../lib/command-harness/run-command.js'
import { success } from '../lib/contracts/errors.js'
import { loadEnrichmentFileStrict, cleanupEnrichmentFile } from '../lib/command-harness/enrichment-io.js'

function countSystems(graphData) {
  return graphData.nodes.filter((node) => node.type === 'system').length
}

function mcpClientModeLabel(renderResult, preferredLabel) {
  if (renderResult?.transport === GRAPH_SOURCES.FILE_SHIM && preferredLabel === 'stdio-mcp') {
    return 'stdio-mcp fallback:file-shim'
  }

  return preferredLabel
}

async function handleSetupClaudemap({ ctx, args }) {
  const projectRoot = ctx.projectRoot
  const forceRefresh = args.forceRefresh || false
  const skipRender = args.noRender || false
  const startApp = args.startApp !== false
  const openBrowser = args.openBrowser || false
  const useStdioMcp = args.stdioMcp || false
  const enrichmentFile = args.enrichmentFile

  const responseText = enrichmentFile ? loadEnrichmentFileStrict(enrichmentFile) : null
  let manifest = ensureManifestForSetup(projectRoot)
  setActiveMapId(manifest, DEFAULT_MAP_ID)
  manifest = writeManifest(projectRoot, manifest)
  const rootMapEntry = findMapById(manifest, DEFAULT_MAP_ID)
  const rootMapPaths = resolveMapPaths(projectRoot, rootMapEntry)
  const snapshot = collectProjectSnapshot(projectRoot)
  const existingCache = readCache(projectRoot, { relativePath: rootMapEntry.cachePath })
  const hasExplicitEnrichmentInput = Boolean(responseText) || hasEnrichmentResponseOverride()
  const useCache =
    !forceRefresh &&
    !hasExplicitEnrichmentInput &&
    existingCache &&
    !isCacheStale(projectRoot, snapshot.files, existingCache)

  let graphData
  let cacheMode = 'reused'
  let preservedGraphSelection = null

  if (useCache) {
    graphData = existingCache.graph
  } else {
    const nextGraph = await enrichGraph(snapshot, {
      responseText,
      strict: Boolean(enrichmentFile),
    })
    preservedGraphSelection = selectPreferredGraph(existingCache?.graph, nextGraph, {
      forceRefresh,
      allowLowerPriorityOverwrite: hasExplicitEnrichmentInput,
    })
    graphData = preservedGraphSelection.graph

    if (!preservedGraphSelection.preservedExisting) {
      writeCache(projectRoot, graphData, snapshot.files, { relativePath: rootMapEntry.cachePath })
      cacheMode = forceRefresh ? 'forced refresh' : 'regenerated'
    } else {
      cacheMode = `preserved existing ${preservedGraphSelection.existingSource} graph`
    }
  }

  let renderResult = null

  if (!skipRender) {
    renderResult = await renderGraph(ctx.mcp, graphData)
  }

  if (enrichmentFile) {
    cleanupEnrichmentFile(enrichmentFile)
  }

  const launchState = await launchClaudeMapWindow({
    startIfNeeded: startApp,
    openBrowser,
  })

  console.log(
    `ClaudeMap ready - analyzed ${snapshot.totalFiles} files across ${countSystems(graphData)} systems`,
  )
  console.log(`Project root: ${projectRoot}`)
  console.log(`Active map: ${DEFAULT_MAP_ID}`)
  console.log(`Graph source: ${graphData.meta?.source || (useCache ? 'cache' : 'generated')}`)
  console.log(`Cache mode: ${useCache ? 'reused' : cacheMode}`)

  if (preservedGraphSelection?.preservedExisting) {
    console.log(
      `Preserved cached ${preservedGraphSelection.existingSource} graph instead of replacing it with ${preservedGraphSelection.candidateSource}. Use --force-refresh to replace it.`,
    )
  }

  if (renderResult) {
    console.log(
      `Render transport: ${useStdioMcp ? `${mcpClientModeLabel(renderResult, 'stdio-mcp')}` : renderResult.transport} (${renderResult.graphPath || 'mcp'})`,
    )
  }

  if (!launchState.running && !launchState.started) {
    console.log('App server not detected at http://127.0.0.1:5173. Run `npm run dev` to view the graph.')
  } else if (launchState.started && launchState.ready) {
    console.log(`Started app dev server at ${launchState.url}`)
  } else if (launchState.started) {
    console.log(`Started app dev server process, but it is not reachable yet at ${launchState.url}`)
  } else if (launchState.running) {
    console.log(`App server ready at ${launchState.url}`)
  }

  if (launchState.openedBrowser) {
    console.log('Opened ClaudeMap in the browser')
  }

  return success()
}

export const SETUP_CLAUDEMAP_COMMAND = {
  name: 'setup-claudemap',
  summary: 'Build a detailed architecture map for the current repository and open it in ClaudeMap.',
  positional: {
    name: 'projectRoot',
    required: false,
  },
  flags: [
    { name: 'force-refresh', type: 'boolean' },
    { name: 'no-render', type: 'boolean' },
    { name: 'start-app', type: 'boolean' },
    { name: 'open-browser', type: 'boolean' },
    { name: 'stdio-mcp', type: 'boolean' },
    { name: 'enrichment-file', type: 'string' },
  ],
  withMcp: {
    mode: 'auto',
    required: false,
  },
  handler: handleSetupClaudemap,
}

export async function main(argv = process.argv.slice(2)) {
  return runCommand(SETUP_CLAUDEMAP_COMMAND, argv)
}

function isDirectExecution(fileUrl) {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(fileUrl)
}

if (isDirectExecution(import.meta.url)) {
  main().catch(exitOnError)
}
