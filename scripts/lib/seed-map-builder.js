const path = require('path')

const POSIX_PATH = path.posix
const IMPORTABLE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts']
const EXCLUDED_PREFIXES = ['docs/']
const EXCLUDED_PATHS = new Set(['stitch-base.js'])

const SYSTEM_DEFINITIONS = [
  {
    id: 'experience',
    label: 'Map Experience',
    parentId: null,
    icon: 'layers',
    summary: 'Interactive map UI and walkthroughs',
    filePath: 'app/src/',
    health: 'yellow',
    healthReason: 'GraphCanvas and runtime hooks still concentrate a lot of scene logic',
  },
  {
    id: 'experience-shell',
    label: 'Runtime Shell',
    parentId: 'experience',
    icon: 'layers',
    summary: 'App frame and map chrome',
    filePath: 'app/src/',
    health: 'green',
    healthReason: null,
  },
  {
    id: 'experience-scene',
    label: 'Scene Orchestration',
    parentId: 'experience',
    icon: 'route',
    summary: 'Scene rendering and camera control',
    filePath: 'app/src/components/graph/',
    health: 'red',
    healthReason: 'GraphCanvas still acts as the main scene orchestration hotspot',
  },
  {
    id: 'experience-nodes',
    label: 'Node Composition',
    parentId: 'experience',
    icon: 'layers',
    summary: 'System, file, and function surfaces',
    filePath: 'app/src/components/graph/',
    health: 'green',
    healthReason: null,
  },
  {
    id: 'experience-state',
    label: 'State & Layout',
    parentId: 'experience',
    icon: 'gear',
    summary: 'Runtime polling and layout math',
    filePath: 'app/src/hooks/',
    health: 'yellow',
    healthReason: 'useGraphData and useLayout still carry most of the runtime coordination',
  },
  {
    id: 'experience-bridge',
    label: 'Runtime Bridge',
    parentId: 'experience',
    icon: 'server',
    summary: 'App-side MCP and map switching',
    filePath: 'app/src/mcp/',
    health: 'green',
    healthReason: null,
  },
  {
    id: 'experience-tooling',
    label: 'App Tooling',
    parentId: 'experience',
    icon: 'gear',
    summary: 'Frontend build configuration',
    filePath: 'app/',
    health: 'green',
    healthReason: null,
  },
  {
    id: 'runtime',
    label: 'Skill Runtime',
    parentId: null,
    icon: 'server',
    summary: 'CLI runtime that builds and drives maps',
    filePath: 'skill/',
    health: 'yellow',
    healthReason: 'Command, manifest, and transport logic still meet in a few oversized modules',
  },
  {
    id: 'runtime-commands',
    label: 'Command Surface',
    parentId: 'runtime',
    icon: 'zap',
    summary: 'Setup, refresh, explain, and show',
    filePath: 'skill/commands/',
    health: 'yellow',
    healthReason: 'show.js has become a wide control surface for the live map',
  },
  {
    id: 'runtime-analysis',
    label: 'Project Analysis',
    parentId: 'runtime',
    icon: 'database',
    summary: 'Snapshotting, cache, and diffs',
    filePath: 'skill/lib/',
    health: 'green',
    healthReason: null,
  },
  {
    id: 'runtime-model',
    label: 'Map Model',
    parentId: 'runtime',
    icon: 'puzzle',
    summary: 'Manifest, scope, and path rules',
    filePath: 'skill/lib/',
    health: 'yellow',
    healthReason: 'Multi-map scope resolution and manifest state now live in one bounded model layer',
  },
  {
    id: 'runtime-synthesis',
    label: 'Graph Synthesis',
    parentId: 'runtime',
    icon: 'globe',
    summary: 'Graph shaping and enrichment',
    filePath: 'skill/lib/enrichment.js',
    health: 'yellow',
    healthReason: 'Enrichment still combines override parsing, prioritization, and heuristic graphing',
  },
  {
    id: 'runtime-transport',
    label: 'Runtime Transport',
    parentId: 'runtime',
    icon: 'route',
    summary: 'MCP transport and app launch',
    filePath: 'skill/lib/',
    health: 'red',
    healthReason: 'mcp-client.js still owns transport, runtime state, and file-shim mutation paths',
  },
  {
    id: 'delivery',
    label: 'Delivery Pipeline',
    parentId: null,
    icon: 'puzzle',
    summary: 'CLI install, packaging, and preview',
    filePath: 'scripts/',
    health: 'yellow',
    healthReason: 'Packaging and install behavior still depend on a few large operational scripts',
  },
  {
    id: 'delivery-cli',
    label: 'CLI Entry',
    parentId: 'delivery',
    icon: 'zap',
    summary: 'npm-facing command wrapper',
    filePath: 'bin/',
    health: 'green',
    healthReason: null,
  },
  {
    id: 'delivery-site',
    label: 'Seeded Preview',
    parentId: 'delivery',
    icon: 'globe',
    summary: 'Self-map generation and site build',
    filePath: 'scripts/',
    health: 'green',
    healthReason: null,
  },
  {
    id: 'delivery-packaging',
    label: 'Distribution',
    parentId: 'delivery',
    icon: 'gear',
    summary: 'Artifact and install packaging',
    filePath: 'scripts/',
    health: 'yellow',
    healthReason: 'Artifact creation and install flows are still driven by a few large scripts',
  },
]

