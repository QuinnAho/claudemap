# ClaudeMap — Technical Spec & Setup Guide

## What It Is

ClaudeMap is a Claude Code skill that visualizes codebases as interactive conceptual graphs. You type `/claudemap` in your terminal, a browser window opens with your codebase rendered as a map. Click nodes to copy context, paste into Claude Code to ask questions. Type `/update` after code changes and the map updates.

**Tagline:** We make codebases understandable.

---

## Architecture Overview

Three pieces: a Claude Code skill (Node.js) that does analysis, a React web app that renders the graph and runs an MCP server, and MCP as the communication bridge between them.

```
┌─────────────────────┐         MCP Tools            ┌─────────────────────────┐
│   Claude Code Skill  │ ──────────────────────────→  │     React Web App       │
│                      │   render_graph               │                         │
│  - File walker       │   add_node / remove_node     │  - MCP Server           │
│  - Claude enrichment │   update_node                │  - React Flow graph     │
│  - /claudemap cmd    │   highlight_nodes            │  - Custom styled nodes  │
│  - /update cmd       │   clear_highlight            │  - Elkjs layout         │
│                      │   navigate_to                │  - Detail sidebar       │
│                      │   guided_flow                │  - Clipboard on click   │
│                      │   set_health_overlay         │                         │
└─────────────────────┘                               └─────────────────────────┘
                                                               │
                                                               │ User clicks node
                                                               │ → copies to clipboard
                                                               │ → pastes into Claude Code
                                                               ▼
                                                      ┌──────────────┐
                                                      │   Terminal    │
                                                      │  Claude Code  │
                                                      └──────────────┘
```

Communication is one-directional through MCP: Claude Code calls tools on the app to control the visualization. Communication back to Claude is manual: user clicks a node, app copies reference + metadata to clipboard, user pastes into Claude Code.

A cache file (`claudemap-cache.json`) is written to the project root after initial analysis so subsequent launches skip re-analysis if files haven't changed.

---

## Layer 1: Claude Code Skill — The Brain

Lives in the skill directory, runs when the user types `/claudemap`.

Does two things: runs a deterministic file walker that builds raw data (file paths, line counts, imports, exports), then sends that raw data to Claude for enrichment (grouping files into conceptual systems, assigning icons, writing summaries, flagging health issues).

On initial generation, writes the full result to `claudemap-cache.json` in the project root, then calls `render_graph` via MCP to send the full graph to the app. This is the only time the full graph is transmitted.

After that, all updates are incremental. The `/update` command re-runs the file walker, diffs against the cache, sends only changed files to Claude for re-analysis, then calls targeted MCP tools: `add_node` for new files, `remove_node` for deleted files, `update_node` for changed files.

For interactive commands like "show me how a request flows" or "what's wrong with this codebase," the skill prompts Claude and translates the response into MCP tool calls: `guided_flow`, `highlight_nodes`, `navigate_to`, `set_health_overlay`.

---

## Layer 2: React Web App — The Face

A Vite + React app that lives inside the skill directory. Claude Code serves it locally and opens it in Chrome's app mode (`--app=http://localhost:5173`) so it looks like a native window.

Runs an MCP server using `@modelcontextprotocol/sdk` that registers tool handlers. Each handler updates a Zustand store, which React Flow reads reactively.

Uses React Flow with custom node components for three zoom levels: system nodes (conceptual cards with icons), file nodes (smaller cards), and function nodes (minimal labels). Elkjs computes the layout automatically.

When a user clicks a node, the app copies a formatted reference string to the clipboard containing the node name, file path, summary, and health status. The user pastes this into Claude Code for context.

---

## Layer 3: MCP — The Bridge

### MCP Tools (Claude Code → App)

| Tool | Input | What It Does |
|------|-------|-------------|
| `render_graph` | `{nodes[], edges[]}` | Full graph render on initial load |
| `add_node` | `{node}` | Insert a new node, re-run layout, animate in |
| `remove_node` | `{nodeId}` | Fade out and remove a node, re-run layout |
| `update_node` | `{nodeId, fields}` | Merge updated fields, re-render node |
| `add_edge` | `{edge}` | Insert a new edge |
| `remove_edge` | `{edgeId}` | Remove an edge |
| `highlight_nodes` | `{nodeIds[], color}` | Highlight specified nodes, dim everything else |
| `clear_highlight` | `{}` | Remove all highlighting, restore normal view |
| `navigate_to` | `{nodeId, zoom?}` | Smooth camera pan to target node |
| `guided_flow` | `{steps[], delay}` | Sequential animation through ordered nodes |
| `set_health_overlay` | `{enabled}` | Toggle health coloring on all nodes |

### Context Back to Claude (App → Clipboard → User → Claude Code)

When user clicks a node, the app copies:
```
[ClaudeMap] Auth Middleware
Path: src/middleware/auth.js
Summary: JWT validation and session management
Health: yellow — high complexity (247 lines)
Lines: 247
```

User pastes this into Claude Code terminal alongside their question.

---

## Data Schemas

