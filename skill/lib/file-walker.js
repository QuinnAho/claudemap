import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { CACHE_FILENAME } from './contracts/paths.js'

const branchCache = new Map()

const SKIPPED_DIRECTORY_NAMES = new Set([
  '.git',
  '.next',
  '__pycache__',
  'build',
  'dist',
  'node_modules',
])

const SKIPPED_FILE_NAMES = new Set([
  '.env',
  '.gitignore',
  CACHE_FILENAME,
  'package-lock.json',
  'yarn.lock',
])

const SKIPPED_EXTENSIONS = new Set([
  '.class',
  '.gif',
  '.gz',
  '.ico',
  '.jpeg',
  '.jpg',
  '.png',
  '.pyc',
  '.svg',
  '.tar',
  '.ttf',
  '.woff',
  '.woff2',
  '.zip',
])

const LANGUAGE_BY_EXTENSION = new Map([
  ['.cjs', 'javascript'],
  ['.cts', 'typescript'],
  ['.js', 'javascript'],
  ['.jsx', 'javascript'],
  ['.mjs', 'javascript'],
  ['.mts', 'typescript'],
  ['.py', 'python'],
  ['.ts', 'typescript'],
  ['.tsx', 'typescript'],
])

const JS_LIKE_LANGUAGES = new Set(['javascript', 'typescript'])

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/')
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))]
}

function shouldSkipDirectory(entryName) {
  return entryName.startsWith('.') || SKIPPED_DIRECTORY_NAMES.has(entryName)
}

function shouldSkipFile(entryName, extension) {
  if (entryName.startsWith('.') && !LANGUAGE_BY_EXTENSION.has(extension)) {
    return true
  }

  if (SKIPPED_FILE_NAMES.has(entryName)) {
    return true
  }

  if (SKIPPED_EXTENSIONS.has(extension)) {
    return true
  }

  return !LANGUAGE_BY_EXTENSION.has(extension)
}

function appendMatches(values, content, expression, extractor = (match) => match[1]) {
  for (const match of content.matchAll(expression)) {
    const result = extractor(match)

    if (Array.isArray(result)) {
      values.push(...result)
    } else if (result) {
      values.push(result)
    }
  }
}

function extractJSImports(content) {
  const imports = []

  appendMatches(imports, content, /import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g)
  appendMatches(imports, content, /import\s+['"]([^'"]+)['"]/g)
  appendMatches(imports, content, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g)
  appendMatches(imports, content, /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)

  return dedupe(imports)
}

function extractPythonImports(content) {
  const imports = []

  appendMatches(imports, content, /^\s*from\s+([A-Za-z0-9_.]+)\s+import\s+/gm)
  appendMatches(imports, content, /^\s*import\s+([A-Za-z0-9_.,\s]+)$/gm, (match) =>
    match[1]
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => value.split(/\s+as\s+/i)[0]),
  )

  return dedupe(imports)
}

function parseExportList(value) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split(/\s+as\s+/i)[0].trim())
    .map((entry) => entry.split(':')[0].trim())
    .filter(Boolean)
}

function extractJSExports(content) {
  const exportNames = []

  appendMatches(exportNames, content, /^\s*export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)
  appendMatches(exportNames, content, /^\s*export\s+class\s+([A-Za-z0-9_$]+)/gm)
  appendMatches(exportNames, content, /^\s*export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/gm)
  appendMatches(exportNames, content, /^\s*export\s+\{([^}]+)\}/gm, (match) => parseExportList(match[1]))
  appendMatches(
    exportNames,
    content,
    /^\s*export\s+default(?:\s+(?:async\s+)?(?:function|class))?\s*([A-Za-z0-9_$]+)?/gm,
    (match) => match[1] || 'default',
  )
  appendMatches(
    exportNames,
    content,
    /module\.exports\s*=\s*\{([^}]+)\}/g,
    (match) => parseExportList(match[1]),
  )
  appendMatches(exportNames, content, /^\s*module\.exports\.([A-Za-z0-9_$]+)/gm)
  appendMatches(exportNames, content, /^\s*exports\.([A-Za-z0-9_$]+)/gm)

  for (const match of content.matchAll(/module\.exports\s*=\s*([A-Za-z0-9_$]+)/g)) {
    if (match[1] && match[1] !== 'module') {
      exportNames.push(match[1])
    }
  }

  return dedupe(exportNames)
}

function extractImports(content, language) {
  if (JS_LIKE_LANGUAGES.has(language)) {
    return extractJSImports(content)
  }

  if (language === 'python') {
    return extractPythonImports(content)
  }

  return []
}

function extractExports(content, language) {
  if (!JS_LIKE_LANGUAGES.has(language)) {
    return []
  }

  return extractJSExports(content)
}

function readFileRecord(rootDir, absolutePath, name) {
  const extension = path.extname(name).toLowerCase()

  if (shouldSkipFile(name, extension)) {
    return null
  }

  let stats

  try {
    stats = fs.statSync(absolutePath)
  } catch {
    return null
  }

  if (!stats.isFile()) {
    return null
  }

  let content

  try {
    content = fs.readFileSync(absolutePath, 'utf8')
  } catch {
    return null
  }

  const relativePath = normalizePath(path.relative(rootDir, absolutePath))
  const directoryName = normalizePath(path.dirname(relativePath))
  const language = LANGUAGE_BY_EXTENSION.get(extension)

  return {
    path: relativePath,
    relativePath,
    name,
    directory: directoryName === '.' ? '' : directoryName,
    lineCount: content.split('\n').length,
    imports: extractImports(content, language),
    exports: extractExports(content, language),
    language,
    mtimeMs: stats.mtimeMs,
  }
}

function walkDirectory(rootDir, absoluteDir, files) {
  let entries

  try {
    entries = fs.readdirSync(absoluteDir, { withFileTypes: true })
  } catch {
    return
  }

  entries.sort((left, right) => left.name.localeCompare(right.name))

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue
    }

    const absolutePath = path.join(absoluteDir, entry.name)

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue
      }

      walkDirectory(rootDir, absolutePath, files)
      continue
    }

    const fileRecord = readFileRecord(rootDir, absolutePath, entry.name)

    if (fileRecord) {
      files.push(fileRecord)
    }
  }
}

export function collectProjectSnapshot(rootDir) {
  const resolvedRoot = path.resolve(rootDir)
  const files = []

  walkDirectory(resolvedRoot, resolvedRoot, files)
  files.sort((left, right) => left.path.localeCompare(right.path))

  return {
    repoRoot: resolvedRoot,
    repoName: path.basename(resolvedRoot),
    branch: resolveGitBranchLabel(resolvedRoot),
    generatedAt: new Date().toISOString(),
    files,
    totalFiles: files.length,
    totalLines: files.reduce((total, file) => total + file.lineCount, 0),
  }
}

function resolveGitBranchLabel(rootDir) {
  if (branchCache.has(rootDir)) {
    return branchCache.get(rootDir)
  }

  let branchLabel = 'workspace'

  try {
    const branchName = execFileSync('git', ['branch', '--show-current'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()

    if (branchName) {
      branchLabel = branchName
    } else {
      const commitSha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()

      if (commitSha) {
        branchLabel = `detached@${commitSha}`
      }
    }
  } catch {
    branchLabel = 'workspace'
  }

  branchCache.set(rootDir, branchLabel)
  return branchLabel
}
