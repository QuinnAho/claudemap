const DEFAULT_PADDING = {
  top: 30,
  left: 30,
}

const GROUP_HORIZONTAL_GAP = 112
const NODE_HORIZONTAL_GAP = 84
const NODE_VERTICAL_GAP = 96
const MIN_SEMANTIC_NODE_COUNT = 5

const SEMANTIC_GROUP_RANKS = Object.freeze({
  frontend: 10,
  client: 10,
  ui: 10,
  web: 10,
  backend: 20,
  server: 20,
  api: 20,
  service: 20,
  services: 20,
  database: 30,
  db: 30,
  data: 30,
  storage: 30,
  infra: 40,
  infrastructure: 40,
  scripts: 50,
  tools: 50,
})

function normalizeToken(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)[0] || ''
}

function firstPathSegment(filePath = '') {
  return normalizeToken(filePath.split(/[\\/]/).find(Boolean) || '')
}

function firstLabelToken(label = '') {
  return normalizeToken(label)
}

function groupKeyForNode(node) {
  return firstPathSegment(node.data?.filePath) || firstLabelToken(node.data?.label || node.id) || node.id
}

function buildSemanticGroups(nodes) {
  const rawGroupsByKey = new Map()

  nodes.forEach((node, index) => {
    const key = groupKeyForNode(node)
    const group = rawGroupsByKey.get(key) || {
      key,
      firstIndex: index,
      nodes: [],
    }

    group.nodes.push(node)
    group.firstIndex = Math.min(group.firstIndex, index)
    rawGroupsByKey.set(key, group)
  })

  return [...rawGroupsByKey.values()]
    .filter((group) => group.nodes.length > 0)
    .sort((left, right) => {
      const leftRank = SEMANTIC_GROUP_RANKS[left.key] ?? 100
      const rightRank = SEMANTIC_GROUP_RANKS[right.key] ?? 100

      return leftRank - rightRank || left.firstIndex - right.firstIndex || left.key.localeCompare(right.key)
    })
}

function getNodeWidth(node) {
  return node.width || 0
}

function getNodeHeight(node) {
  return node.height || 0
}

function columnCountForGroup(nodeCount) {
  if (nodeCount <= 1) return 1
  if (nodeCount <= 4) return 2
  return Math.min(3, Math.ceil(Math.sqrt(nodeCount)))
}

function getGroupInternalEdges(group, edges) {
  const nodeIds = new Set(group.nodes.map((node) => node.id))

  return edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
}

function scoreNodeOrder(nodes, columnCount, edges) {
  const gridByNodeId = new Map()

  nodes.forEach((node, index) => {
    gridByNodeId.set(node.id, {
      column: index % columnCount,
      row: Math.floor(index / columnCount),
    })
  })

  return edges.reduce((score, edge) => {
    const sourceGrid = gridByNodeId.get(edge.source)
    const targetGrid = gridByNodeId.get(edge.target)

    if (!sourceGrid || !targetGrid) {
      return score
    }

    const columnDelta = Math.abs(targetGrid.column - sourceGrid.column)
    const rowDelta = Math.abs(targetGrid.row - sourceGrid.row)
    const diagonalPenalty = columnDelta > 0 && rowDelta > 0 ? 3 : 0

    return score + columnDelta + rowDelta + diagonalPenalty
  }, 0)
}

function orderNodesForGroup(group, edges) {
  const orderedNodes = [...group.nodes]
  const columnCount = columnCountForGroup(orderedNodes.length)
  const internalEdges = getGroupInternalEdges(group, edges)

  if (columnCount < 2 || internalEdges.length === 0) {
    return orderedNodes
  }

  const rowCount = Math.ceil(orderedNodes.length / columnCount)

  for (let rowIndex = rowCount - 1; rowIndex >= 0; rowIndex -= 1) {
    const rowStart = rowIndex * columnCount
    const rowLength = Math.min(columnCount, orderedNodes.length - rowStart)

    if (rowLength !== 2) {
      continue
    }

    const currentScore = scoreNodeOrder(orderedNodes, columnCount, internalEdges)
    const swappedNodes = [...orderedNodes]
    const leftNode = swappedNodes[rowStart]

    swappedNodes[rowStart] = swappedNodes[rowStart + 1]
    swappedNodes[rowStart + 1] = leftNode

    if (scoreNodeOrder(swappedNodes, columnCount, internalEdges) < currentScore) {
      orderedNodes[rowStart] = swappedNodes[rowStart]
      orderedNodes[rowStart + 1] = swappedNodes[rowStart + 1]
    }
  }

  return orderedNodes
}

function buildGroupLayout(group, originX, originY, edges) {
  const nodes = orderNodesForGroup(group, edges)
  const columnCount = columnCountForGroup(nodes.length)
  const cellWidth = Math.max(...nodes.map(getNodeWidth))
  const cellHeight = Math.max(...nodes.map(getNodeHeight))
  const rowCount = Math.ceil(nodes.length / columnCount)
  const groupWidth = columnCount * cellWidth + Math.max(0, columnCount - 1) * NODE_HORIZONTAL_GAP
  const groupHeight = rowCount * cellHeight + Math.max(0, rowCount - 1) * NODE_VERTICAL_GAP
  const positionsById = new Map()

  nodes.forEach((node, index) => {
    const rowIndex = Math.floor(index / columnCount)
    const columnIndex = index % columnCount
    const nodesInRow =
      rowIndex === rowCount - 1 && nodes.length % columnCount !== 0
        ? nodes.length % columnCount
        : columnCount
    const rowWidth = nodesInRow * cellWidth + Math.max(0, nodesInRow - 1) * NODE_HORIZONTAL_GAP
    const rowOffsetX = (groupWidth - rowWidth) / 2

    positionsById.set(node.id, {
      x: originX + rowOffsetX + columnIndex * (cellWidth + NODE_HORIZONTAL_GAP) + (cellWidth - getNodeWidth(node)) / 2,
      y: originY + rowIndex * (cellHeight + NODE_VERTICAL_GAP),
    })
  })

  return {
    groupWidth,
    groupHeight,
    positionsById,
  }
}

function shouldUseSemanticLayout(groups, nodes) {
  if (nodes.length < MIN_SEMANTIC_NODE_COUNT) {
    return false
  }

  return groups.some((group) => group.nodes.length >= 3) || groups.filter((group) => group.nodes.length >= 2).length >= 2
}

export function computeSemanticTopLevelLayout(nodes, edges = [], options = {}) {
  const padding = {
    ...DEFAULT_PADDING,
    ...(options.padding || {}),
  }
  const groups = buildSemanticGroups(nodes)

  if (!shouldUseSemanticLayout(groups, nodes)) {
    return null
  }

  const positionedNodes = []
  let currentX = padding.left

  groups.forEach((group) => {
    const layout = buildGroupLayout(group, currentX, padding.top, edges)
    const positionsById = layout.positionsById

    group.nodes.forEach((node) => {
      positionedNodes.push({
        ...node,
        position: positionsById.get(node.id) || node.position,
      })
    })

    currentX += layout.groupWidth + GROUP_HORIZONTAL_GAP
  })

  return positionedNodes
}

export { buildSemanticGroups }