const LEAF_ASSIGNMENTS = [
  {
    systemId: 'experience-shell',
    exactPaths: [
      'app/src/main.jsx',
      'app/src/App.jsx',
      'app/src/components/graph/GraphRuntime.jsx',
      'app/src/components/layout/TopBar.jsx',
      'app/src/components/layout/StatusBar.jsx',
      'app/src/components/layout/MapSelector.jsx',
    ],
  },
  {
    systemId: 'experience-scene',
    exactPaths: [
      'app/src/components/graph/GraphCanvas.jsx',
      'app/src/components/graph/PresentationOverlay.jsx',
      'app/src/components/graph/CustomEdge.jsx',
      'app/src/components/ui/ZoomControls.jsx',
    ],
  },
  {
    systemId: 'experience-nodes',
    exactPaths: [
      'app/src/components/graph/SystemNode.jsx',
      'app/src/components/graph/FileNode.jsx',
      'app/src/components/graph/FunctionNode.jsx',
      'app/src/components/graph/FloatingDescription.jsx',
      'app/src/components/graph/MapAffordance.jsx',
      'app/src/components/graph/nodeIcons.js',
      'app/src/components/graph/systemNodeSizing.js',
    ],
  },
  {
    systemId: 'experience-state',
    exactPaths: [
      'app/src/hooks/useGraphData.js',
      'app/src/hooks/useLayout.js',
      'app/src/hooks/useZoomLevel.js',
      'app/src/hooks/useClipboard.js',
      'app/src/store/graphStore.js',
      'app/src/lib/graphNodeUtils.js',
      'app/src/lib/layoutEngine.js',
      'app/src/lib/mapApi.js',
      'app/src/lib/systemTreeLayout.js',
    ],
  },
  {
    systemId: 'experience-bridge',
    exactPaths: [
      'app/src/mcp/handlers.js',
      'app/src/mcp/server.js',
      'app/vite.config.js',
    ],
  },
  {
    systemId: 'experience-tooling',
    exactPaths: [
      'app/postcss.config.js',
      'app/tailwind.config.js',
    ],
  },
  {
    systemId: 'runtime-commands',
    exactPaths: [
      'skill/commands/create-map.js',
      'skill/commands/open-claudemap.js',
      'skill/commands/setup-claudemap.js',
      'skill/commands/show.js',
      'skill/commands/snapshot.js',
      'skill/commands/refresh.js',
    ],
  },
  {
    systemId: 'runtime-analysis',
    exactPaths: [
      'skill/lib/file-walker.js',
      'skill/lib/cache.js',
      'skill/lib/differ.js',
    ],
  },
  {
    systemId: 'runtime-model',
    exactPaths: [
      'skill/lib/active-map.js',
      'skill/lib/map-manifest.js',
      'skill/lib/runtime-paths.js',
      'skill/lib/scoped-map.js',
    ],
  },
  {
    systemId: 'runtime-synthesis',
    exactPaths: [
      'skill/lib/enrichment.js',
    ],
  },
  {
    systemId: 'runtime-transport',
    exactPaths: [
      'skill/lib/mcp-client.js',
      'skill/lib/launcher.js',
    ],
  },
  {
    systemId: 'delivery-cli',
    exactPaths: [
      'bin/claudemap.js',
    ],
  },
  {
    systemId: 'delivery-site',
    exactPaths: [
      'scripts/build-site.js',
      'scripts/generate-seed-map.js',
      'scripts/lib/seed-map-builder.js',
    ],
  },
  {
    systemId: 'delivery-packaging',
    exactPaths: [
      'scripts/install-claudemap.js',
      'scripts/package-claudemap-skill.js',
      'scripts/prepare-npm-bundle.js',
    ],
  },
]

