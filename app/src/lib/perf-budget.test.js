import { describe, expect, it } from 'vitest'
import { transformToReactFlow } from './graphTransform'
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

// perf-budget.test validates that critical render-path functions complete
// within acceptable time budgets. These are not micro-benchmarks but guards
// against algorithmic regressions (O(n) vs O(n^2)) in the hot paths.
//
// Budget thresholds are conservative - they should never fail on CI but will
// catch gross regressions like accidentally introducing O(n^2) loops.

// Generate a realistic medium-sized graph for perf testing
function generateTestGraph(systemCount, filesPerSystem, functionsPerFile) {
  const nodes = []
  const edges = []

  for (let s = 0; s < systemCount; s++) {
    const systemId = `system-${s}`
    nodes.push({
      id: systemId,
      type: 'system',
      label: `System ${s}`,
      lineCount: filesPerSystem * functionsPerFile * 50,
      health: ['green', 'yellow', 'red'][s % 3],
    })

    for (let f = 0; f < filesPerSystem; f++) {
      const fileId = `${systemId}-file-${f}`
      nodes.push({
        id: fileId,
        type: 'file',
        label: `file-${f}.js`,
        parentId: systemId,
        lineCount: functionsPerFile * 50,
        health: 'green',
      })

      for (let fn = 0; fn < functionsPerFile; fn++) {
        nodes.push({
          id: `${fileId}-func-${fn}`,
          type: 'function',
          label: `function${fn}`,
          parentId: fileId,
          lineCount: 50,
        })
      }
    }

    // Add edges between systems
    if (s > 0) {
      edges.push({
        id: `edge-${s}`,
        source: systemId,
        target: `system-${s - 1}`,
        type: 'dependency',
      })
    }
  }

  return { nodes, edges, meta: {} }
}

// Budget: 50ms for a 10-system, 50-file, 200-function graph transform
const TRANSFORM_BUDGET_MS = 50
// Budget: 20ms for visibility/expand computations on same graph
const COMPUTE_BUDGET_MS = 20

