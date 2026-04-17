import { useGraphStore } from '../store/graphStore'
import { selectGraphLoaded } from '../store/selectors'

// useGraphLoaded is a thin selector facade over the graphLoaded boolean in
// the graph slice. Components subscribe through this hook so that the source
// of truth (store vs context vs hook return) can move in the future without
// touching every consumer.

export function useGraphLoaded() {
  return useGraphStore(selectGraphLoaded)
}
