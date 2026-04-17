import { useEffect } from 'react'

// useRuntimePolling drives a generic poll loop: it invokes the supplied
// callback once on mount, again on every interval tick, and again whenever the
// window regains focus. It does NOT know anything about the runtime envelope
// or the graph store; that lives in useRuntimeGraph. The callback should be
// wrapped in useCallback by the caller so the effect does not re-subscribe on
// every render.

export function useRuntimePolling(callback, intervalMs) {
  useEffect(() => {
    callback()

    const intervalId = window.setInterval(callback, intervalMs)
    window.addEventListener('focus', callback)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', callback)
    }
  }, [callback, intervalMs])
}
