# Changelog

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
