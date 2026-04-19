const DEFAULT_HORIZONTAL_GAP = 64
const DEFAULT_VERTICAL_GAP = 84
const DEFAULT_PADDING = {
  top: 30,
  left: 30,
}
const LAYER_TOLERANCE = 1

function getNodeWidth(node) {
  return node.width || 0
}

function getNodeHeight(node) {
  return node.height || 0
}

function solveWeightedIsotonic(values, weights) {
  const blocks = []

  values.forEach((value, index) => {
    blocks.push({
      start: index,
      end: index,
      weight: weights[index],
      weightedSum: value * weights[index],
      mean: value,
    })

    while (blocks.length > 1) {
      const rightBlock = blocks[blocks.length - 1]
      const leftBlock = blocks[blocks.length - 2]

      if (leftBlock.mean <= rightBlock.mean) {
        break
      }

      const mergedWeight = leftBlock.weight + rightBlock.weight
      blocks.splice(blocks.length - 2, 2, {
        start: leftBlock.start,
        end: rightBlock.end,
        weight: mergedWeight,
        weightedSum: leftBlock.weightedSum + rightBlock.weightedSum,
        mean: (leftBlock.weightedSum + rightBlock.weightedSum) / mergedWeight,
      })
    }
  })

  const solved = Array(values.length).fill(0)

  blocks.forEach((block) => {
    for (let index = block.start; index <= block.end; index += 1) {
      solved[index] = block.mean
    }
  })

  return solved
}

function buildLayerEntries(nodes) {
  const sortedNodes = [...nodes].sort(
    (left, right) =>
      left.position.y - right.position.y || left.position.x - right.position.x,
  )
  const layers = []

  sortedNodes.forEach((node) => {
    const lastLayer = layers[layers.length - 1]

    if (!lastLayer || Math.abs(lastLayer.preferredY - node.position.y) > LAYER_TOLERANCE) {
      layers.push({
        preferredY: node.position.y,
        preferredHeight: getNodeHeight(node),
        nodeIds: [node.id],
      })
      return
    }

    lastLayer.nodeIds.push(node.id)
    lastLayer.preferredHeight = Math.max(lastLayer.preferredHeight, getNodeHeight(node))
  })

  return layers
}

function getNodeBounds(node) {
  const left = node.position?.x || 0
  const top = node.position?.y || 0
  const width = getNodeWidth(node)
  const height = getNodeHeight(node)

  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
    centerX: left + width / 2,
  }
}

function getHorizontalOverlap(leftNode, rightNode) {
  const leftBounds = getNodeBounds(leftNode)
  const rightBounds = getNodeBounds(rightNode)

  return Math.max(
    0,
    Math.min(leftBounds.right, rightBounds.right) -
      Math.max(leftBounds.left, rightBounds.left),
  )
}

function buildVerticalAnchorsByNodeId(layers, nodesById) {
  const anchorsByNodeId = new Map()

  for (let layerIndex = 1; layerIndex < layers.length; layerIndex += 1) {
    const previousLayer = layers[layerIndex - 1]
    const layer = layers[layerIndex]

    layer.nodeIds.forEach((nodeId) => {
      const node = nodesById.get(nodeId)

      if (!node) {
        return
      }

      const anchors = previousLayer.nodeIds
        .map((previousNodeId) => {
          const previousNode = nodesById.get(previousNodeId)

          if (!previousNode) {
            return null
          }

          return {
            nodeId: previousNodeId,
            overlap: getHorizontalOverlap(previousNode, node),
          }
        })
        .filter((anchor) => anchor && anchor.overlap > 0)
        .sort((left, right) => right.overlap - left.overlap)
        .map((anchor) => anchor.nodeId)

      if (anchors.length > 0) {
        anchorsByNodeId.set(nodeId, anchors)
      }
    })
  }

  return anchorsByNodeId
}

export function buildTopLevelLayoutModel(nodes, options = {}) {
  const horizontalGap = options.horizontalGap || DEFAULT_HORIZONTAL_GAP
  const verticalGap = options.verticalGap || DEFAULT_VERTICAL_GAP
  const padding = {
    ...DEFAULT_PADDING,
    ...(options.padding || {}),
  }
  const layers = buildLayerEntries(nodes)
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const preferredPositionsById = new Map(nodes.map((node) => [node.id, node.position]))
  const gapBeforeByLayer = layers.map((layer, index) => {
    if (index === 0) {
      return 0
    }

    const previousLayer = layers[index - 1]
    const measuredGap =
      layer.preferredY - previousLayer.preferredY - previousLayer.preferredHeight

    return Number.isFinite(measuredGap) ? Math.max(0, measuredGap) : verticalGap
  })

  return {
    horizontalGap,
    verticalGap,
    padding,
    layers,
    preferredPositionsById,
    verticalAnchorsByNodeId: buildVerticalAnchorsByNodeId(layers, nodesById),
    gapBeforeByLayer,
  }
}

