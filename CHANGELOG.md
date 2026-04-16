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
- added a post-render feedback prompt plus an iterative graph-refinement path
  for `/setup-claudemap` and `/create-map` that reuses the current ClaudeMap
  graph context instead of forcing a full restart, including an
  `--enrichment-file` override on `create-map.js` so scoped maps can iterate
  in place instead of being rebuilt from the root graph
- moved runtime graph outputs into a dedicated `app/public/graph/` subdirectory
  inside the bundled claudemap-runtime skill so generated graphs have an
  obvious canonical home instead of landing next to unrelated static assets.
  Manifest entries with legacy bare filenames (`claudemap-runtime.json`,
  `claudemap-runtime.<map-id>.json`, etc.) auto-migrate to the new `graph/`
  paths on read, so existing installs upgrade transparently on the next
  `/setup-claudemap` or `/refresh`
- tightened enrichment validation in `setup-claudemap.js`, `update.js`, and
  `create-map.js`: when `--enrichment-file` is passed the commands now exit
  non-zero if the file is missing, empty, or unparseable instead of silently
  falling back to the heuristic graph. This fixes the observed race where a
  heuristic graph would render first and only get replaced after the user
  explicitly asked for the enriched one
- added a local `npm run pack:test` flow for building an installable tarball and
  smoke-testing the package in other repositories before publishing
- added `npm run test:project -- <repo>` as a first-class wrapper around the
  local tarball install path so packaged ClaudeMap can be tested in arbitrary
  repos without hand-writing the `npm exec --package=...` command
- added `claudemap clean` plus `npm run test:project:clean -- <repo>` so test
  repos can be reset by removing ClaudeMap-managed `.claude` files, generated
  root caches/manifests, and stale refresh locks

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
