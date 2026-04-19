#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { collectProjectSnapshot } from '../lib/file-walker.js'
import { runCommand, exitOnError } from '../lib/command-harness/run-command.js'
import { success } from '../lib/contracts/errors.js'

async function handleSnapshot({ ctx, args }) {
  const projectRoot = ctx.projectRoot
  const outputPath = args.output
  const snapshot = collectProjectSnapshot(projectRoot)
  const payload = JSON.stringify(snapshot, null, 2)

  if (outputPath) {
    const resolvedOutputPath = path.resolve(outputPath)
    fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true })
    fs.writeFileSync(resolvedOutputPath, payload)
    console.log(`ClaudeMap snapshot ready at ${resolvedOutputPath}`)
    return success()
  }

  console.log(payload)
  return success()
}

export const SNAPSHOT_COMMAND = {
  name: 'snapshot',
  summary: 'Collect a project snapshot and output it as JSON.',
  argumentHint: '[project-root]',
  noSlashTemplate: true,
  positional: {
    name: 'projectRoot',
    required: false,
  },
  flags: [
    { name: 'output', type: 'string' },
  ],
  handler: handleSnapshot,
}

export async function main(argv = process.argv.slice(2)) {
  return runCommand(SNAPSHOT_COMMAND, argv)
}

function isDirectExecution(fileUrl) {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(fileUrl)
}

if (isDirectExecution(import.meta.url)) {
  main().catch(exitOnError)
}
