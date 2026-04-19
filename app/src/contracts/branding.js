// Brand contracts. Single source of truth for the two supported brand
// flavors: ClaudeMap (default, warm accent) and CodexMap (Codex flavor,
// cool accent). The package installer stamps <html data-brand="..."> on
// the packaged index.html so the right brand is active before first
// paint; runtime code reads getBrand() (see app/src/lib/brand.js) to
// pick display strings and assistant-facing invocation copy.
//
// The accent family here is the ONLY place brand colors are defined.
// The tokens-plugin reads this file to emit per-brand CSS variable
// overrides. Do not introduce brand-sensitive hex anywhere else.

export const BRAND_IDS = Object.freeze({
  CLAUDEMAP: 'claudemap',
  CODEXMAP: 'codexmap',
})

export const DEFAULT_BRAND_ID = BRAND_IDS.CLAUDEMAP

// Each brand contributes its display identity, skill invocation handle, and
// a small accent family. All other design tokens (backgrounds, text, health,
// typography, spacing) are brand-neutral and live in tokens.js unchanged.
export const BRANDS = Object.freeze({
  [BRAND_IDS.CLAUDEMAP]: Object.freeze({
    id: BRAND_IDS.CLAUDEMAP,
    displayName: 'ClaudeMap',
    pasteTargetLabel: 'Claude',
    skillMention: '$claudemap-runtime',
    faviconPath: '/favicon.svg',
    accent: {
      base: '#df714c',
      pronounced: '#df714c',
      highlightAccentBg: '#1c120e',
      textPresentation: '#f2ebe4',
      textHighlight: '#fff4ef',
    },
  }),
  [BRAND_IDS.CODEXMAP]: Object.freeze({
    id: BRAND_IDS.CODEXMAP,
    displayName: 'CodexMap',
    pasteTargetLabel: 'Codex',
    skillMention: '$codexmap-runtime',
    faviconPath: '/favicon-codex.svg',
    accent: {
      base: '#5b8def',
      pronounced: '#5b8def',
      highlightAccentBg: '#0e141c',
      textPresentation: '#e4ecf2',
      textHighlight: '#eff6ff',
    },
  }),
})

/**
 * Resolve the brand for a given assistant type.
 *
 * @param {string|undefined} assistantType - 'claude' | 'codex' | undefined
 * @returns {Object} Frozen brand descriptor.
 */
export function resolveBrandForAssistant(assistantType) {
  if (assistantType === 'codex') return BRANDS[BRAND_IDS.CODEXMAP]
  return BRANDS[BRAND_IDS.CLAUDEMAP]
}

/**
 * Resolve a brand descriptor by id with a safe default.
 *
 * @param {string|undefined} brandId
 * @returns {Object} Frozen brand descriptor.
 */
export function resolveBrandById(brandId) {
  return BRANDS[brandId] || BRANDS[DEFAULT_BRAND_ID]
}
