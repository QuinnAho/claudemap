#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '..')
const APP_ROOT = path.join(REPO_ROOT, 'app')
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json')
const OUTPUT_ROOT = path.join(REPO_ROOT, 'docs')
const TEMP_BUILD_CONFIG_PATH = path.join(APP_ROOT, '.claudemap-build.json')
const RUNTIME_GRAPH_PATH = path.join(APP_ROOT, 'public', 'claudemap-runtime.json')
const RUNTIME_STATE_PATH = path.join(APP_ROOT, 'public', 'claudemap-runtime-state.json')
const RUNTIME_MANIFEST_PATH = path.join(APP_ROOT, 'public', 'claudemap-maps.json')
const SEEDED_SELF_MAP_PATH = path.join(REPO_ROOT, 'contracts', 'claudemap-seed-map.json')

function readRepositoryUrl() {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'))
  return packageJson.repository?.url || ''
}

function getGitHubPagesConfig() {
  const repositoryUrl = readRepositoryUrl()
  const match = repositoryUrl.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(?:\.git)?$/i)

  if (!match?.groups?.owner || !match?.groups?.repo) {
    return {
      basePath: '/',
      publicUrl: null,
    }
  }

  const owner = match.groups.owner
  const repo = match.groups.repo

  return {
    basePath: `/${repo}/`,
    publicUrl: `https://${owner.toLowerCase()}.github.io/${repo}/`,
  }
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

function createRuntimeStateFromGraph(graphData) {
  const normalizedGraph =
    graphData && Array.isArray(graphData.nodes) && Array.isArray(graphData.edges)
      ? graphData
      : { meta: {}, nodes: [], edges: [], files: [] }

  return {
    graphRevision: 0,
    updatedAt: normalizedGraph.meta?.generatedAt || null,
    graphMeta: {
      repoName: normalizedGraph.meta?.repoName || 'claudemap',
      generatedAt: normalizedGraph.meta?.generatedAt || null,
      source: normalizedGraph.meta?.source || 'manual',
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
        graphPath: 'claudemap-runtime.json',
        statePath: 'claudemap-runtime-state.json',
      },
    ],
  }
}

function buildApp() {
  const npmExecPath = process.env.npm_execpath

  if (npmExecPath) {
    return spawnSync(process.execPath, [npmExecPath, '--workspace', 'app', 'run', 'build'], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: process.env,
    })
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  return spawnSync(npmCommand, ['--workspace', 'app', 'run', 'build'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  })
}

function main() {
  const pagesConfig = getGitHubPagesConfig()
  const seededSelfMap = readJsonFile(SEEDED_SELF_MAP_PATH)
  const originalGraph = fs.existsSync(RUNTIME_GRAPH_PATH)
    ? fs.readFileSync(RUNTIME_GRAPH_PATH, 'utf8')
    : null
  const originalRuntimeState = fs.existsSync(RUNTIME_STATE_PATH)
    ? fs.readFileSync(RUNTIME_STATE_PATH, 'utf8')
    : null
  const originalRuntimeManifest = fs.existsSync(RUNTIME_MANIFEST_PATH)
    ? fs.readFileSync(RUNTIME_MANIFEST_PATH, 'utf8')
    : null

  try {
    writeJsonFile(TEMP_BUILD_CONFIG_PATH, {
      base: pagesConfig.basePath,
      outDir: OUTPUT_ROOT,
      emptyOutDir: true,
    })
    writeJsonFile(RUNTIME_GRAPH_PATH, seededSelfMap)
    writeJsonFile(RUNTIME_STATE_PATH, createRuntimeStateFromGraph(seededSelfMap))
    writeJsonFile(RUNTIME_MANIFEST_PATH, createDefaultMapsManifest())

    const result = buildApp()

    if (result.error) {
      throw result.error
    }

    if (result.status !== 0) {
      throw new Error('Failed to build the ClaudeMap site')
    }
  } finally {
    if (originalGraph === null) {
      fs.rmSync(RUNTIME_GRAPH_PATH, { force: true })
    } else {
      fs.writeFileSync(RUNTIME_GRAPH_PATH, originalGraph)
    }

    if (originalRuntimeState === null) {
      fs.rmSync(RUNTIME_STATE_PATH, { force: true })
    } else {
      fs.writeFileSync(RUNTIME_STATE_PATH, originalRuntimeState)
    }
    if (originalRuntimeManifest === null) {
      fs.rmSync(RUNTIME_MANIFEST_PATH, { force: true })
    } else {
      fs.writeFileSync(RUNTIME_MANIFEST_PATH, originalRuntimeManifest)
    }

    if (fs.existsSync(TEMP_BUILD_CONFIG_PATH)) {
      fs.rmSync(TEMP_BUILD_CONFIG_PATH, { force: true })
    }
  }

  fs.writeFileSync(path.join(OUTPUT_ROOT, '.nojekyll'), '')
  console.log(`ClaudeMap site ready at ${OUTPUT_ROOT}`)

  if (pagesConfig.publicUrl) {
    console.log(`Expected GitHub Pages URL: ${pagesConfig.publicUrl}`)
  }
}

try {
  main()
} catch (error) {
  console.error(`ClaudeMap site build failed: ${error.message}`)
  process.exitCode = 1
}
