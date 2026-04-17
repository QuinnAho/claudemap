import { describe, expect, it } from 'vitest'
import { iconForSystem } from './icons.js'
import { assessFileHealth, assessSystemHealth } from './health.js'
import {
  getGraphSourcePriority,
  shouldPreserveExistingGraph,
  selectPreferredGraph,
} from './source-priority.js'
import { GRAPH_SOURCES } from '../contracts/graph-sources.js'

// enrichment.test validates the heuristic helpers used by the graph builder.

describe('iconForSystem', () => {
  it('returns shield for auth-related systems', () => {
    expect(iconForSystem('auth', [])).toBe('shield')
    expect(iconForSystem('user-login', [])).toBe('shield')
    expect(iconForSystem('token-service', [])).toBe('shield')
    expect(iconForSystem('session', [])).toBe('shield')
    expect(iconForSystem('acl', [])).toBe('shield')
    expect(iconForSystem('permission', [])).toBe('shield')
    expect(iconForSystem('role-manager', [])).toBe('shield')
  })

  it('returns database for db-related systems', () => {
    expect(iconForSystem('db', [])).toBe('database')
    expect(iconForSystem('database', [])).toBe('database')
    expect(iconForSystem('model-layer', [])).toBe('database')
    expect(iconForSystem('schema', [])).toBe('database')
    expect(iconForSystem('query-builder', [])).toBe('database')
    expect(iconForSystem('migration', [])).toBe('database')
    expect(iconForSystem('data-store', [])).toBe('database')
  })

  it('returns route for routing systems', () => {
    expect(iconForSystem('routes', [])).toBe('route')
    expect(iconForSystem('router', [])).toBe('route')
    expect(iconForSystem('api-path', [])).toBe('route')
    expect(iconForSystem('endpoint', [])).toBe('route')
  })

  it('returns globe for api/network systems', () => {
    expect(iconForSystem('api', [])).toBe('globe')
    expect(iconForSystem('http-client', [])).toBe('globe')
    expect(iconForSystem('web-service', [])).toBe('globe')
    expect(iconForSystem('network', [])).toBe('globe')
  })

  it('returns layers for middleware systems', () => {
    expect(iconForSystem('middleware', [])).toBe('layers')
    expect(iconForSystem('hook', [])).toBe('layers')
    expect(iconForSystem('pipeline', [])).toBe('layers')
  })

  it('returns puzzle for plugin systems', () => {
    expect(iconForSystem('plugin', [])).toBe('puzzle')
    expect(iconForSystem('extension', [])).toBe('puzzle')
    expect(iconForSystem('adapter', [])).toBe('puzzle')
  })

  it('returns envelope for mail systems', () => {
    expect(iconForSystem('mailer', [])).toBe('envelope')
    expect(iconForSystem('email', [])).toBe('envelope')
    expect(iconForSystem('message-queue', [])).toBe('envelope')
  })

  it('returns clock for time-related systems', () => {
    expect(iconForSystem('scheduler', [])).toBe('clock')
    expect(iconForSystem('cron', [])).toBe('clock')
    expect(iconForSystem('time-utils', [])).toBe('clock')
    expect(iconForSystem('date-service', [])).toBe('clock')
  })

  it('returns gear for config systems', () => {
    expect(iconForSystem('config', [])).toBe('gear')
    expect(iconForSystem('settings', [])).toBe('gear')
    expect(iconForSystem('setup', [])).toBe('gear')
    expect(iconForSystem('build', [])).toBe('gear')
  })

  it('returns server for server/app/core systems', () => {
    expect(iconForSystem('server', [])).toBe('server')
    expect(iconForSystem('app', [])).toBe('server')
    expect(iconForSystem('core', [])).toBe('server')
    expect(iconForSystem('main-server', [])).toBe('server')
    expect(iconForSystem('app-core', [])).toBe('server')
  })

  it('runtime matches clock due to containing "time"', () => {
    // This documents the actual behavior: regex ladder order means
    // 'runtime' matches /(time|date|...)/ before /(server|...|runtime)/
    expect(iconForSystem('runtime', [])).toBe('clock')
  })

  it('returns code as fallback', () => {
    expect(iconForSystem('foo', [])).toBe('code')
    expect(iconForSystem('utilities', [])).toBe('code')
    expect(iconForSystem('helpers', [])).toBe('code')
  })

  it('considers file paths in heuristic', () => {
    const files = [{ relativePath: 'src/auth/login.js' }]
    expect(iconForSystem('security', files)).toBe('shield')
  })

  it('uses first matching pattern (auth beats middleware)', () => {
    expect(iconForSystem('auth-middleware', [])).toBe('shield')
  })
})

