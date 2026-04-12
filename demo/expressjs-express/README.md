# Express Demo Sandbox

This folder is a compact, non-production mirror of the systems shown in the
default ClaudeMap sample graph.

It exists so the demo map points at real files:

- `lib/express.js`
- `lib/application.js`
- `lib/router/*`
- `lib/middleware/*`
- `lib/request.js`
- `lib/response.js`
- `lib/response/render.js`
- `lib/view.js`

The code is intentionally small and dependency-light, but the structure,
imports, and exported entry points line up with the demo graph.

The sample graph is intentionally more opinionated than the compact code in
this folder. That means system boundaries, node labels, and exports match,
while some line-count-based health callouts stay illustrative for demo use.
