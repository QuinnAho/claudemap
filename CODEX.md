# ClaudeMap for Codex

ClaudeMap ships a Codex-flavored artifact alongside its original Claude Code artifact. This document describes the Codex install layout, how commands are invoked (Codex has no slash commands), and the guardrails the installer applies when switching between assistants.

## Install

```bash
cd <your-repo>
npx @quinnaho/claudemap install --assistant codex
```

This copies two top-level trees into the target repo:

```
.agents/
  skills/
    claudemap-runtime/        <- the skill body (SKILL.md + runtime)
.codex/
  agents/
    claudemap-architect.toml  <- architect subagent (TOML)
  claudemap-install.json      <- install record (assistant: "codex", version: 2)
.claudemap-config.json        <- self-location for the skill runtime
```

Codex discovers skills from `.agents/skills/`; agent definitions and the ClaudeMap install record live under `.codex/`. There is no `.codex/commands/` directory — Codex deprecated slash commands.

To update an existing Codex install:

```bash
npx @quinnaho/claudemap update --assistant codex
```

`--assistant auto` (the default) reads the artifact manifest and the target repo's install record to pick the right assistant.

## Commands

Because Codex does not support slash commands, the commands that Claude users invoke as `/setup-claudemap`, `/refresh`, `/open-claudemap`, `/explain`, and `/show` are documented inline in the skill's `SKILL.md` under **Available Commands**. Codex invokes them by running the corresponding Node entrypoints, e.g.:

```
node .agents/skills/claudemap-runtime/skill/commands/setup-claudemap.js
node .agents/skills/claudemap-runtime/skill/commands/refresh.js
node .agents/skills/claudemap-runtime/skill/commands/open-claudemap.js
node .agents/skills/claudemap-runtime/skill/commands/show.js
node .agents/skills/claudemap-runtime/skill/commands/create-map.js
```

`explain` is handled by the subagent rather than a dedicated command.

## Subagent invocation

The architect subagent lives at `.codex/agents/claudemap-architect.toml`. Codex invokes it via its native agent-call mechanism; the skill's `SKILL.md` contains the exact invocation pattern under **Subagent Invocation (Codex)**.

The TOML is generated from the same source used for Claude (`agents/claudemap-architect.md`) via `scripts/lib/agent-converter.js`. Fields map as follows:

| Claude frontmatter | Codex TOML key |
|--------------------|----------------|
| `name`             | `name`         |
| `description`      | `description`  |
| `tools`            | `tools` (array) |
| `model`            | `model`        |
| `effort`           | `model_reasoning_effort` |
| `maxTurns`         | `max_turns`    |
| `color`            | `color`        |
| body               | `developer_instructions` (multi-line literal) |

## Cross-assistant switch guard

If a target repo already has a Claude install (`.claude/claudemap-install.json`) and you try to install the Codex artifact (or vice versa), the installer refuses with an error:

```
Target already has a claude install; refusing to install a codex artifact over it.
Pass --force-assistant-switch to overwrite.
```

Pass `--force-assistant-switch` to proceed. The installer still removes only the managed paths recorded for the previous assistant; it will not delete unrelated files.

## Building Codex artifacts locally

```bash
npm run pack:test -- --assistant codex   # Codex-only
npm run pack:test -- --assistant all     # Both artifacts side-by-side
```

The resulting artifacts land under `artifacts/claudemap-skill/claudemap/` (Claude) and `artifacts/claudemap-skill/claudemap-codex/` (Codex). Each artifact directory contains a `claudemap-artifact.json` manifest with `assistant`, `installRoots`, and `managedPaths` that the installer uses.

## Smoke test

`npm test` exercises both paths:

- Builds a Claude artifact, installs it, runs `setup-claudemap` and `create-map`, and verifies the graph/runtime layout.
- Builds a Codex artifact, verifies the `.codex/` + `.agents/` layout, the TOML agent, embedded command docs in `SKILL.md`, and `.claudemap-config.json`.
- Builds a dual (`--assistant all`) artifact and verifies both subtrees exist.
- Installs the Codex artifact into a fresh fixture and verifies the install record records `assistant: "codex"`.
- Exercises the cross-assistant guard (refusal + `--force-assistant-switch`).
