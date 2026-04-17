#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '..')

// Files allowed to declare contract values as raw literals.
// Contract modules are the canonical source of truth.
// Smoke tests assert fixed on-disk shapes and may contain the literal values.
// The skill packager embeds slash-command .md templates that reference paths.
const EXEMPT_FILES = [
  'skill/lib/contracts/paths.js',
  'skill/lib/contracts/presentation.js',
  'skill/lib/contracts/graph-sources.js',
  'skill/lib/contracts/versions.js',
  'skill/lib/contracts/errors.js',
  'skill/lib/contracts/index.js',
  'app/src/contracts/paths.js',
  'app/src/contracts/presentation.js',
  'app/src/contracts/graph-sources.js',
  'app/src/contracts/tokens.js',
  'app/src/contracts/motion.js',
  'app/src/contracts/zoom.js',
  'app/src/contracts/index.js',
  'scripts/smoke-test-package.js',
  'scripts/package-claudemap-skill.js',
  'scripts/check-contracts.js',
]

const EXEMPT_DIRS = [
  'node_modules',
  'dist',
  'docs',
  'artifacts',
  '.npm-bundle',
  '.claude',
  'contracts',
  'app/public',
  'app/node_modules',
  'app/dist',
]

// Files inside these directories are candidates for scanning.
const SCAN_DIRS = [
  'skill',
  'app/src',
  'app/vite',
  'scripts',
  'bin',
]

// Additional specific files to scan at the repo root or app root.
const EXTRA_SCAN_FILES = [
  'app/vite.config.js',
]

const SCAN_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs'])

