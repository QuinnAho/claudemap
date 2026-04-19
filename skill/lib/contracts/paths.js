// Canonical path constants for every ClaudeMap surface.
//
// Every file path that appears in more than one place lives here. Scripts,
// skill commands, skill lib, and the installer all import from this module.
// Do not re-declare these strings anywhere else.
//
// Names ending in *_REL are POSIX-relative (forward slashes, no leading slash);
// callers compose them with path.join against whichever root applies.

// ---------------------------------------------------------------------------
// Assistant Types
// ---------------------------------------------------------------------------
// ClaudeMap supports multiple AI coding assistants. Each has different
// conventions for where skills, agents, and config live.

export const ASSISTANT_TYPES = Object.freeze({
  CLAUDE: 'claude',
  CODEX: 'codex',
})

// Brand identifiers used by the app to pick palette + display name.
// The packaged index.html carries <html data-brand="..."> so the right
// brand is active before first paint. Kept here (not in the app's
// branding.js) because the packager must resolve a brand id from an
// assistant type at build time and both tiers need to agree.
export const BRAND_IDS = Object.freeze({
  CLAUDEMAP: 'claudemap',
  CODEXMAP: 'codexmap',
})

// Configuration for each assistant type.
// - rootDir: primary config/install record directory
// - skillsPath: where skills are discovered (may differ from rootDir!)
// - agentsPath: where agent definitions live
// - commandsPath: where repo-defined slash-command docs live
//   (null when the assistant has no repo-defined slash-command directory)
// - agentExt: file extension for agent definitions
export const ASSISTANT_CONFIGS = Object.freeze({
  [ASSISTANT_TYPES.CLAUDE]: {
    rootDir: '.claude',
    skillsPath: '.claude/skills',
    agentsPath: '.claude/agents',
    commandsPath: '.claude/commands',
    agentExt: '.md',
  },
  [ASSISTANT_TYPES.CODEX]: {
    // Codex uses TWO roots by design:
    // - .agents/skills/ is the hardcoded discovery path for skills
    // - .codex/ is for config, agents, and install records
    rootDir: '.codex',
    skillsPath: '.agents/skills',
    agentsPath: '.codex/agents',
    commandsPath: null, // Codex has no repo-defined slash-command directory
    agentExt: '.toml',
  },
})

// ---------------------------------------------------------------------------
// Legacy Constants (backwards compatibility)
// ---------------------------------------------------------------------------
// These exports are maintained for backwards compatibility. New code should
// use resolveAssistantPaths() for assistant-aware path resolution.

// Root directory Claude Code writes into, at the top of a target repo.
export const CLAUDE_ROOT_DIR = '.claude'

// Subdirectories of .claude/
export const SKILLS_SUBDIR = 'skills'
export const COMMANDS_SUBDIR = 'commands'
export const AGENTS_SUBDIR = 'agents'

// Assistant-visible skill directory names. Claude keeps the original name
// for backwards compatibility; Codex gets the CodexMap-branded skill name.
export const RUNTIME_SKILL_NAMES = Object.freeze({
  [ASSISTANT_TYPES.CLAUDE]: 'claudemap-runtime',
  [ASSISTANT_TYPES.CODEX]: 'codexmap-runtime',
})

// Migration-only assistant-visible names. New artifacts use
// RUNTIME_SKILL_NAMES; installers use these to clean up managed old roots.
export const LEGACY_RUNTIME_SKILL_NAMES = Object.freeze({
  [ASSISTANT_TYPES.CODEX]: Object.freeze(['claudemap-runtime']),
})

// Backwards-compatible default for older imports. This intentionally remains
// the Claude skill name; assistant-aware code should use resolveAssistantPaths().
export const RUNTIME_SKILL_NAME = RUNTIME_SKILL_NAMES[ASSISTANT_TYPES.CLAUDE]

// Composed paths relative to a target repo root.
export const SKILL_ROOT_REL = `${CLAUDE_ROOT_DIR}/${SKILLS_SUBDIR}/${RUNTIME_SKILL_NAME}`
export const COMMANDS_ROOT_REL = `${CLAUDE_ROOT_DIR}/${COMMANDS_SUBDIR}`
export const AGENTS_ROOT_REL = `${CLAUDE_ROOT_DIR}/${AGENTS_SUBDIR}`

