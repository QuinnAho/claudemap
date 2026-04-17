#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

const { installClaudeMap } = require('./install-claudemap.js')
const { buildClaudeMapArtifact } = require('./package-claudemap-skill.js')

async function loadPathContracts() {
  return import('../skill/lib/contracts/paths.js')
}

const REPO_ROOT = path.resolve(__dirname, '..')
const ARTIFACTS_ROOT = path.join(REPO_ROOT, 'artifacts')
const SMOKE_ROOT = path.join(ARTIFACTS_ROOT, 'smoke')
const ARTIFACT_OUTPUT_ROOT = path.join(SMOKE_ROOT, 'artifact')
const FIXTURE_ROOT = path.join(SMOKE_ROOT, 'package-fixture')
const GRAPH_DIR = path.join(
  FIXTURE_ROOT,
  '.claude',
  'skills',
  'claudemap-runtime',
  'app',
  'public',
  'graph',
)

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function removeAndRecreate(directoryPath) {
  fs.rmSync(directoryPath, { force: true, recursive: true })
  fs.mkdirSync(directoryPath, { recursive: true })
}

async function buildArtifact() {
  removeAndRecreate(ARTIFACT_OUTPUT_ROOT)
  const { artifactRoot } = await buildClaudeMapArtifact({
    outputRoot: ARTIFACT_OUTPUT_ROOT,
    zip: false,
  })

  assert(fs.existsSync(artifactRoot), `Packaged artifact not found: ${artifactRoot}`)
  return artifactRoot
}

function createFixtureRepo() {
  removeAndRecreate(FIXTURE_ROOT)
  writeJson(path.join(FIXTURE_ROOT, 'package.json'), {
    name: 'claudemap-smoke-fixture',
    private: true,
    type: 'module',
  })
  writeText(
    path.join(FIXTURE_ROOT, 'src', 'index.js'),
    [
      "import { createSession } from './services/session.js'",
      "import { renderApp } from './ui/app.js'",
      '',
      'export function start() {',
      '  return renderApp(createSession())',
      '}',
      '',
    ].join('\n'),
  )
  writeText(
    path.join(FIXTURE_ROOT, 'src', 'services', 'session.js'),
    [
      "import { readConfig } from '../shared/config.js'",
      '',
      'export function createSession() {',
      '  const config = readConfig()',
      "  return { status: 'ready', config }",
      '}',
      '',
      'export function resetSession() {',
      "  return { status: 'idle' }",
      '}',
      '',
    ].join('\n'),
  )
  writeText(
    path.join(FIXTURE_ROOT, 'src', 'ui', 'app.js'),
    [
      "import { readConfig } from '../shared/config.js'",
      '',
      'export function renderApp(session) {',
      '  const config = readConfig()',
      '  return { session, config }',
      '}',
      '',
    ].join('\n'),
  )
  writeText(
    path.join(FIXTURE_ROOT, 'src', 'shared', 'config.js'),
    [
      'export function readConfig() {',
      "  return { feature: 'smoke-test' }",
      '}',
      '',
    ].join('\n'),
  )
}

async function loadInstalledCommand(commandFileName) {
  const commandPath = path.join(
    FIXTURE_ROOT,
    '.claude',
    'skills',
    'claudemap-runtime',
    'skill',
    'commands',
    commandFileName,
  )
  const moduleUrl = `${pathToFileURL(commandPath).href}?t=${Date.now()}-${Math.random()}`
  return import(moduleUrl)
}

function assertPromptTemplates() {
  const setupTemplatePath = path.join(FIXTURE_ROOT, '.claude', 'commands', 'setup-claudemap.md')
  const createMapTemplatePath = path.join(FIXTURE_ROOT, '.claude', 'commands', 'create-map.md')
  const setupTemplate = fs.readFileSync(setupTemplatePath, 'utf8')
  const createMapTemplate = fs.readFileSync(createMapTemplatePath, 'utf8')

  assert(
    setupTemplate.includes('Does this map look right, or should I refine it?'),
    'Packaged setup-claudemap template is missing the post-render feedback prompt.',
  )
  assert(
    createMapTemplate.includes('Does this map look right, or should I refine it?'),
    'Packaged create-map template is missing the post-render feedback prompt.',
  )
  assert(
    !createMapTemplate.includes('.claude/claudemap-maps.json'),
    'Packaged create-map template still points at .claude/claudemap-maps.json.',
  )
  assert(
    createMapTemplate.includes("repo-root `claudemap-maps.json`"),
    'Packaged create-map template does not point at the repo-root claudemap-maps.json manifest.',
  )
}

