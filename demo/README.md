# Demo Sandboxes

ClaudeMap now packages two demo-ready project sandboxes under
`artifacts/claudemap-skill/claudemap/demo-packages/`:

- `FirstDemo`: a curated walkthrough of the ClaudeMap repository itself, seeded
  from `contracts/claudemap-first-demo.json`
- `SecondDemo`: the current Express-shaped demo, seeded from
  `contracts/claudemap.sample.json`

`demo/expressjs-express/` remains the source sandbox for `SecondDemo`. Running
`npm run package-skill` refreshes its `.claude/` install so the source demo
still works locally:

```powershell
npm run setup-claudemap -- demo/expressjs-express
```

The Express sandbox is intentionally lightweight. It is meant for map demos,
clipboard context, explain mode, and refresh flows, not for running a real
server.

For non-demo repositories, use the generic installer instead:

```powershell
npm run install-claudemap -- ..\some-other-repo
```

After the package is published, the equivalent public flow is:

```powershell
npx claudemap install ..\some-other-repo
```
