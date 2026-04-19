import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { MAPS_MANIFEST_FILENAME, RUNTIME_INSTALLED_PATH_SUFFIX } from './contracts/paths.js'
import { validateWithWarning } from './contracts/schemas/index.js'

const RUNTIME_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)))
const RUNTIME_PUBLIC_ROOT = path.join(RUNTIME_ROOT, 'app', 'public')

function normalizePathSegments(filePath) {
  return filePath.split(path.sep).join('/')
}

function ensurePathWithin(rootPath, targetPath, label) {
  const relativePath = path.relative(rootPath, targetPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`${label} resolves outside the allowed root: ${targetPath}`)
  }

  return targetPath
}

export function getRuntimeRoot() {
  return RUNTIME_ROOT
}

export function getRuntimePublicRoot() {
  return RUNTIME_PUBLIC_ROOT
}

export function isInstalledRuntimeRoot(runtimeRoot = RUNTIME_ROOT) {
  return normalizePathSegments(runtimeRoot).endsWith(RUNTIME_INSTALLED_PATH_SUFFIX)
}

export function getDefaultProjectRoot() {
  if (isInstalledRuntimeRoot()) {
    return path.resolve(RUNTIME_ROOT, '../../..')
  }

  return RUNTIME_ROOT
}

export function resolveProjectPath(projectRoot, relativePath, fallbackName) {
  const normalizedRelativePath = relativePath || fallbackName
  return ensurePathWithin(
    projectRoot,
    path.resolve(projectRoot, normalizedRelativePath),
    `Project path "${normalizedRelativePath}"`,
  )
}

export function resolveRuntimePublicPath(relativePath, fallbackName) {
  const normalizedRelativePath = relativePath || fallbackName
  return ensurePathWithin(
    RUNTIME_PUBLIC_ROOT,
    path.resolve(RUNTIME_PUBLIC_ROOT, normalizedRelativePath),
    `Runtime public path "${normalizedRelativePath}"`,
  )
}

export function getProjectManifestPath(projectRoot) {
  return path.join(projectRoot, MAPS_MANIFEST_FILENAME)
}

export function getRuntimeManifestPath() {
  return path.join(RUNTIME_PUBLIC_ROOT, MAPS_MANIFEST_FILENAME)
}

export function readJsonFile(filePath, fallbackFactory = null, options = {}) {
  if (!fs.existsSync(filePath)) {
    return typeof fallbackFactory === 'function' ? fallbackFactory() : null
  }

  let parsed = null
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return typeof fallbackFactory === 'function' ? fallbackFactory() : null
  }

  if (options.schema) {
    validateWithWarning(options.schema, parsed, { filePath })
  }

  return parsed
}

export function writeJsonFileAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`

  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2))
  fs.renameSync(tempPath, filePath)
}
