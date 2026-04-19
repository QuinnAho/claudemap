# ClaudeMap Guide

Complete guide for setting up and using ClaudeMap.

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) or [Codex](https://github.com/openai/codex)
- Node.js 18+

## Setup

### Claude Code (default)

```bash
cd <your-repo>
npx @quinnaho/claudemap install
claude
/setup-claudemap
```

### Codex

```bash
cd <your-repo>
npx @quinnaho/claudemap install --assistant codex
```

Then open Codex in that repo, run `/skills`, choose `codexmap-runtime`, and prefix your request with the inserted skill mention:

```
$codexmap-runtime build the initial architecture map for this repo
```

See [CODEX.md](CODEX.md) for Codex-specific details.

### Updating

```bash
npx @quinnaho/claudemap update
```

## Core Operations

Claude Code exposes ClaudeMap as slash commands. Codex exposes the same operations through the `codexmap-runtime` skill, so use `/skills` to select it or prefix requests with `$codexmap-runtime`.

### Setup

Analyzes your codebase and generates an interactive map. The assistant reads your project structure, sends it to a dedicated architecture subagent when needed, and renders the result in your browser.

Claude Code:

```
/setup-claudemap
```

Codex:

```
$codexmap-runtime build the initial architecture map for this repo
```

After the map renders, the assistant will ask if it looks right. You can request refinements without starting over.

### Refresh

Updates your map after code changes. Detects what changed and updates incrementally when possible.

Claude Code:

```
/refresh
```

Codex:

```
$codexmap-runtime refresh the map after my latest changes
```

### Explain

Ask any question about your code. The assistant walks you through the answer step-by-step, highlighting relevant systems on the map as it explains.

Examples:

- "How does authentication work?"
- "What happens when a user submits a form?"
- "Where is the database connection established?"

Codex example:

```
$codexmap-runtime explain how authentication works
```

### Show

Navigate the map with natural language. Tell the assistant what you want to see and it moves the viewport for you.

Examples:

- "Show me the API layer"
- "What's broken?"
- "Where is user data handled?"

Codex example:

```
$codexmap-runtime show me the API layer
```

### Open

Reopens the map in your browser without rebuilding.

Claude Code:

```
/open-claudemap
```

Codex:

```
$codexmap-runtime reopen the existing map without rebuilding
```

## Multi-Map Support

For large codebases, create focused maps for specific subsystems instead of cramming everything into one view.

### Creating a Scoped Map

From the main map, click on any top-level system with 2+ children. You'll see an option to create a scoped map for that subsystem.

Alternatively, ask the assistant directly:

```
Create a map focused on the authentication system
```

In Codex, include the skill mention:

```
$codexmap-runtime create a focused map for the authentication system
```

### Switching Between Maps

The map UI shows which map is active. Use the map switcher or ask the assistant:

```
Switch to the API map
Show me the main overview map
```

### How It Works

- Each map has its own ID, scope, and file
- Commands like `/explain` and `/show` operate on the active map; in Codex, use the matching `$codexmap-runtime` request
- Maps share the same underlying architecture data

## How It Works

ClaudeMap installs as a Claude Code skill or Codex skill. When you build the map:

1. The assistant reads your project structure
2. An architecture subagent analyzes the code and groups it by functionality
3. The result renders as an interactive force-directed graph
4. Everything runs locally - no cloud backend

The map organizes code by *what it does*, not file paths. Zoom out for the big picture, zoom in for details. Colors indicate code health.

## Troubleshooting

### Map Won't Open

Check that the skill installed correctly:

```bash
# Claude Code
ls .claude/commands/

# Codex
ls .agents/skills/codexmap-runtime/
```

### Map Looks Wrong

After setup, the assistant asks if the map looks right. Request specific changes:

- "The auth system should be separate from the API"
- "Merge these two related systems"
- "This file belongs in the database layer"

### Outdated Map

Run `/refresh` in Claude Code, or ask Codex:

```
$codexmap-runtime refresh the map after my changes
```