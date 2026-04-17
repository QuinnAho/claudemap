import { Background, ReactFlow } from '@xyflow/react'
import { useEffect, useRef } from 'react'
import '@xyflow/react/dist/style.css'
import ZoomControls from '../ui/ZoomControls'
import { PRESENTATION_MODES } from '../../contracts/presentation'
import { COLOR } from '../../contracts/tokens'
import { FIT_VIEW } from '../../contracts/zoom'
import { useGraphStore } from '../../store/graphStore'
import {
  selectEdges,
  selectFocusRequest,
  selectGuidedFlowRequest,
  selectHealthOverlay,
  selectHighlightedNodes,
  selectNodes,
  selectPresentationMode,
  selectSelectedNode,
} from '../../store/selectors'
import { useGraphFocusRuntime } from '../../hooks/useGraphFocusRuntime'
import { useGraphLoaded } from '../../hooks/useGraphLoaded'
import { useGraphPointerHandlers } from '../../hooks/useGraphPointerHandlers'
import { useHoverPathScheduler } from '../../hooks/useHoverPathScheduler'
import { useLayout } from '../../hooks/useLayout'
import { useScopedMapAffordance } from '../../hooks/useScopedMapAffordance'
import SystemNode from './SystemNode'
import CustomEdge from './CustomEdge'
import FileNode from './FileNode'
import FunctionNode from './FunctionNode'
import { useZoomLevel, ZOOM_LEVELS } from '../../hooks/useZoomLevel'
import {
  buildNodeByIdMap,
  getSystemPath,
  getTopLevelSystemId,
} from '../../lib/graphNodeUtils'
import {
  computeChildIndexes,
  computeConnectedSystemIds,
  computeExpandedSystemIds,
  computeRevealedFileIds,
  computeRewrittenVisibleEdges,
  computeStyledEdges,
  computeStyledNodes,
  computeVisibleNodes,
} from '../../lib/graphView'

const nodeTypes = {
  system: SystemNode,
  file: FileNode,
  function: FunctionNode,
}

const edgeTypes = {
  custom: CustomEdge,
}

const OVERVIEW_FIT_VIEW_OPTIONS = {
  padding: FIT_VIEW.padding,
  maxZoom: FIT_VIEW.maxZoom,
}

