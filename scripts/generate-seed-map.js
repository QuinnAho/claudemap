#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { buildSeedMapGraph } = require('./lib/seed-map-builder.js')

async function main() {
  const [{ collectProjectSnapshot }] = await Promise.all([
    import('../skill/lib/file-walker.js'),
  ])

  const repoRoot = path.resolve(__dirname, '..')
  const snapshot = collectProjectSnapshot(repoRoot)
  const { graph, filteredSnapshot, excludedPaths } = buildSeedMapGraph(snapshot)
  const runtimeState = createRuntimeStateFromGraph(graph)
  const mapsManifest = createDefaultMapsManifest()

  writeJsonFile(path.join(repoRoot, 'contracts', 'claudemap-seed-map.json'), graph)
  writeJsonFile(path.join(repoRoot, 'docs', 'graph', 'claudemap-runtime.json'), graph)
  writeJsonFile(path.join(repoRoot, 'docs', 'graph', 'claudemap-runtime-state.json'), runtimeState)
  writeJsonFile(path.join(repoRoot, 'docs', 'claudemap-maps.json'), mapsManifest)

  console.log(`Seed map ready at ${path.join(repoRoot, 'contracts', 'claudemap-seed-map.json')}`)
  console.log(`Included files: ${filteredSnapshot.totalFiles}`)
  console.log(`Excluded paths: ${excludedPaths.join(', ')}`)
  console.log(`Graph source: ${graph.meta?.source || 'heuristic'}`)
  console.log(`Graph size: ${graph.nodes.length} nodes, ${graph.edges.length} edges`)
}

function createRuntimeStateFromGraph(graph) {
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
      source: normalizedGraph.meta?.source || 'heuristic',
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
        mode: 'free',
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

function createDefaultMapsManifest() {
  return {
    version: 1,
    activeMapId: 'root',
    maps: [
      {
        id: 'root',
        label: 'ClaudeMap',
        summary: 'Full repo overview',
        scope: null,
        cachePath: 'claudemap-cache.json',
        graphPath: 'graph/claudemap-runtime.json',
        statePath: 'graph/claudemap-runtime-state.json',
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
