import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROMPT_PATH = path.join(__dirname, '../prompts/enrichment.txt')
const ARCHITECT_AGENT_PATH = path.join(__dirname, '../../agents/claudemap-architect.md')
const DEMO_CACHE_PATH = path.join(__dirname, '../../demo/expressjs-cache.json')
const POSIX_PATH = path.posix
const IMPORTABLE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts', '.py']
const GRAPH_SOURCE_PRIORITY = {
  sample: 0,
  'file-shim': 0,
  heuristic: 10,
  'demo-cache': 20,
  claude: 30,
  imported: 40,
  manual: 50,
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function titleCase(value) {
  return value
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function buildPrompt(snapshot) {
  const promptTemplate = fs.readFileSync(PROMPT_PATH, 'utf8')
  const architectGuidance = readArchitectGuidance()
  return `${promptTemplate}\n\nSubagent guidance:\n\n${architectGuidance}\n\nHere is the codebase data:\n\n${JSON.stringify(snapshot, null, 2)}`
}

function readArchitectGuidance() {
  try {
    const agentMarkdown = fs.readFileSync(ARCHITECT_AGENT_PATH, 'utf8')
    return agentMarkdown.replace(/^---[\s\S]*?---\s*/, '').trim()
  } catch {
    return 'Prioritize intuitive, stable architectural systems over folder mirroring.'
  }
}

function stripCodeFences(responseText) {
  return responseText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function extractFirstJSONObject(responseText) {
  const start = responseText.indexOf('{')
  const end = responseText.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    return responseText
  }

  return responseText.slice(start, end + 1)
}

function normalizeGraphMeta(snapshot, graph, source) {
  return {
    ...graph,
    meta: {
      ...(graph.meta || {}),
      repoName: snapshot.repoName,
      branch: graph.meta?.branch || 'current',
      creditLabel: graph.meta?.creditLabel || 'ClaudeMap skill',
      generatedAt: snapshot.generatedAt,
      source,
    },
    files: snapshot.files,
  }
}

function validateGraph(graph) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error('Graph payload must include nodes[] and edges[]')
  }

  for (const node of graph.nodes) {
    if (!node || typeof node !== 'object') {
      throw new Error('Graph nodes must be objects')
    }

    if (!node.id || !node.label || !node.type) {
      throw new Error('Graph nodes require id, label, and type')
    }

    if (!Object.prototype.hasOwnProperty.call(node, 'parentId')) {
      throw new Error(`Graph node ${node.id} is missing parentId`)
    }

    if (!Object.prototype.hasOwnProperty.call(node, 'filePath')) {
      throw new Error(`Graph node ${node.id} is missing filePath`)
    }
  }

  for (const edge of graph.edges) {
    if (!edge?.id || !edge?.source || !edge?.target || !edge?.type) {
      throw new Error('Graph edges require id, source, target, and type')
    }
  }

  return graph
}

