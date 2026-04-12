#!/usr/bin/env node
import path from 'path'
import { collectProjectSnapshot } from '../lib/file-walker.js'
import {
  enrichGraph,
  hasEnrichmentResponseOverride,
  selectPreferredGraph,
} from '../lib/enrichment.js'
import { isCacheStale, readCache, writeCache } from '../lib/cache.js'
import { launchClaudeMapWindow } from '../lib/launcher.js'
import { closeMcpClient, connectMcpClient, renderGraph } from '../lib/mcp-client.js'

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
  console.log('  setup-claudemap [project-root] [--force-refresh] [--demo-cache] [--no-render]')
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
  const startApp = shouldStartApp(argv)
  const openBrowser = hasFlag(argv, 'open-browser')
  const useStdioMcp = hasFlag(argv, 'stdio-mcp')
  const enrichmentFile = getOptionValue(argv, 'enrichment-file')
  const responseText = enrichmentFile ? await readFileIfExists(enrichmentFile) : null
  const snapshot = collectProjectSnapshot(projectRoot)
  const existingCache = readCache(projectRoot)
  const useCache =
    !forceRefresh && existingCache && !isCacheStale(projectRoot, snapshot.files, existingCache)
  const hasExplicitEnrichmentInput = Boolean(responseText) || hasEnrichmentResponseOverride()

  let graphData
  let cacheMode = 'reused'
  let preservedGraphSelection = null

  if (useCache) {
    graphData = existingCache.graph
  } else {
    const nextGraph = await enrichGraph(snapshot, { useDemoFallback, responseText })
    preservedGraphSelection = selectPreferredGraph(existingCache?.graph, nextGraph, {
      forceRefresh,
      allowLowerPriorityOverwrite: useDemoFallback || hasExplicitEnrichmentInput,
    })
    graphData = preservedGraphSelection.graph

    if (!preservedGraphSelection.preservedExisting) {
      writeCache(projectRoot, graphData, snapshot.files)
      cacheMode = forceRefresh ? 'forced refresh' : 'regenerated'
    } else {
      cacheMode = `preserved existing ${preservedGraphSelection.existingSource} graph`
    }
  }

  let renderResult = null

  if (!skipRender) {
    const mcpClient = await connectMcpClient({ mode: useStdioMcp ? 'stdio' : 'file-shim' })
    renderResult = await renderGraph(mcpClient, graphData)
    await closeMcpClient(mcpClient)
  }

  const launchState = await launchClaudeMapWindow({
    startIfNeeded: startApp,
    openBrowser,
  })

  console.log(
    `ClaudeMap ready - analyzed ${snapshot.totalFiles} files across ${countSystems(graphData)} systems`,
  )
  console.log(`Project root: ${projectRoot}`)
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

main().catch((error) => {
  console.error(`ClaudeMap failed: ${error.message}`)
  process.exitCode = 1
})

async function readFileIfExists(filePath) {
  const resolvedPath = path.resolve(filePath)
  return (await import('fs/promises')).readFile(resolvedPath, 'utf8')
}

function mcpClientModeLabel(renderResult, preferredLabel) {
  if (renderResult?.transport === 'file-shim' && preferredLabel === 'stdio-mcp') {
    return 'stdio-mcp fallback:file-shim'
  }

  return preferredLabel
}
