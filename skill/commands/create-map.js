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
import { closeMcpClient, connectMcpClient, readRuntimeGraph, renderGraph } from '../lib/mcp-client.js'
import {
  allocateMapId,
  buildScopedGraphFromRoot,
  buildScopedSnapshot,
  createScopedMapFileSet,
  slugifyMapId,
} from '../lib/scoped-map.js'

const CURRENT_FILE_PATH = fileURLToPath(import.meta.url)

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

function resolveProjectRoot(argv) {
  const optionsWithValues = new Set([
    '--scope-json',
    '--root-system',
    '--label',
    '--summary',
    '--ancestors',
    '--file-path',
    '--map-id',
    '--enrichment-file',
    '--instructions',
  ])
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

function printUsage() {
  console.log('ClaudeMap create-map')
  console.log(
    '  node skill/commands/create-map.js [project-root] --scope-json <json> [--map-id <id>] [--no-activate] [--stdio-mcp] [--enrichment-file <file>] [--instructions <text>]',
  )
}

function parseAncestorPath(value) {
  if (!value) {
    return []
  }

  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return []
  }

  if (trimmedValue.startsWith('[')) {
    try {
      const parsedValue = JSON.parse(trimmedValue)
      return Array.isArray(parsedValue) ? parsedValue.filter(Boolean) : []
    } catch {
      return []
    }
  }

  return trimmedValue
    .split('>')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseScopeInput(argv) {
  const scopeJson = getOptionValue(argv, 'scope-json')

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

  return {
    scope: {
      type: 'subsystem',
      rootSystemId: getOptionValue(argv, 'root-system'),
      rootSystemLabel: getOptionValue(argv, 'label'),
      ancestorPath: parseAncestorPath(getOptionValue(argv, 'ancestors')),
      filePathHint: getOptionValue(argv, 'file-path'),
    },
    label: getOptionValue(argv, 'label'),
    summary: getOptionValue(argv, 'summary'),
    mapId: getOptionValue(argv, 'map-id'),
    instructions: getOptionValue(argv, 'instructions'),
  }
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

function isDirectExecution() {
  return process.argv[1] && path.resolve(process.argv[1]) === CURRENT_FILE_PATH
}

export async function main(argv = process.argv.slice(2)) {

  if (hasFlag(argv, 'help') || hasFlag(argv, 'h')) {
    printUsage()
    return
  }

  const projectRoot = resolveProjectRoot(argv)
  const { scope, label, summary, mapId, instructions } = parseScopeInput(argv)
  const shouldActivate = !hasFlag(argv, 'no-activate')
  const useStdioMcp = hasFlag(argv, 'stdio-mcp')
  const enrichmentFile = getOptionValue(argv, 'enrichment-file')
  const enrichmentResponseText = enrichmentFile ? await loadEnrichmentFileStrict(enrichmentFile) : null

  if (!scope?.rootSystemId && !scope?.rootSystemLabel && !scope?.filePathHint) {
    throw new Error('Missing scoped map target. Pass --scope-json or --root-system.')
  }

  let manifest = readManifest(projectRoot)
  const rootMapEntry = findMapById(manifest, DEFAULT_MAP_ID)
  const rootGraph = readRootGraph(projectRoot, rootMapEntry)
  const resolvedScope = resolveScopeAgainstGraph(scope, rootGraph)

  if (!resolvedScope) {
    throw new Error(`Could not resolve scoped map target: ${scope.rootSystemLabel || scope.rootSystemId}`)
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
      throw new Error(
        'Scoped enrichment parsed to an empty graph. Refusing to overwrite the scoped map with an empty result.',
      )
    }

    graphSource = 'claude-scoped'
  } else {
    scopedGraph = buildScopedGraphFromRoot(rootGraph, resolvedScope.systemId)
    graphSource = scopedGraph.meta?.source || 'scoped-map'
  }

  const nextScope = createScopeDescriptor(rootGraph, resolvedScope.systemId)
  const requestedMapId = mapId ? slugifyMapId(mapId) : null
  const requestedMapEntry = requestedMapId ? findMapById(manifest, requestedMapId) : null

  if (requestedMapEntry && requestedMapEntry.id !== existingMapEntry?.id) {
    throw new Error(`ClaudeMap id already exists: ${requestedMapId}`)
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

  const mcpClient = await connectMcpClient({
    mode: useStdioMcp ? 'stdio' : 'file-shim',
    graphPath: nextMapPaths.graphPath,
    statePath: nextMapPaths.statePath,
  })

  try {
    await renderGraph(mcpClient, scopedGraph)
  } finally {
    await closeMcpClient(mcpClient)
  }

  upsertMapEntry(manifest, nextMapEntry)

  if (shouldActivate) {
    setActiveMapId(manifest, nextMapEntry.id)
  }

  manifest = writeManifest(projectRoot, manifest)

  if (enrichmentFile) {
    await cleanupEnrichmentFile(enrichmentFile)
  }

  console.log(
    `${existingMapEntry ? 'Updated' : 'Created'} map ${nextMapEntry.id} (${nextMapEntry.label})`,
  )
  console.log(`Project root: ${projectRoot}`)
  console.log(`Scope: ${nextScope.rootSystemLabel}`)
  console.log(`Active map: ${manifest.activeMapId}`)
  console.log(`Graph source: ${graphSource}`)

  if (graphSource !== 'claude-scoped') {
    console.log(
      'Note: graph built from root filter. For richer subsystem grouping, rerun with --enrichment-file after an @claudemap-architect pass.',
    )
  }
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
        `Enrichment file not found: ${resolvedPath}. Save the @claudemap-architect subagent output to that file before running create-map.`,
      )
    }

    throw error
  }

  if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
    throw new Error(
      `Enrichment file is empty: ${resolvedPath}. The @claudemap-architect subagent must return valid graph JSON before create-map runs.`,
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

if (isDirectExecution()) {
  main().catch((error) => {
    console.error(`ClaudeMap create-map failed: ${error.message}`)
    process.exitCode = 1
  })
}