function parseGraphResponse(responseText) {
  const candidates = [stripCodeFences(responseText), extractFirstJSONObject(stripCodeFences(responseText))]
  let lastError = null

  for (const candidate of candidates) {
    try {
      return validateGraph(JSON.parse(candidate))
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('Unable to parse graph response')
}

function loadDemoGraph(snapshot) {
  const cache = JSON.parse(fs.readFileSync(DEMO_CACHE_PATH, 'utf8'))
  const graph = cache.graph || cache
  const validatedGraph = validateGraph(graph)

  if (validatedGraph.nodes.length === 0) {
    throw new Error('Demo cache is still placeholder-only')
  }

  return normalizeGraphMeta(snapshot, validatedGraph, 'demo-cache')
}

function iconForSystem(key, files) {
  const value = `${key} ${files.map((file) => file.relativePath).join(' ')}`.toLowerCase()

  if (/(auth|login|token|session|acl|permission|role)/.test(value)) return 'shield'
  if (/(db|database|model|schema|query|migration|store|sql|mongo|postgres)/.test(value)) return 'database'
  if (/(route|router|path|endpoint)/.test(value)) return 'route'
  if (/(api|client|http|web|network)/.test(value)) return 'globe'
  if (/(middleware|hook|pipeline)/.test(value)) return 'layers'
  if (/(plugin|extension|adapter)/.test(value)) return 'puzzle'
  if (/(mail|email|message)/.test(value)) return 'envelope'
  if (/(time|date|schedule|clock|cron)/.test(value)) return 'clock'
  if (/(config|settings|setup|build)/.test(value)) return 'gear'
  if (/(server|app|core|runtime)/.test(value)) return 'server'
  return 'code'
}

function summaryForSystem(key, files) {
  const topLanguages = unique(files.map((file) => file.language))
  const label = key === 'root' ? 'root files' : `${titleCase(key)} code`

  if (topLanguages.length === 1) {
    return `${label} in ${topLanguages[0]}`
  }

  return `${label} across ${files.length} files`
}

function assessFileHealth(file) {
  if (file.lineCount > 500) {
    return { health: 'red', healthReason: `Large file at ${file.lineCount} lines` }
  }

  if (file.lineCount > 300) {
    return { health: 'yellow', healthReason: `File is ${file.lineCount} lines` }
  }

  if (file.imports.length > 12) {
    return {
      health: 'yellow',
      healthReason: `High dependency count with ${file.imports.length} imports`,
    }
  }

  return { health: 'green', healthReason: null }
}

function assessSystemHealth(files) {
  const longestFile = files.reduce((largest, file) => (file.lineCount > largest.lineCount ? file : largest), files[0])
  const totalImports = files.reduce((total, file) => total + file.imports.length, 0)

  if (longestFile.lineCount > 500) {
    return { health: 'red', healthReason: `${longestFile.name} is ${longestFile.lineCount} lines` }
  }

  if (files.length > 15) {
    return { health: 'yellow', healthReason: `System contains ${files.length} files` }
  }

  if (totalImports > files.length * 6) {
    return { health: 'yellow', healthReason: `High coupling with ${totalImports} total imports` }
  }

  return { health: 'green', healthReason: null }
}

function estimateFunctionLineCount(file, exportCount) {
  if (!exportCount) {
    return Math.min(file.lineCount, 20)
  }

  return Math.max(8, Math.floor(file.lineCount / Math.min(exportCount, 5)))
}

function resolveRelativeImport(sourceFile, importPath, fileByPath) {
  if (!importPath.startsWith('.')) {
    return null
  }

  const sourceDirectory = sourceFile.directory || '.'
  const baseCandidate = POSIX_PATH.normalize(POSIX_PATH.join(sourceDirectory, importPath))
  const candidatePaths = [baseCandidate]

  for (const extension of IMPORTABLE_EXTENSIONS) {
    candidatePaths.push(`${baseCandidate}${extension}`)
    candidatePaths.push(POSIX_PATH.join(baseCandidate, `index${extension}`))
  }

  return candidatePaths.find((candidate) => fileByPath.has(candidate)) || null
}

function getSystemGroupKey(file) {
  const directorySegments = file.directory.split('/').filter(Boolean)

  if (directorySegments.length === 0) {
    return 'root'
  }

  if (directorySegments.length === 1) {
    return directorySegments[0]
  }

  if (['app', 'lib', 'src'].includes(directorySegments[0]) && directorySegments[1]) {
    return `${directorySegments[0]}-${directorySegments[1]}`
  }

  return directorySegments[0]
}

function createHeuristicGraph(snapshot) {
  const filesBySystemKey = new Map()

  for (const file of snapshot.files) {
    const systemKey = getSystemGroupKey(file)

    if (!filesBySystemKey.has(systemKey)) {
      filesBySystemKey.set(systemKey, [])
    }

    filesBySystemKey.get(systemKey).push(file)
  }

  const systemNodes = []
  const fileNodes = []
  const functionNodes = []
  const edges = []
  const fileByPath = new Map(snapshot.files.map((file) => [file.relativePath, file]))
  const systemIdByFilePath = new Map()
  const edgeKeys = new Set()

  for (const [systemKey, files] of [...filesBySystemKey.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    files.sort((left, right) => left.relativePath.localeCompare(right.relativePath))

    const systemId = `system-${slugify(systemKey)}`
    const systemHealth = assessSystemHealth(files)
    const systemLineCount = files.reduce((total, file) => total + file.lineCount, 0)

    systemNodes.push({
      id: systemId,
      label: systemKey === 'root' ? 'Root Files' : titleCase(systemKey),
      type: 'system',
      icon: iconForSystem(systemKey, files),
      parentId: null,
      health: systemHealth.health,
      healthReason: systemHealth.healthReason,
      summary: summaryForSystem(systemKey, files),
      lineCount: systemLineCount,
      filePath: files[0]?.directory || files[0]?.relativePath || '',
    })

    for (const file of files) {
      systemIdByFilePath.set(file.relativePath, systemId)
      const fileId = `file-${slugify(file.relativePath)}`
      const fileHealth = assessFileHealth(file)

      fileNodes.push({
        id: fileId,
        label: file.name,
        type: 'file',
        icon: 'file',
        parentId: systemId,
        health: fileHealth.health,
        healthReason: fileHealth.healthReason,
        summary:
          file.exports.length > 0
            ? `Exports ${file.exports.slice(0, 3).join(', ')}`
            : `Code file in ${file.directory || 'root'}`,
        lineCount: file.lineCount,
        filePath: file.relativePath,
      })

      if (file.lineCount > 50) {
        const exportedSymbols = file.exports.slice(0, 5)

        for (const exportName of exportedSymbols) {
          functionNodes.push({
            id: `function-${slugify(file.relativePath)}-${slugify(exportName)}`,
            label: exportName,
            type: 'function',
            icon: 'code',
            parentId: fileId,
            health: fileHealth.health,
            healthReason: fileHealth.healthReason,
            summary: `Exported symbol from ${file.name}`,
            lineCount: estimateFunctionLineCount(file, exportedSymbols.length),
            filePath: file.relativePath,
          })
        }
      }
    }
  }

  for (const sourceFile of snapshot.files) {
    const sourceSystemId = systemIdByFilePath.get(sourceFile.relativePath)

    for (const importPath of sourceFile.imports) {
      const targetPath = resolveRelativeImport(sourceFile, importPath, fileByPath)

      if (!targetPath) {
        continue
      }

      const targetSystemId = systemIdByFilePath.get(targetPath)

      if (!sourceSystemId || !targetSystemId || sourceSystemId === targetSystemId) {
        continue
      }

      const edgeId = `edge-${sourceSystemId}-${targetSystemId}`

      if (edgeKeys.has(edgeId)) {
        continue
      }

      edgeKeys.add(edgeId)
      edges.push({
        id: edgeId,
        source: sourceSystemId,
        target: targetSystemId,
        type: 'imports',
      })
    }
  }

  return validateGraph({
    meta: {
      repoName: snapshot.repoName,
      branch: 'current',
      creditLabel: 'ClaudeMap skill',
      generatedAt: snapshot.generatedAt,
      source: 'heuristic',
    },
    nodes: [...systemNodes, ...fileNodes, ...functionNodes],
    edges,
    files: snapshot.files,
  })
}

async function parseProvidedResponse(snapshot, responseText) {
  const graph = parseGraphResponse(responseText)
  return normalizeGraphMeta(snapshot, graph, 'claude')
}

function readResponseOverride() {
  if (process.env.CLAUDEMAP_ENRICHMENT_JSON) {
    return process.env.CLAUDEMAP_ENRICHMENT_JSON
  }

  if (process.env.CLAUDEMAP_ENRICHMENT_FILE) {
    return fs.readFileSync(path.resolve(process.env.CLAUDEMAP_ENRICHMENT_FILE), 'utf8')
  }

  return null
}

function normalizeGraphSource(sourceValue) {
  if (typeof sourceValue === 'string') {
    return sourceValue.trim().toLowerCase()
  }

  return String(sourceValue?.meta?.source || '').trim().toLowerCase()
}

export function getGraphSourcePriority(sourceValue) {
  const normalizedSource = normalizeGraphSource(sourceValue)
  return GRAPH_SOURCE_PRIORITY[normalizedSource] ?? 5
}

export function hasEnrichmentResponseOverride(options = {}) {
  if (typeof options.responseText === 'string' && options.responseText.trim()) {
    return true
  }

  return Boolean(readResponseOverride())
}

export function shouldPreserveExistingGraph(existingGraph, candidateGraph, options = {}) {
  if (!existingGraph || !candidateGraph) {
    return false
  }

  if (options.forceRefresh || options.allowLowerPriorityOverwrite) {
    return false
  }

  return getGraphSourcePriority(existingGraph) > getGraphSourcePriority(candidateGraph)
}

export function selectPreferredGraph(existingGraph, candidateGraph, options = {}) {
  const preservedExisting = shouldPreserveExistingGraph(existingGraph, candidateGraph, options)

  return {
    graph: preservedExisting ? existingGraph : candidateGraph,
    preservedExisting,
    existingSource: existingGraph?.meta?.source || 'none',
    candidateSource: candidateGraph?.meta?.source || 'none',
  }
}

function shouldPreferDemoCache(snapshot, options) {
  if (options.useDemoFallback) {
    return true
  }

  return snapshot.repoName.toLowerCase().includes('express')
}

export async function enrichGraph(snapshot, options = {}) {
  const fullPrompt = buildPrompt(snapshot)
  void fullPrompt

  const responseOverride = options.responseText || readResponseOverride()

  if (responseOverride) {
    try {
      return await parseProvidedResponse(snapshot, responseOverride)
    } catch (error) {
      if (!options.silent) {
        console.warn(`ClaudeMap enrichment override failed: ${error.message}`)
      }
    }
  }

  if (shouldPreferDemoCache(snapshot, options)) {
    try {
      return loadDemoGraph(snapshot)
    } catch (error) {
      if (!options.silent) {
        console.warn(`ClaudeMap demo cache fallback failed: ${error.message}`)
      }
    }
  }

  return createHeuristicGraph(snapshot)
}

export async function enrichSnapshot(snapshot, options = {}) {
  return enrichGraph(snapshot, options)
}

export function getClaudeMapArchitectDefinition() {
  return fs.readFileSync(ARCHITECT_AGENT_PATH, 'utf8')
}
