#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { buildSeedMapGraph } = require('./lib/seed-map-builder.js')

async function main() {
  const [{ collectProjectSnapshot }, { GRAPH_SOURCES }, { PRESENTATION_MODES }, paths] = await Promise.all([
    import('../skill/lib/file-walker.js'),
    import('../skill/lib/contracts/graph-sources.js'),
    import('../skill/lib/contracts/presentation.js'),
    import('../skill/lib/contracts/paths.js'),
  ])
  const contracts = { GRAPH_SOURCES, PRESENTATION_MODES }

  const repoRoot = path.resolve(__dirname, '..')
  const snapshot = collectProjectSnapshot(repoRoot)
  const { graph, filteredSnapshot, excludedPaths } = buildSeedMapGraph(snapshot, contracts)
  const runtimeState = createRuntimeStateFromGraph(graph, contracts)
  const mapsManifest = createDefaultMapsManifest(paths)

  const seedMapPath = path.join(repoRoot, paths.SEED_MAP_REL)
  writeJsonFile(seedMapPath, graph)
  writeJsonFile(path.join(repoRoot, paths.DOCS_DIR_REL, paths.RUNTIME_GRAPH_REL), graph)
  writeJsonFile(path.join(repoRoot, paths.DOCS_DIR_REL, paths.RUNTIME_STATE_REL), runtimeState)
  writeJsonFile(path.join(repoRoot, paths.DOCS_DIR_REL, paths.MAPS_MANIFEST_FILENAME), mapsManifest)

  console.log(`Seed map ready at ${seedMapPath}`)
  console.log(`Included files: ${filteredSnapshot.totalFiles}`)
  console.log(`Excluded paths: ${excludedPaths.join(', ')}`)
  console.log(`Graph source: ${graph.meta?.source || GRAPH_SOURCES.HEURISTIC}`)
  console.log(`Graph size: ${graph.nodes.length} nodes, ${graph.edges.length} edges`)
}

function createRuntimeStateFromGraph(graph, contracts) {
  const { GRAPH_SOURCES, PRESENTATION_MODES } = contracts
  const normalizedGraph =
    graph && Array.isArray(graph.nodes) && Array.isArray(graph.edges)
      ? graph
      : { meta: {}, nodes: [], edges: [], files: [] }

  return {
    graphRevision: 0,
    updatedAt: normalizedGraph.meta?.generatedAt || null,
    graphMeta: {
      repoName: normalizedGraph.meta?.repoName || 'claudemap',
      generatedAt: normalizedGraph.meta?.generatedAt || null,
      source: normalizedGraph.meta?.source || GRAPH_SOURCES.HEURISTIC,
      nodeCount: normalizedGraph.nodes.length,
      edgeCount: normalizedGraph.edges.length,
      fileCount: Array.isArray(normalizedGraph.files) ? normalizedGraph.files.length : 0,
    },
    runtime: {
      healthOverlay: false,
      highlightedNodeIds: [],
      highlightColor: 'accent',
      focus: null,
      guidedFlow: null,
      presentation: {
        mode: PRESENTATION_MODES.FREE,
        lockInput: false,
        title: null,
        explanation: null,
        body: null,
        stepLabel: null,
        updatedAt: null,
      },
    },
  }
}

function createDefaultMapsManifest(paths) {
  return {
    version: 1,
    activeMapId: 'root',
    maps: [
      {
        id: 'root',
        label: 'ClaudeMap',
        summary: 'Full repo overview',
        scope: null,
        cachePath: paths.CACHE_FILENAME,
        graphPath: paths.RUNTIME_GRAPH_REL,
        statePath: paths.RUNTIME_STATE_REL,
      },
    ],
  }
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

main().catch((error) => {
  console.error(`ClaudeMap seed-map generation failed: ${error.message}`)
  process.exitCode = 1
})
