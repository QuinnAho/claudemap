import { useEffect, useRef, useState } from 'react'
import { computeLayout } from '../lib/layoutEngine'
import { buildSystemTreeLayout, getGraphLayoutSignature } from '../lib/systemTreeLayout'
import {
  FILE_NODE_HEIGHT,
  FILE_NODE_WIDTH,
  getExpandedFileNodeHeight,
  getFunctionNodePosition,
} from '../components/graph/systemNodeSizing'
import { getSystemPath } from '../lib/graphNodeUtils'
import { useGraphStore } from '../store/graphStore'
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
  const nodes = useGraphStore((state) => state.nodes)
  const edges = useGraphStore((state) => state.edges)
  const setGraph = useGraphStore((state) => state.setGraph)
  const hoveredPathIds = useGraphStore((state) => state.hoveredPathIds)
  const selectedNode = useGraphStore((state) => state.selectedNode)
  const highlightedNodes = useGraphStore((state) => state.highlightedNodes)
  const focusRequest = useGraphStore((state) => state.focusRequest)
  const presentationMode = useGraphStore((state) => state.presentationMode)
  const [layoutReady, setLayoutReady] = useState(false)
  const cachedTopLevelLayoutRef = useRef({
    signature: null,
    positionsById: new Map(),
  })

  useEffect(() => {
    let cancelled = false

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
        : presentationMode === 'free'
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
    const topLevelLayoutSignature = [
      getGraphLayoutSignature(nodes, edges),
      zoomLevel,
      ...topLevelSystemNodes
        .map((node) => {
          const topLevelSize = currentTreeLayout.sizeById.get(node.id)

          return `${node.id}:${topLevelSize?.width || node.width || 0}:${topLevelSize?.height || node.height || 0}`
        })
        .sort(),
    ].join('|')
    const cachedTopLevelLayout = cachedTopLevelLayoutRef.current

    const applyGeometry = (positionsById) => {
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

    if (cachedTopLevelLayout.signature === topLevelLayoutSignature) {
      applyGeometry(cachedTopLevelLayout.positionsById)
      return undefined
    }

    setLayoutReady(false)

    const sizedTopLevelNodes = topLevelSystemNodes.map((node) => ({
      ...node,
      width: currentTreeLayout.sizeById.get(node.id)?.width || node.width,
      height: currentTreeLayout.sizeById.get(node.id)?.height || node.height,
    }))
    const systemNodeIds = new Set(sizedTopLevelNodes.map((node) => node.id))
    const systemEdges = edges.filter(
      (edge) => systemNodeIds.has(edge.source) && systemNodeIds.has(edge.target),
    )

    computeLayout(sizedTopLevelNodes, systemEdges).then((positionedSystemNodes) => {
      if (cancelled) {
        return
      }

      const positionsById = new Map(
        positionedSystemNodes.map((node) => [node.id, node.position]),
      )

      cachedTopLevelLayoutRef.current = {
        signature: topLevelLayoutSignature,
        positionsById,
      }
      applyGeometry(positionsById)
    })

    return () => {
      cancelled = true
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
