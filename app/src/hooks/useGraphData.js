import { useEffect, useState } from 'react'
import sampleData from '../../../contracts/claudemap.sample.json'
import { useGraphStore } from '../store/graphStore'
import { getSystemNodeWidth, SYSTEM_NODE_LAYOUT_HEIGHT } from '../components/graph/systemNodeSizing'

function getFileNodePosition(index) {
  return {
    x: 12 + (index % 2) * 136,
    y: 102 + Math.floor(index / 2) * 54,
  }
}

function getFunctionNodePosition(index) {
  return {
    x: 8 + (index % 2) * 86,
    y: 44 + Math.floor(index / 2) * 28,
  }
}

export function transformToReactFlow(graphData) {
  const childIndexByParent = new Map()

  const nodes = graphData.nodes
    .map((node) => {
      if (node.type === 'system') {
        return {
          id: node.id,
          type: 'system',
          position: { x: 0, y: 0 },
          width: getSystemNodeWidth(node.lineCount),
          height: SYSTEM_NODE_LAYOUT_HEIGHT,
          data: {
            label: node.label,
            icon: node.icon,
            health: node.health,
            healthReason: node.healthReason,
            summary: node.summary,
            lineCount: node.lineCount,
            filePath: node.filePath,
          },
        }
      }

      if (node.type === 'file') {
        const currentIndex = childIndexByParent.get(node.parentId) || 0
        childIndexByParent.set(node.parentId, currentIndex + 1)

        return {
          id: node.id,
          type: 'file',
          parentId: node.parentId,
          position: getFileNodePosition(currentIndex),
          data: {
            label: node.label,
            health: node.health,
            healthReason: node.healthReason,
            summary: node.summary,
            lineCount: node.lineCount,
            filePath: node.filePath,
          },
        }
      }

      if (node.type === 'function') {
        const currentIndex = childIndexByParent.get(node.parentId) || 0
        childIndexByParent.set(node.parentId, currentIndex + 1)

        return {
          id: node.id,
          type: 'function',
          parentId: node.parentId,
          position: getFunctionNodePosition(currentIndex),
          data: {
            label: node.label,
            health: node.health,
            healthReason: node.healthReason,
            summary: node.summary,
            lineCount: node.lineCount,
            filePath: node.filePath,
          },
        }
      }

      return null
    })
    .filter(Boolean)

  const edges = graphData.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'custom',
    data: { relationshipType: edge.type },
  }))

  return { nodes, edges }
}

export function useGraphData() {
  const setGraph = useGraphStore((state) => state.setGraph)
  const setMeta = useGraphStore((state) => state.setMeta)
  const [graphLoaded, setGraphLoaded] = useState(false)

  useEffect(() => {
    const { nodes, edges } = transformToReactFlow(sampleData)
    const generatedAt = Date.parse(sampleData.meta?.generatedAt || '')

    setGraph(nodes, edges)
    setMeta({
      repoName: sampleData.meta?.repoName || 'expressjs/express',
      lastSyncedAt: Number.isNaN(generatedAt) ? Date.now() : generatedAt,
    })
    setGraphLoaded(true)
  }, [setGraph, setMeta])

  return graphLoaded
}
