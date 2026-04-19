import { describe, expect, it } from 'vitest'
import {
  createDefaultRuntimeEnvelope,
  createLegacyManifest,
  getActiveMapEntry,
  getRuntimeSignature,
  getManifestSignature,
  isGraphPayload,
  isMapsManifest,
  isRuntimeEnvelope,
} from './runtimeAssets'
import { PRESENTATION_MODES } from '../contracts/presentation'
import { DEFAULT_MAP_ID } from '../contracts/paths'

// runtimeAssets.test validates the pure helpers used by the runtime graph
// loader and polling system. These helpers create default shapes, extract
// active entries, and compute signatures for change detection.

describe('createDefaultRuntimeEnvelope', () => {
  it('returns envelope with graphRevision -1', () => {
    const envelope = createDefaultRuntimeEnvelope()
    expect(envelope.graphRevision).toBe(-1)
  })

  it('returns envelope with empty updatedAt', () => {
    const envelope = createDefaultRuntimeEnvelope()
    expect(envelope.updatedAt).toBe('')
  })

  it('returns envelope with null graphMeta', () => {
    const envelope = createDefaultRuntimeEnvelope()
    expect(envelope.graphMeta).toBe(null)
  })

  it('returns envelope with free presentation mode', () => {
    const envelope = createDefaultRuntimeEnvelope()
    expect(envelope.runtime.presentation.mode).toBe(PRESENTATION_MODES.FREE)
  })

  it('returns envelope with healthOverlay false', () => {
    const envelope = createDefaultRuntimeEnvelope()
    expect(envelope.runtime.healthOverlay).toBe(false)
  })

  it('returns envelope with empty highlightedNodeIds', () => {
    const envelope = createDefaultRuntimeEnvelope()
    expect(envelope.runtime.highlightedNodeIds).toEqual([])
  })

  it('returns envelope with accent highlightColor', () => {
    const envelope = createDefaultRuntimeEnvelope()
    expect(envelope.runtime.highlightColor).toBe('accent')
  })
})

describe('createLegacyManifest', () => {
  it('returns manifest with version 1', () => {
    const manifest = createLegacyManifest()
    expect(manifest.version).toBe(1)
  })

  it('returns manifest with default activeMapId', () => {
    const manifest = createLegacyManifest()
    expect(manifest.activeMapId).toBe(DEFAULT_MAP_ID)
  })

  it('returns manifest with single root map', () => {
    const manifest = createLegacyManifest()
    expect(manifest.maps.length).toBe(1)
    expect(manifest.maps[0].id).toBe(DEFAULT_MAP_ID)
  })

  it('includes expected paths in root map', () => {
    const manifest = createLegacyManifest()
    const rootMap = manifest.maps[0]
    expect(rootMap.graphPath).toBeDefined()
    expect(rootMap.statePath).toBeDefined()
    expect(rootMap.cachePath).toBeDefined()
  })
})

describe('getActiveMapEntry', () => {
  it('returns first map for invalid manifest', () => {
    const result = getActiveMapEntry(null)
    expect(result.id).toBe(DEFAULT_MAP_ID)
  })

  it('returns legacy map for string manifest', () => {
    const result = getActiveMapEntry('invalid')
    expect(result.id).toBe(DEFAULT_MAP_ID)
  })

  it('returns map matching activeMapId', () => {
    const manifest = {
      version: 1,
      activeMapId: 'custom-map',
      maps: [
        { id: 'root', label: 'Root', graphPath: 'a', statePath: 'b', cachePath: 'c' },
        { id: 'custom-map', label: 'Custom', graphPath: 'd', statePath: 'e', cachePath: 'f' },
      ],
    }
    const result = getActiveMapEntry(manifest)
    expect(result.id).toBe('custom-map')
    expect(result.label).toBe('Custom')
  })

  it('falls back to first map when activeMapId not found', () => {
    const manifest = {
      version: 1,
      activeMapId: 'nonexistent',
      maps: [
        { id: 'first', label: 'First', graphPath: 'a', statePath: 'b', cachePath: 'c' },
      ],
    }
    const result = getActiveMapEntry(manifest)
    expect(result.id).toBe('first')
  })

  it('returns null for empty maps array', () => {
    const manifest = {
      version: 1,
      activeMapId: 'root',
      maps: [],
    }
    const result = getActiveMapEntry(manifest)
    expect(result).toBe(null)
  })
})

describe('getRuntimeSignature', () => {
  it('combines graphRevision, updatedAt, and runtime', () => {
    const envelope = {
      graphRevision: 5,
      updatedAt: '2024-01-01T00:00:00Z',
      runtime: { highlightedNodeIds: ['a'] },
    }
    const signature = getRuntimeSignature(envelope)

    expect(signature).toContain('5')
    expect(signature).toContain('2024-01-01T00:00:00Z')
    expect(signature).toContain('"highlightedNodeIds"')
  })

  it('returns different signatures for different revisions', () => {
    const envelope1 = { graphRevision: 1, updatedAt: '', runtime: {} }
    const envelope2 = { graphRevision: 2, updatedAt: '', runtime: {} }

    expect(getRuntimeSignature(envelope1)).not.toBe(getRuntimeSignature(envelope2))
  })

  it('returns different signatures for different runtime state', () => {
    const envelope1 = { graphRevision: 1, updatedAt: '', runtime: { healthOverlay: false } }
    const envelope2 = { graphRevision: 1, updatedAt: '', runtime: { healthOverlay: true } }

    expect(getRuntimeSignature(envelope1)).not.toBe(getRuntimeSignature(envelope2))
  })

  it('handles missing updatedAt', () => {
    const envelope = { graphRevision: 1, runtime: {} }
    const signature = getRuntimeSignature(envelope)
    expect(signature).toContain('1::')
  })

  it('handles missing runtime', () => {
    const envelope = { graphRevision: 1, updatedAt: '' }
    const signature = getRuntimeSignature(envelope)
    expect(signature).toBeDefined()
  })
})

