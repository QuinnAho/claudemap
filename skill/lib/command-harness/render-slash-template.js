// Renders slash-command markdown templates from command descriptors.
// Replaces hand-authored markdown blobs in package-claudemap-skill.js.

export function slashFileName(descriptor) {
  const base = descriptor.slashName || descriptor.name
  return `${base}.md`
}

export function renderSlashTemplate(descriptor) {
  const lines = []

  lines.push('---')
  lines.push(`description: ${descriptor.summary}`)

  if (descriptor.argumentHint) {
    lines.push(`argument-hint: '${descriptor.argumentHint}'`)
  }

  if (descriptor.disableModelInvocation) {
    lines.push('disable-model-invocation: true')
  }

  lines.push('---')
  lines.push('')

  if (descriptor.body) {
    lines.push(descriptor.body)
    lines.push('')
  } else {
    lines.push('## Usage')
    lines.push('')

    if (descriptor.actions) {
      for (const action of descriptor.actions) {
        const flagsSummary = renderFlagsSummary(action.flags || [])
        const positionalHint = action.positional?.name || ''
        lines.push(`${descriptor.name} ${action.name} ${positionalHint} ${flagsSummary}`.trim())
      }
    } else {
      const flagsSummary = renderFlagsSummary(descriptor.flags || [])
      const positionalHint = descriptor.positional?.name
        ? `[${descriptor.positional.name}]`
        : ''
      lines.push(`${descriptor.name} ${positionalHint} ${flagsSummary}`.trim())
    }

    lines.push('')
  }

  const flags = collectFlags(descriptor)
  if (flags.length > 0) {
    lines.push('## Flags')
    lines.push('')
    for (const flag of flags) {
      lines.push(renderFlagLine(flag))
    }
    lines.push('')
  }

  return lines.join('\n')
}

function collectFlags(descriptor) {
  if (descriptor.actions) {
    const seen = new Map()
    for (const action of descriptor.actions) {
      for (const flag of action.flags || []) {
        if (!seen.has(flag.name)) seen.set(flag.name, flag)
      }
    }
    return Array.from(seen.values())
  }
  return descriptor.flags || []
}

function renderFlagsSummary(flags) {
  if (flags.length === 0) return ''
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
