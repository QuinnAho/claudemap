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

// Exercise bin/claudemap.js end-to-end against the fixture with --dry-run
// so we verify the published CLI entry delegates correctly to the
// installer without mutating the fixture or needing npm to run.
function assertBinCliDryRun() {
  const cliPath = path.join(REPO_ROOT, 'bin', 'claudemap.js')
  assert(fs.existsSync(cliPath), `CLI entry missing: ${cliPath}`)

  const result = require('child_process').spawnSync(
    process.execPath,
    [cliPath, 'install', FIXTURE_ROOT, '--dry-run', '--skip-install'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )

  assert(
    result.status === 0,
    `bin/claudemap.js dry-run failed (exit ${result.status}): ${result.stderr?.toString() || ''}`,
  )
  const stdout = result.stdout?.toString() || ''
  assert(
    stdout.includes('Dry run only'),
    `bin/claudemap.js dry-run did not print the dry-run marker. stdout:\n${stdout}`,
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
  await assertPackagedShapesValidate(artifactRoot, paths)
  await assertSchemaDriftDetection()
  assertArtifactManifestManagedPaths(artifactRoot, paths)
  assertInstalledLayout()
  assertPromptTemplates()
  await assertRenderedSlashTemplates()
  assertBinCliDryRun()
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

  console.log(`ClaudeMap package smoke test passed`)
  console.log(`Artifact: ${artifactRoot}`)
  console.log(`Fixture repo: ${FIXTURE_ROOT}`)
}

main().catch((error) => {
  console.error(`ClaudeMap package smoke test failed: ${error.message}`)
  process.exitCode = 1
})
