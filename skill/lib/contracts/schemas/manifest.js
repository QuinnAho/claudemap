// Map manifest validator (claudemap-maps.json).
//
// The manifest is already normalized via normalizeManifest() at every
// read site. This validator is the pre-normalization shape check: it
// flags drift loud enough that a future malformed manifest is caught
// before normalize quietly reshapes it into silence.

import { fail, isPlainObject, ok, pushTypeError, validateShape } from './shared.js'

const MANIFEST_ROOT_SHAPE = {
  version: 'number',
  activeMapId: 'string',
  maps: 'array',
}

const MAP_ENTRY_SHAPE = {
  id: 'string',
  label: 'string',
  graphPath: 'string',
  statePath: 'string',
  cachePath: 'string',
}

export function validateManifest(value) {
  const errors = validateShape(value, MANIFEST_ROOT_SHAPE)

  if (errors.length > 0 || !isPlainObject(value)) {
    return fail(errors, value)
  }

  value.maps.forEach((entry, index) => {
    const entryPath = `maps[${index}]`
    const entryErrors = validateShape(entry, MAP_ENTRY_SHAPE, entryPath)
    errors.push(...entryErrors)

    if (entry && entry.scope !== undefined && entry.scope !== null && !isPlainObject(entry.scope)) {
      pushTypeError(errors, `${entryPath}.scope`, 'object|null', entry.scope)
    }
  })

  return errors.length === 0 ? ok(value) : fail(errors, value)
}
