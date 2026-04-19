// Entry point for hand-rolled persisted-shape validators.
//
// Each reader in the skill / scripts passes its just-parsed JSON through
// `validateWithWarning(schemaName, value, context)`. If the value is
// valid, the raw value comes back. If it isn't, a structured warning
// fires via reportWarning and the raw value still comes back so that
// the reader can continue with its existing normalize/fallback logic.
// No validator throws.

import { ERROR_CODES, reportWarning, warning } from '../errors.js'
import { validateCache } from './cache.js'
import { validateGraph } from './graph.js'
import { validateInstallRecord } from './install-record.js'
import { validateManifest } from './manifest.js'
import { validateRuntimeEnvelope } from './runtime-envelope.js'

export const SCHEMA_NAMES = Object.freeze({
  GRAPH: 'graph',
  MANIFEST: 'manifest',
  RUNTIME_ENVELOPE: 'runtime-envelope',
  INSTALL_RECORD: 'install-record',
  CACHE: 'cache',
})

const VALIDATORS = {
  [SCHEMA_NAMES.GRAPH]: validateGraph,
  [SCHEMA_NAMES.MANIFEST]: validateManifest,
  [SCHEMA_NAMES.RUNTIME_ENVELOPE]: validateRuntimeEnvelope,
  [SCHEMA_NAMES.INSTALL_RECORD]: validateInstallRecord,
  [SCHEMA_NAMES.CACHE]: validateCache,
}

export function validate(schemaName, value) {
  const validator = VALIDATORS[schemaName]

  if (!validator) {
    throw new Error(`Unknown schema: ${schemaName}`)
  }

  return validator(value)
}

// Validate and, on failure, fire a warning to the configured sink.
// Always returns the original value so readers with their own
// normalize/fallback logic can continue untouched.
export function validateWithWarning(schemaName, value, context) {
  const result = validate(schemaName, value)

  if (!result.ok) {
    reportWarning(
      warning(
        ERROR_CODES.SCHEMA_VALIDATION_FAILED,
        `Schema validation failed for ${schemaName}`,
        {
          ...(context || {}),
          schema: schemaName,
          errors: result.errors.slice(0, 8),
        },
      ),
    )
  }

  return value
}

export { validateCache, validateGraph, validateInstallRecord, validateManifest, validateRuntimeEnvelope }

// Loose predicates for runtime filtering. These match the app's original
// behavior: they check minimal structural requirements without enforcing
// the full schema. Use these in contexts where graceful degradation is
// preferred over strict validation (e.g., fetch response filtering).
//
// For strict validation, use validate() or the individual validate*()
// functions which return { ok, errors, value }.

export function isGraphPayload(value) {
  return Boolean(value && Array.isArray(value.nodes) && Array.isArray(value.edges))
}

export function isRuntimeEnvelope(value) {
  return Boolean(value && typeof value.graphRevision === 'number' && value.runtime)
}

export function isMapsManifest(value) {
  return Boolean(value && Array.isArray(value.maps))
}

// Strict predicates that wrap the full validators. Use these when you want
// a boolean result but also want to enforce the complete schema.

export function isValidGraph(value) {
  return validateGraph(value).ok
}

export function isValidRuntimeEnvelope(value) {
  return validateRuntimeEnvelope(value).ok
}

export function isValidManifest(value) {
  return validateManifest(value).ok
}
