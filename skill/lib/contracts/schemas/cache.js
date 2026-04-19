// Cache file validator (claudemap-cache.json and scoped variants).
//
// The cache has had a schemaVersion field from day one, so this validator
// is the most aligned of the five. The files array is intentionally
// loose: per-file shape is derived from a file walker that evolves
// more frequently than the top-level structure.

import { fail, isPlainObject, ok, validateShape } from './shared.js'

const CACHE_ROOT_SHAPE = {
  schemaVersion: 'number',
  generatedAt: 'string',
  fileCount: 'number',
  files: 'array',
  graph: 'object',
}

export function validateCache(value) {
  const errors = validateShape(value, CACHE_ROOT_SHAPE)

  if (errors.length > 0 || !isPlainObject(value)) {
    return fail(errors, value)
  }

  return ok(value)
}
