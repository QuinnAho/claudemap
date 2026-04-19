import { GRAPH_DIR_NAME, RUNTIME_GRAPH_FILENAME, RUNTIME_STATE_FILENAME } from '../contracts/paths.js'

// migrations owns the one-shot path fixups applied to legacy manifest
// entries as they are read from disk. Early versions of the manifest
// stored graphPath / statePath as bare filenames (the runtime graph
// and runtime state filenames from the paths contract, without a
// directory prefix); the runtime now expects them to sit under graph/
// so open-claudemap and the app can find them. These helpers promote a
// legacy filename to the graph/<filename> form while leaving
// already-correct paths untouched.
//
// DEFAULT_MAP_ID is imported by callers of migrateLegacyMapEntryPaths; it
// is declared in normalize.js since that is where the manifest shape
// originates. We accept it as an argument rather than importing it to
// keep migrations.js free of cyclic imports.

export function migrateLegacyRuntimePath(relativePath, fallbackPath) {
  if (typeof relativePath !== 'string' || relativePath.trim().length === 0) {
    return fallbackPath
  }

  const trimmedPath = relativePath.trim()
  const normalizedPath = trimmedPath.replace(/\\/g, '/')

  if (normalizedPath.includes('/')) {
    return trimmedPath
  }

  if (
    normalizedPath === RUNTIME_GRAPH_FILENAME ||
    normalizedPath === RUNTIME_STATE_FILENAME ||
    /^claudemap-runtime\.[^/]+\.json$/.test(normalizedPath) ||
    /^claudemap-runtime-state\.[^/]+\.json$/.test(normalizedPath)
  ) {
    return `${GRAPH_DIR_NAME}/${normalizedPath}`
  }

  return trimmedPath
}

export function migrateLegacyMapEntryPaths(mapEntry, defaultMapId) {
  if (!mapEntry || typeof mapEntry !== 'object') {
    return mapEntry
  }

  const defaultGraphFileName =
    mapEntry.id === defaultMapId
      ? RUNTIME_GRAPH_FILENAME
      : `claudemap-runtime.${mapEntry.id}.json`
  const defaultStateFileName =
    mapEntry.id === defaultMapId
      ? RUNTIME_STATE_FILENAME
      : `claudemap-runtime-state.${mapEntry.id}.json`

  return {
    ...mapEntry,
    graphPath: migrateLegacyRuntimePath(
      mapEntry.graphPath,
      `${GRAPH_DIR_NAME}/${defaultGraphFileName}`,
    ),
    statePath: migrateLegacyRuntimePath(
      mapEntry.statePath,
      `${GRAPH_DIR_NAME}/${defaultStateFileName}`,
    ),
  }
}
