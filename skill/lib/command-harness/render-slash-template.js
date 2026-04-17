import { PRESENTATION_MODE_LIST } from '../contracts/presentation.js'

// Renders slash-command markdown templates from command descriptors.
// Replaces hand-authored markdown blobs in package-claudemap-skill.js.

export function renderSlashTemplate(descriptor) {
  const sections = []

  // Front matter
  sections.push('---')
  sections.push(`description: ${descriptor.summary}`)

  if (descriptor.argumentHint) {
    sections.push(`argument-hint: '${descriptor.argumentHint}'`)
  }

  if (descriptor.disableModelInvocation) {
    sections.push('disable-model-invocation: true')
  }

  sections.push('---')
  sections.push('')

  // Usage section
  sections.push('## Usage')
  sections.push('')

  if (descriptor.actions) {
    // Dispatcher command
    for (const action of descriptor.actions) {
      const flagsSummary = renderFlagsSummary(action.flags || [])
      const positionalHint = action.positional?.name || ''
      sections.push(`${descriptor.name} ${action.name} ${positionalHint} ${flagsSummary}`.trim())
    }
  } else {
    // Single-action command
    const flagsSummary = renderFlagsSummary(descriptor.flags || [])
    const positionalHint = descriptor.positional?.name
      ? `[${descriptor.positional.name}]`
      : ''
    sections.push(`${descriptor.name} ${positionalHint} ${flagsSummary}`.trim())
  }

  sections.push('')

  // Flags section
  if (descriptor.actions) {
    // Collect all unique flags across actions
    const allFlags = new Map()

    for (const action of descriptor.actions) {
      for (const flag of action.flags || []) {
        if (!allFlags.has(flag.name)) {
          allFlags.set(flag.name, flag)
        }
      }
    }

    if (allFlags.size > 0) {
      sections.push('## Flags')
      sections.push('')

      for (const flag of allFlags.values()) {
        sections.push(renderFlagLine(flag))
      }

      sections.push('')
    }
  } else if (descriptor.flags && descriptor.flags.length > 0) {
    sections.push('## Flags')
    sections.push('')

    for (const flag of descriptor.flags) {
      sections.push(renderFlagLine(flag))
    }

    sections.push('')
  }

  // Examples section (if provided)
  if (descriptor.examples && descriptor.examples.length > 0) {
    sections.push('## Examples')
    sections.push('')

    for (const example of descriptor.examples) {
      sections.push(example)
    }

    sections.push('')
  }

  // Body (if provided)
  if (descriptor.body) {
    sections.push(descriptor.body)
    sections.push('')
  }

  return sections.join('\n')
}

function renderFlagsSummary(flags) {
  if (flags.length === 0) {
    return ''
  }

  return flags.map(flag => `[--${flag.name}${flag.type !== 'boolean' ? ' <value>' : ''}]`).join(' ')
}

function renderFlagLine(flag) {
  const typeHint = flag.type === 'enum'
    ? ` (one of: ${flag.values.join(', ')})`
    : flag.type === 'number'
    ? ' (number)'
    : flag.type === 'boolean'
    ? ''
    : ' (string)'

  const description = flag.description || ''

  return `- \`--${flag.name}\`${typeHint}${description ? ': ' + description : ''}`
}
