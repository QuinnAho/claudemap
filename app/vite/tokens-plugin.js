// Vite plugin that mirrors design tokens from contracts/tokens.js and
// contracts/motion.js into a CSS custom-property layer. The generated CSS
// is emitted to app/src/styles/tokens.generated.css and imported by
// globals.css. Components reading CSS rules see the same values that JS
// components read from tokens.js.
//
// The plugin runs on server start and when any token file changes. Output
// is deterministic so diffs are readable.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(pluginDir, '..')

const tokensSourcePath = path.join(projectDir, 'src', 'contracts', 'tokens.js')
const motionSourcePath = path.join(projectDir, 'src', 'contracts', 'motion.js')
const brandingSourcePath = path.join(projectDir, 'src', 'contracts', 'branding.js')
const generatedCssPath = path.join(projectDir, 'src', 'styles', 'tokens.generated.css')

async function loadTokens() {
  // Cache-bust by appending a timestamp so edits during dev reload cleanly.
  const tokensModule = await import(`${pathToFileUrl(tokensSourcePath)}?t=${Date.now()}`)
  const motionModule = await import(`${pathToFileUrl(motionSourcePath)}?t=${Date.now()}`)
  const brandingModule = await import(`${pathToFileUrl(brandingSourcePath)}?t=${Date.now()}`)
  return { tokens: tokensModule, motion: motionModule, branding: brandingModule }
}

function pathToFileUrl(absolutePath) {
  return 'file:///' + absolutePath.split(path.sep).join('/')
}

function toKebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

// Brand-sensitive tokens: values come from the active brand palette.
// The default :root block emits the ClaudeMap values from tokens.js;
// every non-default brand restates the same variable names with its
// own values in a [data-brand="..."] override block.

function renderCssVars({ tokens, motion, branding }) {
  const lines = []

  lines.push('/* Auto-generated from src/contracts/tokens.js, motion.js, and branding.js. Do not edit. */')
  lines.push(':root {')

  // Backgrounds.
  for (const [name, value] of Object.entries(tokens.COLOR.bg)) {
    lines.push(`  --bg-${toKebab(name)}: ${value};`)
  }

  // Text.
  for (const [name, value] of Object.entries(tokens.COLOR.text)) {
    lines.push(`  --text-${toKebab(name)}: ${value};`)
  }

  // Accent.
  lines.push(`  --accent: ${tokens.COLOR.accent.base};`)
  lines.push(`  --accent-pronounced: ${tokens.COLOR.accent.pronounced};`)

  // Health.
  for (const [name, value] of Object.entries(tokens.COLOR.health)) {
    lines.push(`  --health-${toKebab(name)}: ${value};`)
  }

  // Borders.
  lines.push(`  --border: ${tokens.BORDER.subtle};`)
  lines.push(`  --border-light: ${tokens.BORDER.light};`)

  // Motion durations. Emit both --motion-<name>-ms (canonical) and the
  // legacy --motion-<name>-duration aliases still referenced by existing
  // CSS rules. Aliases can be removed in a later sweep once rules migrate.
  for (const [name, value] of Object.entries(motion.MOTION)) {
    lines.push(`  --motion-${toKebab(name)}-ms: ${value}ms;`)
  }
  lines.push(`  --motion-quick-duration: ${motion.MOTION.quick}ms;`)
  lines.push(`  --motion-surface-duration: ${motion.MOTION.surface}ms;`)
  lines.push(`  --motion-layout-duration: ${motion.MOTION.layout}ms;`)

  // Easings.
  for (const [name, value] of Object.entries(motion.EASING)) {
    lines.push(`  --motion-ease-${toKebab(name)}: ${value};`)
  }

  lines.push('}')

  // Brand overrides. The default :root block above already matches
  // ClaudeMap; we emit an override block for every non-default brand.
  // The packager stamps <html data-brand="..."> on the packaged
  // index.html so the matching override wins at render time.
  const defaultBrandId = branding.DEFAULT_BRAND_ID
  for (const [brandId, brand] of Object.entries(branding.BRANDS)) {
    if (brandId === defaultBrandId) continue
    lines.push('')
    lines.push(`:root[data-brand="${brandId}"] {`)
    lines.push(`  --accent: ${brand.accent.base};`)
    lines.push(`  --accent-pronounced: ${brand.accent.pronounced};`)
    lines.push(`  --bg-highlight-accent: ${brand.accent.highlightAccentBg};`)
    lines.push(`  --text-presentation: ${brand.accent.textPresentation};`)
    lines.push(`  --text-highlight: ${brand.accent.textHighlight};`)
    lines.push('}')
  }

  lines.push('')

  return lines.join('\n')
}

async function regenerate() {
  const modules = await loadTokens()
  const css = renderCssVars(modules)
  const previous = fs.existsSync(generatedCssPath)
    ? fs.readFileSync(generatedCssPath, 'utf8')
    : null
  if (previous === css) {
    return false
  }
  fs.mkdirSync(path.dirname(generatedCssPath), { recursive: true })
  fs.writeFileSync(generatedCssPath, css, 'utf8')
  return true
}

export function claudemapTokensPlugin() {
  return {
    name: 'claudemap-tokens',
    async buildStart() {
      await regenerate()
    },
    configureServer(server) {
      const watched = [tokensSourcePath, motionSourcePath]
      for (const file of watched) {
        server.watcher.add(file)
      }
      server.watcher.on('change', async (changedPath) => {
        if (watched.includes(changedPath)) {
          const updated = await regenerate()
          if (updated) {
            server.ws.send({ type: 'full-reload' })
          }
        }
      })
    },
  }
}

// Export the regenerate function so the script-based entrypoint below can reuse it.
export { regenerate as regenerateTokensCss, generatedCssPath }
