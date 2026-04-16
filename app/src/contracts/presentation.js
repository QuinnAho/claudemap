// Presentation-mode enum. Mirror of skill/lib/contracts/presentation.js.
// The app and skill run in separate package scopes and cannot share modules;
// the smoke test asserts these two files stay identical.

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
