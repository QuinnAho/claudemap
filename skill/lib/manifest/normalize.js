import { CACHE_FILENAME, GRAPH_DIR_NAME, RUNTIME_GRAPH_FILENAME, RUNTIME_STATE_FILENAME } from '../contracts/paths.js'
import { migrateLegacyMapEntryPaths } from './migrations.js'

// normalize owns the manifest shape: version, activeMapId, maps[], and
// the default entries for the root map and any freshly minted scoped
// map. normalizeManifest is idempotent and tolerant - it accepts any
// shape (including null), coerces it to the canonical form, and runs
// each entry through the legacy-path migration before returning.
//
// DEFAULT_MAP_ID lives here too because the manifest is where the "root
// map has id 'root'" convention originates.

export const DEFAULT_MAP_ID = 'root'
export const MANIFEST_VERSION = 1

export function createRootMapEntry() {
  return {
    id: DEFAULT_MAP_ID,
    label: 'ClaudeMap',
    summary: 'Full repo overview',
    scope: null,
    cachePath: CACHE_FILENAME,
    graphPath: `${GRAPH_DIR_NAME}/${RUNTIME_GRAPH_FILENAME}`,
    statePath: `${GRAPH_DIR_NAME}/${RUNTIME_STATE_FILENAME}`,
  }
}

export function createScopedMapDefaults(mapId) {
  return {
    id: mapId,
    label: mapId,
    summary: '',
    scope: null,
    cachePath: `claudemap-cache.${mapId}.json`,
    graphPath: `${GRAPH_DIR_NAME}/claudemap-runtime.${mapId}.json`,
    statePath: `${GRAPH_DIR_NAME}/claudemap-runtime-state.${mapId}.json`,
  }
}

export function createDefaultManifest() {
  return {
    version: MANIFEST_VERSION,
    activeMapId: DEFAULT_MAP_ID,
    maps: [createRootMapEntry()],
  }
}

export function normalizeManifest(manifest) {
  const nextManifest =
    manifest && typeof manifest === 'object'
      ? {
          version: MANIFEST_VERSION,
          activeMapId: typeof manifest.activeMapId === 'string' ? manifest.activeMapId : DEFAULT_MAP_ID,
          maps: Array.isArray(manifest.maps)
            ? manifest.maps
                .map((entry) => {
                  if (!entry?.id) {
                    return null
                  }

                  if (entry.id === DEFAULT_MAP_ID) {
                    return migrateLegacyMapEntryPaths(
                      {
                        ...createRootMapEntry(),
                        ...entry,
                        id: DEFAULT_MAP_ID,
                        scope: null,
                      },
                      DEFAULT_MAP_ID,
                    )
                  }

                  return migrateLegacyMapEntryPaths(
                    {
                      ...createScopedMapDefaults(entry.id),
                      ...entry,
                      scope: entry.scope
                        ? {
                            ...entry.scope,
                            stale: entry.scope.stale === true,
                            needsRebuild: entry.scope.needsRebuild === true,
                          }
                        : null,
                    },
                    DEFAULT_MAP_ID,
                  )
                })
                .filter(Boolean)
            : [],
        }
      : createDefaultManifest()

  const rootEntryIndex = nextManifest.maps.findIndex((entry) => entry?.id === DEFAULT_MAP_ID)

  if (rootEntryIndex === -1) {
    nextManifest.maps.unshift(createRootMapEntry())
  }

  if (!nextManifest.maps.some((entry) => entry?.id === nextManifest.activeMapId)) {
    nextManifest.activeMapId = DEFAULT_MAP_ID
  }

  return nextManifest
}
