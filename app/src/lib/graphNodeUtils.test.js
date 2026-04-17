import { describe, expect, it } from 'vitest'
import {
  buildNodeByIdMap,
  isDescendantOf,
  isAncestorOf,
  isNodeInSelectedBranch,
  getTopLevelSystemId,
  getSystemPath,
  getNodeAbsolutePosition,
  isNodeVisible,
} from './graphNodeUtils'

// graphNodeUtils.test validates the pure graph traversal helpers used by the
// canvas rendering logic. These functions take a nodeById map (built from raw
// nodes) and answer ancestry, visibility, and position queries.

function buildTestNodeMap(nodes) {
  return buildNodeByIdMap(nodes)
}

describe('buildNodeByIdMap', () => {
  it('returns a Map keyed by node.id', () => {
    const nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]
    const map = buildNodeByIdMap(nodes)

    expect(map instanceof Map).toBe(true)
    expect(map.get('a')).toEqual({ id: 'a', label: 'A' })
    expect(map.get('b')).toEqual({ id: 'b', label: 'B' })
  })

  it('handles empty array', () => {
    const map = buildNodeByIdMap([])
    expect(map.size).toBe(0)
  })
})

describe('isDescendantOf', () => {
  it('returns true for direct child', () => {
    const nodes = [
      { id: 'parent', type: 'system' },
      { id: 'child', type: 'file', parentId: 'parent' },
    ]
    const nodeById = buildTestNodeMap(nodes)

    expect(isDescendantOf('child', 'parent', nodeById)).toBe(true)
  })

  it('returns true for deeply nested descendant', () => {
    const nodes = [
      { id: 'grandparent', type: 'system' },
      { id: 'parent', type: 'system', parentId: 'grandparent' },
      { id: 'child', type: 'file', parentId: 'parent' },
    ]
    const nodeById = buildTestNodeMap(nodes)

    expect(isDescendantOf('child', 'grandparent', nodeById)).toBe(true)
  })

  it('returns false for sibling', () => {
    const nodes = [
      { id: 'parent', type: 'system' },
      { id: 'child1', type: 'file', parentId: 'parent' },
      { id: 'child2', type: 'file', parentId: 'parent' },
    ]
    const nodeById = buildTestNodeMap(nodes)

    expect(isDescendantOf('child1', 'child2', nodeById)).toBe(false)
  })

  it('returns false for ancestor (wrong direction)', () => {
    const nodes = [
      { id: 'parent', type: 'system' },
      { id: 'child', type: 'file', parentId: 'parent' },
    ]
    const nodeById = buildTestNodeMap(nodes)

    expect(isDescendantOf('parent', 'child', nodeById)).toBe(false)
  })

  it('returns false for null/undefined nodeId', () => {
    const nodeById = buildTestNodeMap([{ id: 'a' }])

    expect(isDescendantOf(null, 'a', nodeById)).toBe(false)
    expect(isDescendantOf(undefined, 'a', nodeById)).toBe(false)
  })

  it('returns false for null/undefined ancestorId', () => {
    const nodeById = buildTestNodeMap([{ id: 'a' }])

    expect(isDescendantOf('a', null, nodeById)).toBe(false)
    expect(isDescendantOf('a', undefined, nodeById)).toBe(false)
  })
})

describe('isAncestorOf', () => {
  it('returns true when node is ancestor of descendant', () => {
    const nodes = [
      { id: 'parent', type: 'system' },
      { id: 'child', type: 'file', parentId: 'parent' },
    ]
    const nodeById = buildTestNodeMap(nodes)

    expect(isAncestorOf('parent', 'child', nodeById)).toBe(true)
  })

  it('returns false when node is not ancestor', () => {
    const nodes = [
      { id: 'parent', type: 'system' },
      { id: 'child', type: 'file', parentId: 'parent' },
    ]
    const nodeById = buildTestNodeMap(nodes)

    expect(isAncestorOf('child', 'parent', nodeById)).toBe(false)
  })
})

describe('isNodeInSelectedBranch', () => {
  const nodes = [
    { id: 'root', type: 'system' },
    { id: 'system1', type: 'system', parentId: 'root' },
    { id: 'file1', type: 'file', parentId: 'system1' },
    { id: 'system2', type: 'system', parentId: 'root' },
  ]
  const nodeById = buildTestNodeMap(nodes)

  it('returns false when no selectedNode', () => {
    expect(isNodeInSelectedBranch(nodes[0], null, nodeById)).toBe(false)
  })

  it('returns true for the selected node itself', () => {
    const selectedNode = { id: 'system1' }
    const node = nodes.find((n) => n.id === 'system1')

    expect(isNodeInSelectedBranch(node, selectedNode, nodeById)).toBe(true)
  })

  it('returns true for descendant of selected node', () => {
    const selectedNode = { id: 'system1' }
    const node = nodes.find((n) => n.id === 'file1')

    expect(isNodeInSelectedBranch(node, selectedNode, nodeById)).toBe(true)
  })

  it('returns true for ancestor of selected node', () => {
    const selectedNode = { id: 'file1' }
    const node = nodes.find((n) => n.id === 'system1')

    expect(isNodeInSelectedBranch(node, selectedNode, nodeById)).toBe(true)
  })

  it('returns false for unrelated node', () => {
    const selectedNode = { id: 'system1' }
    const node = nodes.find((n) => n.id === 'system2')

    expect(isNodeInSelectedBranch(node, selectedNode, nodeById)).toBe(false)
  })
})