const FILE_SUMMARIES = {
  'app/postcss.config.js': 'PostCSS plugin wiring',
  'app/src/App.jsx': 'Composes chrome, graph, and status frame',
  'app/src/components/graph/CustomEdge.jsx': 'Renders relationship lines with emphasis styling',
  'app/src/components/graph/FileNode.jsx': 'Renders file cards and nested exports',
  'app/src/components/graph/FloatingDescription.jsx': 'Shows inline descriptions near focused nodes',
  'app/src/components/graph/FunctionNode.jsx': 'Renders exported behavior chips',
  'app/src/components/graph/GraphCanvas.jsx': 'Coordinates layout, emphasis, and camera state',
  'app/src/components/graph/GraphRuntime.jsx': 'Wraps React Flow and the overlay stack',
  'app/src/components/graph/MapAffordance.jsx': 'Offers Open map and Create map actions',
  'app/src/components/graph/nodeIcons.js': 'Maps ClaudeMap icons to Lucide glyphs',
  'app/src/components/graph/PresentationOverlay.jsx': 'Types guided narration over the graph',
  'app/src/components/graph/SystemNode.jsx': 'Renders expandable system containers',
  'app/src/components/graph/systemNodeSizing.js': 'Defines nested card sizing and spacing',
  'app/src/components/layout/MapSelector.jsx': 'Switches between root and scoped maps',
  'app/src/components/layout/StatusBar.jsx': 'Shows sync, map, and presentation state',
  'app/src/components/layout/TopBar.jsx': 'Shows repo identity and the active map',
  'app/src/components/ui/ZoomControls.jsx': 'Controls camera, fit, and health overlay',
  'app/src/hooks/useClipboard.js': 'Copies commands and node context',
  'app/src/hooks/useGraphData.js': 'Polls the active map and normalizes runtime data',
  'app/src/hooks/useLayout.js': 'Computes stable nested layout geometry',
  'app/src/hooks/useZoomLevel.js': 'Maps zoom to semantic detail levels',
  'app/src/lib/graphNodeUtils.js': 'Shared ancestry and visibility helpers',
  'app/src/lib/layoutEngine.js': 'Runs ELK for top-level system placement',
  'app/src/lib/mapApi.js': 'POSTs active-map switches to the dev server',
  'app/src/lib/systemTreeLayout.js': 'Measures nested system trees without React Flow',
  'app/src/main.jsx': 'Bootstraps the React app into the page',
  'app/src/mcp/handlers.js': 'Maps MCP tool calls onto runtime mutations',
  'app/src/mcp/server.js': 'Starts the app-side MCP server',
  'app/src/store/graphStore.js': 'Stores graph, selection, and presentation state',
  'app/tailwind.config.js': 'Tailwind content and theme scaffold',
  'app/vite.config.js': 'Serves the app and active-map switch endpoint',
  'bin/claudemap.js': 'CLI wrapper around install and update',
  'scripts/build-site.js': 'Builds the public preview from the seed map',
  'scripts/generate-seed-map.js': 'Regenerates the curated ClaudeMap self-map',
  'scripts/lib/seed-map-builder.js': 'Defines the curated self-map architecture recipe',
  'scripts/install-claudemap.js': 'Installs or updates ClaudeMap in a target repo',
  'scripts/package-claudemap-skill.js': 'Builds the packaged runtime artifact',
  'scripts/prepare-npm-bundle.js': 'Stages the npm bundle from the packaged artifact',
  'skill/commands/create-map.js': 'Builds a scoped map from the active root graph',
  'skill/commands/open-claudemap.js': 'Opens the current map without rebuilding',
  'skill/commands/setup-claudemap.js': 'Builds the root map from a repo snapshot',
  'skill/commands/show.js': 'Drives highlights, focus, and presentation state',
  'skill/commands/snapshot.js': 'Writes a repo snapshot JSON',
  'skill/commands/refresh.js': 'Refreshes root and scoped maps after changes',
  'skill/lib/active-map.js': 'Resolves the current map entry and its paths',
  'skill/lib/cache.js': 'Persists graph snapshots beside the repo',
  'skill/lib/differ.js': 'Diffs file manifests and graph payloads',
  'skill/lib/enrichment.js': 'Chooses Claude, override, or heuristic graphs',
  'skill/lib/file-walker.js': 'Collects import/export-aware repo snapshots',
  'skill/lib/launcher.js': 'Starts or reuses the local ClaudeMap app',
  'skill/lib/map-manifest.js': 'Stores map metadata and resolves scopes',
  'skill/lib/mcp-client.js': 'Bridges commands into runtime graph state',
  'skill/lib/runtime-paths.js': 'Resolves project and runtime file targets',
  'skill/lib/scoped-map.js': 'Projects subsystem graphs from the root map',
}

