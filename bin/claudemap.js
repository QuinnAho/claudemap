#!/usr/bin/env node

const path = require('path')
const { spawnSync } = require('child_process')

const PACKAGE_ROOT = path.resolve(__dirname, '..')
const INSTALL_SCRIPT_PATH = path.join(PACKAGE_ROOT, 'scripts', 'install-claudemap.js')
const BUNDLED_ARTIFACT_ROOT = path.join(PACKAGE_ROOT, '.npm-bundle', 'claudemap')

function printUsage() {
  console.log('ClaudeMap CLI')
  console.log('  claudemap [install] [target-repo] [--skip-install] [--dry-run]')
  console.log('  claudemap update [target-repo] [--skip-install] [--dry-run]')
}

function hasHelpFlag(argv) {
  return argv.includes('--help') || argv.includes('-h') || argv[0] === 'help'
}

function hasPositionalTarget(argv) {
  return argv.some((argument, index) => {
    if (index === 0 && ['install', 'update'].includes(argument)) {
      return false
    }

    return !argument.startsWith('--')
  })
}

function normalizeArgs(argv) {
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
  forwardedArgs.push('--artifact', BUNDLED_ARTIFACT_ROOT, '--skip-package')

  return forwardedArgs
}

function main() {
  const argv = process.argv.slice(2)

  if (hasHelpFlag(argv)) {
    printUsage()
    return
  }

  const result = spawnSync(process.execPath, [INSTALL_SCRIPT_PATH, ...normalizeArgs(argv)], {
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

try {
  main()
} catch (error) {
  console.error(`ClaudeMap CLI failed: ${error.message}`)
  process.exitCode = 1
}
