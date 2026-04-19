Welcome to...
![ClaudeMap](resources/img/ClaudeMapBranding.png)

[![Version](https://img.shields.io/badge/version-v0.2.0-blue)](CHANGELOG.md) [![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE) ![npm downloads](https://img.shields.io/npm/dw/%40quinnaho%2Fclaudemap) ![GitHub stars](https://img.shields.io/github/stars/QuinnAho/claudemap)

**Google Maps for vibecoders.**

AI lets you build faster than ever, but the very tools that help our productivity are leaving us behind - you don't understand what you're building anymore. You can vibecode a full app in a weekend and not even start to explain how it works. ClaudeMap fixes that.

Unlike traditional visualization tools, ClaudeMap organizes your code by what it actually does. Claude reads your project and groups it into concepts in a way you actually think about your project. Zoom out to see the big picture. Zoom in to see the details. Colors show what's healthy and what's broken. Use /explain and ask any question about your code, Claude will present directly on the map and explain step by step. Use /show to tell Claude what you want to find or see, and it moves the map for you.

All powered by the same AI you vibecode with.

## See It In Action

### What's Coming in v0.2.0

ClaudeMap is under active development. Here's what's landing next:

- **Sub-map support** — break larger codebases into focused sub-maps you can create and explore independently
- **Codex support** — use ClaudeMap with OpenAI Codex, not just Claude Code
- **Stable map generation** — consistent layouts across rebuilds and refreshes

Click Me ↓
[![ClaudeMap Demo](resources/img/thumbnail.png)](https://www.loom.com/share/6a2ff0948ae64ae6994fb3817cb3607e)

[Play with ClaudeMap's map](https://quinnaho.github.io/claudemap/) (preview, Claude features require Claude Code)

[Longer YouTube walkthrough](https://www.youtube.com/watch?v=mubRRx5mXzA) if you're into that kind of thing.

[Try the live demo](https://quinnaho.github.io/claudemap/) (preview only, full features require Claude Code or Codex)

## Install

```bash
npx @quinnaho/claudemap install
claude
/setup-claudemap
```

Codex users: `npx @quinnaho/claudemap install --assistant codex` - see [Codex guide](docs/CODEX.md).

In Codex, run `/skills`, choose `codexmap-runtime`, then prefix natural-language requests with `$codexmap-runtime`, for example:

```text
$codexmap-runtime build the initial architecture map for this repo
```

## Commands

| Command | Description |
|---------|-------------|
| `/setup-claudemap` | Analyze your repo and generate the map |
| `/refresh` | Update map after code changes |
| `/explain` | AI-guided walkthroughs with visual highlighting |
| `/show` | Navigate the map with natural language |

## What's New in v0.2.0

- **Multi-map support** - create scoped maps for large codebases
- **Codex support** - works with Claude Code and OpenAI Codex
- **Stable map generation** - consistent layouts across rebuilds
- **Iterative refinement** - tweak your map without starting over
- **Better refresh UX** - smoother updates after code changes

## Learn More

- [Full Guide](docs/GUIDE.md) - setup walkthrough, commands, multi-map workflow
- [Codex Guide](docs/CODEX.md) - Codex-specific setup and commands
- [Changelog](CHANGELOG.md) - version history
- [Contributing](CONTRIBUTING.md) - help improve ClaudeMap

## License

MIT
