import {
  FILE_NODE_HEIGHT,
  FILE_NODE_WIDTH,
  getContainerChildPosition,
  getFunctionNodePosition,
  getSystemNodeSize,
} from '../components/graph/systemNodeSizing'

// Pure transform that turns a runtime graph payload into ReactFlow nodes and
// edges. Indexing helpers (buildGraphIndexes) are private to this module.

function buildGraphIndexes(graphData) {
  const fileCountBySystem = new Map()
  const functionCountByFile = new Map()
  const systemIdByFile = new Map()
  const childCountByParent = new Map()
  const childTypeByParent = new Map()
  const nodeById = new Map(graphData.nodes.map((node) => [node.id, node]))

  const getNodeDepth = (node) => {
    let depth = 0
    let currentParentId = node.parentId

    while (currentParentId) {
      const parentNode = nodeById.get(currentParentId)

      if (!parentNode) {
        break
      }

      depth += 1
      currentParentId = parentNode.parentId
    }

    return depth
  }

  graphData.nodes.forEach((node) => {
    if (node.parentId) {
      childCountByParent.set(node.parentId, (childCountByParent.get(node.parentId) || 0) + 1)

      if (!childTypeByParent.has(node.parentId)) {
        childTypeByParent.set(node.parentId, node.type)
      }
    }

    if (node.type !== 'file') {
      return
    }

    fileCountBySystem.set(node.parentId, (fileCountBySystem.get(node.parentId) || 0) + 1)
    systemIdByFile.set(node.id, node.parentId)
  })

  graphData.nodes.forEach((node) => {
    if (node.type !== 'function') {
      return
    }

    functionCountByFile.set(node.parentId, (functionCountByFile.get(node.parentId) || 0) + 1)
  })

  return {
    fileCountBySystem,
    functionCountByFile,
    systemIdByFile,
    childCountByParent,
    childTypeByParent,
    getNodeDepth,
  }
}

export function transformToReactFlow(graphData) {
  const childIndexByParent = new Map()
  const {
    functionCountByFile,
    systemIdByFile,
    childCountByParent,
    childTypeByParent,
    getNodeDepth,
  } = buildGraphIndexes(graphData)

  const nodes = graphData.nodes
    .map((node) => {
      if (node.type === 'system') {
        const childCount = childCountByParent.get(node.id) || 0
        const childType = childTypeByParent.get(node.id) || 'file'
        const overviewSize = getSystemNodeSize({
          lineCount: node.lineCount,
          childCount,
          childType,
          expanded: false,
        })
        const systemPositionIndex = childIndexByParent.get(node.parentId) || 0

        if (node.parentId) {
          childIndexByParent.set(node.parentId, systemPositionIndex + 1)
        }

        return {
          id: node.id,
          type: 'system',
          parentId: node.parentId || undefined,
          extent: node.parentId ? 'parent' : undefined,
          position: node.parentId
            ? getContainerChildPosition(
                systemPositionIndex,
                childCountByParent.get(node.parentId) || 0,
                'system',
              )
            : { x: 0, y: 0 },
          width: overviewSize.width,
          height: overviewSize.height,
          data: {
            label: node.label,
            icon: node.icon,
            health: node.health,
            healthReason: node.healthReason,
            summary: node.summary,
            lineCount: node.lineCount,
            filePath: node.filePath,
            childCount,
            childType,
            depth: getNodeDepth(node),
          },
        }
      }

      if (node.type === 'file') {
        const currentIndex = childIndexByParent.get(node.parentId) || 0
        const siblingCount = childCountByParent.get(node.parentId) || 0
        childIndexByParent.set(node.parentId, currentIndex + 1)

        return {
          id: node.id,
          type: 'file',
          parentId: node.parentId,
          extent: 'parent',
          position: getContainerChildPosition(currentIndex, siblingCount, 'file'),
          width: FILE_NODE_WIDTH,
          height: FILE_NODE_HEIGHT,
          data: {
            label: node.label,
            health: node.health,
            healthReason: node.healthReason,
            summary: node.summary,
            lineCount: node.lineCount,
            filePath: node.filePath,
            parentSystemId: node.parentId,
            functionCount: functionCountByFile.get(node.id) || 0,
            depth: getNodeDepth(node),
          },
        }
      }

      if (node.type === 'function') {
        const currentIndex = childIndexByParent.get(node.parentId) || 0
        childIndexByParent.set(node.parentId, currentIndex + 1)

        return {
          id: node.id,
          type: 'function',
          parentId: node.parentId,
          position: getFunctionNodePosition(currentIndex),
          data: {
            label: node.label,
            health: node.health,
            healthReason: node.healthReason,
            summary: node.summary,
            lineCount: node.lineCount,
            filePath: node.filePath,
            parentFileId: node.parentId,
            parentSystemId: systemIdByFile.get(node.parentId) || null,
            depth: getNodeDepth(node),
          },
        }
      }

      return null
    })
    .filter(Boolean)

  const edges = graphData.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'custom',
    data: { relationshipType: edge.type },
  }))

  return { nodes, edges }
}
