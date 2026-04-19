import { GRAPH_SOURCES } from '../contracts/graph-sources'
import { getBrand } from '../lib/brand'

// Graph slice: nodes, edges, manifest, meta. The "data that came from disk" half
// of the store. Setters here never mutate UI-local or runtime-driven fields.

export const graphSliceInitialState = {
  nodes: [],
  edges: [],
  mapsManifest: null,
  activeMapId: 'root',
  activeMap: null,
  graphLoaded: false,
  meta: {
    repoName: 'claudemap',
    creditLabel: `${getBrand().displayName} graph`,
    source: GRAPH_SOURCES.RUNTIME,
    lastSyncedAt: Date.now(),
  },
}

export function createGraphSlice(set) {
  return {
    ...graphSliceInitialState,

    setGraph: (nodes, edges) => set({ nodes, edges }),

    setGraphLoaded: (graphLoaded) => set({ graphLoaded }),

    setMapsManifest: (manifest) =>
      set({
        mapsManifest: manifest,
        activeMapId: manifest?.activeMapId || 'root',
        activeMap:
          manifest?.maps?.find((entry) => entry.id === manifest.activeMapId) || null,
      }),

    addNode: (node) =>
      set((state) => ({
        nodes: [...state.nodes, node],
      })),

    removeNode: (nodeId) =>
      set((state) => ({
        nodes: state.nodes.filter((node) => node.id !== nodeId),
        edges: state.edges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        ),
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
  }
}
