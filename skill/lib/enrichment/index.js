import fs from 'fs'
import path from 'path'
import { GRAPH_SOURCES } from '../contracts/graph-sources.js'
import { createSystemImportEdges } from '../import-resolution.js'
import { parseGraphResponse, validateGraph } from './graph-validation.js'
import { assessFileHealth, assessSystemHealth } from './health.js'
import { iconForSystem } from './icons.js'
import { buildPrompt } from './prompts.js'

// index composes the five enrichment concerns into the public API the
// skill commands consume. Everything the commands see lives here or is
// re-exported from here; the submodules are not imported by external
// callers and have no intrinsic ordering beyond "index pulls them in".
//
// The module still owns two things itself because they are the glue
// between concerns:
//   - createHeuristicGraph: walks the snapshot, groups files by a
//     directory-based system key, calls icons + health for each system
//     and file, and hands the edge list off to import-resolution.
//   - enrichGraph / enrichSnapshot / enrichScopedGraph: the three
//     orchestrators that decide whether to parse an override or fall
//     back to the heuristic builder.

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

function normalizeGraphMeta(snapshot, graph, source) {
  return {
    ...graph,
    meta: {
      ...(graph.meta || {}),
      repoName: snapshot.repoName,
      branch: graph.meta?.branch || snapshot.branch || 'workspace',
      creditLabel: graph.meta?.creditLabel || 'ClaudeMap skill',
      generatedAt: snapshot.generatedAt,
      source,
    },
    files: snapshot.files,
  }
}

function summaryForSystem(key, files) {
  const topLanguages = unique(files.map((file) => file.language))
  const label = key === 'root' ? 'root files' : `${titleCase(key)} code`

  if (topLanguages.length === 1) {
    return `${label} in ${topLanguages[0]}`
  }

  return `${label} across ${files.length} files`
}

function estimateFunctionLineCount(file, exportCount) {
  if (!exportCount) {
    return Math.min(file.lineCount, 20)
  }

  return Math.max(8, Math.floor(file.lineCount / Math.min(exportCount, 5)))
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
  const systemIdByFilePath = new Map()

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

  const edges = createSystemImportEdges(snapshot.files, systemIdByFilePath)

  return validateGraph({
    meta: {
      repoName: snapshot.repoName,
      branch: snapshot.branch || 'workspace',
      creditLabel: 'ClaudeMap skill',
      generatedAt: snapshot.generatedAt,
      source: GRAPH_SOURCES.HEURISTIC,
    },
    nodes: [...systemNodes, ...fileNodes, ...functionNodes],
    edges,
    files: snapshot.files,
  })
}

async function parseProvidedResponse(snapshot, responseText) {
  const graph = parseGraphResponse(responseText)
  return normalizeGraphMeta(snapshot, graph, GRAPH_SOURCES.CLAUDE)
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

export function hasEnrichmentResponseOverride(options = {}) {
  if (typeof options.responseText === 'string' && options.responseText.trim()) {
    return true
  }

  return Boolean(readResponseOverride())
}

export async function enrichGraph(snapshot, options = {}) {
  const fullPrompt = buildPrompt(snapshot)
  void fullPrompt

  const responseOverride = options.responseText || readResponseOverride()

  if (responseOverride) {
    try {
      return await parseProvidedResponse(snapshot, responseOverride)
    } catch (error) {
      if (options.strict) {
        throw new Error(
          `ClaudeMap enrichment override failed to parse: ${error.message}. Refusing to fall back to the heuristic graph because an explicit enrichment input was provided.`,
        )
      }

      if (!options.silent) {
        console.warn(`ClaudeMap enrichment override failed: ${error.message}`)
      }
    }
  }

  return createHeuristicGraph(snapshot)
}

export async function enrichSnapshot(snapshot, options = {}) {
  return enrichGraph(snapshot, options)
}

export async function enrichScopedGraph(scopedSnapshot, options = {}) {
  const responseText = options.responseText
  const strict = options.strict !== false

  if (!responseText) {
    if (strict) {
      throw new Error(
        'Scoped enrichment requires @claudemap-architect output. Pass responseText or --enrichment-file.',
      )
    }

    return null
  }

  const graph = parseGraphResponse(responseText)
  return {
    ...graph,
    meta: {
      ...(graph.meta || {}),
      repoName: scopedSnapshot.repoName,
      branch: graph.meta?.branch || scopedSnapshot.branch || 'workspace',
      creditLabel: graph.meta?.creditLabel || 'ClaudeMap skill',
      generatedAt: scopedSnapshot.generatedAt || new Date().toISOString(),
      source: GRAPH_SOURCES.CLAUDE_SCOPED,
      scope: scopedSnapshot.scope || null,
    },
    files: scopedSnapshot.files,
  }
}

export {
  getClaudeMapArchitectDefinition,
  getRootEnrichmentPrompt,
  getScopedEnrichmentPrompt,
} from './prompts.js'
export {
  getGraphSourcePriority,
  selectPreferredGraph,
  shouldPreserveExistingGraph,
} from './source-priority.js'
