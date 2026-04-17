#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '..')

async function loadPathContracts() {
  return import('../skill/lib/contracts/paths.js')
}

function printUsage() {
  console.log('ClaudeMap installer')
  console.log(
    '  node scripts/install-claudemap.js <target-repo> [--update] [--artifact <dir>] [--skip-package] [--skip-install] [--dry-run]',
  )
}

function parseArgs(argv, defaultArtifactRoot) {
  const options = {
    artifactRoot: defaultArtifactRoot,
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

function buildArtifactIfNeeded(options, defaultOutputRoot) {
  if (!options.buildArtifact || options.dryRun) {
    return
  }

  const packageScriptPath = path.join(REPO_ROOT, 'scripts', 'package-claudemap-skill.js')
  runCommand(getNodeCommand(), [packageScriptPath, '--output', defaultOutputRoot], REPO_ROOT)
}

function loadArtifactManifest(artifactRoot, manifestFilename) {
  const manifestPath = path.join(artifactRoot, manifestFilename)

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`ClaudeMap artifact manifest not found: ${manifestPath}`)
  }

  return readJsonFile(manifestPath)
}

function readInstallRecord(targetRoot, claudeRootDir, installRecordFilename) {
  const recordPath = path.join(targetRoot, claudeRootDir, installRecordFilename)

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

function installArtifact(artifactRoot, targetRoot, dryRun, claudeRootDir) {
  const sourceClaudeRoot = path.join(artifactRoot, claudeRootDir)
  const targetClaudeRoot = path.join(targetRoot, claudeRootDir)

  if (!fs.existsSync(sourceClaudeRoot)) {
    throw new Error(`ClaudeMap artifact is missing ${claudeRootDir}: ${sourceClaudeRoot}`)
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

function writeInstallRecord(targetRoot, manifest, artifactRoot, mode, dryRun, claudeRootDir, installRecordFilename) {
  const recordPath = path.join(targetRoot, claudeRootDir, installRecordFilename)
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

function installDependencies(targetRoot, dryRun, skillRootRel) {
  const runtimeInstallRoot = path.join(targetRoot, skillRootRel)
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

async function installClaudeMap(options) {
  const paths = await loadPathContracts()
  const defaultOutputRoot = path.join(REPO_ROOT, paths.PACKAGE_ARTIFACT_DIR_REL)

  ensureTargetRepository(options.targetRoot)
  buildArtifactIfNeeded(options, defaultOutputRoot)

  const manifest = loadArtifactManifest(options.artifactRoot, paths.ARTIFACT_MANIFEST_FILENAME)
  const previousInstallRecord = readInstallRecord(
    options.targetRoot,
    paths.CLAUDE_ROOT_DIR,
    paths.INSTALL_RECORD_FILENAME,
  )
  const removedManagedPaths = previousInstallRecord
    ? removeManagedPaths(options.targetRoot, previousInstallRecord.managedPaths, options.dryRun)
    : []
  const installState = installArtifact(
    options.artifactRoot,
    options.targetRoot,
    options.dryRun,
    paths.CLAUDE_ROOT_DIR,
  )
  const recordPath = writeInstallRecord(
    options.targetRoot,
    manifest,
    options.artifactRoot,
    options.mode,
    options.dryRun,
    paths.CLAUDE_ROOT_DIR,
    paths.INSTALL_RECORD_FILENAME,
  )

  let runtimeInstallRoot = null

  if (options.installDependencies) {
    runtimeInstallRoot = installDependencies(options.targetRoot, options.dryRun, paths.SKILL_ROOT_REL)
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

async function main(argv = process.argv.slice(2)) {
  const paths = await loadPathContracts()
  const defaultArtifactRoot = path.join(
    REPO_ROOT,
    paths.PACKAGE_ARTIFACT_DIR_REL,
    paths.NPM_BUNDLE_SUBDIR,
  )
  const options = parseArgs(argv, defaultArtifactRoot)

  if (options.help) {
    printUsage()
    return
  }

  await installClaudeMap(options)
}

module.exports = {
  installClaudeMap,
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`ClaudeMap install failed: ${error.message}`)
    process.exitCode = 1
  })
}
