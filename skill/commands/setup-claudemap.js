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
  argumentHint: '[project-root]',
  body: `Set up ClaudeMap for the target repository.

High-level goal:

- snapshot the repository
- ask the bundled \`@claudemap-architect\` subagent to build a detailed graph with intuitive human grouping
- render that graph in the ClaudeMap UI

Generated runtime graphs are written into \`.claude/skills/claudemap-runtime/app/public/graph/\` (served by the bundled app as \`/graph/*\`). Do not drop graph files anywhere else under \`claudemap-runtime/\` - the \`graph/\` subdirectory is the one canonical home for runtime graph outputs.

Steps:
1. Treat the current working directory as the target project root unless the user gave a different path.
2. Resolve the bundled snapshot script at \`.claude/skills/claudemap-runtime/skill/commands/snapshot.js\`.
3. Run the snapshot script and capture the repo snapshot JSON.
4. Read \`.claude/skills/claudemap-runtime/skill/prompts/enrichment.txt\`.
5. Use the \`@claudemap-architect\` subagent explicitly and provide:
   - the snapshot JSON
   - the enrichment contract
   - instructions to return only valid graph JSON
   - instructions to optimize for detailed systems, useful file/function depth, and human-intuitive grouping
6. **Wait for the \`@claudemap-architect\` Task call to fully return**, then save the returned JSON to \`.claude/skills/claudemap-runtime/tmp/claudemap-enrichment.json\`. **Do not run the setup JS command until after this file exists with non-empty valid graph JSON.** Do not launch setup in parallel with the subagent call.
7. Run \`.claude/skills/claudemap-runtime/skill/commands/setup-claudemap.js\` with \`--enrichment-file\` pointing to that JSON file. The setup command is strict: it will exit non-zero if the file is missing, empty, or unparseable, and it will not fall back to a heuristic graph. If that happens, fix the architect output first and rerun - do not rerun setup without \`--enrichment-file\`.
8. Add \`--force-refresh\` only when the user explicitly asks for a full rebuild.
9. If the subagent cannot produce valid JSON after two attempts, stop and tell the user the architect pass failed. Do not silently retry setup without the enrichment file - that would render a heuristic graph and pollute the cache.
10. Report the analyzed file count, system count, graph source, render transport, and app readiness.
11. End with a short feedback prompt after the graph opens, for example: \`Does this map look right, or should I refine it?\`
12. If the user says the map is good, stop there.
13. If the user asks for refinement, reuse the current root cache graph from \`claudemap-cache.json\` as context, send that graph plus the requested changes back through \`@claudemap-architect\`, **wait for that Task call to fully return**, save the refined JSON to the same \`tmp/claudemap-enrichment.json\` path, and only then run \`.claude/skills/claudemap-runtime/skill/commands/refresh.js\` with \`--enrichment-file\` instead of telling the user to rerun setup from scratch. The refresh command applies the same strict enrichment validation as setup.
14. After the refined graph renders, ask the same short feedback prompt again.`,
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