const FUNCTION_SUMMARIES = {
  'app/src/hooks/useGraphData.js#transformToReactFlow': 'Turns graph payloads into React Flow nodes',
  'app/src/hooks/useGraphData.js#useGraphData': 'Polls the active map manifest and runtime state',
  'app/src/hooks/useLayout.js#useLayout': 'Computes nested system geometry and ELK placement',
  'app/src/hooks/useClipboard.js#copyTextToClipboard': 'Copies generated commands to the clipboard',
  'app/src/hooks/useClipboard.js#copyNodeToClipboard': 'Copies clicked node context for Claude',
  'app/src/lib/layoutEngine.js#computeLayout': 'Runs ELK on the top-level system graph',
  'app/src/lib/mapApi.js#setActiveMap': 'Switches the active map through the dev API',
  'app/src/lib/systemTreeLayout.js#buildSystemTreeLayout': 'Measures nested systems without React Flow',
  'app/src/lib/systemTreeLayout.js#getGraphLayoutSignature': 'Hashes geometry for layout caching',
  'app/src/mcp/handlers.js#createToolHandlers': 'Maps tool names onto runtime mutations',
  'app/src/store/graphStore.js#useGraphStore': 'Central graph and presentation store',
  'skill/lib/active-map.js#resolveMapPaths': 'Resolves cache and runtime paths for a map',
  'skill/lib/active-map.js#resolveActiveMap': 'Loads the active map from the manifest',
  'skill/lib/enrichment.js#selectPreferredGraph': 'Keeps higher-priority graphs during refresh',
  'skill/lib/enrichment.js#enrichGraph': 'Builds a graph from override or heuristics',
  'skill/lib/file-walker.js#collectProjectSnapshot': 'Collects the repo snapshot used for graphing',
  'skill/lib/launcher.js#launchClaudeMapWindow': 'Starts or reuses the local ClaudeMap app',
  'skill/lib/map-manifest.js#computeScopeFingerprint': 'Builds stable scope identity across refreshes',
  'skill/lib/map-manifest.js#readManifest': 'Reads or synthesizes the map manifest',
  'skill/lib/map-manifest.js#writeManifest': 'Persists project and runtime manifests',
  'skill/lib/map-manifest.js#upsertMapEntry': 'Creates or updates a map entry',
  'skill/lib/map-manifest.js#resolveScopeAgainstGraph': 'Rebinds scoped maps to the latest root graph',
  'skill/lib/mcp-client.js#createMcpClient': 'Builds a file-shim runtime client',
  'skill/lib/mcp-client.js#connectMcpClient': 'Connects stdio MCP or falls back to file-shim',
  'skill/lib/mcp-client.js#renderGraph': 'Writes a fresh graph into the runtime',
  'skill/lib/mcp-client.js#setPresentationMode': 'Updates guided or locked presentation state',
  'skill/lib/mcp-client.js#presentStep': 'Applies focus, highlight, and caption atomically',
  'skill/lib/scoped-map.js#buildScopedGraphFromRoot': 'Cuts a subsystem graph out of the root map',
}

