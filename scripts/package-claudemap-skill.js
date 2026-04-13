#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '..')
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, 'artifacts', 'claudemap-skill')
const ARTIFACT_NAME = 'claudemap'
const CLAUDE_ROOT = '.claude'
const SKILL_ROOT = path.join(CLAUDE_ROOT, 'skills', 'claudemap-runtime')
const COMMANDS_ROOT = path.join(CLAUDE_ROOT, 'commands')
const AGENTS_ROOT = path.join(CLAUDE_ROOT, 'agents')
const DEMO_PACKAGES_ROOT = path.join('demo-packages')
const DEFAULT_RUNTIME_GRAPH_PATH = path.join(REPO_ROOT, 'contracts', 'claudemap.sample.json')
const CLAUDEMAP_DEMO_GRAPH_PATH = path.join(REPO_ROOT, 'contracts', 'claudemap-first-demo.json')
const GENERATED_DEMO_NAMES = new Set(['ClaudeMapDemo'])
const CLAUDEMAP_DEMO_SUPPORT_FILES = [
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
    name: 'ClaudeMapDemo',
    graphSourcePath: CLAUDEMAP_DEMO_GRAPH_PATH,
    graphContract: 'contracts/claudemap-first-demo.json',
    description: 'Curated walkthrough of the ClaudeMap codebase with nested systems, core files, and important functions.',
    stageProject: stageClaudeMapDemoProject,
  },
]

function printUsage() {
  console.log('ClaudeMap skill packager')
  console.log('  node scripts/package-claudemap-skill.js [--output <dir>] [--zip] [--no-demo-sync] [--no-demo-packages]')
}

