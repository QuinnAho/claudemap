import { PRESENTATION_MODES } from '../contracts/presentation'
import { ZOOM_LEVELS } from '../hooks/useZoomLevel'
import {
  getNodeAbsolutePosition,
  getSystemPath,
  getTopLevelSystemId,
  isNodeInSelectedBranch,
  isNodeVisible,
} from './graphNodeUtils'
import { chooseEdgeHandles } from './edgeHandles'

// Pure projection helpers that turn raw store state (nodes, highlightedNodes,
// hoveredPathIds, selectedNode, focusRequest, presentationMode, zoomLevel)
// into the derived shape ReactFlow needs (visible nodes, rewritten edges,
// styled nodes/edges). No React imports, no store access; everything is
// passed in. GraphCanvas calls these and forwards the result to <ReactFlow>.

export function areStringArraysEqual(left = [], right = []) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

export function computeChildIndexes(nodes) {
  const childCountByParentId = new Map()
  const functionIndexById = new Map()
  const nextFunctionIndexByParentId = new Map()

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

  return { childCountByParentId, functionIndexById }
}

export function computeRevealedFileIds(nodeById, selectedNode, focusRequest, highlightedNodes) {
  return new Set(
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
}

export function computeExpandedSystemIds({
  nodeById,
  zoomLevel,
  presentationMode,
  highlightedNodes,
  focusRequest,
  selectedNode,
  hoveredPathIds,
  focusPathIds,
}) {
  const runtimeExpandedSystemIds = new Set(
    zoomLevel === ZOOM_LEVELS.OVERVIEW
      ? []
      : presentationMode === PRESENTATION_MODES.FREE
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
      : presentationMode === PRESENTATION_MODES.FREE
        ? [...hoveredPathIds, ...runtimeExpandedSystemIds]
        : [...runtimeExpandedSystemIds],
  )

  return { runtimeExpandedSystemIds, expandedSystemIds }
}

export function computeVisibleNodes({
  nodes,
  expandedSystemIds,
  zoomLevel,
  nodeById,
  revealedFileIds,
}) {
  return nodes.filter((node) =>
    isNodeVisible(
      node,
      expandedSystemIds,
      zoomLevel === ZOOM_LEVELS.OVERVIEW,
      nodeById,
      revealedFileIds,
    ),
  )
}

// Edges only connect top-level systems. Any edge whose endpoint sits on a
// nested subsystem (or a descendant of one) is rewritten to that endpoint's
// top-level system ancestor. Edges that collapse to a self-loop after
// rewriting are dropped — intra-subsystem relationships belong in sub-maps,
// not the overview.
export function computeRewrittenVisibleEdges(edges, nodeById, visibleNodeIds) {
  const rewrittenEdgesByKey = new Map()

  edges.forEach((edge) => {
    const sourceRoot = getTopLevelSystemId(nodeById.get(edge.source), nodeById)
    const targetRoot = getTopLevelSystemId(nodeById.get(edge.target), nodeById)

    if (!sourceRoot || !targetRoot || sourceRoot === targetRoot) {
      return
    }

    if (!visibleNodeIds.has(sourceRoot) || !visibleNodeIds.has(targetRoot)) {
      return
    }

    const key = `${sourceRoot}->${targetRoot}`
    if (rewrittenEdgesByKey.has(key)) {
      return
    }

    rewrittenEdgesByKey.set(key, {
      ...edge,
      source: sourceRoot,
      target: targetRoot,
    })
  })

  return Array.from(rewrittenEdgesByKey.values())
}

export function computeConnectedSystemIds({
  visibleEdges,
  nodeById,
  presentationMode,
  selectedSystemId,
}) {
  const connectedSystemIds = new Set()

  if (!selectedSystemId) {
    return connectedSystemIds
  }

  visibleEdges.forEach((edge) => {
    if (presentationMode !== PRESENTATION_MODES.FREE) {
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

  return connectedSystemIds
}

function getRoutableNode(nodeId, nodeById) {
  const node = nodeById.get(nodeId)
  const position = getNodeAbsolutePosition(node, nodeById)

  if (!node || !position) {
    return node
  }

  return {
    ...node,
    position,
  }
}

export function computeStyledNodes({
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
}) {
  return visibleNodes.map((node) => {
    const isSelected = activeSelectedNode?.id === node.id
    const isInSelectedBranch =
      activeSelectedNode && isNodeInSelectedBranch(node, activeSelectedNode, nodeById)
    const topLevelSystemId = getTopLevelSystemId(node, nodeById)
    const isRuntimeHighlighted =
      explicitHighlightedNodeIds.has(node.id) || highlightedSystemIds.has(topLevelSystemId)
    const isBranchHighlighted =
      presentationMode === PRESENTATION_MODES.FREE &&
      !!activeSelectedNode &&
      !isSelected &&
      !isInSelectedBranch &&
      !!topLevelSystemId &&
      connectedSystemIds.has(topLevelSystemId)
    const isHighlighted = isRuntimeHighlighted || isBranchHighlighted
    const isPresentationLead =
      presentationMode !== PRESENTATION_MODES.FREE && presentationLeadNodeId === node.id
    const isPresentationContext =
      presentationMode !== PRESENTATION_MODES.FREE &&
      !!activeSelectedNode &&
      !isPresentationLead &&
      isNodeInSelectedBranch(node, activeSelectedNode, nodeById)
    const isPresentationAncestor =
      presentationMode !== PRESENTATION_MODES.FREE &&
      !isPresentationLead &&
      focusPathIds.has(node.id)
    const isGhosted =
      presentationMode !== PRESENTATION_MODES.FREE &&
      !isSelected &&
      !isPresentationContext &&
      !isHighlighted
    const mapAffordance = buildMapAffordance(node)

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
        hideDescription: presentationMode !== PRESENTATION_MODES.FREE,
        mapAffordance,
      },
    }
  })
}

export function computeStyledEdges({
  visibleEdges,
  nodeById,
  presentationMode,
  selectedSystemId,
  hasExplicitHighlights,
  highlightMode,
  presentationSystemIds,
  explicitHighlightedNodeIds,
  highlightedSystemIds,
}) {
  return visibleEdges.map((edge) => {
    const edgeHandles = chooseEdgeHandles(
      getRoutableNode(edge.source, nodeById),
      getRoutableNode(edge.target, nodeById),
    )

    if (!selectedSystemId && !hasExplicitHighlights) {
      return {
        ...edge,
        ...edgeHandles,
        data: {
          ...edge.data,
          isHighlighted: false,
          isDimmed: false,
          highlightMode,
          isSelectionTrace: false,
          isPresentationTrace: false,
        },
      }
    }

    const sourceSystemId = getTopLevelSystemId(nodeById.get(edge.source), nodeById)
    const targetSystemId = getTopLevelSystemId(nodeById.get(edge.target), nodeById)
    const isSelectionTrace =
      presentationMode === PRESENTATION_MODES.FREE &&
      !!selectedSystemId &&
      (sourceSystemId === selectedSystemId || targetSystemId === selectedSystemId)
    const isHighlighted =
      presentationMode !== PRESENTATION_MODES.FREE
        ? presentationSystemIds.has(sourceSystemId) || presentationSystemIds.has(targetSystemId)
        : isSelectionTrace ||
          explicitHighlightedNodeIds.has(edge.source) ||
          explicitHighlightedNodeIds.has(edge.target) ||
          highlightedSystemIds.has(sourceSystemId) ||
          highlightedSystemIds.has(targetSystemId)

    return {
      ...edge,
      ...edgeHandles,
      data: {
        ...edge.data,
        isHighlighted,
        isDimmed: presentationMode !== PRESENTATION_MODES.FREE ? !isHighlighted : !isHighlighted,
        highlightMode,
        isSelectionTrace,
        isPresentationTrace: false,
      },
    }
  })
}
