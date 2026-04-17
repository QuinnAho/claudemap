import { PRESENTATION_MODES } from '../contracts/presentation'

// Named selectors for useGraphStore. Components and hooks must read store
// state through these selectors rather than inline arrow functions, so that
// renames and slice migrations are mechanical, and so that the contract
// guard's inline-store-selector rule can fire on regressions.

// ---- graph slice ----

export const selectNodes = (state) => state.nodes
export const selectEdges = (state) => state.edges
export const selectMapsManifest = (state) => state.mapsManifest
export const selectActiveMapId = (state) => state.activeMapId
export const selectActiveMap = (state) => state.activeMap
export const selectMeta = (state) => state.meta
export const selectMetaLastSyncedAt = (state) => state.meta.lastSyncedAt
export const selectGraphLoaded = (state) => state.graphLoaded

export const selectSetGraph = (state) => state.setGraph
export const selectSetMapsManifest = (state) => state.setMapsManifest
export const selectSetMeta = (state) => state.setMeta
export const selectSetGraphLoaded = (state) => state.setGraphLoaded

// ---- ui slice ----

export const selectSelectedNode = (state) => state.selectedNode
export const selectHoveredPathIds = (state) => state.hoveredPathIds
export const selectHealthOverlay = (state) => state.healthOverlay

export const selectSetSelectedNode = (state) => state.setSelectedNode
export const selectSetHealthOverlay = (state) => state.setHealthOverlay
export const selectSetHoveredPathIds = (state) => state.setHoveredPathIds
export const selectClearHoveredPath = (state) => state.clearHoveredPath

// ---- runtime slice ----

export const selectHighlightedNodes = (state) => state.highlightedNodes
export const selectFocusRequest = (state) => state.focusRequest
export const selectGuidedFlowRequest = (state) => state.guidedFlowRequest
export const selectPresentationMode = (state) => state.presentationMode
export const selectPresentationCaption = (state) => state.presentationCaption

export const selectSetRuntimeControls = (state) => state.setRuntimeControls
export const selectClearRuntimeEmphasis = (state) => state.clearRuntimeEmphasis
export const selectResetForMapChange = (state) => state.resetForMapChange

// ---- composed selectors ----

export const selectIsPresenting = (state) =>
  state.presentationMode !== PRESENTATION_MODES.FREE