// Rule: (name, pattern, reason, suggestion)
const RULES = [
  {
    name: 'presentation-mode',
    pattern: /['"](free|guided|locked)['"]/g,
    reason: "Raw presentation-mode literal.",
    suggestion: 'Import PRESENTATION_MODES from the presentation contract and use PRESENTATION_MODES.FREE / .GUIDED / .LOCKED.',
  },
  {
    name: 'graph-source',
    pattern: /['"](sample|seed|file-shim|heuristic|claude-scoped|scoped-map|imported|architect)['"]/g,
    reason: "Raw graph-source literal.",
    suggestion: 'Import GRAPH_SOURCES from the graph-sources contract and use the named constant.',
  },
  {
    name: 'graph-source-contextual',
    // Generic words that are also valid graph-source values. Only flag them
    // when the enclosing line also references a graph-source context (source,
    // transport, graphSource, meta.source).
    pattern: /['"](manual|runtime|claude|unknown)['"]/g,
    reason: "Raw graph-source literal in source/transport context.",
    suggestion: 'Import GRAPH_SOURCES from the graph-sources contract and use the named constant.',
    requireLineMatch: [
      /\bsource\b/,
      /\btransport\b/,
      /\bgraphSource\b/,
      /GRAPH_SOURCES/,
    ],
  },
  {
    name: 'path-filename',
    pattern: /['"](claudemap-cache\.json|claudemap-maps\.json|claudemap-runtime\.json|claudemap-runtime-state\.json|claudemap-install\.json|claudemap-artifact\.json|claudemap-architect\.md)['"]/g,
    reason: 'Raw claudemap path filename literal.',
    suggestion: 'Import the matching filename constant from the paths contract (CACHE_FILENAME, MAPS_MANIFEST_FILENAME, RUNTIME_GRAPH_FILENAME, RUNTIME_STATE_FILENAME, INSTALL_RECORD_FILENAME, ARTIFACT_MANIFEST_FILENAME, ARCHITECT_AGENT_FILENAME).',
  },
  {
    name: 'hex-color',
    pattern: /['"]#[0-9a-fA-F]{3,8}['"]/g,
    reason: 'Raw hex color literal.',
    suggestion: 'Use a token from app/src/contracts/tokens.js instead.',
  },
  {
    name: 'oklch-color',
    pattern: /oklch\s*\(/g,
    reason: 'Raw oklch() color expression in source.',
    suggestion: 'Use a token from app/src/contracts/tokens.js instead.',
  },
  {
    name: 'raw-close-mcp',
    pattern: /\bcloseMcpClient\s*\(/g,
    reason: 'Raw closeMcpClient() call outside the command harness.',
    suggestion: 'Acquire the MCP client through withMcp() in skill/lib/command-harness/with-mcp.js; it owns the release.',
    exemptFiles: [
      'skill/lib/command-harness/with-mcp.js',
      'skill/lib/mcp-client.js',
    ],
  },
  {
    name: 'inline-store-selector',
    pattern: /useGraphStore\s*\(\s*\(\s*state\s*\)\s*=>/g,
    reason: 'Inline arrow selector on useGraphStore outside the store directory.',
    suggestion: 'Import a named selector from app/src/store/selectors.js (or add one there) and pass it to useGraphStore.',
    exemptFiles: [
      'app/src/store/selectors.js',
      'app/src/store/graphStore.js',
    ],
  },
]

function toPosix(value) {
  return value.split(path.sep).join('/')
}

function isExemptFile(relativePath) {
  return EXEMPT_FILES.includes(relativePath)
}

function isInExemptDir(relativePath) {
  return EXEMPT_DIRS.some(
    (dir) => relativePath === dir || relativePath.startsWith(`${dir}/`),
  )
}

function collectSourceFiles() {
  const files = []

  for (const scanDir of SCAN_DIRS) {
    const absoluteDir = path.join(REPO_ROOT, scanDir)

    if (!fs.existsSync(absoluteDir)) {
      continue
    }

    walkDirectory(absoluteDir, files)
  }

  for (const extraFile of EXTRA_SCAN_FILES) {
    const absolutePath = path.join(REPO_ROOT, extraFile)

    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      files.push(absolutePath)
    }
  }

  return files
}

function walkDirectory(absoluteDir, files) {
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true })

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name)
    const relativePath = toPosix(path.relative(REPO_ROOT, absolutePath))

    if (isInExemptDir(relativePath)) {
      continue
    }

    if (entry.isDirectory()) {
      walkDirectory(absolutePath, files)
      continue
    }

    if (!SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      continue
    }

    files.push(absolutePath)
  }
}

function getLineForIndex(content, index) {
  let line = 1

  for (let position = 0; position < index; position += 1) {
    if (content[position] === '\n') {
      line += 1
    }
  }

  return line
}

function getLineText(content, lineNumber) {
  const lines = content.split('\n')
  return lines[lineNumber - 1] || ''
}

function scanFile(absolutePath) {
  const relativePath = toPosix(path.relative(REPO_ROOT, absolutePath))

  if (isExemptFile(relativePath)) {
    return []
  }

  const content = fs.readFileSync(absolutePath, 'utf8')
  const violations = []

  for (const rule of RULES) {
    if (rule.exemptFiles?.includes(relativePath)) {
      continue
    }

    rule.pattern.lastIndex = 0
    let match

    while ((match = rule.pattern.exec(content)) !== null) {
      const lineNumber = getLineForIndex(content, match.index)
      const lineText = getLineText(content, lineNumber)

      if (rule.excludeLineMatch?.some((regex) => regex.test(lineText))) {
        continue
      }

      if (rule.requireLineMatch && !rule.requireLineMatch.some((regex) => regex.test(lineText))) {
        continue
      }

      violations.push({
        rule: rule.name,
        reason: rule.reason,
        suggestion: rule.suggestion,
        file: relativePath,
        line: lineNumber,
        snippet: lineText.trim(),
        literal: match[0],
      })
    }
  }

  return violations
}

function main() {
  const files = collectSourceFiles()
  const allViolations = []

  for (const absolutePath of files) {
    allViolations.push(...scanFile(absolutePath))
  }

  if (allViolations.length === 0) {
    console.log(`ClaudeMap contract guard passed: scanned ${files.length} files, no violations.`)
    return
  }

  const byRule = new Map()

  for (const violation of allViolations) {
    if (!byRule.has(violation.rule)) {
      byRule.set(violation.rule, [])
    }
    byRule.get(violation.rule).push(violation)
  }

  console.error(`ClaudeMap contract guard failed: ${allViolations.length} violation(s) across ${byRule.size} rule(s).`)

  for (const [ruleName, violations] of byRule.entries()) {
    console.error(`\n[${ruleName}] ${violations[0].reason}`)
    console.error(`  ${violations[0].suggestion}`)

    for (const violation of violations) {
      console.error(`    ${violation.file}:${violation.line}  ${violation.literal}  -- ${violation.snippet}`)
    }
  }

  process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`ClaudeMap contract guard crashed: ${error.message}`)
  process.exitCode = 2
}
