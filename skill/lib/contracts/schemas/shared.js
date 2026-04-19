// Shared primitives for hand-rolled validators. Each validator returns
// { ok, errors, value }: ok=true means the value passed, errors is always
// an array (empty on success), and value is the input (possibly coerced
// by the validator, though validators here prefer not to mutate).
//
// The model is intentionally small: type checks, required-keys checks,
// array-item checks. Anything more bespoke is written inline per shape.
//
// Warn+best-effort semantics: a validator with errors does NOT throw.
// The reader that calls it is responsible for reporting the warning
// (via reportWarning from ../errors.js) and deciding how to degrade.

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function pushTypeError(errors, path, expected, actual) {
  errors.push({
    path,
    message: `expected ${expected}, got ${typeOf(actual)}`,
  })
}

export function pushRequiredError(errors, path) {
  errors.push({ path, message: 'required property missing' })
}

export function pushEnumError(errors, path, allowed, actual) {
  errors.push({
    path,
    message: `expected one of [${allowed.join(', ')}], got ${JSON.stringify(actual)}`,
  })
}

export function typeOf(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

export function ok(value) {
  return { ok: true, errors: [], value }
}

export function fail(errors, value) {
  return { ok: false, errors, value }
}

// Require keys on an object; record missing or wrong-type entries.
// descriptor: { keyName: 'string' | 'number' | 'boolean' | 'object' | 'array' }
export function validateShape(value, descriptor, pathPrefix = '') {
  const errors = []

  if (!isPlainObject(value)) {
    pushTypeError(errors, pathPrefix || '(root)', 'object', value)
    return errors
  }

  for (const [key, expected] of Object.entries(descriptor)) {
    const keyPath = pathPrefix ? `${pathPrefix}.${key}` : key
    const field = value[key]

    if (field === undefined) {
      pushRequiredError(errors, keyPath)
      continue
    }

    if (expected === 'array') {
      if (!Array.isArray(field)) {
        pushTypeError(errors, keyPath, 'array', field)
      }
      continue
    }

    if (expected === 'object') {
      if (!isPlainObject(field)) {
        pushTypeError(errors, keyPath, 'object', field)
      }
      continue
    }

    if (typeof field !== expected) {
      pushTypeError(errors, keyPath, expected, field)
    }
  }

  return errors
}
