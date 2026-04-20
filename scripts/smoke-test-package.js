#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const { execSync } = require('child_process')

const { installClaudeMap } = require('./install-claudemap.js')
const {
  buildClaudeMapArtifact,
  createAppExclusionRules,
} = require('./package-claudemap-skill.js')

async function loadPathContracts() {
  return import('../skill/lib/contracts/paths.js')
}

async function loadSchemas() {
  return import('../skill/lib/contracts/schemas/index.js')
}

async function loadErrors() {
  return import('../skill/lib/contracts/errors.js')
}

const REPO_ROOT = path.resolve(__dirname, '..')
const ARTIFACTS_ROOT = path.join(REPO_ROOT, 'artifacts')
const SMOKE_ROOT = path.join(ARTIFACTS_ROOT, 'smoke')
const ARTIFACT_OUTPUT_ROOT = path.join(SMOKE_ROOT, 'artifact')
const CODEX_ARTIFACT_OUTPUT_ROOT = path.join(SMOKE_ROOT, 'artifact-codex')
const DUAL_ARTIFACT_OUTPUT_ROOT = path.join(SMOKE_ROOT, 'artifact-dual')
const FIXTURE_ROOT = path.join(SMOKE_ROOT, 'package-fixture')
const CODEX_FIXTURE_ROOT = path.join(SMOKE_ROOT, 'package-fixture-codex')
const CROSS_ASSISTANT_FIXTURE_ROOT = path.join(SMOKE_ROOT, 'package-fixture-cross-assistant')
const PUBLISHED_PACKAGE_ROOT = path.join(SMOKE_ROOT, 'published-package')
const PUBLISHED_CLI_TARGET_ROOT = path.join(SMOKE_ROOT, 'published-cli-target')
const CLAUDE_RUNTIME_SKILL_NAME = 'claudemap-runtime'
const CODEX_RUNTIME_SKILL_NAME = 'codexmap-runtime'
const LEGACY_CODEX_RUNTIME_SKILL_NAME = 'claudemap-runtime'
const GRAPH_DIR = path.join(
  FIXTURE_ROOT,
  '.claude',
  'skills',
  CLAUDE_RUNTIME_SKILL_NAME,
  'app',
  'public',
  'graph',
)
const REQUIRED_NPM_FILE_ENTRIES = Object.freeze([
  'bin/',
  'scripts/install-claudemap.js',
  '.npm-bundle/claudemap/',
  '.npm-bundle/claudemap-codex/',
  'skill/package.json',
  'skill/lib/contracts/errors.js',
  'skill/lib/contracts/paths.js',
  'skill/lib/contracts/schemas/cache.js',
  'skill/lib/contracts/schemas/graph.js',
  'skill/lib/contracts/schemas/index.js',
  'skill/lib/contracts/schemas/install-record.js',
  'skill/lib/contracts/schemas/manifest.js',
  'skill/lib/contracts/schemas/runtime-envelope.js',
  'skill/lib/contracts/schemas/shared.js',
])
const PUBLISHED_PACKAGE_SUPPORT_FILES = Object.freeze([
  'package.json',
  'README.md',
  'PUBLISHING.md',
  'scripts/install-claudemap.js',
  'skill/package.json',
  'skill/lib/contracts/errors.js',
  'skill/lib/contracts/paths.js',
  'skill/lib/contracts/schemas/cache.js',
  'skill/lib/contracts/schemas/graph.js',
  'skill/lib/contracts/schemas/index.js',
  'skill/lib/contracts/schemas/install-record.js',
  'skill/lib/contracts/schemas/manifest.js',
  'skill/lib/contracts/schemas/runtime-envelope.js',
  'skill/lib/contracts/schemas/shared.js',
])

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

function copyFileFromRepo(relativePath, targetRoot) {
  const sourcePath = path.join(REPO_ROOT, relativePath)
  const targetPath = path.join(targetRoot, relativePath)

  assert(fs.existsSync(sourcePath), `Source file missing: ${sourcePath}`)
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.copyFileSync(sourcePath, targetPath)
}

