import { CACHE_FILENAME, RUNTIME_GRAPH_REL, RUNTIME_STATE_REL } from './contracts/paths.js'
import { DEFAULT_MAP_ID, findMapById, getActiveMap, readManifest } from './map-manifest.js'
import { resolveProjectPath, resolveRuntimePublicPath } from './runtime-paths.js'

export function resolveMapRuntimePaths(mapEntry) {
  return {
    graphPath: resolveRuntimePublicPath(mapEntry?.graphPath, RUNTIME_GRAPH_REL),
    statePath: resolveRuntimePublicPath(mapEntry?.statePath, RUNTIME_STATE_REL),
  }
}

export function resolveMapCachePath(projectRoot, mapEntry) {
  return resolveProjectPath(projectRoot, mapEntry?.cachePath, CACHE_FILENAME)
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
