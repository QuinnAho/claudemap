import { describe, expect, it } from 'vitest'
import {
  areStringArraysEqual,
  computeChildIndexes,
  computeRevealedFileIds,
  computeExpandedSystemIds,
  computeVisibleNodes,
  computeRewrittenVisibleEdges,
  computeConnectedSystemIds,
} from './graphView'
import { buildNodeByIdMap } from './graphNodeUtils'
import { PRESENTATION_MODES } from '../contracts/presentation'
import { ZOOM_LEVELS } from '../contracts/zoom'

// graphView.test validates the pure projection helpers that transform raw store
// state into the derived shapes ReactFlow needs. No React dependencies.

describe('areStringArraysEqual', () => {
  it('returns true for identical arrays', () => {
    expect(areStringArraysEqual(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true)
  })

  it('returns true for empty arrays', () => {
    expect(areStringArraysEqual([], [])).toBe(true)
  })

  it('returns false for different lengths', () => {
    expect(areStringArraysEqual(['a', 'b'], ['a', 'b', 'c'])).toBe(false)
  })

  it('returns false for different elements', () => {
    expect(areStringArraysEqual(['a', 'b'], ['a', 'c'])).toBe(false)
  })

  it('returns false for same elements in different order', () => {
    expect(areStringArraysEqual(['a', 'b'], ['b', 'a'])).toBe(false)
  })

  it('handles undefined by treating as empty', () => {
    expect(areStringArraysEqual(undefined, [])).toBe(true)
    expect(areStringArraysEqual([], undefined)).toBe(true)
    expect(areStringArraysEqual(undefined, undefined)).toBe(true)
  })
})

describe('computeChildIndexes', () => {
  it('counts children per parent', () => {
    const nodes = [
      { id: 'root', type: 'system' },
      { id: 'child1', type: 'file', parentId: 'root' },
      { id: 'child2', type: 'file', parentId: 'root' },
    ]
    const { childCountByParentId } = computeChildIndexes(nodes)

    expect(childCountByParentId.get('root')).toBe(2)
  })

  it('assigns function indexes within parent', () => {
    const nodes = [
      { id: 'file', type: 'file' },
      { id: 'func1', type: 'function', parentId: 'file' },
      { id: 'func2', type: 'function', parentId: 'file' },
      { id: 'func3', type: 'function', parentId: 'file' },
    ]
    const { functionIndexById } = computeChildIndexes(nodes)

    expect(functionIndexById.get('func1')).toBe(0)
    expect(functionIndexById.get('func2')).toBe(1)
    expect(functionIndexById.get('func3')).toBe(2)
  })

  it('does not assign indexes to non-function nodes', () => {
    const nodes = [
      { id: 'root', type: 'system' },
      { id: 'file', type: 'file', parentId: 'root' },
    ]
    const { functionIndexById } = computeChildIndexes(nodes)

    expect(functionIndexById.has('file')).toBe(false)
  })
})

describe('computeRevealedFileIds', () => {
  const nodes = [
    { id: 'system', type: 'system' },
    { id: 'file1', type: 'file', parentId: 'system' },
    { id: 'file2', type: 'file', parentId: 'system' },
    { id: 'func1', type: 'function', parentId: 'file1' },
  ]
  const nodeById = buildNodeByIdMap(nodes)

  it('reveals file when selected', () => {
    const selectedNode = { id: 'file1' }
    const result = computeRevealedFileIds(nodeById, selectedNode, null, [])

    expect(result.has('file1')).toBe(true)
  })

  it('reveals parent file when function is selected', () => {
    const selectedNode = { id: 'func1' }
    const result = computeRevealedFileIds(nodeById, selectedNode, null, [])

    expect(result.has('file1')).toBe(true)
  })

  it('reveals file via focusRequest', () => {
    const focusRequest = { nodeId: 'file2' }
    const result = computeRevealedFileIds(nodeById, null, focusRequest, [])

    expect(result.has('file2')).toBe(true)
  })

  it('reveals files via highlightedNodes', () => {
    const result = computeRevealedFileIds(nodeById, null, null, ['file1', 'file2'])

    expect(result.has('file1')).toBe(true)
    expect(result.has('file2')).toBe(true)
  })

  it('reveals parent file when function is highlighted', () => {
    const result = computeRevealedFileIds(nodeById, null, null, ['func1'])

    expect(result.has('file1')).toBe(true)
  })

  it('ignores system nodes', () => {
    const result = computeRevealedFileIds(nodeById, null, null, ['system'])

    expect(result.size).toBe(0)
  })
})

describe('computeExpandedSystemIds', () => {
  const nodes = [
    { id: 'root', type: 'system' },
    { id: 'child', type: 'system', parentId: 'root' },
    { id: 'file', type: 'file', parentId: 'child' },
  ]
  const nodeById = buildNodeByIdMap(nodes)

  it('returns empty sets in overview mode', () => {
    const result = computeExpandedSystemIds({
      nodeById,
      zoomLevel: ZOOM_LEVELS.OVERVIEW,
      presentationMode: PRESENTATION_MODES.FREE,
      highlightedNodes: ['child'],
      focusRequest: null,
      selectedNode: null,
      hoveredPathIds: ['root'],
      focusPathIds: [],
    })

    expect(result.expandedSystemIds.size).toBe(0)
    expect(result.runtimeExpandedSystemIds.size).toBe(0)
  })

  it('expands system path for selected node in free mode', () => {
    const result = computeExpandedSystemIds({
      nodeById,
      zoomLevel: ZOOM_LEVELS.DETAILED,
      presentationMode: PRESENTATION_MODES.FREE,
      highlightedNodes: [],
      focusRequest: null,
      selectedNode: { id: 'file' },
      hoveredPathIds: [],
      focusPathIds: [],
    })

    expect(result.runtimeExpandedSystemIds.has('root')).toBe(true)
    expect(result.runtimeExpandedSystemIds.has('child')).toBe(true)
  })

  it('includes hovered paths in free mode', () => {
    const result = computeExpandedSystemIds({
      nodeById,
      zoomLevel: ZOOM_LEVELS.DETAILED,
      presentationMode: PRESENTATION_MODES.FREE,
      highlightedNodes: [],
      focusRequest: null,
      selectedNode: null,
      hoveredPathIds: ['root', 'child'],
      focusPathIds: [],
    })

    expect(result.expandedSystemIds.has('root')).toBe(true)
    expect(result.expandedSystemIds.has('child')).toBe(true)
  })

  it('ignores hovered paths in locked mode', () => {
    const result = computeExpandedSystemIds({
      nodeById,
      zoomLevel: ZOOM_LEVELS.DETAILED,
      presentationMode: PRESENTATION_MODES.LOCKED,
      highlightedNodes: [],
      focusRequest: null,
      selectedNode: null,
      hoveredPathIds: ['root', 'child'],
      focusPathIds: [],
    })

    // In locked mode, hoveredPathIds are not added to expandedSystemIds
    expect(result.expandedSystemIds.has('root')).toBe(false)
    expect(result.expandedSystemIds.has('child')).toBe(false)
  })

  it('uses focusPathIds in guided mode', () => {
    const result = computeExpandedSystemIds({
      nodeById,
      zoomLevel: ZOOM_LEVELS.DETAILED,
      presentationMode: PRESENTATION_MODES.GUIDED,
      highlightedNodes: [],
      focusRequest: null,
      selectedNode: null,
      hoveredPathIds: [],
      focusPathIds: ['root', 'child'],
    })

    expect(result.runtimeExpandedSystemIds.has('root')).toBe(true)
    expect(result.runtimeExpandedSystemIds.has('child')).toBe(true)
  })

  it('expands for highlighted nodes', () => {
    const result = computeExpandedSystemIds({
      nodeById,
      zoomLevel: ZOOM_LEVELS.DETAILED,
      presentationMode: PRESENTATION_MODES.FREE,
      highlightedNodes: ['file'],
      focusRequest: null,
      selectedNode: null,
      hoveredPathIds: [],
      focusPathIds: [],
    })

    expect(result.runtimeExpandedSystemIds.has('root')).toBe(true)
    expect(result.runtimeExpandedSystemIds.has('child')).toBe(true)
  })
})

describe('computeVisibleNodes', () => {
  const nodes = [
    { id: 'root', type: 'system' },
    { id: 'child', type: 'system', parentId: 'root' },
    { id: 'file', type: 'file', parentId: 'child' },
  ]
  const nodeById = buildNodeByIdMap(nodes)

  it('shows only top-level systems in overview', () => {
    const result = computeVisibleNodes({
      nodes,
      expandedSystemIds: new Set(),
      zoomLevel: ZOOM_LEVELS.OVERVIEW,
      nodeById,
      revealedFileIds: new Set(),
    })

    expect(result.map((n) => n.id)).toEqual(['root'])
  })

  it('shows nested nodes when expanded', () => {
    const result = computeVisibleNodes({
      nodes,
      expandedSystemIds: new Set(['root', 'child']),
      zoomLevel: ZOOM_LEVELS.DETAILED,
      nodeById,
      revealedFileIds: new Set(),
    })

    expect(result.map((n) => n.id)).toEqual(['root', 'child', 'file'])
  })

  it('hides nested nodes when parent not expanded', () => {
    const result = computeVisibleNodes({
      nodes,
      expandedSystemIds: new Set(['root']),
      zoomLevel: ZOOM_LEVELS.DETAILED,
      nodeById,
      revealedFileIds: new Set(),
    })

    expect(result.map((n) => n.id)).toEqual(['root', 'child'])
    expect(result.find((n) => n.id === 'file')).toBeUndefined()
  })
})

describe('computeRewrittenVisibleEdges', () => {
  const nodes = [
    { id: 'systemA', type: 'system' },
    { id: 'fileA', type: 'file', parentId: 'systemA' },
    { id: 'systemB', type: 'system' },
    { id: 'fileB', type: 'file', parentId: 'systemB' },
    { id: 'nestedSystemA', type: 'system', parentId: 'systemA' },
  ]
  const nodeById = buildNodeByIdMap(nodes)

  it('rewrites file-level edges to system-level', () => {
    const edges = [
      { id: 'e1', source: 'fileA', target: 'fileB', type: 'dependency' },
    ]
    const visibleNodeIds = new Set(['systemA', 'systemB'])

    const result = computeRewrittenVisibleEdges(edges, nodeById, visibleNodeIds)

    expect(result.length).toBe(1)
    expect(result[0].source).toBe('systemA')
    expect(result[0].target).toBe('systemB')
  })

  it('drops self-loop edges after rewriting', () => {
    const edges = [
      { id: 'e1', source: 'fileA', target: 'nestedSystemA', type: 'dependency' },
    ]
    const visibleNodeIds = new Set(['systemA'])

    const result = computeRewrittenVisibleEdges(edges, nodeById, visibleNodeIds)

    expect(result.length).toBe(0)
  })

  it('deduplicates rewritten edges by key', () => {
    const edges = [
      { id: 'e1', source: 'fileA', target: 'fileB' },
      { id: 'e2', source: 'nestedSystemA', target: 'fileB' },
    ]
    const visibleNodeIds = new Set(['systemA', 'systemB'])

    const result = computeRewrittenVisibleEdges(edges, nodeById, visibleNodeIds)

    // Both edges rewrite to systemA -> systemB, but only one kept
    expect(result.length).toBe(1)
  })

  it('drops edges when endpoint not visible', () => {
    const edges = [
      { id: 'e1', source: 'fileA', target: 'fileB' },
    ]
    const visibleNodeIds = new Set(['systemA']) // systemB not visible

    const result = computeRewrittenVisibleEdges(edges, nodeById, visibleNodeIds)

    expect(result.length).toBe(0)
  })
})

describe('computeConnectedSystemIds', () => {
  const nodes = [
    { id: 'systemA', type: 'system' },
    { id: 'systemB', type: 'system' },
    { id: 'systemC', type: 'system' },
  ]
  const nodeById = buildNodeByIdMap(nodes)

  const visibleEdges = [
    { id: 'e1', source: 'systemA', target: 'systemB' },
    { id: 'e2', source: 'systemA', target: 'systemC' },
  ]

  it('returns empty set when no selection', () => {
    const result = computeConnectedSystemIds({
      visibleEdges,
      nodeById,
      presentationMode: PRESENTATION_MODES.FREE,
      selectedSystemId: null,
    })

    expect(result.size).toBe(0)
  })

  it('finds connected systems in free mode', () => {
    const result = computeConnectedSystemIds({
      visibleEdges,
      nodeById,
      presentationMode: PRESENTATION_MODES.FREE,
      selectedSystemId: 'systemA',
    })

    expect(result.has('systemB')).toBe(true)
    expect(result.has('systemC')).toBe(true)
    expect(result.has('systemA')).toBe(false)
  })

  it('finds systems connected as source when selected is target', () => {
    const result = computeConnectedSystemIds({
      visibleEdges,
      nodeById,
      presentationMode: PRESENTATION_MODES.FREE,
      selectedSystemId: 'systemB',
    })

    expect(result.has('systemA')).toBe(true)
    expect(result.has('systemC')).toBe(false)
  })

  it('returns empty in non-free presentation mode', () => {
    const result = computeConnectedSystemIds({
      visibleEdges,
      nodeById,
      presentationMode: PRESENTATION_MODES.GUIDED,
      selectedSystemId: 'systemA',
    })

    expect(result.size).toBe(0)
  })
})