function buildSeedMapGraph(snapshot, contracts) {
  const { GRAPH_SOURCES } = contracts
  const filteredFiles = snapshot.files
    .filter((file) => !EXCLUDED_PREFIXES.some((prefix) => file.relativePath.startsWith(prefix)))
    .filter((file) => !EXCLUDED_PATHS.has(file.relativePath))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  const nextSnapshot = {
    ...snapshot,
    generatedAt: new Date().toISOString(),
    files: filteredFiles,
    totalFiles: filteredFiles.length,
    totalLines: filteredFiles.reduce((total, file) => total + file.lineCount, 0),
  }
  const systemById = new Map(SYSTEM_DEFINITIONS.map((system) => [system.id, system]))
  const childrenByParent = buildChildrenByParentMap(SYSTEM_DEFINITIONS)
  const systemIdByFilePath = new Map()
  const filesBySystemId = new Map()

  for (const file of filteredFiles) {
    const systemId = resolveSystemId(file.relativePath)

    if (!systemId) {
      throw new Error(`No seed-map system assignment for ${file.relativePath}`)
    }

    systemIdByFilePath.set(file.relativePath, systemId)
    if (!filesBySystemId.has(systemId)) {
      filesBySystemId.set(systemId, [])
    }
    filesBySystemId.get(systemId).push(file)
  }

  const systemLineCountById = new Map()
  const systemNodes = SYSTEM_DEFINITIONS.map((definition) =>
    createSystemNode(definition, systemLineCountById, filesBySystemId, childrenByParent),
  )
  const fileNodes = []
  const functionNodes = []

  for (const definition of SYSTEM_DEFINITIONS) {
    const systemFiles = (filesBySystemId.get(definition.id) || []).slice()
    systemFiles.sort((left, right) => left.relativePath.localeCompare(right.relativePath))

    for (const file of systemFiles) {
      const fileNode = createFileNode(file, definition.id)
      fileNodes.push(fileNode)

      for (const functionNode of createFunctionNodes(file, fileNode.id)) {
        functionNodes.push(functionNode)
      }
    }
  }

  const edges = createSystemEdges(filteredFiles, systemIdByFilePath, systemById)
  return {
    graph: {
      meta: {
        repoName: nextSnapshot.repoName,
        branch: nextSnapshot.branch || 'workspace',
        creditLabel: 'ClaudeMap self-map',
        generatedAt: nextSnapshot.generatedAt,
        source: GRAPH_SOURCES.MANUAL,
      },
      nodes: [...systemNodes, ...fileNodes, ...functionNodes],
      edges,
      files: filteredFiles,
    },
    filteredSnapshot: nextSnapshot,
    excludedPaths: [...EXCLUDED_PREFIXES, ...EXCLUDED_PATHS],
  }
}

