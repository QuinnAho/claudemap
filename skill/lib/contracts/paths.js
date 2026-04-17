// Canonical path constants for every ClaudeMap surface.
//
// Every file path that appears in more than one place lives here. Scripts,
// skill commands, skill lib, and the installer all import from this module.
// Do not re-declare these strings anywhere else.
//
// Names ending in *_REL are POSIX-relative (forward slashes, no leading slash);
// callers compose them with path.join against whichever root applies.

// Root directory Claude Code writes into, at the top of a target repo.
export const CLAUDE_ROOT_DIR = '.claude'

// Subdirectories of .claude/
export const SKILLS_SUBDIR = 'skills'
export const COMMANDS_SUBDIR = 'commands'
export const AGENTS_SUBDIR = 'agents'

// The claudemap runtime lives under .claude/skills/claudemap-runtime/
export const RUNTIME_SKILL_NAME = 'claudemap-runtime'

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