function parseArgs(argv) {
  const options = {
    outputRoot: DEFAULT_OUTPUT_ROOT,
    zip: false,
    demoSync: true,
    demoPackages: true,
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

    if (argument === '--no-demo-sync') {
      options.demoSync = false
      continue
    }

    if (argument === '--no-demo-packages') {
      options.demoPackages = false
      options.demoSync = false
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
description: Build a detailed architecture map for the current repository and open it in ClaudeMap.
argument-hint: '[project-root]'
---

Set up ClaudeMap for the target repository.

High-level goal:

- snapshot the repository
- ask the bundled \`@claudemap-architect\` subagent to build a detailed graph with intuitive human grouping
- render that graph in the ClaudeMap UI

Steps:
1. Treat the current working directory as the target project root unless the user gave a different path.
2. Resolve the bundled snapshot script at \`.claude/skills/claudemap-runtime/skill/commands/snapshot.js\`.
3. Run the snapshot script and capture the repo snapshot JSON.
4. Read \`.claude/skills/claudemap-runtime/skill/prompts/enrichment.txt\`.
5. Use the \`@claudemap-architect\` subagent explicitly and provide:
   - the snapshot JSON
   - the enrichment contract
   - instructions to return only valid graph JSON
   - instructions to optimize for detailed systems, useful file/function depth, and human-intuitive grouping
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
    'show.md': `---
description: Direct the live ClaudeMap session. Use it to focus the map, highlight architecture, present a step, compare regions, or show flow.
argument-hint: '[intent]'
---

Use ClaudeMap as a live presentation and navigation surface.

Principles:

- optimize for the fewest actions that make the user's intent visually obvious
- prefer \`present\` when the user wants explanation plus focus
- prefer \`highlight\` or \`navigate\` when the user wants quick emphasis without narration
- prefer \`flow\` when the user wants sequence or dependency motion
- keep the map legible and avoid noisy multi-step show-command spam

Workflow:
1. Resolve the bundled command script at \`.claude/skills/claudemap-runtime/skill/commands/show.js\`.
2. Read the user request as presentation intent, not just a literal command request.
3. If needed, read the current runtime graph from \`.claude/skills/claudemap-runtime/app/public/claudemap-runtime.json\` to choose the right node names or path through the graph.
4. Translate the request into the smallest useful set of show commands.
5. Run the show command or short command sequence with Node.
6. Briefly report what changed in the UI.

Built-in show actions include:
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

Examples of intent translation:

- "focus the auth system" -> \`navigate\` or \`highlight\`
- "walk me through request handling" -> a short \`present\` or \`flow\` sequence
- "show the riskiest area" -> \`ask "what's wrong"\`
- "put the UI in guided mode and caption this step" -> \`mode\` plus \`caption\`
`,
    'explain.md': `---
description: Explain part of the codebase by turning the live map into a guided walkthrough.
argument-hint: '[topic-or-click-context]'
---

Use ClaudeMap as a guided presentation tool.

Workflow:
1. If the user provided ClaudeMap click context, extract the label, path, and type from it.
2. If the user provided a plain topic or node name, use that as the walkthrough anchor.
3. If no usable topic is available, ask the user to click a node in ClaudeMap and paste the copied context, or provide a topic directly.
4. Read the current runtime graph from \`.claude/skills/claudemap-runtime/app/public/claudemap-runtime.json\`.
5. For broad or ambiguous requests, use the \`@claudemap-architect\` subagent to turn the request into a short walkthrough plan of 2-6 steps that follows intuitive architectural groupings.
6. Start presentation mode by running \`node .claude/skills/claudemap-runtime/skill/commands/show.js mode guided\`.
7. Drive the map in discrete steps. Prefer one present command per explanation beat so the highlight, navigation, and narration update atomically:
   - \`node .claude/skills/claudemap-runtime/skill/commands/show.js present <query> --title "..." --step "Step 1" --explain "..."\`
   - \`node .claude/skills/claudemap-runtime/skill/commands/show.js highlight <query>\`
   - \`node .claude/skills/claudemap-runtime/skill/commands/show.js health on\`
   - \`node .claude/skills/claudemap-runtime/skill/commands/show.js flow <query1> <query2> ...\`
8. Treat each show command as the visual step boundary. Do not rely on plain chat text streaming alone for transitions.
9. When the explanation is complete, always release the map by running:
   - \`node .claude/skills/claudemap-runtime/skill/commands/show.js clear-caption\`
   - \`node .claude/skills/claudemap-runtime/skill/commands/show.js mode free\`
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

## Quick Start

1. Run \`/setup-claudemap\`
2. Ask Claude to explain a system, file, or flow
3. Run \`/refresh\` after edits

## Public Commands

Use these first:

- \`/setup-claudemap\`: build a detailed architecture map for the current project
- \`/open-claudemap\`: reopen the existing map UI without rebuilding the graph
- \`/refresh\`: refresh the current graph after code changes
- \`/explain\`: run a guided walkthrough against the live graph
- \`/show\`: direct the live map for focus, highlights, presentation, health, and flow

## Mental Model

ClaudeMap works in three stages:

1. Snapshot the repository
2. Ask \`@claudemap-architect\` for a detailed, human-intuitive graph
3. Render and control that graph in the bundled UI

## Internal Runtime Layout

- \`.claude/skills/claudemap-runtime/SKILL.md\`: internal runtime skill definition
- \`.claude/skills/claudemap-runtime/skill/commands/\`: Node command entrypoints
- \`.claude/skills/claudemap-runtime/skill/lib/\`: shared runtime libraries
- \`.claude/skills/claudemap-runtime/skill/prompts/\`: enrichment prompt assets
- \`.claude/skills/claudemap-runtime/app/\`: bundled map app
- \`.claude/skills/claudemap-runtime/demo/\`: demo sandboxes and fallback data
- \`.claude/agents/claudemap-architect.md\`: bundled architecture-mapping subagent
`,
  )
}

function writeArtifactManifest(artifactRoot, demoPackages) {
  const managedPaths = [
    toPosix(SKILL_ROOT),
    toPosix(path.join(AGENTS_ROOT, 'claudemap-architect.md')),
    toPosix(path.join(COMMANDS_ROOT, 'setup-claudemap.md')),
    toPosix(path.join(COMMANDS_ROOT, 'open-claudemap.md')),
    toPosix(path.join(COMMANDS_ROOT, 'refresh.md')),
    toPosix(path.join(COMMANDS_ROOT, 'show.md')),
    toPosix(path.join(COMMANDS_ROOT, 'explain.md')),
    toPosix(path.join(CLAUDE_ROOT, 'claudemap-install.json')),
  ]

  writeJsonFile(path.join(artifactRoot, 'claudemap-artifact.json'), {
    name: ARTIFACT_NAME,
    version: require(path.join(REPO_ROOT, 'package.json')).version,
    generatedAt: new Date().toISOString(),
    entrypoints: {
      skill: toPosix(path.join(SKILL_ROOT, 'SKILL.md')),
      'setup-claudemap': toPosix(path.join(SKILL_ROOT, 'skill', 'commands', 'setup-claudemap.js')),
      'open-claudemap': toPosix(path.join(SKILL_ROOT, 'skill', 'commands', 'open-claudemap.js')),
      refresh: toPosix(path.join(SKILL_ROOT, 'skill', 'commands', 'update.js')),
      show: toPosix(path.join(SKILL_ROOT, 'skill', 'commands', 'show.js')),
    },
    subagents: {
      claudemapArchitect: toPosix(path.join(AGENTS_ROOT, 'claudemap-architect.md')),
    },
    slashCommands: {
      'setup-claudemap': toPosix(path.join(COMMANDS_ROOT, 'setup-claudemap.md')),
      explain: toPosix(path.join(COMMANDS_ROOT, 'explain.md')),
      'open-claudemap': toPosix(path.join(COMMANDS_ROOT, 'open-claudemap.md')),
      refresh: toPosix(path.join(COMMANDS_ROOT, 'refresh.md')),
      show: toPosix(path.join(COMMANDS_ROOT, 'show.md')),
    },
    publicCommands: [
      'setup-claudemap',
      'open-claudemap',
      'refresh',
      'explain',
      'show',
    ],
    managedPaths,
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
      'Install the bundled .claude directory into your target project root with scripts/install-claudemap.js, or copy it manually.',
      'The public surface is .claude/commands/*.md. The skill bundle under .claude/skills/claudemap-runtime is shared runtime infrastructure for those commands.',
      'The packaged runtime ships with the current seeded app/public graph so /open-claudemap can render immediately after install.',
      'The packaged demo project is emitted under demo-packages/ClaudeMapDemo.',
      'The installer script automatically runs npm install inside .claude/skills/claudemap-runtime. Manual installs still need that step.',
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

function stageClaudeMapDemoProject(projectRoot) {
  const firstDemoGraph = readJsonFileOrFallback(CLAUDEMAP_DEMO_GRAPH_PATH, createEmptyRuntimeGraph)
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

  for (const relativePath of CLAUDEMAP_DEMO_SUPPORT_FILES) {
    copyOptionalFile(relativePath, projectRoot, relativePath)
  }
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
  const demoPackages = options.demoPackages ? createDemoPackages(artifactRoot) : []
  writeArtifactManifest(artifactRoot, demoPackages)

  const zipPath = maybeCreateZip(artifactRoot, options.outputRoot, options.zip)

  console.log(`ClaudeMap skill artifact ready at ${artifactRoot}`)
  for (const demoPackage of demoPackages) {
    console.log(`${demoPackage.name} ready at ${demoPackage.projectRoot}`)
  }
  if (zipPath) {
    console.log(`Zip archive ready at ${zipPath}`)
  }
}

try {
  main()
} catch (error) {
  console.error(`ClaudeMap skill packaging failed: ${error.message}`)
  process.exitCode = 1
}
