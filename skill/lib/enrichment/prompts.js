import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  AGENTS_SUBDIR,
  ARCHITECT_AGENT_FILENAME,
  ENRICHMENT_PROMPT_FILENAME,
  SCOPED_ENRICHMENT_PROMPT_FILENAME,
} from '../contracts/paths.js'

// prompts owns every filesystem read that feeds the enrichment prompt.
// It assembles the root prompt by stitching the enrichment.txt template, the
// @claudemap-architect agent body, and the snapshot JSON together, and it
// exposes the raw prompt and agent getters used by the skill harness.
//
// Paths resolve relative to this file (skill/lib/enrichment/) so they survive
// when the skill is copied into .claude/skills/claudemap-runtime/ at install
// time. We intentionally stay synchronous - these reads happen once per
// command invocation and the files are tiny.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROMPT_PATH = path.join(__dirname, '..', '..', 'prompts', ENRICHMENT_PROMPT_FILENAME)
const SCOPED_PROMPT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'prompts',
  SCOPED_ENRICHMENT_PROMPT_FILENAME,
)
const ARCHITECT_AGENT_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  AGENTS_SUBDIR,
  ARCHITECT_AGENT_FILENAME,
)

function readArchitectGuidance() {
  try {
    const agentMarkdown = fs.readFileSync(ARCHITECT_AGENT_PATH, 'utf8')
    return agentMarkdown.replace(/^---[\s\S]*?---\s*/, '').trim()
  } catch {
    return 'Prioritize intuitive, stable architectural systems over folder mirroring.'
  }
}

export function buildPrompt(snapshot) {
  const promptTemplate = fs.readFileSync(PROMPT_PATH, 'utf8')
  const architectGuidance = readArchitectGuidance()
  return `${promptTemplate}\n\nSubagent guidance:\n\n${architectGuidance}\n\nHere is the codebase data:\n\n${JSON.stringify(snapshot, null, 2)}`
}

export function getClaudeMapArchitectDefinition() {
  return fs.readFileSync(ARCHITECT_AGENT_PATH, 'utf8')
}

export function getScopedEnrichmentPrompt() {
  return fs.readFileSync(SCOPED_PROMPT_PATH, 'utf8')
}

export function getRootEnrichmentPrompt() {
  return fs.readFileSync(PROMPT_PATH, 'utf8')
}
