import fs from 'fs'
import crypto from 'crypto'
import {
  getProjectManifestPath,
  getRuntimeManifestPath,
  readJsonFile,
  writeJsonFileAtomic,
} from './runtime-paths.js'

export const DEFAULT_MAP_ID = 'root'
const MANIFEST_VERSION = 1

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function normalizePathValue(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .toLowerCase()
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right))
}

function createRootMapEntry() {
  return {
    id: DEFAULT_MAP_ID,
    label: 'ClaudeMap',
    summary: 'Full repo overview',
    scope: null,
    cachePath: 'claudemap-cache.json',
    graphPath: 'claudemap-runtime.json',
    statePath: 'claudemap-runtime-state.json',
  }
}

function createDefaultManifest() {
  return {
    version: MANIFEST_VERSION,
    activeMapId: DEFAULT_MAP_ID,
    maps: [createRootMapEntry()],
  }
}

function createScopedMapDefaults(mapId) {
  return {
    id: mapId,
    label: mapId,
    summary: '',
    scope: null,
    cachePath: `claudemap-cache.${mapId}.json`,
    graphPath: `claudemap-runtime.${mapId}.json`,
    statePath: `claudemap-runtime-state.${mapId}.json`,
  }
}

function getNodeByIdMap(graph) {
  return new Map((graph?.nodes || []).map((node) => [node.id, node]))
}

function collectAncestorLabels(graph, systemId) {
  const nodeById = getNodeByIdMap(graph)
  const labels = []
  let currentNode = nodeById.get(systemId)

  while (currentNode?.parentId) {
    const parentNode = nodeById.get(currentNode.parentId)

    if (!parentNode) {
      break
    }

    labels.unshift(parentNode.label || parentNode.id)
    currentNode = parentNode
  }

  return labels
}

function buildFingerprintPayload(graph, systemId) {
  const nodeById = getNodeByIdMap(graph)
  const node = nodeById.get(systemId)

  if (!node || node.type !== 'system') {
    return null
  }

  const childSystemLabels = uniqueSorted(
    (graph.nodes || [])
      .filter((candidate) => candidate.type === 'system' && candidate.parentId === systemId)
      .map((candidate) => normalizeText(candidate.label || candidate.id)),
  )

  return {
    label: normalizeText(node.label || node.id),
    filePath: normalizePathValue(node.filePath),
    ancestorPath: collectAncestorLabels(graph, systemId).map(normalizeText),
    childSystems: childSystemLabels,
  }
}

function arraysEqual(left = [], right = []) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function normalizeManifest(manifest) {
  const nextManifest =
    manifest && typeof manifest === 'object'
      ? {
          version: MANIFEST_VERSION,
          activeMapId: typeof manifest.activeMapId === 'string' ? manifest.activeMapId : DEFAULT_MAP_ID,
          maps: Array.isArray(manifest.maps)
            ? manifest.maps
                .map((entry) => {
                  if (!entry?.id) {
                    return null
                  }

                  if (entry.id === DEFAULT_MAP_ID) {
                    return {
                      ...createRootMapEntry(),
                      ...entry,
                      id: DEFAULT_MAP_ID,
                      scope: null,
                    }
                  }

                  return {
                    ...createScopedMapDefaults(entry.id),
                    ...entry,
                    scope: entry.scope
                      ? {
                          ...entry.scope,
                          stale: entry.scope.stale === true,
                        }
                      : null,
                  }
                })
                .filter(Boolean)
            : [],
        }
      : createDefaultManifest()

  const rootEntryIndex = nextManifest.maps.findIndex((entry) => entry?.id === DEFAULT_MAP_ID)

  if (rootEntryIndex === -1) {
    nextManifest.maps.unshift(createRootMapEntry())
  }

  if (!nextManifest.maps.some((entry) => entry?.id === nextManifest.activeMapId)) {
    nextManifest.activeMapId = DEFAULT_MAP_ID
  }

  return nextManifest
}