describe('assessFileHealth', () => {
  it('returns red for files over 500 lines', () => {
    const file = { lineCount: 600, imports: [] }
    const result = assessFileHealth(file)
    expect(result.health).toBe('red')
    expect(result.healthReason).toContain('600')
  })

  it('returns yellow for files 301-500 lines', () => {
    const file = { lineCount: 400, imports: [] }
    const result = assessFileHealth(file)
    expect(result.health).toBe('yellow')
    expect(result.healthReason).toContain('400')
  })

  it('returns yellow for files with over 12 imports', () => {
    const file = { lineCount: 100, imports: Array(15).fill('dep') }
    const result = assessFileHealth(file)
    expect(result.health).toBe('yellow')
    expect(result.healthReason).toContain('15')
  })

  it('returns green for healthy files', () => {
    const file = { lineCount: 100, imports: ['a', 'b'] }
    const result = assessFileHealth(file)
    expect(result.health).toBe('green')
    expect(result.healthReason).toBeNull()
  })

  it('prioritizes line count over import count', () => {
    const file = { lineCount: 600, imports: Array(15).fill('dep') }
    const result = assessFileHealth(file)
    expect(result.health).toBe('red')
    expect(result.healthReason).toContain('600')
  })
})

describe('assessSystemHealth', () => {
  it('returns red when any file is over 500 lines', () => {
    const files = [
      { name: 'a.js', lineCount: 100, imports: [] },
      { name: 'big.js', lineCount: 600, imports: [] },
    ]
    const result = assessSystemHealth(files)
    expect(result.health).toBe('red')
    expect(result.healthReason).toContain('big.js')
    expect(result.healthReason).toContain('600')
  })

  it('returns yellow for systems with over 15 files', () => {
    const files = Array(20)
      .fill(null)
      .map((_, i) => ({ name: `f${i}.js`, lineCount: 50, imports: [] }))
    const result = assessSystemHealth(files)
    expect(result.health).toBe('yellow')
    expect(result.healthReason).toContain('20')
  })

  it('returns yellow for high coupling (imports > files * 6)', () => {
    const files = [
      { name: 'a.js', lineCount: 100, imports: Array(20).fill('x') },
      { name: 'b.js', lineCount: 100, imports: Array(20).fill('y') },
    ]
    const result = assessSystemHealth(files)
    expect(result.health).toBe('yellow')
    expect(result.healthReason).toContain('40')
  })

  it('returns green for healthy systems', () => {
    const files = [
      { name: 'a.js', lineCount: 100, imports: ['x'] },
      { name: 'b.js', lineCount: 100, imports: ['y'] },
    ]
    const result = assessSystemHealth(files)
    expect(result.health).toBe('green')
    expect(result.healthReason).toBeNull()
  })

  it('prioritizes red over yellow conditions', () => {
    const files = Array(20)
      .fill(null)
      .map((_, i) => ({
        name: i === 0 ? 'big.js' : `f${i}.js`,
        lineCount: i === 0 ? 600 : 50,
        imports: [],
      }))
    const result = assessSystemHealth(files)
    expect(result.health).toBe('red')
  })
})

