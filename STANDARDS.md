# ClaudeMap Code Standards

These are the explicit rules every contributor (human or agent) follows when writing, reviewing, or refactoring ClaudeMap code. They exist because this project has been regressing as features are added, and the root cause is brittle, implicit, duplicated code. These standards eliminate that class of failure.

The guiding principle is simple: **code should read like a book.** A reader scanning a file top to bottom should be able to explain what it does, why it exists, and what changes safely — without opening any other file.

---

## 1. The Pillars (Why These Standards Exist)

Every standard below ties back to one of the project pillars:

1. **Accuracy** — graphs and runtime state must never silently diverge.
2. **User intuition** — interactions must behave consistently; no surprise side-effects.
3. **Easy agent interaction** — commands, prompts, and schemas must be predictable and self-describing.
4. **Simple workflow** — fewer moving parts, fewer steps, fewer magic words.
5. **Multi-agent ready** — shared state must have a single owner and a single mutation path.
6. **Professional UX** — motion, color, timing, and copy must come from one design system.
7. **Easy setup and dev testing** — every pipeline is reproducible without tribal knowledge.

If a change doesn't serve a pillar, don't make it.

---

## 2. Readability Rules (Code Reads Like a Book)

### 2.1 One file, one concept

A file's name is a promise. `enrichment.js` enriches; it does not also validate graphs, pick icons, score health, and load prompts. If a file does more than one thing, split it. The current `skill/lib/enrichment.js` and `skill/lib/map-manifest.js` violate this; new code must not.

### 2.2 Top-to-bottom narrative

Within a file, read order matches call order. Exports come last. Helpers sit above the function that calls them. A reader who starts at line 1 and stops at the bottom has seen every piece in the order it's used.

### 2.3 Names describe intent, not mechanics

- Good: `revertToFreeMode`, `resolveActiveMap`, `scheduleHoverPath`.
- Bad: `doStuff`, `handleData`, `processInput`, `util1`.
- Functions are verbs. State is a noun. Booleans start with `is`, `has`, `should`, or `can`.
- No abbreviations except domain terms already in the glossary (`mcp`, `elk`, `fs`).

### 2.4 Prefer prose over cleverness

Two clear lines beat one clever one. Ternaries nest at most once. Optional chaining stops at two levels; deeper means the shape is wrong and should be normalized upstream.

### 2.5 Comments explain *why*, never *what*

The code says what. Comments say why this approach was chosen, what invariant is being protected, or what would break if the code changed. If a comment paraphrases the next line, delete it.

### 2.6 No dead code, no "just in case" branches

Remove unused imports, parameters, flags, and state the moment they become unused. No `// TODO: maybe support X` and no orphan error branches that can't be reached. If the code doesn't run, it doesn't exist.

### 2.7 No emojis anywhere

Not in code, not in comments, not in strings shown in the UI or CLI, not in commit messages, not in markdown under `docs/`, `skill/`, or `scripts/`. The single exception is where a file is explicitly a user-facing design surface (icon sets, node symbols); those live in dedicated data modules, never inline.

---

## 3. Module Boundaries

ClaudeMap has four layers. A module belongs to exactly one.

| Layer | Path | Allowed to import from |
|---|---|---|
| Contracts | `skill/lib/contracts/`, `app/src/contracts/` | nothing (pure types, constants, schemas) |
| Domain | `skill/lib/`, `app/src/lib/` | Contracts |
| Interaction | `skill/commands/`, `app/src/hooks/`, `app/src/store/` | Contracts, Domain |
| Presentation | `app/src/components/`, `scripts/` templates | Contracts, Interaction |

Rules:

- A lower layer never imports from a higher one.
- Presentation never imports Domain directly. Components read state through hooks; hooks call domain functions. This prevents the "769-line component that knows everything" pattern.
- Contracts hold no logic — only shapes and constants. If a helper needs state or I/O, it isn't a contract.

### 3.1 Single source of truth for shared values

Every value that appears in more than one file lives in Contracts and is imported. Concretely:

