// Helpers for layout-only edge normalization.
//
// The rendered graph should keep every authored relationship, but ELK's
// top-level layered layout behaves poorly when it receives reciprocal imports
// as separate constraints. Collapse those pairs for placement so root systems
// get stable lanes without changing the visible edge set.

import { getTopLevelSystemId } from './graphNodeUtils'

export function buildTopLevelLayoutEdges(edges, nodeById, topLevelNodeIds) {
  const layoutEdgesByKey = new Map()

  edges.forEach((edge) => {
    const source = getTopLevelSystemId(nodeById.get(edge.source), nodeById)
    const target = getTopLevelSystemId(nodeById.get(edge.target), nodeById)

    if (!source || !target || source === target) {
      return
    }

    if (!topLevelNodeIds.has(source) || !topLevelNodeIds.has(target)) {
      return
    }

    const key = `${source}->${target}`

    if (layoutEdgesByKey.has(key)) {
      return
    }

    layoutEdgesByKey.set(key, {
      ...edge,
      source,
      target,
    })
  })

  return Array.from(layoutEdgesByKey.values())
}

export function dedupeBidirectionalLayoutEdges(edges) {
  const seenPairs = new Set()

  return edges.filter((edge) => {
    const source = edge.source || ''
    const target = edge.target || ''
    const pairKey = source < target ? `${source}\u0000${target}` : `${target}\u0000${source}`

    if (seenPairs.has(pairKey)) {
      return false
    }

    seenPairs.add(pairKey)
    return true
  })
}
