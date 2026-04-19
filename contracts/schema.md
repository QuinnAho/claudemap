# ClaudeMap Schema

ClaudeMap uses three JSON payload shapes:

- Graph payload: `contracts/claudemap-seed-map.json` (the seeded ClaudeMap self-map)
- Cache payload: written to `claudemap-cache.json` in the analyzed project
- Runtime state payload: written to `claudemap-runtime-state.json` in the analyzed project

## Graph Payload

Top-level fields:

- `meta`
- `nodes`
- `edges`
- `files`

`meta` fields:

- `repoName`
- `branch`
- `creditLabel`
- `generatedAt`
- `source`

`nodes` is a flat array. Supported node types:

- `system`
- `file`
- `function`

Each node currently includes:

- `id`
- `label`
- `type`
- `icon`
- `parentId`
- `health`
- `healthReason`
- `summary`
- `lineCount`
- `filePath`

`edges` currently include:

- `id`
- `source`
- `target`
- `type`

`files` mirrors the file walker output and currently includes:

- `path`
- `relativePath`
- `name`
- `directory`
- `lineCount`
- `imports`
- `exports`
- `language`
- `mtimeMs`

## Cache Payload

The cache payload wraps the graph plus the latest file manifest:

- `schemaVersion`
- `generatedAt`
- `fileCount`
- `files`
- `graph`

The skill writes this shape to `claudemap-cache.json` in the analyzed project root.

## Runtime State Payload

The runtime state is kept separate from the graph so highlight/focus actions do not rewrite the full graph payload.

Top-level fields:

- `graphRevision`
- `updatedAt`
- `graphMeta`
- `runtime`

`graphMeta` currently includes:

- `repoName`
- `generatedAt`
- `source`
- `nodeCount`
- `edgeCount`
- `fileCount`

`runtime` currently includes:

- `healthOverlay`
- `highlightedNodeIds`
- `highlightColor`
- `focus`
- `guidedFlow`

## MCP / Runtime Tool Shapes

Current graph mutation tools operate on the graph payload:

- `render_graph`
- `apply_graph_patch`
- `add_node`
- `remove_node`
- `update_node`
- `add_edge`
- `remove_edge`

Current runtime-only tools operate on the runtime state payload:

- `highlight_nodes`
- `clear_highlight`
- `navigate_to`
- `guided_flow`
- `set_health_overlay`
