#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '..')
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, 'artifacts', 'claudemap-skill')
const ARTIFACT_NAME = 'claudemap'
const CLAUDE_ROOT = '.claude'
const DEMO_SOURCE_ROOT = path.join(REPO_ROOT, 'demo', 'expressjs-express')
const DEMO_SOURCE_CLAUDE_ROOT = path.join(DEMO_SOURCE_ROOT, CLAUDE_ROOT)
const SKILL_ROOT = path.join(CLAUDE_ROOT, 'skills', 'claudemap-runtime')
const COMMANDS_ROOT = path.join(CLAUDE_ROOT, 'commands')
const AGENTS_ROOT = path.join(CLAUDE_ROOT, 'agents')
const DEMO_PACKAGES_ROOT = path.join('demo-packages')
const DEFAULT_RUNTIME_GRAPH_PATH = path.join(REPO_ROOT, 'contracts', 'claudemap.sample.json')
const FIRST_DEMO_GRAPH_PATH = path.join(REPO_ROOT, 'contracts', 'claudemap-first-demo.json')
const GENERATED_DEMO_NAMES = new Set(['FirstDemo', 'SecondDemo'])
const FIRST_DEMO_SUPPORT_FILES = [
  'README.md',
  'CLAUDE.md',
  'AGENTS.md',
  'package.json',
  'package-lock.json',
  'app/package.json',
  'skill/package.json',
]

const DEMO_DEFINITIONS = [
  {
    name: 'FirstDemo',
    graphSourcePath: FIRST_DEMO_GRAPH_PATH,
    graphContract: 'contracts/claudemap-first-demo.json',
    description: 'Curated walkthrough of the ClaudeMap codebase with nested systems, core files, and important functions.',
    stageProject: stageFirstDemoProject,
  },
  {
    name: 'SecondDemo',
    graphSourcePath: DEFAULT_RUNTIME_GRAPH_PATH,
    graphContract: 'contracts/claudemap.sample.json',
    description: 'Packaged Express-shaped sandbox seeded with the current sample graph.',
    sourceProject: 'demo/expressjs-express',
    stageProject: stageSecondDemoProject,
  },
]

function printUsage() {
  console.log('ClaudeMap skill packager')
  console.log('  node scripts/package-claudemap-skill.js [--output <dir>] [--zip]')
}