- File paths (`graph/claudemap-runtime.json`, `.claude/skills/claudemap-runtime`, etc.) — `skill/lib/contracts/paths.js`
- Presentation modes (`free`, `guided`, `locked`) — `skill/lib/contracts/presentation.js`
- Graph source tags (`runtime`, `scoped`, `architect`, `file-shim`, `heuristic`, `claude`, `imported`, `manual`) and their priorities — `skill/lib/contracts/graph-sources.js`
- Manifest version, graph revision sentinel — `skill/lib/contracts/versions.js`
- UI motion durations, hover delays, poll intervals, zoom thresholds — `app/src/contracts/motion.js` and `app/src/contracts/zoom.js`
- Color tokens, spacing scale, typography — `app/src/contracts/tokens.js`, mirrored to `app/src/styles/globals.css` as CSS custom properties

If you are about to type the same string literal in a second file, stop and add it to contracts first.

---

## 4. Styling Standards

### 4.1 One design system, two surfaces

Every visual value lives in `app/src/contracts/tokens.js` (JS source of truth) and is mirrored into `app/src/styles/globals.css` as a CSS custom property. Components read from `tokens.js` for inline styles; CSS rules read from `var(--token)`. Nothing is hardcoded anywhere else.

### 4.2 No hex or rgba literals in components

A component that writes `rgba(232, 97, 60, 0.35)` is broken. It must use `tokens.accent.alpha35`. The existing 22 occurrences of the hardcoded accent color and the `#e8613c` vs `#df714c` mismatch are the exact bug this rule prevents.

### 4.3 Inline styles are for dynamic values only

Inline `style={{}}` is acceptable when a value is computed at render time (e.g., a position from graph layout). Static styling belongs in CSS classes or token-driven helpers. A component file that contains 200 lines of static `style={{}}` objects is failing this rule.

### 4.4 Motion comes from `--motion-*` tokens

Every `transition`, `animation`, and `setTimeout` that affects perceived motion reads its duration and easing from the motion tokens. No component invents its own `450ms cubic-bezier(...)`.

### 4.5 Spacing is a scale, not a menu

Use the 4px scale (`4, 8, 12, 16, 24, 32, 48`). If a design calls for `14px`, either round to the scale or add a new step to the token file with a justification.

### 4.6 Typography stacks are named

The monospace stack appears in eight places today. It lives in one token (`tokens.font.mono`) and is imported. Same for the sans stack.

---

## 5. State Management

### 5.1 One store, three slices

`useGraphStore` is split into three named slices with disjoint concerns:

- **graph slice** — nodes, edges, meta, maps manifest (data that comes from disk)
- **ui slice** — selection, hover, focus request, zoom level (data the user produces)
- **runtime slice** — presentation mode, guided flow, runtime controls (data synced from the skill)

Each slice has its own setters. A setter in one slice never writes fields owned by another.

### 5.2 Polling never touches UI-local state

Runtime polling writes only the runtime slice. If a UI-local field (hover, selection) ever needs to be derived from runtime state, that derivation happens in a selector, not a setter. This is the rule that would have prevented the hover-flicker regression currently patched with a defensive comment in `graphStore.js`.

### 5.3 Components use named selectors, not arrow functions

Instead of eleven `useGraphStore((s) => s.field)` calls in one component, export named selectors from the store file and import the ones needed. This makes refactors mechanical: rename a field, the compiler finds every caller.

### 5.4 Mutations are functions on the slice; they are the only write path

No component, hook, or external caller ever writes `store.setState` directly. Every mutation is a named method on a slice. This is what "single mutation path" means in practice.

### 5.5 Derived state is derived, not stored

If a value can be computed from other state, compute it in a selector. Do not cache it in the store. Cached derived state is the single largest source of "the UI disagrees with itself" bugs.

---

## 6. Async and Lifecycle

### 6.1 Every resource acquisition has a guaranteed release

MCP clients, file handles, subscriptions, timers, and event listeners are acquired in exactly one place and released in exactly one place. The pattern is `try { ... } finally { release() }` or a `withResource(async (r) => {...})` helper. Never scatter release calls across success branches — the sixteen `closeMcpClient` calls in `show.js` are the anti-pattern.

