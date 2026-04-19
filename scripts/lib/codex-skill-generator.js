// Codex SKILL.md generator
//
// Codex supports built-in slash commands in the CLI and IDE extension, but
// reusable project workflows are documented and discovered through skills.
// This module transforms the Claude SKILL.md into a Codex-compatible version
// with embedded skill operations and Codex-specific orchestration guidance.

import fs from 'fs'
import path from 'path'

const COMMAND_ALIAS_BY_INTERNAL_NAME = Object.freeze({
  update: 'refresh',
})

const DEFAULT_FLAG_DESCRIPTIONS = Object.freeze({
  'enrichment-file': 'Read architect-generated graph JSON from this file.',
  'force-refresh': 'Ignore the cached graph and rebuild from a fresh snapshot.',
  instructions: 'Pass user refinement instructions into the scoped architect prompt.',
  'keep-mode': 'Keep the current presentation mode after the command finishes.',
  lock: 'Lock graph input during the presentation step.',
  lockInput: 'Lock graph input during the presentation step.',
  'map-id': 'Override the scoped map id.',
  mode: 'Set or override the presentation mode.',
  'no-activate': 'Create or refresh the map without switching the active map.',
  'no-render': 'Update files without pushing the graph into the live app.',
  'open-browser': 'Open the bundled app in a browser after the command finishes.',
  'scope-json': 'Pass the scoped-map payload copied from the UI.',
  'start-app': 'Start the bundled app server if it is not already running.',
  'stdio-mcp': 'Force stdio MCP transport for this command.',
  step: 'Set the step label shown in the presentation caption.',
  title: 'Set the title shown in the presentation caption.',
  explain: 'Set the explanation text shown in the presentation caption.',
  zoom: 'Set the viewport zoom level.',
})

const PUBLIC_OPERATION_BLOCK = `Available operations:

- \`setup-claudemap\`: build or rebuild the map for the current repository
- \`open-claudemap\`: reopen the existing UI without rebuilding
- \`create-map\`: create or refresh a scoped subsystem map from the current root graph
- \`refresh\`: update the graph after code changes
- \`explain\`: run a guided walkthrough through the live map
- \`show\`: direct the live map for highlights, focus, presentation, and flows`

const SLASH_COMMAND_NAMES = [
  'setup-claudemap',
  'open-claudemap',
  'create-map',
  'refresh',
  'explain',
  'show',
]

const DEFAULT_CODEX_SKILL_NAME = 'codexmap-runtime'

function normalizeCodexSkillOptions(options = {}) {
  const skillName = options.skillName || DEFAULT_CODEX_SKILL_NAME
  const skillRootRel = options.skillRootRel || `.agents/skills/${skillName}`

  return {
    skillName,
    skillMention: options.skillMention || `$${skillName}`,
    skillRootRel,
  }
}

/**
 * Parse YAML-style frontmatter from markdown.
 *
 * @param {string} content - Markdown content
 * @returns {{ frontmatter: string, body: string }}
 */
function parseFrontmatter(content) {
  // Accept both LF and CRLF line endings so the generator works on
  // Windows checkouts where source .md files carry \r\n.
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!match) {
    return { frontmatter: '', body: content }
  }
  return {
    frontmatter: match[1],
    body: content.slice(match[0].length),
  }
}

function commandDisplayName(descriptor) {
  return COMMAND_ALIAS_BY_INTERNAL_NAME[descriptor.name] || descriptor.slashName || descriptor.name
}

function flagDescription(flag) {
  return flag.description || DEFAULT_FLAG_DESCRIPTIONS[flag.name] || 'See the command help for details.'
}

function formatPositionalUsage(positional) {
  if (!positional?.name) {
    return ''
  }

  const wrappedName = positional.required ? `<${positional.name}>` : `[${positional.name}]`
  return positional.rest ? `${wrappedName}...` : wrappedName
}

function renderFlagSection(lines, flags) {
  if (!flags || flags.length === 0) {
    return
  }

  lines.push('**Flags:**')
  for (const flag of flags) {
    const typeStr = flag.type ? ` (${flag.type})` : ''
    lines.push(`- \`--${flag.name}\`${typeStr}: ${flagDescription(flag)}`)
  }
  lines.push('')
}

function renderActionSection(lines, descriptor, commandName) {
  if (!descriptor.actions || descriptor.actions.length === 0) {
    return
  }

  lines.push('**Actions:**')
  for (const action of descriptor.actions) {
    const usageHint = formatPositionalUsage(action.positional)
    const usageSuffix = usageHint ? ` ${usageHint}` : ''
    lines.push(`- \`${commandName} ${action.name}${usageSuffix}\`: ${action.summary || 'No description.'}`)
  }
  lines.push('')
}

