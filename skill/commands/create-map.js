#!/usr/bin/env node
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveMapPaths } from '../lib/active-map.js'
import { readCache, writeCache } from '../lib/cache.js'
import { enrichScopedGraph } from '../lib/enrichment.js'
import {
  DEFAULT_MAP_ID,
  createScopeDescriptor,
  findMapById,
  readManifest,
  resolveScopeAgainstGraph,
  setActiveMapId,
  upsertMapEntry,
  writeManifest,
} from '../lib/map-manifest.js'
import { readRuntimeGraph, renderGraph } from '../lib/mcp-client.js'
import { GRAPH_SOURCES } from '../lib/contracts/graph-sources.js'
import {
  allocateMapId,
  buildScopedGraphFromRoot,
  buildScopedSnapshot,
  createScopedMapFileSet,
  slugifyMapId,
} from '../lib/scoped-map.js'
import { runCommand, exitOnError } from '../lib/command-harness/run-command.js'
import { success, failure, ERROR_CODES } from '../lib/contracts/errors.js'
import { loadEnrichmentFileStrict, cleanupEnrichmentFile } from '../lib/command-harness/enrichment-io.js'

function parseScopeInput(scopeJson) {
  if (scopeJson) {
    const parsedValue = JSON.parse(scopeJson)
    return {
      scope: parsedValue.scope || parsedValue,
      label: parsedValue.label || parsedValue.scope?.label || null,
      summary: parsedValue.summary || parsedValue.scope?.summary || null,
      mapId: parsedValue.mapId || null,
      instructions: parsedValue.instructions || null,
    }
  }

  return null
}

function readRootGraph(projectRoot, rootMapEntry) {
  const rootMapPaths = resolveMapPaths(projectRoot, rootMapEntry)
  const runtimeGraph = readRuntimeGraph(rootMapPaths.graphPath)

  if (Array.isArray(runtimeGraph.nodes) && runtimeGraph.nodes.length > 0) {
    return runtimeGraph
  }

  const rootCache = readCache(projectRoot, { relativePath: rootMapEntry.cachePath })

  if (Array.isArray(rootCache?.graph?.nodes) && rootCache.graph.nodes.length > 0) {
    return rootCache.graph
  }

  throw new Error('No root ClaudeMap graph found. Run /setup-claudemap first.')
}

function findExistingMapForSystem(manifest, rootGraph, systemId) {
  return (
    manifest.maps.find((mapEntry) => {
      if (mapEntry.id === DEFAULT_MAP_ID || !mapEntry.scope) {
        return false
      }

      const resolvedScope = resolveScopeAgainstGraph(mapEntry.scope, rootGraph)
      return resolvedScope?.system?.id === systemId
    }) || null
  )
}

