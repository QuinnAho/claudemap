import { useEffect, useRef, useState } from 'react'
import { computeLayout } from '../lib/layoutEngine'
import { buildTopLevelLayoutEdges, dedupeBidirectionalLayoutEdges } from '../lib/layoutEdges'
import { computeSemanticTopLevelLayout } from '../lib/semanticTopLevelLayout'
import { buildSystemTreeLayout, getGraphLayoutSignature } from '../lib/systemTreeLayout'
import { buildTopLevelLayoutModel, reflowTopLevelLayout } from '../lib/topLevelLayout'
import {
  FILE_NODE_HEIGHT,
  FILE_NODE_WIDTH,
  SYSTEM_NODE_LAYOUT_HEIGHT,
  getExpandedFileNodeHeight,
  getFunctionNodePosition,
  getSystemNodeWidth,
} from '../components/graph/systemNodeSizing'
import { PRESENTATION_MODES } from '../contracts/presentation'
import { getSystemPath } from '../lib/graphNodeUtils'
import { useGraphStore } from '../store/graphStore'
import {
  selectEdges,
  selectFocusRequest,
  selectHighlightedNodes,
  selectHoveredPathIds,
  selectNodes,
  selectPresentationMode,
  selectSelectedNode,
  selectSetGraph,
} from '../store/selectors'
import { ZOOM_LEVELS } from './useZoomLevel'

function hasGeometryChanged(currentNodes, nextNodes) {
  return nextNodes.some((nextNode, index) => {
    const currentNode = currentNodes[index]

    if (!currentNode) {
      return true
    }

    return (
      currentNode.width !== nextNode.width ||
      currentNode.height !== nextNode.height ||
      currentNode.position.x !== nextNode.position.x ||
      currentNode.position.y !== nextNode.position.y
    )
  })
}

function buildFunctionIndexes(nodes) {
  const functionCountByFileId = new Map()
  const functionIndexById = new Map()
  const nextIndexByParentId = new Map()

  nodes.forEach((node) => {
    if (node.type !== 'function') {
      return
    }

    functionCountByFileId.set(
      node.parentId,
      (functionCountByFileId.get(node.parentId) || 0) + 1,
    )

    const functionIndex = nextIndexByParentId.get(node.parentId) || 0
    functionIndexById.set(node.id, functionIndex)
    nextIndexByParentId.set(node.parentId, functionIndex + 1)
  })

  return {
    functionCountByFileId,
    functionIndexById,
  }
}

function buildExpandedFileSizes(functionCountByFileId) {
  const fileSizeById = new Map()

  functionCountByFileId.forEach((functionCount, fileId) => {
    if (!functionCount) {
      return
    }

    fileSizeById.set(fileId, {
      width: FILE_NODE_WIDTH,
      height: getExpandedFileNodeHeight(functionCount),
    })
  })

  return fileSizeById
}

function getRevealedFileIds(nodes, selectedNode, focusRequest, highlightedNodes) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  return new Set(
    [selectedNode?.id, focusRequest?.nodeId, ...highlightedNodes]
      .map((nodeId) => nodeById.get(nodeId))
      .flatMap((node) => {
        if (!node) {
          return []
        }

        if (node.type === 'file') {
          return [node.id]
        }

        if (node.type === 'function' && node.parentId) {
          return [node.parentId]
        }

        return []
      }),
  )
}