function buildChildrenByParentMap(definitions) {
  const childrenByParent = new Map()

  for (const definition of definitions) {
    if (!definition.parentId) {
      continue
    }

    if (!childrenByParent.has(definition.parentId)) {
      childrenByParent.set(definition.parentId, [])
    }

    childrenByParent.get(definition.parentId).push(definition.id)
  }

  return childrenByParent
}

function createSystemNode(definition, lineCountById, filesBySystemId, childrenByParent) {
  return {
    id: definition.id,
    label: definition.label,
    type: 'system',
    icon: definition.icon,
    parentId: definition.parentId,
    health: definition.health,
    healthReason: definition.healthReason,
    summary: definition.summary,
    lineCount: computeSystemLineCount(definition.id, lineCountById, filesBySystemId, childrenByParent),
    filePath: definition.filePath,
  }
}

function computeSystemLineCount(systemId, lineCountById, filesBySystemId, childrenByParent) {
  if (lineCountById.has(systemId)) {
    return lineCountById.get(systemId)
  }

  const directLineCount = (filesBySystemId.get(systemId) || []).reduce(
    (total, file) => total + file.lineCount,
    0,
  )
  const childLineCount = (childrenByParent.get(systemId) || []).reduce(
    (total, childSystemId) =>
      total + computeSystemLineCount(childSystemId, lineCountById, filesBySystemId, childrenByParent),
    0,
  )
  const lineCount = directLineCount + childLineCount

  lineCountById.set(systemId, lineCount)
  return lineCount
}

function resolveSystemId(relativePath) {
  for (const assignment of LEAF_ASSIGNMENTS) {
    if (assignment.exactPaths.includes(relativePath)) {
      return assignment.systemId
    }
  }

  return null
}

function createFileNode(file, systemId) {
  const health = assessFileHealth(file)

  return {
    id: `file-${slugify(file.relativePath)}`,
    label: file.name,
    type: 'file',
    icon: 'file',
    parentId: systemId,
    health: health.health,
    healthReason: health.healthReason,
    summary: FILE_SUMMARIES[file.relativePath] || createFallbackFileSummary(file, systemId),
    lineCount: file.lineCount,
    filePath: file.relativePath,
  }
}

function createFunctionNodes(file, parentFileId) {
  if (file.lineCount <= 50) {
    return []
  }

  const exports = (file.exports || []).filter(isMeaningfulExport).slice(0, 5)
  const fileHealth = assessFileHealth(file)

  return exports.map((exportName) => ({
    id: `function-${slugify(file.relativePath)}-${slugify(exportName)}`,
    label: exportName,
    type: 'function',
    icon: 'code',
    parentId: parentFileId,
    health: fileHealth.health,
    healthReason: fileHealth.healthReason,
    summary:
      FUNCTION_SUMMARIES[`${file.relativePath}#${exportName}`] ||
      createFallbackFunctionSummary(file, exportName),
    lineCount: estimateFunctionLineCount(file, exports.length),
    filePath: file.relativePath,
  }))
}

function createSystemEdges(files, systemIdByFilePath, systemById) {
  const fileByPath = new Map(files.map((file) => [file.relativePath, file]))
  const edges = []
  const edgeIds = new Set()

  for (const file of files) {
    const sourceSystemId = systemIdByFilePath.get(file.relativePath)

    if (!sourceSystemId) {
      continue
    }

    for (const importPath of file.imports || []) {
      const targetPath = resolveRelativeImport(file, importPath, fileByPath)

      if (!targetPath) {
        continue
      }

      const targetSystemId = systemIdByFilePath.get(targetPath)

      if (!targetSystemId || targetSystemId === sourceSystemId) {
        continue
      }

      const sourceTopLevelId = getTopLevelSystemId(sourceSystemId, systemById)
      const targetTopLevelId = getTopLevelSystemId(targetSystemId, systemById)
      const edgeSourceId = sourceTopLevelId === targetTopLevelId ? sourceSystemId : sourceTopLevelId
      const edgeTargetId = sourceTopLevelId === targetTopLevelId ? targetSystemId : targetTopLevelId

      if (!edgeSourceId || !edgeTargetId || edgeSourceId === edgeTargetId) {
        continue
      }

      const edgeId = `edge-${edgeSourceId}-${edgeTargetId}`

      if (edgeIds.has(edgeId)) {
        continue
      }

      edgeIds.add(edgeId)
      edges.push({
        id: edgeId,
        source: edgeSourceId,
        target: edgeTargetId,
        type: 'imports',
      })
    }
  }

  return edges.sort((left, right) => left.id.localeCompare(right.id))
}