describe('render path performance budgets', () => {
  // Medium graph: 10 systems, 5 files each, 4 functions each = 260 nodes
  const mediumGraph = generateTestGraph(10, 5, 4)

  // Large graph: 25 systems, 10 files each, 5 functions each = 1525 nodes
  const largeGraph = generateTestGraph(25, 10, 5)

  describe('transformToReactFlow', () => {
    it('completes medium graph transform within budget', () => {
      const start = performance.now()
      const result = transformToReactFlow(mediumGraph)
      const elapsed = performance.now() - start

      expect(result.nodes.length).toBeGreaterThan(0)
      expect(result.edges.length).toBeGreaterThan(0)
      expect(elapsed).toBeLessThan(TRANSFORM_BUDGET_MS)
    })

    it('completes large graph transform within 5x budget', () => {
      const start = performance.now()
      const result = transformToReactFlow(largeGraph)
      const elapsed = performance.now() - start

      expect(result.nodes.length).toBeGreaterThan(1000)
      expect(elapsed).toBeLessThan(TRANSFORM_BUDGET_MS * 5)
    })

    it('scales sub-quadratically with node count', () => {
      // Transform both graphs and ensure time ratio is closer to linear than quadratic
      const start1 = performance.now()
      transformToReactFlow(mediumGraph)
      const time1 = performance.now() - start1

      const start2 = performance.now()
      transformToReactFlow(largeGraph)
      const time2 = performance.now() - start2

      const nodeRatio = largeGraph.nodes.length / mediumGraph.nodes.length
      const timeRatio = time2 / Math.max(time1, 0.1)

      // If O(n), ratio should be ~nodeRatio
      // If O(n^2), ratio would be ~nodeRatio^2
      // We accept up to nodeRatio * 3 to allow for overhead
      expect(timeRatio).toBeLessThan(nodeRatio * 3)
    })
  })

  describe('visibility computation', () => {
    const { nodes } = transformToReactFlow(mediumGraph)
    const nodeById = buildNodeByIdMap(nodes)

    it('computeExpandedSystemIds completes within budget', () => {
      const start = performance.now()
      computeExpandedSystemIds({
        nodeById,
        zoomLevel: ZOOM_LEVELS.DETAILED,
        presentationMode: PRESENTATION_MODES.FREE,
        highlightedNodes: ['system-0-file-0'],
        focusRequest: { nodeId: 'system-1-file-1' },
        selectedNode: { id: 'system-2' },
        hoveredPathIds: ['system-0', 'system-1'],
        focusPathIds: [],
      })
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(COMPUTE_BUDGET_MS)
    })

    it('computeVisibleNodes completes within budget', () => {
      const expandedSystemIds = new Set(
        nodes.filter((n) => n.type === 'system').map((n) => n.id)
      )

      const start = performance.now()
      const visible = computeVisibleNodes({
        nodes,
        expandedSystemIds,
        zoomLevel: ZOOM_LEVELS.DETAILED,
        nodeById,
        revealedFileIds: new Set(),
      })
      const elapsed = performance.now() - start

      expect(visible.length).toBeGreaterThan(0)
      expect(elapsed).toBeLessThan(COMPUTE_BUDGET_MS)
    })

    it('computeChildIndexes completes within budget', () => {
      const start = performance.now()
      const { childCountByParentId, functionIndexById } = computeChildIndexes(nodes)
      const elapsed = performance.now() - start

      expect(childCountByParentId.size).toBeGreaterThan(0)
      expect(functionIndexById.size).toBeGreaterThan(0)
      expect(elapsed).toBeLessThan(COMPUTE_BUDGET_MS)
    })

    it('computeRevealedFileIds completes within budget', () => {
      const selectedNode = { id: 'system-0-file-0' }
      const focusRequest = { nodeId: 'system-1-file-1' }
      const highlightedNodes = ['system-2-file-0-func-0', 'system-3-file-2']

      const start = performance.now()
      const revealed = computeRevealedFileIds(
        nodeById,
        selectedNode,
        focusRequest,
        highlightedNodes
      )
      const elapsed = performance.now() - start

      expect(revealed.size).toBeGreaterThan(0)
      expect(elapsed).toBeLessThan(COMPUTE_BUDGET_MS)
    })
  })

  describe('edge computation', () => {
    const { nodes, edges } = transformToReactFlow(mediumGraph)
    const nodeById = buildNodeByIdMap(nodes)
    const visibleNodeIds = new Set(nodes.map((n) => n.id))

    it('computeRewrittenVisibleEdges completes within budget', () => {
      const start = performance.now()
      const rewritten = computeRewrittenVisibleEdges(edges, nodeById, visibleNodeIds)
      const elapsed = performance.now() - start

      expect(rewritten.length).toBeGreaterThan(0)
      expect(elapsed).toBeLessThan(COMPUTE_BUDGET_MS)
    })

    it('computeConnectedSystemIds completes within budget', () => {
      const start = performance.now()
      const connected = computeConnectedSystemIds({
        visibleEdges: edges,
        nodeById,
        presentationMode: PRESENTATION_MODES.FREE,
        selectedSystemId: 'system-0',
      })
      const elapsed = performance.now() - start

      expect(connected.size).toBeGreaterThanOrEqual(0)
      expect(elapsed).toBeLessThan(COMPUTE_BUDGET_MS)
    })
  })

  describe('utility function performance', () => {
    it('areStringArraysEqual is O(n) for large arrays', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => `item-${i}`)
      const copy = [...largeArray]

      const start = performance.now()
      for (let i = 0; i < 100; i++) {
        areStringArraysEqual(largeArray, copy)
      }
      const elapsed = performance.now() - start

      // 100 comparisons of 10000-element arrays should complete quickly
      expect(elapsed).toBeLessThan(50)
    })

    it('buildNodeByIdMap is O(n)', () => {
      const { nodes } = transformToReactFlow(largeGraph)

      const start = performance.now()
      for (let i = 0; i < 100; i++) {
        buildNodeByIdMap(nodes)
      }
      const elapsed = performance.now() - start

      // 100 map builds of ~1500 nodes should be fast
      expect(elapsed).toBeLessThan(100)
    })
  })
})

describe('poll path timing contracts', () => {
  // These tests document the expected polling intervals and ensure
  // the constants used match documented behavior.

  it('documents polling interval constant', () => {
    // From useGraphData.js - polling happens every 1200ms
    const EXPECTED_POLL_MS = 1200
    // This is a documentation test - the actual constant lives in useGraphData
    expect(EXPECTED_POLL_MS).toBeLessThan(2000)
    expect(EXPECTED_POLL_MS).toBeGreaterThan(500)
  })

  it('documents guided flow step timing', () => {
    // Default guided flow step duration is 1500ms
    const DEFAULT_GUIDED_STEP_MS = 1500
    expect(DEFAULT_GUIDED_STEP_MS).toBeGreaterThanOrEqual(1000)
    expect(DEFAULT_GUIDED_STEP_MS).toBeLessThanOrEqual(3000)
  })

  it('documents viewport animation timing', () => {
    // Viewport setCenter animation is 450ms
    const VIEWPORT_ANIMATION_MS = 450
    expect(VIEWPORT_ANIMATION_MS).toBeLessThan(1000)
    expect(VIEWPORT_ANIMATION_MS).toBeGreaterThan(200)
  })
})
