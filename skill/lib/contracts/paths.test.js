import { describe, expect, it } from 'vitest'
import {
  // Assistant types and configs
  ASSISTANT_TYPES,
  ASSISTANT_CONFIGS,
  resolveAssistantPaths,
  detectAssistant,

  // Legacy exports (backwards compatibility)
  CLAUDE_ROOT_DIR,
  SKILLS_SUBDIR,
  COMMANDS_SUBDIR,
  AGENTS_SUBDIR,
  RUNTIME_SKILL_NAME,
  SKILL_ROOT_REL,
  COMMANDS_ROOT_REL,
  AGENTS_ROOT_REL,
  ARCHITECT_AGENT_FILENAME,
  INSTALL_RECORD_FILENAME,
  ARTIFACT_MANIFEST_FILENAME,
  PARTIAL_INSTALL_MARKER_FILENAME,
} from './paths.js'

// -----------------------------------------------------------------------------
// Assistant Types and Configs
// -----------------------------------------------------------------------------

describe('ASSISTANT_TYPES', () => {
  it('exports claude and codex types', () => {
    expect(ASSISTANT_TYPES.CLAUDE).toBe('claude')
    expect(ASSISTANT_TYPES.CODEX).toBe('codex')
  })

  it('is frozen', () => {
    expect(Object.isFrozen(ASSISTANT_TYPES)).toBe(true)
  })
})

describe('ASSISTANT_CONFIGS', () => {
  it('has config for every assistant type', () => {
    for (const type of Object.values(ASSISTANT_TYPES)) {
      expect(ASSISTANT_CONFIGS[type]).toBeDefined()
      expect(ASSISTANT_CONFIGS[type].rootDir).toBeDefined()
      expect(ASSISTANT_CONFIGS[type].skillsPath).toBeDefined()
      expect(ASSISTANT_CONFIGS[type].agentsPath).toBeDefined()
      expect(ASSISTANT_CONFIGS[type].agentExt).toBeDefined()
    }
  })

  it('Claude config uses .claude root for everything', () => {
    const config = ASSISTANT_CONFIGS[ASSISTANT_TYPES.CLAUDE]
    expect(config.rootDir).toBe('.claude')
    expect(config.skillsPath).toBe('.claude/skills')
    expect(config.agentsPath).toBe('.claude/agents')
    expect(config.commandsPath).toBe('.claude/commands')
    expect(config.agentExt).toBe('.md')
  })

  it('Codex config uses separate discovery roots', () => {
    const config = ASSISTANT_CONFIGS[ASSISTANT_TYPES.CODEX]
    // .codex is the config root
    expect(config.rootDir).toBe('.codex')
    // .agents/skills is the hardcoded discovery path
    expect(config.skillsPath).toBe('.agents/skills')
    expect(config.agentsPath).toBe('.codex/agents')
    // No slash commands for Codex
    expect(config.commandsPath).toBe(null)
    expect(config.agentExt).toBe('.toml')
  })

  it('is frozen', () => {
    expect(Object.isFrozen(ASSISTANT_CONFIGS)).toBe(true)
  })
})

// -----------------------------------------------------------------------------
// resolveAssistantPaths
// -----------------------------------------------------------------------------