export function useLayout(zoomLevel) {
  const nodes = useGraphStore(selectNodes)
  const edges = useGraphStore(selectEdges)
  const setGraph = useGraphStore(selectSetGraph)
  const hoveredPathIds = useGraphStore(selectHoveredPathIds)
  const selectedNode = useGraphStore(selectSelectedNode)
  const highlightedNodes = useGraphStore(selectHighlightedNodes)
  const focusRequest = useGraphStore(selectFocusRequest)
  const presentationMode = useGraphStore(selectPresentationMode)
  const [layoutReady, setLayoutReady] = useState(false)
  const cachedTopLevelLayoutRef = useRef({
    topologySignature: null,
    model: null,
    positionsById: new Map(),
  })

  useEffect(() => {
    let cancelled = false
    let geometryFrameId = null
    let geometryCommitFrameId = null

    if (nodes.length === 0) {
      setLayoutReady(false)
      return undefined
    }

    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const systemNodes = nodes.filter((node) => node.type === 'system')
    const topLevelSystemNodes = systemNodes.filter((node) => !node.parentId)
    const { functionCountByFileId, functionIndexById } = buildFunctionIndexes(nodes)
    const maxFileSizeById = buildExpandedFileSizes(functionCountByFileId)
    const revealedFileIds = getRevealedFileIds(
      nodes,
      selectedNode,
      focusRequest,
      highlightedNodes,
    )
    const fileSizeById = new Map()

    if (systemNodes.length === 0) {
      setLayoutReady(true)
      return undefined
    }

    revealedFileIds.forEach((fileId) => {
      const expandedSize = maxFileSizeById.get(fileId)

      if (expandedSize) {
        fileSizeById.set(fileId, expandedSize)
      }
    })

    const expandedSystemIds = new Set(
      zoomLevel === ZOOM_LEVELS.OVERVIEW
        ? []
        : presentationMode === PRESENTATION_MODES.FREE
          ? [
              ...hoveredPathIds,
              ...highlightedNodes.flatMap((nodeId) => getSystemPath(nodeId, nodeById)),
              ...(focusRequest?.nodeId ? getSystemPath(focusRequest.nodeId, nodeById) : []),
              ...(selectedNode?.id ? getSystemPath(selectedNode.id, nodeById) : []),
            ]
          : [
              ...highlightedNodes.flatMap((nodeId) => getSystemPath(nodeId, nodeById)),
              ...(focusRequest?.nodeId ? getSystemPath(focusRequest.nodeId, nodeById) : []),
              ...(selectedNode?.id ? getSystemPath(selectedNode.id, nodeById) : []),
            ],
    )
    const currentTreeLayout = buildSystemTreeLayout(nodes, expandedSystemIds, fileSizeById)
    const topLevelTopologySignature = getGraphLayoutSignature(nodes, edges)
    const cachedTopLevelLayout = cachedTopLevelLayoutRef.current
    const previousTopLevelNodesById = new Map(topLevelSystemNodes.map((node) => [node.id, node]))

    const clearScheduledGeometry = () => {
      if (geometryFrameId !== null) {
        window.cancelAnimationFrame(geometryFrameId)
        geometryFrameId = null
      }

      if (geometryCommitFrameId !== null) {
        window.cancelAnimationFrame(geometryCommitFrameId)
        geometryCommitFrameId = null
      }
    }

    const commitGeometry = (positionsById) => {
      cachedTopLevelLayoutRef.current = {
        ...cachedTopLevelLayoutRef.current,
        positionsById: new Map(positionsById),
      }

      const nextNodes = nodes.map((node) => {
        const nextPosition = node.parentId
          ? currentTreeLayout.positionById.get(node.id) || node.position
          : positionsById.get(node.id) || node.position

        if (node.type === 'function') {
          return {
            ...node,
            position: getFunctionNodePosition(functionIndexById.get(node.id) || 0),
          }
        }

        if (node.type === 'file') {
          const nextSize = fileSizeById.get(node.id)

          return {
            ...node,
            position: nextPosition,
            width: nextSize?.width || FILE_NODE_WIDTH,
            height: nextSize?.height || FILE_NODE_HEIGHT,
          }
        }

        if (node.type !== 'system') {
          return node.parentId
            ? {
                ...node,
                position: nextPosition,
              }
            : node
        }

        const nextSize = currentTreeLayout.sizeById.get(node.id)

        return {
          ...node,
          position: nextPosition,
          width: nextSize?.width || node.width,
          height: nextSize?.height || node.height,
        }
      })

      if (!hasGeometryChanged(nodes, nextNodes)) {
        setLayoutReady(true)
        return
      }

      setGraph(nextNodes, edges)
      setLayoutReady(true)
    }
    const applyGeometry = (positionsById, options = {}) => {
      const { defer = false } = options

      clearScheduledGeometry()

      if (!defer) {
        commitGeometry(positionsById)
        return
      }

      geometryFrameId = window.requestAnimationFrame(() => {
        geometryFrameId = null
        geometryCommitFrameId = window.requestAnimationFrame(() => {
          geometryCommitFrameId = null

          if (cancelled) {
            return
          }

          commitGeometry(positionsById)
        })
      })
    }

    const sizedTopLevelNodes = topLevelSystemNodes.map((node) => ({
      ...node,
      width: currentTreeLayout.sizeById.get(node.id)?.width || node.width,
      height: currentTreeLayout.sizeById.get(node.id)?.height || node.height,
    }))
    const changedTopLevelNodeIds = new Set(
      sizedTopLevelNodes
        .filter((node) => {
          const previousNode = previousTopLevelNodesById.get(node.id)

          return (
            !previousNode ||
            previousNode.width !== node.width ||
            previousNode.height !== node.height
          )
        })
        .map((node) => node.id),
    )

    if (
      cachedTopLevelLayout.topologySignature === topLevelTopologySignature &&
      cachedTopLevelLayout.model
    ) {
      const positionsById =
        changedTopLevelNodeIds.size === 0
          ? cachedTopLevelLayout.positionsById
          : reflowTopLevelLayout({
              nodes: sizedTopLevelNodes,
              previousNodesById: previousTopLevelNodesById,
              previousPositionsById: cachedTopLevelLayout.positionsById,
              layoutModel: cachedTopLevelLayout.model,
              changedNodeIds: changedTopLevelNodeIds,
            })

      applyGeometry(positionsById, {
        defer: changedTopLevelNodeIds.size > 0,
      })
      return undefined
    }

    setLayoutReady(false)

    const canonicalTopLevelNodes = topLevelSystemNodes.map((node) => ({
      ...node,
      width: getSystemNodeWidth(node.data?.lineCount),
      height: SYSTEM_NODE_LAYOUT_HEIGHT,
    }))
    const canonicalTopLevelNodesById = new Map(
      canonicalTopLevelNodes.map((node) => [node.id, node]),
    )
    const changedFromCanonicalNodeIds = new Set(
      sizedTopLevelNodes
        .filter((node) => {
          const canonicalNode = canonicalTopLevelNodesById.get(node.id)

          return (
            !canonicalNode ||
            canonicalNode.width !== node.width ||
            canonicalNode.height !== node.height
          )
        })
        .map((node) => node.id),
    )
    const systemNodeIds = new Set(canonicalTopLevelNodes.map((node) => node.id))
    const topLevelLayoutEdges = buildTopLevelLayoutEdges(
      edges,
      nodeById,
      systemNodeIds,
    )
    const layoutSystemEdges = dedupeBidirectionalLayoutEdges(topLevelLayoutEdges)
    const semanticTopLevelNodes = computeSemanticTopLevelLayout(
      canonicalTopLevelNodes,
      layoutSystemEdges,
    )
    const layoutPromise = semanticTopLevelNodes
      ? Promise.resolve(semanticTopLevelNodes)
      : computeLayout(canonicalTopLevelNodes, layoutSystemEdges)

    layoutPromise.then((positionedSystemNodes) => {
      if (cancelled) {
        return
      }

      const model = buildTopLevelLayoutModel(positionedSystemNodes)
      const positionsById = reflowTopLevelLayout({
        nodes: sizedTopLevelNodes,
        previousNodesById: canonicalTopLevelNodesById,
        previousPositionsById: model.preferredPositionsById,
        layoutModel: model,
        changedNodeIds: changedFromCanonicalNodeIds,
      })

      cachedTopLevelLayoutRef.current = {
        topologySignature: topLevelTopologySignature,
        model,
        positionsById: new Map(positionsById),
      }
      applyGeometry(positionsById)
    })

    return () => {
      cancelled = true
      clearScheduledGeometry()
    }
  }, [
    nodes,
    edges,
    focusRequest,
    highlightedNodes,
    hoveredPathIds,
    presentationMode,
    selectedNode,
    setGraph,
    zoomLevel,
  ])

  return layoutReady
}
