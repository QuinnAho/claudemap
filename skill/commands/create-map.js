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
      return resolvedScope?.systemId === systemId
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

  const resolvedSystemNode = rootGraph.nodes.find((node) => node.id === resolvedScope.systemId)
  const existingMapEntry = findExistingMapForSystem(manifest, rootGraph, resolvedScope.systemId)
  const priorGraph = existingMapEntry
    ? readCache(projectRoot, { relativePath: existingMapEntry.cachePath })?.graph || null
    : null

  let scopedGraph
  let graphSource

  if (enrichmentResponseText) {
    const scopedSnapshot = buildScopedSnapshot(rootGraph, resolvedScope.systemId, {
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
    scopedGraph = buildScopedGraphFromRoot(rootGraph, resolvedScope.systemId)
    graphSource = scopedGraph.meta?.source || GRAPH_SOURCES.SCOPED_MAP
  }

  const nextScope = createScopeDescriptor(rootGraph, resolvedScope.systemId)
  const requestedMapId = mapId ? slugifyMapId(mapId) : null
  const requestedMapEntry = requestedMapId ? findMapById(manifest, requestedMapId) : null

  if (requestedMapEntry && requestedMapEntry.id !== existingMapEntry?.id) {
    return failure(ERROR_CODES.INVALID_ARGUMENT, `ClaudeMap id already exists: ${requestedMapId}`)
  }

  const nextMapId = existingMapEntry
    ? existingMapEntry.id
    : requestedMapId
      ? requestedMapId
      : allocateMapId(manifest, label || resolvedSystemNode?.label || resolvedScope.systemId)
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
