import { create } from 'zustand'

export const useGraphStore = create((set) => ({
  nodes: [],
  edges: [],
  meta: {
    repoName: 'expressjs/express',
    branch: 'main',
    creditLabel: 'A Project by Quinn Aho',
    lastSyncedAt: Date.now(),
  },
  selectedNode: null,
  highlightedNodes: [],
  healthOverlay: false,

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
}))
