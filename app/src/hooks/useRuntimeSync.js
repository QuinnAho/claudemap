import { MOTION } from '../contracts/motion'
import { useRuntimeGraph } from './useRuntimeGraph'
import { useRuntimePolling } from './useRuntimePolling'

// useRuntimeSync is the single mount-point that turns the runtime poller on
// for the lifetime of the app. Mount it once near the top of the tree (App)
// so loading does not depend on which route or panel is open. Components that
// only care whether the graph has finished loading should subscribe via
// useGraphLoaded instead of mounting this hook themselves.

export function useRuntimeSync() {
  const { loadRuntimeData } = useRuntimeGraph()

  useRuntimePolling(loadRuntimeData, MOTION.runtimePoll)
}
