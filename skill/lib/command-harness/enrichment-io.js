import fs from 'fs'
import { ClaudeMapError, ERROR_CODES } from '../contracts/errors.js'

export function loadEnrichmentFileStrict(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new ClaudeMapError(
      ERROR_CODES.INVALID_ARGUMENT,
      `Enrichment file not found: ${filePath}`,
      'Ensure the @claudemap-architect subagent wrote the file before running this command.',
    )
  }

  const content = fs.readFileSync(filePath, 'utf8').trim()

  if (!content) {
    throw new ClaudeMapError(
      ERROR_CODES.INVALID_ARGUMENT,
      'Enrichment file is empty',
      'The architect subagent may have failed. Check its output and retry.',
    )
  }

  return content
}

export function cleanupEnrichmentFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch {
    // Best-effort cleanup; swallow ENOENT and permission errors
  }
}

export function readEnrichmentArg(args) {
  // Convenience helper for commands that accept --enrichment-file
  if (!args.enrichmentFile) {
    return null
  }

  return loadEnrichmentFileStrict(args.enrichmentFile)
}
