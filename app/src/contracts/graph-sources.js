// Graph source tags. Mirror of skill/lib/contracts/graph-sources.js.
// Kept in lockstep by a smoke-test assertion.

export const GRAPH_SOURCES = Object.freeze({
  SAMPLE: 'sample',
  SEED: 'seed',
  FILE_SHIM: 'file-shim',
  HEURISTIC: 'heuristic',
  CLAUDE: 'claude',
  CLAUDE_SCOPED: 'claude-scoped',
  SCOPED_MAP: 'scoped-map',
  IMPORTED: 'imported',
  MANUAL: 'manual',
  RUNTIME: 'runtime',
  ARCHITECT: 'architect',
  UNKNOWN: 'unknown',
})
