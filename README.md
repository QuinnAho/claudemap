# ClaudeMap

![ClaudeMap terminal and map view](resources/img/ClaudeTerminal+ClaudeMap.png)

ClaudeMap turns a repository into a live architecture map inside Claude Code.
It installs a `.claude` bundle, snapshots the repo, asks a dedicated
architecture subagent to build a detailed graph, and opens a bundled UI for
navigation, walkthroughs, and updates.

## 30-Second Setup

Install into the repo you want to map:

```bash
npx claudemap install
```

Then inside Claude Code:

```text
/setup-claudemap
```

After code changes:

```text
/refresh
```

If you only need the UI back:

```text
/open-claudemap
```

## How It Works

1. `claudemap install` copies a ClaudeMap-owned `.claude` bundle into the target repository and runs `npm install` for the bundled runtime.
2. `/setup-claudemap` snapshots the repository and asks the bundled `claudemap-architect` subagent to convert that snapshot into a detailed, human-readable graph.
3. ClaudeMap renders that graph in the bundled UI, then `/refresh`, `/explain`, and `/claudemap-control` keep the map useful as the code and conversation evolve.

## What You Get

- `/setup-claudemap` for first-time graph generation
- `/refresh` for graph refresh after edits
- `/open-claudemap` to reopen the UI without rebuilding
- `/explain` for guided walkthroughs
- `/claudemap-control` for directing the live map with natural-language presentation intent

## Current State

ClaudeMap is still early. The install/refresh surface is real and shippable, but
the overall product is still scaffold-heavy.

Implemented today:

- npm/npx installer flow
- packaged `.claude` runtime bundle
- slash commands and subagent scaffolding
- placeholder app/runtime implementation
- seeded contracts and demo payloads

Not fully implemented yet:

- production-quality graph extraction
- production-quality enrichment
- mature live MCP behavior
- polished browser/runtime UX

Use `claudemap-spec.md` as future-state intent only. The current repository contents are the source of truth.

## Repository Layout

- `app/` - placeholder web app workspace
- `skill/` - placeholder runtime commands, prompts, and shared libraries
- `scripts/` - artifact packaging plus install/refresh scripts
- `contracts/` - seeded graph and runtime JSON
- `demo/` - demo sandboxes used by the packaged artifact
- `artifacts/` - generated release output

## Local Development

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run build
npm run mcp
npm run package-skill
```

## Install Into Another Repository

ClaudeMap uses a Node/npm installer rather than an MCP bootstrap flow. That
keeps setup generic: it can merge into an existing `.claude/` directory, copy
only the ClaudeMap bundle, and run `npm install` automatically for the bundled
runtime.

From this repository checkout:

Install into any target repository:

```bash
npm run install-claudemap -- ../target-repo
```

That command:

- packages the latest ClaudeMap artifact from this checkout
- merges `.claude/` into the target repo without deleting unrelated `.claude` files
- writes `.claude/claudemap-install.json`
- runs `npm install` inside `.claude/skills/claudemap-runtime`

To refresh an existing install after pulling new ClaudeMap changes, rerun the
same flow or use the explicit update alias:

```bash
npm run update-claudemap-install -- ../target-repo
```

## NPX Usage

The package is now structured to publish as a real `npx` entrypoint. After
publishing, the install and update flow becomes:

```bash
npx claudemap install
npx claudemap update
```

Both commands default to the current working directory. You can also target a
different repository explicitly:

```bash
npx claudemap install ../target-repo
npx claudemap update ../target-repo
```

For publish packaging, `npm pack` and `npm publish` now stage a bundled
ClaudeMap artifact automatically during `prepack`.

Maintainer release steps live in `PUBLISHING.md`.

## License

MIT. See `LICENSE`.
