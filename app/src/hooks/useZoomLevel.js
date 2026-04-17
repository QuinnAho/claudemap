import { useCallback, useState } from 'react'
import { ZOOM_LEVELS, ZOOM_THRESHOLDS } from '../contracts/zoom'

export { ZOOM_LEVELS }

export function useZoomLevel() {
  const [zoomLevel, setZoomLevel] = useState(ZOOM_LEVELS.OVERVIEW)

  const onViewportChange = useCallback((viewport) => {
    const zoom = viewport.zoom

    if (zoom < ZOOM_THRESHOLDS.overview) {
      setZoomLevel(ZOOM_LEVELS.OVERVIEW)
      return
    }

    if (zoom < ZOOM_THRESHOLDS.detailed) {
      setZoomLevel(ZOOM_LEVELS.DETAILED)
      return
    }

    setZoomLevel(ZOOM_LEVELS.DEEP)
  }, [])

  return { zoomLevel, onViewportChange }
}