/**
 * Generate a command documentation section from a descriptor.
 *
 * @param {Object} descriptor - Command descriptor
 * @returns {string} Markdown section for the command
 */
function renderCommandSection(descriptor) {
  const displayName = commandDisplayName(descriptor)
  const lines = []
  lines.push(`### ${displayName}`)
  lines.push('')
  lines.push(descriptor.summary || 'No description.')
  lines.push('')

  if (descriptor.argumentHint) {
    lines.push(`**Usage:** \`${displayName} ${descriptor.argumentHint}\``)
    lines.push('')
  } else {
    const positionalUsage = formatPositionalUsage(descriptor.positional)
    if (positionalUsage) {
      lines.push(`**Usage:** \`${displayName} ${positionalUsage}\``)
      lines.push('')
    }
  }

  renderActionSection(lines, descriptor, displayName)
  renderFlagSection(lines, descriptor.globalFlags || descriptor.flags)

  return lines.join('\n')
}

function transformSkillFrontmatter(frontmatter, options = {}) {
  const { skillName } = normalizeCodexSkillOptions(options)

  return frontmatter
    .replace(/^name:\s*claudemap-runtime\s*$/m, `name: ${skillName}`)
    .replace(
      /Prefer the public commands in \.claude\/commands for normal use\./,
      'Prefer the embedded Available Commands section for normal use.',
    )
}

function replaceSlashCommands(text) {
  let transformed = text
  for (const commandName of SLASH_COMMAND_NAMES) {
    const commandPattern = new RegExp(`(?<![\\w.-])/${commandName}\\b`, 'g')
    transformed = transformed.replace(commandPattern, commandName)
  }
  return transformed
}

/**
 * Generate Codex-specific orchestration instructions.
 *
 * @returns {string} Codex orchestration instructions
 */
function generateCodexOrchestration(options = {}) {
  const { skillRootRel } = normalizeCodexSkillOptions(options)

  return `
## Subagent Invocation (Codex)

Any step in this skill that references \`claudemap-architect\` is a hard requirement to produce architect-quality enrichment JSON. Do NOT fall back to a heuristic graph built from the snapshot's folder structure - that pollutes the cache and gives the user a flat map.

There are two valid ways to produce that JSON in Codex. Pick one per step, based on the **snapshot size gate** defined below.

### Snapshot size gate

Read \`totalFiles\` and \`totalLines\` from the snapshot JSON before deciding.

- **Small repo fast path** - snapshot has \`totalFiles <= 50\` AND \`totalLines <= 6000\`:
  You MAY generate the graph inline yourself, acting as the architect. Follow the enrichment prompt and the JSON schema contract strictly. This avoids a full subagent round-trip, which in Codex often dominates wall time on tiny repos.
- **Larger repo** - snapshot exceeds either threshold:
  You MUST invoke the \`claudemap-architect\` custom agent by name. Do NOT generate the graph inline. The larger the repo, the more architect reasoning buys you over an inline pass, and inline passes are much more likely to omit files or flatten groupings at that size.
- **Scoped \`create-map\` passes**: always invoke the architect, regardless of size. The scoped prompt expects richer internal breakdowns that the inline path typically underfills.

Whichever path you pick, the output must be a single JSON object that conforms to the enrichment schema - no prose, no markdown fences, no commentary.

### Inline path (small repos)

1. Load the snapshot JSON, the enrichment prompt, and the graph schema contract from the paths the step specifies.
2. Produce the JSON directly. Hold yourself to the same rules the architect follows: cover every file node, prefer nested systems over sibling sprawl, keep summaries within the char budgets, only emit function nodes for navigation anchors.
3. Write the JSON to the tmp path the step specifies, then invoke the matching command with \`--enrichment-file\`.

### Subagent path (larger repos, scoped passes)

1. Invoke the \`claudemap-architect\` custom agent by name.
2. Pass it the full repository snapshot JSON and any prompt text or schema text the step specifies. For refinement or scoped passes, include the prior graph and the user's instructions.
3. Treat the final message as graph JSON only. If the architect emitted prose, markdown fences, or commentary, strip them; if the JSON is unparseable, re-run the architect rather than hand-editing.
4. Write the JSON to the tmp path the step specifies, then invoke the matching command with \`--enrichment-file\`.

Heuristic command-level fallbacks (e.g. \`buildScopedGraphFromRoot\`) only run when the architect pass fails AND the step explicitly documents a fallback. They are never the first choice, and you must warn the user the result will be a plain filter view.

## Scratch and Temporary Files

All scratch files this skill writes - snapshots, enrichment payloads, intermediate graphs - must live under the skill's own \`tmp/\` directory, which for Codex resolves to \`${skillRootRel}/tmp/\` inside the target repo. The commands already build paths that way; do not redirect them elsewhere.

Codex's default sandbox treats \`.agents/\`, \`.codex/\`, and \`.claude/\` as configuration-owned and blocks writes on the first pass. When that happens, approve the elevated write for the skill's \`tmp/\` subdirectory and continue. Do NOT:

- redirect scratch output to the target repo's top-level directory (pollutes the project),
- write inside \`.codex/\` or \`.claude/\` themselves (never the right location for this skill),
- assume the block is permanent and fall back to an inline-only path that skips writing \`claudemap-enrichment.json\` (setup-claudemap needs that file to exist and pass \`--enrichment-file\`).

## Self-Location

The skill installs with a sibling \`.claudemap-config.json\` file inside its own directory (e.g. \`${skillRootRel}/.claudemap-config.json\`). The runtime walks upward from each command entrypoint to find that config and resolves the skill root from it - you do not need to set an environment variable, and the config file is NOT at the repo root.

When a step references a path like \`<skill-dir>/skill/commands/...\`, resolve it through this config rather than guessing. If a command fails to locate the skill directory, that is the config to check, not \`$CLAUDE_SKILL_DIR\`.
`
}

