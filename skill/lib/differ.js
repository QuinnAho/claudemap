function toFileMap(files) {
  return new Map(files.map((file) => [file.path, file]))
}

function toIdMap(items) {
  return new Map(items.map((item) => [item.id, item]))
}

function hasNumericValue(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function diffFiles(currentFiles, cachedState) {
  const cachedFiles = Array.isArray(cachedState?.files) ? cachedState.files : []
  const cachedFileMap = toFileMap(cachedFiles)
  const currentFileMap = toFileMap(currentFiles)

  const added = currentFiles.filter((file) => !cachedFileMap.has(file.path))
  const removed = cachedFiles
    .filter((file) => !currentFileMap.has(file.path))
    .map((file) => file.path)

  const changed = currentFiles.filter((file) => {
    const cachedFile = cachedFileMap.get(file.path)

    if (!cachedFile) {
      return false
    }

    if (hasNumericValue(file.mtimeMs) && hasNumericValue(cachedFile.mtimeMs)) {
      return file.mtimeMs !== cachedFile.mtimeMs
    }

    return file.lineCount !== cachedFile.lineCount
  })

  return {
    added,
    removed,
    changed,
  }
}

function buildChangedFields(previousNode, nextNode) {
  const fields = {}

  for (const [key, value] of Object.entries(nextNode)) {
    if (key === 'id') {
      continue
    }

    if (JSON.stringify(previousNode[key]) !== JSON.stringify(value)) {
      fields[key] = value
    }
  }

  return fields
}

export function diffGraphs(previousGraph, nextGraph) {
  const previousNodes = Array.isArray(previousGraph?.nodes) ? previousGraph.nodes : []
  const nextNodes = Array.isArray(nextGraph?.nodes) ? nextGraph.nodes : []
  const previousEdges = Array.isArray(previousGraph?.edges) ? previousGraph.edges : []
  const nextEdges = Array.isArray(nextGraph?.edges) ? nextGraph.edges : []

  const previousNodeMap = toIdMap(previousNodes)
  const nextNodeMap = toIdMap(nextNodes)
  const previousEdgeMap = toIdMap(previousEdges)
  const nextEdgeMap = toIdMap(nextEdges)

  const addedNodes = nextNodes.filter((node) => !previousNodeMap.has(node.id))
  const removedNodes = previousNodes.filter((node) => !nextNodeMap.has(node.id)).map((node) => node.id)
  const updatedNodes = nextNodes
    .filter((node) => previousNodeMap.has(node.id))
    .map((node) => ({
      nodeId: node.id,
      fields: buildChangedFields(previousNodeMap.get(node.id), node),
    }))
    .filter((entry) => Object.keys(entry.fields).length > 0)

  const addedEdges = nextEdges.filter((edge) => !previousEdgeMap.has(edge.id))
  const removedEdges = previousEdges.filter((edge) => !nextEdgeMap.has(edge.id)).map((edge) => edge.id)

  return {
    addedNodes,
    removedNodes,
    updatedNodes,
    addedEdges,
    removedEdges,
  }
}
