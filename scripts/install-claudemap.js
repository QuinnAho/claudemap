#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '..')

async function loadPathContracts() {
  return import('../skill/lib/contracts/paths.js')
}

async function loadSchemas() {
  return import('../skill/lib/contracts/schemas/index.js')
}

function printUsage() {
  console.log('ClaudeMap installer')
  console.log(
    '  node scripts/install-claudemap.js <target-repo> [--update] [--artifact <dir>] [--skip-package] [--skip-install] [--dry-run] [--force-partial] [--assistant claude|codex|auto] [--force-assistant-switch]',
  )
}

function parseArgs(argv, defaultArtifactRoot) {
  const options = {
    artifactRoot: defaultArtifactRoot,
    buildArtifact: true,
    dryRun: false,
    forcePartial: false,
    installDependencies: true,
    mode: 'install',
    targetRoot: null,
    assistant: 'auto',
    forceAssistantSwitch: false,
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

    if (argument === '--force-partial') {
      options.forcePartial = true
      continue
    }

    if (argument === '--assistant') {
      const nextValue = argv[index + 1]

      if (!nextValue) {
        throw new Error('Missing value for --assistant')
      }

      if (!['claude', 'codex', 'auto'].includes(nextValue)) {
        throw new Error(`Invalid --assistant value: ${nextValue}. Valid: claude, codex, auto`)
      }

      options.assistant = nextValue
      index += 1
      continue
    }

    if (argument === '--force-assistant-switch') {
      options.forceAssistantSwitch = true
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

// Resolve the directory name the packager writes to for a given
// assistant. Claude artifacts land at {outputRoot}/{NPM_BUNDLE_SUBDIR}
// and Codex artifacts at {outputRoot}/{NPM_BUNDLE_SUBDIR}-codex.
function resolveFlavorArtifactRoot(paths, outputRoot, assistantType) {
  const suffix = assistantType === 'codex' ? '-codex' : ''
  return path.join(outputRoot, `${paths.NPM_BUNDLE_SUBDIR}${suffix}`)
}

// Build the artifact and point options.artifactRoot at the flavor-aware
// directory the packager actually wrote to. Without this, --assistant
// codex without --artifact reads a stale Claude manifest from
// {outputRoot}/claudemap/ and fails the manifest/assistant guard.
function buildArtifactIfNeeded(options, defaultOutputRoot, paths) {
  if (!options.buildArtifact || options.dryRun) {
    return
  }

  const packageScriptPath = path.join(REPO_ROOT, 'scripts', 'package-claudemap-skill.js')
  const assistantArg = options.assistant && options.assistant !== 'auto' ? options.assistant : 'claude'
  runCommand(
    getNodeCommand(),
    [packageScriptPath, '--output', defaultOutputRoot, '--assistant', assistantArg],
    REPO_ROOT,
  )
  options.artifactRoot = resolveFlavorArtifactRoot(paths, defaultOutputRoot, assistantArg)
}

function loadArtifactManifest(artifactRoot, manifestFilename) {
  const manifestPath = path.join(artifactRoot, manifestFilename)

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`ClaudeMap artifact manifest not found: ${manifestPath}`)
  }

  return readJsonFile(manifestPath)
}

// Reconcile --assistant (possibly 'auto'), the manifest's assistant field,
// and any existing install record on the target. Returns a concrete
// assistant type ('claude' or 'codex') or throws on conflict.
function resolveInstallAssistant(options, manifest, paths, existingAssistant) {
  const manifestAssistant = manifest.assistant || 'claude'

  if (!['claude', 'codex'].includes(manifestAssistant)) {
    throw new Error(`Artifact manifest has invalid assistant: ${manifestAssistant}`)
  }

  // If the user passed an explicit --assistant, it must match the manifest.
  if (options.assistant !== 'auto' && options.assistant !== manifestAssistant) {
    throw new Error(
      `--assistant ${options.assistant} does not match artifact manifest assistant: ${manifestAssistant}. ` +
        `Build the artifact for ${options.assistant} first, or pass --assistant ${manifestAssistant}.`,
    )
  }

  // Cross-assistant guard: refuse to swap assistants on top of an
  // existing install unless the caller acknowledges with
  // --force-assistant-switch. This prevents accidental double-installs
  // leaving stale files from the previous assistant's tree.
  if (
    existingAssistant &&
    existingAssistant !== manifestAssistant &&
    !options.forceAssistantSwitch
  ) {
    throw new Error(
      `Target already has a ${existingAssistant} install; refusing to install a ${manifestAssistant} artifact over it. ` +
        `Uninstall the existing ${existingAssistant} install first, or pass --force-assistant-switch to proceed.`,
    )
  }

  return manifestAssistant
}

// Locate any existing ClaudeMap install on the target, regardless of
// which assistant it was installed for. Returns 'claude', 'codex', or null.
function detectExistingAssistant(targetRoot, paths) {
  const candidates = ['claude', 'codex']

  for (const assistantType of candidates) {
    const assistantPaths = paths.resolveAssistantPaths(assistantType)
    const recordPath = path.join(targetRoot, assistantPaths.installRecordRel)

    if (!fs.existsSync(recordPath)) continue

    try {
      const record = readJsonFile(recordPath)
      // Trust the record's assistant field if present; otherwise infer
      // from which location we found it.
      return record.assistant || assistantType
    } catch {
      // Corrupt record; assume the location implies the assistant.
      return assistantType
    }
  }

  return null
}

// Transactional install support. The partial-install marker lives at
// <targetRoot>/<assistant-root>/<marker-filename> for the duration of
// the install. It is written at the top of installClaudeMap and removed
// before the function returns. If an install fails mid-flight, the
// marker remains on disk; the next install refuses to run until the
// user either retries and succeeds or passes --force-partial to
// acknowledge and overwrite.

function getPartialInstallMarkerPath(targetRoot, assistantRootDir, markerFilename) {
  return path.join(targetRoot, assistantRootDir, markerFilename)
}

function refuseIfPartialInstallPresent(targetRoot, assistantRootDir, markerFilename, forcePartial) {
  const markerPath = getPartialInstallMarkerPath(targetRoot, assistantRootDir, markerFilename)

  if (!fs.existsSync(markerPath)) {
    return
  }

  if (forcePartial) {
    console.warn(
      `Found existing partial-install marker at ${markerPath}. Continuing because --force-partial was passed.`,
    )
    return
  }

  let markerContent = '(unreadable)'

  try {
    markerContent = fs.readFileSync(markerPath, 'utf8')
  } catch {
    // Swallow - we only use the content for the error message.
  }

  throw new Error(
    [
      `Refusing to install: partial-install marker exists at ${markerPath}.`,
      'A prior install did not complete. Inspect the target and retry, or rerun with --force-partial to overwrite.',
      `Marker contents: ${markerContent}`,
    ].join('\n'),
  )
}

function writePartialInstallMarker(targetRoot, assistantRootDir, markerFilename, mode, artifactRoot) {
  const markerPath = getPartialInstallMarkerPath(targetRoot, assistantRootDir, markerFilename)
  ensureDirectory(path.dirname(markerPath))
  fs.writeFileSync(
    markerPath,
    `${JSON.stringify(
      {
        startedAt: new Date().toISOString(),
        mode,
        artifactRoot,
      },
      null,
      2,
    )}\n`,
  )
  return markerPath
}

function removePartialInstallMarker(targetRoot, assistantRootDir, markerFilename) {
  const markerPath = getPartialInstallMarkerPath(targetRoot, assistantRootDir, markerFilename)
  fs.rmSync(markerPath, { force: true })
}

function readInstallRecord(targetRoot, assistantRootDir, installRecordFilename, schemas) {
  const recordPath = path.join(targetRoot, assistantRootDir, installRecordFilename)

  if (!fs.existsSync(recordPath)) {
    return null
  }

  try {
    const record = readJsonFile(recordPath)

    if (schemas) {
      schemas.validateWithWarning(schemas.SCHEMA_NAMES.INSTALL_RECORD, record, {
        filePath: recordPath,
      })
    }

    return record
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

function shouldRemoveLegacyRuntimeRoot(absolutePath) {
  const configPath = path.join(absolutePath, '.claudemap-config.json')

  if (fs.existsSync(configPath)) {
    try {
      const config = readJsonFile(configPath)
      if (config.assistant === 'codex' || /(^|\/)claudemap-runtime$/.test(config.skillRootRel || '')) {
        return true
      }
    } catch {
      return true
    }
  }

  const skillPath = path.join(absolutePath, 'SKILL.md')
  if (!fs.existsSync(skillPath)) {
    return false
  }

  try {
    const skillContent = fs.readFileSync(skillPath, 'utf8')
    return (
      /^name:\s*claudemap-runtime\s*$/m.test(skillContent) &&
      skillContent.includes('Codex Workflow') &&
      skillContent.includes('claudemap-architect')
    )
  } catch {
    return false
  }
}

function removeLegacyRuntimeSkillRoots(targetRoot, assistantPaths, dryRun) {
  if (!Array.isArray(assistantPaths.legacySkillRootRels)) {
    return []
  }

  const removedPaths = []

  for (const legacySkillRootRel of assistantPaths.legacySkillRootRels) {
    if (legacySkillRootRel === assistantPaths.skillRootRel) {
      continue
    }

    const absoluteLegacyRoot = resolveManagedPath(targetRoot, legacySkillRootRel)
    if (!fs.existsSync(absoluteLegacyRoot) || !shouldRemoveLegacyRuntimeRoot(absoluteLegacyRoot)) {
      continue
    }

    removedPaths.push(legacySkillRootRel)

    if (!dryRun) {
      fs.rmSync(absoluteLegacyRoot, {
        force: true,
        recursive: true,
      })
    }
  }

  return removedPaths
}

// Copy each install root directory from the artifact to the target.
// Claude installs have one root (.claude); Codex installs have two
// (.agents and .codex).
function installArtifact(artifactRoot, targetRoot, dryRun, installRoots) {
  const results = []

  for (const rootDir of installRoots) {
    const sourceRoot = path.join(artifactRoot, rootDir)
    const targetRootPath = path.join(targetRoot, rootDir)

    if (!fs.existsSync(sourceRoot)) {
      throw new Error(`ClaudeMap artifact is missing ${rootDir}: ${sourceRoot}`)
    }

    if (dryRun) {
      results.push({
        rootDir,
        createdDir: !fs.existsSync(targetRootPath),
        targetRootPath,
      })
      continue
    }

    ensureDirectory(targetRootPath)
    fs.cpSync(sourceRoot, targetRootPath, {
      force: true,
      recursive: true,
    })

    results.push({
      rootDir,
      createdDir: false,
      targetRootPath,
    })
  }

  return results
}

function writeInstallRecord(
  targetRoot,
  manifest,
  artifactRoot,
  mode,
  dryRun,
  assistantPaths,
  assistantType,
) {
  const recordPath = path.join(targetRoot, assistantPaths.installRecordRel)
  const record = {
    artifact: manifest.name,
    artifactVersion: manifest.version || 'unknown',
    artifactRoot: artifactRoot,
    assistant: assistantType,
    generatedAt: manifest.generatedAt || null,
    installedAt: new Date().toISOString(),
    managedPaths: manifest.managedPaths || [],
    mode,
    publicCommands: manifest.publicCommands || [],
    version: 2,
  }

  if (dryRun) {
    return recordPath
  }

  ensureDirectory(path.dirname(recordPath))
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
  const schemas = await loadSchemas()
  const defaultOutputRoot = path.join(REPO_ROOT, paths.PACKAGE_ARTIFACT_DIR_REL)

  // Default assistant for callers that don't pass it (e.g., tests).
  const mergedOptions = {
    assistant: 'auto',
    forceAssistantSwitch: false,
    ...options,
  }

  ensureTargetRepository(mergedOptions.targetRoot)
  buildArtifactIfNeeded(mergedOptions, defaultOutputRoot, paths)

  const manifest = loadArtifactManifest(mergedOptions.artifactRoot, paths.ARTIFACT_MANIFEST_FILENAME)
  const existingAssistant = detectExistingAssistant(mergedOptions.targetRoot, paths)
  const assistantType = resolveInstallAssistant(mergedOptions, manifest, paths, existingAssistant)
  const assistantPaths = paths.resolveAssistantPaths(assistantType)

  // Transactional guard. Dry-run does not touch disk and is excluded
  // from the marker protocol entirely.
  if (!mergedOptions.dryRun) {
    refuseIfPartialInstallPresent(
      mergedOptions.targetRoot,
      assistantPaths.rootDir,
      paths.PARTIAL_INSTALL_MARKER_FILENAME,
      mergedOptions.forcePartial,
    )

    writePartialInstallMarker(
      mergedOptions.targetRoot,
      assistantPaths.rootDir,
      paths.PARTIAL_INSTALL_MARKER_FILENAME,
      mergedOptions.mode,
      mergedOptions.artifactRoot,
    )
  }

  try {
    const previousInstallRecord = readInstallRecord(
      mergedOptions.targetRoot,
      assistantPaths.rootDir,
      paths.INSTALL_RECORD_FILENAME,
      schemas,
    )
    const removedManagedPaths = previousInstallRecord
      ? removeManagedPaths(
          mergedOptions.targetRoot,
          previousInstallRecord.managedPaths,
          mergedOptions.dryRun,
        )
      : []
    const removedLegacySkillRoots = removeLegacyRuntimeSkillRoots(
      mergedOptions.targetRoot,
      assistantPaths,
      mergedOptions.dryRun,
    )

    // Determine install roots from the manifest if present, falling
    // back to the assistant's defaults. This keeps the installer robust
    // against older manifests that don't record installRoots.
    const installRoots = Array.isArray(manifest.installRoots) && manifest.installRoots.length > 0
      ? manifest.installRoots
      : assistantType === 'codex'
        ? ['.agents', assistantPaths.rootDir]
        : [assistantPaths.rootDir]

    const installStates = installArtifact(
      mergedOptions.artifactRoot,
      mergedOptions.targetRoot,
      mergedOptions.dryRun,
      installRoots,
    )
    const recordPath = writeInstallRecord(
      mergedOptions.targetRoot,
      manifest,
      mergedOptions.artifactRoot,
      mergedOptions.mode,
      mergedOptions.dryRun,
      assistantPaths,
      assistantType,
    )

    let runtimeInstallRoot = null

    if (mergedOptions.installDependencies) {
      const installedSkillRootRel = manifest.internalRuntime?.skillRoot || assistantPaths.skillRootRel
      runtimeInstallRoot = installDependencies(
        mergedOptions.targetRoot,
        mergedOptions.dryRun,
        installedSkillRootRel,
      )
    }

    // Install completed without throwing. Remove the partial-install
    // marker so the target is no longer flagged as in-flight.
    if (!mergedOptions.dryRun) {
      removePartialInstallMarker(
        mergedOptions.targetRoot,
        assistantPaths.rootDir,
        paths.PARTIAL_INSTALL_MARKER_FILENAME,
      )
    }

    const actionLabel = mergedOptions.mode === 'update' ? 'updated' : 'installed'
    console.log(
      `ClaudeMap ${actionLabel} into ${mergedOptions.targetRoot} (assistant: ${assistantType})`,
    )
    console.log(`Artifact version: ${manifest.version || 'unknown'}`)
    for (const state of installStates) {
      console.log(`Merged into: ${state.targetRootPath}`)
    }
    console.log(`Install record: ${recordPath}`)
    const replacedPaths = [...removedManagedPaths, ...removedLegacySkillRoots]
    if (replacedPaths.length > 0) {
      console.log(`Replaced managed paths: ${replacedPaths.join(', ')}`)
    }

    if (mergedOptions.dryRun) {
      console.log('Dry run only: no files were copied and npm install was skipped')
    } else if (runtimeInstallRoot) {
      console.log(`Dependencies installed in ${runtimeInstallRoot}`)
    } else {
      console.log('Skipped npm install for the bundled runtime')
    }

    console.log(`Public commands: ${(manifest.publicCommands || []).join(', ')}`)

    return {
      assistantType,
      installStates,
      // Backwards-compat alias for single-root install shape used by the
      // previous smoke test.
      installState: installStates[0],
      manifest,
      recordPath,
      removedManagedPaths,
      runtimeInstallRoot,
    }
  } catch (error) {
    // Leave the partial-install marker on disk. The next install will
    // refuse until the user confirms with --force-partial.
    throw error
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
