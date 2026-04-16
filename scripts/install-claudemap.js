#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '..')
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, 'artifacts', 'claudemap-skill')
const ARTIFACT_NAME = 'claudemap'
const DEFAULT_ARTIFACT_ROOT = path.join(DEFAULT_OUTPUT_ROOT, ARTIFACT_NAME)
const MANIFEST_NAME = 'claudemap-artifact.json'
const CLAUDE_ROOT = '.claude'
const INSTALL_RECORD_NAME = 'claudemap-install.json'
const RUNTIME_ROOT = path.join(CLAUDE_ROOT, 'skills', 'claudemap-runtime')
const DEFAULT_MANAGED_PATHS = [
  path.join(CLAUDE_ROOT, 'skills', 'claudemap-runtime'),
  path.join(CLAUDE_ROOT, 'agents', 'claudemap-architect.md'),
  path.join(CLAUDE_ROOT, 'commands', 'setup-claudemap.md'),
  path.join(CLAUDE_ROOT, 'commands', 'open-claudemap.md'),
  path.join(CLAUDE_ROOT, 'commands', 'create-map.md'),
  path.join(CLAUDE_ROOT, 'commands', 'refresh.md'),
  path.join(CLAUDE_ROOT, 'commands', 'show.md'),
  path.join(CLAUDE_ROOT, 'commands', 'explain.md'),
  path.join(CLAUDE_ROOT, INSTALL_RECORD_NAME),
]
const PROJECT_GENERATED_FILE_PATTERNS = [
  /^claudemap-cache(?:\.[^/\\]+)?\.json$/,
  /^claudemap-maps\.json$/,
  /^\.claudemap-refresh\.lock$/,
]
const EMPTY_DIRECTORY_CLEANUP_ORDER = [
  path.join(CLAUDE_ROOT, 'commands'),
  path.join(CLAUDE_ROOT, 'agents'),
  path.join(CLAUDE_ROOT, 'skills'),
  CLAUDE_ROOT,
]

function printUsage() {
  console.log('ClaudeMap installer')
  console.log(
    '  node scripts/install-claudemap.js <target-repo> [--update|--clean] [--artifact <dir>] [--skip-package] [--skip-install] [--dry-run]',
  )
}

function parseArgs(argv) {
  const options = {
    artifactRoot: DEFAULT_ARTIFACT_ROOT,
    buildArtifact: true,
    dryRun: false,
    installDependencies: true,
    mode: 'install',
    targetRoot: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--help' || argument === '-h') {
      options.help = true
      continue
    }

    if (argument === '--update') {
      options.mode = 'update'
      continue
    }

    if (argument === '--clean' || argument === '--uninstall') {
      options.mode = 'clean'
      options.buildArtifact = false
      options.installDependencies = false
      continue
    }

    if (argument === '--artifact') {
      const nextValue = argv[index + 1]

      if (!nextValue) {
        throw new Error('Missing value for --artifact')
      }

      options.artifactRoot = path.resolve(nextValue)
      options.buildArtifact = false
      index += 1
      continue
    }

    if (argument === '--skip-package') {
      options.buildArtifact = false
      continue
    }

    if (argument === '--skip-install') {
      options.installDependencies = false
      continue
    }

    if (argument === '--dry-run') {
      options.dryRun = true
      options.installDependencies = false
      continue
    }

    if (argument.startsWith('--')) {
      throw new Error(`Unknown argument: ${argument}`)
    }

    if (options.targetRoot) {
      throw new Error('Only one target repository path can be provided')
    }

    options.targetRoot = path.resolve(argument)
  }

  if (!options.help && !options.targetRoot) {
    throw new Error('Missing target repository path')
  }

  return options
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function ensureDirectory(filePath) {
  fs.mkdirSync(filePath, { recursive: true })
}

function ensureTargetRepository(targetRoot) {
  if (!fs.existsSync(targetRoot)) {
    throw new Error(`Target repository does not exist: ${targetRoot}`)
  }

  const stat = fs.statSync(targetRoot)

  if (!stat.isDirectory()) {
    throw new Error(`Target repository is not a directory: ${targetRoot}`)
  }
}

function getNodeCommand() {
  return process.execPath
}

function getNpmCommand() {
  return 'npm'
}

