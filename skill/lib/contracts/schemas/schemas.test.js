import { describe, expect, it } from 'vitest'
import {
  SCHEMA_NAMES,
  validate,
  validateGraph,
  validateManifest,
  validateRuntimeEnvelope,
  validateInstallRecord,
  validateCache,
} from './index.js'
import { GRAPH_SOURCES } from '../graph-sources.js'
import { PRESENTATION_MODES } from '../presentation.js'
import { CACHE_FILENAME, RUNTIME_GRAPH_REL, RUNTIME_STATE_REL } from '../paths.js'

// schemas.test validates every hand-rolled validator with known-good and
// known-bad inputs. The pattern is: minimal valid payloads pass, minimal
// violations fail with descriptive errors. Validators never throw.

describe('validateGraph', () => {
  const minimalValidGraph = {
    meta: {},
    nodes: [],
    edges: [],
  }

  it('accepts a minimal valid graph', () => {
    const result = validateGraph(minimalValidGraph)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('accepts a graph with nodes and edges', () => {
    const graph = {
      meta: { source: GRAPH_SOURCES.CLAUDE },
      nodes: [
        { id: 'system-a', type: 'system', label: 'A' },
        { id: 'file-b', type: 'file', label: 'B' },
      ],
      edges: [{ source: 'system-a', target: 'file-b', type: 'contains' }],
    }
    const result = validateGraph(graph)
    expect(result.ok).toBe(true)
  })

  it('accepts a graph with optional files array', () => {
    const graph = {
      meta: {},
      nodes: [],
      edges: [],
      files: [{ path: 'src/index.js' }],
    }
    const result = validateGraph(graph)
    expect(result.ok).toBe(true)
  })

  it('rejects null', () => {
    const result = validateGraph(null)
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects missing meta', () => {
    const result = validateGraph({ nodes: [], edges: [] })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'meta')).toBe(true)
  })

  it('rejects missing nodes', () => {
    const result = validateGraph({ meta: {}, edges: [] })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'nodes')).toBe(true)
  })

  it('rejects missing edges', () => {
    const result = validateGraph({ meta: {}, nodes: [] })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'edges')).toBe(true)
  })

  it('rejects nodes without id', () => {
    const graph = {
      meta: {},
      nodes: [{ type: 'system' }],
      edges: [],
    }
    const result = validateGraph(graph)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'nodes[0].id')).toBe(true)
  })

  it('rejects nodes without type', () => {
    const graph = {
      meta: {},
      nodes: [{ id: 'a' }],
      edges: [],
    }
    const result = validateGraph(graph)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'nodes[0].type')).toBe(true)
  })

  it('rejects edges without source', () => {
    const graph = {
      meta: {},
      nodes: [],
      edges: [{ target: 'b' }],
    }
    const result = validateGraph(graph)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'edges[0].source')).toBe(true)
  })

  it('rejects edges without target', () => {
    const graph = {
      meta: {},
      nodes: [],
      edges: [{ source: 'a' }],
    }
    const result = validateGraph(graph)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'edges[0].target')).toBe(true)
  })

  it('rejects files as non-array', () => {
    const graph = {
      meta: {},
      nodes: [],
      edges: [],
      files: 'not-an-array',
    }
    const result = validateGraph(graph)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'files')).toBe(true)
  })
})

describe('validateManifest', () => {
  const minimalValidManifest = {
    version: 1,
    activeMapId: 'root',
    maps: [
      {
        id: 'root',
        label: 'ClaudeMap',
        graphPath: RUNTIME_GRAPH_REL,
        statePath: RUNTIME_STATE_REL,
        cachePath: CACHE_FILENAME,
      },
    ],
  }

  it('accepts a minimal valid manifest', () => {
    const result = validateManifest(minimalValidManifest)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects null', () => {
    const result = validateManifest(null)
    expect(result.ok).toBe(false)
  })

  it('rejects missing version', () => {
    const manifest = { ...minimalValidManifest }
    delete manifest.version
    const result = validateManifest(manifest)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'version')).toBe(true)
  })

  it('rejects missing activeMapId', () => {
    const manifest = { ...minimalValidManifest }
    delete manifest.activeMapId
    const result = validateManifest(manifest)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'activeMapId')).toBe(true)
  })

  it('rejects missing maps', () => {
    const result = validateManifest({ version: 1, activeMapId: 'root' })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'maps')).toBe(true)
  })

  it('rejects map entry without id', () => {
    const manifest = {
      version: 1,
      activeMapId: 'root',
      maps: [{ label: 'X', graphPath: 'a', statePath: 'b', cachePath: 'c' }],
    }
    const result = validateManifest(manifest)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'maps[0].id')).toBe(true)
  })

  it('accepts scope as null', () => {
    const manifest = {
      ...minimalValidManifest,
      maps: [{ ...minimalValidManifest.maps[0], scope: null }],
    }
    const result = validateManifest(manifest)
    expect(result.ok).toBe(true)
  })

  it('accepts scope as object', () => {
    const manifest = {
      ...minimalValidManifest,
      maps: [{ ...minimalValidManifest.maps[0], scope: { rootSystemId: 'x' } }],
    }
    const result = validateManifest(manifest)
    expect(result.ok).toBe(true)
  })

  it('rejects scope as string', () => {
    const manifest = {
      ...minimalValidManifest,
      maps: [{ ...minimalValidManifest.maps[0], scope: 'invalid' }],
    }
    const result = validateManifest(manifest)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'maps[0].scope')).toBe(true)
  })
})

