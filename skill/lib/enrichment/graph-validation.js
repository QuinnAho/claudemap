// graph-validation owns the "does this look like a graph" contract.
//
// The @claudemap-architect subagent returns free-form text that usually wraps
// the JSON payload in code fences and prose. parseGraphResponse does two
// passes: first it strips fences and tries the whole body, then it extracts
// the first {...} block if that fails. Both passes feed validateGraph, which
// enforces node/edge shape invariants the renderer relies on.
//
// validateGraph is exported too because the heuristic path also runs its
// output through it before shipping, so any invariant we add here protects
// every enrichment surface at once.

function stripCodeFences(responseText) {
  return responseText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function extractFirstJSONObject(responseText) {
  const start = responseText.indexOf('{')
  const end = responseText.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    return responseText
  }

  return responseText.slice(start, end + 1)
}

export function validateGraph(graph) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error('Graph payload must include nodes[] and edges[]')
  }

  for (const node of graph.nodes) {
    if (!node || typeof node !== 'object') {
      throw new Error('Graph nodes must be objects')
    }

    if (!node.id || !node.label || !node.type) {
      throw new Error('Graph nodes require id, label, and type')
    }

    if (!Object.prototype.hasOwnProperty.call(node, 'parentId')) {
      throw new Error(`Graph node ${node.id} is missing parentId`)
    }

    if (!Object.prototype.hasOwnProperty.call(node, 'filePath')) {
      throw new Error(`Graph node ${node.id} is missing filePath`)
    }
  }

  for (const edge of graph.edges) {
    if (!edge?.id || !edge?.source || !edge?.target || !edge?.type) {
      throw new Error('Graph edges require id, source, target, and type')
    }
  }

  return graph
}

export function parseGraphResponse(responseText) {
  const candidates = [
    stripCodeFences(responseText),
    extractFirstJSONObject(stripCodeFences(responseText)),
  ]
  let lastError = null

  for (const candidate of candidates) {
    try {
      return validateGraph(JSON.parse(candidate))
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('Unable to parse graph response')
}
