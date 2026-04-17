import crypto from 'crypto'

// fingerprint owns two related concerns:
//
//   1. computeScopeFingerprint(graph, systemId) - a stable sha1 derived
//      from the system's label, filePath, ancestor labels, and child
//      system labels. Two structurally identical scopes hash to the same
//      value even when ids drift (a new enrichment run often reshuffles
//      ids while keeping labels stable).
//
//   2. createScopeDescriptor(graph, systemId) - assembles the stored
//      scope object that later pins a scoped map back to its system.
//
// The module also owns the cross-manifest helpers (normalizeText,
// normalizePathValue, collectAncestorLabels, arraysEqual, uniqueSorted)
// because scope-resolution consumes them too and keeping them here avoids
// a third "shared helpers" file. Both fingerprint and scope-resolution
// use the same node-by-id + ancestor-label routines, so they live
// together with their primary consumer.

export function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export function normalizePathValue(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .toLowerCase()
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right))
}

export function arraysEqual(left = [], right = []) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

export function getNodeByIdMap(graph) {
  return new Map((graph?.nodes || []).map((node) => [node.id, node]))
}

export function collectAncestorLabels(graph, systemId) {
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
    needsRebuild: false,
  }
}
