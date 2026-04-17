import { useCallback, useEffect, useRef } from 'react'
import { MOTION } from '../contracts/motion'
import { useGraphStore } from '../store/graphStore'
import { selectClearHoveredPath, selectHoveredPathIds, selectSetHoveredPathIds } from '../store/selectors'
import { areStringArraysEqual } from '../lib/graphView'

// useHoverPathScheduler debounces hover-path updates so cursor jitter does not
// thrash the store. It owns three refs (leave timeout, animation frame,
// pending path) and exposes scheduleHoverPath plus cancelHoverClear. The
// 1200ms runtime poll cannot clobber hoveredPathIds because hoveredPathIds
// lives in the UI slice and the runtime poller never writes there.

export function useHoverPathScheduler() {
  const hoveredPathIds = useGraphStore(selectHoveredPathIds)
  const setHoveredPathIds = useGraphStore(selectSetHoveredPathIds)
  const clearHoveredPath = useGraphStore(selectClearHoveredPath)

  const leaveTimeoutRef = useRef(null)
  const hoverFrameRef = useRef(null)
  const pendingHoverPathRef = useRef([])

  const cancelHoverClear = useCallback((clearPendingPath = true) => {
    if (leaveTimeoutRef.current !== null) {
      window.clearTimeout(leaveTimeoutRef.current)
      leaveTimeoutRef.current = null
    }

    if (hoverFrameRef.current !== null) {
      window.cancelAnimationFrame(hoverFrameRef.current)
      hoverFrameRef.current = null
    }

    if (clearPendingPath) {
      pendingHoverPathRef.current = []
    }
  }, [])

  useEffect(() => () => cancelHoverClear(), [cancelHoverClear])

  const scheduleHoverPath = useCallback(
    (nextPathIds, options = {}) => {
      const { delay = MOTION.hoverEnter } = options

      if (
        areStringArraysEqual(nextPathIds, pendingHoverPathRef.current) ||
        areStringArraysEqual(nextPathIds, hoveredPathIds)
      ) {
        return
      }

      cancelHoverClear(false)
      pendingHoverPathRef.current = [...nextPathIds]
      leaveTimeoutRef.current = window.setTimeout(() => {
        leaveTimeoutRef.current = null
        hoverFrameRef.current = window.requestAnimationFrame(() => {
          hoverFrameRef.current = null

          if (pendingHoverPathRef.current.length) {
            setHoveredPathIds(pendingHoverPathRef.current)
          } else {
            clearHoveredPath()
          }
        })
        leaveTimeoutRef.current = null
      }, delay)
    },
    [cancelHoverClear, clearHoveredPath, hoveredPathIds, setHoveredPathIds],
  )

  return { hoveredPathIds, pendingHoverPathRef, scheduleHoverPath, cancelHoverClear, clearHoveredPath }
}
