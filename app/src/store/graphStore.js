import { create } from 'zustand'
import { createGraphSlice } from './graphSlice'
import { createUiSlice } from './uiSlice'
import { createRuntimeSlice } from './runtimeSlice'

// graphStore composes three slices that own disjoint regions of state.
// See graphSlice.js, uiSlice.js, runtimeSlice.js for the per-slice rules.
// Components should import named selectors from selectors.js rather than
// reaching into state directly.

export const useGraphStore = create((set, get) => ({
  ...createGraphSlice(set, get),
  ...createUiSlice(set, get),
  ...createRuntimeSlice(set, get),
}))
