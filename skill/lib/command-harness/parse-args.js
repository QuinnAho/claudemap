// Small, explicit argv parser for command descriptors.
//
// It supports exactly what Phase 2 descriptors need: booleans, strings,
// numbers, enums, a single rest-positional, and --help. Unknown flags or
// missing required values produce ClaudeMapError('ARG_VALIDATION_FAILED')
// rather than leaking process.argv past the harness.
//
// The output is a plain object with camelCased keys ('--keep-mode' becomes
// 'keepMode', '--stdio-mcp' becomes 'stdioMcp'). Boolean flags default to
// false when omitted, so handlers can read args.keepMode without a ternary.

import { ClaudeMapError } from '../contracts/errors.js'

export function parseArgs(argv, spec) {
  const normalizedSpec = normalizeSpec(spec)
  const result = initializeDefaults(normalizedSpec)
  const positionalValues = []

  let cursor = 0

  while (cursor < argv.length) {
    const token = argv[cursor]

    if (token === '--help' || token === '-h') {
      result.help = true
      cursor += 1
      continue
    }

    if (token === '--') {
      positionalValues.push(...argv.slice(cursor + 1))
      break
    }

    if (token.startsWith('--no-')) {
      const flagName = token.slice('--no-'.length)
      const flagSpec = normalizedSpec.flagsByName.get(flagName)

      if (!flagSpec || flagSpec.type !== 'boolean') {
        throw argError(`Unknown flag: ${token}`)
      }

      result[flagSpec.camelName] = false
      cursor += 1
      continue
    }

    if (token.startsWith('--')) {
      const flagName = token.slice(2)
      const flagSpec = normalizedSpec.flagsByName.get(flagName)

      if (!flagSpec) {
        throw argError(`Unknown flag: ${token}`)
      }

      if (flagSpec.type === 'boolean') {
        result[flagSpec.camelName] = true
        cursor += 1
        continue
      }

      const rawValue = argv[cursor + 1]

      if (rawValue === undefined || rawValue.startsWith('--')) {
        throw argError(`Missing value for ${token}`)
      }

      result[flagSpec.camelName] = coerceValue(flagSpec, rawValue, token)
      cursor += 2
      continue
    }

    positionalValues.push(token)
    cursor += 1
  }

  assignPositional(result, normalizedSpec, positionalValues)

  if (result.help) {
    return { parsed: result, help: true }
  }

  return { parsed: result, help: false }
}

function normalizeSpec(spec) {
  const flags = Array.isArray(spec?.flags) ? spec.flags : []
  const flagsByName = new Map()
  const flagsByCamel = new Map()

  for (const flagSpec of flags) {
    const camelName = toCamel(flagSpec.name)
    const normalized = { ...flagSpec, camelName }
    flagsByName.set(flagSpec.name, normalized)
    flagsByCamel.set(camelName, normalized)
  }

  return {
    flags,
    flagsByName,
    flagsByCamel,
    positional: spec?.positional || null,
  }
}

function initializeDefaults(normalizedSpec) {
  const defaults = { help: false }

  for (const flagSpec of normalizedSpec.flags) {
    if (flagSpec.type === 'boolean') {
      defaults[flagSpec.camelName] = false
    } else {
      defaults[flagSpec.camelName] = undefined
    }
  }

  if (normalizedSpec.positional) {
    defaults[toCamel(normalizedSpec.positional.name)] = normalizedSpec.positional.rest ? '' : undefined
  }

  return defaults
}

function coerceValue(flagSpec, rawValue, token) {
  if (flagSpec.type === 'number') {
    const parsed = Number(rawValue)

    if (!Number.isFinite(parsed)) {
      throw argError(`Invalid number for ${token}: ${rawValue}`)
    }

    return parsed
  }

  if (flagSpec.type === 'enum') {
    const allowed = Array.isArray(flagSpec.values) ? flagSpec.values : []

    if (!allowed.includes(rawValue)) {
      throw argError(`Invalid value for ${token}: ${rawValue}. Allowed: ${allowed.join(', ')}`)
    }

    return rawValue
  }

  return rawValue
}

function assignPositional(result, normalizedSpec, positionalValues) {
  const positionalSpec = normalizedSpec.positional

  if (!positionalSpec) {
    if (positionalValues.length > 0) {
      // Extra positionals without a spec usually means the descriptor owner
      // expects to read them off result._positional. Expose for that case.
      result._positional = positionalValues
    }

    return
  }

  const camelName = toCamel(positionalSpec.name)

  if (positionalSpec.rest) {
    result[camelName] = positionalValues.join(' ').trim()
    result._positional = positionalValues
    return
  }

  if (positionalValues.length === 0) {
    if (positionalSpec.required) {
      throw argError(`Missing positional argument: <${positionalSpec.name}>`)
    }

    result[camelName] = undefined
    return
  }

  result[camelName] = positionalValues[0]
  result._positional = positionalValues
}

function toCamel(value) {
  return String(value).replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase())
}

function argError(message) {
  return new ClaudeMapError('ARG_VALIDATION_FAILED', message)
}
