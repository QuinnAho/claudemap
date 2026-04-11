import { useCallback, useState } from 'react'

export const ZOOM_LEVELS = {
  OVERVIEW: 'overview',
  DETAILED: 'detailed',
  DEEP: 'deep',
}

export function useZoomLevel() {
  const [zoomLevel, setZoomLevel] = useState(ZOOM_LEVELS.OVERVIEW)

  const onViewportChange = useCallback((viewport) => {
    const zoom = viewport.zoom

    if (zoom < 0.7) {
      setZoomLevel(ZOOM_LEVELS.OVERVIEW)
      return
    }

    if (zoom < 1.5) {
      setZoomLevel(ZOOM_LEVELS.DETAILED)
      return
    }

    setZoomLevel(ZOOM_LEVELS.DEEP)
  }, [])

  return { zoomLevel, onViewportChange }
}
