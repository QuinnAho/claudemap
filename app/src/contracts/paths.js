// App-side canonical path and URL constants.
//
// The browser bundle cannot import the Node-oriented skill paths contract,
// so filenames shared with the skill are mirrored here. If the skill
// contract changes, update both.

// Root-level manifest files fetched from the app's public root.
export const CACHE_FILENAME = 'claudemap-cache.json'
export const MAPS_MANIFEST_FILENAME = 'claudemap-maps.json'

// Default graph artifact paths relative to the app's public root.
export const GRAPH_DIR_NAME = 'graph'
export const RUNTIME_GRAPH_FILENAME = 'claudemap-runtime.json'
export const RUNTIME_STATE_FILENAME = 'claudemap-runtime-state.json'
export const RUNTIME_GRAPH_REL = `${GRAPH_DIR_NAME}/${RUNTIME_GRAPH_FILENAME}`
export const RUNTIME_STATE_REL = `${GRAPH_DIR_NAME}/${RUNTIME_STATE_FILENAME}`

// Default map identifier matching skill map-manifest DEFAULT_MAP_ID.
export const DEFAULT_MAP_ID = 'root'

// Dev server / runtime API endpoints exposed by the Vite middleware.
export const API_ACTIVE_MAP_ENDPOINT = '/__claudemap/active-map'
