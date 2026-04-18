import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { resolveSkillDirectory, isClaudeCodeEnvironment, isCodexEnvironment } from './runtime-location.js'

// Mock fs module
vi.mock('fs')

describe('resolveSkillDirectory', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns CLAUDE_SKILL_DIR when set', () => {
    const result = resolveSkillDirectory({
      env: { CLAUDE_SKILL_DIR: '/path/to/skill' },
    })
    expect(result).toBe('/path/to/skill')
  })

  it('finds config file when CLAUDE_SKILL_DIR not set', () => {
    const configContent = JSON.stringify({ skillDirectory: '.agents/skills/claudemap-runtime' })

    fs.existsSync.mockImplementation((p) => p.endsWith('.claudemap-config.json'))
    fs.readFileSync.mockReturnValue(configContent)

    const result = resolveSkillDirectory({
      env: {},
      startDir: '/project/.agents/skills/claudemap-runtime/skill',
    })

    // Should return the directory containing the config file
    expect(result).toBeDefined()
  })

  it('searches upward through directories', () => {
    const calls = []
    const targetConfigPath = path.resolve('/project/skill', '.claudemap-config.json')

    fs.existsSync.mockImplementation((p) => {
      calls.push(p)
      // Config file is 2 levels up - normalize paths for cross-platform
      return path.normalize(p) === path.normalize(targetConfigPath)
    })
    fs.readFileSync.mockReturnValue(JSON.stringify({ skillDirectory: 'test' }))

    resolveSkillDirectory({
      env: {},
      startDir: path.resolve('/project/skill/lib/commands'),
    })

    // Should have searched multiple directories
    expect(calls.length).toBeGreaterThan(1)
  })

  it('throws when neither env var nor config file found', () => {
    fs.existsSync.mockReturnValue(false)

    expect(() =>
      resolveSkillDirectory({
        env: {},
        startDir: '/some/path',
      }),
    ).toThrow('Could not resolve skill directory')
  })

  it('prioritizes CLAUDE_SKILL_DIR over config file', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue(JSON.stringify({ skillDirectory: 'from-config' }))

    const result = resolveSkillDirectory({
      env: { CLAUDE_SKILL_DIR: '/from-env' },
      startDir: '/project',
    })

    expect(result).toBe('/from-env')
    // Should not have checked for config file
    expect(fs.existsSync).not.toHaveBeenCalled()
  })
})

describe('isClaudeCodeEnvironment', () => {
  it('returns true when CLAUDE_SKILL_DIR is set', () => {
    expect(isClaudeCodeEnvironment({ CLAUDE_SKILL_DIR: '/path' })).toBe(true)
  })

  it('returns false when CLAUDE_SKILL_DIR is not set', () => {
    expect(isClaudeCodeEnvironment({})).toBe(false)
  })

  it('returns false when CLAUDE_SKILL_DIR is empty string', () => {
    expect(isClaudeCodeEnvironment({ CLAUDE_SKILL_DIR: '' })).toBe(false)
  })
})

describe('isCodexEnvironment', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when CLAUDE_SKILL_DIR is set', () => {
    const result = isCodexEnvironment({
      env: { CLAUDE_SKILL_DIR: '/path' },
      startDir: '/project',
    })
    expect(result).toBe(false)
  })

  it('returns true when config file exists and no CLAUDE_SKILL_DIR', () => {
    fs.existsSync.mockReturnValue(true)

    const result = isCodexEnvironment({
      env: {},
      startDir: '/project',
    })
    expect(result).toBe(true)
  })

  it('returns false when no config file and no CLAUDE_SKILL_DIR', () => {
    fs.existsSync.mockReturnValue(false)

    const result = isCodexEnvironment({
      env: {},
      startDir: '/project',
    })
    expect(result).toBe(false)
  })
})