export default function GraphCanvas() {
  const nodes = useGraphStore(selectNodes)
  const edges = useGraphStore(selectEdges)
  const healthOverlay = useGraphStore(selectHealthOverlay)
  const selectedNode = useGraphStore(selectSelectedNode)
  const highlightedNodes = useGraphStore(selectHighlightedNodes)
  const focusRequest = useGraphStore(selectFocusRequest)
  const guidedFlowRequest = useGraphStore(selectGuidedFlowRequest)
  const presentationMode = useGraphStore(selectPresentationMode)
  const graphLoaded = useGraphLoaded()
  const { zoomLevel, onViewportChange } = useZoomLevel()
  const layoutReady = useLayout(zoomLevel)
  const graphReady = graphLoaded && layoutReady
  const hasMountedGraphRef = useRef(false)
  const sceneInteractionLocked = presentationMode !== PRESENTATION_MODES.FREE
  const highlightMode = presentationMode === PRESENTATION_MODES.FREE ? 'subtle' : 'presentation'
  const {
    hoveredPathIds,
    pendingHoverPathRef,
    scheduleHoverPath,
    cancelHoverClear,
    clearHoveredPath,
  } = useHoverPathScheduler()
  const nodeById = buildNodeByIdMap(nodes)
  const { buildSelectedNodePayload } = useGraphFocusRuntime({ graphReady, nodeById })
  const focusTargetNode = focusRequest?.nodeId ? nodeById.get(focusRequest.nodeId) : null
  const presentationTargetNode =
    focusTargetNode || (selectedNode?.id ? nodeById.get(selectedNode.id) : null)
  const explicitHighlightedNodeIds = new Set(highlightedNodes)
  const hasExplicitHighlights = explicitHighlightedNodeIds.size > 0
  const focusPathIds = new Set(
    presentationTargetNode ? getSystemPath(presentationTargetNode.id, nodeById) : [],
  )
  const { expandedSystemIds } = computeExpandedSystemIds({
    nodeById,
    zoomLevel,
    presentationMode,
    highlightedNodes,
    focusRequest,
    selectedNode,
    hoveredPathIds,
    focusPathIds,
  })
  const highlightedSystemIds = new Set(
    highlightedNodes
      .map((nodeId) => getTopLevelSystemId(nodeById.get(nodeId), nodeById))
      .filter(Boolean),
  )
  const presentationLeadNodeId =
    presentationMode !== PRESENTATION_MODES.FREE
      ? presentationTargetNode?.id || null
      : focusRequest?.nodeId || null
  const presentationLeadSystemId = getTopLevelSystemId(presentationTargetNode, nodeById)
  const presentationSystemIds = new Set(
    [presentationLeadSystemId, ...highlightedSystemIds].filter(Boolean),
  )
  const revealedFileIds = computeRevealedFileIds(
    nodeById,
    selectedNode,
    focusRequest,
    highlightedNodes,
  )

  if (graphReady) {
    hasMountedGraphRef.current = true
  }

  const showGraph = graphReady || hasMountedGraphRef.current
  const isGraphTransitioning = !graphLoaded && hasMountedGraphRef.current

  const { childCountByParentId, functionIndexById } = computeChildIndexes(nodes)

  useEffect(() => {
    if (zoomLevel === ZOOM_LEVELS.OVERVIEW && hoveredPathIds.length) {
      cancelHoverClear()
      clearHoveredPath()
    }
  }, [cancelHoverClear, clearHoveredPath, hoveredPathIds.length, zoomLevel])

  const visibleNodes = computeVisibleNodes({
    nodes,
    expandedSystemIds,
    zoomLevel,
    nodeById,
    revealedFileIds,
  })
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id))
  const activeSelectedNode =
    selectedNode && visibleNodeIds.has(selectedNode.id) ? selectedNode : null
  const shouldFitView =
    presentationMode === PRESENTATION_MODES.FREE &&
    !focusRequest?.nodeId &&
    !(Array.isArray(guidedFlowRequest?.steps) && guidedFlowRequest.steps.length)
  const selectedSystemId = getTopLevelSystemId(activeSelectedNode, nodeById)
  const visibleEdges = computeRewrittenVisibleEdges(edges, nodeById, visibleNodeIds)
  const connectedSystemIds = computeConnectedSystemIds({
    visibleEdges,
    nodeById,
    presentationMode,
    selectedSystemId,
  })

  const buildMapAffordance = useScopedMapAffordance(nodeById)

  const styledNodes = computeStyledNodes({
    visibleNodes,
    nodeById,
    activeSelectedNode,
    presentationMode,
    presentationLeadNodeId,
    focusPathIds,
    explicitHighlightedNodeIds,
    highlightedSystemIds,
    connectedSystemIds,
    hasExplicitHighlights,
    highlightMode,
    healthOverlay,
    expandedSystemIds,
    childCountByParentId,
    revealedFileIds,
    functionIndexById,
    buildMapAffordance,
  })

  const styledEdges = computeStyledEdges({
    visibleEdges,
    nodeById,
    presentationMode,
    selectedSystemId,
    hasExplicitHighlights,
    highlightMode,
    presentationSystemIds,
    explicitHighlightedNodeIds,
    highlightedSystemIds,
  })

  const { onNodeClick, onNodeMouseEnter, onPaneMouseMove, onPaneClick } = useGraphPointerHandlers({
    buildSelectedNodePayload,
    cancelHoverClear,
    childCountByParentId,
    clearHoveredPath,
    hoveredPathIds,
    nodeById,
    pendingHoverPathRef,
    sceneInteractionLocked,
    scheduleHoverPath,
    zoomLevel,
  })

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
            zoomOnDoubleClick={presentationMode === PRESENTATION_MODES.FREE}
            elementsSelectable={!sceneInteractionLocked}
            selectionOnDrag={!sceneInteractionLocked}
            onViewportChange={onViewportChange}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onPaneMouseMove={onPaneMouseMove}
            onPaneClick={onPaneClick}
            proOptions={{ hideAttribution: true }}
            style={{
              backgroundColor: 'var(--bg-canvas)',
              opacity: isGraphTransitioning ? 0.22 : 1,
              transition: 'opacity 0.18s ease',
            }}
          >
            {presentationMode === PRESENTATION_MODES.FREE ? <Background color={COLOR.bg.card} gap={40} size={1} /> : null}
          </ReactFlow>
          <ZoomControls />
          {isGraphTransitioning ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                letterSpacing: '0.01em',
                zIndex: 18,
                pointerEvents: 'auto',
              }}
            >
              Loading...
            </div>
          ) : null}
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
          Loading...
        </div>
      )}
    </div>
  )
}
