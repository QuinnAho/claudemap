import { describe, expect, it } from 'vitest'
import { createGraphSlice, graphSliceInitialState } from './graphSlice'
import { createRuntimeSlice, runtimeSliceInitialState } from './runtimeSlice'
import { createUiSlice, uiSliceInitialState } from './uiSlice'

// slice-contract guards the slice boundary: each slice's initial state must
// include only its own fields, and setters in one slice must not mutate the
// fields owned by the other two. This is a machine-verifiable version of the
// "slice setters never touch foreign fields" rule documented in the slice
// headers. Cross-slice writers (setRuntimeControls, resetForMapChange) are
// intentional and excluded with explicit comments.

function makeSetRecorder() {
  let state = {}
  const writes = []
  const set = (fields) => {
    const next = typeof fields === 'function' ? fields(state) : fields
    writes.push(next)
    state = { ...state, ...next }
  }

  return { get: () => state, set, writes }
}

const GRAPH_FIELDS = Object.keys(graphSliceInitialState)
const UI_FIELDS = Object.keys(uiSliceInitialState)
const RUNTIME_FIELDS = Object.keys(runtimeSliceInitialState)

describe('slice initial state disjointness', () => {
  it('graph and ui slices share no fields', () => {
    const shared = GRAPH_FIELDS.filter((field) => UI_FIELDS.includes(field))
    expect(shared).toEqual([])
  })

  it('graph and runtime slices share no fields', () => {
    const shared = GRAPH_FIELDS.filter((field) => RUNTIME_FIELDS.includes(field))
    expect(shared).toEqual([])
  })

  it('ui and runtime slices share no fields', () => {
    const shared = UI_FIELDS.filter((field) => RUNTIME_FIELDS.includes(field))
    expect(shared).toEqual([])
  })
})

describe('graph slice setters only touch graph fields', () => {
  it('setGraph only writes nodes and edges', () => {
    const recorder = makeSetRecorder()
    const slice = createGraphSlice(recorder.set)
    slice.setGraph([{ id: 'a' }], [{ id: 'e' }])
    const foreign = Object.keys(recorder.writes.at(-1)).filter(
      (key) => !GRAPH_FIELDS.includes(key),
    )
    expect(foreign).toEqual([])
  })

  it('setGraphLoaded only writes graphLoaded', () => {
    const recorder = makeSetRecorder()
    const slice = createGraphSlice(recorder.set)
    slice.setGraphLoaded(true)
    expect(recorder.writes.at(-1)).toEqual({ graphLoaded: true })
  })
})

describe('ui slice setters only touch ui fields', () => {
  it('setSelectedNode only writes selectedNode', () => {
    const recorder = makeSetRecorder()
    const slice = createUiSlice(recorder.set)
    slice.setSelectedNode({ id: 'a' })
    expect(recorder.writes.at(-1)).toEqual({ selectedNode: { id: 'a' } })
  })

  it('setHoveredPathIds only writes hoveredPathIds', () => {
    const recorder = makeSetRecorder()
    const slice = createUiSlice(recorder.set)
    slice.setHoveredPathIds(['a', 'b'])
    const patch = recorder.writes.at(-1)
    const foreign = Object.keys(patch).filter((key) => !UI_FIELDS.includes(key))
    expect(foreign).toEqual([])
    expect(patch.hoveredPathIds).toEqual(['a', 'b'])
  })

  it('clearHoveredPath only writes hoveredPathIds when non-empty', () => {
    const recorder = makeSetRecorder()
    const slice = createUiSlice(recorder.set)
    // Seed the recorder state so the functional updater sees a non-empty path.
    recorder.set({ hoveredPathIds: ['a'] })
    slice.clearHoveredPath()
    const patch = recorder.writes.at(-1)
    const foreign = Object.keys(patch).filter((key) => !UI_FIELDS.includes(key))
    expect(foreign).toEqual([])
  })
})

describe('runtime slice setters', () => {
  it('setHighlightedNodes only writes highlightedNodes', () => {
    const recorder = makeSetRecorder()
    const slice = createRuntimeSlice(recorder.set)
    slice.setHighlightedNodes(['a'])
    expect(recorder.writes.at(-1)).toEqual({ highlightedNodes: ['a'] })
  })

  it('clearRuntimeEmphasis only writes runtime fields', () => {
    const recorder = makeSetRecorder()
    const slice = createRuntimeSlice(recorder.set)
    // Seed non-empty runtime state so the functional updater produces writes.
    recorder.set({
      highlightedNodes: ['a'],
      focusRequest: { nodeId: 'a' },
      guidedFlowRequest: { steps: ['a'] },
    })
    slice.clearRuntimeEmphasis()
    const patch = recorder.writes.at(-1)
    const foreign = Object.keys(patch).filter((key) => !RUNTIME_FIELDS.includes(key))
    expect(foreign).toEqual([])
  })
})
