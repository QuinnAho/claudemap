import { MOTION } from '../contracts/motion'
import { useRuntimeGraph } from './useRuntimeGraph'
import { useRuntimePolling } from './useRuntimePolling'

// useGraphData composes the loader (useRuntimeGraph) with the poll loop
// (useRuntimePolling). Commit 7 will retire this hook and call the two
// underlying hooks directly from App.jsx; until then it preserves the
// public API (returns graphLoaded) consumers depend on.

export function useGraphData() {
  const { graphLoaded, loadRuntimeData } = useRuntimeGraph()

  useRuntimePolling(loadRuntimeData, MOTION.runtimePoll)

  return graphLoaded
}
