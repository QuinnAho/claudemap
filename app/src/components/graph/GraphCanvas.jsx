import { Background, ReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useRef } from 'react'
import '@xyflow/react/dist/style.css'
import ZoomControls from '../ui/ZoomControls'
import { MOTION } from '../../contracts/motion'
import { PRESENTATION_MODES } from '../../contracts/presentation'
import { COLOR } from '../../contracts/tokens'
import { FIT_VIEW } from '../../contracts/zoom'
import { useGraphStore } from '../../store/graphStore'
import {
  selectClearRuntimeEmphasis,
  selectEdges,
  selectFocusRequest,
  selectGuidedFlowRequest,
  selectHealthOverlay,
  selectHighlightedNodes,
  selectMapsManifest,
  selectMeta,
  selectNodes,
  selectPresentationMode,
  selectSelectedNode,
  selectSetSelectedNode,
} from '../../store/selectors'
import { useGraphFocusRuntime } from '../../hooks/useGraphFocusRuntime'
import { useGraphLoaded } from '../../hooks/useGraphLoaded'
import { useHoverPathScheduler } from '../../hooks/useHoverPathScheduler'
import { useLayout } from '../../hooks/useLayout'
import SystemNode from './SystemNode'
import CustomEdge from './CustomEdge'
import FileNode from './FileNode'
import FunctionNode from './FunctionNode'
import { useZoomLevel, ZOOM_LEVELS } from '../../hooks/useZoomLevel'
import { copyNodeToClipboard } from '../../hooks/useClipboard'
import {
  buildNodeByIdMap,
  getSystemPath,
  getTopLevelSystemId,
} from '../../lib/graphNodeUtils'
import {
  areStringArraysEqual,
  computeChildIndexes,
  computeConnectedSystemIds,
  computeExpandedSystemIds,
  computeRevealedFileIds,
  computeRewrittenVisibleEdges,
  computeStyledEdges,
  computeStyledNodes,
  computeVisibleNodes,
} from '../../lib/graphView'
import { setActiveMap } from '../../lib/mapApi'

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
  const mapsManifest = useGraphStore(selectMapsManifest)
  const healthOverlay = useGraphStore(selectHealthOverlay)
  const meta = useGraphStore(selectMeta)
  const selectedNode = useGraphStore(selectSelectedNode)
  const setSelectedNode = useGraphStore(selectSetSelectedNode)
  const highlightedNodes = useGraphStore(selectHighlightedNodes)
  const clearRuntimeEmphasis = useGraphStore(selectClearRuntimeEmphasis)
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

  const getAncestorLabels = useCallback(
    (nodeId) => {
      const labels = []
      let currentNode = nodeById.get(nodeId)

      while (currentNode?.parentId) {
        const parentNode = nodeById.get(currentNode.parentId)

        if (!parentNode) {
          break
        }

        labels.unshift(parentNode.data?.label || parentNode.id)
        currentNode = parentNode
      }

      return labels
    },
    [nodeById],
  )

  const switchScopedMap = useCallback(async (mapId) => {
    try {
      await setActiveMap(mapId)
    } catch (error) {
      console.error('Failed to switch ClaudeMap map:', error)
    }
  }, [])

  const findScopedMapEntry = useCallback(
    (node) => {
      const manifestMaps = mapsManifest?.maps || []
      const ancestorPath = getAncestorLabels(node.id)

      return (
        manifestMaps.find((mapEntry) => {
          if (mapEntry.id === 'root' || !mapEntry.scope || mapEntry.scope.stale === true) {
            return false
          }

          if (mapEntry.scope.rootSystemId === node.id) {
            return true
          }

          return (
            mapEntry.scope.rootSystemLabel === (node.data?.label || node.id) &&
            areStringArraysEqual(mapEntry.scope.ancestorPath || [], ancestorPath)
          )
        }) || null
      )
    },
    [getAncestorLabels, mapsManifest],
  )

  const buildCreateMapCommand = useCallback(
    (node) =>
      `/create-map ${JSON.stringify({
        scope: {
          type: 'subsystem',
          rootSystemId: node.id,
          rootSystemLabel: node.data?.label || node.id,
          ancestorPath: getAncestorLabels(node.id),
          filePathHint: node.data?.filePath || null,
        },
        label: node.data?.label || node.id,
        summary: node.data?.summary || null,
      })}`,
    [getAncestorLabels],
  )

  const buildMapAffordance = useCallback(
    (node) => {
      const qualifiesForScopedMap =
        node.type === 'system' &&
        node.data?.childType === 'system' &&
        (node.data?.childCount || 0) > 2

      if (!qualifiesForScopedMap) {
        return null
      }

      const scopedMapEntry = findScopedMapEntry(node)

      if (scopedMapEntry) {
        return {
          kind: 'open',
          onClick: () => switchScopedMap(scopedMapEntry.id),
        }
      }

      return {
        kind: 'create',
        command: buildCreateMapCommand(node),
      }
    },
    [buildCreateMapCommand, findScopedMapEntry, switchScopedMap],
  )

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
      if (sceneInteractionLocked) {
        return
      }

      if (zoomLevel === ZOOM_LEVELS.OVERVIEW) {
        return
      }

      if (node.type !== 'system' || !childCountByParentId.has(node.id)) {
        return
      }

      scheduleHoverPath(getSystemPath(node.id, nodeById), {
        delay: hoveredPathIds.length ? MOTION.hoverEnterSettle : MOTION.hoverEnter,
      })
    },
    [
      childCountByParentId,
      hoveredPathIds.length,
      nodeById,
      sceneInteractionLocked,
      scheduleHoverPath,
      zoomLevel,
    ],
  )

  const onPaneMouseMove = useCallback(
    (event) => {
      if (sceneInteractionLocked) {
        return
      }

      if (!hoveredPathIds.length && !pendingHoverPathRef.current.length) {
        return
      }

      const isOverNode =
        event.target instanceof Element && !!event.target.closest('.react-flow__node')

      if (!isOverNode) {
        scheduleHoverPath([], { delay: MOTION.hoverExit })
      }
    },
    [
      hoveredPathIds.length,
      pendingHoverPathRef,
      sceneInteractionLocked,
      scheduleHoverPath,
    ],
  )

  const onPaneClick = useCallback(() => {
    if (sceneInteractionLocked) {
      return
    }

    cancelHoverClear()
    pendingHoverPathRef.current = []
    clearHoveredPath()
    clearRuntimeEmphasis()
    setSelectedNode(null)
  }, [
    cancelHoverClear,
    clearHoveredPath,
    clearRuntimeEmphasis,
    pendingHoverPathRef,
    sceneInteractionLocked,
    setSelectedNode,
  ])

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