function generateCodexWorkflow(options = {}) {
  const { skillMention } = normalizeCodexSkillOptions(options)

  return `
## Codex Workflow

- Explicitly invoke this skill with \`/skills\` or by mentioning \`${skillMention}\` when you need to force its use.
- Use \`setup-claudemap\` to build the root map.
- Use \`refresh\` after edits and \`create-map\` for scoped subsystem maps.
- Use \`open-claudemap\` only to reopen the UI without rebuilding the graph.
- For any graph-building step, produce architect JSON first, write it to \`\${SKILL_DIR}/tmp/claudemap-enrichment.json\`, then run the matching command with \`--enrichment-file\`.
- Use \`show\` and \`explain\` against the currently active live graph. They are presentation tools, not rebuild paths.
`
}

/**
 * Transform Claude SKILL.md references for Codex compatibility.
 *
 * @param {string} body - Original SKILL.md body
 * @returns {string} Transformed body for Codex
 */
function transformSkillBody(body) {
  let transformed = body.replace(/\$\{CLAUDE_SKILL_DIR\}/g, '${SKILL_DIR}')

  transformed = transformed.replace(
    /Public commands:\r?\n\r?\n(?:- .+\r?\n)+/,
    `${PUBLIC_OPERATION_BLOCK}\n\n`,
  )

  transformed = transformed.replace(/@claudemap-architect/g, 'claudemap-architect')

  transformed = transformed.replace(/\.claude\/skills\//g, '.agents/skills/')
  transformed = transformed.replace(/\.claude\/agents\//g, '.codex/agents/')
  transformed = transformed.replace(
    /\.claude\/commands\/([a-z-]+)\.md/g,
    'the embedded $1 command docs in this skill',
  )
  transformed = transformed.replace(/\.claude\/commands\//g, 'the embedded command docs in this skill')
  transformed = transformed.replace(
    /`the embedded ([a-z-]+) command docs in this skill`/g,
    'the embedded `$1` command docs in this skill',
  )
  transformed = replaceSlashCommands(transformed)
  transformed = transformed.replace(
    /the `\/?([a-z-]+)` command shipped in the embedded `\1` command docs in this skill/g,
    'the embedded `$1` command docs in this skill',
  )

  return transformed
}

function applyCodexSkillIdentity(text, options = {}) {
  const { skillName, skillMention, skillRootRel } = normalizeCodexSkillOptions(options)

  return text
    .replace(/\$claudemap-runtime\b/g, skillMention)
    .replace(/\.agents\/skills\/claudemap-runtime\b/g, skillRootRel)
    .replace(/\bclaudemap-runtime skill\b/g, `${skillName} skill`)
}

/**
 * Swap the display-name prose "ClaudeMap" -> "CodexMap" and the bare
 * brand word "Claude" -> "Codex" across a block of text. This base
 * prose pass intentionally leaves most lowercase identifiers and path
 * literals alone; artifact-specific handlers remap the assistant-visible
 * skill identity and the few lowercase graph-source strings serialized by
 * Codex.
 */
function rebrandClaudeToCodex(text) {
  return text
    .replace(/\bClaudeMap\b/g, 'CodexMap')
    .replace(/\bClaude\b/g, 'Codex')
}

function rebrandCodexGraphSourceContract(text) {
  return text
    .replace(/(CLAUDE:\s*)'[^']+'/g, "$1'codex'")
    .replace(/(CLAUDE_SCOPED:\s*)'[^']+'/g, "$1'codex-scoped'")
}

/**
 * Tier 1 deep-rebrand whitelist. Paths are POSIX, relative to the
 * artifact root, and parameterized by the assistant's skill root and
 * agent directory.
 */
function buildCodexRebrandWhitelist(skillRootRel, architectAgentRel) {
  return [
    `${skillRootRel}/SKILL.md`,
    `${skillRootRel}/NAVIGATION.md`,
    architectAgentRel,
    `${skillRootRel}/skill/lib/contracts/graph-sources.js`,
    `${skillRootRel}/app/src/contracts/graph-sources.js`,
    `${skillRootRel}/skill/commands/refresh.js`,
    `${skillRootRel}/contracts/claudemap-seed-map.json`,
    `${skillRootRel}/app/public/graph/claudemap-runtime.json`,
  ]
}

/**
 * Apply `rebrandClaudeToCodex` to each file in the whitelist.
 */
function applyCodexDeepRebrand(artifactRoot, relativePaths) {
  for (const rel of relativePaths) {
    const absolutePath = path.join(artifactRoot, rel)
    if (!fs.existsSync(absolutePath)) continue
    const original = fs.readFileSync(absolutePath, 'utf8')
    let transformed = rebrandClaudeToCodex(original)
    if (rel.endsWith('/SKILL.md')) {
      transformed = transformed.replace(/\bclaude-scoped\b/g, 'codex-scoped')
    }
    if (rel.endsWith('/graph-sources.js')) {
      transformed = rebrandCodexGraphSourceContract(transformed)
    }
    if (transformed !== original) {
      fs.writeFileSync(absolutePath, transformed)
    }
  }
}

/**
 * Generate a complete Codex SKILL.md from Claude SKILL.md and command descriptors.
 *
 * @param {string} claudeSkillPath - Path to Claude SKILL.md
 * @param {Array<Object>} commandDescriptors - Array of command descriptors
 * @returns {string} Complete Codex SKILL.md content
 */
function generateCodexSkill(claudeSkillPath, commandDescriptors, options = {}) {
  const claudeContent = fs.readFileSync(claudeSkillPath, 'utf8')
  const { frontmatter, body } = parseFrontmatter(claudeContent)
  const skillOptions = normalizeCodexSkillOptions(options)

  const transformedFrontmatter = transformSkillFrontmatter(frontmatter, skillOptions)
  const transformedBody = applyCodexSkillIdentity(transformSkillBody(body), skillOptions)

  const commandSections = commandDescriptors
    .filter((descriptor) => !descriptor.noSlashTemplate)
    .map(renderCommandSection)
    .join('\n')

  const lines = []
  lines.push('---')
  lines.push(transformedFrontmatter)
  lines.push('---')
  lines.push('')
  lines.push(transformedBody)
  lines.push(generateCodexWorkflow(skillOptions))
  lines.push(generateCodexOrchestration(skillOptions))
  lines.push('## Available Commands')
  lines.push('')
  lines.push('Codex has built-in slash commands, but this skill exposes the following operations through the skills system:')
  lines.push('')
  lines.push(commandSections)

  return rebrandClaudeToCodex(lines.join('\n'))
}

/**
 * Write Codex SKILL.md to the artifact.
 *
 * @param {string} claudeSkillPath - Path to source Claude SKILL.md
 * @param {string} outputPath - Path to write Codex SKILL.md
 * @param {Array<Object>} commandDescriptors - Command descriptors
 */
function writeCodexSkill(claudeSkillPath, outputPath, commandDescriptors, options = {}) {
  const content = generateCodexSkill(claudeSkillPath, commandDescriptors, options)

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, content)
}

export {
  generateCodexSkill,
  writeCodexSkill,
  renderCommandSection,
  transformSkillBody,
  applyCodexSkillIdentity,
  generateCodexOrchestration,
  rebrandClaudeToCodex,
  buildCodexRebrandWhitelist,
  applyCodexDeepRebrand,
}