describe('validateRuntimeEnvelope', () => {
  const minimalValidEnvelope = {
    graphRevision: 0,
    updatedAt: '2024-01-01T00:00:00Z',
    graphMeta: {},
    runtime: {},
  }

  it('accepts a minimal valid envelope', () => {
    const result = validateRuntimeEnvelope(minimalValidEnvelope)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects null', () => {
    const result = validateRuntimeEnvelope(null)
    expect(result.ok).toBe(false)
  })

  it('rejects missing graphRevision', () => {
    const envelope = { ...minimalValidEnvelope }
    delete envelope.graphRevision
    const result = validateRuntimeEnvelope(envelope)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'graphRevision')).toBe(true)
  })

  it('rejects missing runtime', () => {
    const envelope = { ...minimalValidEnvelope }
    delete envelope.runtime
    const result = validateRuntimeEnvelope(envelope)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'runtime')).toBe(true)
  })

  it('accepts runtime.presentation as object', () => {
    const envelope = {
      ...minimalValidEnvelope,
      runtime: { presentation: { mode: PRESENTATION_MODES.FREE } },
    }
    const result = validateRuntimeEnvelope(envelope)
    expect(result.ok).toBe(true)
  })

  it('rejects runtime.presentation as string', () => {
    const envelope = {
      ...minimalValidEnvelope,
      runtime: { presentation: 'not-an-object' },
    }
    const result = validateRuntimeEnvelope(envelope)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'runtime.presentation')).toBe(true)
  })

  it('accepts runtime.highlightedNodeIds as array', () => {
    const envelope = {
      ...minimalValidEnvelope,
      runtime: { highlightedNodeIds: ['a', 'b'] },
    }
    const result = validateRuntimeEnvelope(envelope)
    expect(result.ok).toBe(true)
  })

  it('rejects runtime.highlightedNodeIds as string', () => {
    const envelope = {
      ...minimalValidEnvelope,
      runtime: { highlightedNodeIds: 'not-an-array' },
    }
    const result = validateRuntimeEnvelope(envelope)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'runtime.highlightedNodeIds')).toBe(true)
  })
})

describe('validateInstallRecord', () => {
  const minimalValidRecord = {
    artifact: 'claudemap-skill',
    artifactVersion: '0.1.0',
    installedAt: '2024-01-01T00:00:00Z',
    managedPaths: ['.claude/skills/claudemap-runtime'],
    mode: 'install',
  }

  it('accepts a minimal valid install record', () => {
    const result = validateInstallRecord(minimalValidRecord)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects null', () => {
    const result = validateInstallRecord(null)
    expect(result.ok).toBe(false)
  })

  it('rejects missing artifact', () => {
    const record = { ...minimalValidRecord }
    delete record.artifact
    const result = validateInstallRecord(record)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'artifact')).toBe(true)
  })

  it('rejects missing managedPaths', () => {
    const record = { ...minimalValidRecord }
    delete record.managedPaths
    const result = validateInstallRecord(record)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'managedPaths')).toBe(true)
  })
})

describe('validateCache', () => {
  const minimalValidCache = {
    schemaVersion: 1,
    generatedAt: '2024-01-01T00:00:00Z',
    fileCount: 0,
    files: [],
    graph: { nodes: [], edges: [] },
  }

  it('accepts a minimal valid cache', () => {
    const result = validateCache(minimalValidCache)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects null', () => {
    const result = validateCache(null)
    expect(result.ok).toBe(false)
  })

  it('rejects missing schemaVersion', () => {
    const cache = { ...minimalValidCache }
    delete cache.schemaVersion
    const result = validateCache(cache)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'schemaVersion')).toBe(true)
  })

  it('rejects missing graph', () => {
    const cache = { ...minimalValidCache }
    delete cache.graph
    const result = validateCache(cache)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.path === 'graph')).toBe(true)
  })
})

describe('validate() dispatcher', () => {
  it('routes to validateGraph for SCHEMA_NAMES.GRAPH', () => {
    const result = validate(SCHEMA_NAMES.GRAPH, { meta: {}, nodes: [], edges: [] })
    expect(result.ok).toBe(true)
  })

  it('routes to validateManifest for SCHEMA_NAMES.MANIFEST', () => {
    const result = validate(SCHEMA_NAMES.MANIFEST, {
      version: 1,
      activeMapId: 'root',
      maps: [{ id: 'root', label: 'X', graphPath: 'a', statePath: 'b', cachePath: 'c' }],
    })
    expect(result.ok).toBe(true)
  })

  it('throws for unknown schema name', () => {
    expect(() => validate('unknown-schema', {})).toThrow('Unknown schema')
  })
})
