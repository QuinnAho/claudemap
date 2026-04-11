import { Background, ReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useRef } from 'react'
import '@xyflow/react/dist/style.css'
import ZoomControls from '../ui/ZoomControls'
import { useGraphStore } from '../../store/graphStore'
import { useGraphData } from '../../hooks/useGraphData'
import { useLayout } from '../../hooks/useLayout'
import SystemNode from './SystemNode'
import CustomEdge from './CustomEdge'
import FileNode from './FileNode'
import FunctionNode from './FunctionNode'
import { useZoomLevel, ZOOM_LEVELS } from '../../hooks/useZoomLevel'
import {
  buildNodeByIdMap,
  getSystemPath,
  getTopLevelSystemId,
  isNodeInSelectedBranch,
  isNodeVisible,
} from '../../lib/graphNodeUtils'

const nodeTypes = {
  system: SystemNode,
  file: FileNode,
  function: FunctionNode,
}

const edgeTypes = {
  custom: CustomEdge,
}

const OVERVIEW_FIT_VIEW_OPTIONS = {
  padding: 0.2,
  maxZoom: 0.65,
}

export default function GraphCanvas() {
  const nodes = useGraphStore((state) => state.nodes)
  const edges = useGraphStore((state) => state.edges)
  const healthOverlay = useGraphStore((state) => state.healthOverlay)
  const selectedNode = useGraphStore((state) => state.selectedNode)
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode)
  const hoveredPathIds = useGraphStore((state) => state.hoveredPathIds)
  const setHoveredPathIds = useGraphStore((state) => state.setHoveredPathIds)
  const clearHoveredPath = useGraphStore((state) => state.clearHoveredPath)
  const graphLoaded = useGraphData()
  const { zoomLevel, onViewportChange } = useZoomLevel()
  const layoutReady = useLayout(zoomLevel)
  const graphReady = graphLoaded && layoutReady
  const leaveTimeoutRef = useRef(null)
  const nodeById = buildNodeByIdMap(nodes)
  const expandedSystemIds = new Set(
    zoomLevel === ZOOM_LEVELS.OVERVIEW ? [] : hoveredPathIds,
  )
  const childCountByParentId = new Map()

  nodes.forEach((node) => {
    if (node.parentId) {
      childCountByParentId.set(node.parentId, (childCountByParentId.get(node.parentId) || 0) + 1)
    }
  })

  const cancelHoverClear = useCallback(() => {
    if (leaveTimeoutRef.current !== null) {
      window.clearTimeout(leaveTimeoutRef.current)
      leaveTimeoutRef.current = null
    }
  }, [])

  useEffect(() => () => cancelHoverClear(), [cancelHoverClear])

  useEffect(() => {
    if (zoomLevel === ZOOM_LEVELS.OVERVIEW && hoveredPathIds.length) {
      cancelHoverClear()
      clearHoveredPath()
    }
  }, [cancelHoverClear, clearHoveredPath, hoveredPathIds.length, zoomLevel])

  const scheduleHoverPath = useCallback(
    (nextPathIds) => {
      cancelHoverClear()
      leaveTimeoutRef.current = window.setTimeout(() => {
        if (nextPathIds.length) {
          setHoveredPathIds(nextPathIds)
        } else {
          clearHoveredPath()
        }

        leaveTimeoutRef.current = null
      }, 70)
    },
    [cancelHoverClear, clearHoveredPath, setHoveredPathIds],
  )

  const visibleNodes = nodes.filter((node) =>
    isNodeVisible(
      node,
      expandedSystemIds,
      zoomLevel === ZOOM_LEVELS.OVERVIEW,
      nodeById,
    ),
  )
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id))
  const activeSelectedNode =
    selectedNode && visibleNodeIds.has(selectedNode.id) ? selectedNode : null
  const selectedSystemId = getTopLevelSystemId(activeSelectedNode, nodeById)
  const visibleEdges = edges.filter(
    (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
  )
  const connectedSystemIds = new Set()

  if (selectedSystemId) {
    visibleEdges.forEach((edge) => {
      const sourceNode = nodeById.get(edge.source)
      const targetNode = nodeById.get(edge.target)
      const sourceSystemId = getTopLevelSystemId(sourceNode, nodeById)
      const targetSystemId = getTopLevelSystemId(targetNode, nodeById)

      if (sourceSystemId === selectedSystemId && targetSystemId) {
        connectedSystemIds.add(targetSystemId)
      }

      if (targetSystemId === selectedSystemId && sourceSystemId) {
        connectedSystemIds.add(sourceSystemId)
      }
    })
  }

  const styledNodes = visibleNodes.map((node) => {
    const isSelected = activeSelectedNode?.id === node.id
    const isInSelectedBranch =
      activeSelectedNode && isNodeInSelectedBranch(node, activeSelectedNode, nodeById)
    const topLevelSystemId = getTopLevelSystemId(node, nodeById)
    const isHighlighted =
      !!activeSelectedNode &&
      !isSelected &&
      !isInSelectedBranch &&
      !!topLevelSystemId &&
      connectedSystemIds.has(topLevelSystemId)

    return {
      ...node,
      data: {
        ...node.data,
        isSelected: !!isSelected,
        isDimmed:
          !!activeSelectedNode &&
          !isSelected &&
          !isInSelectedBranch &&
          !isHighlighted,
        isHighlighted,
        healthOverlay: node.type === 'system' ? healthOverlay : false,
        isExpanded: node.type === 'system' && expandedSystemIds.has(node.id),
        hasChildren: childCountByParentId.has(node.id),
      },
    }
  })

  const styledEdges = visibleEdges.map((edge) => {
    if (!selectedSystemId) {
      return {
        ...edge,
        data: {
          ...edge.data,
          isHighlighted: false,
          isDimmed: false,
        },
      }
    }

    const isHighlighted =
      getTopLevelSystemId(nodeById.get(edge.source), nodeById) === selectedSystemId ||
      getTopLevelSystemId(nodeById.get(edge.target), nodeById) === selectedSystemId

    return {
      ...edge,
      data: {
        ...edge.data,
        isHighlighted,
        isDimmed: !isHighlighted,
      },
    }
  })

  const onNodeClick = useCallback(
    (_event, node) => {
      if (selectedNode?.id === node.id) {
        setSelectedNode(null)
        return
      }

      setSelectedNode({
        id: node.id,
        type: node.type,
        parentId: node.parentId || null,
        ...node.data,
      })
    },
    [selectedNode, setSelectedNode],
  )

  const onNodeMouseEnter = useCallback(
    (_event, node) => {
      cancelHoverClear()

      if (zoomLevel === ZOOM_LEVELS.OVERVIEW) {
        return
      }

      if (node.type !== 'system' || !childCountByParentId.has(node.id)) {
        return
      }

      setHoveredPathIds(getSystemPath(node.id, nodeById))
    },
    [cancelHoverClear, childCountByParentId, nodeById, setHoveredPathIds, zoomLevel],
  )

  const onNodeMouseLeave = useCallback(
    (_event, node) => {
      if (zoomLevel === ZOOM_LEVELS.OVERVIEW) {
        return
      }

      scheduleHoverPath(getSystemPath(node, nodeById, false))
    },
    [nodeById, scheduleHoverPath, zoomLevel],
  )

  const onPaneMouseMove = useCallback(
    (event) => {
      cancelHoverClear()

      if (!hoveredPathIds.length) {
        return
      }

      const isOverNode =
        event.target instanceof Element && !!event.target.closest('.react-flow__node')

      if (!isOverNode) {
        clearHoveredPath()
      }
    },
    [cancelHoverClear, clearHoveredPath, hoveredPathIds.length],
  )

  const onPaneClick = useCallback(() => {
    cancelHoverClear()
    clearHoveredPath()
    setSelectedNode(null)
  }, [cancelHoverClear, clearHoveredPath, setSelectedNode])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {graphReady ? (
        <>
          <ReactFlow
            nodes={styledNodes}
            edges={styledEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={OVERVIEW_FIT_VIEW_OPTIONS}
            nodesDraggable={false}
            nodesConnectable={false}
            onViewportChange={onViewportChange}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onPaneMouseMove={onPaneMouseMove}
            onPaneClick={onPaneClick}
            proOptions={{ hideAttribution: true }}
            style={{ backgroundColor: 'var(--bg-canvas)' }}
          >
            <Background color="#1a1a1a" gap={40} size={1} />
          </ReactFlow>
          <ZoomControls />
        </>
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            letterSpacing: '0.01em',
          }}
        >
          Loading sample graph...
        </div>
      )}
    </div>
  )
}
