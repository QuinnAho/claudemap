import { findMapById } from './map-manifest.js'
import { createSystemImportEdges } from './import-resolution.js'
import { GRAPH_SOURCES } from './contracts/graph-sources.js'
import { GRAPH_DIR_NAME } from './contracts/paths.js'

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

function getNearestSystemAncestor(nodeId, nodeById) {
  let currentNode = nodeById.get(nodeId)

  while (currentNode) {
    if (currentNode.type === 'system') {
      return currentNode.id
    }

    currentNode = currentNode.parentId ? nodeById.get(currentNode.parentId) : null
  }

  return null
}

function createScopedSystemIdByFilePath(scopedNodes) {
  const nodeById = new Map((scopedNodes || []).map((node) => [node.id, node]))
  const systemIdByFilePath = new Map()

  for (const node of scopedNodes || []) {
    if (node.type !== 'file' || !node.filePath) {
      continue
    }

    const parentSystemId = getNearestSystemAncestor(node.parentId, nodeById)

    if (!parentSystemId) {
      continue
    }

    systemIdByFilePath.set(node.filePath, parentSystemId)
  }

  return systemIdByFilePath
}

function mergeScopedEdges(existingEdges, inferredEdges, scopedNodeIds) {
  const mergedEdges = new Map()

  for (const edge of existingEdges || []) {
    if (!scopedNodeIds.has(edge.source) || !scopedNodeIds.has(edge.target)) {
      continue
    }

    mergedEdges.set(`${edge.source}->${edge.target}:${edge.type}`, edge)
  }

  for (const edge of inferredEdges || []) {
    const key = `${edge.source}->${edge.target}:${edge.type}`

    if (!mergedEdges.has(key)) {
      mergedEdges.set(key, edge)
    }
  }

  return [...mergedEdges.values()].sort((left, right) => left.id.localeCompare(right.id))
}

export function buildScopedSnapshot(rootGraph, rootSystemId, options = {}) {
  const rootNode = (rootGraph?.nodes || []).find(
    (node) => node.id === rootSystemId && node.type === 'system',
  )

  if (!rootNode) {
    throw new Error(`Unable to build scoped snapshot for missing system: ${rootSystemId}`)
  }

  const scopedNodeIds = collectScopedNodeIds(rootGraph.nodes, rootSystemId)
  const scopedFileNodes = (rootGraph.nodes || []).filter(
    (node) => scopedNodeIds.has(node.id) && node.type === 'file' && node.filePath,
  )
  const scopedFilePaths = new Set(scopedFileNodes.map((node) => node.filePath))
  const scopedFiles = (rootGraph.files || []).filter((fileRecord) =>
    scopedFilePaths.has(fileRecord.path || fileRecord.relativePath),
  )

  return {
    repoName: rootGraph.meta?.repoName || 'claudemap',
    branch: rootGraph.meta?.branch || 'workspace',
    generatedAt: new Date().toISOString(),
    scope: {
      rootSystemId: rootNode.id,
      label: options.label || rootNode.label || rootNode.id,
      filePathHint: rootNode.filePath || null,
      ancestorPath: options.ancestorPath || [],
    },
    files: scopedFiles,
    priorGraph: options.priorGraph || null,
    instructions: options.instructions || null,
  }
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
  const referencedFilePaths = new Set(
    scopedNodes
      .filter((node) => node.type === 'file' && node.filePath)
      .map((node) => node.filePath),
  )
  const scopedFiles = (rootGraph.files || []).filter((fileRecord) =>
    referencedFilePaths.has(fileRecord.path || fileRecord.relativePath),
  )
  const systemIdByFilePath = createScopedSystemIdByFilePath(scopedNodes)
  const inferredScopedEdges = createSystemImportEdges(scopedFiles, systemIdByFilePath)
  const scopedEdges = mergeScopedEdges(rootGraph.edges || [], inferredScopedEdges, scopedNodeIds)

  return {
    meta: {
      ...rootGraph.meta,
      generatedAt: new Date().toISOString(),
      source: GRAPH_SOURCES.SCOPED_MAP,
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

  return normalizedValue || GRAPH_SOURCES.SCOPED_MAP
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
    graphPath: `${GRAPH_DIR_NAME}/claudemap-runtime.${mapId}.json`,
    statePath: `${GRAPH_DIR_NAME}/claudemap-runtime-state.${mapId}.json`,
  }
}
