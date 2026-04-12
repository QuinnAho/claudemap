#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { collectProjectSnapshot } from '../lib/file-walker.js'

function hasFlag(argv, flagName) {
  return argv.includes(`--${flagName}`)
}

function getOptionValue(argv, optionName) {
  const optionIndex = argv.indexOf(`--${optionName}`)

  if (optionIndex === -1) {
    return null
  }

  return argv[optionIndex + 1] || null
}

function resolveProjectRoot(argv) {
  const projectRootArg = argv.find((argument, index) => {
    if (argument.startsWith('--')) {
      return false
    }

    const previousArgument = argv[index - 1]
    return previousArgument !== '--output'
  })

  return path.resolve(
    projectRootArg || process.env.CLAUDEMAP_PROJECT_ROOT || process.env.INIT_CWD || process.cwd(),
  )
}

function printUsage() {
  console.log('ClaudeMap snapshot')
  console.log('  claudemap-snapshot [project-root] [--output <file>]')
}

async function main() {
  const argv = process.argv.slice(2)

  if (hasFlag(argv, 'help') || hasFlag(argv, 'h')) {
    printUsage()
    return
  }

  const projectRoot = resolveProjectRoot(argv)
  const outputPath = getOptionValue(argv, 'output')
  const snapshot = collectProjectSnapshot(projectRoot)
  const payload = JSON.stringify(snapshot, null, 2)

  if (outputPath) {
    const resolvedOutputPath = path.resolve(outputPath)
    fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true })
    fs.writeFileSync(resolvedOutputPath, payload)
    console.log(`ClaudeMap snapshot ready at ${resolvedOutputPath}`)
    return
  }

  console.log(payload)
}

main().catch((error) => {
  console.error(`ClaudeMap snapshot failed: ${error.message}`)
  process.exitCode = 1
})
