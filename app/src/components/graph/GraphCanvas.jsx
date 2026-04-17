import { Background, ReactFlow } from '@xyflow/react'
import { useEffect, useRef } from 'react'
import '@xyflow/react/dist/style.css'
import ZoomControls from '../ui/ZoomControls'
import { PRESENTATION_MODES } from '../../contracts/presentation'
import { COLOR } from '../../contracts/tokens'
import { FIT_VIEW } from '../../contracts/zoom'
import { useGraphFocusRuntime } from '../../hooks/useGraphFocusRuntime'
import { useGraphLoaded } from '../../hooks/useGraphLoaded'
import { useGraphPointerHandlers } from '../../hooks/useGraphPointerHandlers'
import { useGraphViewModel } from '../../hooks/useGraphViewModel'
import { useHoverPathScheduler } from '../../hooks/useHoverPathScheduler'
import { useLayout } from '../../hooks/useLayout'
import SystemNode from './SystemNode'
import CustomEdge from './CustomEdge'
import FileNode from './FileNode'
import FunctionNode from './FunctionNode'
import { useZoomLevel, ZOOM_LEVELS } from '../../hooks/useZoomLevel'

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
  const graphLoaded = useGraphLoaded()
  const { zoomLevel, onViewportChange } = useZoomLevel()
  const layoutReady = useLayout(zoomLevel)
  const graphReady = graphLoaded && layoutReady
  const hasMountedGraphRef = useRef(false)
  const {
    hoveredPathIds,
    pendingHoverPathRef,
    scheduleHoverPath,
    cancelHoverClear,
    clearHoveredPath,
  } = useHoverPathScheduler()
  const {
    childCountByParentId,
    nodeById,
    presentationMode,
    sceneInteractionLocked,
    shouldFitView,
    styledEdges,
    styledNodes,
  } = useGraphViewModel({ zoomLevel, hoveredPathIds })
  const { buildSelectedNodePayload } = useGraphFocusRuntime({ graphReady, nodeById })

  if (graphReady) {
    hasMountedGraphRef.current = true
  }

  const showGraph = graphReady || hasMountedGraphRef.current
  const isGraphTransitioning = !graphLoaded && hasMountedGraphRef.current

  useEffect(() => {
    if (zoomLevel === ZOOM_LEVELS.OVERVIEW && hoveredPathIds.length) {
      cancelHoverClear()
      clearHoveredPath()
    }
  }, [cancelHoverClear, clearHoveredPath, hoveredPathIds.length, zoomLevel])

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
