// enrichment.js is a barrel that preserves the historical import path used
// by skill commands (setup-claudemap, update, create-map) and by the seed
// map's filePath reference. The actual implementation lives under
// skill/lib/enrichment/ and is split by concern:
//
//   enrichment/prompts.js          - filesystem reads for the prompt + agent
//   enrichment/graph-validation.js - parseGraphResponse + validateGraph
//   enrichment/icons.js            - iconForSystem heuristic
//   enrichment/health.js           - per-file + per-system thresholds
//   enrichment/source-priority.js  - priority table + preference policy
//   enrichment/index.js            - heuristic graph builder + orchestrators
//
// Nothing new should land in this file. New enrichment surfaces go into the
// concern that owns them, and - if truly public - get re-exported from
// enrichment/index.js, which this barrel forwards.

export * from './enrichment/index.js'
