// Graph source tags shared by enrichment, scoped-map, mcp-client, and commands.
//
// Every string that can appear in a graph's `source` field is declared here.
// The priority table determines which graph wins when multiple are candidates.
// Higher priority wins.

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

export const GRAPH_SOURCE_PRIORITY = Object.freeze({
  [GRAPH_SOURCES.SAMPLE]: 0,
  [GRAPH_SOURCES.SEED]: 0,
  [GRAPH_SOURCES.FILE_SHIM]: 0,
  [GRAPH_SOURCES.UNKNOWN]: 0,
  [GRAPH_SOURCES.HEURISTIC]: 10,
  [GRAPH_SOURCES.RUNTIME]: 20,
  [GRAPH_SOURCES.CLAUDE]: 30,
  [GRAPH_SOURCES.CLAUDE_SCOPED]: 30,
  [GRAPH_SOURCES.SCOPED_MAP]: 30,
  [GRAPH_SOURCES.ARCHITECT]: 35,
  [GRAPH_SOURCES.IMPORTED]: 40,
  [GRAPH_SOURCES.MANUAL]: 50,
})

export const DEFAULT_GRAPH_SOURCE_PRIORITY = 5

export function isKnownGraphSource(value) {
  return Object.prototype.hasOwnProperty.call(GRAPH_SOURCE_PRIORITY, value)
}

export function getGraphSourcePriority(value) {
  if (isKnownGraphSource(value)) {
    return GRAPH_SOURCE_PRIORITY[value]
  }
  return DEFAULT_GRAPH_SOURCE_PRIORITY
}
