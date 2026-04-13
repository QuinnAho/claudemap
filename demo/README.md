# Demo

`demo/` is the source-of-truth folder for ClaudeMap's public demo story.

What lives here:

- `expressjs-cache.json` is the seeded graph cache used by the `--demo-cache` fallback for Express-shaped repos.
- `../contracts/claudemap-first-demo.json` is the curated self-demo graph that powers the public "Play with ClaudeMap's map" experience.

Public demo flow:

```powershell
npm run build-demo-site
```

That command builds the existing app as a static site, preloads the ClaudeMap self-demo graph, and writes the output to `docs/` for GitHub Pages hosting.

Packaged demo flow:

- `npm run package-skill` emits a single demo-ready project under `artifacts/claudemap-skill/claudemap/demo-packages/ClaudeMapDemo`.
- That package is a curated walkthrough of the ClaudeMap repository itself, not a generic sample repo.
