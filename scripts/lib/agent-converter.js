// Agent format converter: Claude (.md) → Codex (.toml)
//
// Claude Code agents are defined as Markdown files with YAML frontmatter.
// Codex agents are defined as TOML files.
// This module converts between the two formats.

import fs from 'fs'
import path from 'path'

/**
 * Parse YAML-style frontmatter from a markdown file.
 * Handles simple key: value pairs (no nested objects).
 *
 * @param {string} content - Markdown content with frontmatter
 * @returns {{ frontmatter: Object, body: string }}
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const frontmatterText = match[1]
  const body = content.slice(match[0].length).trim()
  const frontmatter = {}

  for (const line of frontmatterText.split(/\r?\n/)) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value = line.slice(colonIndex + 1).trim()

    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    frontmatter[key] = value
  }

  return { frontmatter, body }
}

/**
 * Escape a string for TOML multi-line literal string.
 *
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeTomlMultiline(text) {
  // Multi-line literal strings in TOML use ''' and don't need escaping
  // except for sequences of 3+ quotes
  return text.replace(/'''/g, "'''\\'''")
}

/**
 * Convert Claude agent .md to Codex agent .toml format.
 *
 * @param {string} mdContent - Content of the Claude agent .md file
 * @returns {string} TOML content for Codex agent
 */
function convertAgentMdToToml(mdContent) {
  const { frontmatter, body } = parseFrontmatter(mdContent)

  const lines = []

  // Required fields
  if (frontmatter.name) {
    lines.push(`name = "${frontmatter.name}"`)
  }
  if (frontmatter.description) {
    // Escape quotes in description
    const escapedDesc = frontmatter.description.replace(/"/g, '\\"')
    lines.push(`description = "${escapedDesc}"`)
  }

  // Optional fields with type mapping
  if (frontmatter.tools) {
    // tools is comma-separated in Claude, array in Codex
    const tools = frontmatter.tools.split(',').map((t) => t.trim())
    lines.push(`tools = [${tools.map((t) => `"${t}"`).join(', ')}]`)
  }

  if (frontmatter.model) {
    // Map Claude model names to Codex equivalents
    const modelMap = {
      sonnet: 'gpt-4o', // or leave as-is if Codex supports same names
      opus: 'gpt-4',
      haiku: 'gpt-4o-mini',
    }
    const codexModel = modelMap[frontmatter.model] || frontmatter.model
    lines.push(`model = "${codexModel}"`)
  }

  if (frontmatter.effort) {
    // Map effort to model_reasoning_effort
    lines.push(`model_reasoning_effort = "${frontmatter.effort}"`)
  }

  if (frontmatter.maxTurns) {
    lines.push(`max_turns = ${frontmatter.maxTurns}`)
  }

  if (frontmatter.color) {
    lines.push(`color = "${frontmatter.color}"`)
  }

  // Developer instructions (the body of the markdown)
  if (body) {
    lines.push('')
    lines.push('developer_instructions = """')
    lines.push(escapeTomlMultiline(body))
    lines.push('"""')
  }

  return lines.join('\n') + '\n'
}

/**
 * Convert a Claude agent .md file to Codex agent .toml file.
 *
 * @param {string} mdPath - Path to source .md file
 * @param {string} tomlPath - Path to output .toml file
 */
function convertAgentFile(mdPath, tomlPath) {
  const mdContent = fs.readFileSync(mdPath, 'utf8')
  const tomlContent = convertAgentMdToToml(mdContent)

  fs.mkdirSync(path.dirname(tomlPath), { recursive: true })
  fs.writeFileSync(tomlPath, tomlContent)
}

export {
  parseFrontmatter,
  convertAgentMdToToml,
  convertAgentFile,
}
