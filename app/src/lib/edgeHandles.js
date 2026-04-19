const HORIZONTAL_DOMINANCE_RATIO = 2.35

function boundsOf(node) {
  const left = node.position?.x || 0
  const top = node.position?.y || 0
  const width = node.width || 0
  const height = node.height || 0

  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  }
}

function rangeGap(startA, endA, startB, endB) {
  if (endA < startB) {
    return startB - endA
  }

  if (endB < startA) {
    return startA - endB
  }

  return 0
}

function horizontalHandles(deltaX) {
  return deltaX >= 0
    ? { sourceHandle: 'source-right', targetHandle: 'target-left' }
    : { sourceHandle: 'source-left', targetHandle: 'target-right' }
}

function verticalHandles(deltaY) {
  return deltaY >= 0
    ? { sourceHandle: 'source-bottom', targetHandle: 'target-top' }
    : { sourceHandle: 'source-top', targetHandle: 'target-bottom' }
}

export function chooseEdgeHandles(sourceNode, targetNode) {
  if (!sourceNode || !targetNode) {
    return {
      sourceHandle: 'source-bottom',
      targetHandle: 'target-top',
    }
  }

  const sourceBounds = boundsOf(sourceNode)
  const targetBounds = boundsOf(targetNode)
  const deltaX = targetBounds.centerX - sourceBounds.centerX
  const deltaY = targetBounds.centerY - sourceBounds.centerY
  const absDeltaX = Math.abs(deltaX)
  const absDeltaY = Math.abs(deltaY)
  const horizontalGap = rangeGap(
    sourceBounds.left,
    sourceBounds.right,
    targetBounds.left,
    targetBounds.right,
  )
  const verticalGap = rangeGap(
    sourceBounds.top,
    sourceBounds.bottom,
    targetBounds.top,
    targetBounds.bottom,
  )

  if (verticalGap === 0 && horizontalGap > 0) {
    return horizontalHandles(deltaX)
  }

  if (horizontalGap === 0 && verticalGap > 0) {
    return verticalHandles(deltaY)
  }

  if (verticalGap > 0 && absDeltaX <= absDeltaY * HORIZONTAL_DOMINANCE_RATIO) {
    return verticalHandles(deltaY)
  }

  if (absDeltaY > absDeltaX) {
    return verticalHandles(deltaY)
  }

  return horizontalHandles(deltaX)
}
