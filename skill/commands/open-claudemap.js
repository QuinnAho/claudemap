#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { launchClaudeMapWindow } from '../lib/launcher.js'
import { resolveActiveMap } from '../lib/active-map.js'
import { GRAPH_SOURCES } from '../lib/contracts/graph-sources.js'

const DEFAULT_URL = 'http://127.0.0.1:5173'

function hasFlag(argv, flagName) {
  return argv.includes(`--${flagName}`)
}

function printUsage() {
  console.log('ClaudeMap open')
  console.log('  open-claudemap [project-root] [--open-browser] [--no-start-app]')
}

function resolveProjectRoot(argv) {
  const projectRootArg = argv.find((argument) => !argument.startsWith('--'))
  return path.resolve(
    projectRootArg || process.env.CLAUDEMAP_PROJECT_ROOT || process.env.INIT_CWD || process.cwd(),
  )
}

function readRuntimeGraph(graphPath) {
  try {
    const runtimeGraph = JSON.parse(fs.readFileSync(graphPath, 'utf8'))
    const nodes = Array.isArray(runtimeGraph?.nodes) ? runtimeGraph.nodes : []
    const systems = nodes.filter((node) => node.type === 'system').length
    const files = Array.isArray(runtimeGraph?.files) ? runtimeGraph.files.length : 0

    return {
      exists: nodes.length > 0,
      nodeCount: nodes.length,
      systemCount: systems,
      fileCount: files,
      source: runtimeGraph?.meta?.source || GRAPH_SOURCES.UNKNOWN,
      repoName: runtimeGraph?.meta?.repoName || 'unknown',
    }
  } catch {
    return {
      exists: false,
      nodeCount: 0,
      systemCount: 0,
      fileCount: 0,
      source: GRAPH_SOURCES.UNKNOWN,
      repoName: 'unknown',
    }
  }
}

async function main() {
  const argv = process.argv.slice(2)

  if (hasFlag(argv, 'help') || hasFlag(argv, 'h')) {
    printUsage()
    return
  }

  const projectRoot = resolveProjectRoot(argv)
  const openBrowser = hasFlag(argv, 'open-browser')
  const startApp = !hasFlag(argv, 'no-start-app')
  const activeMap = resolveActiveMap(projectRoot)
  const runtimeGraph = readRuntimeGraph(activeMap.graphPath)
  const launchState = await launchClaudeMapWindow({
    startIfNeeded: startApp,
    openBrowser,
    url: DEFAULT_URL,
  })

  if (runtimeGraph.exists) {
    console.log(
      `ClaudeMap open - loaded existing ${activeMap.mapId} graph for ${runtimeGraph.repoName} with ${runtimeGraph.systemCount} systems across ${runtimeGraph.fileCount} files`,
    )
    console.log(`Graph source: ${runtimeGraph.source}`)
  } else {
    console.log('ClaudeMap open - app runtime is available, but no graph is loaded yet')
    console.log('Run /setup-claudemap first to analyze a project and render a graph')
  }

  if (!launchState.running && !launchState.started) {
    console.log(`App server not detected at ${launchState.url}. Run \`npm run dev\` to view the graph.`)
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
  console.error(`ClaudeMap open failed: ${error.message}`)
  process.exitCode = 1
})
