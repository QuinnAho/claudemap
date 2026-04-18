// Codex SKILL.md generator
//
// Codex deprecated slash commands, so we fold command documentation into
// the main SKILL.md file. This module transforms the Claude SKILL.md into
// a Codex-compatible version with embedded commands and explicit subagent
// spawn instructions.

import fs from 'fs'
import path from 'path'

/**
 * Parse YAML-style frontmatter from markdown.
 *
 * @param {string} content - Markdown content
 * @returns {{ frontmatter: string, body: string }}
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) {
    return { frontmatter: '', body: content }
  }
  return {
    frontmatter: match[1],
    body: content.slice(match[0].length),
  }
}

/**
 * Generate a command documentation section from a descriptor.
 *
 * @param {Object} descriptor - Command descriptor
 * @returns {string} Markdown section for the command
 */
function renderCommandSection(descriptor) {
  const lines = []
  lines.push(`### ${descriptor.name}`)
  lines.push('')
  lines.push(descriptor.summary || 'No description.')
  lines.push('')

  if (descriptor.argumentHint) {
    lines.push(`**Usage:** \`${descriptor.name} ${descriptor.argumentHint}\``)
    lines.push('')
  }

  if (descriptor.flags && descriptor.flags.length > 0) {
    lines.push('**Flags:**')
    for (const flag of descriptor.flags) {
      const typeStr = flag.type ? ` (${flag.type})` : ''
      lines.push(`- \`--${flag.name}\`${typeStr}: ${flag.description || 'No description'}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Generate Codex-specific orchestration instructions.
 * Replaces @claudemap-architect with explicit spawn syntax.
 *
 * @returns {string} Codex orchestration instructions
 */
function generateCodexOrchestration() {
  return `
## Subagent Invocation (Codex)

In Codex, subagents must be spawned explicitly. Replace any \`@claudemap-architect\` references with:

\`\`\`
Spawn the claudemap-architect subagent with:
- Input: The repository snapshot JSON
- Instructions: The enrichment prompt plus any user refinement requests
- Output format: Valid graph JSON only, no prose or markdown fences
\`\`\`

Wait for the subagent task to complete before proceeding. Save the returned JSON to a temporary file, then run the appropriate command with \`--enrichment-file\`.

## Self-Location

Codex skills locate themselves via the \`.claudemap-config.json\` file written by the installer. The skill directory path is stored in this config file.

When referencing skill paths, use the skill directory from the config rather than relying on environment variables.
`
}

/**
 * Transform Claude SKILL.md references for Codex compatibility.
 *
 * @param {string} body - Original SKILL.md body
 * @returns {string} Transformed body for Codex
 */
function transformSkillBody(body) {
  // Replace ${CLAUDE_SKILL_DIR} with Codex-friendly language
  let transformed = body.replace(
    /\$\{CLAUDE_SKILL_DIR\}/g,
    '${SKILL_DIR}' // Generic reference, config-based resolution
  )

  // Replace @claudemap-architect references with explicit spawn instructions
  transformed = transformed.replace(
    /@claudemap-architect/g,
    'the `claudemap-architect` subagent (see Subagent Invocation section below)'
  )

  // Replace .claude/ paths with .codex/ or .agents/ as appropriate
  transformed = transformed.replace(
    /\.claude\/skills\//g,
    '.agents/skills/'
  )
  transformed = transformed.replace(
    /\.claude\/agents\//g,
    '.codex/agents/'
  )
  transformed = transformed.replace(
    /\.claude\/commands\//g,
    '(commands embedded in this skill)/'
  )

  return transformed
}

/**
 * Generate a complete Codex SKILL.md from Claude SKILL.md and command descriptors.
 *
 * @param {string} claudeSkillPath - Path to Claude SKILL.md
 * @param {Array<Object>} commandDescriptors - Array of command descriptors
 * @returns {string} Complete Codex SKILL.md content
 */
function generateCodexSkill(claudeSkillPath, commandDescriptors) {
  const claudeContent = fs.readFileSync(claudeSkillPath, 'utf8')
  const { frontmatter, body } = parseFrontmatter(claudeContent)

  // Transform the body for Codex compatibility
  const transformedBody = transformSkillBody(body)

  // Generate command documentation sections
  const commandSections = commandDescriptors
    .filter((d) => !d.noSlashTemplate)
    .map(renderCommandSection)
    .join('\n')

  // Assemble the Codex SKILL.md
  const lines = []

  // Frontmatter (unchanged)
  lines.push('---')
  lines.push(frontmatter)
  lines.push('---')
  lines.push('')

  // Transformed body
  lines.push(transformedBody)

  // Codex-specific orchestration
  lines.push(generateCodexOrchestration())

  // Embedded command documentation
  lines.push('## Available Commands')
  lines.push('')
  lines.push('Since Codex does not use slash commands, the following commands are available as skill operations:')
  lines.push('')
  lines.push(commandSections)

  return lines.join('\n')
}

/**
 * Write Codex SKILL.md to the artifact.
 *
 * @param {string} claudeSkillPath - Path to source Claude SKILL.md
 * @param {string} outputPath - Path to write Codex SKILL.md
 * @param {Array<Object>} commandDescriptors - Command descriptors
 */
function writeCodexSkill(claudeSkillPath, outputPath, commandDescriptors) {
  const content = generateCodexSkill(claudeSkillPath, commandDescriptors)

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, content)
}

export {
  generateCodexSkill,
  writeCodexSkill,
  renderCommandSection,
  transformSkillBody,
  generateCodexOrchestration,
}
