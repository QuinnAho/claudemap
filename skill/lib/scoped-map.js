import { findMapById } from './map-manifest.js'

function createChildrenByParentMap(nodes) {
  const childrenByParent = new Map()

  for (const node of nodes || []) {
    if (!node?.parentId) {
      continue
    }

    if (!childrenByParent.has(node.parentId)) {
      childrenByParent.set(node.parentId, [])
    }

    childrenByParent.get(node.parentId).push(node)
  }

  return childrenByParent
}

function collectScopedNodeIds(nodes, rootSystemId) {
  const nodeIds = new Set()
  const childrenByParent = createChildrenByParentMap(nodes)
  const queue = [rootSystemId]

  while (queue.length > 0) {
    const currentNodeId = queue.shift()

    if (nodeIds.has(currentNodeId)) {
      continue
    }

    nodeIds.add(currentNodeId)

    for (const childNode of childrenByParent.get(currentNodeId) || []) {
      queue.push(childNode.id)
    }
  }

  return nodeIds
}

function getDirectScopedChildren(rootGraph, rootSystemId) {
  return (rootGraph?.nodes || []).filter(
    (node) => node.parentId === rootSystemId && node.type !== 'function',
  )
}

function shouldPromoteScopedChildren(rootGraph, rootSystemId) {
  const directChildren = getDirectScopedChildren(rootGraph, rootSystemId)

  if (directChildren.length < 2) {
    return false
  }

  return directChildren.every((node) => node.type === 'system')
}

export function buildScopedGraphFromRoot(rootGraph, rootSystemId) {
  const rootNode = (rootGraph?.nodes || []).find(
    (node) => node.id === rootSystemId && node.type === 'system',
  )

  if (!rootNode) {
    throw new Error(`Unable to create scoped map for missing system: ${rootSystemId}`)
  }

  const scopedNodeIds = collectScopedNodeIds(rootGraph.nodes, rootSystemId)
  const promoteScopedChildren = shouldPromoteScopedChildren(rootGraph, rootSystemId)
  const scopedNodes = (rootGraph.nodes || [])
    .filter((node) => scopedNodeIds.has(node.id))
    .flatMap((node) => {
      if (promoteScopedChildren && node.id === rootSystemId) {
        return []
      }

      if (promoteScopedChildren && node.parentId === rootSystemId && node.type === 'system') {
        return [{ ...node, parentId: null }]
      }

      if (node.id === rootSystemId) {
        return [{ ...node, parentId: null }]
      }

      return [{ ...node }]
    })
  const scopedEdges = (rootGraph.edges || []).filter(
    (edge) => scopedNodeIds.has(edge.source) && scopedNodeIds.has(edge.target),
  )
  const referencedFilePaths = new Set(
    scopedNodes
      .filter((node) => node.type === 'file' && node.filePath)
      .map((node) => node.filePath),
  )
  const scopedFiles = (rootGraph.files || []).filter((fileRecord) =>
    referencedFilePaths.has(fileRecord.path || fileRecord.relativePath),
  )

  return {
    meta: {
      ...rootGraph.meta,
      generatedAt: new Date().toISOString(),
      source: 'scoped-map',
      scope: {
        rootSystemId: rootNode.id,
        rootSystemLabel: rootNode.label || rootNode.id,
        layout: promoteScopedChildren ? 'promoted-children' : 'nested-root',
      },
    },
    nodes: scopedNodes,
    edges: scopedEdges,
    files: scopedFiles,
  }
}

export function slugifyMapId(value) {
  const normalizedValue = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalizedValue || 'scoped-map'
}

export function allocateMapId(manifest, label) {
  const baseId = slugifyMapId(label)
  let candidateId = baseId
  let suffix = 2

  while (findMapById(manifest, candidateId)) {
    candidateId = `${baseId}-${suffix}`
    suffix += 1
  }

  return candidateId
}

export function createScopedMapFileSet(mapId) {
  return {
    cachePath: `claudemap-cache.${mapId}.json`,
    graphPath: `claudemap-runtime.${mapId}.json`,
    statePath: `claudemap-runtime-state.${mapId}.json`,
  }
}
