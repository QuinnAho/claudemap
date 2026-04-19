import { describe, expect, it } from 'vitest'
import { diffFiles, diffGraphs } from './differ.js'

// differ.test validates the pure diff functions used by the update command
// to detect changes in the file system and graph structure.

describe('diffFiles', () => {
  describe('added files detection', () => {
    it('returns all files as added when cache is empty', () => {
      const currentFiles = [
        { path: 'src/a.js', lineCount: 10, mtimeMs: 1000 },
        { path: 'src/b.js', lineCount: 20, mtimeMs: 2000 },
      ]
      const result = diffFiles(currentFiles, null)

      expect(result.added).toEqual(currentFiles)
      expect(result.removed).toEqual([])
      expect(result.changed).toEqual([])
    })

    it('returns all files as added when cached files array is missing', () => {
      const currentFiles = [{ path: 'src/a.js', lineCount: 10 }]
      const result = diffFiles(currentFiles, {})

      expect(result.added).toEqual(currentFiles)
    })

    it('detects new files not in cache', () => {
      const currentFiles = [
        { path: 'src/a.js', lineCount: 10 },
        { path: 'src/b.js', lineCount: 20 },
      ]
      const cachedState = {
        files: [{ path: 'src/a.js', lineCount: 10 }],
      }
      const result = diffFiles(currentFiles, cachedState)

      expect(result.added).toEqual([{ path: 'src/b.js', lineCount: 20 }])
    })
  })

  describe('removed files detection', () => {
    it('detects files that were removed', () => {
      const currentFiles = [{ path: 'src/a.js', lineCount: 10 }]
      const cachedState = {
        files: [
          { path: 'src/a.js', lineCount: 10 },
          { path: 'src/b.js', lineCount: 20 },
        ],
      }
      const result = diffFiles(currentFiles, cachedState)

      expect(result.removed).toEqual(['src/b.js'])
    })

    it('returns path strings for removed files', () => {
      const currentFiles = []
      const cachedState = {
        files: [{ path: 'src/deleted.js', lineCount: 50 }],
      }
      const result = diffFiles(currentFiles, cachedState)

      expect(result.removed).toEqual(['src/deleted.js'])
      expect(typeof result.removed[0]).toBe('string')
    })
  })

  describe('changed files detection', () => {
    it('detects files changed by mtime when both have mtimeMs', () => {
      const currentFiles = [{ path: 'src/a.js', lineCount: 10, mtimeMs: 2000 }]
      const cachedState = {
        files: [{ path: 'src/a.js', lineCount: 10, mtimeMs: 1000 }],
      }
      const result = diffFiles(currentFiles, cachedState)

      expect(result.changed).toEqual([{ path: 'src/a.js', lineCount: 10, mtimeMs: 2000 }])
    })

    it('does not mark file changed when mtime is same', () => {
      const currentFiles = [{ path: 'src/a.js', lineCount: 15, mtimeMs: 1000 }]
      const cachedState = {
        files: [{ path: 'src/a.js', lineCount: 10, mtimeMs: 1000 }],
      }
      const result = diffFiles(currentFiles, cachedState)

      // Same mtime means file content is considered unchanged despite lineCount diff
      expect(result.changed).toEqual([])
    })

    it('falls back to lineCount comparison when mtime unavailable', () => {
      const currentFiles = [{ path: 'src/a.js', lineCount: 15 }]
      const cachedState = {
        files: [{ path: 'src/a.js', lineCount: 10 }],
      }
      const result = diffFiles(currentFiles, cachedState)

      expect(result.changed).toEqual([{ path: 'src/a.js', lineCount: 15 }])
    })

    it('uses lineCount when current file lacks mtime', () => {
      const currentFiles = [{ path: 'src/a.js', lineCount: 20 }]
      const cachedState = {
        files: [{ path: 'src/a.js', lineCount: 10, mtimeMs: 1000 }],
      }
      const result = diffFiles(currentFiles, cachedState)

      expect(result.changed).toEqual([{ path: 'src/a.js', lineCount: 20 }])
    })

    it('uses lineCount when cached file lacks mtime', () => {
      const currentFiles = [{ path: 'src/a.js', lineCount: 20, mtimeMs: 1000 }]
      const cachedState = {
        files: [{ path: 'src/a.js', lineCount: 10 }],
      }
      const result = diffFiles(currentFiles, cachedState)

      expect(result.changed).toEqual([{ path: 'src/a.js', lineCount: 20, mtimeMs: 1000 }])
    })

    it('does not mark new files as changed', () => {
      const currentFiles = [
        { path: 'src/a.js', lineCount: 10 },
        { path: 'src/new.js', lineCount: 50 },
      ]
      const cachedState = {
        files: [{ path: 'src/a.js', lineCount: 10 }],
      }
      const result = diffFiles(currentFiles, cachedState)

      expect(result.changed).toEqual([])
      expect(result.added).toEqual([{ path: 'src/new.js', lineCount: 50 }])
    })
  })

  describe('edge cases', () => {
    it('handles non-finite mtime values', () => {
      const currentFiles = [{ path: 'src/a.js', lineCount: 20, mtimeMs: Infinity }]
      const cachedState = {
        files: [{ path: 'src/a.js', lineCount: 10, mtimeMs: 1000 }],
      }
      const result = diffFiles(currentFiles, cachedState)

      // Falls back to lineCount comparison
      expect(result.changed).toEqual([{ path: 'src/a.js', lineCount: 20, mtimeMs: Infinity }])
    })

    it('handles NaN mtime values', () => {
      const currentFiles = [{ path: 'src/a.js', lineCount: 20, mtimeMs: NaN }]
      const cachedState = {
        files: [{ path: 'src/a.js', lineCount: 10, mtimeMs: 1000 }],
      }
      const result = diffFiles(currentFiles, cachedState)

      expect(result.changed).toEqual([{ path: 'src/a.js', lineCount: 20, mtimeMs: NaN }])
    })

    it('handles empty current files', () => {
      const cachedState = {
        files: [{ path: 'src/a.js', lineCount: 10 }],
      }
      const result = diffFiles([], cachedState)

      expect(result.added).toEqual([])
      expect(result.removed).toEqual(['src/a.js'])
      expect(result.changed).toEqual([])
    })
  })
})