### Node Schema
```json
{
  "id": "auth-middleware",
  "label": "Auth Middleware",
  "type": "system | file | function",
  "icon": "shield | database | globe | gear | puzzle | route | lock | envelope | clock | layers | code | file",
  "parentId": null,
  "health": "green | yellow | red",
  "healthReason": "high complexity — 247 lines, 12 imports",
  "summary": "JWT validation and session management",
  "lineCount": 247,
  "filePath": "src/middleware/auth.js"
}
```

### Edge Schema
```json
{
  "id": "auth-to-db",
  "source": "auth",
  "target": "database",
  "type": "imports | calls | extends | uses"
}
```

---

## Tech Stack

### Skill (skill/ directory)
- Plain Node.js — no external dependencies
- Uses built-in `fs`, `path`, `child_process`
- Regex for import/export extraction
- Claude Code's built-in AI for enrichment

### App (app/ directory)
- **Vite** — build tool and dev server
- **React 18** — UI framework
- **@xyflow/react** — React Flow v12+ for graph rendering
- **elkjs** — automatic hierarchical layout algorithm
- **lucide-react** — icon library for node icons
- **zustand** — lightweight state management shared between MCP handlers and React components
- **@modelcontextprotocol/sdk** — MCP server for receiving tool calls from Claude Code
- **Tailwind CSS** — styling via utility classes
- **express** — tiny file server for serving cache if needed

---

## UI Design

Dark theme matching the Stitch mockup. Chrome opens in app mode so no address bar.

