import { describe, expect, it } from 'vitest'
import { buildTopLevelLayoutEdges, dedupeBidirectionalLayoutEdges } from './layoutEdges'
import { buildNodeByIdMap } from './graphNodeUtils'

describe('buildTopLevelLayoutEdges', () => {
  it('rewrites nested relationships to top-level systems for placement', () => {
    const nodes = [
      { id: 'system-a', type: 'system' },
      { id: 'file-a', type: 'file', parentId: 'system-a' },
      { id: 'system-b', type: 'system' },
      { id: 'nested-b', type: 'system', parentId: 'system-b' },
    ]
    const nodeById = buildNodeByIdMap(nodes)

    expect(
      buildTopLevelLayoutEdges(
        [{ id: 'file-to-nested', source: 'file-a', target: 'nested-b' }],
        nodeById,
        new Set(['system-a', 'system-b']),
      ),
    ).toEqual([
      { id: 'file-to-nested', source: 'system-a', target: 'system-b' },
    ])
  })
})

describe('dedupeBidirectionalLayoutEdges', () => {
  it('keeps the first edge for a reciprocal pair', () => {
    const edges = [
      { id: 'a-to-b', source: 'a', target: 'b' },
      { id: 'b-to-a', source: 'b', target: 'a' },
      { id: 'b-to-c', source: 'b', target: 'c' },
    ]

    expect(dedupeBidirectionalLayoutEdges(edges)).toEqual([
      { id: 'a-to-b', source: 'a', target: 'b' },
      { id: 'b-to-c', source: 'b', target: 'c' },
    ])
  })

  it('does not mutate the rendered edge list', () => {
    const edges = [
      { id: 'a-to-b', source: 'a', target: 'b' },
      { id: 'b-to-a', source: 'b', target: 'a' },
    ]

    dedupeBidirectionalLayoutEdges(edges)

    expect(edges).toHaveLength(2)
  })
})