### 6.2 Commands use a single command harness

Every skill command calls one harness:

```js
runCommand({
  name: 'show',
  parseArgs,
  withMcp: true,
  handler: async ({ args, client, project }) => { ... },
})
```

The harness owns argument parsing, project root resolution, MCP open/close, error formatting, and exit codes. Commands describe intent; the harness handles plumbing.

### 6.3 Fallbacks are loud

A fallback is a degraded state. Every fallback path logs one structured warning with a stable code (e.g., `MCP_FALLBACK_FILE_SHIM`, `SEED_MAP_MISSING`). Silent fallbacks are forbidden; they are how packaging and runtime drift without anyone noticing.

### 6.4 Never catch without a reason

`try { ... } catch {}` with no body is forbidden. Every catch block either recovers meaningfully, logs with context, or rethrows with an enriched message. If you don't know what to do with the error, don't catch it.

### 6.5 Timing values are named

No bare numbers in `setTimeout`, `setInterval`, or motion APIs. Every duration has a named token (`POLL_RUNTIME_MS`, `HOVER_ENTER_DELAY_MS`, `GUIDED_STEP_DEFAULT_MS`). Accessibility audits and perf tuning are impossible otherwise.

---

## 7. Command and Slash-Command Design

### 7.1 Commands are declarative

A command file exports a descriptor: name, argument schema, flags, handler. The harness consumes the descriptor. Help text, usage strings, and the markdown template are generated from it. Duplicated usage strings and diverging templates are the current failure mode.

### 7.2 Slash-command markdown is generated, not authored

Slash-command templates in `scripts/package-claudemap-skill.js` are not hand-written strings. They are rendered from each command's descriptor. If a command grows a new flag, the template updates automatically.

### 7.3 One flag, one meaning, one place

Flags are defined once in the descriptor. `--keep-mode`, `--no-start-app`, `--scope-json` each appear in exactly one schema. No second parser, no second validator.

### 7.4 Presentation-setting commands revert by default

Any command that places the UI in `guided` or `locked` mode reverts to `free` at the end of its handler unless `--keep-mode` is passed. Multi-step workflows like `/explain` pass `--keep-mode` explicitly on every step.

### 7.5 Commands are idempotent or clearly not

A command either always produces the same observable end state for the same inputs, or it is named to signal otherwise (`append-`, `rotate-`). Hidden statefulness is a user-trust bug.

---

## 8. Data Contracts

### 8.1 Every persisted shape has a schema

Graphs, manifests, runtime envelopes, install records, cache files — each has a schema in Contracts. Readers validate on load. Writers validate on write. An unvalidated `JSON.parse` is a future regression.

### 8.2 Versioned, with migrations

Every persisted shape has a `version` field. Every version bump ships with a `migrate(fromVersion, data)` function. No silent compatibility drift.

### 8.3 Paths in data are POSIX

Internally stored paths use `/` separators. Platform-specific conversion happens at I/O boundaries only, through one `toPosix` / `fromPosix` pair in Domain.

### 8.4 IDs are stable and opaque

Node IDs, map IDs, system IDs do not encode information a reader should parse. If you need a human label, that's a separate field. This prevents the "rename breaks fingerprint" class of bug seen in scoped map resolution.

---

## 9. Error Handling

### 9.1 Two categories, two behaviors

- **Expected failures** (user input, missing files at optional paths, network blips) — return a structured result `{ ok: false, code, message, hint }`.
- **Unexpected failures** (bugs, invariant violations) — throw. The harness converts throws to exit codes and structured CLI output.

Mixing these (returning `null` on bugs, throwing on bad input) is the pattern that makes debugging painful today.

### 9.2 Error codes are strings from a shared table

`skill/lib/contracts/errors.js` lists every error code. Callers match on codes, not substrings of messages. Messages are free to improve; codes are stable.

### 9.3 Every error message answers three questions

What happened. Why it matters. What the user can do next. A message that only says "Failed to load graph" is half-finished.

---

## 10. Packaging and Install

### 10.1 One path module, referenced by every script

