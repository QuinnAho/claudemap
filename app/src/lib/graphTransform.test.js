import { describe, expect, it } from 'vitest'
import { transformToReactFlow } from './graphTransform'

// graphTransform.test validates the pure transform that converts ClaudeMap
// graph payloads into ReactFlow-compatible node/edge structures.

describe('transformToReactFlow', () => {
  describe('system nodes', () => {
    it('transforms system nodes with correct type', () => {
      const graphData = {
        nodes: [{ id: 'system-a', type: 'system', label: 'System A' }],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      expect(nodes.length).toBe(1)
      expect(nodes[0].type).toBe('system')
      expect(nodes[0].id).toBe('system-a')
    })

    it('includes data properties from source node', () => {
      const graphData = {
        nodes: [{
          id: 'system-a',
          type: 'system',
          label: 'System A',
          icon: 'server',
          health: 'green',
          healthReason: null,
          summary: 'Main system',
          lineCount: 500,
          filePath: 'src/',
        }],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      expect(nodes[0].data.label).toBe('System A')
      expect(nodes[0].data.icon).toBe('server')
      expect(nodes[0].data.health).toBe('green')
      expect(nodes[0].data.summary).toBe('Main system')
      expect(nodes[0].data.lineCount).toBe(500)
    })

    it('sets parentId and extent for nested systems', () => {
      const graphData = {
        nodes: [
          { id: 'root', type: 'system', label: 'Root' },
          { id: 'child', type: 'system', label: 'Child', parentId: 'root' },
        ],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      const childNode = nodes.find((n) => n.id === 'child')
      expect(childNode.parentId).toBe('root')
      expect(childNode.extent).toBe('parent')
    })

    it('computes childCount and childType', () => {
      const graphData = {
        nodes: [
          { id: 'system', type: 'system', label: 'System' },
          { id: 'file1', type: 'file', label: 'File 1', parentId: 'system' },
          { id: 'file2', type: 'file', label: 'File 2', parentId: 'system' },
        ],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      const systemNode = nodes.find((n) => n.id === 'system')
      expect(systemNode.data.childCount).toBe(2)
      expect(systemNode.data.childType).toBe('file')
    })

    it('computes depth for nested systems', () => {
      const graphData = {
        nodes: [
          { id: 'level0', type: 'system', label: 'L0' },
          { id: 'level1', type: 'system', label: 'L1', parentId: 'level0' },
          { id: 'level2', type: 'system', label: 'L2', parentId: 'level1' },
        ],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      expect(nodes.find((n) => n.id === 'level0').data.depth).toBe(0)
      expect(nodes.find((n) => n.id === 'level1').data.depth).toBe(1)
      expect(nodes.find((n) => n.id === 'level2').data.depth).toBe(2)
    })
  })

  describe('file nodes', () => {
    it('transforms file nodes with correct type', () => {
      const graphData = {
        nodes: [
          { id: 'system', type: 'system', label: 'System' },
          { id: 'file', type: 'file', label: 'index.js', parentId: 'system' },
        ],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      const fileNode = nodes.find((n) => n.id === 'file')
      expect(fileNode.type).toBe('file')
      expect(fileNode.parentId).toBe('system')
      expect(fileNode.extent).toBe('parent')
    })

    it('includes file-specific data', () => {
      const graphData = {
        nodes: [
          { id: 'system', type: 'system', label: 'System' },
          {
            id: 'file',
            type: 'file',
            label: 'index.js',
            parentId: 'system',
            health: 'yellow',
            healthReason: 'Large file',
            summary: 'Entry point',
            lineCount: 350,
            filePath: 'src/index.js',
          },
        ],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      const fileNode = nodes.find((n) => n.id === 'file')
      expect(fileNode.data.label).toBe('index.js')
      expect(fileNode.data.health).toBe('yellow')
      expect(fileNode.data.healthReason).toBe('Large file')
      expect(fileNode.data.parentSystemId).toBe('system')
    })

    it('counts functions in file', () => {
      const graphData = {
        nodes: [
          { id: 'system', type: 'system', label: 'System' },
          { id: 'file', type: 'file', label: 'index.js', parentId: 'system' },
          { id: 'func1', type: 'function', label: 'init', parentId: 'file' },
          { id: 'func2', type: 'function', label: 'cleanup', parentId: 'file' },
        ],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      const fileNode = nodes.find((n) => n.id === 'file')
      expect(fileNode.data.functionCount).toBe(2)
    })
  })

  describe('function nodes', () => {
    it('transforms function nodes with correct type', () => {
      const graphData = {
        nodes: [
          { id: 'system', type: 'system', label: 'System' },
          { id: 'file', type: 'file', label: 'index.js', parentId: 'system' },
          { id: 'func', type: 'function', label: 'doSomething', parentId: 'file' },
        ],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      const funcNode = nodes.find((n) => n.id === 'func')
      expect(funcNode.type).toBe('function')
      expect(funcNode.parentId).toBe('file')
    })

    it('includes parent file and system references', () => {
      const graphData = {
        nodes: [
          { id: 'system', type: 'system', label: 'System' },
          { id: 'file', type: 'file', label: 'index.js', parentId: 'system' },
          { id: 'func', type: 'function', label: 'doSomething', parentId: 'file' },
        ],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      const funcNode = nodes.find((n) => n.id === 'func')
      expect(funcNode.data.parentFileId).toBe('file')
      expect(funcNode.data.parentSystemId).toBe('system')
    })

    it('includes function-specific data', () => {
      const graphData = {
        nodes: [
          { id: 'system', type: 'system', label: 'System' },
          { id: 'file', type: 'file', label: 'index.js', parentId: 'system' },
          {
            id: 'func',
            type: 'function',
            label: 'processData',
            parentId: 'file',
            health: 'red',
            healthReason: 'Too complex',
            summary: 'Processes incoming data',
            lineCount: 150,
            filePath: 'src/index.js:45',
          },
        ],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      const funcNode = nodes.find((n) => n.id === 'func')
      expect(funcNode.data.label).toBe('processData')
      expect(funcNode.data.health).toBe('red')
      expect(funcNode.data.healthReason).toBe('Too complex')
      expect(funcNode.data.lineCount).toBe(150)
    })
  })

  describe('edge transformation', () => {
    it('transforms edges to custom type', () => {
      const graphData = {
        nodes: [
          { id: 'a', type: 'system', label: 'A' },
          { id: 'b', type: 'system', label: 'B' },
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b', type: 'dependency' },
        ],
      }
      const { edges } = transformToReactFlow(graphData)

      expect(edges.length).toBe(1)
      expect(edges[0].id).toBe('e1')
      expect(edges[0].source).toBe('a')
      expect(edges[0].target).toBe('b')
      expect(edges[0].type).toBe('custom')
    })

    it('preserves relationship type in data', () => {
      const graphData = {
        nodes: [
          { id: 'a', type: 'system', label: 'A' },
          { id: 'b', type: 'system', label: 'B' },
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b', type: 'imports' },
        ],
      }
      const { edges } = transformToReactFlow(graphData)

      expect(edges[0].data.relationshipType).toBe('imports')
    })
  })

  describe('filtering', () => {
    it('filters out unknown node types', () => {
      const graphData = {
        nodes: [
          { id: 'system', type: 'system', label: 'System' },
          { id: 'unknown', type: 'unknown', label: 'Unknown' },
        ],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      expect(nodes.length).toBe(1)
      expect(nodes[0].id).toBe('system')
    })
  })

  describe('position assignment', () => {
    it('assigns position to top-level systems at origin', () => {
      const graphData = {
        nodes: [{ id: 'system', type: 'system', label: 'System' }],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      expect(nodes[0].position).toEqual({ x: 0, y: 0 })
    })

    it('assigns positions to nested systems', () => {
      const graphData = {
        nodes: [
          { id: 'root', type: 'system', label: 'Root' },
          { id: 'child1', type: 'system', label: 'Child 1', parentId: 'root' },
          { id: 'child2', type: 'system', label: 'Child 2', parentId: 'root' },
        ],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      const child1 = nodes.find((n) => n.id === 'child1')
      const child2 = nodes.find((n) => n.id === 'child2')

      // Children should have different positions
      expect(child1.position).toBeDefined()
      expect(child2.position).toBeDefined()
      // At least one coordinate should differ
      expect(
        child1.position.x !== child2.position.x ||
        child1.position.y !== child2.position.y
      ).toBe(true)
    })

    it('assigns size dimensions to system nodes', () => {
      const graphData = {
        nodes: [{ id: 'system', type: 'system', label: 'System', lineCount: 100 }],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      expect(nodes[0].width).toBeGreaterThan(0)
      expect(nodes[0].height).toBeGreaterThan(0)
    })

    it('assigns fixed dimensions to file nodes', () => {
      const graphData = {
        nodes: [
          { id: 'system', type: 'system', label: 'System' },
          { id: 'file', type: 'file', label: 'index.js', parentId: 'system' },
        ],
        edges: [],
      }
      const { nodes } = transformToReactFlow(graphData)

      const fileNode = nodes.find((n) => n.id === 'file')
      expect(fileNode.width).toBeGreaterThan(0)
      expect(fileNode.height).toBeGreaterThan(0)
    })
  })

  describe('empty input handling', () => {
    it('handles empty nodes array', () => {
      const graphData = { nodes: [], edges: [] }
      const { nodes, edges } = transformToReactFlow(graphData)

      expect(nodes).toEqual([])
      expect(edges).toEqual([])
    })

    it('handles graph with only edges', () => {
      const graphData = {
        nodes: [],
        edges: [{ id: 'e1', source: 'a', target: 'b' }],
      }
      const { nodes, edges } = transformToReactFlow(graphData)

      expect(nodes).toEqual([])
      expect(edges.length).toBe(1)
    })
  })
})
