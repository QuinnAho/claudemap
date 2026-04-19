# Changelog

## 0.2.0 - 2026-04-18

Highlights:

- **Multi-map support** — create scoped maps for large codebases instead of
  forcing everything through one global view
- **Codex support** — ClaudeMap now works with OpenAI Codex alongside Claude
  Code; install with `--assistant codex`
- **Stable map generation** — consistent layouts across rebuilds with improved
  architecture pipeline
- **Iterative refinement** — post-render feedback prompts let you tweak the map
  without starting over
- **Better refresh UX** — smoother updates with hardened hover, expand, and
  collapse transitions

Changes:

- removed subsystem-only edges from overview layouts so cross-system
  relationships stay legible and scoped maps own their internal wiring
- improved click-driven edge highlighting so related paths read more clearly
- moved runtime graph outputs into `app/public/graph/` with automatic migration
  from legacy paths
- tightened enrichment validation: `--enrichment-file` now fails fast if the
  file is missing, empty, or unparseable
- added `npm run pack:test` for local smoke-testing before publish
- reorganized project with real architecture (see `docs/GUIDE.md`)

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
