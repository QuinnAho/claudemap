import { describe, expect, it } from 'vitest'
import { PRESENTATION_MODES } from '../contracts/presentation'
import { useGraphStore } from './graphStore'

// hover-poll guards against the F-FE-2 regression where the 1200ms runtime
// poller was clobbering hoveredPathIds because setRuntimeControls reached
// into the UI slice with a defensive `hoveredPathIds: state.hoveredPathIds`
// passthrough that ended up dominating the UI slice's own setter. Now that
// hoveredPathIds lives in uiSlice and the runtime slice has no reason to
// write it, repeated setRuntimeControls calls with no hover info must leave
// hoveredPathIds untouched.

function resetStore() {
  useGraphStore.setState(
    {
      hoveredPathIds: [],
      highlightedNodes: [],
      focusRequest: null,
      guidedFlowRequest: null,
      presentationMode: PRESENTATION_MODES.FREE,
      selectedNode: null,
    },
    false,
  )
}

describe('hoveredPathIds survives runtime poll', () => {
  it('setRuntimeControls with no hover info does not clear hoveredPathIds', () => {
    resetStore()
    const { setHoveredPathIds, setRuntimeControls } = useGraphStore.getState()

    setHoveredPathIds(['system-a', 'system-b'])
    expect(useGraphStore.getState().hoveredPathIds).toEqual(['system-a', 'system-b'])

    setRuntimeControls({
      highlightedNodeIds: [],
      presentation: { mode: PRESENTATION_MODES.FREE },
    })
    expect(useGraphStore.getState().hoveredPathIds).toEqual(['system-a', 'system-b'])
  })

  it('repeated setRuntimeControls calls (polling cycle) keep hoveredPathIds stable', () => {
    resetStore()
    const { setHoveredPathIds, setRuntimeControls } = useGraphStore.getState()

    setHoveredPathIds(['system-x'])

    for (let tick = 0; tick < 5; tick += 1) {
      setRuntimeControls({
        highlightedNodeIds: [],
        presentation: { mode: PRESENTATION_MODES.FREE },
      })
    }

    expect(useGraphStore.getState().hoveredPathIds).toEqual(['system-x'])
  })

  it('clearRuntimeEmphasis preserves hoveredPathIds', () => {
    resetStore()
    const { setHoveredPathIds, setHighlightedNodes, clearRuntimeEmphasis } =
      useGraphStore.getState()

    setHoveredPathIds(['system-a'])
    setHighlightedNodes(['system-b'])
    clearRuntimeEmphasis()

    expect(useGraphStore.getState().hoveredPathIds).toEqual(['system-a'])
    expect(useGraphStore.getState().highlightedNodes).toEqual([])
  })

  it('resetForMapChange does clear hoveredPathIds (intentional)', () => {
    resetStore()
    const { setHoveredPathIds, resetForMapChange } = useGraphStore.getState()

    setHoveredPathIds(['system-a'])
    resetForMapChange()

    expect(useGraphStore.getState().hoveredPathIds).toEqual([])
    expect(useGraphStore.getState().graphLoaded).toBe(false)
  })
})
