// Presentation-mode enum shared by skill commands and the MCP client.
//
// The app (browser) mirrors these values in app/src/contracts/presentation.js.
// A smoke-test assertion enforces that the two files stay identical.

export const PRESENTATION_MODES = Object.freeze({
  FREE: 'free',
  GUIDED: 'guided',
  LOCKED: 'locked',
})

export const PRESENTATION_MODE_LIST = Object.freeze([
  PRESENTATION_MODES.FREE,
  PRESENTATION_MODES.GUIDED,
  PRESENTATION_MODES.LOCKED,
])

export function isPresentationMode(value) {
  return PRESENTATION_MODE_LIST.includes(value)
}

export function normalizePresentationMode(value, fallback = PRESENTATION_MODES.FREE) {
  return isPresentationMode(value) ? value : fallback
}
