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
const DEFAULT_SEED_MAP_PATH = path.join(REPO_ROOT, 'contracts', 'claudemap-seed-map.json')

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

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

function createEmptyRuntimeGraph() {
  return {
    meta: {
      repoName: 'claudemap',
      branch: 'workspace',
      creditLabel: 'ClaudeMap skill',
      generatedAt: null,
      source: 'file-shim',
    },
    nodes: [],
    edges: [],
    files: [],
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
      source: normalizedGraph.meta?.source || 'seed',
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

function writeRuntimePlaceholders(projectRoot, graphSourcePath = DEFAULT_SEED_MAP_PATH) {
  const packagedGraph = readJsonFileOrFallback(
    graphSourcePath,
    createEmptyRuntimeGraph,
  )

  // Graphs live in a dedicated `graph/` subdirectory under `app/public/` so
  // runtime graph outputs have an obvious home and are not mixed with
  // unrelated static assets.
  writeJsonFile(
    path.join(projectRoot, SKILL_ROOT, 'app', 'public', 'graph', 'claudemap-runtime.json'),
    packagedGraph,
  )
  writeJsonFile(
    path.join(projectRoot, SKILL_ROOT, 'app', 'public', 'graph', 'claudemap-runtime-state.json'),
    createDefaultRuntimeStateFromGraph(packagedGraph),
  )
  writeJsonFile(
    path.join(projectRoot, SKILL_ROOT, 'app', 'public', 'claudemap-maps.json'),
    createDefaultMapsManifest(),
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

Generated runtime graphs are written into \`.claude/skills/claudemap-runtime/app/public/graph/\` (served by the bundled app as \`/graph/*\`). Do not drop graph files anywhere else under \`claudemap-runtime/\` — the \`graph/\` subdirectory is the one canonical home for runtime graph outputs.

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
6. **Wait for the \`@claudemap-architect\` Task call to fully return**, then save the returned JSON to \`.claude/skills/claudemap-runtime/tmp/claudemap-enrichment.json\`. **Do not run the setup JS command until after this file exists with non-empty valid graph JSON.** Do not launch setup in parallel with the subagent call.
7. Run \`.claude/skills/claudemap-runtime/skill/commands/setup-claudemap.js\` with \`--enrichment-file\` pointing to that JSON file. The setup command is strict: it will exit non-zero if the file is missing, empty, or unparseable, and it will not fall back to a heuristic graph. If that happens, fix the architect output first and rerun — do not rerun setup without \`--enrichment-file\`.
8. Add \`--force-refresh\` only when the user explicitly asks for a full rebuild.
9. If the subagent cannot produce valid JSON after two attempts, stop and tell the user the architect pass failed. Do not silently retry setup without the enrichment file — that would render a heuristic graph and pollute the cache.
10. Report the analyzed file count, system count, graph source, render transport, and app readiness.
11. End with a short feedback prompt after the graph opens, for example: \`Does this map look right, or should I refine it?\`
12. If the user says the map is good, stop there.
13. If the user asks for refinement, reuse the current root cache graph from \`claudemap-cache.json\` as context, send that graph plus the requested changes back through \`@claudemap-architect\`, **wait for that Task call to fully return**, save the refined JSON to the same \`tmp/claudemap-enrichment.json\` path, and only then run \`.claude/skills/claudemap-runtime/skill/commands/update.js\` with \`--enrichment-file\` instead of telling the user to rerun setup from scratch. The update command applies the same strict enrichment validation as setup.
14. After the refined graph renders, ask the same short feedback prompt again.
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
4. Report added, removed, and changed file counts plus the refresh mode and scoped map refresh summary.
5. Preserve any cached Claude-authored graph unless the user explicitly asks for a force refresh.
6. Scoped maps are refreshed change-aware: maps whose files did not change keep their architect-authored graph, maps whose files did change are rebuilt from the root graph filter and flagged \`needsRebuild\` so the next \`/create-map\` pass can rerun the architect for them.
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
    'create-map.md': `---
description: Create or refresh a scoped ClaudeMap for a major subsystem and switch to it.
argument-hint: '{"scope":{"rootSystemId":"...","rootSystemLabel":"...","ancestorPath":["..."]},"label":"...","summary":"..."} | <natural language scope description>'
---

Use the bundled ClaudeMap scoped-map command. Scoped maps are first-class architect views, not raw filters of the root graph.

Workflow:
1. Treat the current working directory as the target project root unless the user gave a different path.
2. Resolve the scope from the user's argument. If it is the JSON payload copied from ClaudeMap's "Create map?" affordance, use it as-is. If it is a natural language request (e.g. "map the auth system"), inspect the current root runtime graph at \`.claude/skills/claudemap-runtime/app/public/graph/claudemap-runtime.json\` and pick the best matching system node, then synthesize a scope payload with \`rootSystemId\`, \`rootSystemLabel\`, and \`ancestorPath\`.
3. Read \`.claude/skills/claudemap-runtime/skill/prompts/scoped-enrichment.txt\`. This is the dedicated scoped prompt — do not reuse the root enrichment prompt.
4. Build a scoped snapshot payload for \`@claudemap-architect\` containing: the repo/branch meta, the scope block, the filtered file list for that subsystem (pulled from the root graph), and — if the target map already has a cached scoped graph — include its graph as \`priorGraph\` so the architect can refine rather than rebuild. Include any user-provided refinement instructions under \`instructions\`.
5. Call \`@claudemap-architect\` with the scoped prompt + payload. Tell it to return valid graph JSON only, to emit richer internal subsystems (2-6) and edges than the root graph, and to decide on its own whether to edit the prior graph in place or rebuild based on the intent of the request.
6. **Wait for the \`@claudemap-architect\` Task call to fully return**, then save the returned JSON to \`.claude/skills/claudemap-runtime/tmp/claudemap-enrichment.json\`. Do not run create-map until that file contains valid graph JSON.
7. Run \`.claude/skills/claudemap-runtime/skill/commands/create-map.js\` with Node and pass the scope payload through \`--scope-json\`, the refinement instructions (if any) through \`--instructions\`, and the enrichment file through \`--enrichment-file\`. The command deletes the tmp file after it reads it.
8. Report the created or updated map id, label, scope root, graph source, and resulting active map id. If the graph source is not \`claude-scoped\`, warn the user that the scoped map is a filtered fallback view and suggest rerunning with architect enrichment.
9. If the payload is missing or invalid, ask the user to click "Create map?" in ClaudeMap again and paste the copied command, or describe the subsystem they want scoped.
10. End with a short feedback prompt after the scoped map renders, for example: \`Does this map look right, or should I refine it?\`
11. If the user says the map is good, stop there.
12. If the user asks for refinement, reuse the scoped map's cache graph (the \`cachePath\` for that map in the target project's repo-root \`claudemap-maps.json\`) as \`priorGraph\` in the architect payload, pass the refinement instructions through \`instructions\`, save the architect's response to \`.claude/skills/claudemap-runtime/tmp/claudemap-enrichment.json\`, and rerun \`create-map.js\` with the same \`--scope-json\` payload plus \`--enrichment-file\` and \`--instructions\` so the scoped graph iterates in place for the same map entry.
13. After the refined graph renders, ask the same short feedback prompt again.
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
3. If needed, inspect the currently active ClaudeMap runtime graph rather than assuming the root map. Prefer the bundled command's own active-map resolution over hardcoded runtime file paths.
4. Translate the request into the smallest useful set of show commands.
5. Run the show command or short command sequence with Node.
6. Briefly report what changed in the UI.

Built-in show actions include:
- \`highlight <query> [--zoom <value>] [--explain "..."] [--keep-mode]\`
- \`clear-highlight\`
- \`present <query> [--title "..."] [--step "..."] [--explain "..."] [--keep-mode]\`
- \`navigate <query> [--zoom <value>]\`
- \`health <on|off>\`
- \`mode <free|guided|locked>\`
- \`caption [--title <title>] [--step <step>] <body>\`
- \`clear-caption\`
- \`flow <query1> <query2> [query3 ...]\`
- \`ask "<phrase>"\`

Mode handling:
- \`present\` and \`highlight\` (with explain/title/step/mode/lock options) automatically revert the UI to free mode after the command runs, so one-shot \`/show\` requests never leave the user trapped in guided or locked mode.
- Pass \`--keep-mode\` when you are running multiple presentation steps in sequence (for example inside \`/explain\`) and want the UI to remain in guided or locked mode between steps.
- \`mode <x>\` still sets the mode explicitly and is not auto-reverted.

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
4. Read the currently active ClaudeMap runtime graph rather than assuming the root map.
5. For broad or ambiguous requests, use the \`@claudemap-architect\` subagent to turn the request into a short walkthrough plan of 2-6 steps that follows intuitive architectural groupings.
6. Start presentation mode by running \`node .claude/skills/claudemap-runtime/skill/commands/show.js mode guided\`.
7. Drive the map in discrete steps. Prefer one present command per explanation beat so the highlight, navigation, and narration update atomically. Pass \`--keep-mode\` on every \`present\` and \`highlight\` step so the guided mode set in step 6 persists across steps instead of auto-reverting to free:
   - \`node .claude/skills/claudemap-runtime/skill/commands/show.js present <query> --title "..." --step "Step 1" --explain "..." --keep-mode\`
   - \`node .claude/skills/claudemap-runtime/skill/commands/show.js highlight <query> --keep-mode\`
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
- \`/create-map\`: create or refresh a scoped subsystem map from the current root graph
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
- \`.claude/agents/claudemap-architect.md\`: bundled architecture-mapping subagent
`,
  )
}

function writeArtifactManifest(artifactRoot) {
  const managedPaths = [
    toPosix(SKILL_ROOT),
    toPosix(path.join(AGENTS_ROOT, 'claudemap-architect.md')),
    toPosix(path.join(COMMANDS_ROOT, 'setup-claudemap.md')),
    toPosix(path.join(COMMANDS_ROOT, 'open-claudemap.md')),
    toPosix(path.join(COMMANDS_ROOT, 'create-map.md')),
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
      'create-map': toPosix(path.join(SKILL_ROOT, 'skill', 'commands', 'create-map.js')),
      refresh: toPosix(path.join(SKILL_ROOT, 'skill', 'commands', 'update.js')),
      show: toPosix(path.join(SKILL_ROOT, 'skill', 'commands', 'show.js')),
    },
    subagents: {
      claudemapArchitect: toPosix(path.join(AGENTS_ROOT, 'claudemap-architect.md')),
    },
    slashCommands: {
      'setup-claudemap': toPosix(path.join(COMMANDS_ROOT, 'setup-claudemap.md')),
      explain: toPosix(path.join(COMMANDS_ROOT, 'explain.md')),
      'create-map': toPosix(path.join(COMMANDS_ROOT, 'create-map.md')),
      'open-claudemap': toPosix(path.join(COMMANDS_ROOT, 'open-claudemap.md')),
      refresh: toPosix(path.join(COMMANDS_ROOT, 'refresh.md')),
      show: toPosix(path.join(COMMANDS_ROOT, 'show.md')),
    },
    publicCommands: [
      'setup-claudemap',
      'open-claudemap',
      'create-map',
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
    notes: [
      'Install the bundled .claude directory into your target project root with scripts/install-claudemap.js, or copy it manually.',
      'The public surface is .claude/commands/*.md. The skill bundle under .claude/skills/claudemap-runtime is shared runtime infrastructure for those commands.',
      'The packaged runtime ships with the current seeded ClaudeMap self-map so /open-claudemap can render immediately after install.',
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
    relativePath === 'public/claudemap-maps.json' ||
    /^public\/claudemap-runtime(-state)?(\.[^/]+)?\.json$/.test(relativePath) ||
    relativePath === 'public/graph' ||
    relativePath.startsWith('public/graph/')
  )
}

function copyArtifactFiles(artifactRoot) {
  copyFile('skill/SKILL.md', artifactRoot, path.join(SKILL_ROOT, 'SKILL.md'))
  copyFile('package.json', artifactRoot, path.join(SKILL_ROOT, 'package.json'))

  if (fs.existsSync(path.join(REPO_ROOT, 'package-lock.json'))) {
    copyFile('package-lock.json', artifactRoot, path.join(SKILL_ROOT, 'package-lock.json'))
  }

  copyDirectoryInto('skill', artifactRoot, path.join(SKILL_ROOT, 'skill'), shouldExcludeSkill)
  copyDirectoryInto('app', artifactRoot, path.join(SKILL_ROOT, 'app'), shouldExcludeApp)
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

function buildClaudeMapArtifact(options = {}) {
  const normalizedOptions = {
    outputRoot: options.outputRoot || DEFAULT_OUTPUT_ROOT,
    zip: options.zip === true,
  }
  const artifactRoot = ensureCleanArtifactLocation(normalizedOptions.outputRoot)
  copyArtifactFiles(artifactRoot)
  writeRuntimePlaceholders(artifactRoot)
  writeSlashCommands(artifactRoot)
  writeNavigationDocs(artifactRoot)
  writeArtifactManifest(artifactRoot)

  return {
    artifactRoot,
    zipPath: maybeCreateZip(artifactRoot, normalizedOptions.outputRoot, normalizedOptions.zip),
  }
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)

  if (options.help) {
    printUsage()
    return
  }

  const { artifactRoot, zipPath } = buildClaudeMapArtifact(options)

  console.log(`ClaudeMap skill artifact ready at ${artifactRoot}`)
  if (zipPath) {
    console.log(`Zip archive ready at ${zipPath}`)
  }
}

module.exports = {
  buildClaudeMapArtifact,
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`ClaudeMap skill packaging failed: ${error.message}`)
    process.exitCode = 1
  }
}
