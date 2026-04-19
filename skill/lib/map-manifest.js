// map-manifest.js is a barrel that preserves the historical import path
// used by skill commands (setup-claudemap, update, create-map),
// skill/lib modules (active-map, scoped-map), and the app's vite config.
// The actual implementation lives under skill/lib/manifest/ and is split
// by concern:
//
//   manifest/io.js              - readManifest, writeManifest,
//                                 ensureManifestForSetup
//   manifest/normalize.js       - manifest shape, DEFAULT_MAP_ID,
//                                 createRootMapEntry,
//                                 createScopedMapDefaults,
//                                 normalizeManifest
//   manifest/migrations.js      - legacy path migrations for
//                                 graphPath/statePath entries
//   manifest/fingerprint.js     - computeScopeFingerprint,
//                                 createScopeDescriptor, plus the
//                                 shared node/ancestor helpers
//   manifest/scope-resolution.js - resolveScopeAgainstGraph (id,
//                                 file-path, fingerprint,
//                                 ancestor-label, label strategies)
//   manifest/index.js           - map-entry accessors (findMapById,
//                                 getActiveMap, setActiveMapId,
//                                 upsertMapEntry) + re-exports
//
// Nothing new should land in this file. New manifest surfaces go into
// the concern that owns them, and - if truly public - get re-exported
// from manifest/index.js, which this barrel forwards.

export * from './manifest/index.js'
