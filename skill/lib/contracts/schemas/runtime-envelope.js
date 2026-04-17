// Runtime envelope validator (claudemap-runtime-state.json).
//
// Writers are normalizeRuntimeState / buildNextRuntimeEnvelope in
// mcp-client.js. The schema below is deliberately tight on the top-level
// keys and loose on the nested runtime/presentation object, because
// presentation is still evolving and normalizeRuntimeState already coerces
// drift into canonical shape on every read.

import { fail, isPlainObject, ok, pushTypeError, validateShape } from './shared.js'

const ENVELOPE_ROOT_SHAPE = {
  graphRevision: 'number',
  updatedAt: 'string',
  graphMeta: 'object',
  runtime: 'object',
}

export function validateRuntimeEnvelope(value) {
  const errors = validateShape(value, ENVELOPE_ROOT_SHAPE)

  if (errors.length > 0 || !isPlainObject(value)) {
    return fail(errors, value)
  }

  const runtime = value.runtime

  if (runtime.presentation !== undefined && !isPlainObject(runtime.presentation)) {
    pushTypeError(errors, 'runtime.presentation', 'object', runtime.presentation)
  }

  if (
    runtime.highlightedNodeIds !== undefined &&
    !Array.isArray(runtime.highlightedNodeIds)
  ) {
    pushTypeError(errors, 'runtime.highlightedNodeIds', 'array', runtime.highlightedNodeIds)
  }

  return errors.length === 0 ? ok(value) : fail(errors, value)
}