describe('resolveAssistantPaths', () => {
  describe('for Claude', () => {
    const paths = resolveAssistantPaths(ASSISTANT_TYPES.CLAUDE)

    it('returns correct base config', () => {
      expect(paths.assistantType).toBe('claude')
      expect(paths.rootDir).toBe('.claude')
      expect(paths.skillsPath).toBe('.claude/skills')
      expect(paths.agentsPath).toBe('.claude/agents')
      expect(paths.commandsPath).toBe('.claude/commands')
      expect(paths.agentExt).toBe('.md')
    })

    it('returns correct skill paths', () => {
      expect(paths.skillRootRel).toBe('.claude/skills/claudemap-runtime')
      expect(paths.runtimeGraphRel).toContain('.claude/skills/claudemap-runtime')
      expect(paths.runtimeStateRel).toContain('.claude/skills/claudemap-runtime')
    })

    it('returns correct agent paths', () => {
      expect(paths.architectAgentFilename).toBe('claudemap-architect.md')
      expect(paths.architectAgentRel).toBe('.claude/agents/claudemap-architect.md')
    })

    it('returns correct commands path', () => {
      expect(paths.commandsRootRel).toBe('.claude/commands')
    })

    it('returns correct install/artifact paths in rootDir', () => {
      expect(paths.installRecordRel).toBe('.claude/claudemap-install.json')
      expect(paths.artifactManifestRel).toBe('.claude/claudemap-artifact.json')
      expect(paths.partialInstallMarkerRel).toBe('.claude/.partial-install')
    })

    it('returns null for skillConfigRel (Claude uses env var)', () => {
      expect(paths.skillConfigRel).toBe(null)
    })

    it('getManagedPaths includes skill, agent, commands, and metadata', () => {
      const managed = paths.getManagedPaths()
      expect(managed).toContain('.claude/skills/claudemap-runtime')
      expect(managed).toContain('.claude/agents/claudemap-architect.md')
      expect(managed).toContain('.claude/claudemap-install.json')
      expect(managed).toContain('.claude/claudemap-artifact.json')
      expect(managed).toContain('.claude/commands')
    })
  })

  describe('for Codex', () => {
    const paths = resolveAssistantPaths(ASSISTANT_TYPES.CODEX)

    it('returns correct base config', () => {
      expect(paths.assistantType).toBe('codex')
      expect(paths.rootDir).toBe('.codex')
      expect(paths.skillsPath).toBe('.agents/skills')
      expect(paths.agentsPath).toBe('.codex/agents')
      expect(paths.commandsPath).toBe(null)
      expect(paths.agentExt).toBe('.toml')
    })

    it('returns correct skill paths under .agents/skills', () => {
      expect(paths.skillRootRel).toBe('.agents/skills/claudemap-runtime')
      expect(paths.runtimeGraphRel).toContain('.agents/skills/claudemap-runtime')
      expect(paths.runtimeStateRel).toContain('.agents/skills/claudemap-runtime')
    })

    it('returns correct agent paths with .toml extension', () => {
      expect(paths.architectAgentFilename).toBe('claudemap-architect.toml')
      expect(paths.architectAgentRel).toBe('.codex/agents/claudemap-architect.toml')
    })

    it('returns null for commandsRootRel (Codex deprecated slash commands)', () => {
      expect(paths.commandsRootRel).toBe(null)
    })

    it('returns correct install/artifact paths in .codex', () => {
      expect(paths.installRecordRel).toBe('.codex/claudemap-install.json')
      expect(paths.artifactManifestRel).toBe('.codex/claudemap-artifact.json')
      expect(paths.partialInstallMarkerRel).toBe('.codex/.partial-install')
    })

    it('returns skillConfigRel for self-location', () => {
      expect(paths.skillConfigRel).toBe('.agents/skills/claudemap-runtime/.claudemap-config.json')
    })

    it('getManagedPaths spans both roots and excludes commands', () => {
      const managed = paths.getManagedPaths()
      // Skill in .agents/skills
      expect(managed).toContain('.agents/skills/claudemap-runtime')
      // Agent in .codex
      expect(managed).toContain('.codex/agents/claudemap-architect.toml')
      // Metadata in .codex
      expect(managed).toContain('.codex/claudemap-install.json')
      expect(managed).toContain('.codex/claudemap-artifact.json')
      // No commands
      expect(managed.some((p) => p.includes('commands'))).toBe(false)
    })
  })

  it('throws for unknown assistant type', () => {
    expect(() => resolveAssistantPaths('unknown')).toThrow('Unknown assistant type')
    expect(() => resolveAssistantPaths('unknown')).toThrow('Valid types: claude, codex')
  })
})

