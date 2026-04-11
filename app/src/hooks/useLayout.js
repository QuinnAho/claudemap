import { useEffect, useRef, useState } from 'react'
import { computeLayout } from '../lib/layoutEngine'
import { buildSystemTreeLayout, getGraphLayoutSignature } from '../lib/systemTreeLayout'
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

export function useLayout(zoomLevel) {
  const nodes = useGraphStore((state) => state.nodes)
  const edges = useGraphStore((state) => state.edges)
  const setGraph = useGraphStore((state) => state.setGraph)
  const hoveredPathIds = useGraphStore((state) => state.hoveredPathIds)
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

    const systemNodes = nodes.filter((node) => node.type === 'system')
    const topLevelSystemNodes = systemNodes.filter((node) => !node.parentId)

    if (systemNodes.length === 0) {
      setLayoutReady(true)
      return undefined
    }

    const expandedSystemIds = new Set(
      zoomLevel === ZOOM_LEVELS.OVERVIEW ? [] : hoveredPathIds,
    )
    const currentTreeLayout = buildSystemTreeLayout(nodes, expandedSystemIds)
    const layoutSignature = getGraphLayoutSignature(nodes, edges)
    const cachedTopLevelLayout = cachedTopLevelLayoutRef.current

    const applyGeometry = (positionsById) => {
      const nextNodes = nodes.map((node) => {
        const nextPosition = node.parentId
          ? currentTreeLayout.positionById.get(node.id) || node.position
          : positionsById.get(node.id) || node.position

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

    if (cachedTopLevelLayout.signature === layoutSignature) {
      applyGeometry(cachedTopLevelLayout.positionsById)
      return undefined
    }

    setLayoutReady(false)

    const fullyExpandedSystemIds = new Set(systemNodes.map((node) => node.id))
    const maxTreeLayout = buildSystemTreeLayout(nodes, fullyExpandedSystemIds)
    const sizedTopLevelNodes = topLevelSystemNodes.map((node) => ({
      ...node,
      width: maxTreeLayout.sizeById.get(node.id)?.width || node.width,
      height: maxTreeLayout.sizeById.get(node.id)?.height || node.height,
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
        signature: layoutSignature,
        positionsById,
      }
      applyGeometry(positionsById)
    })

    return () => {
      cancelled = true
    }
  }, [nodes, edges, hoveredPathIds, setGraph, zoomLevel])

  return layoutReady
}
