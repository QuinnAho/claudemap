#!/usr/bin/env node

const path = require('path')
const { spawnSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '..')
const PACKAGE_SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'package-claudemap-skill.js')
const OUTPUT_ROOT = path.join(REPO_ROOT, '.npm-bundle')

function main() {
  const result = spawnSync(
    process.execPath,
    [PACKAGE_SCRIPT_PATH, '--output', OUTPUT_ROOT],
    {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    },
  )

  if (result.status !== 0) {
    throw new Error('Failed to prepare npm bundle')
  }

  console.log(`ClaudeMap npm bundle ready at ${path.join(OUTPUT_ROOT, 'claudemap')}`)
}

try {
  main()
} catch (error) {
  console.error(`ClaudeMap npm bundle failed: ${error.message}`)
  process.exitCode = 1
}