### Layout
- **Map canvas** — left side, 70% width, pure black background (#0a0a0a)
- **Detail panel** — right side, 30% width, slightly lighter (#111111), separated by 1px border (#1e1e1e)
- **Top bar** — ClaudeMap branding in accent orange (#e8613c), Graph View tab, repo name with green status dot
- **Bottom status bar** — branch name, sync status, encoding, line/col, language
- **Zoom controls** — floating panel bottom-left of map canvas

### Detail Panel States
- **Empty** — terminal icon + "Park Claude here" + subtitle "drag your Claude Code terminal or start a new session"
- **Node selected** — icon, name, summary, health status with reason, file path, line count, quick action buttons (Explain, Dependencies, What's Wrong)

### Theme Variables
```css
--bg-canvas: #0a0a0a
--bg-panel: #111111
--bg-card: #1a1a1a
--border: #1e1e1e
--text-primary: #e5e5e5
--text-secondary: #737373
--accent: #e8613c
--health-green: #22c55e
--health-yellow: #eab308
--health-red: #ef4444
```

### Custom Nodes
- **SystemNode** — dark card with subtle border and drop shadow, Lucide icon top-left, label, one-line summary, health dot top-right with glow for red, size scales with lineCount
- **FileNode** — smaller card, just filename + line count + health dot, visible when zoomed in
- **FunctionNode** — minimal label, visible at deepest zoom
- All nodes dim to 20% opacity when dimmed, brighten border when highlighted

### Custom Edges
- Thin curved bezier, 30% opacity default, 80% on hover, brightens when connected to selected node, 10% when dimmed

### Zoom Levels
- **Overview** (zoom < 0.7) — system nodes only
- **Detailed** (zoom 0.7–1.5) — systems + files
- **Deep** (zoom > 1.5) — everything including functions

---

## Directory Structure

```
claudemap/
├── README.md
├── .gitignore
│
├── skill/
│   ├── SKILL.md
│   ├── package.json
│   ├── commands/
│   │   ├── claudemap.js
│   │   └── update.js
│   ├── lib/
│   │   ├── file-walker.js
│   │   ├── enrichment.js
│   │   ├── differ.js
│   │   └── launcher.js
│   └── prompts/
│       └── enrichment.txt
│
├── app/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   ├── public/
│   │   └── favicon.svg
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── styles/
│       │   └── globals.css
│       ├── mcp/
│       │   ├── server.js
│       │   └── handlers.js
│       ├── store/
│       │   └── graphStore.js
│       ├── components/
│       │   ├── layout/
│       │   │   ├── TopBar.jsx
│       │   │   ├── DetailPanel.jsx
│       │   │   └── StatusBar.jsx
│       │   ├── graph/
│       │   │   ├── GraphCanvas.jsx
│       │   │   ├── SystemNode.jsx
│       │   │   ├── FileNode.jsx
│       │   │   ├── FunctionNode.jsx
│       │   │   ├── CustomEdge.jsx
│       │   │   └── nodeIcons.js
│       │   └── ui/
│       │       ├── ZoomControls.jsx
│       │       └── HealthToggle.jsx
│       ├── hooks/
│       │   ├── useLayout.js
│       │   ├── useZoomLevel.js
│       │   └── useClipboard.js
│       ├── lib/
│       │   ├── transformData.js
│       │   └── layoutEngine.js
│       └── constants/
│           ├── theme.js
│           └── zoomThresholds.js
│
├── contracts/
│   ├── claudemap.sample.json
│   └── schema.md
│
└── demo/
    └── expressjs-cache.json
```

---

## Setup Commands

### Root
```bash
mkdir claudemap && cd claudemap
git init
```

**.gitignore:**
```
node_modules/
dist/
.DS_Store
claudemap-cache.json
```

### App Setup
```bash
cd app
npm init -y

# Production dependencies
npm install react react-dom
npm install @xyflow/react
npm install elkjs
npm install lucide-react
npm install zustand
npm install @modelcontextprotocol/sdk
npm install express

# Dev dependencies
npm install -D vite @vitejs/plugin-react
npm install -D tailwindcss @tailwindcss/vite
```

**vite.config.js:**
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 }
})
```

### Skill Setup
```bash
cd skill
npm init -y
```
No dependencies — uses only built-in Node.js modules (`fs`, `path`, `child_process`).

---

## Implementation Plan — Two Person Split

**Person A:** Skill + data pipeline + Claude enrichment + MCP tool calling
**Person B:** React app + React Flow + custom nodes + MCP server + UI styling

Both work in parallel from the start. The MCP tool interface and JSON schemas are the contract between them. Agree on these first (30 minutes together), then split.

### Hour 0: Together — Define the Contract (30 min)

Write `contracts/claudemap.sample.json` by hand for Express.js with 5-6 systems, 15-20 files, 10-15 edges. Write `contracts/schema.md` documenting every field. Person B develops the entire UI against this sample data.

### Person A's Track

**A1 (hours 1-2): File Walker** — `skill/lib/file-walker.js`. Walk project dir, skip junk, collect path/lineCount/imports/exports via regex. Test on Express.js.

**A2 (hours 2-4): Enrichment Prompt** — `skill/prompts/enrichment.txt`. Send raw data to Claude, get back structured JSON with conceptual systems, icons, summaries, health flags, edges. Iterate until consistent. Cache best Express.js result as `demo/expressjs-cache.json`.

**A3 (hours 4-6): Skill Commands** — Wire `/claudemap` command: run walker → enrich → write cache → call `render_graph` via MCP → launch browser. Wire `/update` command: re-walk → diff → re-analyze changes → call incremental MCP tools.

**A4 (hours 6-8): Interactive Commands** — Wire natural language to MCP tools. "Show me how login works" → `guided_flow`. "What's wrong" → `set_health_overlay` + `navigate_to`. Read clipboard context from user's pasted node references.

**A5 (hours 8-10): Demo Hardening** — Pre-cache Express.js analysis. Add fallbacks for malformed responses. Practice demo script.

### Person B's Track

**B1 (hours 1-2): App Scaffold + MCP Server** — Vite + React + Tailwind + React Flow + Zustand. Set up MCP server with stub handlers. Build layout shell matching Stitch mockup. App should render on first `npm run dev`.

**B2 (hours 2-4): Custom Nodes + Edges** — SystemNode, FileNode, FunctionNode components with Lucide icons, health dots, drop shadows. CustomEdge with curved beziers. Develop against sample JSON.

**B3 (hours 4-6): Layout + Rendering** — Integrate elkjs for auto-layout. Read sample JSON, transform to React Flow format, compute positions, render. Set up store actions for all MCP tool operations.

**B4 (hours 6-8): MCP Handlers → React Flow** — Connect each MCP tool handler to store actions. `render_graph` → full render. `highlight_nodes` → dim/brighten. `navigate_to` → `setCenter` with animation. `guided_flow` → sequential animation with delays.

**B5 (hours 8-10): Zoom + Interaction** — Zoom-to-expand with viewport listener and visibility thresholds. Click-to-copy clipboard formatting. Detail panel shows selected node info. Edge highlighting on selection.

### Together: Final Polish (last 2 hours)

Connect live skill to app. Run full flow on Express.js. Fix schema mismatches. Practice demo. Ensure Chrome opens in app mode.

---

## Demo Script (under 3 minutes)

1. **Problem statement** (30 sec) — "AI lets developers build faster than ever, but the biggest problem with vibe coding is nobody understands what they're building. You trade speed for knowledge."
2. **Show raw codebase** (10 sec) — Scroll through Express.js in terminal. Let the overwhelm land.
3. **Type `/claudemap`** — Graph appears in browser window. Pause. Let it speak for itself.
4. **Zoom and explore** (30 sec) — Zoom out to see architecture. Zoom into a system to see files. Explain the layout: size is importance, color is health.
5. **Click a node** (20 sec) — Detail panel shows info. Copy to clipboard. Paste into Claude Code. Ask "explain this." Claude responds with context.
6. **"What's wrong?"** (30 sec) — Ask Claude. Health overlay toggles on. Red nodes glow. Camera flies to worst problem. Claude explains the issue.
7. **"Show me how a request flows"** (30 sec) — Guided flow animation. Camera moves node to node, path lights up step by step.
8. **Tagline** (10 sec) — "We make codebases understandable."

---

## Priority If Extra Time

1. Edge animation — animated dashes flowing along edges during guided_flow
2. Node enter/exit animations — smooth fade and scale
3. Live coding demo — write code in Claude Code, type `/update`, watch map change
4. Voice interaction via Claude Code voice mode
5. Map View tab as 2.5D treemap using r3f
