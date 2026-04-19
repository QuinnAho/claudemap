#!/usr/bin/env node

const path = require('path')
const { spawnSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '..')
const PACKAGE_SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'package-claudemap-skill.js')

async function loadPathContracts() {
  return import('../skill/lib/contracts/paths.js')
}

async function main() {
  const paths = await loadPathContracts()
  const outputRoot = path.join(REPO_ROOT, paths.NPM_BUNDLE_DIR_REL)
  const result = spawnSync(
    process.execPath,
    [PACKAGE_SCRIPT_PATH, '--output', outputRoot, '--assistant', 'all'],
    {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    },
  )

  if (result.status !== 0) {
    throw new Error('Failed to prepare npm bundle')
  }

  const claudeBundle = path.join(outputRoot, paths.NPM_BUNDLE_SUBDIR)
  const codexBundle = path.join(outputRoot, `${paths.NPM_BUNDLE_SUBDIR}-codex`)
  console.log(`ClaudeMap npm bundle ready:`)
  console.log(`  claude: ${claudeBundle}`)
  console.log(`  codex:  ${codexBundle}`)
}

main().catch((error) => {
  console.error(`ClaudeMap npm bundle failed: ${error.message}`)
  process.exitCode = 1
})