async function handleCreateMap({ ctx, args }) {
  const projectRoot = ctx.projectRoot
  const scopePayload = parseScopeInput(args.scopeJson)

  if (!scopePayload) {
    return failure(ERROR_CODES.INVALID_ARGUMENT, 'Missing scoped map target. Pass --scope-json.')
  }

  const { scope, label, summary, mapId, instructions } = scopePayload
  const shouldActivate = !args.noActivate
  const enrichmentFile = args.enrichmentFile
  const enrichmentResponseText = enrichmentFile ? loadEnrichmentFileStrict(enrichmentFile) : null

  if (!scope?.rootSystemId && !scope?.rootSystemLabel && !scope?.filePathHint) {
    return failure(ERROR_CODES.INVALID_ARGUMENT, 'Invalid scope payload. Missing rootSystemId or rootSystemLabel.')
  }

  let manifest = readManifest(projectRoot)
  const rootMapEntry = findMapById(manifest, DEFAULT_MAP_ID)
  const rootGraph = readRootGraph(projectRoot, rootMapEntry)
  const resolvedScope = resolveScopeAgainstGraph(scope, rootGraph)

  if (!resolvedScope) {
    return failure(
      ERROR_CODES.INVALID_ARGUMENT,
      `Could not resolve scoped map target: ${scope.rootSystemLabel || scope.rootSystemId}`,
    )
  }

  const resolvedSystemNode = rootGraph.nodes.find((node) => node.id === resolvedScope.system.id)
  const existingMapEntry = findExistingMapForSystem(manifest, rootGraph, resolvedScope.system.id)
  const priorGraph = existingMapEntry
    ? readCache(projectRoot, { relativePath: existingMapEntry.cachePath })?.graph || null
    : null

  let scopedGraph
  let graphSource

  if (enrichmentResponseText) {
    const scopedSnapshot = buildScopedSnapshot(rootGraph, resolvedScope.system.id, {
      label: label || resolvedSystemNode?.label,
      ancestorPath: scope.ancestorPath || [],
      priorGraph,
      instructions,
    })
    scopedGraph = await enrichScopedGraph(scopedSnapshot, {
      responseText: enrichmentResponseText,
      strict: true,
    })

    if (!Array.isArray(scopedGraph?.nodes) || scopedGraph.nodes.length === 0) {
      return failure(
        ERROR_CODES.INVALID_ARGUMENT,
        'Scoped enrichment parsed to an empty graph. Refusing to overwrite the scoped map with an empty result.',
      )
    }

    graphSource = GRAPH_SOURCES.CLAUDE_SCOPED
  } else {
    scopedGraph = buildScopedGraphFromRoot(rootGraph, resolvedScope.system.id)
    graphSource = scopedGraph.meta?.source || GRAPH_SOURCES.SCOPED_MAP
  }

  const nextScope = createScopeDescriptor(rootGraph, resolvedScope.system.id)
  const requestedMapId = mapId ? slugifyMapId(mapId) : null
  const requestedMapEntry = requestedMapId ? findMapById(manifest, requestedMapId) : null

  if (requestedMapEntry && requestedMapEntry.id !== existingMapEntry?.id) {
    return failure(ERROR_CODES.INVALID_ARGUMENT, `ClaudeMap id already exists: ${requestedMapId}`)
  }

  const nextMapId = existingMapEntry
    ? existingMapEntry.id
    : requestedMapId
      ? requestedMapId
      : allocateMapId(manifest, label || resolvedSystemNode?.label || resolvedScope.system.id)
  const nextMapEntry = {
    ...(existingMapEntry || createScopedMapFileSet(nextMapId)),
    id: nextMapId,
    label: label || existingMapEntry?.label || resolvedSystemNode?.label || nextMapId,
    summary:
      summary || existingMapEntry?.summary || resolvedSystemNode?.summary || 'Scoped subsystem map',
    scope: nextScope,
  }
  const nextMapPaths = resolveMapPaths(projectRoot, nextMapEntry)

  writeCache(projectRoot, scopedGraph, scopedGraph.files, { relativePath: nextMapEntry.cachePath })

  ctx.mcp.graphPath = nextMapPaths.graphPath
  ctx.mcp.statePath = nextMapPaths.statePath
  await renderGraph(ctx.mcp, scopedGraph)

  upsertMapEntry(manifest, nextMapEntry)

  if (shouldActivate) {
    setActiveMapId(manifest, nextMapEntry.id)
  }

  manifest = writeManifest(projectRoot, manifest)

  if (enrichmentFile) {
    cleanupEnrichmentFile(enrichmentFile)
  }

  console.log(
    `${existingMapEntry ? 'Updated' : 'Created'} map ${nextMapEntry.id} (${nextMapEntry.label})`,
  )
  console.log(`Project root: ${projectRoot}`)
  console.log(`Scope: ${nextScope.rootSystemLabel}`)
  console.log(`Active map: ${manifest.activeMapId}`)
  console.log(`Graph source: ${graphSource}`)

  if (graphSource !== GRAPH_SOURCES.CLAUDE_SCOPED) {
    console.log(
      'Note: graph built from root filter. For richer subsystem grouping, rerun with --enrichment-file after an @claudemap-architect pass.',
    )
  }

  return success()
}

