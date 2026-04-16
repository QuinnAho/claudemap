// Stable error codes. Callers match on these, not on message substrings.
// Messages may improve; codes do not change.

export const ERROR_CODES = Object.freeze({
  // Expected failures (user-actionable).
  NO_ACTIVE_MAP: 'NO_ACTIVE_MAP',
  NO_RUNTIME_GRAPH: 'NO_RUNTIME_GRAPH',
  NO_NODE_MATCHED: 'NO_NODE_MATCHED',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  MISSING_ARGUMENT: 'MISSING_ARGUMENT',
  UNKNOWN_ACTION: 'UNKNOWN_ACTION',
  NO_INTENT_MATCH: 'NO_INTENT_MATCH',
  MANIFEST_MISSING: 'MANIFEST_MISSING',
  SCOPE_UNRESOLVED: 'SCOPE_UNRESOLVED',

  // Degraded modes (ops may care, users usually do not).
  MCP_FALLBACK_FILE_SHIM: 'MCP_FALLBACK_FILE_SHIM',
  SEED_MAP_MISSING: 'SEED_MAP_MISSING',
  ENRICHMENT_PROMPT_MISSING: 'ENRICHMENT_PROMPT_MISSING',

  // Packaging / install.
  ARTIFACT_MANIFEST_MISSING: 'ARTIFACT_MANIFEST_MISSING',
  INSTALL_PARTIAL: 'INSTALL_PARTIAL',
  BUNDLE_BUILD_FAILED: 'BUNDLE_BUILD_FAILED',
})

// Constructor for structured expected-failure results. Commands return these
// instead of throwing when the failure is the user's concern, not a bug.
export function failure(code, message, hint) {
  return { ok: false, code, message, hint }
}

export function success(data = null) {
  return { ok: true, data }
}

// Throwable error that carries a code for programmatic handling.
export class ClaudeMapError extends Error {
  constructor(code, message, hint) {
    super(message)
    this.name = 'ClaudeMapError'
    this.code = code
    this.hint = hint
  }
}