// Runtime-detection suffix. isInstalledRuntimeRoot compares against this.
export const RUNTIME_INSTALLED_PATH_SUFFIX = `/${SKILL_ROOT_REL}`

// Graph directory and graph/state filenames.
export const GRAPH_DIR_NAME = 'graph'
export const RUNTIME_GRAPH_FILENAME = 'claudemap-runtime.json'
export const RUNTIME_STATE_FILENAME = 'claudemap-runtime-state.json'
export const RUNTIME_GRAPH_REL = `${GRAPH_DIR_NAME}/${RUNTIME_GRAPH_FILENAME}`
export const RUNTIME_STATE_REL = `${GRAPH_DIR_NAME}/${RUNTIME_STATE_FILENAME}`

// Root-level files in a target repo.
export const CACHE_FILENAME = 'claudemap-cache.json'
export const MAPS_MANIFEST_FILENAME = 'claudemap-maps.json'

// Installer artifact metadata (lives at .claude/ root after install).
export const ARTIFACT_MANIFEST_FILENAME = 'claudemap-artifact.json'
export const INSTALL_RECORD_FILENAME = 'claudemap-install.json'

// Agent definitions that ship with the skill.
export const ARCHITECT_AGENT_FILENAME = 'claudemap-architect.md'
export const ARCHITECT_AGENT_REL = `${AGENTS_ROOT_REL}/${ARCHITECT_AGENT_FILENAME}`

// Seed map shipped with the package. Relative to the repo root.
export const SEED_MAP_REL = 'contracts/claudemap-seed-map.json'

// Packaging artifact locations. Relative to the repo root.
export const PACKAGE_ARTIFACT_DIR_REL = 'artifacts/claudemap-skill'
export const NPM_BUNDLE_DIR_REL = '.npm-bundle'
export const NPM_BUNDLE_SUBDIR = 'claudemap'

// Identity for the packaged artifact on disk and in install records.
export const ARTIFACT_NAME = 'claudemap'

// Published CLI entry point. Relative to the repo root. bin/claudemap.js
// delegates to scripts/install-claudemap.js at runtime.
export const CLI_BIN_REL = 'bin/claudemap.js'

// Transactional install marker. Written under CLAUDE_ROOT_DIR when an
// install begins and removed on success. Its presence indicates a
// partial install; a subsequent install refuses to proceed until it is
// cleared (by completing, or manual deletion after the user verifies).
export const PARTIAL_INSTALL_MARKER_FILENAME = '.partial-install'

// Static-site output directory at the repo root.
export const DOCS_DIR_REL = 'docs'

// App public-graph location (inside the skill bundle).
export const APP_PUBLIC_GRAPH_REL = 'app/public/graph'
export const APP_PUBLIC_GRAPH_RUNTIME_REL = `${APP_PUBLIC_GRAPH_REL}/${RUNTIME_GRAPH_FILENAME}`
export const APP_PUBLIC_GRAPH_STATE_REL = `${APP_PUBLIC_GRAPH_REL}/${RUNTIME_STATE_FILENAME}`

// Prompts that the skill ships.
export const PROMPTS_DIR_REL = 'skill/prompts'
export const ENRICHMENT_PROMPT_FILENAME = 'enrichment.txt'
export const SCOPED_ENRICHMENT_PROMPT_FILENAME = 'scoped-enrichment.txt'

// ---------------------------------------------------------------------------
// Assistant-Aware Path Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve all paths for a specific assistant type.
 *
 * @param {string} assistantType - One of ASSISTANT_TYPES values ('claude' | 'codex')
 * @returns {Object} Object containing all resolved paths for the assistant
 * @throws {Error} If assistantType is not recognized
 */