describe('getManifestSignature', () => {
  it('returns JSON stringified manifest', () => {
    const manifest = { version: 1, activeMapId: 'root', maps: [] }
    const signature = getManifestSignature(manifest)

    expect(signature).toBe(JSON.stringify(manifest))
  })

  it('returns different signatures for different manifests', () => {
    const manifest1 = { version: 1, activeMapId: 'root', maps: [] }
    const manifest2 = { version: 1, activeMapId: 'custom', maps: [] }

    expect(getManifestSignature(manifest1)).not.toBe(getManifestSignature(manifest2))
  })

  it('handles null manifest as empty object', () => {
    const signature = getManifestSignature(null)
    // Implementation uses JSON.stringify(manifest || {})
    expect(signature).toBe('{}')
  })

  it('handles undefined manifest as empty object', () => {
    const signature = getManifestSignature(undefined)
    expect(signature).toBe('{}')
  })
})

describe('isGraphPayload', () => {
  it('returns true for valid graph payload', () => {
    const graph = {
      meta: {},
      nodes: [],
      edges: [],
    }
    expect(isGraphPayload(graph)).toBe(true)
  })

  it('returns true for graph with data', () => {
    const graph = {
      meta: { source: 'claude' },
      nodes: [{ id: 'a', type: 'system' }],
      edges: [{ source: 'a', target: 'b' }],
    }
    expect(isGraphPayload(graph)).toBe(true)
  })

  it('returns false for null', () => {
    expect(isGraphPayload(null)).toBe(false)
  })

  it('returns false for non-object', () => {
    expect(isGraphPayload('string')).toBe(false)
    expect(isGraphPayload(123)).toBe(false)
  })

  it('returns false for missing nodes', () => {
    expect(isGraphPayload({ meta: {}, edges: [] })).toBe(false)
  })

  it('returns false for missing edges', () => {
    expect(isGraphPayload({ meta: {}, nodes: [] })).toBe(false)
  })

  it('returns false for nodes as non-array', () => {
    expect(isGraphPayload({ meta: {}, nodes: 'invalid', edges: [] })).toBe(false)
  })
})

describe('isMapsManifest', () => {
  // Note: isMapsManifest is a loose predicate that only checks for maps array.
  // It does NOT validate version or activeMapId. For strict validation use isValidManifest.

  it('returns true for valid manifest', () => {
    const manifest = {
      version: 1,
      activeMapId: 'root',
      maps: [{ id: 'root', label: 'Root', graphPath: 'a', statePath: 'b', cachePath: 'c' }],
    }
    expect(isMapsManifest(manifest)).toBe(true)
  })

  it('returns false for null', () => {
    expect(isMapsManifest(null)).toBe(false)
  })

  it('returns true for object with maps array (loose check)', () => {
    // Loose predicate only requires maps array to exist
    expect(isMapsManifest({ activeMapId: 'root', maps: [] })).toBe(true)
    expect(isMapsManifest({ version: 1, maps: [] })).toBe(true)
  })

  it('returns false for missing maps', () => {
    expect(isMapsManifest({ version: 1, activeMapId: 'root' })).toBe(false)
  })

  it('returns false for maps as non-array', () => {
    expect(isMapsManifest({ version: 1, activeMapId: 'root', maps: {} })).toBe(false)
  })
})

describe('isRuntimeEnvelope', () => {
  // Note: isRuntimeEnvelope is a loose predicate checking graphRevision (number) and runtime (truthy).
  // It does NOT strictly validate runtime must be an object. For strict validation use isValidRuntimeEnvelope.

  it('returns true for valid envelope', () => {
    const envelope = {
      graphRevision: 1,
      updatedAt: '2024-01-01T00:00:00Z',
      graphMeta: {},
      runtime: {},
    }
    expect(isRuntimeEnvelope(envelope)).toBe(true)
  })

  it('returns true for envelope with presentation', () => {
    const envelope = {
      graphRevision: 1,
      updatedAt: '',
      graphMeta: null,
      runtime: {
        presentation: { mode: 'free' },
      },
    }
    expect(isRuntimeEnvelope(envelope)).toBe(true)
  })

  it('returns false for null', () => {
    expect(isRuntimeEnvelope(null)).toBe(false)
  })

  it('returns false for missing graphRevision', () => {
    expect(isRuntimeEnvelope({ updatedAt: '', graphMeta: {}, runtime: {} })).toBe(false)
  })

  it('returns false for missing runtime', () => {
    expect(isRuntimeEnvelope({ graphRevision: 1, updatedAt: '', graphMeta: {} })).toBe(false)
  })

  it('returns true for runtime as truthy non-object (loose check)', () => {
    // Loose predicate only checks runtime is truthy, not that it's an object
    expect(isRuntimeEnvelope({ graphRevision: 1, updatedAt: '', graphMeta: {}, runtime: 'truthy' })).toBe(true)
  })

  it('returns false for runtime as falsy value', () => {
    expect(isRuntimeEnvelope({ graphRevision: 1, updatedAt: '', graphMeta: {}, runtime: null })).toBe(false)
    expect(isRuntimeEnvelope({ graphRevision: 1, updatedAt: '', graphMeta: {}, runtime: '' })).toBe(false)
  })
})