describe('getTopLevelSystemId', () => {
  it('returns null for null node', () => {
    const nodeById = buildTestNodeMap([])
    expect(getTopLevelSystemId(null, nodeById)).toBe(null)
  })

  it('returns node id for top-level system', () => {
    const nodes = [{ id: 'root', type: 'system' }]
    const nodeById = buildTestNodeMap(nodes)

    expect(getTopLevelSystemId(nodes[0], nodeById)).toBe('root')
  })

  it('returns top-level ancestor for nested system', () => {
    const nodes = [
      { id: 'root', type: 'system' },
      { id: 'nested', type: 'system', parentId: 'root' },
      { id: 'deepNested', type: 'system', parentId: 'nested' },
    ]
    const nodeById = buildTestNodeMap(nodes)

    expect(getTopLevelSystemId(nodes[2], nodeById)).toBe('root')
  })

  it('returns top-level system for file node', () => {
    const nodes = [
      { id: 'root', type: 'system' },
      { id: 'file', type: 'file', parentId: 'root' },
    ]
    const nodeById = buildTestNodeMap(nodes)

    expect(getTopLevelSystemId(nodes[1], nodeById)).toBe('root')
  })

  it('handles file with data.parentSystemId fallback', () => {
    const nodes = [
      { id: 'root', type: 'system' },
      { id: 'file', type: 'file', data: { parentSystemId: 'root' } },
    ]
    const nodeById = buildTestNodeMap(nodes)

    expect(getTopLevelSystemId(nodes[1], nodeById)).toBe('root')
  })
})

describe('getSystemPath', () => {
  const nodes = [
    { id: 'root', type: 'system' },
    { id: 'middle', type: 'system', parentId: 'root' },
    { id: 'leaf', type: 'system', parentId: 'middle' },
    { id: 'file', type: 'file', parentId: 'leaf' },
  ]
  const nodeById = buildTestNodeMap(nodes)

  it('returns empty array for null node', () => {
    expect(getSystemPath(null, nodeById)).toEqual([])
  })

  it('returns empty array for unknown nodeId', () => {
    expect(getSystemPath('unknown', nodeById)).toEqual([])
  })

  it('returns path including self for system node', () => {
    expect(getSystemPath('leaf', nodeById)).toEqual(['root', 'middle', 'leaf'])
  })

  it('returns path excluding self when includeSelf=false', () => {
    expect(getSystemPath('leaf', nodeById, false)).toEqual(['root', 'middle'])
  })

  it('returns ancestor systems for file node', () => {
    expect(getSystemPath('file', nodeById)).toEqual(['root', 'middle', 'leaf'])
  })

  it('accepts node object instead of string', () => {
    const leafNode = nodes[2]
    expect(getSystemPath(leafNode, nodeById)).toEqual(['root', 'middle', 'leaf'])
  })

  it('returns single-element path for top-level system', () => {
    expect(getSystemPath('root', nodeById)).toEqual(['root'])
  })
})

