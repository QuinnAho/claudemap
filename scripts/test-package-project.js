#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '..')
const ARTIFACTS_ROOT = path.join(REPO_ROOT, 'artifacts')
const NPM_ARTIFACT_ROOT = path.join(ARTIFACTS_ROOT, 'npm')
const NPM_CACHE_ROOT = path.join(ARTIFACTS_ROOT, '.npm-cache')

function printUsage() {
  console.log('ClaudeMap packaged-project test helper')
  console.log(
    '  node scripts/test-package-project.js <target-repo> [--update|--clean] [--skip-pack] [--tarball <file>] [--skip-install] [--dry-run]',
  )
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    mode: 'install',
    skipInstall: false,
    skipPack: false,
    targetRoot: null,
    tarballPath: null,
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

    if (argument === '--clean') {
      options.mode = 'clean'
      continue
    }

    if (argument === '--skip-pack') {
      options.skipPack = true
      continue
    }

    if (argument === '--skip-install') {
      options.skipInstall = true
      continue
    }

    if (argument === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (argument === '--tarball') {
      const nextValue = argv[index + 1]

      if (!nextValue) {
        throw new Error('Missing value for --tarball')
      }

      options.tarballPath = path.resolve(nextValue)
      index += 1
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

function getNpmCommand() {
  return 'npm'
}

function runCommand(command, args, workingDirectory) {
  const result = spawnSync(command, args, {
    cwd: workingDirectory,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`)
  }
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

function buildTarballIfNeeded(options) {
  if (options.skipPack || options.tarballPath) {
    return
  }

  fs.mkdirSync(NPM_ARTIFACT_ROOT, { recursive: true })
  fs.mkdirSync(NPM_CACHE_ROOT, { recursive: true })

  runCommand(
    getNpmCommand(),
    ['pack', '--pack-destination', NPM_ARTIFACT_ROOT, '--cache', NPM_CACHE_ROOT],
    REPO_ROOT,
  )
}

function resolveTarballPath(options) {
  if (options.tarballPath) {
    if (!fs.existsSync(options.tarballPath)) {
      throw new Error(`Tarball not found: ${options.tarballPath}`)
    }

    return options.tarballPath
  }

  if (!fs.existsSync(NPM_ARTIFACT_ROOT)) {
    throw new Error(
      `No tarball directory found at ${NPM_ARTIFACT_ROOT}. Run without --skip-pack or pass --tarball.`,
    )
  }

  const tarballs = fs
    .readdirSync(NPM_ARTIFACT_ROOT)
    .filter((fileName) => fileName.endsWith('.tgz'))
    .map((fileName) => {
      const filePath = path.join(NPM_ARTIFACT_ROOT, fileName)
      const stat = fs.statSync(filePath)
      return {
        filePath,
        mtimeMs: stat.mtimeMs,
      }
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)

  if (tarballs.length === 0) {
    throw new Error(
      `No ClaudeMap tarballs found in ${NPM_ARTIFACT_ROOT}. Run without --skip-pack or pass --tarball.`,
    )
  }

  return tarballs[0].filePath
}

function formatManualCommand(tarballPath, options) {
  const forwardedArgs = [options.mode, options.targetRoot]

  if (options.skipInstall && options.mode !== 'clean') {
    forwardedArgs.push('--skip-install')
  }

  if (options.dryRun) {
    forwardedArgs.push('--dry-run')
  }

  return `npm exec --cache="${NPM_CACHE_ROOT}" --package="${tarballPath}" -- claudemap ${forwardedArgs
    .map((value) => JSON.stringify(value))
    .join(' ')}`
}

function installTarball(tarballPath, options) {
  fs.mkdirSync(NPM_CACHE_ROOT, { recursive: true })

  const args = [
    'exec',
    '--cache',
    NPM_CACHE_ROOT,
    `--package=${tarballPath}`,
    '--',
    'claudemap',
    options.mode,
    options.targetRoot,
  ]

  if (options.skipInstall && options.mode !== 'clean') {
    args.push('--skip-install')
  }

  if (options.dryRun) {
    args.push('--dry-run')
  }

  runCommand(getNpmCommand(), args, REPO_ROOT)
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)

  if (options.help) {
    printUsage()
    return
  }

  ensureTargetRepository(options.targetRoot)
  buildTarballIfNeeded(options)
  const tarballPath = resolveTarballPath(options)

  console.log(`Target repo: ${options.targetRoot}`)
  console.log(`Tarball: ${tarballPath}`)
  console.log(`Manual command: ${formatManualCommand(tarballPath, options)}`)

  installTarball(tarballPath, options)
}

try {
  main()
} catch (error) {
  console.error(`ClaudeMap project-package test failed: ${error.message}`)
  process.exitCode = 1
}
