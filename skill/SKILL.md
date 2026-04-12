---
name: claudemap-runtime
description: Internal ClaudeMap runtime bundle used by /setup-claudemap, /open-claudemap, /refresh, /explain, and /claudemap-control. Prefer the packaged commands in .claude/commands for normal use.
---

This skill is shared infrastructure for the ClaudeMap command set.

Use the public command layer for normal operation:

- `/setup-claudemap` to analyze and render a graph
- `/open-claudemap` to reopen the existing UI
- `/refresh` after code changes
- `/update` as the compatibility alias
- `/explain` for guided walkthroughs
- `/claudemap-control` for manual map control

If this skill is invoked directly, run the bundled ClaudeMap setup workflow.

Target project root:

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
5. Save the subagent result to `${CLAUDE_SKILL_DIR}/tmp/claudemap-enrichment.json`.
6. Run `${CLAUDE_SKILL_DIR}/skill/commands/setup-claudemap.js` for the target project root with `--enrichment-file ${CLAUDE_SKILL_DIR}/tmp/claudemap-enrichment.json`.
7. Add `--force-refresh` only when the user explicitly asks for a fresh rebuild.
8. If the subagent fails to return valid JSON, fall back to running `${CLAUDE_SKILL_DIR}/skill/commands/setup-claudemap.js` without the override.
9. Let the bundled launcher start the app unless the user explicitly asks not to.
10. Summarize the analyzed file count, system count, graph source, render transport, and app readiness.

Important details:

- The bundled runtime lives inside this skill directory, so keep all paths anchored to `${CLAUDE_SKILL_DIR}`.
- The current Node runtime still supports deterministic and demo-backed fallback, but `/setup-claudemap` should try the `@claudemap-architect` subagent path first.
- The packaged project also includes a `claudemap-architect` subagent in `.claude/agents/` for system identification, graph reshaping, and architecture-map refinement tasks.
- If a cached Claude-authored graph already exists, do not replace it with a heuristic regeneration unless the user explicitly asks for `--force-refresh`.
- If the user only wants to reopen the existing map UI, use `/open-claudemap` instead of rerunning setup.
- Follow-up refreshes should use the `/refresh` command shipped in `.claude/commands/refresh.md`.
- `/update` remains as a compatibility alias for `/refresh`.
- Live UI controls should use `/claudemap-control`.
