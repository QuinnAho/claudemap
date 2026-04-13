# Publishing ClaudeMap

This repository is set up to publish the `claudemap` npm package as an
unscoped public CLI.

## Current Status

- Git remote: `https://github.com/QuinnAho/claudemap.git`
- npm package name checked: `claudemap`
- npm registry check result: `npm view claudemap` returned `404 Not Found`
- Registry check date: `2026-04-12`

Re-check the name immediately before the first real publish in case availability
changes.

## Prerequisites

- npm account access for the publishing user
- `npm login` already completed locally
- npm publishing enabled with either:
  - two-factor authentication, or
  - a granular access token with bypass 2FA enabled

## Release Checklist

1. Review local changes.

```bash
git status
git diff --stat
```

2. Confirm the package name is still available.

```bash
npm view claudemap name version description
```

3. Verify the package builds cleanly.

```bash
npm run build
```

4. Verify the publish bundle.

```bash
npm pack --dry-run
npm publish --dry-run
```

5. Commit and tag the release.

```bash
git add .
git commit -m "Release v0.1.0"
git tag v0.1.0
```

6. Publish the first public release.

```bash
npm publish
```

7. Verify the live package page.

```text
https://www.npmjs.com/package/claudemap
```

## If The Name Becomes Unavailable

Switch to a scoped public package and publish with explicit public access.

Example:

```bash
# after changing package.json name to your scope
npm publish --access public
```

If you take that route, update:

- `package.json`
- `README.md`
- `PUBLISHING.md`

## Notes

- `prepack` already stages the bundled `.claude` artifact automatically.
- The published tarball currently contains only the installer CLI and bundled
  runtime artifact, not the demo packages.
- The publish command does not run the app at publish time; it only packages
  the installer bundle.
- Current npm CLI versions can emit a false-positive warning that the `bin`
  field was removed during `npm publish --dry-run`. The packed tarball was
  verified locally and still contains `"bin": "./bin/claudemap.js"`.

## References

- npm public package guide: `https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages`
- npm publish docs: `https://docs.npmjs.com/cli/v8/commands/npm-publish`
- npm package.json docs: `https://docs.npmjs.com/cli/v9/configuring-npm/package-json`
- npm CLI issue: `https://github.com/npm/cli/issues/7302`
