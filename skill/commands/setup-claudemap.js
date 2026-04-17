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
import { closeMcpClient, connectMcpClient, renderGraph } from '../lib/mcp-client.js'
import { GRAPH_SOURCES } from '../lib/contracts/graph-sources.js'

const CURRENT_FILE_PATH = fileURLToPath(import.meta.url)

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
  console.log('ClaudeMap setup')
  console.log('  setup-claudemap [project-root] [--force-refresh] [--no-render]')
  console.log('             [--no-start-app] [--open-browser] [--stdio-mcp]')
  console.log('             [--enrichment-file <file>]')
}

function shouldStartApp(argv) {
  if (hasFlag(argv, 'no-start-app')) {
    return false
  }

  return true
}

function countSystems(graphData) {
  return graphData.nodes.filter((node) => node.type === 'system').length
}

function isDirectExecution() {
  return process.argv[1] && path.resolve(process.argv[1]) === CURRENT_FILE_PATH
}

export async function main(argv = process.argv.slice(2)) {

  if (hasFlag(argv, 'help') || hasFlag(argv, 'h')) {
    printUsage()
    return
  }

  const projectRoot = resolveProjectRoot(argv)
  const forceRefresh = hasFlag(argv, 'force-refresh')
  const skipRender = hasFlag(argv, 'no-render')
  const startApp = shouldStartApp(argv)
  const openBrowser = hasFlag(argv, 'open-browser')
  const useStdioMcp = hasFlag(argv, 'stdio-mcp')
  const enrichmentFile = getOptionValue(argv, 'enrichment-file')
  const responseText = enrichmentFile ? await loadEnrichmentFileStrict(enrichmentFile) : null
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
    const mcpClient = await connectMcpClient({
      mode: useStdioMcp ? 'stdio' : GRAPH_SOURCES.FILE_SHIM,
      graphPath: rootMapPaths.graphPath,
      statePath: rootMapPaths.statePath,
    })
    renderResult = await renderGraph(mcpClient, graphData)
    await closeMcpClient(mcpClient)
  }

  if (enrichmentFile) {
    await cleanupEnrichmentFile(enrichmentFile)
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
}

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
        `Enrichment file not found: ${resolvedPath}. Save the @claudemap-architect subagent output to that file before running setup-claudemap.`,
      )
    }

    throw error
  }

  if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
    throw new Error(
      `Enrichment file is empty: ${resolvedPath}. The @claudemap-architect subagent must return valid graph JSON before setup-claudemap runs. Refusing to fall back to the heuristic graph silently.`,
    )
  }

  return rawContent
}

async function cleanupEnrichmentFile(filePath) {
  try {
    const fs = await import('fs/promises')
    await fs.unlink(path.resolve(filePath))
  } catch {
    // Best-effort cleanup; ignore failures.
  }
}

function mcpClientModeLabel(renderResult, preferredLabel) {
  if (renderResult?.transport === GRAPH_SOURCES.FILE_SHIM && preferredLabel === 'stdio-mcp') {
    return 'stdio-mcp fallback:file-shim'
  }

  return preferredLabel
}

if (isDirectExecution()) {
  main().catch((error) => {
    console.error(`ClaudeMap failed: ${error.message}`)
    process.exitCode = 1
  })
}
