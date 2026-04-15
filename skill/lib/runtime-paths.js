import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const RUNTIME_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)))
const RUNTIME_PUBLIC_ROOT = path.join(RUNTIME_ROOT, 'app', 'public')
const MANIFEST_FILE_NAME = 'claudemap-maps.json'

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
  return normalizePathSegments(runtimeRoot).endsWith('/.claude/skills/claudemap-runtime')
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
  return path.join(projectRoot, MANIFEST_FILE_NAME)
}

export function getRuntimeManifestPath() {
  return path.join(RUNTIME_PUBLIC_ROOT, MANIFEST_FILE_NAME)
}

export function readJsonFile(filePath, fallbackFactory = null) {
  if (!fs.existsSync(filePath)) {
    return typeof fallbackFactory === 'function' ? fallbackFactory() : null
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return typeof fallbackFactory === 'function' ? fallbackFactory() : null
  }
}

export function writeJsonFileAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`

  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2))
  fs.renameSync(tempPath, filePath)
}
