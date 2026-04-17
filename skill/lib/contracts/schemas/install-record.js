// Install record validator (.claude/claudemap-install.json).
//
// Written by scripts/install-claudemap.js at the end of a successful
// install; read by the same script on the next install to identify
// managed paths for cleanup. A drifted install record silently causes
// stale files to survive upgrades, so the validator flags missing keys
// loudly while still tolerating extra fields.

import { fail, isPlainObject, ok, validateShape } from './shared.js'

const INSTALL_RECORD_SHAPE = {
  artifact: 'string',
  artifactVersion: 'string',
  installedAt: 'string',
  managedPaths: 'array',
  mode: 'string',
}

export function validateInstallRecord(value) {
  const errors = validateShape(value, INSTALL_RECORD_SHAPE)

  if (errors.length > 0 || !isPlainObject(value)) {
    return fail(errors, value)
  }

  return ok(value)
}
