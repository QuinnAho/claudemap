#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '..')
const APP_ROOT = path.join(REPO_ROOT, 'app')
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json')
const TEMP_BUILD_CONFIG_PATH = path.join(APP_ROOT, '.claudemap-build.json')

async function loadPathContracts() {
  return import('../skill/lib/contracts/paths.js')
}
async function loadSchemaValidators() {
  return import('../skill/lib/contracts/schemas/index.js')
}

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

function createRuntimeStateFromGraph(graphData, contracts) {
  const { GRAPH_SOURCES, PRESENTATION_MODES } = contracts
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
      source: normalizedGraph.meta?.source || GRAPH_SOURCES.MANUAL,
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

async function main() {
  const [{ GRAPH_SOURCES }, { PRESENTATION_MODES }, paths, schemas] = await Promise.all([
    import('../skill/lib/contracts/graph-sources.js'),
    import('../skill/lib/contracts/presentation.js'),
    loadPathContracts(),
    loadSchemaValidators(),
  ])
  const contracts = { GRAPH_SOURCES, PRESENTATION_MODES }
  const outputRoot = path.join(REPO_ROOT, paths.DOCS_DIR_REL)
  const runtimeGraphPath = path.join(APP_ROOT, 'public', paths.RUNTIME_GRAPH_REL)
  const runtimeStatePath = path.join(APP_ROOT, 'public', paths.RUNTIME_STATE_REL)
  const runtimeManifestPath = path.join(APP_ROOT, 'public', paths.MAPS_MANIFEST_FILENAME)
  const repoManifestPath = path.join(REPO_ROOT, paths.MAPS_MANIFEST_FILENAME)
  const seededSelfMapPath = path.join(REPO_ROOT, paths.SEED_MAP_REL)
  const pagesConfig = getGitHubPagesConfig()
  const seededSelfMap = schemas.validateWithWarning(
    schemas.SCHEMA_NAMES.GRAPH,
    readJsonFile(seededSelfMapPath),
    { path: seededSelfMapPath },
  )
  // Prefer the repo-root manifest (populated by CLI commands like
  // /create-map) so the deployed site advertises every scoped submap. Fall
  // back to the root-only default for first-time builds where no submaps
  // exist yet.
  const siteManifest = fs.existsSync(repoManifestPath)
    ? readJsonFile(repoManifestPath)
    : createDefaultMapsManifest(paths)
  const originalGraph = fs.existsSync(runtimeGraphPath)
    ? fs.readFileSync(runtimeGraphPath, 'utf8')
    : null
  const originalRuntimeState = fs.existsSync(runtimeStatePath)
    ? fs.readFileSync(runtimeStatePath, 'utf8')
    : null
  const originalRuntimeManifest = fs.existsSync(runtimeManifestPath)
    ? fs.readFileSync(runtimeManifestPath, 'utf8')
    : null

  try {
    writeJsonFile(TEMP_BUILD_CONFIG_PATH, {
      base: pagesConfig.basePath,
      outDir: outputRoot,
      emptyOutDir: true,
    })
    writeJsonFile(runtimeGraphPath, seededSelfMap)
    writeJsonFile(runtimeStatePath, createRuntimeStateFromGraph(seededSelfMap, contracts))
    writeJsonFile(runtimeManifestPath, siteManifest)

    const result = buildApp()

    if (result.error) {
      throw result.error
    }

    if (result.status !== 0) {
      throw new Error('Failed to build the ClaudeMap site')
    }
  } finally {
    if (originalGraph === null) {
      fs.rmSync(runtimeGraphPath, { force: true })
    } else {
      fs.writeFileSync(runtimeGraphPath, originalGraph)
    }

    if (originalRuntimeState === null) {
      fs.rmSync(runtimeStatePath, { force: true })
    } else {
      fs.writeFileSync(runtimeStatePath, originalRuntimeState)
    }
    if (originalRuntimeManifest === null) {
      fs.rmSync(runtimeManifestPath, { force: true })
    } else {
      fs.writeFileSync(runtimeManifestPath, originalRuntimeManifest)
    }

    if (fs.existsSync(TEMP_BUILD_CONFIG_PATH)) {
      fs.rmSync(TEMP_BUILD_CONFIG_PATH, { force: true })
    }
  }

  fs.writeFileSync(path.join(outputRoot, '.nojekyll'), '')
  console.log(`ClaudeMap site ready at ${outputRoot}`)

  if (pagesConfig.publicUrl) {
    console.log(`Expected GitHub Pages URL: ${pagesConfig.publicUrl}`)
  }
}

main().catch((error) => {
  console.error(`ClaudeMap site build failed: ${error.message}`)
  process.exitCode = 1
})
