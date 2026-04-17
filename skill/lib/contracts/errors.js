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
  ARG_VALIDATION_FAILED: 'ARG_VALIDATION_FAILED',

  // Degraded modes (ops may care, users usually do not).
  MCP_FALLBACK_FILE_SHIM: 'MCP_FALLBACK_FILE_SHIM',
  MCP_FALLBACK_FORBIDDEN: 'MCP_FALLBACK_FORBIDDEN',
  SEED_MAP_MISSING: 'SEED_MAP_MISSING',
  ENRICHMENT_PROMPT_MISSING: 'ENRICHMENT_PROMPT_MISSING',

  // Schema drift (Phase 6 warn+best-effort semantics).
  SCHEMA_VALIDATION_FAILED: 'SCHEMA_VALIDATION_FAILED',
  SCHEMA_MIGRATION_APPLIED: 'SCHEMA_MIGRATION_APPLIED',

  // Success codes.
  COMMAND_OK: 'COMMAND_OK',

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

// Structured warning, reported when a read tolerates drift rather than
// throwing. Callers attach it to log output; consumers may pattern-match
// on the code. Shape mirrors failure() so sinks can treat the two alike.
export function warning(code, message, context) {
  return { level: 'warn', code, message, context: context || null }
}

// Default warning sink. Writes a single tagged line to stderr so that
// structured log scrapers can find it without parsing free-form text.
// Tests may replace this sink via setWarningSink().
function defaultWarningSink(warn) {
  const context = warn.context ? ` ${JSON.stringify(warn.context)}` : ''
  // eslint-disable-next-line no-console
  console.warn(`[claudemap:${warn.code}] ${warn.message}${context}`)
}

let activeWarningSink = defaultWarningSink

export function setWarningSink(sink) {
  activeWarningSink = typeof sink === 'function' ? sink : defaultWarningSink
}

export function reportWarning(warn) {
  if (!warn || !warn.code) {
    return
  }
  activeWarningSink(warn)
}
