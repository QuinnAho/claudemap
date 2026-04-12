import { Background, ReactFlow, useReactFlow } from '@xyflow/react'
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
import { copyNodeToClipboard } from '../../hooks/useClipboard'
import {
  FILE_NODE_HEIGHT,
  FILE_NODE_WIDTH,
  FUNCTION_NODE_HEIGHT,
  FUNCTION_NODE_WIDTH,
} from './systemNodeSizing'
import {
  buildNodeByIdMap,
  getNodeAbsolutePosition,
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
  const { setCenter } = useReactFlow()
  const nodes = useGraphStore((state) => state.nodes)
  const edges = useGraphStore((state) => state.edges)
  const healthOverlay = useGraphStore((state) => state.healthOverlay)
  const meta = useGraphStore((state) => state.meta)
  const selectedNode = useGraphStore((state) => state.selectedNode)
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode)
  const highlightedNodes = useGraphStore((state) => state.highlightedNodes)
  const hoveredPathIds = useGraphStore((state) => state.hoveredPathIds)
  const setHoveredPathIds = useGraphStore((state) => state.setHoveredPathIds)
  const clearHoveredPath = useGraphStore((state) => state.clearHoveredPath)
  const clearRuntimeEmphasis = useGraphStore((state) => state.clearRuntimeEmphasis)
  const focusRequest = useGraphStore((state) => state.focusRequest)
  const guidedFlowRequest = useGraphStore((state) => state.guidedFlowRequest)
  const presentationMode = useGraphStore((state) => state.presentationMode)
  const graphLoaded = useGraphData()
  const { zoomLevel, onViewportChange } = useZoomLevel()
  const layoutReady = useLayout(zoomLevel)
  const graphReady = graphLoaded && layoutReady
  const hasMountedGraphRef = useRef(false)
  const sceneInteractionLocked = presentationMode !== 'free'
  const highlightMode = presentationMode === 'free' ? 'subtle' : 'presentation'
  const leaveTimeoutRef = useRef(null)
  const lastFocusKeyRef = useRef('')
  const lastGuidedFlowKeyRef = useRef('')
  const hasAppliedRuntimeViewportRef = useRef(false)
  const nodeById = buildNodeByIdMap(nodes)
  const focusTargetNode = focusRequest?.nodeId ? nodeById.get(focusRequest.nodeId) : null
  const presentationTargetNode =
    focusTargetNode || (selectedNode?.id ? nodeById.get(selectedNode.id) : null)
  const childCountByParentId = new Map()
  const functionIndexById = new Map()
  const nextFunctionIndexByParentId = new Map()
  const explicitHighlightedNodeIds = new Set(highlightedNodes)
  const hasExplicitHighlights = explicitHighlightedNodeIds.size > 0
  const focusPathIds = new Set(
    presentationTargetNode ? getSystemPath(presentationTargetNode.id, nodeById) : [],
  )
  const runtimeExpandedSystemIds = new Set(
    zoomLevel === ZOOM_LEVELS.OVERVIEW
      ? []
      : presentationMode === 'free'
        ? [
            ...highlightedNodes.flatMap((nodeId) => getSystemPath(nodeId, nodeById)),
            ...(focusRequest?.nodeId ? getSystemPath(focusRequest.nodeId, nodeById) : []),
            ...(selectedNode?.id ? getSystemPath(selectedNode.id, nodeById) : []),
          ]
        : [
            ...focusPathIds,
            ...highlightedNodes.flatMap((nodeId) => getSystemPath(nodeId, nodeById)),
            ...(selectedNode?.id ? getSystemPath(selectedNode.id, nodeById) : []),
          ],
  )
  const expandedSystemIds = new Set(
    zoomLevel === ZOOM_LEVELS.OVERVIEW
      ? []
      : presentationMode === 'free'
        ? [...hoveredPathIds, ...runtimeExpandedSystemIds]
        : [...runtimeExpandedSystemIds],
  )
  const highlightedSystemIds = new Set(
    highlightedNodes
      .map((nodeId) => getTopLevelSystemId(nodeById.get(nodeId), nodeById))
      .filter(Boolean),
  )
  const presentationLeadNodeId =
    presentationMode !== 'free'
      ? presentationTargetNode?.id || null
      : focusRequest?.nodeId || null
  const presentationLeadSystemId = getTopLevelSystemId(presentationTargetNode, nodeById)
  const presentationSystemIds = new Set(
    [presentationLeadSystemId, ...highlightedSystemIds].filter(Boolean),
  )
  const revealedFileIds = new Set(
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

  if (graphReady) {
    hasMountedGraphRef.current = true
  }

  const showGraph = graphReady || hasMountedGraphRef.current

  nodes.forEach((node) => {
    if (node.parentId) {
      childCountByParentId.set(node.parentId, (childCountByParentId.get(node.parentId) || 0) + 1)
    }

    if (node.type === 'function' && node.parentId) {
      const functionIndex = nextFunctionIndexByParentId.get(node.parentId) || 0
      functionIndexById.set(node.id, functionIndex)
      nextFunctionIndexByParentId.set(node.parentId, functionIndex + 1)
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

  const buildSelectedNodePayload = useCallback(
    (node) => ({
      id: node.id,
      type: node.type,
      parentId: node.parentId || null,
      ...node.data,
    }),
    [],
  )

  const focusNodeById = useCallback(
    (nodeId, zoom = 1, options = {}) => {
      const targetNode = nodeById.get(nodeId)

      if (!targetNode) {
        return
      }

      const pathIds = presentationMode === 'free' ? getSystemPath(targetNode.id, nodeById) : []
      const viewportTargetNode =
        presentationMode !== 'free'
          ? nodeById.get(getTopLevelSystemId(targetNode, nodeById)) || targetNode
          : zoom <= OVERVIEW_FIT_VIEW_OPTIONS.maxZoom && targetNode.type !== 'system'
            ? nodeById.get(getTopLevelSystemId(targetNode, nodeById)) || targetNode
            : targetNode

      if (pathIds.length) {
        setHoveredPathIds(pathIds)
      }

      setSelectedNode(buildSelectedNodePayload(targetNode))
      const shouldAnimate = options.animate !== false

      window.setTimeout(() => {
        const absolutePosition = getNodeAbsolutePosition(viewportTargetNode, nodeById)

        if (!absolutePosition) {
          return
        }

        const nodeWidth =
          viewportTargetNode.width ||
          (viewportTargetNode.type === 'function'
            ? FUNCTION_NODE_WIDTH
            : viewportTargetNode.type === 'file'
              ? FILE_NODE_WIDTH
              : 0)
        const nodeHeight =
          viewportTargetNode.height ||
          (viewportTargetNode.type === 'function'
            ? FUNCTION_NODE_HEIGHT
            : viewportTargetNode.type === 'file'
              ? FILE_NODE_HEIGHT
              : 0)
        const centerX = absolutePosition.x + nodeWidth / 2
        const centerY =
          absolutePosition.y +
          nodeHeight / 2 -
          (presentationMode !== 'free' ? 48 : 0)
        setCenter(centerX, centerY, {
          zoom: Math.max(0.55, Math.min(zoom, 1.4)),
          duration: shouldAnimate ? 450 : 0,
        })
      }, shouldAnimate ? 140 : 0)
    },
    [
      buildSelectedNodePayload,
      nodeById,
      presentationMode,
      setCenter,
      setHoveredPathIds,
      setSelectedNode,
    ],
  )

  useEffect(() => {
    if (!graphReady || !focusRequest?.nodeId) {
      return
    }

    const focusKey = `${focusRequest.nodeId}:${focusRequest.zoom || 1}:${focusRequest.requestedAt || ''}`
    const shouldAnimate = hasAppliedRuntimeViewportRef.current

    if (focusKey === lastFocusKeyRef.current) {
      return
    }

    lastFocusKeyRef.current = focusKey
    focusNodeById(focusRequest.nodeId, focusRequest.zoom || 1, {
      animate: shouldAnimate,
    })
    hasAppliedRuntimeViewportRef.current = true
  }, [focusNodeById, focusRequest, graphReady])

  useEffect(() => {
    if (!graphReady || !Array.isArray(guidedFlowRequest?.steps) || guidedFlowRequest.steps.length === 0) {
      return
    }

    const flowKey = `${guidedFlowRequest.requestedAt || ''}:${guidedFlowRequest.steps.join('|')}`

    if (flowKey === lastGuidedFlowKeyRef.current) {
      return
    }

    lastGuidedFlowKeyRef.current = flowKey
    let stepIndex = 0
    const delay = Math.max(400, guidedFlowRequest.delay || 1500)
    const shouldAnimateFirstStep = hasAppliedRuntimeViewportRef.current

    focusNodeById(guidedFlowRequest.steps[stepIndex], 1, {
      animate: shouldAnimateFirstStep,
    })
    hasAppliedRuntimeViewportRef.current = true
    const intervalId = window.setInterval(() => {
      stepIndex += 1

      if (stepIndex >= guidedFlowRequest.steps.length) {
        window.clearInterval(intervalId)
        return
      }

      focusNodeById(guidedFlowRequest.steps[stepIndex], 1)
    }, delay)

    return () => window.clearInterval(intervalId)
  }, [focusNodeById, graphReady, guidedFlowRequest])

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
      revealedFileIds,
    ),
  )
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id))
  const activeSelectedNode =
    selectedNode && visibleNodeIds.has(selectedNode.id) ? selectedNode : null
  const shouldFitView =
    presentationMode === 'free' &&
    !focusRequest?.nodeId &&
    !(Array.isArray(guidedFlowRequest?.steps) && guidedFlowRequest.steps.length)
  const selectedSystemId = getTopLevelSystemId(activeSelectedNode, nodeById)
  const visibleEdges = edges.filter(
    (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
  )
  const connectedSystemIds = new Set()

  if (selectedSystemId) {
    visibleEdges.forEach((edge) => {
      if (presentationMode !== 'free') {
        return
      }

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
    const isRuntimeHighlighted =
      explicitHighlightedNodeIds.has(node.id) || highlightedSystemIds.has(topLevelSystemId)
    const isBranchHighlighted =
      presentationMode === 'free' &&
      !!activeSelectedNode &&
      !isSelected &&
      !isInSelectedBranch &&
      !!topLevelSystemId &&
      connectedSystemIds.has(topLevelSystemId)
    const isHighlighted = isRuntimeHighlighted || isBranchHighlighted
    const isPresentationLead = presentationMode !== 'free' && presentationLeadNodeId === node.id
    const isPresentationContext =
      presentationMode !== 'free' &&
      !!activeSelectedNode &&
      !isPresentationLead &&
      isNodeInSelectedBranch(node, activeSelectedNode, nodeById)
    const isPresentationAncestor =
      presentationMode !== 'free' &&
      !isPresentationLead &&
      focusPathIds.has(node.id)
    const isGhosted =
      presentationMode !== 'free' &&
      !isSelected &&
      !isPresentationContext &&
      !isHighlighted

    return {
      ...node,
      data: {
        ...node.data,
        isSelected: !!isSelected,
        isDimmed: !!activeSelectedNode
          ? !isSelected && !isInSelectedBranch && !isHighlighted
          : hasExplicitHighlights && !isHighlighted,
        isHighlighted,
        isGhosted,
        highlightMode,
        healthOverlay: node.type === 'system' ? healthOverlay : false,
        isExpanded: node.type === 'system' && expandedSystemIds.has(node.id),
        hasChildren: childCountByParentId.has(node.id),
        visibleFunctionCount:
          node.type === 'file' && revealedFileIds.has(node.id)
            ? childCountByParentId.get(node.id) || 0
            : 0,
        revealIndex:
          node.type === 'function' ? functionIndexById.get(node.id) || 0 : null,
        isPresentationLead,
        isPresentationContext,
        isPresentationAncestor,
        hideDescription: presentationMode !== 'free',
      },
    }
  })

  const styledEdges = visibleEdges.map((edge) => {
    if (!selectedSystemId && !hasExplicitHighlights) {
      return {
        ...edge,
        data: {
          ...edge.data,
          isHighlighted: false,
          isDimmed: false,
          highlightMode,
          isPresentationTrace: false,
        },
      }
    }

    const sourceSystemId = getTopLevelSystemId(nodeById.get(edge.source), nodeById)
    const targetSystemId = getTopLevelSystemId(nodeById.get(edge.target), nodeById)
    const isHighlighted =
      presentationMode !== 'free'
        ? presentationSystemIds.has(sourceSystemId) || presentationSystemIds.has(targetSystemId)
        : (selectedSystemId &&
            (sourceSystemId === selectedSystemId || targetSystemId === selectedSystemId)) ||
          explicitHighlightedNodeIds.has(edge.source) ||
          explicitHighlightedNodeIds.has(edge.target) ||
          highlightedSystemIds.has(sourceSystemId) ||
          highlightedSystemIds.has(targetSystemId)

    return {
      ...edge,
      data: {
        ...edge.data,
        isHighlighted,
        isDimmed: presentationMode !== 'free' ? !isHighlighted : !isHighlighted,
        highlightMode,
        isPresentationTrace: false,
      },
    }
  })

  const onNodeClick = useCallback(
    (_event, node) => {
      if (sceneInteractionLocked) {
        return
      }

      const nextSelectedNode = buildSelectedNodePayload(node)
      void copyNodeToClipboard(nextSelectedNode, meta)

      if (selectedNode?.id === node.id) {
        setSelectedNode(null)
        return
      }

      setSelectedNode(nextSelectedNode)
    },
    [buildSelectedNodePayload, meta, sceneInteractionLocked, selectedNode, setSelectedNode],
  )

  const onNodeMouseEnter = useCallback(
    (_event, node) => {
      cancelHoverClear()

      if (sceneInteractionLocked) {
        return
      }

      if (zoomLevel === ZOOM_LEVELS.OVERVIEW) {
        return
      }

      if (node.type !== 'system' || !childCountByParentId.has(node.id)) {
        return
      }

      setHoveredPathIds(getSystemPath(node.id, nodeById))
    },
    [cancelHoverClear, childCountByParentId, nodeById, sceneInteractionLocked, setHoveredPathIds, zoomLevel],
  )

  const onNodeMouseLeave = useCallback(
    (_event, node) => {
      if (sceneInteractionLocked) {
        return
      }

      if (zoomLevel === ZOOM_LEVELS.OVERVIEW) {
        return
      }

      scheduleHoverPath(getSystemPath(node, nodeById, false))
    },
    [nodeById, sceneInteractionLocked, scheduleHoverPath, zoomLevel],
  )

  const onPaneMouseMove = useCallback(
    (event) => {
      cancelHoverClear()

      if (sceneInteractionLocked) {
        return
      }

      if (!hoveredPathIds.length) {
        return
      }

      const isOverNode =
        event.target instanceof Element && !!event.target.closest('.react-flow__node')

      if (!isOverNode) {
        clearHoveredPath()
      }
    },
    [cancelHoverClear, clearHoveredPath, hoveredPathIds.length, sceneInteractionLocked],
  )

  const onPaneClick = useCallback(() => {
    if (sceneInteractionLocked) {
      return
    }

    cancelHoverClear()
    clearHoveredPath()
    clearRuntimeEmphasis()
    setSelectedNode(null)
  }, [cancelHoverClear, clearHoveredPath, clearRuntimeEmphasis, sceneInteractionLocked, setSelectedNode])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {showGraph ? (
        <>
          <ReactFlow
            nodes={styledNodes}
            edges={styledEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView={shouldFitView}
            fitViewOptions={OVERVIEW_FIT_VIEW_OPTIONS}
            nodesDraggable={false}
            nodesConnectable={false}
            panOnScroll={false}
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            zoomOnDoubleClick={presentationMode === 'free'}
            elementsSelectable={!sceneInteractionLocked}
            selectionOnDrag={!sceneInteractionLocked}
            onViewportChange={onViewportChange}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onPaneMouseMove={onPaneMouseMove}
            onPaneClick={onPaneClick}
            proOptions={{ hideAttribution: true }}
            style={{ backgroundColor: 'var(--bg-canvas)' }}
          >
            {presentationMode === 'free' ? <Background color="#1a1a1a" gap={40} size={1} /> : null}
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
          Loading graph...
        </div>
      )}
    </div>
  )
}
