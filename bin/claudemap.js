#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const PACKAGE_ROOT = path.resolve(__dirname, '..')
const INSTALL_SCRIPT_PATH = path.join(PACKAGE_ROOT, 'scripts', 'install-claudemap.js')

async function loadPathContracts() {
  return import('../skill/lib/contracts/paths.js')
}

function printUsage() {
  console.log('ClaudeMap CLI')
  console.log('  claudemap [install] [target-repo] [--skip-install] [--dry-run] [--assistant claude|codex|auto]')
  console.log('  claudemap update [target-repo] [--skip-install] [--dry-run] [--assistant claude|codex|auto]')
}

function hasHelpFlag(argv) {
  return argv.includes('--help') || argv.includes('-h') || argv[0] === 'help'
}

function hasPositionalTarget(argv) {
  // A positional is any non-flag arg, skipping arg values that belong to
  // known value-taking flags. --assistant consumes the following arg.
  const valueFlags = new Set(['--assistant', '--artifact'])

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (index === 0 && ['install', 'update'].includes(argument)) {
      continue
    }

    if (valueFlags.has(argument)) {
      index += 1 // skip the value
      continue
    }

    if (!argument.startsWith('--')) {
      return true
    }
  }

  return false
}

function extractAssistantFlag(argv) {
  const index = argv.indexOf('--assistant')
  if (index === -1 || index === argv.length - 1) return null
  return argv[index + 1]
}

function extractPositionalTarget(argv) {
  const valueFlags = new Set(['--assistant', '--artifact'])
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (index === 0 && ['install', 'update'].includes(argument)) continue
    if (valueFlags.has(argument)) { index += 1; continue }
    if (!argument.startsWith('--')) return argument
  }
  return null
}

function resolveBundledArtifactRoot(paths, assistantFlag, targetRoot) {
  const bundleDir = path.join(PACKAGE_ROOT, paths.NPM_BUNDLE_DIR_REL)
  const claudeBundle = path.join(bundleDir, paths.NPM_BUNDLE_SUBDIR)
  const codexBundle = path.join(bundleDir, `${paths.NPM_BUNDLE_SUBDIR}-codex`)

  const resolveType = () => {
    if (assistantFlag && assistantFlag !== 'auto') return assistantFlag
    return paths.detectAssistant(targetRoot)
  }

  const assistantType = resolveType()
  const bundle = assistantType === 'codex' ? codexBundle : claudeBundle

  if (!fs.existsSync(bundle)) {
    // Fallback: older tarballs only ship the Claude bundle. If the user
    // explicitly asked for codex but only the Claude bundle is present,
    // fail loudly rather than silently installing the wrong flavor.
    if (assistantType === 'codex' && fs.existsSync(claudeBundle)) {
      throw new Error(
        `Codex bundle not found at ${codexBundle}. This ClaudeMap build only ships the Claude artifact. Reinstall from a newer tarball.`,
      )
    }
    throw new Error(`Bundled ClaudeMap artifact not found at ${bundle}.`)
  }

  return bundle
}

function normalizeArgs(argv, bundledArtifactRoot) {
  const nextArgs = [...argv]
  const forwardedArgs = []

  if (nextArgs[0] === 'install') {
    nextArgs.shift()
  } else if (nextArgs[0] === 'update') {
    forwardedArgs.push('--update')
    nextArgs.shift()
  }

  if (!hasPositionalTarget(nextArgs)) {
    forwardedArgs.push(process.cwd())
  }

  forwardedArgs.push(...nextArgs)
  forwardedArgs.push('--artifact', bundledArtifactRoot, '--skip-package')

  return forwardedArgs
}

async function main() {
  const argv = process.argv.slice(2)

  if (hasHelpFlag(argv)) {
    printUsage()
    return
  }

  const paths = await loadPathContracts()
  const assistantFlag = extractAssistantFlag(argv)
  const positionalTarget = extractPositionalTarget(argv)
  const targetRoot = positionalTarget
    ? path.resolve(process.cwd(), positionalTarget)
    : process.cwd()
  const bundledArtifactRoot = resolveBundledArtifactRoot(paths, assistantFlag, targetRoot)

  const result = spawnSync(process.execPath, [INSTALL_SCRIPT_PATH, ...normalizeArgs(argv, bundledArtifactRoot)], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })

  if (typeof result.status === 'number') {
    process.exitCode = result.status
    return
  }

  if (result.error) {
    throw result.error
  }

  process.exitCode = 1
}

main().catch((error) => {
  console.error(`ClaudeMap CLI failed: ${error.message}`)
  process.exitCode = 1
})
