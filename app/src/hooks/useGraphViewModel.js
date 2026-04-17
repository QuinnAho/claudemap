import { useGraphStore } from '../store/graphStore'
import {
  selectEdges,
  selectFocusRequest,
  selectGuidedFlowRequest,
  selectHealthOverlay,
  selectHighlightedNodes,
  selectNodes,
  selectPresentationMode,
  selectSelectedNode,
} from '../store/selectors'
import { PRESENTATION_MODES } from '../contracts/presentation'
import {
  buildNodeByIdMap,
  getSystemPath,
  getTopLevelSystemId,
} from '../lib/graphNodeUtils'
import {
  computeChildIndexes,
  computeConnectedSystemIds,
  computeExpandedSystemIds,
  computeRevealedFileIds,
  computeRewrittenVisibleEdges,
  computeStyledEdges,
  computeStyledNodes,
  computeVisibleNodes,
} from '../lib/graphView'
import { useScopedMapAffordance } from './useScopedMapAffordance'

// useGraphViewModel collects every per-render derivation that GraphCanvas
// needs to feed <ReactFlow>. Given the current zoomLevel and the hover-path
// vector from useHoverPathScheduler, it reads raw store state and produces
// the styled node/edge lists plus a handful of scalars the shell still
// consumes directly (shouldFitView, sceneInteractionLocked, highlightMode,
// presentationMode). No React state lives here - each call is a pure fold
// over store state.

export function useGraphViewModel({ zoomLevel, hoveredPathIds }) {
  const nodes = useGraphStore(selectNodes)
  const edges = useGraphStore(selectEdges)
  const healthOverlay = useGraphStore(selectHealthOverlay)
  const selectedNode = useGraphStore(selectSelectedNode)
  const highlightedNodes = useGraphStore(selectHighlightedNodes)
  const focusRequest = useGraphStore(selectFocusRequest)
  const guidedFlowRequest = useGraphStore(selectGuidedFlowRequest)
  const presentationMode = useGraphStore(selectPresentationMode)

  const sceneInteractionLocked = presentationMode !== PRESENTATION_MODES.FREE
  const highlightMode = presentationMode === PRESENTATION_MODES.FREE ? 'subtle' : 'presentation'

  const nodeById = buildNodeByIdMap(nodes)
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

  const { childCountByParentId, functionIndexById } = computeChildIndexes(nodes)

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

  return {
    childCountByParentId,
    highlightMode,
    nodeById,
    presentationMode,
    sceneInteractionLocked,
    shouldFitView,
    styledEdges,
    styledNodes,
  }
}
