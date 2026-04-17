// Schema versions for persisted shapes.
//
// Every version bump ships with a migration function registered in
// MIGRATIONS below. runMigrations is the single entry point readers
// use to bring an older payload forward. Today every shape is at
// version 1; future bumps add entries to the per-shape arrays.

import { SCHEMA_NAMES } from './schemas/index.js'

export const MANIFEST_VERSION = 1
export const GRAPH_VERSION = 1
export const RUNTIME_STATE_VERSION = 1
export const INSTALL_RECORD_VERSION = 1
export const CACHE_VERSION = 1

// Sentinel used when a graph has never been assigned a revision.
export const GRAPH_REVISION_UNSET = 0

export const CURRENT_VERSIONS = Object.freeze({
  [SCHEMA_NAMES.MANIFEST]: MANIFEST_VERSION,
  [SCHEMA_NAMES.GRAPH]: GRAPH_VERSION,
  [SCHEMA_NAMES.RUNTIME_ENVELOPE]: RUNTIME_STATE_VERSION,
  [SCHEMA_NAMES.INSTALL_RECORD]: INSTALL_RECORD_VERSION,
  [SCHEMA_NAMES.CACHE]: CACHE_VERSION,
})

// Read the on-disk version of a value. Falls back to 1 so pre-versioned
// files produced before Phase 6 are treated as "current minus zero" and
// pass through migrations as no-ops.
function detectVersion(schemaName, value) {
  if (!value || typeof value !== 'object') {
    return 1
  }

  if (schemaName === SCHEMA_NAMES.CACHE) {
    return Number.isFinite(value.schemaVersion) ? value.schemaVersion : 1
  }

  return Number.isFinite(value.version) ? value.version : 1
}

// Per-shape migration ladder. Each entry is { from, to, migrate(value) }.
// Migrations run sequentially; the first entry whose `from` matches the
// detected version is applied, then `to` becomes the new detected version,
// and the loop continues. A schema bump that lands without a ladder entry
// is a failing PR (ARCHITECTURE-REVIEW Phase 6 rule 4).
const MIGRATIONS = {
  [SCHEMA_NAMES.MANIFEST]: [],
  [SCHEMA_NAMES.GRAPH]: [],
  [SCHEMA_NAMES.RUNTIME_ENVELOPE]: [],
  [SCHEMA_NAMES.INSTALL_RECORD]: [],
  [SCHEMA_NAMES.CACHE]: [],
}

export function runMigrations(schemaName, value) {
  const ladder = MIGRATIONS[schemaName]

  if (!ladder) {
    throw new Error(`Unknown schema: ${schemaName}`)
  }

  let current = value
  let currentVersion = detectVersion(schemaName, current)
  const target = CURRENT_VERSIONS[schemaName]

  // Linear walk. Ladder is small; branching is forbidden by contract.
  let safety = ladder.length + 1
  while (currentVersion < target && safety > 0) {
    safety -= 1
    const step = ladder.find((entry) => entry.from === currentVersion)

    if (!step) {
      // No registered step. A version gap means a prior bump landed
      // without a migration. Return the payload unchanged and let the
      // caller surface the validator warning.
      return current
    }

    current = step.migrate(current)
    currentVersion = step.to
  }

  return current
}
