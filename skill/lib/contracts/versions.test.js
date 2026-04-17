import { describe, expect, it } from 'vitest'
import {
  CURRENT_VERSIONS,
  GRAPH_REVISION_UNSET,
  GRAPH_VERSION,
  MANIFEST_VERSION,
  RUNTIME_STATE_VERSION,
  INSTALL_RECORD_VERSION,
  CACHE_VERSION,
  runMigrations,
  runMigrationsWithLadder,
} from './versions.js'
import { SCHEMA_NAMES } from './schemas/index.js'

// versions.test pins the migration ladder contract. Today all shapes are at
// version 1 with empty ladders. This test constructs a synthetic migration
// step to verify that runMigrations walks the ladder correctly, even though
// no production shape has reached version 2 yet.

describe('version constants', () => {
  it('exports version 1 for all shapes', () => {
    expect(MANIFEST_VERSION).toBe(1)
    expect(GRAPH_VERSION).toBe(1)
    expect(RUNTIME_STATE_VERSION).toBe(1)
    expect(INSTALL_RECORD_VERSION).toBe(1)
    expect(CACHE_VERSION).toBe(1)
  })

  it('exports GRAPH_REVISION_UNSET as 0', () => {
    expect(GRAPH_REVISION_UNSET).toBe(0)
  })

  it('CURRENT_VERSIONS maps schema names to version numbers', () => {
    expect(CURRENT_VERSIONS[SCHEMA_NAMES.MANIFEST]).toBe(MANIFEST_VERSION)
    expect(CURRENT_VERSIONS[SCHEMA_NAMES.GRAPH]).toBe(GRAPH_VERSION)
    expect(CURRENT_VERSIONS[SCHEMA_NAMES.RUNTIME_ENVELOPE]).toBe(RUNTIME_STATE_VERSION)
    expect(CURRENT_VERSIONS[SCHEMA_NAMES.INSTALL_RECORD]).toBe(INSTALL_RECORD_VERSION)
    expect(CURRENT_VERSIONS[SCHEMA_NAMES.CACHE]).toBe(CACHE_VERSION)
  })
})

describe('runMigrations', () => {
  it('returns the value unchanged when already at current version', () => {
    const graph = { meta: {}, nodes: [], edges: [], version: GRAPH_VERSION }
    const result = runMigrations(SCHEMA_NAMES.GRAPH, graph)
    expect(result).toBe(graph)
  })

  it('returns the value unchanged for pre-versioned files (no version field)', () => {
    const manifest = { activeMapId: 'root', maps: [] }
    const result = runMigrations(SCHEMA_NAMES.MANIFEST, manifest)
    expect(result).toBe(manifest)
  })

  it('throws for unknown schema names', () => {
    expect(() => runMigrations('unknown-schema', {})).toThrow('Unknown schema')
  })

  it('handles cache schemaVersion field (not version)', () => {
    const cache = { schemaVersion: CACHE_VERSION, files: [], graph: {} }
    const result = runMigrations(SCHEMA_NAMES.CACHE, cache)
    expect(result).toBe(cache)
  })

  it('treats null/undefined as version 1 (pre-versioned fallback)', () => {
    const result = runMigrations(SCHEMA_NAMES.GRAPH, null)
    expect(result).toBe(null)
  })

  it('returns value unchanged when no migration step covers a version gap', () => {
    const oldGraph = { meta: {}, nodes: [], edges: [], version: 0 }
    const result = runMigrations(SCHEMA_NAMES.GRAPH, oldGraph)
    expect(result).toBe(oldGraph)
  })
})

// runMigrationsWithLadder exercises the migration-ladder walking logic
// with a synthetic ladder. This pins the Phase-6 contract end-to-end even
// though no production shape has reached version 2 yet.

describe('runMigrationsWithLadder (synthetic ladder)', () => {
  it('applies a single migration step', () => {
    const ladder = [
      {
        from: 0,
        to: 1,
        migrate: (value) => ({ ...value, version: 1, migrated: true }),
      },
    ]
    const oldValue = { version: 0, data: 'original' }
    const result = runMigrationsWithLadder(ladder, 1, oldValue, 'manifest')

    expect(result.version).toBe(1)
    expect(result.migrated).toBe(true)
    expect(result.data).toBe('original')
  })

  it('chains multiple migration steps', () => {
    const ladder = [
      {
        from: 0,
        to: 1,
        migrate: (value) => ({ ...value, version: 1, step1: true }),
      },
      {
        from: 1,
        to: 2,
        migrate: (value) => ({ ...value, version: 2, step2: true }),
      },
    ]
    const oldValue = { version: 0 }
    const result = runMigrationsWithLadder(ladder, 2, oldValue, 'manifest')

    expect(result.version).toBe(2)
    expect(result.step1).toBe(true)
    expect(result.step2).toBe(true)
  })

  it('stops at target version even if ladder has more steps', () => {
    const ladder = [
      {
        from: 0,
        to: 1,
        migrate: (value) => ({ ...value, version: 1, step1: true }),
      },
      {
        from: 1,
        to: 2,
        migrate: (value) => ({ ...value, version: 2, step2: true }),
      },
    ]
    const oldValue = { version: 0 }
    const result = runMigrationsWithLadder(ladder, 1, oldValue, 'manifest')

    expect(result.version).toBe(1)
    expect(result.step1).toBe(true)
    expect(result.step2).toBeUndefined()
  })

  it('returns value unchanged when already at target version', () => {
    const ladder = [
      { from: 0, to: 1, migrate: (value) => ({ ...value, version: 1 }) },
    ]
    const currentValue = { version: 1, data: 'already-current' }
    const result = runMigrationsWithLadder(ladder, 1, currentValue, 'manifest')

    expect(result).toBe(currentValue)
  })

  it('returns value unchanged when no matching step exists', () => {
    const ladder = [
      { from: 1, to: 2, migrate: (value) => ({ ...value, version: 2 }) },
    ]
    const oldValue = { version: 0, data: 'stranded' }
    const result = runMigrationsWithLadder(ladder, 2, oldValue, 'manifest')

    expect(result).toBe(oldValue)
  })

  it('uses schemaVersion for cache schema name', () => {
    const ladder = [
      {
        from: 0,
        to: 1,
        migrate: (value) => ({ ...value, schemaVersion: 1, migrated: true }),
      },
    ]
    const oldCache = { schemaVersion: 0, files: [] }
    const result = runMigrationsWithLadder(ladder, 1, oldCache, 'cache')

    expect(result.schemaVersion).toBe(1)
    expect(result.migrated).toBe(true)
  })

  it('handles null/undefined input gracefully', () => {
    const ladder = []
    const result = runMigrationsWithLadder(ladder, 1, null, 'manifest')
    expect(result).toBe(null)
  })
})
