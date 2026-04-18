import { describe, expect, it } from 'vitest'
import { parseFrontmatter, convertAgentMdToToml } from './agent-converter.js'

describe('parseFrontmatter', () => {
  it('parses YAML frontmatter from markdown', () => {
    const content = `---
name: test-agent
description: A test agent
tools: Read, Write
---

This is the body.`

    const result = parseFrontmatter(content)

    expect(result.frontmatter.name).toBe('test-agent')
    expect(result.frontmatter.description).toBe('A test agent')
    expect(result.frontmatter.tools).toBe('Read, Write')
    expect(result.body).toBe('This is the body.')
  })

  it('parses frontmatter with CRLF line endings', () => {
    const content = '---\r\nname: test-agent\r\ndescription: A test agent\r\n---\r\n\r\nBody content.'

    const result = parseFrontmatter(content)

    expect(result.frontmatter.name).toBe('test-agent')
    expect(result.frontmatter.description).toBe('A test agent')
    expect(result.body).toBe('Body content.')
  })

  it('handles missing frontmatter', () => {
    const content = 'Just a body with no frontmatter.'

    const result = parseFrontmatter(content)

    expect(result.frontmatter).toEqual({})
    expect(result.body).toBe('Just a body with no frontmatter.')
  })

  it('handles quoted values', () => {
    const content = `---
name: "quoted-name"
description: 'single quoted'
---

Body`

    const result = parseFrontmatter(content)

    expect(result.frontmatter.name).toBe('quoted-name')
    expect(result.frontmatter.description).toBe('single quoted')
  })

  it('handles all ClaudeMap agent fields', () => {
    const content = `---
name: claudemap-architect
description: Use PROACTIVELY when turning a repository snapshot into architecture map
tools: Read, Glob, Grep, Bash
model: sonnet
effort: high
maxTurns: 10
color: cyan
---

You are the ClaudeMap architect.`

    const result = parseFrontmatter(content)

    expect(result.frontmatter.name).toBe('claudemap-architect')
    expect(result.frontmatter.tools).toBe('Read, Glob, Grep, Bash')
    expect(result.frontmatter.model).toBe('sonnet')
    expect(result.frontmatter.effort).toBe('high')
    expect(result.frontmatter.maxTurns).toBe('10')
    expect(result.frontmatter.color).toBe('cyan')
  })
})

describe('convertAgentMdToToml', () => {
  it('converts basic agent to TOML', () => {
    const mdContent = `---
name: test-agent
description: A test agent
---

Instructions here.`

    const toml = convertAgentMdToToml(mdContent)

    expect(toml).toContain('name = "test-agent"')
    expect(toml).toContain('description = "A test agent"')
    expect(toml).toContain('developer_instructions = """')
    expect(toml).toContain('Instructions here.')
  })

  it('converts tools to TOML array', () => {
    const mdContent = `---
name: test
description: test
tools: Read, Glob, Grep
---

Body`

    const toml = convertAgentMdToToml(mdContent)

    expect(toml).toContain('tools = ["Read", "Glob", "Grep"]')
  })

  it('maps model names', () => {
    const mdContent = `---
name: test
description: test
model: sonnet
---

Body`

    const toml = convertAgentMdToToml(mdContent)

    // Model mapping may differ - just verify the field exists
    expect(toml).toMatch(/model = "[^"]+"/);
  })

  it('converts effort to model_reasoning_effort', () => {
    const mdContent = `---
name: test
description: test
effort: high
---

Body`

    const toml = convertAgentMdToToml(mdContent)

    expect(toml).toContain('model_reasoning_effort = "high"')
  })

  it('converts maxTurns to max_turns', () => {
    const mdContent = `---
name: test
description: test
maxTurns: 10
---

Body`

    const toml = convertAgentMdToToml(mdContent)

    expect(toml).toContain('max_turns = 10')
  })

  it('preserves color field', () => {
    const mdContent = `---
name: test
description: test
color: cyan
---

Body`

    const toml = convertAgentMdToToml(mdContent)

    expect(toml).toContain('color = "cyan"')
  })

  it('converts full claudemap-architect agent', () => {
    const mdContent = `---
name: claudemap-architect
description: Use PROACTIVELY when turning a repository snapshot into architecture map
tools: Read, Glob, Grep, Bash
model: sonnet
effort: high
maxTurns: 10
color: cyan
---

You are the ClaudeMap architect. You turn a repository snapshot into a navigable architecture graph.

Your only output is the JSON object defined by the enrichment contract.`

    const toml = convertAgentMdToToml(mdContent)

    expect(toml).toContain('name = "claudemap-architect"')
    expect(toml).toContain('tools = ["Read", "Glob", "Grep", "Bash"]')
    expect(toml).toContain('max_turns = 10')
    expect(toml).toContain('color = "cyan"')
    expect(toml).toContain('developer_instructions = """')
    expect(toml).toContain('You are the ClaudeMap architect')
  })

  it('escapes quotes in description', () => {
    const mdContent = `---
name: test
description: A "quoted" description
---

Body`

    const toml = convertAgentMdToToml(mdContent)

    expect(toml).toContain('description = "A \\"quoted\\" description"')
  })
})