describe('getNodeAbsolutePosition', () => {
  it('returns null for null node', () => {
    const nodeById = buildTestNodeMap([])
    expect(getNodeAbsolutePosition(null, nodeById)).toBe(null)
  })

  it('returns null for unknown nodeId', () => {
    const nodeById = buildTestNodeMap([{ id: 'a', position: { x: 10, y: 20 } }])
    expect(getNodeAbsolutePosition('unknown', nodeById)).toBe(null)
  })

  it('returns position directly for top-level node', () => {
    const nodes = [{ id: 'root', position: { x: 100, y: 200 } }]
    const nodeById = buildTestNodeMap(nodes)

    expect(getNodeAbsolutePosition('root', nodeById)).toEqual({ x: 100, y: 200 })
  })

  it('sums parent positions for nested node', () => {
    const nodes = [
      { id: 'parent', position: { x: 100, y: 200 } },
      { id: 'child', parentId: 'parent', position: { x: 10, y: 20 } },
    ]
    const nodeById = buildTestNodeMap(nodes)

    expect(getNodeAbsolutePosition('child', nodeById)).toEqual({ x: 110, y: 220 })
  })

  it('handles deeply nested nodes', () => {
    const nodes = [
      { id: 'a', position: { x: 100, y: 100 } },
      { id: 'b', parentId: 'a', position: { x: 50, y: 50 } },
      { id: 'c', parentId: 'b', position: { x: 25, y: 25 } },
    ]
    const nodeById = buildTestNodeMap(nodes)

    expect(getNodeAbsolutePosition('c', nodeById)).toEqual({ x: 175, y: 175 })
  })

  it('defaults missing position to 0,0', () => {
    const nodes = [
      { id: 'parent' },
      { id: 'child', parentId: 'parent', position: { x: 10, y: 20 } },
    ]
    const nodeById = buildTestNodeMap(nodes)

    expect(getNodeAbsolutePosition('child', nodeById)).toEqual({ x: 10, y: 20 })
  })

  it('accepts node object instead of string', () => {
    const nodes = [{ id: 'a', position: { x: 50, y: 75 } }]
    const nodeById = buildTestNodeMap(nodes)

    expect(getNodeAbsolutePosition(nodes[0], nodeById)).toEqual({ x: 50, y: 75 })
  })
})

describe('isNodeVisible', () => {
  const nodes = [
    { id: 'root', type: 'system' },
    { id: 'child', type: 'system', parentId: 'root' },
    { id: 'file', type: 'file', parentId: 'child' },
    { id: 'func', type: 'function', parentId: 'file' },
    { id: 'orphanFile', type: 'file' },
  ]
  const nodeById = buildTestNodeMap(nodes)

  describe('overview mode', () => {
    it('shows only top-level systems in overview', () => {
      expect(isNodeVisible(nodes[0], new Set(), true, nodeById)).toBe(true)
    })

    it('hides nested systems in overview', () => {
      expect(isNodeVisible(nodes[1], new Set(), true, nodeById)).toBe(false)
    })

    it('hides files in overview', () => {
      expect(isNodeVisible(nodes[2], new Set(), true, nodeById)).toBe(false)
    })
  })

  describe('detail mode', () => {
    it('shows top-level systems', () => {
      expect(isNodeVisible(nodes[0], new Set(), false, nodeById)).toBe(true)
    })

    it('shows nested systems when parent is expanded', () => {
      const expanded = new Set(['root'])
      expect(isNodeVisible(nodes[1], expanded, false, nodeById)).toBe(true)
    })

    it('hides nested systems when parent not expanded', () => {
      expect(isNodeVisible(nodes[1], new Set(), false, nodeById)).toBe(false)
    })

    it('shows files when parent system is expanded', () => {
      const expanded = new Set(['root', 'child'])
      expect(isNodeVisible(nodes[2], expanded, false, nodeById)).toBe(true)
    })

    it('hides files when parent not expanded', () => {
      const expanded = new Set(['root'])
      expect(isNodeVisible(nodes[2], expanded, false, nodeById)).toBe(false)
    })

    it('hides functions by default', () => {
      const expanded = new Set(['root', 'child'])
      expect(isNodeVisible(nodes[3], expanded, false, nodeById)).toBe(false)
    })

    it('shows functions when parent file is revealed', () => {
      const expanded = new Set(['root', 'child'])
      const revealedFileIds = new Set(['file'])
      expect(isNodeVisible(nodes[3], expanded, false, nodeById, revealedFileIds)).toBe(true)
    })

    it('hides functions without parentId', () => {
      const funcWithoutParent = { id: 'orphanFunc', type: 'function' }
      const nodeByIdWithOrphan = buildTestNodeMap([...nodes, funcWithoutParent])
      expect(isNodeVisible(funcWithoutParent, new Set(), false, nodeByIdWithOrphan)).toBe(false)
    })
  })

  describe('visibility through ancestry chain', () => {
    it('requires all ancestor systems to be expanded', () => {
      const deepNodes = [
        { id: 'level0', type: 'system' },
        { id: 'level1', type: 'system', parentId: 'level0' },
        { id: 'level2', type: 'system', parentId: 'level1' },
        { id: 'level3', type: 'system', parentId: 'level2' },
      ]
      const deepNodeById = buildTestNodeMap(deepNodes)

      // Only expand some ancestors
      const partialExpanded = new Set(['level0', 'level1'])
      expect(isNodeVisible(deepNodes[3], partialExpanded, false, deepNodeById)).toBe(false)

      // Expand all ancestors
      const fullyExpanded = new Set(['level0', 'level1', 'level2'])
      expect(isNodeVisible(deepNodes[3], fullyExpanded, false, deepNodeById)).toBe(true)
    })
  })
})
