export const SYSTEM_NODE_MIN_HEIGHT = 70
export const SYSTEM_NODE_LAYOUT_HEIGHT = 84
export const SYSTEM_NODE_HEADER_HEIGHT = 78
export const SYSTEM_NODE_BODY_PADDING_X = 18
export const SYSTEM_NODE_BODY_PADDING_TOP = 16
export const SYSTEM_NODE_BODY_PADDING_BOTTOM = 18
export const FILE_NODE_WIDTH = 144
export const FILE_NODE_HEIGHT = 62
export const FILE_NODE_GAP_X = 12
export const FILE_NODE_GAP_Y = 14
export const SYSTEM_CHILD_CARD_WIDTH = 220
export const SYSTEM_CHILD_CARD_HEIGHT = SYSTEM_NODE_LAYOUT_HEIGHT

function getSystemFileColumnCount(fileCount = 0) {
  return fileCount > 1 ? 2 : 1
}

export function getSystemNodeWidth(lineCount = 100) {
  return 180 + Math.min(100, (lineCount / 50) * 10)
}

function getChildSlot(childType = 'file') {
  if (childType === 'system') {
    return {
      width: SYSTEM_CHILD_CARD_WIDTH,
      height: SYSTEM_CHILD_CARD_HEIGHT,
    }
  }

  return {
    width: FILE_NODE_WIDTH,
    height: FILE_NODE_HEIGHT,
  }
}

export function getSystemNodeSize({
  lineCount = 100,
  childCount = 0,
  childType = 'file',
  expanded = false,
}) {
  if (!expanded) {
    return {
      width: getSystemNodeWidth(lineCount),
      height: SYSTEM_NODE_LAYOUT_HEIGHT,
    }
  }

  const columnCount = getSystemFileColumnCount(childCount)
  const rowCount = Math.max(1, Math.ceil(childCount / columnCount))
  const childSlot = getChildSlot(childType)
  const contentWidth =
    columnCount * childSlot.width +
    Math.max(0, columnCount - 1) * FILE_NODE_GAP_X +
    SYSTEM_NODE_BODY_PADDING_X * 2
  const contentHeight =
    rowCount * childSlot.height +
    Math.max(0, rowCount - 1) * FILE_NODE_GAP_Y +
    SYSTEM_NODE_BODY_PADDING_TOP +
    SYSTEM_NODE_BODY_PADDING_BOTTOM

  return {
    width: Math.max(getSystemNodeWidth(lineCount) + 24, contentWidth),
    height: SYSTEM_NODE_HEADER_HEIGHT + contentHeight,
  }
}

export function getContainerChildPosition(index, childCount = 0, childType = 'file') {
  const columnCount = getSystemFileColumnCount(childCount)
  const childSlot = getChildSlot(childType)

  return {
    x: SYSTEM_NODE_BODY_PADDING_X + (index % columnCount) * (childSlot.width + FILE_NODE_GAP_X),
    y:
      SYSTEM_NODE_HEADER_HEIGHT +
      SYSTEM_NODE_BODY_PADDING_TOP +
      Math.floor(index / columnCount) * (childSlot.height + FILE_NODE_GAP_Y),
  }
}

export function getFunctionNodePosition(index) {
  return {
    x: 8 + (index % 2) * 86,
    y: FILE_NODE_HEIGHT + 10 + Math.floor(index / 2) * 28,
  }
}
