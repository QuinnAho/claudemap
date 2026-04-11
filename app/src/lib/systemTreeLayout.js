import {
  FILE_NODE_GAP_X,
  FILE_NODE_GAP_Y,
  FILE_NODE_HEIGHT,
  FILE_NODE_WIDTH,
  SYSTEM_NODE_BODY_PADDING_BOTTOM,
  SYSTEM_NODE_BODY_PADDING_TOP,
  SYSTEM_NODE_BODY_PADDING_X,
  SYSTEM_NODE_HEADER_HEIGHT,
  SYSTEM_NODE_LAYOUT_HEIGHT,
  getSystemNodeWidth,
} from '../components/graph/systemNodeSizing'

const EXPANDED_SYSTEM_WIDTH_BUFFER = 24

function getCollapsedSystemSize(node) {
  return {
    width: getSystemNodeWidth(node.data?.lineCount),
    height: SYSTEM_NODE_LAYOUT_HEIGHT,
  }
}

function getLeafNodeSize(node) {
  if (node.type === 'file') {
    return {
      width: FILE_NODE_WIDTH,
      height: FILE_NODE_HEIGHT,
    }
  }

  return {
    width: FILE_NODE_WIDTH,
    height: 30,
  }
}

function layoutFileChildren(children) {
  const positions = new Map()
  const columnCount = children.length > 1 ? 2 : 1
  let maxRight = 0
  let maxBottom = 0

  children.forEach((child, index) => {
    const x = SYSTEM_NODE_BODY_PADDING_X + (index % columnCount) * (FILE_NODE_WIDTH + FILE_NODE_GAP_X)
    const y =
      SYSTEM_NODE_HEADER_HEIGHT +
      SYSTEM_NODE_BODY_PADDING_TOP +
      Math.floor(index / columnCount) * (FILE_NODE_HEIGHT + FILE_NODE_GAP_Y)

    positions.set(child.id, { x, y })
    maxRight = Math.max(maxRight, x + FILE_NODE_WIDTH)
    maxBottom = Math.max(maxBottom, y + FILE_NODE_HEIGHT)
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
    ? layoutFileChildren(children)
    : layoutStackedChildren(children, getChildSize)
}

export function buildSystemTreeLayout(nodes, expandedSystemIds) {
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
        child.type === 'system' ? measureSystem(child.id) : getLeafNodeSize(child),
      )
    })

    const { positions, maxRight, maxBottom } = layoutChildren(
      directChildren,
      (child) => childSizeById.get(child.id) || getLeafNodeSize(child),
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
