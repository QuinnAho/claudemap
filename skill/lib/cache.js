import { CACHE_FILENAME } from './contracts/paths.js'
import { SCHEMA_NAMES } from './contracts/schemas/index.js'
import { readJsonFile, resolveProjectPath, writeJsonFileAtomic } from './runtime-paths.js'

const CACHE_SCHEMA_VERSION = 1

function normalizeFileList(files) {
  return files.map((file) => ({
    path: file.path,
    relativePath: file.relativePath,
    name: file.name,
    directory: file.directory,
    lineCount: file.lineCount,
    language: file.language,
    mtimeMs: file.mtimeMs,
    imports: file.imports,
    exports: file.exports,
  }))
}

export function getCachePath(projectRoot, relativePath = CACHE_FILENAME) {
  return resolveProjectPath(projectRoot, relativePath, CACHE_FILENAME)
}

export function writeCache(projectRoot, graphData, currentFiles = [], options = {}) {
  const cachePath = getCachePath(projectRoot, options.relativePath)
  const cachePayload = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    fileCount: currentFiles.length || graphData.nodes.filter((node) => node.type === 'file').length,
    files: normalizeFileList(currentFiles),
    graph: graphData,
  }

  writeJsonFileAtomic(cachePath, cachePayload)
  return cachePayload
}

export function readCache(projectRoot, options = {}) {
  const cachePath = getCachePath(projectRoot, options.relativePath)
  return readJsonFile(cachePath, () => null, { schema: SCHEMA_NAMES.CACHE })
}

export function isCacheStale(projectRoot, currentFileList, cache = readCache(projectRoot)) {
  if (!cache) {
    return true
  }

  const cachedFiles = Array.isArray(cache.files) ? cache.files : []

  if (cachedFiles.length !== currentFileList.length) {
    return true
  }

  const cachedFileMap = new Map(cachedFiles.map((file) => [file.path, file]))

  for (const file of currentFileList) {
    const cachedFile = cachedFileMap.get(file.path)

    if (!cachedFile) {
      return true
    }

    if (
      typeof file.mtimeMs === 'number' &&
      typeof cachedFile.mtimeMs === 'number' &&
      file.mtimeMs !== cachedFile.mtimeMs
    ) {
      return true
    }

    if (file.lineCount !== cachedFile.lineCount) {
      return true
    }
  }

  return false
}
