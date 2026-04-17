// UI slice: selection, hover, healthOverlay. The "fields the user is currently
// manipulating" half of the store. Setters here never mutate graph data or
// runtime-driven fields.

function arePathsEqual(left = [], right = []) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

export const uiSliceInitialState = {
  selectedNode: null,
  hoveredPathIds: [],
  healthOverlay: false,
}

export function createUiSlice(set) {
  return {
    ...uiSliceInitialState,

    setSelectedNode: (node) => set({ selectedNode: node }),

    setHealthOverlay: (enabled) => set({ healthOverlay: enabled }),

    setHoveredPathIds: (nodeIds) =>
      set((state) =>
        arePathsEqual(state.hoveredPathIds, nodeIds)
          ? state
          : { hoveredPathIds: [...nodeIds] },
      ),

    clearHoveredPath: () =>
      set((state) => (state.hoveredPathIds.length ? { hoveredPathIds: [] } : state)),
  }
}
