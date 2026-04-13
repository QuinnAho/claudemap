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
5. Save the subagent result to `${CLAUDE_SKILL_DIR}/tmp/claudemap-enrichment.json`.
6. Run `${CLAUDE_SKILL_DIR}/skill/commands/setup-claudemap.js` for the target project root with `--enrichment-file ${CLAUDE_SKILL_DIR}/tmp/claudemap-enrichment.json`.
7. Add `--force-refresh` only when the user explicitly asks for a fresh rebuild.
8. If the subagent fails to return valid JSON, fall back to running `${CLAUDE_SKILL_DIR}/skill/commands/setup-claudemap.js` without the override.
9. Let the bundled launcher start the app unless the user explicitly asks not to.
10. Summarize the analyzed file count, system count, graph source, render transport, and app readiness.

Important details:

- The bundled runtime lives inside this skill directory, so keep all paths anchored to `${CLAUDE_SKILL_DIR}`.
- `/setup-claudemap` should treat the `@claudemap-architect` path as the primary path, not an optional extra.
- The packaged project includes a `claudemap-architect` subagent in `.claude/agents/` for system identification, graph refinement, and human-first graph restructuring.
- If a cached Claude-authored graph already exists, do not replace it with a heuristic regeneration unless the user explicitly asks for `--force-refresh`.
- If the user only wants to reopen the existing map UI, use `/open-claudemap` instead of rerunning setup.
- Follow-up refreshes should use the `/refresh` command shipped in `.claude/commands/refresh.md`.
- `/show` should be treated as a presentation-direction command, not just a low-level transport wrapper.
