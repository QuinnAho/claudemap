# ClaudeMap for Codex

ClaudeMap ships a Codex-flavored artifact alongside its original Claude Code artifact. This document describes the Codex install layout, how ClaudeMap is exposed through Codex's skill system and built-in slash commands, and the guardrails the installer applies when switching between assistants.

## Install

```bash
cd <your-repo>
npx @quinnaho/claudemap install --assistant codex
```

This copies two top-level trees into the target repo:

```
.agents/
  skills/
    codexmap-runtime/
      SKILL.md                  <- skill body (with embedded command docs)
      skill/                    <- Node entrypoints + prompts
      app/                      <- prebuilt runtime bundle
      .claudemap-config.json    <- self-location sidecar (NOT at repo root)
.codex/
  agents/
    claudemap-architect.toml    <- architect subagent (TOML)
  claudemap-install.json        <- install record (assistant: "codex", version: 2)
```

Codex discovers skills from `.agents/skills/`; agent definitions and the ClaudeMap install record live under `.codex/`. The self-location sidecar (`.claudemap-config.json`) lives inside the skill directory alongside `SKILL.md`, not at the target repo root — `skill/lib/runtime-location.js` walks upward from each command entrypoint to find it. There is no documented `.codex/commands/` extension point for repo-defined skill commands; Codex's built-in slash commands are separate from skill operations.

To update an existing Codex install:

```bash
npx @quinnaho/claudemap update --assistant codex
```

Updates migrate older Codex installs from `.agents/skills/claudemap-runtime` to `.agents/skills/codexmap-runtime` and remove the old managed skill directory when it is identifiable as a prior ClaudeMap/CodexMap runtime.

`--assistant auto` (the default) reads the artifact manifest and the target repo's install record to pick the right assistant.

## Architecture

Codex understands ClaudeMap through a thin Codex wrapper around the shared runtime:

- The shared implementation stays in the same `skill/` and `app/` runtime used by the Claude artifact; Codex does not fork the core graph-building or UI codepaths.
- The Codex package exposes that runtime as a skill at `.agents/skills/codexmap-runtime`, so Codex reads one `SKILL.md` with embedded command docs instead of a repo-defined `.codex/commands/` directory.
- The architecture-enrichment workflow is exposed separately as `.codex/agents/claudemap-architect.toml`; graph-building flows either take the small-repo inline path or invoke that custom agent and then pass the returned JSON into the Node command with `--enrichment-file`.
- "CodexMap" is a packaging and UI brand layer over the shared runtime. Assistant-visible skill identity is branded (`codexmap-runtime`), while graph filenames, manifests, cache paths, and the shared architect agent keep the `claudemap-` prefix for storage compatibility.

## Commands

Codex does support built-in slash commands in the CLI and IDE extension, but ClaudeMap's repo-specific operations are exposed through the skill system rather than a custom `.codex/commands/` directory. The commands that Claude users invoke as `/setup-claudemap`, `/refresh`, `/open-claudemap`, `/explain`, and `/show` are documented inline in the skill's `SKILL.md` under **Available Commands**.

From a Codex session, you invoke them in one of two ways:

1. **Through the skill by intent.** Explicitly invoke the skill via `/skills` or by mentioning `$codexmap-runtime`, then ask Codex to run the skill command (it reads the SKILL.md and the embedded Available Commands list):

   ```
   Run the codexmap-runtime skill's setup-claudemap command against this repo.
   ```

   ```
   Use the codexmap-runtime skill to refresh the map after my recent changes.
   ```

2. **Directly as a shell command.** Codex can also execute the Node entrypoints via its shell tool:

   ```
   node .agents/skills/codexmap-runtime/skill/commands/setup-claudemap.js
   node .agents/skills/codexmap-runtime/skill/commands/refresh.js
   node .agents/skills/codexmap-runtime/skill/commands/open-claudemap.js
   node .agents/skills/codexmap-runtime/skill/commands/show.js
   node .agents/skills/codexmap-runtime/skill/commands/create-map.js
   ```

`explain` is handled by the subagent rather than a dedicated command.

## Subagent invocation

The architect subagent lives at `.codex/agents/claudemap-architect.toml`. Codex invokes it via its native agent-call mechanism; the skill's `SKILL.md` contains the exact invocation pattern under **Subagent Invocation (Codex)**.

The TOML is generated from the same source used for Claude (`agents/claudemap-architect.md`) via `scripts/lib/agent-converter.js`. Codex's custom-agent TOML schema only accepts a narrow set of top-level keys, so Claude-only fields are dropped during conversion:

| Claude frontmatter | Codex TOML key | Notes |
|--------------------|----------------|-------|
| `name`             | `name`         | required |
| `description`      | `description`  | required |
| body               | `developer_instructions` (multi-line literal) | required |
| `model`            | `model`        | names remapped for Codex's ChatGPT-account model set: `sonnet`/`opus` → `gpt-5.4`, `haiku` → `gpt-5.4-mini`. `gpt-4o`/`gpt-4` are rejected with "The 'gpt-4o' model is not supported when using Codex with a ChatGPT account". |
| `effort`           | `model_reasoning_effort` | passed through |
| `tools`            | — | dropped; Codex schema has no top-level `tools` array |
| `maxTurns`         | — | dropped; not supported by Codex agent schema |
| `color`            | — | dropped; not supported by Codex agent schema |