describe('getGraphSourcePriority', () => {
  it('returns priority for known sources', () => {
    expect(getGraphSourcePriority(GRAPH_SOURCES.SAMPLE)).toBe(0)
    expect(getGraphSourcePriority(GRAPH_SOURCES.SEED)).toBe(0)
    expect(getGraphSourcePriority(GRAPH_SOURCES.FILE_SHIM)).toBe(0)
    expect(getGraphSourcePriority(GRAPH_SOURCES.HEURISTIC)).toBe(10)
    expect(getGraphSourcePriority(GRAPH_SOURCES.CLAUDE)).toBe(30)
    expect(getGraphSourcePriority(GRAPH_SOURCES.IMPORTED)).toBe(40)
    expect(getGraphSourcePriority(GRAPH_SOURCES.MANUAL)).toBe(50)
  })

  it('returns default priority (5) for unknown sources', () => {
    expect(getGraphSourcePriority('unknown')).toBe(5)
    expect(getGraphSourcePriority('runtime')).toBe(5)
  })

  it('accepts a graph object with meta.source', () => {
    const graph = { meta: { source: GRAPH_SOURCES.CLAUDE } }
    expect(getGraphSourcePriority(graph)).toBe(30)
  })

  it('normalizes source case', () => {
    expect(getGraphSourcePriority('CLAUDE')).toBe(30)
    expect(getGraphSourcePriority('Claude')).toBe(30)
  })
})

describe('shouldPreserveExistingGraph', () => {
  it('returns false when existing graph is null', () => {
    const candidate = { meta: { source: GRAPH_SOURCES.CLAUDE } }
    expect(shouldPreserveExistingGraph(null, candidate)).toBe(false)
  })

  it('returns false when candidate graph is null', () => {
    const existing = { meta: { source: GRAPH_SOURCES.CLAUDE } }
    expect(shouldPreserveExistingGraph(existing, null)).toBe(false)
  })

  it('returns true when existing has higher priority', () => {
    const existing = { meta: { source: GRAPH_SOURCES.MANUAL } }
    const candidate = { meta: { source: GRAPH_SOURCES.HEURISTIC } }
    expect(shouldPreserveExistingGraph(existing, candidate)).toBe(true)
  })

  it('returns false when candidate has higher or equal priority', () => {
    const existing = { meta: { source: GRAPH_SOURCES.HEURISTIC } }
    const candidate = { meta: { source: GRAPH_SOURCES.CLAUDE } }
    expect(shouldPreserveExistingGraph(existing, candidate)).toBe(false)
  })

  it('returns false when forceRefresh is true', () => {
    const existing = { meta: { source: GRAPH_SOURCES.MANUAL } }
    const candidate = { meta: { source: GRAPH_SOURCES.HEURISTIC } }
    expect(shouldPreserveExistingGraph(existing, candidate, { forceRefresh: true })).toBe(false)
  })

  it('returns false when allowLowerPriorityOverwrite is true', () => {
    const existing = { meta: { source: GRAPH_SOURCES.MANUAL } }
    const candidate = { meta: { source: GRAPH_SOURCES.HEURISTIC } }
    expect(
      shouldPreserveExistingGraph(existing, candidate, { allowLowerPriorityOverwrite: true }),
    ).toBe(false)
  })
})

describe('selectPreferredGraph', () => {
  it('returns candidate when it has higher priority', () => {
    const existing = { meta: { source: GRAPH_SOURCES.HEURISTIC } }
    const candidate = { meta: { source: GRAPH_SOURCES.CLAUDE } }
    const result = selectPreferredGraph(existing, candidate)

    expect(result.graph).toBe(candidate)
    expect(result.preservedExisting).toBe(false)
    expect(result.existingSource).toBe(GRAPH_SOURCES.HEURISTIC)
    expect(result.candidateSource).toBe(GRAPH_SOURCES.CLAUDE)
  })

  it('returns existing when it has higher priority', () => {
    const existing = { meta: { source: GRAPH_SOURCES.MANUAL } }
    const candidate = { meta: { source: GRAPH_SOURCES.HEURISTIC } }
    const result = selectPreferredGraph(existing, candidate)

    expect(result.graph).toBe(existing)
    expect(result.preservedExisting).toBe(true)
  })

  it('returns candidate when forceRefresh overrides', () => {
    const existing = { meta: { source: GRAPH_SOURCES.MANUAL } }
    const candidate = { meta: { source: GRAPH_SOURCES.HEURISTIC } }
    const result = selectPreferredGraph(existing, candidate, { forceRefresh: true })

    expect(result.graph).toBe(candidate)
    expect(result.preservedExisting).toBe(false)
  })

  it('handles missing meta gracefully', () => {
    const existing = {}
    const candidate = {}
    const result = selectPreferredGraph(existing, candidate)

    expect(result.existingSource).toBe('none')
    expect(result.candidateSource).toBe('none')
  })
})
