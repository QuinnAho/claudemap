import { PRESENTATION_MODES } from '../contracts/presentation'

// Runtime slice: highlight, focus, guided flow, presentation. The "fields the
// runtime poller writes to" half of the store. Setters here primarily mutate
// runtime fields. The two cross-slice writers below are intentional and
// documented; they are the only places this slice touches foreign fields.
//
// - setRuntimeControls clears UI selectedNode when entering a non-FREE
//   presentation mode without an explicit focus/guided/highlight, because the
//   prior selection would otherwise hang in front of the presentation overlay.
//   It does NOT touch hoveredPathIds: hover lives in the UI slice and the
//   runtime poller has no reason to look at it. The slice composition makes
//   the prior defensive passthrough (state.hoveredPathIds) unnecessary.
// - resetForMapChange clears every interactive field across UI and runtime
//   slices on map switch. It is a reset, not a runtime update; it lives here
//   for proximity to the runtime fields that dominate it.

export const runtimeSliceInitialState = {
  highlightedNodes: [],
  highlightColor: 'accent',
  focusRequest: null,
  guidedFlowRequest: null,
  presentationMode: PRESENTATION_MODES.FREE,
  presentationLockInput: false,
  presentationCaption: null,
}

export function createRuntimeSlice(set) {
  return {
    ...runtimeSliceInitialState,

    setHighlightedNodes: (nodeIds) => set({ highlightedNodes: nodeIds }),

    clearHighlight: () => set({ highlightedNodes: [] }),

    setRuntimeControls: (controls) =>
      set((state) => {
        const highlightedNodes = Array.isArray(controls?.highlightedNodeIds)
          ? controls.highlightedNodeIds
          : []
        const focusRequest = controls?.focus || null
        const guidedFlowRequest = controls?.guidedFlow || null
        const presentationMode = controls?.presentation?.mode || PRESENTATION_MODES.FREE
        const shouldClearSelection =
          presentationMode !== PRESENTATION_MODES.FREE &&
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
        }
      }),

    clearRuntimeEmphasis: () =>
      set((state) => ({
        highlightedNodes: state.highlightedNodes.length ? [] : state.highlightedNodes,
        focusRequest: state.focusRequest ? null : state.focusRequest,
        guidedFlowRequest: state.guidedFlowRequest ? null : state.guidedFlowRequest,
      })),

    resetForMapChange: () =>
      set({
        selectedNode: null,
        highlightedNodes: [],
        highlightColor: 'accent',
        healthOverlay: false,
        hoveredPathIds: [],
        focusRequest: null,
        guidedFlowRequest: null,
        presentationMode: PRESENTATION_MODES.FREE,
        presentationLockInput: false,
        presentationCaption: null,
        graphLoaded: false,
      }),
  }
}