function runCommand(command, args, workingDirectory, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workingDirectory,
    shell: options.shell || false,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`)
  }
}

function buildArtifactIfNeeded(options) {
  if (options.mode === 'clean') {
    return
  }

  if (!options.buildArtifact || options.dryRun) {
    return
  }

  const packageScriptPath = path.join(REPO_ROOT, 'scripts', 'package-claudemap-skill.js')
  runCommand(getNodeCommand(), [packageScriptPath, '--output', DEFAULT_OUTPUT_ROOT], REPO_ROOT)
}

function loadArtifactManifest(artifactRoot) {
  const manifestPath = path.join(artifactRoot, MANIFEST_NAME)

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`ClaudeMap artifact manifest not found: ${manifestPath}`)
  }

  return readJsonFile(manifestPath)
}

function readInstallRecord(targetRoot) {
  const recordPath = path.join(targetRoot, CLAUDE_ROOT, INSTALL_RECORD_NAME)

  if (!fs.existsSync(recordPath)) {
    return null
  }

  try {
    return readJsonFile(recordPath)
  } catch {
    return null
  }
}

function resolveManagedPath(targetRoot, relativeManagedPath) {
  const normalizedManagedPath = relativeManagedPath.replace(/\//g, path.sep)
  const absolutePath = path.resolve(targetRoot, normalizedManagedPath)
  const relativeFromTarget = path.relative(targetRoot, absolutePath)

  if (
    relativeFromTarget.startsWith('..') ||
    path.isAbsolute(relativeFromTarget)
  ) {
    throw new Error(`Managed path resolves outside the target repository: ${relativeManagedPath}`)
  }

  return absolutePath
}

function removeManagedPaths(targetRoot, managedPaths, dryRun) {
  if (!Array.isArray(managedPaths)) {
    return []
  }

  const removedPaths = []

  for (const managedPath of managedPaths) {
    const absoluteManagedPath = resolveManagedPath(targetRoot, managedPath)

    if (!fs.existsSync(absoluteManagedPath)) {
      continue
    }

    removedPaths.push(managedPath)

    if (!dryRun) {
      fs.rmSync(absoluteManagedPath, {
        force: true,
        recursive: true,
      })
    }
  }

  return removedPaths
}

function installArtifact(artifactRoot, targetRoot, dryRun) {
  const sourceClaudeRoot = path.join(artifactRoot, CLAUDE_ROOT)
  const targetClaudeRoot = path.join(targetRoot, CLAUDE_ROOT)

  if (!fs.existsSync(sourceClaudeRoot)) {
    throw new Error(`ClaudeMap artifact is missing ${CLAUDE_ROOT}: ${sourceClaudeRoot}`)
  }

  if (dryRun) {
    return {
      createdClaudeDir: !fs.existsSync(targetClaudeRoot),
      targetClaudeRoot,
    }
  }

  ensureDirectory(targetClaudeRoot)
  fs.cpSync(sourceClaudeRoot, targetClaudeRoot, {
    force: true,
    recursive: true,
  })

  return {
    createdClaudeDir: false,
    targetClaudeRoot,
  }
}

function writeInstallRecord(targetRoot, manifest, artifactRoot, mode, dryRun) {
  const recordPath = path.join(targetRoot, CLAUDE_ROOT, INSTALL_RECORD_NAME)
  const record = {
    artifact: manifest.name,
    artifactVersion: manifest.version || 'unknown',
    artifactRoot: artifactRoot,
    generatedAt: manifest.generatedAt || null,
    installedAt: new Date().toISOString(),
    managedPaths: manifest.managedPaths || [],
    mode,
    publicCommands: manifest.publicCommands || [],
  }

  if (dryRun) {
    return recordPath
  }

  fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
  return recordPath
}

function installDependencies(targetRoot, dryRun) {
  const runtimeInstallRoot = path.join(targetRoot, RUNTIME_ROOT)
  const runtimePackageJson = path.join(runtimeInstallRoot, 'package.json')

  if (!fs.existsSync(runtimePackageJson)) {
    throw new Error(`Installed runtime is missing package.json: ${runtimePackageJson}`)
  }

  if (dryRun) {
    return runtimeInstallRoot
  }

  runCommand(getNpmCommand(), ['install'], runtimeInstallRoot, {
    shell: process.platform === 'win32',
  })
  return runtimeInstallRoot
}

function normalizeManagedPathList(managedPaths) {
  return (Array.isArray(managedPaths) ? managedPaths : DEFAULT_MANAGED_PATHS).map((managedPath) =>
    String(managedPath || '').replace(/\\/g, '/'),
  )
}

function loadArtifactManifestIfPresent(artifactRoot) {
  if (!artifactRoot) {
    return null
  }

  const manifestPath = path.join(artifactRoot, MANIFEST_NAME)

  if (!fs.existsSync(manifestPath)) {
    return null
  }

  return readJsonFile(manifestPath)
}

function collectGeneratedProjectPaths(targetRoot) {
  const generatedPaths = new Set()
  const manifestPath = path.join(targetRoot, 'claudemap-maps.json')

  if (fs.existsSync(manifestPath)) {
    generatedPaths.add('claudemap-maps.json')

    try {
      const manifest = readJsonFile(manifestPath)

      if (Array.isArray(manifest?.maps)) {
        for (const mapEntry of manifest.maps) {
          if (typeof mapEntry?.cachePath === 'string' && mapEntry.cachePath.trim()) {
            generatedPaths.add(mapEntry.cachePath.replace(/\\/g, '/'))
          }
        }
      }
    } catch {}
  }

  for (const entryName of fs.readdirSync(targetRoot)) {
    if (PROJECT_GENERATED_FILE_PATTERNS.some((pattern) => pattern.test(entryName))) {
      generatedPaths.add(entryName)
    }
  }

  return [...generatedPaths]
}

function removeEmptyDirectories(targetRoot, dryRun) {
  const removedPaths = []

  for (const relativeDirectoryPath of EMPTY_DIRECTORY_CLEANUP_ORDER) {
    const absoluteDirectoryPath = resolveManagedPath(targetRoot, relativeDirectoryPath)

    if (!fs.existsSync(absoluteDirectoryPath)) {
      continue
    }

    const stats = fs.statSync(absoluteDirectoryPath)

    if (!stats.isDirectory()) {
      continue
    }

    if (fs.readdirSync(absoluteDirectoryPath).length > 0) {
      continue
    }

    removedPaths.push(relativeDirectoryPath.replace(/\\/g, '/'))

    if (!dryRun) {
      fs.rmdirSync(absoluteDirectoryPath)
    }
  }

  return removedPaths
}

function installClaudeMap(options) {
  ensureTargetRepository(options.targetRoot)
  buildArtifactIfNeeded(options)

  const manifest = loadArtifactManifest(options.artifactRoot)
  const previousInstallRecord = readInstallRecord(options.targetRoot)
  const removedManagedPaths = previousInstallRecord
    ? removeManagedPaths(options.targetRoot, previousInstallRecord.managedPaths, options.dryRun)
    : []
  const installState = installArtifact(options.artifactRoot, options.targetRoot, options.dryRun)
  const recordPath = writeInstallRecord(
    options.targetRoot,
    manifest,
    options.artifactRoot,
    options.mode,
    options.dryRun,
  )

  let runtimeInstallRoot = null

  if (options.installDependencies) {
    runtimeInstallRoot = installDependencies(options.targetRoot, options.dryRun)
  }

  const actionLabel = options.mode === 'update' ? 'updated' : 'installed'
  console.log(
    `ClaudeMap ${actionLabel} into ${options.targetRoot}`,
  )
  console.log(`Artifact version: ${manifest.version || 'unknown'}`)
  console.log(`Merged into: ${installState.targetClaudeRoot}`)
  console.log(`Install record: ${recordPath}`)
  if (removedManagedPaths.length > 0) {
    console.log(`Replaced managed paths: ${removedManagedPaths.join(', ')}`)
  }

  if (options.dryRun) {
    console.log('Dry run only: no files were copied and npm install was skipped')
  } else if (runtimeInstallRoot) {
    console.log(`Dependencies installed in ${runtimeInstallRoot}`)
  } else {
    console.log('Skipped npm install for the bundled runtime')
  }

  console.log(`Public commands: ${(manifest.publicCommands || []).join(', ')}`)

  return {
    installState,
    manifest,
    recordPath,
    removedManagedPaths,
    runtimeInstallRoot,
  }
}

function cleanClaudeMap(options) {
  ensureTargetRepository(options.targetRoot)

  const previousInstallRecord = readInstallRecord(options.targetRoot)
  const artifactManifest = loadArtifactManifestIfPresent(options.artifactRoot)
  const managedPaths = normalizeManagedPathList(
    previousInstallRecord?.managedPaths || artifactManifest?.managedPaths || DEFAULT_MANAGED_PATHS,
  )
  const generatedProjectPaths = collectGeneratedProjectPaths(options.targetRoot)
  const removedManagedPaths = removeManagedPaths(
    options.targetRoot,
    managedPaths,
    options.dryRun,
  )
  const removedGeneratedPaths = removeManagedPaths(
    options.targetRoot,
    generatedProjectPaths,
    options.dryRun,
  )
  const removedEmptyDirectories = removeEmptyDirectories(options.targetRoot, options.dryRun)
  const removedPaths = [
    ...removedManagedPaths,
    ...removedGeneratedPaths,
    ...removedEmptyDirectories,
  ]

  console.log(`ClaudeMap cleaned from ${options.targetRoot}`)
  if (removedPaths.length === 0) {
    console.log('No ClaudeMap-managed files were found')
  } else {
    console.log(`Removed paths: ${removedPaths.join(', ')}`)
  }

  if (options.dryRun) {
    console.log('Dry run only: no files were removed')
  }

  return {
    removedManagedPaths,
    removedGeneratedPaths,
    removedEmptyDirectories,
    removedPaths,
  }
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)

  if (options.help) {
    printUsage()
    return
  }

  if (options.mode === 'clean') {
    cleanClaudeMap(options)
    return
  }

  installClaudeMap(options)
}

module.exports = {
  cleanClaudeMap,
  installClaudeMap,
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`ClaudeMap install failed: ${error.message}`)
    process.exitCode = 1
  }
}
