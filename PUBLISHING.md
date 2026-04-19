# Publishing ClaudeMap

This repository is set up to publish the `@quinnaho/claudemap` npm package as a
scoped public CLI.

## Current Status

- Git remote: `https://github.com/QuinnAho/claudemap.git`
- npm package name: `@quinnaho/claudemap`
- Registry check date: `2026-04-12`

The unscoped `claudemap` name is blocked by npm's similarity policy, so the
scoped package is the intended public release target.

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

2. Confirm your npm access and package metadata.

```bash
npm whoami
npm pkg get name version
```

3. Verify the package builds cleanly.

```bash
npm run build
```

4. Run the package smoke test.

```bash
npm test
```

This builds the local ClaudeMap artifacts, installs them into throwaway fixture repositories, runs the installed commands, and verifies the packaged Claude/Codex command docs and runtime graph layout.

If you want an additional manual install in a separate target repository:

```bash
npm run pack:test
npm exec --package="<absolute-path-to-artifacts/npm/quinnaho-claudemap-<version>.tgz>" -- claudemap install
```

5. Verify the publish bundle.

```bash
npm pack --dry-run --cache artifacts/.npm-cache
npm publish --dry-run --cache artifacts/.npm-cache
```

6. Commit and tag the release.

```bash
git add .
git commit -m "Release v0.2.0"
git tag v0.2.0
```

7. Publish the release.

```bash
npm publish --access public
```

8. Verify the live package page.

```text
https://www.npmjs.com/package/@quinnaho/claudemap
```

## Notes

- `prepack` already stages the bundled `.claude` artifact automatically.
- `npm test` is the fastest repo-local end-to-end package validation path.
- `npm run pack:test` creates a real tarball in `artifacts/npm/`.
- The published tarball currently contains only the installer CLI and bundled
  runtime artifact, not the demo packages.
- The publish command does not run the app at publish time; it only packages
  the installer bundle.

## References

- npm public package guide: `https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages`
- npm publish docs: `https://docs.npmjs.com/cli/v8/commands/npm-publish`
- npm package.json docs: `https://docs.npmjs.com/cli/v9/configuring-npm/package-json`
