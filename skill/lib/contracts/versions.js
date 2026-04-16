// Schema versions for persisted shapes.
//
// Every version bump ships with a migration function in the owning module
// (manifest migrations in map-manifest.js, graph migrations in enrichment.js,
// etc.). Versions are numbers; migrations run sequentially.

export const MANIFEST_VERSION = 1
export const GRAPH_VERSION = 1
export const RUNTIME_STATE_VERSION = 1
export const INSTALL_RECORD_VERSION = 1

// Sentinel used when a graph has never been assigned a revision.
export const GRAPH_REVISION_UNSET = 0
