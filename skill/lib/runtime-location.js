// Runtime skill directory resolution.
//
// Claude Code sets CLAUDE_SKILL_DIR when running skill commands.
// Codex has no equivalent env var, so we fall back to reading a
// .claudemap-config.json file written by the installer.
//
// This module provides a unified API for both assistants.

import fs from 'fs'
import path from 'path'

// Config filename written by the installer for Codex self-location
const SKILL_CONFIG_FILENAME = '.claudemap-config.json'

// Maximum directory levels to search upward for config file
const MAX_SEARCH_DEPTH = 10

/**
 * Resolve the skill directory for the current runtime.
 *
 * Resolution order:
 * 1. CLAUDE_SKILL_DIR env var (set by Claude Code)
 * 2. .claudemap-config.json in skill directory tree (written by installer for Codex)
 *
 * @param {Object} options - Optional configuration
 * @param {string} options.startDir - Starting directory for config search (defaults to __dirname equivalent)
 * @param {Object} options.env - Environment variables (defaults to process.env)
 * @returns {string} Absolute path to the skill directory
 * @throws {Error} If skill directory cannot be resolved
 */
export function resolveSkillDirectory(options = {}) {
  const env = options.env || process.env

  // 1. Check for CLAUDE_SKILL_DIR env var (Claude Code)
  if (env.CLAUDE_SKILL_DIR) {
    return env.CLAUDE_SKILL_DIR
  }

  // 2. Search for .claudemap-config.json (Codex)
  const startDir = options.startDir || getCallerDirectory()
  const configPath = findConfigFile(startDir)

  if (configPath) {
    const config = readConfigFile(configPath)
    if (config) {
      // The installer writes .claudemap-config.json at the skill root.
      // Once we find and parse that file, the containing directory is the
      // only path we need - field names inside the config may evolve.
      return path.dirname(configPath)
    }
  }

  throw new Error(
    'Could not resolve skill directory. ' +
      'Neither CLAUDE_SKILL_DIR environment variable nor .claudemap-config.json found. ' +
      'Is ClaudeMap properly installed?',
  )
}

/**
 * Get the directory of the calling module.
 * Uses import.meta.url when available, falls back to __dirname.
 *
 * @returns {string} Directory path
 */
function getCallerDirectory() {
  // In ESM, we can use import.meta.url
  // This function is called from within the skill, so __dirname works
  return path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))
}

/**
 * Search upward from startDir to find .claudemap-config.json.
 *
 * @param {string} startDir - Directory to start searching from
 * @returns {string|null} Path to config file, or null if not found
 */
function findConfigFile(startDir) {
  let currentDir = path.resolve(startDir)

  for (let i = 0; i < MAX_SEARCH_DEPTH; i++) {
    const configPath = path.join(currentDir, SKILL_CONFIG_FILENAME)

    if (fs.existsSync(configPath)) {
      return configPath
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      // Reached root
      break
    }
    currentDir = parentDir
  }

  return null
}

/**
 * Read and parse the config file.
 *
 * @param {string} configPath - Path to config file
 * @returns {Object|null} Parsed config, or null on error
 */
function readConfigFile(configPath) {
  try {
    const content = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Check if we're running in Claude Code environment.
 *
 * @param {Object} env - Environment variables (defaults to process.env)
 * @returns {boolean} True if CLAUDE_SKILL_DIR is set
 */
export function isClaudeCodeEnvironment(env = process.env) {
  return Boolean(env.CLAUDE_SKILL_DIR)
}

/**
 * Check if we're running in Codex environment.
 * This is inferred from the absence of CLAUDE_SKILL_DIR and presence of config file.
 *
 * @param {Object} options - Optional configuration
 * @param {string} options.startDir - Starting directory for config search
 * @param {Object} options.env - Environment variables
 * @returns {boolean} True if likely running in Codex
 */
export function isCodexEnvironment(options = {}) {
  const env = options.env || process.env

  // If Claude env var is set, not Codex
  if (env.CLAUDE_SKILL_DIR) {
    return false
  }

  // Check for config file (indicates Codex install)
  const startDir = options.startDir || getCallerDirectory()
  const configPath = findConfigFile(startDir)

  return configPath !== null
}
