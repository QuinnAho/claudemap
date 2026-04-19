// Runtime brand resolution for the app. Reads the data-brand attribute
// stamped on <html> by the packager at build time. Falls back to the
// default brand when the attribute is missing (dev mode, or a Claude
// artifact that intentionally ships without an override).
//
// Keep this module UI-facing: anything that needs the display name,
// favicon path, or accent descriptor should call getBrand() here
// rather than importing from the contract directly. The contract
// stays in app/src/contracts/branding.js as the source of truth.

import { BRANDS, DEFAULT_BRAND_ID, resolveBrandById } from '../contracts/branding'

/**
 * Resolve the active brand from the document root's data-brand attribute.
 *
 * Returns a frozen brand descriptor. Safe to call during module eval in
 * browser contexts; returns the default brand in non-DOM environments
 * (SSR, tests without jsdom) so callers don't need extra guards.
 */
export function getBrand() {
  if (typeof document === 'undefined') {
    return BRANDS[DEFAULT_BRAND_ID]
  }
  const brandId = document.documentElement.getAttribute('data-brand')
  return resolveBrandById(brandId)
}
