---
name: claudemap-runtime
description: Internal ClaudeMap runtime for turning a repository into a live architecture map and driving that map during walkthroughs. Prefer the public commands in .claude/commands for normal use.
---

ClaudeMap is a repo-to-architecture-map workflow.

High-level model:

- snapshot the repository
- ask `@claudemap-architect` to turn that snapshot into a detailed, human-legible graph
- render the graph in the bundled ClaudeMap UI
- keep the graph and presentation state updated as the user explores the codebase

Public commands:

- `/setup-claudemap`: build or rebuild the map for the current repository
- `/open-claudemap`: reopen the existing UI without rebuilding
- `/create-map`: create or refresh a scoped subsystem map from the current root graph
- `/refresh`: update the graph after code changes
- `/explain`: run a guided walkthrough through the live map
- `/show`: direct the live map for highlights, focus, presentation, and flows

If this skill is invoked directly, default to the setup workflow.

Target repository:

- If the user passed an argument to the invoked skill command, use `$ARGUMENTS` as the project root.
- If no argument was passed, use the current working directory.

Execution rules:

1. Resolve the bundled ClaudeMap workspace from `${CLAUDE_SKILL_DIR}`.
2. Generate a raw repo snapshot by running `${CLAUDE_SKILL_DIR}/skill/commands/snapshot.js` for the target project root.
3. Read `${CLAUDE_SKILL_DIR}/skill/prompts/enrichment.txt`.
4. Use the `@claudemap-architect` subagent explicitly. Give it:
   - the raw snapshot JSON
   - the graph schema contract from the enrichment prompt
   - instructions to return only valid graph JSON
   - instructions to optimize for a detailed graph with intuitive human grouping
5. **Wait for the subagent Task call to fully return**, then save the returned JSON to `${CLAUDE_SKILL_DIR}/tmp/claudemap-enrichment.json`. Do not run the setup JS command until after this file has been written with non-empty valid graph JSON. Do not run setup in parallel with the subagent call.
6. Run `${CLAUDE_SKILL_DIR}/skill/commands/setup-claudemap.js` for the target project root with `--enrichment-file ${CLAUDE_SKILL_DIR}/tmp/claudemap-enrichment.json`. The setup command is strict: if the file is missing, empty, or unparseable it will exit non-zero and refuse to render a heuristic graph. Do not retry setup without fixing the enrichment file first.
7. Add `--force-refresh` only when the user explicitly asks for a fresh rebuild.
8. If the subagent fails to return valid JSON after two attempts, tell the user the architect pass failed and stop. Do not silently rerun setup without `--enrichment-file` — that would render a heuristic graph and pollute the cache. The user should rerun `/setup-claudemap` once the architect issue is resolved.
9. Let the bundled launcher start the app unless the user explicitly asks not to.
10. Summarize the analyzed file count, system count, graph source, render transport, and app readiness. Runtime graph outputs land in `${CLAUDE_SKILL_DIR}/app/public/graph/` (served by the bundled Vite app as `/graph/*`).
11. End the graph-generation flow with a short feedback prompt such as: `Does this map look right, or should I refine it?`
12. If the user says the map is good, stop there.
13. If the user asks for refinement, reuse the current target project's `claudemap-cache.json` graph and file snapshot as context when available instead of starting from a blank prompt again.
14. For refinement passes, send the existing graph plus the user's requested changes back through `@claudemap-architect`, save the refined JSON to `${CLAUDE_SKILL_DIR}/tmp/claudemap-enrichment.json`, and run `${CLAUDE_SKILL_DIR}/skill/commands/update.js` with `--enrichment-file` so the graph iterates in place.
15. After the refined graph renders, ask the same short feedback prompt again.

`/create-map` shares this same post-render feedback loop:

- After `${CLAUDE_SKILL_DIR}/skill/commands/create-map.js` renders the scoped map, ask the same short feedback prompt (`Does this map look right, or should I refine it?`).
- If the user says it looks good, stop there.
- If the user asks for refinement, reuse the scoped map's own cache (look up the new map entry in the target project's repo-root `claudemap-maps.json` and read its `cachePath`) as context for `@claudemap-architect` instead of rebuilding from the root graph. Save the refined JSON to `${CLAUDE_SKILL_DIR}/tmp/claudemap-enrichment.json` and rerun `${CLAUDE_SKILL_DIR}/skill/commands/create-map.js` with the same `--scope-json` payload plus `--enrichment-file` so the scoped graph iterates in place for the same scoped map entry instead of being rebuilt from the root graph.
- After the refined scoped graph renders, ask the same short feedback prompt again.

Important details:

- The bundled runtime lives inside this skill directory, so keep all paths anchored to `${CLAUDE_SKILL_DIR}`.
- `/setup-claudemap` should treat the `@claudemap-architect` path as the primary path, not an optional extra.
- The packaged project includes a `claudemap-architect` subagent in `.claude/agents/` for system identification, graph refinement, and human-first graph restructuring.
- If a cached Claude-authored graph already exists, do not replace it with a heuristic regeneration unless the user explicitly asks for `--force-refresh`.
- If the user only wants to reopen the existing map UI, use `/open-claudemap` instead of rerunning setup.
- Follow-up refreshes should use the `/refresh` command shipped in `.claude/commands/refresh.md`.
- Graph refinements should prefer `${CLAUDE_SKILL_DIR}/skill/commands/update.js --enrichment-file ...` over rerunning setup so the current graph context is reused.
- `/show` should be treated as a presentation-direction command, not just a low-level transport wrapper.
