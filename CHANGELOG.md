# Changelog

## Unreleased

Highlights:

- added multi-map support so ClaudeMap can switch between scoped graph views
  instead of forcing every relationship through a single global map
- removed subsystem-only edges from overview layouts so cross-system
  relationships stay legible and scoped maps own their internal wiring
- improved click-driven edge highlighting so related paths read more clearly
  during exploration
- hardened hover, expand, and collapse UX so graph motion stays smoother under
  rapid interaction and collapse transitions no longer bloat before shrinking
- added a local `npm run pack:test` flow for building an installable tarball and
  smoke-testing the package in other repositories before publishing

## 0.1.0 - 2026-04-12

Initial public npm release of the `claudemap` installer CLI.

Highlights:

- added a published `claudemap` bin intended for `npx claudemap install` and
  `npx claudemap update`
- bundled the ClaudeMap `.claude` runtime into the npm package during `prepack`
- added idempotent install and update flows that preserve unrelated `.claude`
  files while replacing ClaudeMap-managed paths
- added automatic `npm install` for the bundled runtime after installation
- reduced the npm publish bundle so it ships the installer and runtime artifact,
  not the demo packages
- refreshed repository docs to describe the current scaffold and release flow
- added open-source release metadata, changelog, publishing guide, and MIT
  license
