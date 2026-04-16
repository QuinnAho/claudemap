import { DEFAULT_MAP_ID, findMapById, getActiveMap, readManifest } from './map-manifest.js'
import { resolveProjectPath, resolveRuntimePublicPath } from './runtime-paths.js'

const DEFAULT_CACHE_PATH = 'claudemap-cache.json'
const DEFAULT_RUNTIME_GRAPH_PATH = 'graph/claudemap-runtime.json'
const DEFAULT_RUNTIME_STATE_PATH = 'graph/claudemap-runtime-state.json'

export function resolveMapRuntimePaths(mapEntry) {
  return {
    graphPath: resolveRuntimePublicPath(mapEntry?.graphPath, DEFAULT_RUNTIME_GRAPH_PATH),
    statePath: resolveRuntimePublicPath(mapEntry?.statePath, DEFAULT_RUNTIME_STATE_PATH),
  }
}

export function resolveMapCachePath(projectRoot, mapEntry) {
  return resolveProjectPath(projectRoot, mapEntry?.cachePath, DEFAULT_CACHE_PATH)
}

export function resolveMapPaths(projectRoot, mapEntry) {
  return {
    cachePath: resolveMapCachePath(projectRoot, mapEntry),
    ...resolveMapRuntimePaths(mapEntry),
  }
}

export function resolveMapById(projectRoot, mapId) {
  const manifest = readManifest(projectRoot)
  const mapEntry = findMapById(manifest, mapId)

  if (!mapEntry) {
    throw new Error(`Unknown ClaudeMap id: ${mapId}`)
  }

  return {
    ...resolveMapPaths(projectRoot, mapEntry),
    mapId: mapEntry.id,
    manifest,
    mapEntry,
  }
}

export function resolveActiveMap(projectRoot) {
  const manifest = readManifest(projectRoot)
  const mapEntry = getActiveMap(manifest)

  return {
    ...resolveMapPaths(projectRoot, mapEntry),
    mapId: mapEntry?.id || DEFAULT_MAP_ID,
    manifest,
    mapEntry,
  }
}
