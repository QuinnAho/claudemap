import { DEFAULT_MAP_ID } from './normalize.js'

// index composes the five manifest concerns and holds the small
// collection of manifest-entry accessors that do not belong with any
// single concern:
//
//   findMapById(manifest, id)
//   getActiveMap(manifest)
//   setActiveMapId(manifest, id)
//   upsertMapEntry(manifest, entry)
//
// Everything else is re-exported from the owning submodule. The barrel
// (skill/lib/map-manifest.js) forwards this module verbatim so historical
// import paths keep working.

export function findMapById(manifest, mapId) {
  return manifest?.maps?.find((entry) => entry?.id === mapId) || null
}

export function getActiveMap(manifest) {
  return findMapById(manifest, manifest?.activeMapId) || findMapById(manifest, DEFAULT_MAP_ID)
}

export function setActiveMapId(manifest, mapId) {
  if (!findMapById(manifest, mapId)) {
    throw new Error(`Unknown ClaudeMap id: ${mapId}`)
  }

  manifest.activeMapId = mapId
  return manifest
}

export function upsertMapEntry(manifest, mapEntry) {
  const existingIndex = manifest.maps.findIndex((entry) => entry?.id === mapEntry.id)

  if (existingIndex === -1) {
    manifest.maps.push(mapEntry)
    return mapEntry
  }

  manifest.maps[existingIndex] = {
    ...manifest.maps[existingIndex],
    ...mapEntry,
  }
  return manifest.maps[existingIndex]
}

export { DEFAULT_MAP_ID } from './normalize.js'
export { readManifest, writeManifest, ensureManifestForSetup } from './io.js'
export { computeScopeFingerprint, createScopeDescriptor } from './fingerprint.js'
export { resolveScopeAgainstGraph } from './scope-resolution.js'
