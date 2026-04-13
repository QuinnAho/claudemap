import { useEffect, useRef, useState } from 'react'
import { useGraphStore } from '../store/graphStore'
import {
  FILE_NODE_HEIGHT,
  FILE_NODE_WIDTH,
  getContainerChildPosition,
  getFunctionNodePosition,
  getSystemNodeSize,
} from '../components/graph/systemNodeSizing'

function buildGraphIndexes(graphData) {
  const fileCountBySystem = new Map()
  const functionCountByFile = new Map()
  const systemIdByFile = new Map()
  const childCountByParent = new Map()
  const childTypeByParent = new Map()
  const nodeById = new Map(graphData.nodes.map((node) => [node.id, node]))

  const getNodeDepth = (node) => {
    let depth = 0
    let currentParentId = node.parentId

    while (currentParentId) {
      const parentNode = nodeById.get(currentParentId)

      if (!parentNode) {
        break
      }

      depth += 1
      currentParentId = parentNode.parentId
    }

    return depth
  }

  graphData.nodes.forEach((node) => {
    if (node.parentId) {
      childCountByParent.set(node.parentId, (childCountByParent.get(node.parentId) || 0) + 1)

      if (!childTypeByParent.has(node.parentId)) {
        childTypeByParent.set(node.parentId, node.type)
      }
    }

    if (node.type !== 'file') {
      return
    }

    fileCountBySystem.set(node.parentId, (fileCountBySystem.get(node.parentId) || 0) + 1)
    systemIdByFile.set(node.id, node.parentId)
  })

  graphData.nodes.forEach((node) => {
    if (node.type !== 'function') {
      return
    }

    functionCountByFile.set(node.parentId, (functionCountByFile.get(node.parentId) || 0) + 1)
  })

  return {
    fileCountBySystem,
    functionCountByFile,
    systemIdByFile,
    childCountByParent,
    childTypeByParent,
    getNodeDepth,
  }
}