function assertInstalledLayout() {
  const rootGraphPath = path.join(GRAPH_DIR, 'claudemap-runtime.json')
  const rootStatePath = path.join(GRAPH_DIR, 'claudemap-runtime-state.json')
  const legacyRootGraphPath = path.join(
    FIXTURE_ROOT,
    '.claude',
    'skills',
    'claudemap-runtime',
    'app',
    'public',
    'claudemap-runtime.json',
  )

  assert(fs.existsSync(rootGraphPath), `Missing packaged root graph: ${rootGraphPath}`)
  assert(fs.existsSync(rootStatePath), `Missing packaged root runtime state: ${rootStatePath}`)
  assert(!fs.existsSync(legacyRootGraphPath), `Legacy root graph path should not exist: ${legacyRootGraphPath}`)
}

function pickScopedSystemId(cachePath) {
  const cache = readJson(cachePath)
  const systemNode = (cache.graph?.nodes || []).find((node) => node.type === 'system')
  assert(systemNode, `No system node found in ${cachePath}`)
  return systemNode
}

function assertRootManifest(manifestPath) {
  const manifest = readJson(manifestPath)
  const rootEntry = manifest.maps.find((entry) => entry.id === 'root')

  assert(rootEntry, 'Root map entry missing from claudemap-maps.json.')
  assert(
    rootEntry.graphPath === 'graph/claudemap-runtime.json',
    `Root map graphPath should use graph/: ${rootEntry.graphPath}`,
  )
  assert(
    rootEntry.statePath === 'graph/claudemap-runtime-state.json',
    `Root map statePath should use graph/: ${rootEntry.statePath}`,
  )
}

function assertScopedManifest(manifestPath, expectedMapId) {
  const manifest = readJson(manifestPath)
  const scopedEntry = manifest.maps.find((entry) => entry.id === expectedMapId)

  assert(scopedEntry, `Scoped map entry missing from claudemap-maps.json: ${expectedMapId}`)
  assert(
    scopedEntry.graphPath === `graph/claudemap-runtime.${expectedMapId}.json`,
    `Scoped map graphPath should use graph/: ${scopedEntry.graphPath}`,
  )
  assert(
    scopedEntry.statePath === `graph/claudemap-runtime-state.${expectedMapId}.json`,
    `Scoped map statePath should use graph/: ${scopedEntry.statePath}`,
  )

  const scopedGraphPath = path.join(
    GRAPH_DIR,
    `claudemap-runtime.${expectedMapId}.json`,
  )
  const legacyScopedGraphPath = path.join(
    FIXTURE_ROOT,
    '.claude',
    'skills',
    'claudemap-runtime',
    'app',
    'public',
    `claudemap-runtime.${expectedMapId}.json`,
  )

  assert(fs.existsSync(scopedGraphPath), `Scoped graph not written into graph/: ${scopedGraphPath}`)
  assert(
    !fs.existsSync(legacyScopedGraphPath),
    `Scoped graph should not be written to the legacy public root: ${legacyScopedGraphPath}`,
  )
}

function assertStrictEnrichmentFailure(setupCommandPath) {
  const emptyEnrichmentPath = path.join(FIXTURE_ROOT, 'empty-enrichment.json')
  fs.writeFileSync(emptyEnrichmentPath, '')

  return setupCommandPath([FIXTURE_ROOT, '--no-start-app', '--enrichment-file', emptyEnrichmentPath])
    .then(() => {
      throw new Error('setup-claudemap should fail for an empty --enrichment-file.')
    })
    .catch((error) => {
      assert(
        error.message.includes('Enrichment file is empty'),
        `Expected strict enrichment failure message. Got:\n${error.message || '(no error message)'}`,
      )
    })
}