function parseArgs(argv) {
  const options = {
    outputRoot: DEFAULT_OUTPUT_ROOT,
    zip: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--help' || argument === '-h') {
      options.help = true
      continue
    }

    if (argument === '--zip') {
      options.zip = true
      continue
    }

    if (argument === '--output') {
      const nextValue = argv[index + 1]

      if (!nextValue) {
        throw new Error('Missing value for --output')
      }

      options.outputRoot = path.resolve(nextValue)
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  return options
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/')
}

function copyFile(relativeSourcePath, artifactRoot, relativeTargetPath = relativeSourcePath) {
  const sourcePath = path.join(REPO_ROOT, relativeSourcePath)
  const targetPath = path.join(artifactRoot, relativeTargetPath)

  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.copyFileSync(sourcePath, targetPath)
}

function copyOptionalFile(relativeSourcePath, artifactRoot, relativeTargetPath = relativeSourcePath) {
  const sourcePath = path.join(REPO_ROOT, relativeSourcePath)

  if (!fs.existsSync(sourcePath)) {
    return false
  }

  copyFile(relativeSourcePath, artifactRoot, relativeTargetPath)
  return true
}

function copyDirectory(relativeSourcePath, artifactRoot, shouldExclude = () => false) {
  const sourcePath = path.join(REPO_ROOT, relativeSourcePath)
  const targetPath = path.join(artifactRoot, relativeSourcePath)

  fs.cpSync(sourcePath, targetPath, {
    recursive: true,
    filter: (currentSourcePath) => {
      const relativePath = toPosix(path.relative(sourcePath, currentSourcePath))

      if (!relativePath) {
        return true
      }

      return !shouldExclude(relativePath)
    },
  })
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

function createEmptyRuntimeGraph() {
  return {
    meta: {
      repoName: 'claudemap',
      branch: 'current',
      creditLabel: 'ClaudeMap skill',
      generatedAt: null,
      source: 'file-shim',
    },
    nodes: [],
    edges: [],
    files: [],
  }
}

function createEmptyRuntimeState() {
  return {
    graphRevision: 0,
    updatedAt: new Date().toISOString(),
    graphMeta: {
      repoName: 'claudemap',
      generatedAt: null,
      source: 'file-shim',
      nodeCount: 0,
      edgeCount: 0,
      fileCount: 0,
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

function createDefaultRuntimeStateFromGraph(graphData) {
  const normalizedGraph = graphData && Array.isArray(graphData.nodes) && Array.isArray(graphData.edges)
    ? graphData
    : createEmptyRuntimeGraph()

  return {
    graphRevision: 0,
    updatedAt: normalizedGraph.meta?.generatedAt || null,
    graphMeta: {
      repoName: normalizedGraph.meta?.repoName || 'claudemap',
      generatedAt: normalizedGraph.meta?.generatedAt || null,
      source: normalizedGraph.meta?.source || 'sample',
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

function readJsonFileOrFallback(filePath, fallbackFactory) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallbackFactory()
  }
}

function writeRuntimePlaceholders(projectRoot, graphSourcePath = DEFAULT_RUNTIME_GRAPH_PATH) {
  const packagedGraph = readJsonFileOrFallback(
    graphSourcePath,
    createEmptyRuntimeGraph,
  )

  writeJsonFile(
    path.join(projectRoot, SKILL_ROOT, 'app', 'public', 'claudemap-runtime.json'),
    packagedGraph,
  )
  writeJsonFile(
    path.join(projectRoot, SKILL_ROOT, 'app', 'public', 'claudemap-runtime-state.json'),
    createDefaultRuntimeStateFromGraph(packagedGraph),
  )
}

function writeTextFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function createSlashCommandTemplates() {
  return {
    'setup-claudemap.md': `---
description: Set up ClaudeMap for the current project by delegating repo-to-graph synthesis to the bundled claudemap-architect subagent, then rendering the graph UI.
argument-hint: '[project-root]'
---

Run the bundled ClaudeMap setup workflow.

Steps:
1. Treat the current working directory as the target project root unless the user gave a different path.
2. Resolve the bundled snapshot script at \`.claude/skills/claudemap-runtime/skill/commands/snapshot.js\`.
3. Run the snapshot script and capture the repo snapshot JSON.
4. Read \`.claude/skills/claudemap-runtime/skill/prompts/enrichment.txt\`.
5. Use the \`@claudemap-architect\` subagent explicitly and provide:
   - the snapshot JSON
   - the enrichment contract
   - instructions to return only valid graph JSON
6. Save the subagent result to \`.claude/skills/claudemap-runtime/tmp/claudemap-enrichment.json\`.
7. Run \`.claude/skills/claudemap-runtime/skill/commands/setup-claudemap.js\` with \`--enrichment-file\` pointing to that JSON file.
8. Add \`--force-refresh\` only when the user explicitly asks for a full rebuild.
9. If the subagent result is invalid, fall back to running the bundled setup command without the override.
10. Report the analyzed file count, system count, graph source, render transport, and app readiness.
`,
    'refresh.md': `---
description: Refresh the bundled ClaudeMap graph for the current project after local code changes.
argument-hint: '[project-root]'
disable-model-invocation: true
---

Use the bundled ClaudeMap refresh command to update the graph for the current working directory.

Steps:
1. Treat the current working directory as the target project root unless the user gave a different path.
2. Resolve the bundled command script at \`.claude/skills/claudemap-runtime/skill/commands/update.js\`.
3. Run the refresh command with Node for the target project root.
4. Report added, removed, and changed file counts plus the refresh mode.
5. Preserve any cached Claude-authored graph unless the user explicitly asks for a force refresh.
`,
    'open-claudemap.md': `---
description: Open the bundled ClaudeMap app for the current project without rebuilding the graph.
disable-model-invocation: true
---

Use the bundled ClaudeMap open command to bring up the existing map runtime.

Steps:
1. Resolve the bundled command script at \`.claude/skills/claudemap-runtime/skill/commands/open-claudemap.js\`.
2. Run the open command with Node.
3. If a graph is already loaded, report the repo name, graph source, system count, and file count.
4. If no graph is loaded yet, tell the user to run \`/setup-claudemap\` first.
5. Report whether the app server was reused, started, or still unavailable.
`,
    'update.md': `---
description: Compatibility alias for /refresh. Refresh the bundled ClaudeMap graph for the current project after local code changes.
argument-hint: '[project-root]'
disable-model-invocation: true
---

Use the bundled ClaudeMap update command to refresh the graph for the current working directory.

Steps:
1. Treat the current working directory as the target project root unless the user gave a different path.
2. Resolve the bundled command script at \`.claude/skills/claudemap-runtime/skill/commands/update.js\`.
3. Run the update command with Node for the target project root.
4. Report added, removed, and changed file counts plus the refresh mode.
5. Preserve any cached Claude-authored graph unless the user explicitly asks for a force refresh.
`,
    'claudemap-control.md': `---
description: Drive the bundled ClaudeMap UI by highlighting nodes, presenting guided explanation steps, toggling health, focusing nodes, or running guided flows.
argument-hint: '<action>'
disable-model-invocation: true
---

Use the bundled ClaudeMap control command to drive the live map UI.

Steps:
1. Resolve the bundled command script at \`.claude/skills/claudemap-runtime/skill/commands/control.js\`.
2. Convert the user request into the closest supported control command.
3. Run the control command with Node.
4. Report what was highlighted, focused, or toggled.

Built-in actions currently include:
- \`highlight <query> [--zoom <value>] [--explain "..."]\`
- \`clear-highlight\`
- \`present <query> [--title "..."] [--step "..."] [--explain "..."]\`
- \`navigate <query> [--zoom <value>]\`
- \`health <on|off>\`
- \`mode <free|guided|locked-demo>\`
- \`caption [--title <title>] [--step <step>] <body>\`
- \`clear-caption\`
- \`flow <query1> <query2> [query3 ...]\`
- \`ask "<phrase>"\`
`,
    'explain.md': `---
description: Explain a ClaudeMap node, system, or pasted click-context by running a guided walkthrough through the live map.
argument-hint: '[topic-or-click-context]'
---

Use ClaudeMap as a guided presentation tool.

Workflow:
1. If the user provided ClaudeMap click context, extract the label, path, and type from it.
2. If the user provided a plain topic or node name, use that as the walkthrough anchor.
3. If no usable topic is available, ask the user to click a node in ClaudeMap and paste the copied context, or provide a topic directly.
4. Read the current runtime graph from \`.claude/skills/claudemap-runtime/app/public/claudemap-runtime.json\`.
5. For broad or ambiguous requests, use the \`@claudemap-architect\` subagent to turn the request into a short walkthrough plan of 2-6 steps.
6. Start presentation mode by running \`node .claude/skills/claudemap-runtime/skill/commands/control.js mode guided\`.
7. Drive the map in discrete steps. Prefer one present command per explanation beat so the highlight, navigation, and narration update atomically:
   - \`node .claude/skills/claudemap-runtime/skill/commands/control.js present <query> --title "..." --step "Step 1" --explain "..."\`
   - \`node .claude/skills/claudemap-runtime/skill/commands/control.js highlight <query>\`
   - \`node .claude/skills/claudemap-runtime/skill/commands/control.js health on\`
   - \`node .claude/skills/claudemap-runtime/skill/commands/control.js flow <query1> <query2> ...\`
8. Treat each control command as the visual step boundary. Do not rely on plain chat text streaming alone for transitions.
9. When the explanation is complete, always release the map by running:
   - \`node .claude/skills/claudemap-runtime/skill/commands/control.js clear-caption\`
   - \`node .claude/skills/claudemap-runtime/skill/commands/control.js mode free\`
10. Use high-level, intuitive language first. Prefer plain-English descriptions of purpose, flow, and impact before lower-level implementation details.
11. Keep narration concise and synchronized to the step you just triggered.
`,
  }
}

function writeSlashCommands(artifactRoot) {
  const commandTemplates = createSlashCommandTemplates()

  for (const [fileName, content] of Object.entries(commandTemplates)) {
    writeTextFile(path.join(artifactRoot, COMMANDS_ROOT, fileName), content)
  }
}

function writeNavigationDocs(artifactRoot) {
  writeTextFile(
    path.join(artifactRoot, SKILL_ROOT, 'NAVIGATION.md'),
    `# ClaudeMap Navigation

## Public Commands

Use these first:

- \`/setup-claudemap\`: analyze the current project and render a graph
- \`/open-claudemap\`: reopen the existing map UI without rebuilding the graph
- \`/refresh\`: refresh the current graph after code changes
- \`/update\`: compatibility alias for \`/refresh\`
- \`/explain\`: run a guided walkthrough against the live graph
- \`/claudemap-control\`: manually drive highlights, focus, health, and flow

## Internal Runtime Layout

- \`.claude/skills/claudemap-runtime/SKILL.md\`: internal runtime skill definition
- \`.claude/skills/claudemap-runtime/skill/commands/\`: Node command entrypoints
- \`.claude/skills/claudemap-runtime/skill/lib/\`: shared runtime libraries
- \`.claude/skills/claudemap-runtime/skill/prompts/\`: enrichment prompt assets
- \`.claude/skills/claudemap-runtime/app/\`: bundled map app
- \`.claude/skills/claudemap-runtime/demo/\`: demo sandboxes and fallback data
- \`.claude/agents/claudemap-architect.md\`: bundled architecture-mapping subagent

## Fastest Workflow

1. Run \`/setup-claudemap\`
2. Run \`/open-claudemap\` later if you just need the UI back
3. Run \`/refresh\` after edits
4. Run \`/explain\` for guided demos
`,
  )
}

function writeArtifactManifest(artifactRoot, demoPackages) {
  writeJsonFile(path.join(artifactRoot, 'claudemap-artifact.json'), {
    name: ARTIFACT_NAME,
    generatedAt: new Date().toISOString(),
    entrypoints: {
      skill: toPosix(path.join(SKILL_ROOT, 'SKILL.md')),
      'setup-claudemap': toPosix(path.join(SKILL_ROOT, 'skill', 'commands', 'setup-claudemap.js')),
      'open-claudemap': toPosix(path.join(SKILL_ROOT, 'skill', 'commands', 'open-claudemap.js')),
      refresh: toPosix(path.join(SKILL_ROOT, 'skill', 'commands', 'update.js')),
      update: toPosix(path.join(SKILL_ROOT, 'skill', 'commands', 'update.js')),
      'claudemap-control': toPosix(path.join(SKILL_ROOT, 'skill', 'commands', 'control.js')),
    },
    subagents: {
      claudemapArchitect: toPosix(path.join(AGENTS_ROOT, 'claudemap-architect.md')),
    },
    slashCommands: {
      'setup-claudemap': toPosix(path.join(COMMANDS_ROOT, 'setup-claudemap.md')),
      explain: toPosix(path.join(COMMANDS_ROOT, 'explain.md')),
      'open-claudemap': toPosix(path.join(COMMANDS_ROOT, 'open-claudemap.md')),
      refresh: toPosix(path.join(COMMANDS_ROOT, 'refresh.md')),
      update: toPosix(path.join(COMMANDS_ROOT, 'update.md')),
      'claudemap-control': toPosix(path.join(COMMANDS_ROOT, 'claudemap-control.md')),
    },
    publicCommands: [
      'setup-claudemap',
      'open-claudemap',
      'refresh',
      'update',
      'explain',
      'claudemap-control',
    ],
    internalRuntime: {
      skillRoot: toPosix(SKILL_ROOT),
      navigationDoc: toPosix(path.join(SKILL_ROOT, 'NAVIGATION.md')),
      sharedSubagent: toPosix(path.join(AGENTS_ROOT, 'claudemap-architect.md')),
    },
    demoPackages: Object.fromEntries(
      demoPackages.map((demoPackage) => [
        demoPackage.name,
        {
          path: toPosix(path.join(DEMO_PACKAGES_ROOT, demoPackage.name)),
          graphContract: demoPackage.graphContract,
          description: demoPackage.description,
          sourceProject: demoPackage.sourceProject || null,
        },
      ]),
    ),
    notes: [
      'Drop the bundled .claude directory into your target project root.',
      'The public surface is .claude/commands/*.md. The skill bundle under .claude/skills/claudemap-runtime is shared runtime infrastructure for those commands.',
      'The packaged runtime ships with the current seeded app/public graph so /open-claudemap can render immediately after install.',
      'Demo-ready project packages are emitted under demo-packages/FirstDemo and demo-packages/SecondDemo.',
      'Run npm install inside .claude/skills/claudemap-runtime before starting the bundled app on a fresh machine.',
      'Claude Code loads project subagents from .claude/agents at session start. Restart the session or use /agents after installing the artifact if needed.',
      'If ClaudeMap is later packaged as a plugin instead of a project drop-in, subagent files should live in the plugin agents/ directory rather than .claude/agents/.',
    ],
  })
}

function ensureCleanArtifactLocation(outputRoot) {
  const artifactRoot = path.join(outputRoot, ARTIFACT_NAME)

  fs.mkdirSync(outputRoot, { recursive: true })
  fs.rmSync(artifactRoot, { recursive: true, force: true })
  return artifactRoot
}

function shouldExcludeSkill(relativePath) {
  return relativePath === 'SKILL.md'
}

function shouldExcludeApp(relativePath) {
  return (
    relativePath === 'node_modules' ||
    relativePath.startsWith('node_modules/') ||
    relativePath === 'dist' ||
    relativePath.startsWith('dist/') ||
    relativePath === 'public/claudemap-runtime.json' ||
    relativePath === 'public/claudemap-runtime-state.json'
  )
}

function shouldExcludeDemo(relativePath) {
  const segments = relativePath.split('/')

  if (segments.some((segment) => ['.claude', 'node_modules', 'dist', 'build'].includes(segment))) {
    return true
  }

  if (segments.some((segment) => GENERATED_DEMO_NAMES.has(segment))) {
    return true
  }

  return segments[segments.length - 1] === 'claudemap-cache.json'
}

function copyArtifactFiles(artifactRoot) {
  copyFile('skill/SKILL.md', artifactRoot, path.join(SKILL_ROOT, 'SKILL.md'))
  copyFile('package.json', artifactRoot, path.join(SKILL_ROOT, 'package.json'))

  if (fs.existsSync(path.join(REPO_ROOT, 'package-lock.json'))) {
    copyFile('package-lock.json', artifactRoot, path.join(SKILL_ROOT, 'package-lock.json'))
  }

  copyDirectoryInto('skill', artifactRoot, path.join(SKILL_ROOT, 'skill'), shouldExcludeSkill)
  copyDirectoryInto('app', artifactRoot, path.join(SKILL_ROOT, 'app'), shouldExcludeApp)
  copyDirectoryInto('demo', artifactRoot, path.join(SKILL_ROOT, 'demo'), shouldExcludeDemo)
  copyDirectoryInto('contracts', artifactRoot, path.join(SKILL_ROOT, 'contracts'))

  if (fs.existsSync(path.join(REPO_ROOT, 'agents'))) {
    copyDirectoryInto('agents', artifactRoot, AGENTS_ROOT)
  }
}

function copyDirectoryInto(relativeSourcePath, artifactRoot, relativeTargetPath, shouldExclude = () => false) {
  const sourcePath = path.join(REPO_ROOT, relativeSourcePath)
  const targetPath = path.join(artifactRoot, relativeTargetPath)

  fs.cpSync(sourcePath, targetPath, {
    recursive: true,
    filter: (currentSourcePath) => {
      const relativePath = toPosix(path.relative(sourcePath, currentSourcePath))

      if (!relativePath) {
        return true
      }

      return !shouldExclude(relativePath)
    },
  })
}

function copyAbsoluteDirectoryInto(sourcePath, targetPath, shouldExclude = () => false) {
  fs.cpSync(sourcePath, targetPath, {
    recursive: true,
    filter: (currentSourcePath) => {
      const relativePath = toPosix(path.relative(sourcePath, currentSourcePath))

      if (!relativePath) {
        return true
      }

      return !shouldExclude(relativePath)
    },
  })
}

function stageFirstDemoProject(projectRoot) {
  const firstDemoGraph = readJsonFileOrFallback(FIRST_DEMO_GRAPH_PATH, createEmptyRuntimeGraph)
  const mappedPaths = new Set(
    Array.isArray(firstDemoGraph.files)
      ? firstDemoGraph.files
        .map((fileRecord) => fileRecord?.path)
        .filter(Boolean)
      : [],
  )

  for (const relativePath of mappedPaths) {
    copyOptionalFile(relativePath, projectRoot, relativePath)
  }

  for (const relativePath of FIRST_DEMO_SUPPORT_FILES) {
    copyOptionalFile(relativePath, projectRoot, relativePath)
  }
}

function stageSecondDemoProject(projectRoot) {
  copyAbsoluteDirectoryInto(DEMO_SOURCE_ROOT, projectRoot, shouldExcludeDemo)
}

function createDemoPackage(artifactRoot, demoDefinition) {
  const projectRoot = path.join(artifactRoot, DEMO_PACKAGES_ROOT, demoDefinition.name)
  const artifactClaudeRoot = path.join(artifactRoot, CLAUDE_ROOT)
  const projectClaudeRoot = path.join(projectRoot, CLAUDE_ROOT)

  fs.rmSync(projectRoot, { recursive: true, force: true })
  fs.mkdirSync(projectRoot, { recursive: true })

  demoDefinition.stageProject(projectRoot)
  fs.cpSync(artifactClaudeRoot, projectClaudeRoot, { recursive: true })
  writeRuntimePlaceholders(projectRoot, demoDefinition.graphSourcePath)

  return {
    name: demoDefinition.name,
    description: demoDefinition.description,
    graphContract: demoDefinition.graphContract,
    sourceProject: demoDefinition.sourceProject || null,
    projectRoot,
  }
}

function createDemoPackages(artifactRoot) {
  return DEMO_DEFINITIONS.map((demoDefinition) => createDemoPackage(artifactRoot, demoDefinition))
}

function powershellQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function createWindowsZip(artifactRoot, outputRoot) {
  const zipPath = path.join(outputRoot, 'claudemap-skill.zip')
  const wildcardPath = `${artifactRoot}\\*`

  fs.rmSync(zipPath, { force: true })

  const command = `Compress-Archive -Path ${powershellQuote(wildcardPath)} -DestinationPath ${powershellQuote(zipPath)} -Force`
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    cwd: outputRoot,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    throw new Error('Failed to create claudemap-skill.zip')
  }

  return zipPath
}

function maybeCreateZip(artifactRoot, outputRoot, zipRequested) {
  if (!zipRequested) {
    return null
  }

  if (process.platform !== 'win32') {
    console.warn('Skipping zip creation: --zip is currently implemented for Windows only.')
    return null
  }

  return createWindowsZip(artifactRoot, outputRoot)
}

function syncSecondDemoIntoSourceSandbox(demoPackages) {
  if (!fs.existsSync(DEMO_SOURCE_ROOT)) {
    return null
  }

  const secondDemoPackage = demoPackages.find((demoPackage) => demoPackage.name === 'SecondDemo')

  if (!secondDemoPackage) {
    return null
  }

  const packagedClaudeRoot = path.join(secondDemoPackage.projectRoot, CLAUDE_ROOT)

  if (!fs.existsSync(packagedClaudeRoot)) {
    throw new Error(`Expected packaged ${CLAUDE_ROOT} directory at ${packagedClaudeRoot}`)
  }

  fs.rmSync(DEMO_SOURCE_CLAUDE_ROOT, { recursive: true, force: true })
  fs.cpSync(packagedClaudeRoot, DEMO_SOURCE_CLAUDE_ROOT, { recursive: true })

  return DEMO_SOURCE_CLAUDE_ROOT
}

function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  const artifactRoot = ensureCleanArtifactLocation(options.outputRoot)
  copyArtifactFiles(artifactRoot)
  writeRuntimePlaceholders(artifactRoot, DEFAULT_RUNTIME_GRAPH_PATH)
  writeSlashCommands(artifactRoot)
  writeNavigationDocs(artifactRoot)
  const demoPackages = createDemoPackages(artifactRoot)
  writeArtifactManifest(artifactRoot, demoPackages)

  const zipPath = maybeCreateZip(artifactRoot, options.outputRoot, options.zip)
  const demoSyncPath = syncSecondDemoIntoSourceSandbox(demoPackages)

  console.log(`ClaudeMap skill artifact ready at ${artifactRoot}`)
  for (const demoPackage of demoPackages) {
    console.log(`${demoPackage.name} ready at ${demoPackage.projectRoot}`)
  }
  if (zipPath) {
    console.log(`Zip archive ready at ${zipPath}`)
  }
  if (demoSyncPath) {
    console.log(`Source demo bundle refreshed at ${demoSyncPath}`)
  }
}

try {
  main()
} catch (error) {
  console.error(`ClaudeMap skill packaging failed: ${error.message}`)
  process.exitCode = 1
}