// -----------------------------------------------------------------------------
// detectAssistant
// -----------------------------------------------------------------------------

describe('detectAssistant', () => {
  it('returns Claude when CLAUDE_SKILL_DIR env var is set', () => {
    const result = detectAssistant('/some/path', {
      env: { CLAUDE_SKILL_DIR: '/path/to/skill' },
      fs: { existsSync: () => false },
      path: { join: (...args) => args.join('/') },
    })
    expect(result).toBe(ASSISTANT_TYPES.CLAUDE)
  })

  it('returns Codex when only .codex/ exists', () => {
    const result = detectAssistant('/repo', {
      env: {},
      fs: {
        existsSync: (p) => p.includes('.codex'),
      },
      path: { join: (...args) => args.join('/') },
    })
    expect(result).toBe(ASSISTANT_TYPES.CODEX)
  })

  it('returns Claude when only .claude/ exists', () => {
    const result = detectAssistant('/repo', {
      env: {},
      fs: {
        existsSync: (p) => p.includes('.claude'),
      },
      path: { join: (...args) => args.join('/') },
    })
    expect(result).toBe(ASSISTANT_TYPES.CLAUDE)
  })

  it('returns Claude when both .claude/ and .codex/ exist', () => {
    const result = detectAssistant('/repo', {
      env: {},
      fs: {
        existsSync: () => true, // both exist
      },
      path: { join: (...args) => args.join('/') },
    })
    expect(result).toBe(ASSISTANT_TYPES.CLAUDE)
  })

  it('returns Claude when neither directory exists (default)', () => {
    const result = detectAssistant('/repo', {
      env: {},
      fs: {
        existsSync: () => false,
      },
      path: { join: (...args) => args.join('/') },
    })
    expect(result).toBe(ASSISTANT_TYPES.CLAUDE)
  })

  it('returns Claude when fs is unavailable', () => {
    const result = detectAssistant('/repo', {
      env: {},
      // No fs provided, and require would fail in test env
    })
    // Should default to Claude without throwing
    expect(result).toBe(ASSISTANT_TYPES.CLAUDE)
  })
})

// -----------------------------------------------------------------------------
// Legacy Exports (Backwards Compatibility)
// -----------------------------------------------------------------------------

describe('legacy exports', () => {
  it('CLAUDE_ROOT_DIR matches Claude config', () => {
    expect(CLAUDE_ROOT_DIR).toBe('.claude')
    expect(CLAUDE_ROOT_DIR).toBe(ASSISTANT_CONFIGS[ASSISTANT_TYPES.CLAUDE].rootDir)
  })

  it('subdirectory constants are defined', () => {
    expect(SKILLS_SUBDIR).toBe('skills')
    expect(COMMANDS_SUBDIR).toBe('commands')
    expect(AGENTS_SUBDIR).toBe('agents')
  })

  it('RUNTIME_SKILL_NAME is defined', () => {
    expect(RUNTIME_SKILL_NAME).toBe('claudemap-runtime')
  })

  it('composed paths match Claude assistant paths', () => {
    const claudePaths = resolveAssistantPaths(ASSISTANT_TYPES.CLAUDE)
    expect(SKILL_ROOT_REL).toBe(claudePaths.skillRootRel)
    expect(COMMANDS_ROOT_REL).toBe(claudePaths.commandsRootRel)
    expect(AGENTS_ROOT_REL).toBe(claudePaths.agentsPath)
  })

  it('filename constants are defined', () => {
    expect(ARCHITECT_AGENT_FILENAME).toBe('claudemap-architect.md')
    expect(INSTALL_RECORD_FILENAME).toBe('claudemap-install.json')
    expect(ARTIFACT_MANIFEST_FILENAME).toBe('claudemap-artifact.json')
    expect(PARTIAL_INSTALL_MARKER_FILENAME).toBe('.partial-install')
  })
})
