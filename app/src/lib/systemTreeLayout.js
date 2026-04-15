import {
  FILE_NODE_GAP_X,
  FILE_NODE_GAP_Y,
  FILE_NODE_HEIGHT,
  FILE_NODE_WIDTH,
  SYSTEM_NODE_BODY_PADDING_BOTTOM,
  SYSTEM_NODE_BODY_PADDING_TOP,
  SYSTEM_NODE_BODY_PADDING_X,
  SYSTEM_NODE_LAYOUT_HEIGHT,
  SYSTEM_NODE_HEADER_HEIGHT,
  getSystemNodeWidth,
} from '../components/graph/systemNodeSizing'

const EXPANDED_SYSTEM_WIDTH_BUFFER = 24

function getCollapsedSystemSize(node) {
  return {
    width: getSystemNodeWidth(node.data?.lineCount),
    height: SYSTEM_NODE_LAYOUT_HEIGHT,
  }
}

function getLeafNodeSize(node, leafSizeById = new Map()) {
  if (node.type === 'file') {
    return leafSizeById.get(node.id) || {
      width: FILE_NODE_WIDTH,
      height: FILE_NODE_HEIGHT,
    }
  }

  return {
    width: FILE_NODE_WIDTH,
    height: 30,
  }
}

function layoutFileChildren(children, getChildSize) {
  const positions = new Map()
  const columnCount = children.length > 1 ? 2 : 1
  const columnWidths = Array.from({ length: columnCount }, () => 0)
  const rowHeights = []
  const childLayouts = children.map((child, index) => {
    const childSize = getChildSize(child)
    const columnIndex = index % columnCount
    const rowIndex = Math.floor(index / columnCount)

    columnWidths[columnIndex] = Math.max(columnWidths[columnIndex], childSize.width)
    rowHeights[rowIndex] = Math.max(rowHeights[rowIndex] || 0, childSize.height)

    return {
      child,
      childSize,
      columnIndex,
      rowIndex,
    }
  })
  const columnOffsets = []
  const rowOffsets = []
  let maxRight = 0
  let maxBottom = 0
  let currentX = SYSTEM_NODE_BODY_PADDING_X
  let currentY = SYSTEM_NODE_HEADER_HEIGHT + SYSTEM_NODE_BODY_PADDING_TOP

  columnWidths.forEach((width, index) => {
    columnOffsets[index] = currentX
    currentX += width + FILE_NODE_GAP_X
  })

  rowHeights.forEach((height, index) => {
    rowOffsets[index] = currentY
    currentY += height + FILE_NODE_GAP_Y
  })

  childLayouts.forEach(({ child, childSize, columnIndex, rowIndex }) => {
    const x = columnOffsets[columnIndex]
    const y = rowOffsets[rowIndex]

    positions.set(child.id, { x, y })
    maxRight = Math.max(maxRight, x + childSize.width)
    maxBottom = Math.max(maxBottom, y + childSize.height)
  })

  return { positions, maxRight, maxBottom }
}

function layoutStackedChildren(children, getChildSize) {
  const positions = new Map()
  let maxRight = 0
  let maxBottom = 0
  let currentY = SYSTEM_NODE_HEADER_HEIGHT + SYSTEM_NODE_BODY_PADDING_TOP

  children.forEach((child) => {
    const childSize = getChildSize(child)
    const position = {
      x: SYSTEM_NODE_BODY_PADDING_X,
      y: currentY,
    }

    positions.set(child.id, position)
    maxRight = Math.max(maxRight, position.x + childSize.width)
    maxBottom = Math.max(maxBottom, position.y + childSize.height)
    currentY += childSize.height + FILE_NODE_GAP_Y
  })

  return { positions, maxRight, maxBottom }
}

function layoutChildren(children, getChildSize) {
  if (!children.length) {
    return {
      positions: new Map(),
      maxRight: 0,
      maxBottom: SYSTEM_NODE_LAYOUT_HEIGHT,
    }
  }

  return children.every((child) => child.type === 'file')
    ? layoutFileChildren(children, getChildSize)
    : layoutStackedChildren(children, getChildSize)
}

function normalizeCollapsedSystemSiblingWidths(children, childSizeById, sizeById) {
  const collapsedSystemWidths = children
    .filter((child) => child.type === 'system')
    .map((child) => ({
      id: child.id,
      size: childSizeById.get(child.id),
    }))
    .filter(({ size }) => size && size.height === SYSTEM_NODE_LAYOUT_HEIGHT)

  if (collapsedSystemWidths.length < 2) {
    return
  }

  const normalizedWidth = Math.max(...collapsedSystemWidths.map(({ size }) => size.width))

  collapsedSystemWidths.forEach(({ id, size }) => {
    const normalizedSize = {
      ...size,
      width: normalizedWidth,
    }

    childSizeById.set(id, normalizedSize)
    sizeById.set(id, normalizedSize)
  })
}

export function buildSystemTreeLayout(nodes, expandedSystemIds, leafSizeById = new Map()) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const childrenByParentId = new Map()
  const sizeById = new Map()
  const positionById = new Map()

  nodes.forEach((node) => {
    if (!node.parentId) {
      return
    }

    const currentChildren = childrenByParentId.get(node.parentId) || []
    currentChildren.push(node)
    childrenByParentId.set(node.parentId, currentChildren)
  })

  function measureSystem(nodeId) {
    if (sizeById.has(nodeId)) {
      return sizeById.get(nodeId)
    }

    const node = nodeById.get(nodeId)

    if (!node) {
      return getCollapsedSystemSize({ data: {} })
    }

    const collapsedSize = getCollapsedSystemSize(node)
    const directChildren = (childrenByParentId.get(nodeId) || []).filter(
      (child) => child.type !== 'function',
    )

    if (!expandedSystemIds.has(nodeId) || directChildren.length === 0) {
      sizeById.set(nodeId, collapsedSize)
      return collapsedSize
    }

    const childSizeById = new Map()

    directChildren.forEach((child) => {
      childSizeById.set(
        child.id,
        child.type === 'system' ? measureSystem(child.id) : getLeafNodeSize(child, leafSizeById),
      )
    })
    normalizeCollapsedSystemSiblingWidths(directChildren, childSizeById, sizeById)

    const { positions, maxRight, maxBottom } = layoutChildren(
      directChildren,
      (child) => childSizeById.get(child.id) || getLeafNodeSize(child, leafSizeById),
    )

    positions.forEach((position, childId) => {
      positionById.set(childId, position)
    })

    const expandedSize = {
      width: Math.max(
        collapsedSize.width + EXPANDED_SYSTEM_WIDTH_BUFFER,
        maxRight + SYSTEM_NODE_BODY_PADDING_X,
      ),
      height: Math.max(
        SYSTEM_NODE_LAYOUT_HEIGHT,
        maxBottom + SYSTEM_NODE_BODY_PADDING_BOTTOM,
      ),
    }

    sizeById.set(nodeId, expandedSize)
    return expandedSize
  }

  nodes
    .filter((node) => node.type === 'system')
    .forEach((node) => {
      measureSystem(node.id)
    })

  return {
    sizeById,
    positionById,
  }
}

export function getGraphLayoutSignature(nodes, edges) {
  const nodeSignature = nodes
    .map(
      (node) =>
        `${node.id}:${node.type}:${node.parentId || 'root'}:${node.data?.lineCount || 0}`,
    )
    .sort()
    .join('|')
  const edgeSignature = edges
    .map((edge) => `${edge.id}:${edge.source}:${edge.target}`)
    .sort()
    .join('|')

  return `${nodeSignature}__${edgeSignature}`
}
