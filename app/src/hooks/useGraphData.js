import { useEffect } from 'react'
import { MOTION } from '../contracts/motion'
import { useRuntimeGraph } from './useRuntimeGraph'

// useGraphData composes useRuntimeGraph (loader pipeline) with the runtime
// polling interval and the window focus listener. Commit 6 will extract the
// interval+focus wiring into useRuntimePolling and Commit 7 will retire this
// hook entirely; until then it preserves the public API consumers depend on.

export function useGraphData() {
  const { graphLoaded, loadRuntimeData } = useRuntimeGraph()

  useEffect(() => {
    loadRuntimeData()

    const intervalId = window.setInterval(loadRuntimeData, MOTION.runtimePoll)
    window.addEventListener('focus', loadRuntimeData)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', loadRuntimeData)
    }
  }, [loadRuntimeData])

  return graphLoaded
}