function buildLayerPositions({
  layer,
  nodeById,
  previousNodesById,
  previousPositionsById,
  preferredPositionsById,
  changedNodeIds,
  horizontalGap,
  padding,
}) {
  const entries = layer.nodeIds
    .map((nodeId) => {
      const currentNode = nodeById.get(nodeId)

      if (!currentNode) {
        return null
      }

      const previousNode = previousNodesById.get(nodeId) || currentNode
      const currentWidth = getNodeWidth(currentNode)
      const previousWidth = getNodeWidth(previousNode) || currentWidth
      const preferredLeft =
        preferredPositionsById.get(nodeId)?.x ??
        previousPositionsById.get(nodeId)?.x ??
        currentNode.position.x
      const previousLeft =
        previousPositionsById.get(nodeId)?.x ?? preferredLeft
      const previousCenter = previousLeft + previousWidth / 2
      const preferredCenter = preferredLeft + currentWidth / 2
      const isChanged = changedNodeIds.has(nodeId)
      const hasPreviousPosition = previousPositionsById.has(nodeId)

      return {
        id: nodeId,
        currentWidth,
        preferredLeft,
        previousLeft,
        targetCenter: isChanged
          ? previousCenter
          : hasPreviousPosition
            ? previousCenter + (preferredCenter - previousCenter) * 0.45
            : preferredCenter,
        weight: isChanged ? 6 : hasPreviousPosition ? 2 : 1,
      }
    })
    .filter(Boolean)

  if (entries.length === 0) {
    return new Map()
  }

  if (entries.length === 1) {
    const [entry] = entries
    const left = Math.max(
      padding.left,
      changedNodeIds.has(entry.id) ? entry.previousLeft : entry.preferredLeft,
    )

    return new Map([[entry.id, { x: left }]])
  }

  const offsets = [0]

  for (let index = 1; index < entries.length; index += 1) {
    const previousEntry = entries[index - 1]
    const currentEntry = entries[index]

    offsets[index] =
      offsets[index - 1] +
      previousEntry.currentWidth / 2 +
      currentEntry.currentWidth / 2 +
      horizontalGap
  }
  const values = entries.map((entry, index) => entry.targetCenter - offsets[index])
  const solvedValues = solveWeightedIsotonic(
    values,
    entries.map((entry) => entry.weight),
  )
  let leftPositions = entries.map(
    (entry, index) => solvedValues[index] + offsets[index] - entry.currentWidth / 2,
  )
  const minimumLeft = Math.min(...leftPositions)

  if (minimumLeft < padding.left) {
    const shift = padding.left - minimumLeft
    leftPositions = leftPositions.map((left) => left + shift)
  }

  return new Map(
    entries.map((entry, index) => [
      entry.id,
      {
        x: leftPositions[index],
      },
    ]),
  )
}

export function reflowTopLevelLayout({
  nodes,
  previousNodesById,
  previousPositionsById,
  layoutModel,
  changedNodeIds = new Set(),
}) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const nextPositionsById = new Map()
  let previousLayerTop = null
  let previousLayerHeight = null

  layoutModel.layers.forEach((layer, index) => {
    const visibleNodeIds = layer.nodeIds.filter((nodeId) => nodeById.has(nodeId))

    if (!visibleNodeIds.length) {
      return
    }

    const layerNodes = visibleNodeIds.map((nodeId) => nodeById.get(nodeId))
    const fallbackLayerTop =
      previousLayerTop === null
        ? layer.preferredY
        : Math.max(
            layer.preferredY,
            previousLayerTop +
              previousLayerHeight +
              (layoutModel.gapBeforeByLayer[index] ?? layoutModel.verticalGap),
          )
    const layerPositions = buildLayerPositions({
      layer: {
        ...layer,
        nodeIds: visibleNodeIds,
      },
      nodeById,
      previousNodesById,
      previousPositionsById,
      preferredPositionsById: layoutModel.preferredPositionsById,
      changedNodeIds,
      horizontalGap: layoutModel.horizontalGap,
      padding: layoutModel.padding,
    })

    layerPositions.forEach((position, nodeId) => {
      const anchors = layoutModel.verticalAnchorsByNodeId?.get(nodeId) || []
      const anchorBottoms = anchors
        .map((anchorId) => {
          const anchorNode = nodeById.get(anchorId)
          const anchorPosition = nextPositionsById.get(anchorId)

          if (!anchorNode || !anchorPosition) {
            return null
          }

          return anchorPosition.y + getNodeHeight(anchorNode)
        })
        .filter((bottom) => bottom !== null)
      const layerTop = anchorBottoms.length > 0
        ? Math.max(
            layer.preferredY,
            Math.max(...anchorBottoms) +
              (layoutModel.gapBeforeByLayer[index] ?? layoutModel.verticalGap),
          )
        : fallbackLayerTop

      nextPositionsById.set(nodeId, {
        x: position.x,
        y: layerTop,
      })
    })

    const layerTops = visibleNodeIds
      .map((nodeId) => nextPositionsById.get(nodeId)?.y)
      .filter((top) => top !== undefined)
    const layerBottoms = visibleNodeIds
      .map((nodeId) => {
        const position = nextPositionsById.get(nodeId)
        const node = nodeById.get(nodeId)

        return position && node ? position.y + getNodeHeight(node) : null
      })
      .filter((bottom) => bottom !== null)

    previousLayerTop = layerTops.length ? Math.min(...layerTops) : fallbackLayerTop
    previousLayerHeight =
      layerBottoms.length && layerTops.length
        ? Math.max(...layerBottoms) - previousLayerTop
        : Math.max(...layerNodes.map((node) => getNodeHeight(node)))
  })

  nodes.forEach((node) => {
    if (nextPositionsById.has(node.id)) {
      return
    }

    nextPositionsById.set(
      node.id,
      previousPositionsById.get(node.id) ||
        layoutModel.preferredPositionsById.get(node.id) ||
        node.position,
    )
  })

  return nextPositionsById
}
