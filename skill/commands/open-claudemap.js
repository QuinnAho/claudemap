#!/usr/bin/env node
import path from 'path'
import { fileURLToPath } from 'url'
import { launchClaudeMapWindow } from '../lib/launcher.js'
import { readRuntimeGraph } from '../lib/mcp-client.js'
import { GRAPH_SOURCES } from '../lib/contracts/graph-sources.js'
import { runCommand, exitOnError } from '../lib/command-harness/run-command.js'
import { success } from '../lib/contracts/errors.js'

const DEFAULT_URL = 'http://127.0.0.1:5173'

function getGraphStats(graphPath) {
  try {
    const runtimeGraph = readRuntimeGraph(graphPath)
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

async function handleOpenClaudemap({ ctx, args }) {
  const openBrowser = args.openBrowser || false
  const startApp = args.startApp !== false
  const activeMap = ctx.activeMap
  const graphStats = getGraphStats(activeMap.graphPath)
  const launchState = await launchClaudeMapWindow({
    startIfNeeded: startApp,
    openBrowser,
    url: DEFAULT_URL,
  })

  if (graphStats.exists) {
    console.log(
      `ClaudeMap open - loaded existing ${activeMap.mapId} graph for ${graphStats.repoName} with ${graphStats.systemCount} systems across ${graphStats.fileCount} files`,
    )
    console.log(`Graph source: ${graphStats.source}`)
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

  return success()
}

export const OPEN_CLAUDEMAP_COMMAND = {
  name: 'open-claudemap',
  summary: 'Open the bundled ClaudeMap app for the current project without rebuilding the graph.',
  disableModelInvocation: true,
  body: `Use the bundled ClaudeMap open command to bring up the existing map runtime.

Steps:
1. Resolve the bundled command script at \`.claude/skills/claudemap-runtime/skill/commands/open-claudemap.js\`.
2. Run the open command with Node.
3. If a graph is already loaded, report the repo name, graph source, system count, and file count.
4. If no graph is loaded yet, tell the user to run \`/setup-claudemap\` first.
5. Report whether the app server was reused, started, or still unavailable.`,
  positional: {
    name: 'projectRoot',
    required: false,
  },
  flags: [
    { name: 'open-browser', type: 'boolean' },
    { name: 'start-app', type: 'boolean' },
  ],
  handler: handleOpenClaudemap,
}

export async function main(argv = process.argv.slice(2)) {
  return runCommand(OPEN_CLAUDEMAP_COMMAND, argv)
}

function isDirectExecution(fileUrl) {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(fileUrl)
}

if (isDirectExecution(import.meta.url)) {
  main().catch(exitOnError)
}