export function transformToReactFlow(graphData) {
  const childIndexByParent = new Map()
  const {
    fileCountBySystem,
    functionCountByFile,
    systemIdByFile,
    childCountByParent,
    childTypeByParent,
    getNodeDepth,
  } = buildGraphIndexes(graphData)

  const nodes = graphData.nodes
    .map((node) => {
      if (node.type === 'system') {
        const childCount = childCountByParent.get(node.id) || 0
        const childType = childTypeByParent.get(node.id) || 'file'
        const overviewSize = getSystemNodeSize({
          lineCount: node.lineCount,
          childCount,
          childType,
          expanded: false,
        })
        const systemPositionIndex = childIndexByParent.get(node.parentId) || 0

        if (node.parentId) {
          childIndexByParent.set(node.parentId, systemPositionIndex + 1)
        }

        return {
          id: node.id,
          type: 'system',
          parentId: node.parentId || undefined,
          extent: node.parentId ? 'parent' : undefined,
          position: node.parentId
            ? getContainerChildPosition(
                systemPositionIndex,
                childCountByParent.get(node.parentId) || 0,
                'system',
              )
            : { x: 0, y: 0 },
          width: overviewSize.width,
          height: overviewSize.height,
          data: {
            label: node.label,
            icon: node.icon,
            health: node.health,
            healthReason: node.healthReason,
            summary: node.summary,
            lineCount: node.lineCount,
            filePath: node.filePath,
            childCount,
            childType,
            depth: getNodeDepth(node),
          },
        }
      }

      if (node.type === 'file') {
        const currentIndex = childIndexByParent.get(node.parentId) || 0
        const siblingCount = childCountByParent.get(node.parentId) || 0
        childIndexByParent.set(node.parentId, currentIndex + 1)

        return {
          id: node.id,
          type: 'file',
          parentId: node.parentId,
          extent: 'parent',
          position: getContainerChildPosition(currentIndex, siblingCount, 'file'),
          width: FILE_NODE_WIDTH,
          height: FILE_NODE_HEIGHT,
          data: {
            label: node.label,
            health: node.health,
            healthReason: node.healthReason,
            summary: node.summary,
            lineCount: node.lineCount,
            filePath: node.filePath,
            parentSystemId: node.parentId,
            functionCount: functionCountByFile.get(node.id) || 0,
            depth: getNodeDepth(node),
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
            parentFileId: node.parentId,
            parentSystemId: systemIdByFile.get(node.parentId) || null,
            depth: getNodeDepth(node),
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

function isGraphPayload(value) {
  return value && Array.isArray(value.nodes) && Array.isArray(value.edges)
}

function createDefaultRuntimeEnvelope() {
  return {
    graphRevision: -1,
    updatedAt: '',
    graphMeta: null,
    runtime: {
      healthOverlay: false,
      highlightedNodeIds: [],
      highlightColor: 'accent',
      focus: null,
      guidedFlow: null,
      presentation: {
        mode: 'free',
        lockInput: false,
        title: null,
        explanation: null,
        body: null,
        stepLabel: null,
        updatedAt: null,
      },
    },
  }
}

function isRuntimeEnvelope(value) {
  return value && typeof value.graphRevision === 'number' && value.runtime
}

let sampleGraphPromise = null

function getRuntimeSignature(runtimeEnvelope) {
  return [
    runtimeEnvelope.graphRevision,
    runtimeEnvelope.updatedAt || '',
    JSON.stringify(runtimeEnvelope.runtime || {}),
  ].join(':')
}

function createPublicAssetUrl(relativePath) {
  if (typeof window === 'undefined') {
    return `${import.meta.env.BASE_URL}${relativePath}`
  }

  const baseOrigin = new URL(import.meta.env.BASE_URL, window.location.origin)
  return new URL(relativePath, baseOrigin)
}

async function loadSampleGraph() {
  if (!sampleGraphPromise) {
    sampleGraphPromise = import('../../../contracts/claudemap.sample.json')
      .then((module) => module.default || module)
      .catch(() => null)
  }

  return sampleGraphPromise
}

async function fetchRuntimeGraph() {
  try {
    const runtimeGraphUrl = createPublicAssetUrl('claudemap-runtime.json')
    runtimeGraphUrl.searchParams.set('t', String(Date.now()))

    const response = await window.fetch(runtimeGraphUrl, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const graphData = await response.json()
    return isGraphPayload(graphData) ? graphData : null
  } catch {
    return null
  }
}

async function fetchRuntimeEnvelope() {
  try {
    const runtimeStateUrl = createPublicAssetUrl('claudemap-runtime-state.json')
    runtimeStateUrl.searchParams.set('t', String(Date.now()))

    const response = await window.fetch(runtimeStateUrl, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const runtimeEnvelope = await response.json()
    return isRuntimeEnvelope(runtimeEnvelope) ? runtimeEnvelope : null
  } catch {
    return null
  }
}

export function useGraphData() {
  const setGraph = useGraphStore((state) => state.setGraph)
  const setMeta = useGraphStore((state) => state.setMeta)
  const setRuntimeControls = useGraphStore((state) => state.setRuntimeControls)
  const [graphLoaded, setGraphLoaded] = useState(false)
  const latestGraphRevisionRef = useRef(null)
  const latestRuntimeSignatureRef = useRef('')

  useEffect(() => {
    let isMounted = true

    const applyGraphData = (graphData) => {
      if (!isMounted || !isGraphPayload(graphData)) {
        return
      }

      const { nodes, edges } = transformToReactFlow(graphData)

      setGraph(nodes, edges)
      setMeta({
        repoName: graphData.meta?.repoName || 'claudemap',
        branch: graphData.meta?.branch || 'current',
        creditLabel: graphData.meta?.creditLabel || 'ClaudeMap graph',
        source: graphData.meta?.source || 'sample',
        lastSyncedAt: Date.now(),
      })
      setGraphLoaded(true)
    }

    const applyRuntimeEnvelope = (runtimeEnvelope) => {
      const normalizedEnvelope = runtimeEnvelope || createDefaultRuntimeEnvelope()
      const runtimeSignature = getRuntimeSignature(normalizedEnvelope)

      if (runtimeSignature !== latestRuntimeSignatureRef.current) {
        latestRuntimeSignatureRef.current = runtimeSignature
        setRuntimeControls(normalizedEnvelope.runtime)
        setMeta({ lastSyncedAt: Date.now() })
      }
    }

    const loadRuntimeData = async () => {
      if (document.visibilityState === 'hidden') {
        return
      }

      const runtimeEnvelope = await fetchRuntimeEnvelope()

      if (!runtimeEnvelope) {
        applyGraphData(await loadSampleGraph())
        applyRuntimeEnvelope(null)
        latestGraphRevisionRef.current = -1
        return
      }

      applyRuntimeEnvelope(runtimeEnvelope)

      if (runtimeEnvelope.graphRevision === latestGraphRevisionRef.current) {
        setGraphLoaded(true)
        return
      }

      const runtimeGraph = await fetchRuntimeGraph()

      if (runtimeGraph) {
        applyGraphData(runtimeGraph)
        latestGraphRevisionRef.current = runtimeEnvelope.graphRevision
        return
      }

      applyGraphData(await loadSampleGraph())
      applyRuntimeEnvelope(null)
      latestGraphRevisionRef.current = -1
    }

    loadRuntimeData()

    const intervalId = window.setInterval(loadRuntimeData, 1200)
    window.addEventListener('focus', loadRuntimeData)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', loadRuntimeData)
    }
  }, [setGraph, setMeta, setRuntimeControls])

  return graphLoaded
}
