import { useEffect, useState } from 'react'
import { computeLayout } from '../lib/layoutEngine'
import { useGraphStore } from '../store/graphStore'

export function useLayout() {
  const nodes = useGraphStore((state) => state.nodes)
  const edges = useGraphStore((state) => state.edges)
  const setGraph = useGraphStore((state) => state.setGraph)
  const [layoutReady, setLayoutReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (nodes.length === 0) {
      setLayoutReady(false)
      return undefined
    }

    const systemNodes = nodes.filter((node) => node.type === 'system')

    if (systemNodes.length === 0) {
      setLayoutReady(true)
      return undefined
    }

    const hasPositions = systemNodes.some((node) => node.position.x !== 0 || node.position.y !== 0)

    if (hasPositions) {
      setLayoutReady(true)
      return undefined
    }

    setLayoutReady(false)

    const systemNodeIds = new Set(systemNodes.map((node) => node.id))
    const systemEdges = edges.filter(
      (edge) => systemNodeIds.has(edge.source) && systemNodeIds.has(edge.target),
    )

    computeLayout(systemNodes, systemEdges).then((positionedSystemNodes) => {
      if (cancelled) {
        return
      }

      const positionedNodeMap = new Map(positionedSystemNodes.map((node) => [node.id, node]))
      const nextNodes = nodes.map((node) => positionedNodeMap.get(node.id) || node)

      setGraph(nextNodes, edges)
      setLayoutReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [nodes, edges, setGraph])

  return layoutReady
}
