import { GRAPH_SOURCES } from '../contracts/graph-sources.js'

// source-priority owns the "which graph wins" policy used every time the
// setup/update/create-map commands merge a freshly produced graph into an
// existing cache. The priority table here is the historical enrichment
// ladder - intentionally narrower than the contract-level table in
// contracts/graph-sources.js. Unknown tags land at DEFAULT_PRIORITY (5) so
// they slot between the zero tier (sample/seed/shim) and the heuristic
// tier.
//
//   getGraphSourcePriority(sourceOrGraph) - accepts either a source string
//     or a graph with meta.source, returns a numeric priority.
//
//   shouldPreserveExistingGraph / selectPreferredGraph - the actual policy:
//     keep the existing graph only when it outranks the candidate AND the
//     caller did not explicitly ask to overwrite (forceRefresh or an
//     explicit enrichment override both bypass the check).

const GRAPH_SOURCE_PRIORITY = {
  [GRAPH_SOURCES.SAMPLE]: 0,
  [GRAPH_SOURCES.SEED]: 0,
  [GRAPH_SOURCES.FILE_SHIM]: 0,
  [GRAPH_SOURCES.HEURISTIC]: 10,
  [GRAPH_SOURCES.CLAUDE]: 30,
  [GRAPH_SOURCES.IMPORTED]: 40,
  [GRAPH_SOURCES.MANUAL]: 50,
}

const DEFAULT_PRIORITY = 5

function normalizeGraphSource(sourceValue) {
  if (typeof sourceValue === 'string') {
    return sourceValue.trim().toLowerCase()
  }

  return String(sourceValue?.meta?.source || '').trim().toLowerCase()
}

export function getGraphSourcePriority(sourceValue) {
  const normalizedSource = normalizeGraphSource(sourceValue)
  return GRAPH_SOURCE_PRIORITY[normalizedSource] ?? DEFAULT_PRIORITY
}

export function shouldPreserveExistingGraph(existingGraph, candidateGraph, options = {}) {
  if (!existingGraph || !candidateGraph) {
    return false
  }

  if (options.forceRefresh || options.allowLowerPriorityOverwrite) {
    return false
  }

  return getGraphSourcePriority(existingGraph) > getGraphSourcePriority(candidateGraph)
}

export function selectPreferredGraph(existingGraph, candidateGraph, options = {}) {
  const preservedExisting = shouldPreserveExistingGraph(existingGraph, candidateGraph, options)

  return {
    graph: preservedExisting ? existingGraph : candidateGraph,
    preservedExisting,
    existingSource: existingGraph?.meta?.source || 'none',
    candidateSource: candidateGraph?.meta?.source || 'none',
  }
}