function getTopLevelSystemId(systemId, systemById) {
  let currentSystem = systemById.get(systemId)

  while (currentSystem?.parentId) {
    currentSystem = systemById.get(currentSystem.parentId)
  }

  return currentSystem?.id || null
}

function resolveRelativeImport(sourceFile, importPath, fileByPath) {
  if (!String(importPath || '').startsWith('.')) {
    return null
  }

  const sourceDirectory = sourceFile.directory || ''
  const baseCandidate = POSIX_PATH.normalize(POSIX_PATH.join(sourceDirectory, importPath))
  const candidatePaths = [baseCandidate]

  for (const extension of IMPORTABLE_EXTENSIONS) {
    candidatePaths.push(`${baseCandidate}${extension}`)
    candidatePaths.push(POSIX_PATH.join(baseCandidate, `index${extension}`))
  }

  return candidatePaths.find((candidatePath) => fileByPath.has(candidatePath)) || null
}

function assessFileHealth(file) {
  if (file.lineCount > 500) {
    return {
      health: 'red',
      healthReason: `Large file at ${file.lineCount} lines`,
    }
  }

  if (file.lineCount > 300) {
    return {
      health: 'yellow',
      healthReason: `File is ${file.lineCount} lines`,
    }
  }

  if ((file.imports || []).length > 12) {
    return {
      health: 'yellow',
      healthReason: `High dependency count with ${file.imports.length} imports`,
    }
  }

  return {
    health: 'green',
    healthReason: null,
  }
}

function createFallbackFileSummary(file) {
  if ((file.exports || []).length > 0) {
    return `Exports ${file.exports.slice(0, 3).join(', ')}`
  }

  return `Code in ${file.directory || 'repo root'}`
}

function createFallbackFunctionSummary(file, exportName) {
  const exportLabel = humanizeIdentifier(exportName)

  if (exportName.startsWith('use')) {
    return `Hook for ${humanizeIdentifier(exportName.slice(3))}`
  }

  if (exportName.startsWith('get')) {
    return `Reads ${humanizeIdentifier(exportName.slice(3))}`
  }

  if (exportName.startsWith('set')) {
    return `Updates ${humanizeIdentifier(exportName.slice(3))}`
  }

  if (exportName.startsWith('create')) {
    return `Creates ${humanizeIdentifier(exportName.slice(6))}`
  }

  if (exportName.startsWith('build')) {
    return `Builds ${humanizeIdentifier(exportName.slice(5))}`
  }

  if (exportName.startsWith('read')) {
    return `Reads ${humanizeIdentifier(exportName.slice(4))}`
  }

  if (exportName.startsWith('write')) {
    return `Writes ${humanizeIdentifier(exportName.slice(5))}`
  }

  return `${exportLabel.charAt(0).toUpperCase()}${exportLabel.slice(1)} in ${file.name}`
}

function estimateFunctionLineCount(file, exportCount) {
  if (!exportCount) {
    return Math.min(file.lineCount, 20)
  }

  return Math.max(8, Math.floor(file.lineCount / Math.min(exportCount, 5)))
}

function isMeaningfulExport(exportName) {
  if (!exportName || exportName === 'default') {
    return false
  }

  if (/^[A-Z0-9_]+$/.test(exportName)) {
    return false
  }

  return true
}

function humanizeIdentifier(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase()
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

module.exports = {
  EXCLUDED_PATHS,
  EXCLUDED_PREFIXES,
  buildSeedMapGraph,
}