function manifestExists(projectRoot) {
  return fs.existsSync(getProjectManifestPath(projectRoot))
}

export function computeScopeFingerprint(graph, systemId) {
  const fingerprintPayload = buildFingerprintPayload(graph, systemId)

  if (!fingerprintPayload) {
    return null
  }

  return `sha1:${crypto.createHash('sha1').update(JSON.stringify(fingerprintPayload)).digest('hex')}`
}

export function createScopeDescriptor(graph, systemId) {
  const node = getNodeByIdMap(graph).get(systemId)

  if (!node || node.type !== 'system') {
    return null
  }

  return {
    type: 'subsystem',
    rootSystemId: node.id,
    rootSystemLabel: node.label || node.id,
    ancestorPath: collectAncestorLabels(graph, systemId),
    filePathHint: node.filePath || null,
    fingerprint: computeScopeFingerprint(graph, systemId),
    stale: false,
  }
}

export function readManifest(projectRoot) {
  const manifestPath = getProjectManifestPath(projectRoot)
  const manifest = readJsonFile(manifestPath, createDefaultManifest)
  return normalizeManifest(manifest)
}

export function writeManifest(projectRoot, manifest) {
  const normalizedManifest = normalizeManifest(manifest)
  writeJsonFileAtomic(getProjectManifestPath(projectRoot), normalizedManifest)
  writeJsonFileAtomic(getRuntimeManifestPath(), normalizedManifest)
  return normalizedManifest
}

export function ensureManifestForSetup(projectRoot) {
  const manifest = readManifest(projectRoot)

  if (!manifestExists(projectRoot)) {
    return writeManifest(projectRoot, manifest)
  }

  return manifest
}

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

export function resolveScopeAgainstGraph(scope, rootGraph) {
  const systemNodes = (rootGraph?.nodes || []).filter((node) => node.type === 'system')

  if (!scope || systemNodes.length === 0) {
    return null
  }

  if (scope.rootSystemId) {
    const directMatch = systemNodes.find((node) => node.id === scope.rootSystemId)

    if (directMatch) {
      return { systemId: directMatch.id, matchType: 'id' }
    }
  }

  if (scope.filePathHint) {
    const matchingSystems = systemNodes.filter(
      (node) => normalizePathValue(node.filePath) === normalizePathValue(scope.filePathHint),
    )

    if (matchingSystems.length === 1) {
      return { systemId: matchingSystems[0].id, matchType: 'file-path' }
    }
  }

  if (scope.fingerprint) {
    const matchingSystems = systemNodes.filter(
      (node) => computeScopeFingerprint(rootGraph, node.id) === scope.fingerprint,
    )

    if (matchingSystems.length === 1) {
      return { systemId: matchingSystems[0].id, matchType: 'fingerprint' }
    }
  }

  if (scope.rootSystemLabel) {
    const expectedLabel = normalizeText(scope.rootSystemLabel)
    const expectedAncestors = (scope.ancestorPath || []).map(normalizeText)
    const matchingSystems = systemNodes.filter((node) => {
      if (normalizeText(node.label || node.id) !== expectedLabel) {
        return false
      }

      return arraysEqual(
        collectAncestorLabels(rootGraph, node.id).map(normalizeText),
        expectedAncestors,
      )
    })

    if (matchingSystems.length === 1) {
      return { systemId: matchingSystems[0].id, matchType: 'ancestor-label' }
    }

    if (matchingSystems.length > 1) {
      return { systemId: matchingSystems[0].id, matchType: 'ancestor-label-ambiguous' }
    }
  }

  if (scope.rootSystemLabel) {
    const matchingSystems = systemNodes.filter(
      (node) => normalizeText(node.label || node.id) === normalizeText(scope.rootSystemLabel),
    )

    if (matchingSystems.length === 1) {
      return { systemId: matchingSystems[0].id, matchType: 'label' }
    }
  }

  return null
}
