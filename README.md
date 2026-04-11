# ClaudeMap

Minimal scaffold for the architecture described in [claudemap-spec.md](/D:/ahoqp1/Repositories/claudemap/claudemap-spec.md).

Current state:

- `app/`: placeholder React app
- `skill/`: placeholder Node.js command and library files
- `contracts/`: placeholder schema files
- `demo/`: placeholder sample data

## Setup

```bash
npm install
npm run dev
```

Optional scaffold commands:

```bash
npm run build
npm run mcp
npm run claudemap
npm run update
```

## Playwright MCP

For local UI testing with Codex, this machine is now configured to use the official Playwright MCP server:

```toml
[mcp_servers.playwright]
command = "npx"
args = ["@playwright/mcp@latest"]
```

To use it with this app:

```bash
npm run dev
```

Then start a fresh Codex session so it reloads MCP config, and point Playwright MCP at `http://localhost:5173`.

## Scope

This repo is intentionally setup-only right now. The file structure and dependencies are in place, but there is no implemented UI, graph logic, MCP runtime, file walking, enrichment, diffing, or browser-launch behavior yet.
