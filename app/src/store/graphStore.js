import { create } from 'zustand'

function arePathsEqual(left = [], right = []) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

export const useGraphStore = create((set) => ({
  nodes: [],
  edges: [],
  meta: {
    repoName: 'claudemap',
    branch: 'current',
    creditLabel: 'ClaudeMap graph',
    source: 'runtime',
    lastSyncedAt: Date.now(),
  },
  selectedNode: null,
  highlightedNodes: [],
  highlightColor: 'accent',
  healthOverlay: false,
  hoveredPathIds: [],
  focusRequest: null,
  guidedFlowRequest: null,
  presentationMode: 'free',
  presentationLockInput: false,
  presentationCaption: null,

  setGraph: (nodes, edges) => set({ nodes, edges }),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),

  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    })),

  updateNode: (nodeId, fields) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...fields } } : node,
      ),
    })),

  addEdge: (edge) =>
    set((state) => ({
      edges: [...state.edges, edge],
    })),

  removeEdge: (edgeId) =>
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== edgeId),
    })),

  setMeta: (fields) =>
    set((state) => ({
      meta: { ...state.meta, ...fields },
    })),

  setSyncedAt: () =>
    set((state) => ({
      meta: { ...state.meta, lastSyncedAt: Date.now() },
    })),

  setSelectedNode: (node) => set({ selectedNode: node }),

  setHighlightedNodes: (nodeIds) => set({ highlightedNodes: nodeIds }),

  clearHighlight: () => set({ highlightedNodes: [] }),

  setHealthOverlay: (enabled) => set({ healthOverlay: enabled }),

  setRuntimeControls: (controls) =>
    set((state) => {
      const highlightedNodes = Array.isArray(controls?.highlightedNodeIds)
        ? controls.highlightedNodeIds
        : []
      const focusRequest = controls?.focus || null
      const guidedFlowRequest = controls?.guidedFlow || null
      const presentationMode = controls?.presentation?.mode || 'free'
      const shouldClearSelection =
        presentationMode !== 'free' &&
        !focusRequest &&
        !guidedFlowRequest &&
        highlightedNodes.length === 0

      return {
        highlightedNodes,
        highlightColor: controls?.highlightColor || 'accent',
        healthOverlay:
          typeof controls?.healthOverlay === 'boolean' ? controls.healthOverlay : false,
        focusRequest,
        guidedFlowRequest,
        presentationMode,
        presentationLockInput:
          typeof controls?.presentation?.lockInput === 'boolean'
            ? controls.presentation.lockInput
            : false,
        presentationCaption:
          controls?.presentation?.title ||
          controls?.presentation?.explanation ||
          controls?.presentation?.body ||
          controls?.presentation?.stepLabel
            ? {
                title: controls.presentation.title || null,
                explanation:
                  controls.presentation.explanation || controls.presentation.body || null,
                body: controls.presentation.body || null,
                stepLabel: controls.presentation.stepLabel || null,
                updatedAt: controls.presentation.updatedAt || null,
              }
            : null,
        selectedNode: shouldClearSelection ? null : state.selectedNode,
        hoveredPathIds: shouldClearSelection ? [] : state.hoveredPathIds,
      }
    }),

  clearRuntimeEmphasis: () =>
    set((state) => ({
      highlightedNodes: state.highlightedNodes.length ? [] : state.highlightedNodes,
      focusRequest: state.focusRequest ? null : state.focusRequest,
      guidedFlowRequest: state.guidedFlowRequest ? null : state.guidedFlowRequest,
    })),

  setHoveredPathIds: (nodeIds) =>
    set((state) =>
      arePathsEqual(state.hoveredPathIds, nodeIds)
        ? state
        : { hoveredPathIds: [...nodeIds] },
    ),

  clearHoveredPath: () =>
    set((state) => (state.hoveredPathIds.length ? { hoveredPathIds: [] } : state)),
}))