describe('diffGraphs', () => {
  describe('node changes', () => {
    it('detects added nodes', () => {
      const previousGraph = {
        nodes: [{ id: 'a', label: 'A' }],
        edges: [],
      }
      const nextGraph = {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        edges: [],
      }
      const result = diffGraphs(previousGraph, nextGraph)

      expect(result.addedNodes).toEqual([{ id: 'b', label: 'B' }])
    })

    it('detects removed nodes as ID strings', () => {
      const previousGraph = {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        edges: [],
      }
      const nextGraph = {
        nodes: [{ id: 'a', label: 'A' }],
        edges: [],
      }
      const result = diffGraphs(previousGraph, nextGraph)

      expect(result.removedNodes).toEqual(['b'])
    })

    it('detects updated node fields', () => {
      const previousGraph = {
        nodes: [{ id: 'a', label: 'Old Label', health: 'green' }],
        edges: [],
      }
      const nextGraph = {
        nodes: [{ id: 'a', label: 'New Label', health: 'green' }],
        edges: [],
      }
      const result = diffGraphs(previousGraph, nextGraph)

      expect(result.updatedNodes).toEqual([
        { nodeId: 'a', fields: { label: 'New Label' } },
      ])
    })

    it('includes all changed fields in update', () => {
      const previousGraph = {
        nodes: [{ id: 'a', label: 'Old', health: 'green', summary: 'Old summary' }],
        edges: [],
      }
      const nextGraph = {
        nodes: [{ id: 'a', label: 'New', health: 'yellow', summary: 'Old summary' }],
        edges: [],
      }
      const result = diffGraphs(previousGraph, nextGraph)

      expect(result.updatedNodes).toEqual([
        { nodeId: 'a', fields: { label: 'New', health: 'yellow' } },
      ])
    })

    it('ignores id field in changed fields', () => {
      const previousGraph = {
        nodes: [{ id: 'a', label: 'Label' }],
        edges: [],
      }
      const nextGraph = {
        nodes: [{ id: 'a', label: 'Label' }],
        edges: [],
      }
      const result = diffGraphs(previousGraph, nextGraph)

      expect(result.updatedNodes).toEqual([])
    })

    it('excludes nodes with no actual changes', () => {
      const previousGraph = {
        nodes: [{ id: 'a', label: 'Same', health: 'green' }],
        edges: [],
      }
      const nextGraph = {
        nodes: [{ id: 'a', label: 'Same', health: 'green' }],
        edges: [],
      }
      const result = diffGraphs(previousGraph, nextGraph)

      expect(result.updatedNodes).toEqual([])
    })

    it('detects nested object changes', () => {
      const previousGraph = {
        nodes: [{ id: 'a', data: { count: 1 } }],
        edges: [],
      }
      const nextGraph = {
        nodes: [{ id: 'a', data: { count: 2 } }],
        edges: [],
      }
      const result = diffGraphs(previousGraph, nextGraph)

      expect(result.updatedNodes).toEqual([
        { nodeId: 'a', fields: { data: { count: 2 } } },
      ])
    })
  })

  describe('edge changes', () => {
    it('detects added edges', () => {
      const previousGraph = {
        nodes: [],
        edges: [{ id: 'e1', source: 'a', target: 'b' }],
      }
      const nextGraph = {
        nodes: [],
        edges: [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'c' },
        ],
      }
      const result = diffGraphs(previousGraph, nextGraph)

      expect(result.addedEdges).toEqual([{ id: 'e2', source: 'b', target: 'c' }])
    })

    it('detects removed edges as ID strings', () => {
      const previousGraph = {
        nodes: [],
        edges: [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'c' },
        ],
      }
      const nextGraph = {
        nodes: [],
        edges: [{ id: 'e1', source: 'a', target: 'b' }],
      }
      const result = diffGraphs(previousGraph, nextGraph)

      expect(result.removedEdges).toEqual(['e2'])
    })
  })

  describe('null/undefined handling', () => {
    it('handles null previous graph', () => {
      const nextGraph = {
        nodes: [{ id: 'a' }],
        edges: [{ id: 'e1' }],
      }
      const result = diffGraphs(null, nextGraph)

      expect(result.addedNodes).toEqual([{ id: 'a' }])
      expect(result.addedEdges).toEqual([{ id: 'e1' }])
      expect(result.removedNodes).toEqual([])
      expect(result.removedEdges).toEqual([])
    })

    it('handles null next graph', () => {
      const previousGraph = {
        nodes: [{ id: 'a' }],
        edges: [{ id: 'e1' }],
      }
      const result = diffGraphs(previousGraph, null)

      expect(result.addedNodes).toEqual([])
      expect(result.addedEdges).toEqual([])
      expect(result.removedNodes).toEqual(['a'])
      expect(result.removedEdges).toEqual(['e1'])
    })

    it('handles graphs with missing nodes array', () => {
      const previousGraph = { edges: [] }
      const nextGraph = { nodes: [{ id: 'a' }], edges: [] }
      const result = diffGraphs(previousGraph, nextGraph)

      expect(result.addedNodes).toEqual([{ id: 'a' }])
    })

    it('handles graphs with missing edges array', () => {
      const previousGraph = { nodes: [] }
      const nextGraph = { nodes: [], edges: [{ id: 'e1' }] }
      const result = diffGraphs(previousGraph, nextGraph)

      expect(result.addedEdges).toEqual([{ id: 'e1' }])
    })
  })

  describe('complex scenarios', () => {
    it('handles simultaneous adds, removes, and updates', () => {
      const previousGraph = {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'c' },
        ],
      }
      const nextGraph = {
        nodes: [
          { id: 'a', label: 'A Updated' },
          { id: 'c', label: 'C' },
          { id: 'd', label: 'D' },
        ],
        edges: [
          { id: 'e2', source: 'b', target: 'c' },
          { id: 'e3', source: 'c', target: 'd' },
        ],
      }
      const result = diffGraphs(previousGraph, nextGraph)

      expect(result.addedNodes).toEqual([{ id: 'd', label: 'D' }])
      expect(result.removedNodes).toEqual(['b'])
      expect(result.updatedNodes).toEqual([{ nodeId: 'a', fields: { label: 'A Updated' } }])
      expect(result.addedEdges).toEqual([{ id: 'e3', source: 'c', target: 'd' }])
      expect(result.removedEdges).toEqual(['e1'])
    })
  })
})
