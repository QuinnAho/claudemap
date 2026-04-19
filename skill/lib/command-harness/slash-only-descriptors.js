// Slash-command descriptors that have no underlying runtime command.
// They exist purely so renderSlashTemplate can produce their .md files
// from the same descriptor shape as the real commands.

export const EXPLAIN_SLASH_COMMAND = {
  name: 'explain',
  summary: 'Explain part of the codebase by turning the live map into a guided walkthrough.',
  argumentHint: '[topic-or-click-context]',
  body: `Use ClaudeMap as a guided presentation tool.

Workflow:
1. If the user provided ClaudeMap click context, extract the label, path, and type from it.
2. If the user provided a plain topic or node name, use that as the walkthrough anchor.
3. If no usable topic is available, ask the user to click a node in ClaudeMap and paste the copied context, or provide a topic directly.
4. Read the currently active ClaudeMap runtime graph rather than assuming the root map.
5. For broad or ambiguous requests, use the \`@claudemap-architect\` subagent to turn the request into a short walkthrough plan of 2-6 steps that follows intuitive architectural groupings.
6. Start presentation mode by running \`node .claude/skills/claudemap-runtime/skill/commands/show.js mode guided\`.
7. Drive the map in discrete steps. Prefer one present command per explanation beat so the highlight, navigation, and narration update atomically. Pass \`--keep-mode\` on every \`present\` and \`highlight\` step so the guided mode set in step 6 persists across steps instead of auto-reverting to free:
   - \`node .claude/skills/claudemap-runtime/skill/commands/show.js present <query> --title "..." --step "Step 1" --explain "..." --keep-mode\`
   - \`node .claude/skills/claudemap-runtime/skill/commands/show.js highlight <query> --keep-mode\`
   - \`node .claude/skills/claudemap-runtime/skill/commands/show.js health on\`
   - \`node .claude/skills/claudemap-runtime/skill/commands/show.js flow <query1> <query2> ...\`
8. Treat each show command as the visual step boundary. Do not rely on plain chat text streaming alone for transitions.
9. When the explanation is complete, always release the map by running:
   - \`node .claude/skills/claudemap-runtime/skill/commands/show.js clear-caption\`
   - \`node .claude/skills/claudemap-runtime/skill/commands/show.js mode free\`
10. Use high-level, intuitive language first. Prefer plain-English descriptions of purpose, flow, and impact before lower-level implementation details.
11. Keep narration concise and synchronized to the step you just triggered.`,
}
