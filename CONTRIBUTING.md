# Contributing

Thanks for contributing to ClaudeMap.

## Before You Start

- Open an issue before large changes, refactors, or new dependencies.
- Keep pull requests focused. Small, reviewable changes land faster.
- Be explicit about user-facing changes to install flow, command names, prompts, or packaged paths.

## Local Setup

```bash
npm install
npm run dev
npm run build
```

## Repo-Specific Checks

- If you change the seeded self-map, public site, or app output, run `npm run build-site` and include `docs/`. Use `npm run generate-seed-map` when you only want to refresh the seeded self-map without rebuilding the site.
- If you change installer, packaging, or npm release behavior, run `npm pack --dry-run --cache artifacts/.npm-cache`.
- If you change installer, packaging, or npm release behavior, also run `npm run pack:test` and `npm run test:project -- <path-to-other-repo>` when practical.
- If you change install cleanup behavior, also run `npm run test:project:clean -- <path-to-other-repo>`.
- If you change bundled commands, prompts, or runtime packaging, run `node scripts/package-claudemap-skill.js`.
- Do not commit `.npm-bundle/` or `artifacts/`.

## Pull Requests

- Describe the problem, the change, and any tradeoffs.
- List the commands you ran to verify the change.
- Include screenshots or a short video for visible UI/site changes.
- Update docs when setup, publishing, or command behavior changes.

## Conduct

By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
