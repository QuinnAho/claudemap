// Graph JSON validator. Graph payloads are the most-read persisted shape
// (ClaudeMap, scoped maps, runtime graph). The schema pins the fields that
// the skill and the app actually depend on; extra fields are tolerated.

import { fail, isPlainObject, ok, pushTypeError, validateShape } from './shared.js'

const GRAPH_ROOT_SHAPE = {
  meta: 'object',
  nodes: 'array',
  edges: 'array',
}

const NODE_ROOT_SHAPE = {
  id: 'string',
  type: 'string',
}

const EDGE_ROOT_SHAPE = {
  source: 'string',
  target: 'string',
}

export function validateGraph(value) {
  const errors = validateShape(value, GRAPH_ROOT_SHAPE)

  if (errors.length > 0 || !isPlainObject(value)) {
    return fail(errors, value)
  }

  value.nodes.forEach((node, index) => {
    const nodeErrors = validateShape(node, NODE_ROOT_SHAPE, `nodes[${index}]`)
    errors.push(...nodeErrors)
  })

  value.edges.forEach((edge, index) => {
    const edgeErrors = validateShape(edge, EDGE_ROOT_SHAPE, `edges[${index}]`)
    errors.push(...edgeErrors)
  })

  if (value.files !== undefined && !Array.isArray(value.files)) {
    pushTypeError(errors, 'files', 'array', value.files)
  }

  return errors.length === 0 ? ok(value) : fail(errors, value)
}
