// Install record validator (.claude/claudemap-install.json or .codex/claudemap-install.json).
//
// Written by scripts/install-claudemap.js at the end of a successful
// install; read by the same script on the next install to identify
// managed paths for cleanup. A drifted install record silently causes
// stale files to survive upgrades, so the validator flags missing keys
// loudly while still tolerating extra fields.
//
// Version history:
// - v1: Original schema (artifact, artifactVersion, installedAt, managedPaths, mode)
// - v2: Added `assistant` field to track which assistant type was installed

import { fail, isPlainObject, ok, validateShape } from './shared.js'
import { ASSISTANT_TYPES } from '../paths.js'

// Required fields for all versions
const INSTALL_RECORD_SHAPE = {
  artifact: 'string',
  artifactVersion: 'string',
  installedAt: 'string',
  managedPaths: 'array',
  mode: 'string',
}

// Valid assistant type values
const VALID_ASSISTANTS = Object.values(ASSISTANT_TYPES)

export function validateInstallRecord(value) {
  const errors = validateShape(value, INSTALL_RECORD_SHAPE)

  if (errors.length > 0 || !isPlainObject(value)) {
    return fail(errors, value)
  }

  // Validate assistant field if present (optional for backwards compat with v1)
  if (value.assistant !== undefined) {
    if (typeof value.assistant !== 'string') {
      errors.push({
        path: 'assistant',
        message: 'assistant must be a string',
      })
    } else if (!VALID_ASSISTANTS.includes(value.assistant)) {
      errors.push({
        path: 'assistant',
        message: `assistant must be one of: ${VALID_ASSISTANTS.join(', ')}`,
      })
    }
  }

  if (errors.length > 0) {
    return fail(errors, value)
  }

  return ok(value)
}
