export function buildNodeByIdMap(nodes) {
  return new Map(nodes.map((node) => [node.id, node]))
}

export function isDescendantOf(nodeId, ancestorId, nodeById) {
  if (!nodeId || !ancestorId) {
    return false
  }

  let currentNode = nodeById.get(nodeId)

  while (currentNode?.parentId) {
    if (currentNode.parentId === ancestorId) {
      return true
    }

    currentNode = nodeById.get(currentNode.parentId)
  }

  return false
}

export function isAncestorOf(nodeId, descendantId, nodeById) {
  return isDescendantOf(descendantId, nodeId, nodeById)
}

export function isNodeInSelectedBranch(node, selectedNode, nodeById) {
  if (!selectedNode) {
    return false
  }

  return (
    node.id === selectedNode.id ||
    isDescendantOf(node.id, selectedNode.id, nodeById) ||
    isAncestorOf(node.id, selectedNode.id, nodeById)
  )
}

export function getTopLevelSystemId(node, nodeById) {
  if (!node) {
    return null
  }

  let currentNode = node
  let topLevelSystemId = currentNode.type === 'system' ? currentNode.id : currentNode.data?.parentSystemId

  while (currentNode?.parentId) {
    const parentNode = nodeById.get(currentNode.parentId)

    if (!parentNode) {
      break
    }

    if (parentNode.type === 'system') {
      topLevelSystemId = parentNode.id
    }

    currentNode = parentNode
  }

  return topLevelSystemId || null
}

export function getSystemPath(nodeOrId, nodeById, includeSelf = true) {
  const currentNode =
    typeof nodeOrId === 'string' ? nodeById.get(nodeOrId) : nodeOrId

  if (!currentNode) {
    return []
  }

  const path = []
  let walker = includeSelf && currentNode.type === 'system'
    ? currentNode
    : currentNode.parentId
      ? nodeById.get(currentNode.parentId)
      : null

  while (walker) {
    if (walker.type === 'system') {
      path.push(walker.id)
    }

    walker = walker.parentId ? nodeById.get(walker.parentId) : null
  }

  return path.reverse()
}

export function isNodeVisible(node, expandedSystemIds, isOverview, nodeById) {
  if (node.type === 'function') {
    return false
  }

  if (isOverview) {
    return node.type === 'system' && !node.parentId
  }

  if (!node.parentId) {
    return node.type === 'system'
  }

  let parentNode = nodeById.get(node.parentId)

  while (parentNode) {
    if (parentNode.type === 'system' && !expandedSystemIds.has(parentNode.id)) {
      return false
    }

    parentNode = parentNode.parentId ? nodeById.get(parentNode.parentId) : null
  }

  return true
}
