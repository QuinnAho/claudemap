// Runtime design tokens. Single source of truth for color, opacity,
// typography, and spacing. Every component reads from here.
//
// The Vite tokens plugin (app/vite/tokens-plugin.js) mirrors these into
// CSS custom properties at build time so CSS rules can read var(--name).
// Do not edit globals.css :root block by hand; regenerate from here.
//
// Brand-sensitive slots (`accent`, `accentPronounced`) are resolved from
// the active brand at module eval time by reading <html data-brand="...">.
// The CSS var override in tokens.generated.css handles any rule that
// references var(--accent) directly; this module handles every JS call
// through `alpha()`, which composes rgba() strings from raw hex and so
// cannot go through the CSS variable.

import { BRANDS, DEFAULT_BRAND_ID } from './branding.js'

// ---------- Color primitives (raw hex, used only to build palettes below) ----------

const HEX = Object.freeze({
  canvas: '#0a0a0a',
  panel: '#111111',
  card: '#1a1a1a',
  topbar: '#0f0f0f',
  menu: '#0c0c0c',
  floating: '#121212',
  highlightAccentBg: '#1c120e',
  highlightNeutralBg: '#131313',
  restingBg: '#121212',
  restingFunctionBg: '#1a1a1a',

  textPrimary: '#e5e5e5',
  textSecondary: '#737373',
  textMuted: '#525252',
  textPresentation: '#f2ebe4',
  highlightText: '#fff4ef',

  // Brand. Keep room for a more saturated variant used in presentation mode
  // for more pronounced visuals. Today both resolve to the same base; the
  // slot exists so a future pass can differentiate without hunting.
  accent: '#df714c',
  accentPronounced: '#df714c',

  healthGreen: '#22c55e',
  healthYellow: '#eab308',
  healthRed: '#ef4444',

  black: '#000000',
  white: '#ffffff',
})

// ---------- Opacity scale ----------
//
// A small scale beats 25 named opacities. Components compose opacity with
// color using the alpha() helper below.

export const OPACITY = Object.freeze({
  ultraFaint: 0.025,
  faint: 0.05,
  subtle: 0.08,
  light: 0.12,
  soft: 0.18,
  medium: 0.3,
  strong: 0.5,
  heavy: 0.7,
  nearSolid: 0.9,
  solid: 1,
})

// ---------- rgb tuples, used only by alpha() ----------

function hexToRgb(hex) {
  const normalized = hex.replace('#', '')
  const expanded = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized
  const value = parseInt(expanded, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

// Resolve the active brand's accent hex pair once at module eval. The
// packager stamps <html data-brand="..."> before any script runs, so the
// attribute is already present by the time this module is imported. In
// non-DOM contexts (tests, SSR) fall back to the default brand, which
// matches HEX.accent.
const RESOLVED_BRAND_ACCENT = (() => {
  const fallback = BRANDS[DEFAULT_BRAND_ID]
  if (typeof document === 'undefined') {
    return { base: fallback.accent.base, pronounced: fallback.accent.pronounced }
  }
  const brandId = document.documentElement.getAttribute('data-brand')
  const brand = BRANDS[brandId] || fallback
  return { base: brand.accent.base, pronounced: brand.accent.pronounced }
})()

// Public helper: compose an rgba() string from a known color name.
// Usage: alpha('accent', OPACITY.soft), alpha('white', OPACITY.faint).
//
// `accent` and `accentPronounced` are brand-sensitive and resolve through
// RESOLVED_BRAND_ACCENT above so CodexMap-branded sessions get blue hex
// in the composed rgba() strings. Every other color key reads from the
// brand-neutral HEX table.
export function alpha(colorName, opacityValue) {
  let hex
  if (colorName === 'accent') {
    hex = RESOLVED_BRAND_ACCENT.base
  } else if (colorName === 'accentPronounced') {
    hex = RESOLVED_BRAND_ACCENT.pronounced
  } else {
    hex = HEX[colorName]
  }
  if (!hex) {
    throw new Error(`alpha(): unknown color "${colorName}"`)
  }
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${opacityValue})`
}

// ---------- Exported color palette ----------
//
// Components prefer semantic names. Raw hex is available via color.raw.* for
// cases where a specific shade is the design intent (e.g. an illustration).

export const COLOR = Object.freeze({
  bg: Object.freeze({
    canvas: HEX.canvas,
    panel: HEX.panel,
    card: HEX.card,
    topbar: HEX.topbar,
    menu: HEX.menu,
    floating: HEX.floating,
    highlightAccent: HEX.highlightAccentBg,
    highlightNeutral: HEX.highlightNeutralBg,
    resting: HEX.restingBg,
    restingFunction: HEX.restingFunctionBg,
  }),
  text: Object.freeze({
    primary: HEX.textPrimary,
    secondary: HEX.textSecondary,
    muted: HEX.textMuted,
    presentation: HEX.textPresentation,
    highlight: HEX.highlightText,
  }),
  accent: Object.freeze({
    base: HEX.accent,
    pronounced: HEX.accentPronounced,
  }),
  health: Object.freeze({
    green: HEX.healthGreen,
    yellow: HEX.healthYellow,
    red: HEX.healthRed,
  }),
  raw: HEX,
})

// ---------- Typography ----------

export const FONT = Object.freeze({
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'SF Mono', 'Fira Code', 'Consolas', monospace",
})

// ---------- Border ----------
//
// Borders are thin white overlays at specific opacities. Tokens here express
// the opacity choices; components compose via alpha('white', OPACITY.*).

export const BORDER = Object.freeze({
  subtle: alpha('white', 0.07),
  light: alpha('white', 0.1),
})

// ---------- Spacing scale (px) ----------
//
// 4px grid. Use step names, not raw numbers, so a reader sees the intent.

export const SPACING = Object.freeze({
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
})

// ---------- Radius scale (px) ----------

export const RADIUS = Object.freeze({
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  pill: 999,
})