export const CREATE_MAP_COMMAND = {
  name: 'create-map',
  summary: 'Create or refresh a scoped ClaudeMap for a major subsystem and switch to it.',
  argumentHint: '{"scope":{"rootSystemId":"...","rootSystemLabel":"...","ancestorPath":["..."]},"label":"...","summary":"..."} | <natural language scope description>',
  body: `Use the bundled ClaudeMap scoped-map command. Scoped maps are first-class architect views, not raw filters of the root graph.

Workflow:
1. Treat the current working directory as the target project root unless the user gave a different path.
2. Resolve the scope from the user's argument. If it is the JSON payload copied from ClaudeMap's "Create map?" affordance, use it as-is. If it is a natural language request (e.g. "map the auth system"), inspect the current root runtime graph at \`.claude/skills/claudemap-runtime/app/public/graph/claudemap-runtime.json\` and pick the best matching system node, then synthesize a scope payload with \`rootSystemId\`, \`rootSystemLabel\`, and \`ancestorPath\`.
3. Read \`.claude/skills/claudemap-runtime/skill/prompts/scoped-enrichment.txt\`. This is the dedicated scoped prompt - do not reuse the root enrichment prompt.
4. Build a scoped snapshot payload for \`@claudemap-architect\` containing: the repo/branch meta, the scope block, the filtered file list for that subsystem (pulled from the root graph), and - if the target map already has a cached scoped graph - include its graph as \`priorGraph\` so the architect can refine rather than rebuild. Include any user-provided refinement instructions under \`instructions\`.
5. Call \`@claudemap-architect\` with the scoped prompt + payload. Tell it to return valid graph JSON only, to emit richer internal subsystems (2-6) and edges than the root graph, and to decide on its own whether to edit the prior graph in place or rebuild based on the intent of the request.
6. **Wait for the \`@claudemap-architect\` Task call to fully return**, then save the returned JSON to \`.claude/skills/claudemap-runtime/tmp/claudemap-enrichment.json\`. Do not run create-map until that file contains valid graph JSON.
7. Run \`.claude/skills/claudemap-runtime/skill/commands/create-map.js\` with Node and pass the scope payload through \`--scope-json\`, the refinement instructions (if any) through \`--instructions\`, and the enrichment file through \`--enrichment-file\`. The command deletes the tmp file after it reads it.
8. Report the created or updated map id, label, scope root, graph source, and resulting active map id. If the graph source is not \`claude-scoped\`, warn the user that the scoped map is a filtered fallback view and suggest rerunning with architect enrichment.
9. If the payload is missing or invalid, ask the user to click "Create map?" in ClaudeMap again and paste the copied command, or describe the subsystem they want scoped.
10. End with a short feedback prompt after the scoped map renders, for example: \`Does this map look right, or should I refine it?\`
11. If the user says the map is good, stop there.
12. If the user asks for refinement, reuse the scoped map's cache graph (the \`cachePath\` for that map in the target project's repo-root \`claudemap-maps.json\`) as \`priorGraph\` in the architect payload, pass the refinement instructions through \`instructions\`, save the architect's response to \`.claude/skills/claudemap-runtime/tmp/claudemap-enrichment.json\`, and rerun \`create-map.js\` with the same \`--scope-json\` payload plus \`--enrichment-file\` and \`--instructions\` so the scoped graph iterates in place for the same map entry.
13. After the refined graph renders, ask the same short feedback prompt again.`,
  positional: {
    name: 'projectRoot',
    required: false,
  },
  flags: [
    { name: 'scope-json', type: 'string' },
    { name: 'map-id', type: 'string' },
    { name: 'no-activate', type: 'boolean' },
    { name: 'stdio-mcp', type: 'boolean' },
    { name: 'enrichment-file', type: 'string' },
    { name: 'instructions', type: 'string' },
  ],
  withMcp: true,
  handler: handleCreateMap,
}

export async function main(argv = process.argv.slice(2)) {
  return runCommand(CREATE_MAP_COMMAND, argv)
}

function isDirectExecution(fileUrl) {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(fileUrl)
}

if (isDirectExecution(import.meta.url)) {
  main().catch(exitOnError)
}