async function assertScopedPythonEdgeInference() {
  const scopedMapModulePath = path.join(REPO_ROOT, 'skill', 'lib', 'scoped-map.js')
  const scopedMapModuleUrl = `${pathToFileURL(scopedMapModulePath).href}?t=${Date.now()}-${Math.random()}`
  const { buildScopedGraphFromRoot } = await import(scopedMapModuleUrl)
  const { GRAPH_SOURCES } = await import('../skill/lib/contracts/graph-sources.js')
  const rootGraph = {
    meta: {
      repoName: 'python-scope-fixture',
      branch: 'main',
      generatedAt: new Date().toISOString(),
      source: GRAPH_SOURCES.CLAUDE,
    },
    nodes: [
      {
        id: 'system-data',
        label: 'Data Pipeline',
        type: 'system',
        icon: 'database',
        parentId: null,
        filePath: 'src/data',
      },
      {
        id: 'system-data-vocab',
        label: 'Vocabulary',
        type: 'system',
        icon: 'code',
        parentId: 'system-data',
        filePath: 'src/data',
      },
      {
        id: 'file-vocab',
        label: 'vocab.py',
        type: 'file',
        icon: 'file',
        parentId: 'system-data-vocab',
        filePath: 'src/data/vocab.py',
      },
      {
        id: 'system-data-loading',
        label: 'Dataset Loading',
        type: 'system',
        icon: 'server',
        parentId: 'system-data',
        filePath: 'src/data',
      },
      {
        id: 'file-dataset',
        label: 'dataset.py',
        type: 'file',
        icon: 'file',
        parentId: 'system-data-loading',
        filePath: 'src/data/dataset.py',
      },
    ],
    edges: [],
    files: [
      {
        path: 'src/data/vocab.py',
        relativePath: 'src/data/vocab.py',
        name: 'vocab.py',
        directory: 'src/data',
        lineCount: 40,
        language: 'python',
        imports: [],
        exports: [],
      },
      {
        path: 'src/data/dataset.py',
        relativePath: 'src/data/dataset.py',
        name: 'dataset.py',
        directory: 'src/data',
        lineCount: 80,
        language: 'python',
        imports: ['src.data.vocab'],
        exports: [],
      },
    ],
  }

  const scopedGraph = buildScopedGraphFromRoot(rootGraph, 'system-data')
  const scopedEdge = scopedGraph.edges.find(
    (edge) =>
      edge.source === 'system-data-loading' &&
      edge.target === 'system-data-vocab' &&
      edge.type === 'imports',
  )

  assert(
    scopedGraph.meta?.scope?.layout === 'promoted-children',
    `Expected promoted scoped layout. Got: ${scopedGraph.meta?.scope?.layout || '(missing)'}`,
  )
  assert(scopedEdge, 'Scoped Python map should infer an edge from dataset loading to vocabulary.')
}

async function main() {
  createFixtureRepo()
  const artifactRoot = await buildArtifact()
  await installClaudeMap({
    artifactRoot,
    buildArtifact: false,
    dryRun: false,
    installDependencies: false,
    mode: 'install',
    targetRoot: FIXTURE_ROOT,
  })

  assertInstalledLayout()
  assertPromptTemplates()

  const { main: setupMain } = await loadInstalledCommand('setup-claudemap.js')
  const { main: createMapMain } = await loadInstalledCommand('create-map.js')
  const manifestPath = path.join(FIXTURE_ROOT, 'claudemap-maps.json')
  const cachePath = path.join(FIXTURE_ROOT, 'claudemap-cache.json')

  await setupMain([FIXTURE_ROOT, '--no-start-app'])
  assertRootManifest(manifestPath)

  const systemNode = pickScopedSystemId(cachePath)
  const scopedPayload = JSON.stringify({
    scope: {
      rootSystemId: systemNode.id,
      rootSystemLabel: systemNode.label,
      ancestorPath: [],
    },
    label: `${systemNode.label} Focus`,
    summary: 'Smoke test scoped map',
  })

  await createMapMain([FIXTURE_ROOT, '--scope-json', scopedPayload])

  const manifestAfterCreateMap = readJson(manifestPath)
  const scopedEntry = manifestAfterCreateMap.maps.find((entry) => entry.id !== 'root')
  assert(scopedEntry, 'Expected create-map to add a scoped map entry.')
  assertScopedManifest(manifestPath, scopedEntry.id)
  await assertStrictEnrichmentFailure(setupMain)
  await assertScopedPythonEdgeInference()

  console.log(`ClaudeMap package smoke test passed`)
  console.log(`Artifact: ${artifactRoot}`)
  console.log(`Fixture repo: ${FIXTURE_ROOT}`)
}

main().catch((error) => {
  console.error(`ClaudeMap package smoke test failed: ${error.message}`)
  process.exitCode = 1
})