`scripts/constants.js` (or equivalent) defines `REPO_ROOT`, `CLAUDE_ROOT`, `SKILL_ROOT`, `COMMANDS_ROOT`, `AGENTS_ROOT`, `ARTIFACT_NAME`, `MANIFEST_FILE_NAME`, `BUNDLE_DIR`. Every script imports from there. No script redefines these.

### 10.2 Managed paths are derived, not listed

The installer cleanup list is computed from the same descriptor that drove the packaging. Package and install share one module. Drift between the two produced orphan files is not possible by construction.

### 10.3 Bundle exclusions are explicit and tested

Exclusion rules live in a data structure, not a regex cascade. The smoke test asserts that each excluded pattern actually excludes something, and that each expected output file actually exists with the expected shape.

### 10.4 Smoke test asserts behavior, not shape alone

For every shipped command, the smoke test executes the command against a fixture and validates the resulting graph JSON against its schema. "Did not throw" is insufficient.

### 10.5 Install is atomic or resumable

If `npm install` fails mid-install, the installer either rolls back to the previous state or writes a resumable marker. Partial `.claude/` trees with broken dependencies are not an acceptable outcome.

---

## 11. Testing

### 11.1 Every domain function has a unit test

Pure functions in `skill/lib/` and `app/src/lib/` are tested in isolation. Tests live beside the source as `<name>.test.js`.

### 11.2 Every command has an integration test

Runs the command through its harness against a fixture project; asserts file outputs, exit code, and stdout shape.

### 11.3 Every UI state transition has a store test

Zustand slices are tested by dispatching actions and asserting state. No DOM required.

### 11.4 No test reaches into internals it shouldn't

Tests use the same public API a consumer would. Reaching into private helpers couples tests to implementation and blocks refactors.

---

## 12. Performance and Responsiveness

### 12.1 The graph is the hot path

Any code that runs inside a render or layout cycle is measured before it ships. The 769-line `GraphCanvas` with eleven selectors is failing this rule today because each selector re-renders the whole tree on unrelated state changes.

### 12.2 Poll intervals have budgets

Runtime poll (`POLL_RUNTIME_MS`) has a documented cost ceiling. If a poll cycle's work grows past the budget, the work is moved to an event-driven path, not solved by increasing the interval.

### 12.3 Animations respect reduced-motion

Every motion token has a reduced-motion fallback. The `prefers-reduced-motion` media query shortens durations to 0 across the board.

---

## 13. Commit and PR Hygiene

### 13.1 One commit, one intent

If the diff needs the word "and" to describe it, split it. Refactors and behavior changes do not share a commit.

### 13.2 Commit messages describe why

The title says what changed. The body says why. "Fix bug" is never an acceptable message.

### 13.3 No formatting-only noise mixed with logic

Prettier/formatting changes are their own commit. They never ride along with a behavior change.

### 13.4 PR descriptions answer four questions

What. Why. How verified. What could regress. The last one is mandatory — it forces the author to think about the exact failure mode these standards exist to prevent.

---

## 14. Deprecation and Change

### 14.1 Breaking changes ship with a migration

Any change that alters a persisted shape, a command flag, a slash-command surface, or a public token ships with: (a) a migration function, (b) a changelog entry, (c) a smoke-test fixture proving old data still loads.

### 14.2 Removing code is a feature

When a concept is retired, every reference to it goes in the same PR. No `// legacy, remove later`. No renamed but unused exports. No shims "for backwards compatibility" that nothing depends on.

### 14.3 Documentation changes in the same PR

`SKILL.md`, command templates, and `README.md` are part of the code. If behavior changes without docs changing, the PR is incomplete.

---

## 15. Enforcement

These standards are enforced by, in descending order of reliability:

1. **Types and schemas** — a contract violation fails the build.
2. **Lint rules** — no inline hex, no bare timing numbers, no cross-layer imports, no emoji.
3. **Smoke test** — every shipped path runs end-to-end.
4. **Code review** — every PR is read against this document.
5. **This file** — read it before writing, not after failing.

When a regression is discovered, it is not fixed in isolation. It is traced to the standard that would have prevented it, and either the code or the standard is updated. Standards without teeth decay; this document is living.
