import path from 'path'

const POSIX_PATH = path.posix
const JS_IMPORTABLE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts']

function sanitizeImportSpecifier(importPath) {
  return String(importPath || '')
    .trim()
    .split(/\s+/)[0]
}

function resolveRelativeJSImport(sourceFile, importPath, fileByPath) {
  if (!importPath.startsWith('.')) {
    return null
  }

  const sourceDirectory = sourceFile.directory || '.'
  const baseCandidate = POSIX_PATH.normalize(POSIX_PATH.join(sourceDirectory, importPath))
  const candidatePaths = [baseCandidate]

  for (const extension of JS_IMPORTABLE_EXTENSIONS) {
    candidatePaths.push(`${baseCandidate}${extension}`)
    candidatePaths.push(POSIX_PATH.join(baseCandidate, `index${extension}`))
  }

  return candidatePaths.find((candidate) => fileByPath.has(candidate)) || null
}

function resolvePythonModuleImport(sourceFile, importPath, fileByPath) {
  const sanitizedImportPath = sanitizeImportSpecifier(importPath)

  if (!sanitizedImportPath) {
    return null
  }

  const relativeMatch = sanitizedImportPath.match(/^(\.+)(.*)$/)
  const sourceDirectorySegments = (sourceFile.directory || '').split('/').filter(Boolean)
  let moduleSegments

  if (relativeMatch) {
    const leadingDots = relativeMatch[1].length
    const remainder = relativeMatch[2]
    const parentDepth = Math.max(leadingDots - 1, 0)
    const baseSegments = sourceDirectorySegments.slice(
      0,
      Math.max(0, sourceDirectorySegments.length - parentDepth),
    )

    moduleSegments = [...baseSegments, ...remainder.split('.').filter(Boolean)]
  } else {
    moduleSegments = sanitizedImportPath.split('.').filter(Boolean)
  }

  if (moduleSegments.length === 0) {
    return null
  }

  const baseCandidate = POSIX_PATH.normalize(moduleSegments.join('/'))
  const candidatePaths = [
    `${baseCandidate}.py`,
    POSIX_PATH.join(baseCandidate, '__init__.py'),
  ]

  return candidatePaths.find((candidate) => fileByPath.has(candidate)) || null
}

export function resolveImportPath(sourceFile, importPath, fileByPath) {
  if (!sourceFile || !fileByPath) {
    return null
  }

  if (sourceFile.language === 'python') {
    return resolvePythonModuleImport(sourceFile, importPath, fileByPath)
  }

  return resolveRelativeJSImport(sourceFile, sanitizeImportSpecifier(importPath), fileByPath)
}

export function createSystemImportEdges(files, systemIdByFilePath) {
  const normalizedFiles = Array.isArray(files) ? files : []
  const fileByPath = new Map(
    normalizedFiles
      .map((file) => [file.relativePath || file.path, file])
      .filter(([relativePath]) => typeof relativePath === 'string' && relativePath.length > 0),
  )
  const edgeIds = new Set()
  const edges = []

  for (const sourceFile of normalizedFiles) {
    const sourcePath = sourceFile.relativePath || sourceFile.path
    const sourceSystemId = systemIdByFilePath.get(sourcePath)

    if (!sourcePath || !sourceSystemId) {
      continue
    }

    for (const importPath of sourceFile.imports || []) {
      const targetPath = resolveImportPath(sourceFile, importPath, fileByPath)
      const targetSystemId = targetPath ? systemIdByFilePath.get(targetPath) : null

      if (!targetSystemId || targetSystemId === sourceSystemId) {
        continue
      }

      const edgeId = `edge-${sourceSystemId}-${targetSystemId}`

      if (edgeIds.has(edgeId)) {
        continue
      }

      edgeIds.add(edgeId)
      edges.push({
        id: edgeId,
        source: sourceSystemId,
        target: targetSystemId,
        type: 'imports',
      })
    }
  }

  return edges.sort((left, right) => left.id.localeCompare(right.id))
}