function copyDirectory(sourcePath, targetPath) {
  assert(fs.existsSync(sourcePath), `Source directory missing: ${sourcePath}`)
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.cpSync(sourcePath, targetPath, { recursive: true })
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
  const priorExitCode = process.exitCode

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
    .finally(() => {
      process.exitCode = priorExitCode
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

async function assertRenderedSlashTemplates() {
  const { renderSlashTemplate } = await import('../skill/lib/command-harness/render-slash-template.js')
  const [
    setup,
    update,
    open,
    create,
    show,
    slashOnly,
  ] = await Promise.all([
    import('../skill/commands/setup-claudemap.js'),
    import('../skill/commands/refresh.js'),
    import('../skill/commands/open-claudemap.js'),
    import('../skill/commands/create-map.js'),
    import('../skill/commands/show.js'),
    import('../skill/lib/command-harness/slash-only-descriptors.js'),
  ])

  const cases = [
    setup.SETUP_CLAUDEMAP_COMMAND,
    update.UPDATE_COMMAND,
    open.OPEN_CLAUDEMAP_COMMAND,
    create.CREATE_MAP_COMMAND,
    show.SHOW_COMMAND,
    slashOnly.EXPLAIN_SLASH_COMMAND,
  ]

  for (const descriptor of cases) {
    const rendered = renderSlashTemplate(descriptor)
    assert(
      rendered.includes(`description: ${descriptor.summary}`),
      `Rendered template for ${descriptor.name} is missing its summary in front matter.`,
    )

    const flatFlags = descriptor.actions
      ? descriptor.actions.flatMap((a) => a.flags || [])
      : descriptor.flags || []
    for (const flag of flatFlags) {
      assert(
        rendered.includes(`--${flag.name}`),
        `Rendered template for ${descriptor.name} is missing flag --${flag.name}.`,
      )
    }
  }

  const setupRendered = renderSlashTemplate(setup.SETUP_CLAUDEMAP_COMMAND)
  const createRendered = renderSlashTemplate(create.CREATE_MAP_COMMAND)
  assert(
    setupRendered.includes('Does this map look right, or should I refine it?'),
    'Rendered setup-claudemap template is missing the post-render feedback prompt.',
  )
  assert(
    createRendered.includes('Does this map look right, or should I refine it?'),
    'Rendered create-map template is missing the post-render feedback prompt.',
  )
}

function countMcpChildProcesses() {
  const ourPid = process.pid

  if (process.platform === 'win32') {
    try {
      const out = execSync(
        `wmic process where (ParentProcessId=${ourPid}) get Name,ProcessId /format:csv`,
        { stdio: ['ignore', 'pipe', 'ignore'] },
      ).toString()
      return out.split('\n').filter((line) => /node\.exe/i.test(line)).length
    } catch {
      return 0
    }
  }

  try {
    const out = execSync(`ps --ppid ${ourPid} -o comm=`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString()
    return out.split('\n').filter((line) => /node/i.test(line)).length
  } catch {
    return 0
  }
}

async function assertNoLeakedMcpChildren(setupMain, createMapMain, scopedPayload) {
  const before = countMcpChildProcesses()

  await setupMain([FIXTURE_ROOT, '--no-start-app'])
  await createMapMain([FIXTURE_ROOT, '--scope-json', scopedPayload])

  // Allow a brief tick for any in-flight child exits to settle.
  await new Promise((resolve) => setTimeout(resolve, 250))

  const after = countMcpChildProcesses()
  assert(
    after <= before,
    `MCP child processes leaked: before=${before}, after=${after}. withMcp() must close every client on every exit path.`,
  )
}

// Walks createAppExclusionRules and asserts every rule fires at least
// once against a sample input. This pins the declarative rule shape so a
// rule cannot be added without an accompanying example that exercises it.
async function assertAppExclusionRules() {
  const paths = await loadPathContracts()
  const rules = createAppExclusionRules(paths)

  const samples = [
    { name: 'node_modules', candidate: 'node_modules/foo' },
    { name: 'dist', candidate: 'dist/assets/x.js' },
    { name: 'maps-manifest', candidate: `public/${paths.MAPS_MANIFEST_FILENAME}` },
    { name: 'legacy-runtime-graphs', candidate: `public/${paths.RUNTIME_GRAPH_FILENAME}` },
    { name: 'graph-directory', candidate: `public/${paths.GRAPH_DIR_NAME}/x.json` },
    { name: 'unit-test-files', candidate: 'src/lib/foo.test.js' },
  ]

  for (const rule of rules) {
    const sample = samples.find((entry) => entry.name === rule.name)
    assert(sample, `No exclusion-rule sample defined for: ${rule.name}`)
    assert(
      rule.matches(sample.candidate),
      `Exclusion rule ${rule.name} failed to match its own sample: ${sample.candidate}`,
    )
  }

  // Paths that should NOT be excluded - one representative for each rule's
  // near-miss. Exclusion rules were historically an or-chained boolean and
  // a bug in any one arm silently over-excluded adjacent paths. These
  // negative assertions pin the boundary.
  const nonExcluded = [
    'src/App.jsx',
    'public/favicon.svg',
    'public/assets/logo.png',
  ]

  for (const candidate of nonExcluded) {
    for (const rule of rules) {
      assert(
        !rule.matches(candidate),
        `Exclusion rule ${rule.name} wrongly matched: ${candidate}`,
      )
    }
  }
}

// Lightweight shape validation for the packaged runtime graph + state +
// manifest. Formal schemas land in Phase 6; until then, assert the top-
// level keys every consumer assumes exist. A missing key here means the
// packager wrote a shape callers cannot read.
function assertPackagedGraphShapes(artifactRoot, paths) {
  const skillRoot = path.join(artifactRoot, paths.SKILL_ROOT_REL)
  const packagedGraphPath = path.join(skillRoot, 'app', 'public', paths.RUNTIME_GRAPH_REL)
  const packagedStatePath = path.join(skillRoot, 'app', 'public', paths.RUNTIME_STATE_REL)
  const packagedManifestPath = path.join(skillRoot, 'app', 'public', paths.MAPS_MANIFEST_FILENAME)

  const graph = readJson(packagedGraphPath)
  for (const key of ['meta', 'nodes', 'edges', 'files']) {
    assert(
      Object.prototype.hasOwnProperty.call(graph, key),
      `Packaged runtime graph missing top-level key: ${key}`,
    )
  }
  assert(graph.meta && typeof graph.meta === 'object', 'Packaged runtime graph meta is not an object')
  assert(typeof graph.meta.source === 'string', 'Packaged runtime graph meta.source must be a string')

  const state = readJson(packagedStatePath)
  for (const key of ['graphRevision', 'updatedAt', 'graphMeta', 'runtime']) {
    assert(
      Object.prototype.hasOwnProperty.call(state, key),
      `Packaged runtime state missing top-level key: ${key}`,
    )
  }
  assert(state.runtime && typeof state.runtime === 'object', 'Packaged runtime state runtime is not an object')
  assert(
    state.runtime.presentation && typeof state.runtime.presentation === 'object',
    'Packaged runtime state runtime.presentation is not an object',
  )

  const manifest = readJson(packagedManifestPath)
  for (const key of ['version', 'activeMapId', 'maps']) {
    assert(
      Object.prototype.hasOwnProperty.call(manifest, key),
      `Packaged maps manifest missing top-level key: ${key}`,
    )
  }
  assert(Array.isArray(manifest.maps) && manifest.maps.length > 0, 'Packaged maps manifest has no map entries')
}

function assertNoPackagedDevelopmentArtifacts(artifactRoot, paths) {
  const skillRoot = path.join(artifactRoot, paths.SKILL_ROOT_REL)
  const forbiddenPaths = [
    path.join(skillRoot, 'skill', 'node_modules'),
    path.join(skillRoot, 'skill', 'tmp'),
  ]

  for (const forbiddenPath of forbiddenPaths) {
    assert(
      !fs.existsSync(forbiddenPath),
      `Packaged skill leaked development artifact: ${path.relative(artifactRoot, forbiddenPath)}`,
    )
  }
}

// The artifact manifest's managedPaths list is derived from command
// descriptors. Assert each slash-command .md file actually landed at the
// path the artifact manifest claims, and that the install record path,
// agents file, and skill root are all present.
function assertArtifactManifestManagedPaths(artifactRoot, paths) {
  const artifactManifest = readJson(path.join(artifactRoot, paths.ARTIFACT_MANIFEST_FILENAME))
  const managed = artifactManifest.managedPaths || []

  assert(managed.includes(paths.SKILL_ROOT_REL), 'managedPaths missing skill root')
  assert(
    managed.includes(`${paths.AGENTS_ROOT_REL}/${paths.ARCHITECT_AGENT_FILENAME}`),
    'managedPaths missing architect agent',
  )
  assert(
    managed.includes(`${paths.CLAUDE_ROOT_DIR}/${paths.INSTALL_RECORD_FILENAME}`),
    'managedPaths missing install record path',
  )

  const slashMd = managed.filter((p) => p.startsWith(`${paths.COMMANDS_ROOT_REL}/`))
  assert(slashMd.length > 0, 'managedPaths has no slash-command entries')

  for (const relativePath of slashMd) {
    const absolutePath = path.join(artifactRoot, relativePath)
    assert(
      fs.existsSync(absolutePath),
      `managedPaths lists ${relativePath} but the artifact does not contain it`,
    )
  }
}

// Assert that a pre-existing partial-install marker blocks a fresh
// install and that --force-partial lets it proceed. This pins the
// transactional install contract.
async function assertTransactionalInstall(artifactRoot) {
  const paths = await loadPathContracts()
  const markerPath = path.join(
    FIXTURE_ROOT,
    paths.CLAUDE_ROOT_DIR,
    paths.PARTIAL_INSTALL_MARKER_FILENAME,
  )

  // Drop a marker into the already-installed fixture, then confirm that
  // a fresh installClaudeMap call refuses to run.
  fs.mkdirSync(path.dirname(markerPath), { recursive: true })
  fs.writeFileSync(
    markerPath,
    `${JSON.stringify({ startedAt: 'sentinel', mode: 'install', artifactRoot }, null, 2)}\n`,
  )

  let refusedError = null
  try {
    await installClaudeMap({
      artifactRoot,
      buildArtifact: false,
      dryRun: false,
      installDependencies: false,
      mode: 'install',
      targetRoot: FIXTURE_ROOT,
    })
  } catch (error) {
    refusedError = error
  }

  assert(refusedError, 'installClaudeMap should refuse when a partial-install marker is present.')
  assert(
    /partial-install marker/.test(refusedError.message),
    `Refusal error message should mention the partial-install marker. Got: ${refusedError.message}`,
  )
  assert(fs.existsSync(markerPath), 'Marker should still exist after a refused install.')

  // --force-partial should bypass the guard and the successful install
  // should remove the marker on exit.
  await installClaudeMap({
    artifactRoot,
    buildArtifact: false,
    dryRun: false,
    forcePartial: true,
    installDependencies: false,
    mode: 'install',
    targetRoot: FIXTURE_ROOT,
  })

  assert(
    !fs.existsSync(markerPath),
    'Marker should be removed after a successful --force-partial install.',
  )
}

function assertNpmFilesWhitelist() {
  const packageJson = readJson(path.join(REPO_ROOT, 'package.json'))
  const npmFiles = packageJson.files || []

  for (const entry of REQUIRED_NPM_FILE_ENTRIES) {
    assert(
      npmFiles.includes(entry),
      `package.json files whitelist is missing required published CLI dependency: ${entry}`,
    )
  }
}

function stagePublishedPackageFixture({ claudeArtifactRoot, codexArtifactRoot = null }) {
  assertNpmFilesWhitelist()
  removeAndRecreate(PUBLISHED_PACKAGE_ROOT)

  for (const relativePath of PUBLISHED_PACKAGE_SUPPORT_FILES) {
    copyFileFromRepo(relativePath, PUBLISHED_PACKAGE_ROOT)
  }

  copyDirectory(path.join(REPO_ROOT, 'bin'), path.join(PUBLISHED_PACKAGE_ROOT, 'bin'))
  copyDirectory(
    claudeArtifactRoot,
    path.join(PUBLISHED_PACKAGE_ROOT, '.npm-bundle', 'claudemap'),
  )

  if (codexArtifactRoot) {
    copyDirectory(
      codexArtifactRoot,
      path.join(PUBLISHED_PACKAGE_ROOT, '.npm-bundle', 'claudemap-codex'),
    )
  }
}

// Exercise bin/claudemap.js from a package-shaped fixture with no root
// source tree around it. This catches missing npm files whitelist entries
// that a source-tree CLI invocation would mask.
function assertPublishedBinCliDryRun({ claudeArtifactRoot, codexArtifactRoot = null, assistant = 'claude' }) {
  stagePublishedPackageFixture({ claudeArtifactRoot, codexArtifactRoot })

  const cliPath = path.join(PUBLISHED_PACKAGE_ROOT, 'bin', 'claudemap.js')
  assert(fs.existsSync(cliPath), `CLI entry missing: ${cliPath}`)

  removeAndRecreate(PUBLISHED_CLI_TARGET_ROOT)
  writeJson(path.join(PUBLISHED_CLI_TARGET_ROOT, 'package.json'), {
    name: `claudemap-published-cli-${assistant}`,
    private: true,
  })

  const result = require('child_process').spawnSync(
    process.execPath,
    [
      cliPath,
      'install',
      PUBLISHED_CLI_TARGET_ROOT,
      '--dry-run',
      '--skip-install',
      '--assistant',
      assistant,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )

  assert(
    result.status === 0,
    `published bin/claudemap.js dry-run failed for ${assistant} (exit ${result.status}): ${
      result.stderr?.toString() || ''
    }`,
  )
  const stdout = result.stdout?.toString() || ''
  assert(
    stdout.includes('Dry run only'),
    `published bin/claudemap.js dry-run did not print the dry-run marker. stdout:\n${stdout}`,
  )
}

// Round-trip: every shape we ship inside the packaged artifact passes
// its own validator. Malformed ship payloads are a failing PR.
async function assertPackagedShapesValidate(artifactRoot, paths) {
  const schemas = await loadSchemas()
  const skillRoot = path.join(artifactRoot, paths.SKILL_ROOT_REL)

  const graph = readJson(path.join(skillRoot, 'app', 'public', paths.RUNTIME_GRAPH_REL))
  const graphResult = schemas.validate(schemas.SCHEMA_NAMES.GRAPH, graph)
  assert(
    graphResult.ok,
    `Packaged graph failed schema: ${JSON.stringify(graphResult.errors.slice(0, 3))}`,
  )

  const state = readJson(path.join(skillRoot, 'app', 'public', paths.RUNTIME_STATE_REL))
  const stateResult = schemas.validate(schemas.SCHEMA_NAMES.RUNTIME_ENVELOPE, state)
  assert(
    stateResult.ok,
    `Packaged runtime state failed schema: ${JSON.stringify(stateResult.errors.slice(0, 3))}`,
  )

  const manifest = readJson(path.join(skillRoot, 'app', 'public', paths.MAPS_MANIFEST_FILENAME))
  const manifestResult = schemas.validate(schemas.SCHEMA_NAMES.MANIFEST, manifest)
  assert(
    manifestResult.ok,
    `Packaged manifest failed schema: ${JSON.stringify(manifestResult.errors.slice(0, 3))}`,
  )
}

// Drift detection: a deliberately malformed payload produces a
// structured warning via the errors contract. This pins the
// warn+best-effort contract end-to-end.
async function assertSchemaDriftDetection() {
  const schemas = await loadSchemas()
  const errors = await loadErrors()

  const collectedWarnings = []
  errors.setWarningSink((warn) => collectedWarnings.push(warn))

  try {
    // Missing required `nodes`; graph validator must reject.
    schemas.validateWithWarning(
      schemas.SCHEMA_NAMES.GRAPH,
      { meta: {}, edges: [] },
      { filePath: '(drift-fixture)' },
    )

    assert(
      collectedWarnings.length === 1,
      `Expected one schema-validation warning, got ${collectedWarnings.length}`,
    )

    const [warn] = collectedWarnings
    assert(
      warn.code === errors.ERROR_CODES.SCHEMA_VALIDATION_FAILED,
      `Expected SCHEMA_VALIDATION_FAILED code, got ${warn.code}`,
    )
    assert(
      warn.context && warn.context.schema === schemas.SCHEMA_NAMES.GRAPH,
      'Drift warning missing schema context',
    )
    assert(
      Array.isArray(warn.context.errors) && warn.context.errors.length > 0,
      'Drift warning missing per-field errors',
    )

    // A well-formed value must not fire a warning.
    collectedWarnings.length = 0
    schemas.validateWithWarning(
      schemas.SCHEMA_NAMES.GRAPH,
      { meta: {}, nodes: [], edges: [] },
      { filePath: '(happy-path)' },
    )
    assert(
      collectedWarnings.length === 0,
      `Expected no warnings on valid payload, got ${collectedWarnings.length}`,
    )
  } finally {
    errors.setWarningSink(null)
  }
}

// Build a Codex-specific artifact and assert its layout.
async function buildCodexArtifact() {
  removeAndRecreate(CODEX_ARTIFACT_OUTPUT_ROOT)
  const result = await buildClaudeMapArtifact({
    outputRoot: CODEX_ARTIFACT_OUTPUT_ROOT,
    zip: false,
    assistant: 'codex',
  })

  assert(result.assistant === 'codex', `Expected assistant=codex, got ${result.assistant}`)
  assert(
    fs.existsSync(result.artifactRoot),
    `Codex artifact not found: ${result.artifactRoot}`,
  )
  return result.artifactRoot
}

// Verify the on-disk layout of a Codex artifact. Codex uses two top-
// level dirs (.codex/ and .agents/), a .toml agent file, an embedded-
// commands SKILL.md, and a self-location config in the skill root.
function assertCodexArtifact(artifactRoot) {
  const codexRoot = path.join(artifactRoot, '.codex')
  const agentsRoot = path.join(artifactRoot, '.agents')
  const skillRoot = path.join(agentsRoot, 'skills', CODEX_RUNTIME_SKILL_NAME)
  const legacySkillRoot = path.join(agentsRoot, 'skills', LEGACY_CODEX_RUNTIME_SKILL_NAME)

  assert(fs.existsSync(codexRoot), `Codex artifact missing .codex/: ${codexRoot}`)
  assert(fs.existsSync(agentsRoot), `Codex artifact missing .agents/: ${agentsRoot}`)
  assert(fs.existsSync(skillRoot), `Codex artifact missing skill root: ${skillRoot}`)
  assert(!fs.existsSync(legacySkillRoot), `Codex artifact should not ship legacy skill root: ${legacySkillRoot}`)

  const agentFile = path.join(codexRoot, 'agents', 'claudemap-architect.toml')
  assert(fs.existsSync(agentFile), `Codex artifact missing .toml agent: ${agentFile}`)

  const agentContent = fs.readFileSync(agentFile, 'utf8')
  assert(
    /name\s*=\s*"claudemap-architect"/.test(agentContent),
    'Codex agent .toml missing name field',
  )
  assert(
    /developer_instructions\s*=\s*"""/.test(agentContent),
    'Codex agent .toml missing developer_instructions block',
  )

  const skillMd = path.join(skillRoot, 'SKILL.md')
  assert(fs.existsSync(skillMd), `Codex SKILL.md missing: ${skillMd}`)
  const skillContent = fs.readFileSync(skillMd, 'utf8')
  assert(
    skillContent.includes('Available Commands'),
    'Codex SKILL.md is missing embedded Available Commands section',
  )
  assert(
    skillContent.includes('Subagent Invocation (Codex)'),
    'Codex SKILL.md is missing Subagent Invocation section',
  )
  assert(
    skillContent.includes('Codex Workflow'),
    'Codex SKILL.md is missing the Codex Workflow section',
  )
  assert(
    !skillContent.includes('.claude/commands'),
    'Codex SKILL.md should not reference .claude/commands',
  )
  assert(
    !skillContent.includes('Codex does not use slash commands'),
    'Codex SKILL.md should not claim Codex has no slash commands',
  )
  assert(
    /^name:\s*codexmap-runtime\s*$/m.test(skillContent),
    'Codex SKILL.md should use the codexmap-runtime skill name',
  )
  assert(
    skillContent.includes('/skills') && skillContent.includes('$codexmap-runtime'),
    'Codex SKILL.md should explain explicit skill invocation via /skills or $codexmap-runtime',
  )
  assert(
    !skillContent.includes('$claudemap-runtime'),
    'Codex SKILL.md should not mention the legacy $claudemap-runtime skill invocation',
  )
  assert(
    skillContent.includes('### refresh'),
    'Codex SKILL.md should expose refresh as the user-facing command name',
  )
  assert(
    !skillContent.includes('### update'),
    'Codex SKILL.md should not expose the internal update name',
  )
  assert(
    skillContent.includes('**Actions:**') && skillContent.includes('`show highlight <query'),
    'Codex SKILL.md should document show sub-actions',
  )
  assert(
    !skillContent.includes('command shipped in the embedded'),
    'Codex SKILL.md should collapse Claude slash-command references into direct embedded-doc guidance',
  )
  assert(
    skillContent.includes('codex-scoped'),
    'Codex SKILL.md should rebrand claude-scoped prose to codex-scoped',
  )
  assert(
    !skillContent.includes('claude-scoped'),
    'Codex SKILL.md should not leave claude-scoped prose behind',
  )

  const navigationDoc = path.join(skillRoot, 'NAVIGATION.md')
  assert(fs.existsSync(navigationDoc), `Codex NAVIGATION.md missing: ${navigationDoc}`)
  const navigationContent = fs.readFileSync(navigationDoc, 'utf8')
  assert(
    navigationContent.includes('CodexMap Navigation'),
    'Codex NAVIGATION.md should be rebranded to CodexMap',
  )
  assert(
    navigationContent.includes('/skills') && navigationContent.includes('$codexmap-runtime'),
    'Codex NAVIGATION.md should explain explicit skill invocation',
  )

  const selfLocationConfig = path.join(skillRoot, '.claudemap-config.json')
  assert(fs.existsSync(selfLocationConfig), `Codex self-location config missing: ${selfLocationConfig}`)
  const selfLocation = readJson(selfLocationConfig)
  assert(
    selfLocation.skillRootRel === '.agents/skills/codexmap-runtime',
    `Codex self-location has wrong skillRootRel: ${selfLocation.skillRootRel}`,
  )
  assert(selfLocation.assistant === 'codex', 'Codex self-location missing assistant=codex')

  // No repo-defined slash-command directory.
  const commandsDir = path.join(codexRoot, 'commands')
  assert(
    !fs.existsSync(commandsDir),
    `Codex artifact should not contain .codex/commands/: ${commandsDir}`,
  )

  // Manifest content.
  const manifest = readJson(path.join(artifactRoot, 'claudemap-artifact.json'))
  assert(manifest.assistant === 'codex', 'Codex manifest missing assistant=codex')
  assert(
    Array.isArray(manifest.installRoots) &&
      manifest.installRoots.includes('.agents') &&
      manifest.installRoots.includes('.codex'),
    'Codex manifest installRoots missing .agents or .codex',
  )
  assert(
    manifest.managedPaths.includes('.codex/agents/claudemap-architect.toml'),
    'Codex manifest managedPaths missing architect agent',
  )
  assert(
    manifest.managedPaths.includes('.codex/claudemap-install.json'),
    'Codex manifest managedPaths missing install record',
  )
  assert(
    manifest.managedPaths.includes('.agents/skills/codexmap-runtime'),
    'Codex manifest managedPaths missing skill root',
  )
  assert(
    !manifest.managedPaths.includes('.agents/skills/claudemap-runtime'),
    'Codex manifest should not include the legacy skill root',
  )
  assert(
    !manifest.managedPaths.some((p) => p.startsWith('.claude/')),
    'Codex manifest managedPaths should not contain .claude/ paths',
  )

  // Branding: packaged index.html must carry the codexmap brand so the
  // right CSS override wins before first paint; title + favicon must
  // match the CodexMap descriptor.
  const indexHtmlPath = path.join(skillRoot, 'app', 'index.html')
  assert(fs.existsSync(indexHtmlPath), `Codex artifact missing index.html: ${indexHtmlPath}`)
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8')
  assert(
    /<html\b[^>]*\sdata-brand="codexmap"/i.test(indexHtml),
    'Codex index.html missing data-brand="codexmap" on <html>',
  )
  assert(
    /<title>CodexMap<\/title>/.test(indexHtml),
    'Codex index.html missing <title>CodexMap</title>',
  )
  assert(
    /href="\/favicon-codex\.svg"/.test(indexHtml),
    'Codex index.html missing /favicon-codex.svg favicon link',
  )

  // Brand-prose rebrand: the human-readable display name and assistant-visible
  // skill identity in the Codex SKILL.md should be CodexMap/codexmap-runtime.
  assert(
    /\bCodexMap\b/.test(skillContent),
    'Codex SKILL.md missing CodexMap prose rebrand',
  )
  assert(
    /codexmap-runtime/.test(skillContent),
    'Codex SKILL.md missing Codex runtime skill identity',
  )

  const graphSourcesPath = path.join(skillRoot, 'skill', 'lib', 'contracts', 'graph-sources.js')
  assert(fs.existsSync(graphSourcesPath), `Codex artifact missing graph-sources contract: ${graphSourcesPath}`)
  const graphSourcesContent = fs.readFileSync(graphSourcesPath, 'utf8')
  assert(
    /CLAUDE:\s*'codex'/.test(graphSourcesContent),
    'Codex graph-sources contract should serialize GRAPH_SOURCES.CLAUDE as codex',
  )
  assert(
    /CLAUDE_SCOPED:\s*'codex-scoped'/.test(graphSourcesContent),
    'Codex graph-sources contract should serialize GRAPH_SOURCES.CLAUDE_SCOPED as codex-scoped',
  )

  const appGraphSourcesPath = path.join(skillRoot, 'app', 'src', 'contracts', 'graph-sources.js')
  assert(fs.existsSync(appGraphSourcesPath), `Codex artifact missing app graph-sources contract: ${appGraphSourcesPath}`)
  const appGraphSourcesContent = fs.readFileSync(appGraphSourcesPath, 'utf8')
  assert(
    /CLAUDE:\s*'codex'/.test(appGraphSourcesContent),
    'Codex app graph-sources contract should serialize GRAPH_SOURCES.CLAUDE as codex',
  )
  assert(
    /CLAUDE_SCOPED:\s*'codex-scoped'/.test(appGraphSourcesContent),
    'Codex app graph-sources contract should serialize GRAPH_SOURCES.CLAUDE_SCOPED as codex-scoped',
  )
}

// Verify branding was NOT applied to the default (Claude) artifact.
// The Claude bundle keeps the default :root CSS block, no data-brand
// attribute, and the ClaudeMap display name.
function assertClaudeArtifactBranding(artifactRoot) {
  const indexHtmlPath = path.join(
    artifactRoot,
    '.claude',
    'skills',
    CLAUDE_RUNTIME_SKILL_NAME,
    'app',
    'index.html',
  )
  assert(fs.existsSync(indexHtmlPath), `Claude artifact missing index.html: ${indexHtmlPath}`)
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8')
  assert(
    !/data-brand=/i.test(indexHtml),
    'Claude index.html should not carry data-brand (default brand is implicit)',
  )
  assert(
    /<title>ClaudeMap<\/title>/.test(indexHtml),
    'Claude index.html missing <title>ClaudeMap</title>',
  )
  assert(
    /href="\/favicon\.svg"/.test(indexHtml),
    'Claude index.html missing /favicon.svg favicon link',
  )
}

// Build and assert a dual artifact (--assistant all). This produces
// two separate per-assistant artifact directories side by side.
async function assertDualArtifact() {
  removeAndRecreate(DUAL_ARTIFACT_OUTPUT_ROOT)
  const result = await buildClaudeMapArtifact({
    outputRoot: DUAL_ARTIFACT_OUTPUT_ROOT,
    zip: false,
    assistant: 'all',
  })

  assert(result.assistant === 'all', `Expected assistant=all, got ${result.assistant}`)
  assert(result.artifacts && result.artifacts.claude && result.artifacts.codex, 'Dual result missing per-assistant artifacts')
  assert(
    fs.existsSync(result.artifacts.claude.artifactRoot),
    `Dual Claude artifact missing: ${result.artifacts.claude.artifactRoot}`,
  )
  assert(
    fs.existsSync(result.artifacts.codex.artifactRoot),
    `Dual Codex artifact missing: ${result.artifacts.codex.artifactRoot}`,
  )
  assert(
    path.basename(result.artifacts.claude.artifactRoot) === 'claudemap',
    'Dual Claude artifact should use claudemap/ dir name',
  )
  assert(
    path.basename(result.artifacts.codex.artifactRoot) === 'claudemap-codex',
    'Dual Codex artifact should use claudemap-codex/ dir name',
  )

  // Each artifact's manifest should record its own assistant.
  const claudeManifest = readJson(
    path.join(result.artifacts.claude.artifactRoot, 'claudemap-artifact.json'),
  )
  const codexManifest = readJson(
    path.join(result.artifacts.codex.artifactRoot, 'claudemap-artifact.json'),
  )
  assert(claudeManifest.assistant === 'claude', 'Dual Claude manifest missing assistant=claude')
  assert(codexManifest.assistant === 'codex', 'Dual Codex manifest missing assistant=codex')
}

// Install a Codex artifact into a fresh fixture and verify the target
// layout, install record, and managed-paths contract.
async function assertCodexInstall(codexArtifactRoot) {
  removeAndRecreate(CODEX_FIXTURE_ROOT)
  writeJson(path.join(CODEX_FIXTURE_ROOT, 'package.json'), {
    name: 'claudemap-codex-smoke-fixture',
    private: true,
    type: 'module',
  })
  const preexistingLegacySkill = path.join(
    CODEX_FIXTURE_ROOT,
    '.agents',
    'skills',
    LEGACY_CODEX_RUNTIME_SKILL_NAME,
  )
  writeJson(path.join(preexistingLegacySkill, '.claudemap-config.json'), {
    assistant: 'codex',
    skillRootRel: `.agents/skills/${LEGACY_CODEX_RUNTIME_SKILL_NAME}`,
  })
  writeText(
    path.join(preexistingLegacySkill, 'SKILL.md'),
    [
      '---',
      `name: ${LEGACY_CODEX_RUNTIME_SKILL_NAME}`,
      '---',
      '',
      '## Codex Workflow',
      'claudemap-architect',
      '',
    ].join('\n'),
  )

  const result = await installClaudeMap({
    artifactRoot: codexArtifactRoot,
    buildArtifact: false,
    dryRun: false,
    installDependencies: false,
    mode: 'install',
    targetRoot: CODEX_FIXTURE_ROOT,
    assistant: 'codex',
  })

  assert(result.assistantType === 'codex', `Expected install assistantType=codex, got ${result.assistantType}`)

  const installedSkill = path.join(
    CODEX_FIXTURE_ROOT,
    '.agents',
    'skills',
    CODEX_RUNTIME_SKILL_NAME,
  )
  const legacyInstalledSkill = path.join(
    CODEX_FIXTURE_ROOT,
    '.agents',
    'skills',
    LEGACY_CODEX_RUNTIME_SKILL_NAME,
  )
  const installedAgent = path.join(
    CODEX_FIXTURE_ROOT,
    '.codex',
    'agents',
    'claudemap-architect.toml',
  )
  const installedRecord = path.join(
    CODEX_FIXTURE_ROOT,
    '.codex',
    'claudemap-install.json',
  )

  assert(fs.existsSync(installedSkill), `Codex install missing skill root: ${installedSkill}`)
  assert(!fs.existsSync(legacyInstalledSkill), `Codex install left legacy skill root: ${legacyInstalledSkill}`)
  assert(fs.existsSync(installedAgent), `Codex install missing architect .toml: ${installedAgent}`)
  assert(fs.existsSync(installedRecord), `Codex install missing install record: ${installedRecord}`)

  const record = readJson(installedRecord)
  assert(record.assistant === 'codex', 'Codex install record missing assistant=codex')
  assert(record.version === 2, 'Codex install record should be version 2')
  assert(
    record.managedPaths.includes('.agents/skills/codexmap-runtime'),
    'Codex install record missing codexmap-runtime managed path',
  )
  assert(
    !record.managedPaths.includes('.agents/skills/claudemap-runtime'),
    'Codex install record should not include legacy claudemap-runtime managed path',
  )

  // Should not have created .claude/ anywhere.
  assert(
    !fs.existsSync(path.join(CODEX_FIXTURE_ROOT, '.claude')),
    'Codex install should not create .claude/ in the target',
  )
}

// Claude-installed fixture must get an install record with assistant=claude.
function assertClaudeInstallRecordAssistant() {
  const record = readJson(
    path.join(FIXTURE_ROOT, '.claude', 'claudemap-install.json'),
  )
  assert(record.assistant === 'claude', 'Claude install record must have assistant=claude')
}

// Refuse to install a Codex artifact on top of an existing Claude install
// unless --force-assistant-switch is set.
async function assertCrossAssistantGuard(claudeArtifactRoot, codexArtifactRoot) {
  removeAndRecreate(CROSS_ASSISTANT_FIXTURE_ROOT)
  writeJson(path.join(CROSS_ASSISTANT_FIXTURE_ROOT, 'package.json'), {
    name: 'claudemap-cross-assistant-fixture',
    private: true,
    type: 'module',
  })

  // Install Claude first.
  await installClaudeMap({
    artifactRoot: claudeArtifactRoot,
    buildArtifact: false,
    dryRun: false,
    installDependencies: false,
    mode: 'install',
    targetRoot: CROSS_ASSISTANT_FIXTURE_ROOT,
    assistant: 'claude',
  })

  // Attempt Codex install without force -> must throw.
  let guardError = null
  try {
    await installClaudeMap({
      artifactRoot: codexArtifactRoot,
      buildArtifact: false,
      dryRun: false,
      installDependencies: false,
      mode: 'install',
      targetRoot: CROSS_ASSISTANT_FIXTURE_ROOT,
      assistant: 'codex',
    })
  } catch (error) {
    guardError = error
  }

  assert(guardError, 'Cross-assistant guard should refuse a Codex install over an existing Claude install')
  assert(
    /refusing to install a codex artifact over it/i.test(guardError.message) ||
      /already has a claude install/i.test(guardError.message),
    `Cross-assistant guard error should mention the existing assistant. Got: ${guardError.message}`,
  )

  // With --force-assistant-switch, the install should succeed.
  await installClaudeMap({
    artifactRoot: codexArtifactRoot,
    buildArtifact: false,
    dryRun: false,
    installDependencies: false,
    mode: 'install',
    targetRoot: CROSS_ASSISTANT_FIXTURE_ROOT,
    assistant: 'codex',
    forceAssistantSwitch: true,
  })

  const codexRecord = readJson(
    path.join(CROSS_ASSISTANT_FIXTURE_ROOT, '.codex', 'claudemap-install.json'),
  )
  assert(codexRecord.assistant === 'codex', 'After forced switch, install record should be for codex')
}

async function main() {
  createFixtureRepo()
  await assertAppExclusionRules()
  const artifactRoot = await buildArtifact()
  await installClaudeMap({
    artifactRoot,
    buildArtifact: false,
    dryRun: false,
    installDependencies: false,
    mode: 'install',
    targetRoot: FIXTURE_ROOT,
  })

  const paths = await loadPathContracts()
  assertPackagedGraphShapes(artifactRoot, paths)
  assertNoPackagedDevelopmentArtifacts(artifactRoot, paths)
  await assertPackagedShapesValidate(artifactRoot, paths)
  await assertSchemaDriftDetection()
  assertArtifactManifestManagedPaths(artifactRoot, paths)
  assertInstalledLayout()
  assertPromptTemplates()
  await assertRenderedSlashTemplates()
  assertPublishedBinCliDryRun({ claudeArtifactRoot: artifactRoot, assistant: 'claude' })
  await assertTransactionalInstall(artifactRoot)

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
  await assertNoLeakedMcpChildren(setupMain, createMapMain, scopedPayload)

  assertClaudeInstallRecordAssistant()

  // Codex-specific assertions. Build a Codex artifact, inspect its
  // layout, exercise the installer against a fresh fixture, and verify
  // the cross-assistant guard on a separate fixture.
  assertClaudeArtifactBranding(artifactRoot)

  const codexArtifactRoot = await buildCodexArtifact()
  assertCodexArtifact(codexArtifactRoot)
  assertPublishedBinCliDryRun({ claudeArtifactRoot: artifactRoot, codexArtifactRoot, assistant: 'codex' })
  await assertDualArtifact()
  await assertCodexInstall(codexArtifactRoot)
  await assertCrossAssistantGuard(artifactRoot, codexArtifactRoot)

  console.log(`ClaudeMap package smoke test passed`)
  console.log(`Artifact: ${artifactRoot}`)
  console.log(`Codex artifact: ${codexArtifactRoot}`)
  console.log(`Fixture repo: ${FIXTURE_ROOT}`)
}

main().catch((error) => {
  console.error(`ClaudeMap package smoke test failed: ${error.message}`)
  process.exitCode = 1
})
