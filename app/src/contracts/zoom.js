// Zoom thresholds and viewport clamps. All zoom-related numbers live here;
// a change in one place propagates to every consumer.

export const ZOOM_LEVELS = Object.freeze({
  OVERVIEW: 'overview',
  DETAILED: 'detailed',
  DEEP: 'deep',
})

// Thresholds used by useZoomLevel to map a raw zoom value to a level name.
export const ZOOM_THRESHOLDS = Object.freeze({
  overview: 0.7,   // below this = OVERVIEW
  detailed: 1.5,   // below this = DETAILED, at or above = DEEP
})

// Viewport-animation clamps for setCenter.
export const VIEWPORT = Object.freeze({
  minZoom: 0.55,
  maxZoom: 1.4,
  presentationOffsetPx: 48,
})

// fitView options, used by the initial render and the zoom-controls fit button.
export const FIT_VIEW = Object.freeze({
  padding: 0.2,
  maxZoom: 0.65,
})

// Default zoom levels applied by navigateTo based on node kind.
export const NAVIGATE_DEFAULT_ZOOM = Object.freeze({
  function: 1.18,
  file: 1.04,
  nestedSystem: 0.94,
  rootSystem: 0.82,
})