Codex's other supported top-level keys (`sandbox_mode`, `nickname_candidates`, `[mcp_servers.*]`, `[[skills.config]]`) are not currently emitted because ClaudeMap's architect agent doesn't need them.

## Cross-assistant switch guard

If a target repo already has a Claude install (`.claude/claudemap-install.json`) and you try to install the Codex artifact (or vice versa), the installer refuses with an error:

```
Target already has a claude install; refusing to install a codex artifact over it.
Pass --force-assistant-switch to overwrite.
```

Pass `--force-assistant-switch` to proceed. The installer still removes only the managed paths recorded for the previous assistant; it will not delete unrelated files.

## Building Codex artifacts locally

```bash
node scripts/package-claudemap-skill.js --assistant codex   # Codex-only
node scripts/package-claudemap-skill.js --assistant all     # Both artifacts side-by-side
```

The resulting artifacts land under `artifacts/claudemap-skill/claudemap/` (Claude) and `artifacts/claudemap-skill/claudemap-codex/` (Codex). Each artifact directory contains a `claudemap-artifact.json` manifest with `assistant`, `installRoots`, and `managedPaths` that the installer uses.

## Local testing against another repo

To dogfood a packaged artifact into a real repo on disk, use the `install:local` npm script (aliased to `scripts/install-claudemap.js`). The installer will build the correct flavor for you — you only need to pass the target path and the assistant.

```bash
# Claude flavor (default):
npm run install:local -- <path-to-target-repo>

# Codex flavor:
npm run install:local -- <path-to-target-repo> --assistant codex

# Skip npm install inside the installed runtime (fast iteration):
npm run install:local -- <path-to-target-repo> --assistant codex --skip-install

# If the target already has the other assistant installed:
npm run install:local -- <path-to-target-repo> --assistant codex --force-assistant-switch

# Preview without touching disk:
npm run install:local -- <path-to-target-repo> --assistant codex --dry-run
```

If the artifact already exists on disk and you want to skip the rebuild, pass `--skip-package --artifact <path-to-artifact>` explicitly.

After install, verify the target has:

- `.codex/claudemap-install.json` with `"assistant": "codex"` (or `.claude/claudemap-install.json` for Claude)
- `.agents/skills/codexmap-runtime/app/index.html` stamped with `data-brand="codexmap"`, `<title>CodexMap</title>`, and `href="/favicon-codex.svg"` (Codex only)

## Branding

The Codex artifact ships as **CodexMap** rather than ClaudeMap:

- **Display name and skill identity.** The top-bar title, the default map label, and the graph credit label render "CodexMap" in the packaged Codex app. The Codex skill is installed as `codexmap-runtime`, while the shared architect agent, graph filenames, cache filenames, and manifest filenames keep their `claudemap-` prefix across both artifacts so installs and stored maps stay interoperable.
- **Accent palette.** The packaged Codex `index.html` carries `<html data-brand="codexmap">`; `app/src/styles/tokens.generated.css` emits a matching `:root[data-brand="codexmap"]` override block that swaps the warm ClaudeMap accents for cool CodexMap blues (`--accent`, `--accent-pronounced`, `--bg-highlight-accent`, `--text-presentation`, `--text-highlight`). The default `:root` block is unchanged, so the Claude bundle continues to render the ClaudeMap palette without any attribute stamp.
- **Title and favicon.** The Codex bundle's `index.html` is stamped with `<title>CodexMap</title>` and `<link rel="icon" href="/favicon-codex.svg">`. The Claude bundle is left untouched.
- **SKILL.md prose.** The Codex skill generator stamps `name: codexmap-runtime`, rewrites skill-path references to `.agents/skills/codexmap-runtime`, and runs a `\bClaudeMap\b` -> `CodexMap` substitution over the fully-assembled SKILL.md. Storage filenames such as `claudemap-runtime.json` are intentionally not renamed.

Brand descriptors live in `app/src/contracts/branding.js` (source of truth) and `skill/lib/contracts/paths.js` exposes the matching `BRAND_IDS` plus a `brandId` field on `resolveAssistantPaths()`. Runtime code reads the active brand with `getBrand()` from `app/src/lib/brand.js`, which resolves from the `data-brand` attribute the packager stamps on `<html>`.

## Smoke test

`npm test` exercises both paths:

- Builds a Claude artifact, installs it, runs `setup-claudemap` and `create-map`, and verifies the graph/runtime layout.
- Builds a Codex artifact, verifies the `.codex/` + `.agents/` layout, the TOML agent, embedded command docs in `SKILL.md`, and `.claudemap-config.json`.
- Builds a dual (`--assistant all`) artifact and verifies both subtrees exist.
- Installs the Codex artifact into a fresh fixture and verifies the install record records `assistant: "codex"`.
- Exercises the cross-assistant guard (refusal + `--force-assistant-switch`).