export function resolveAssistantPaths(assistantType) {
  const config = ASSISTANT_CONFIGS[assistantType]
  if (!config) {
    const validTypes = Object.values(ASSISTANT_TYPES).join(', ')
    throw new Error(`Unknown assistant type: ${assistantType}. Valid types: ${validTypes}`)
  }

  const skillName = RUNTIME_SKILL_NAMES[assistantType] || RUNTIME_SKILL_NAME
  const legacySkillNames = LEGACY_RUNTIME_SKILL_NAMES[assistantType] || Object.freeze([])
  const skillRootRel = `${config.skillsPath}/${skillName}`
  const legacySkillRootRels = legacySkillNames.map((legacySkillName) => (
    `${config.skillsPath}/${legacySkillName}`
  ))
  const agentBasename = assistantType === ASSISTANT_TYPES.CODEX
    ? ARCHITECT_AGENT_FILENAME.replace('.md', config.agentExt)
    : ARCHITECT_AGENT_FILENAME

  const brandId = assistantType === ASSISTANT_TYPES.CODEX
    ? BRAND_IDS.CODEXMAP
    : BRAND_IDS.CLAUDEMAP

  return {
    // Base config
    assistantType,
    brandId,
    rootDir: config.rootDir,
    skillsPath: config.skillsPath,
    agentsPath: config.agentsPath,
    commandsPath: config.commandsPath,
    agentExt: config.agentExt,

    // Composed skill paths
    skillName,
    skillMention: `$${skillName}`,
    skillRootRel,
    legacySkillRootRels,
    runtimeGraphRel: `${skillRootRel}/${APP_PUBLIC_GRAPH_REL}/${RUNTIME_GRAPH_FILENAME}`,
    runtimeStateRel: `${skillRootRel}/${APP_PUBLIC_GRAPH_REL}/${RUNTIME_STATE_FILENAME}`,

    // Agent paths
    architectAgentFilename: agentBasename,
    architectAgentRel: `${config.agentsPath}/${agentBasename}`,

    // Commands (Claude only)
    commandsRootRel: config.commandsPath,

    // Install/artifact metadata paths (always in rootDir)
    installRecordRel: `${config.rootDir}/${INSTALL_RECORD_FILENAME}`,
    artifactManifestRel: `${config.rootDir}/${ARTIFACT_MANIFEST_FILENAME}`,
    partialInstallMarkerRel: `${config.rootDir}/${PARTIAL_INSTALL_MARKER_FILENAME}`,

    // Self-location config (Codex only, written at install time)
    skillConfigRel: assistantType === ASSISTANT_TYPES.CODEX
      ? `${skillRootRel}/.claudemap-config.json`
      : null,

    // All managed paths for this assistant (for install record)
    getManagedPaths() {
      const paths = [
        skillRootRel,
        `${config.agentsPath}/${agentBasename}`,
        `${config.rootDir}/${INSTALL_RECORD_FILENAME}`,
        `${config.rootDir}/${ARTIFACT_MANIFEST_FILENAME}`,
      ]
      if (config.commandsPath) {
        paths.push(config.commandsPath)
      }
      return paths
    },
  }
}

/**
 * Auto-detect assistant type from environment or target directory.
 *
 * Detection order:
 * 1. CLAUDE_SKILL_DIR env var present → Claude
 * 2. Existing .codex/ dir without .claude/ → Codex
 * 3. Existing .claude/ dir → Claude
 * 4. Default → Claude (backwards compatibility)
 *
 * @param {string} targetRoot - Path to the target repository
 * @param {Object} deps - Optional dependencies for testing
 * @param {Object} deps.fs - fs module (defaults to Node's fs)
 * @param {Object} deps.path - path module (defaults to Node's path)
 * @param {Object} deps.env - environment variables (defaults to process.env)
 * @returns {string} One of ASSISTANT_TYPES values
 */
export function detectAssistant(targetRoot, deps = {}) {
  const env = deps.env || process.env

  // 1. Check for CLAUDE_SKILL_DIR env var (Claude is running)
  if (env.CLAUDE_SKILL_DIR) {
    return ASSISTANT_TYPES.CLAUDE
  }

  // 2. Check for existing installations
  let fs, pathMod
  try {
    fs = deps.fs || require('fs')
    pathMod = deps.path || require('path')
  } catch {
    // If we can't import fs (e.g., browser), default to Claude
    return ASSISTANT_TYPES.CLAUDE
  }

  const codexConfig = ASSISTANT_CONFIGS[ASSISTANT_TYPES.CODEX]
  const claudeConfig = ASSISTANT_CONFIGS[ASSISTANT_TYPES.CLAUDE]

  const hasCodex = fs.existsSync(pathMod.join(targetRoot, codexConfig.rootDir))
  const hasClaude = fs.existsSync(pathMod.join(targetRoot, claudeConfig.rootDir))

  // If only Codex exists, return Codex
  if (hasCodex && !hasClaude) {
    return ASSISTANT_TYPES.CODEX
  }

  // 3. Default to Claude for backwards compatibility
  return ASSISTANT_TYPES.CLAUDE
}
