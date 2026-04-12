import fs from 'fs'
import path from 'path'

const CACHE_FILE_NAME = 'claudemap-cache.json'
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

export function getCachePath(projectRoot) {
  return path.join(projectRoot, CACHE_FILE_NAME)
}

export function writeCache(projectRoot, graphData, currentFiles = []) {
  const cachePath = getCachePath(projectRoot)
  const cachePayload = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    fileCount: currentFiles.length || graphData.nodes.filter((node) => node.type === 'file').length,
    files: normalizeFileList(currentFiles),
    graph: graphData,
  }

  fs.writeFileSync(cachePath, JSON.stringify(cachePayload, null, 2))
  return cachePayload
}

export function readCache(projectRoot) {
  const cachePath = getCachePath(projectRoot)

  if (!fs.existsSync(cachePath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'))
  } catch {
    return null
  }
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
