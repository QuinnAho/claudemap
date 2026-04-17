import { describe, expect, it } from 'vitest'
import { resolveScopeAgainstGraph } from './scope-resolution.js'

// scope-resolution.test validates the five fallback strategies documented
// in scope-resolution.js: id, path, fingerprint, ancestor-label, label.
// Each test constructs a minimal graph and scope to exercise one strategy.

function makeSystemNode(id, label, opts = {}) {
  return {
    id,
    label,
    type: 'system',
    parentId: opts.parentId || null,
    filePath: opts.filePath || null,
  }
}

function makeGraph(nodes) {
  return { nodes, edges: [] }
}

describe('resolveScopeAgainstGraph', () => {
  describe('strategy: id', () => {
    it('matches by exact rootSystemId', () => {
      const graph = makeGraph([
        makeSystemNode('system-auth', 'Auth'),
        makeSystemNode('system-db', 'Database'),
      ])
      const scope = { rootSystemId: 'system-auth' }

      const result = resolveScopeAgainstGraph(scope, graph)

      expect(result).not.toBeNull()
      expect(result.system.id).toBe('system-auth')
      expect(result.strategy).toBe('id')
    })

    it('returns null when id does not exist', () => {
      const graph = makeGraph([makeSystemNode('system-auth', 'Auth')])
      const scope = { rootSystemId: 'system-missing' }

      const result = resolveScopeAgainstGraph(scope, graph)

      expect(result).toBeNull()
    })
  })

  describe('strategy: path', () => {
    it('matches by unique filePath when id misses', () => {
      const graph = makeGraph([
        makeSystemNode('new-auth-id', 'Auth', { filePath: 'src/auth' }),
        makeSystemNode('system-db', 'Database', { filePath: 'src/db' }),
      ])
      const scope = {
        rootSystemId: 'old-auth-id',
        filePathHint: 'src/auth',
      }

      const result = resolveScopeAgainstGraph(scope, graph)

      expect(result).not.toBeNull()
      expect(result.system.id).toBe('new-auth-id')
      expect(result.strategy).toBe('path')
    })

    it('normalizes backslashes in path matching', () => {
      const graph = makeGraph([
        makeSystemNode('system-auth', 'Auth', { filePath: 'src/auth' }),
      ])
      const scope = {
        rootSystemId: 'missing-id',
        filePathHint: 'src\\auth',
      }

      const result = resolveScopeAgainstGraph(scope, graph)

      expect(result).not.toBeNull()
      expect(result.strategy).toBe('path')
    })

    it('skips path strategy when multiple systems share the same filePath', () => {
      const graph = makeGraph([
        makeSystemNode('system-auth-v1', 'Auth V1', { filePath: 'src/auth' }),
        makeSystemNode('system-auth-v2', 'Auth V2', { filePath: 'src/auth' }),
      ])
      const scope = {
        rootSystemId: 'missing-id',
        filePathHint: 'src/auth',
        rootSystemLabel: 'Auth V1',
      }

      const result = resolveScopeAgainstGraph(scope, graph)

      // Should fall through to label strategy since path is ambiguous
      expect(result).not.toBeNull()
      expect(result.strategy).not.toBe('path')
    })
  })

  describe('strategy: fingerprint', () => {
    it('matches by computed fingerprint when id and path miss', () => {
      const graph = makeGraph([
        makeSystemNode('new-id', 'Auth', { filePath: 'src/auth' }),
      ])
      // Import fingerprint helper to compute expected value
      const { computeScopeFingerprint } = require('./fingerprint.js')
      const expectedFingerprint = computeScopeFingerprint(graph, 'new-id')

      const scope = {
        rootSystemId: 'old-id',
        filePathHint: 'different/path',
        fingerprint: expectedFingerprint,
      }

      const result = resolveScopeAgainstGraph(scope, graph)

      expect(result).not.toBeNull()
      expect(result.system.id).toBe('new-id')
      expect(result.strategy).toBe('fingerprint')
    })

    it('skips fingerprint strategy when multiple systems have same fingerprint', () => {
      // Two sibling systems with identical structure produce the same fingerprint.
      // The fingerprint strategy should skip when multiple nodes match.
      const parentNode = makeSystemNode('parent', 'Parent')
      const childA = makeSystemNode('child-a', 'Child', { parentId: 'parent', filePath: 'src/child' })
      const childB = makeSystemNode('child-b', 'Child', { parentId: 'parent', filePath: 'src/child' })
      const graph = makeGraph([parentNode, childA, childB])

      const { computeScopeFingerprint } = require('./fingerprint.js')
      const fingerprintA = computeScopeFingerprint(graph, 'child-a')
      const fingerprintB = computeScopeFingerprint(graph, 'child-b')

      // Verify both have the same fingerprint (same structure)
      expect(fingerprintA).toBe(fingerprintB)

      const scope = {
        rootSystemId: 'missing',
        fingerprint: fingerprintA,
        rootSystemLabel: 'Child',
        ancestorPath: ['Parent'],
      }

      const result = resolveScopeAgainstGraph(scope, graph)

      // Both children match the fingerprint, so it falls through.
      // ancestor-label also matches both, so it returns ambiguous.
      expect(result).not.toBeNull()
      expect(result.strategy).toBe('ancestor-label-ambiguous')
    })
  })

  describe('strategy: ancestor-label', () => {
    it('matches by label + ancestor path when prior strategies miss', () => {
      const graph = makeGraph([
        makeSystemNode('root-system', 'App'),
        makeSystemNode('system-auth', 'Auth', { parentId: 'root-system' }),
      ])
      const scope = {
        rootSystemId: 'different-id',
        rootSystemLabel: 'Auth',
        ancestorPath: ['App'],
      }

      const result = resolveScopeAgainstGraph(scope, graph)

      expect(result).not.toBeNull()
      expect(result.system.id).toBe('system-auth')
      expect(result.strategy).toBe('ancestor-label')
    })

    it('returns ancestor-label-ambiguous when multiple systems match', () => {
      const graph = makeGraph([
        makeSystemNode('parent', 'App'),
        makeSystemNode('auth-1', 'Auth', { parentId: 'parent' }),
        makeSystemNode('auth-2', 'Auth', { parentId: 'parent' }),
      ])
      const scope = {
        rootSystemId: 'missing',
        rootSystemLabel: 'Auth',
        ancestorPath: ['App'],
      }

      const result = resolveScopeAgainstGraph(scope, graph)

      expect(result).not.toBeNull()
      expect(result.strategy).toBe('ancestor-label-ambiguous')
    })
  })

  describe('strategy: label', () => {
    it('matches via ancestor-label when no ancestorPath specified', () => {
      // When rootSystemLabel is set without ancestorPath, the ancestor-label
      // strategy runs first. If the node has no parents and the scope has no
      // ancestorPath (defaulting to []), they match via ancestor-label.
      const graph = makeGraph([
        makeSystemNode('system-auth', 'Auth'),
        makeSystemNode('system-db', 'Database'),
      ])
      const scope = {
        rootSystemId: 'missing',
        rootSystemLabel: 'Database',
      }

      const result = resolveScopeAgainstGraph(scope, graph)

      expect(result).not.toBeNull()
      expect(result.system.id).toBe('system-db')
      // Matches via ancestor-label because both have empty ancestor chains
      expect(result.strategy).toBe('ancestor-label')
    })

    it('falls through to label when ancestor path does not match', () => {
      // The label strategy only triggers when ancestor-label fails to match.
      // This happens when the scope has an ancestorPath that doesn't match
      // any node's actual ancestor chain, but the label still matches.
      const graph = makeGraph([
        makeSystemNode('parent', 'Parent'),
        makeSystemNode('system-auth', 'Auth', { parentId: 'parent' }),
      ])
      const scope = {
        rootSystemId: 'missing',
        rootSystemLabel: 'Auth',
        // Wrong ancestor - doesn't match the actual parent 'Parent'
        ancestorPath: ['WrongParent'],
      }

      const result = resolveScopeAgainstGraph(scope, graph)

      expect(result).not.toBeNull()
      expect(result.system.id).toBe('system-auth')
      expect(result.strategy).toBe('label')
    })

    it('normalizes label case for matching', () => {
      const graph = makeGraph([
        makeSystemNode('parent', 'Parent'),
        makeSystemNode('system-auth', 'Authentication', { parentId: 'parent' }),
      ])
      const scope = {
        rootSystemId: 'missing',
        rootSystemLabel: 'AUTHENTICATION',
        ancestorPath: ['WrongParent'],
      }

      const result = resolveScopeAgainstGraph(scope, graph)

      expect(result).not.toBeNull()
      expect(result.strategy).toBe('label')
    })

    it('returns ancestor-label-ambiguous when multiple top-level systems match', () => {
      const graph = makeGraph([
        makeSystemNode('auth-1', 'Auth'),
        makeSystemNode('auth-2', 'Auth'),
      ])
      const scope = {
        rootSystemId: 'missing',
        rootSystemLabel: 'Auth',
        ancestorPath: [],
      }

      const result = resolveScopeAgainstGraph(scope, graph)

      // With matching ancestorPath (both have empty), ancestor-label-ambiguous
      expect(result).not.toBeNull()
      expect(result.strategy).toBe('ancestor-label-ambiguous')
    })

    it('returns null when label has multiple matches and ancestor fails', () => {
      const graph = makeGraph([
        makeSystemNode('parent', 'Parent'),
        makeSystemNode('auth-1', 'Auth', { parentId: 'parent' }),
        makeSystemNode('auth-2', 'Auth', { parentId: 'parent' }),
      ])
      const scope = {
        rootSystemId: 'missing',
        rootSystemLabel: 'Auth',
        ancestorPath: ['WrongParent'],
      }

      const result = resolveScopeAgainstGraph(scope, graph)

      // Label matches multiple nodes, so label strategy returns null
      expect(result).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('returns null for null scope', () => {
      const graph = makeGraph([makeSystemNode('a', 'A')])
      expect(resolveScopeAgainstGraph(null, graph)).toBeNull()
    })

    it('returns null for undefined scope', () => {
      const graph = makeGraph([makeSystemNode('a', 'A')])
      expect(resolveScopeAgainstGraph(undefined, graph)).toBeNull()
    })

    it('returns null for empty graph', () => {
      const scope = { rootSystemId: 'a' }
      expect(resolveScopeAgainstGraph(scope, makeGraph([]))).toBeNull()
    })

    it('returns null for null graph', () => {
      const scope = { rootSystemId: 'a' }
      expect(resolveScopeAgainstGraph(scope, null)).toBeNull()
    })

    it('ignores non-system nodes', () => {
      const graph = {
        nodes: [
          { id: 'file-a', type: 'file', label: 'A' },
          makeSystemNode('system-a', 'A'),
        ],
        edges: [],
      }
      const scope = { rootSystemId: 'file-a' }

      const result = resolveScopeAgainstGraph(scope, graph)

      // file-a is not a system node, so id match fails
      expect(result).toBeNull()
    })
  })
})
