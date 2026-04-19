import {
  CACHE_FILENAME,
  DEFAULT_MAP_ID,
  MAPS_MANIFEST_FILENAME,
  RUNTIME_GRAPH_REL,
  RUNTIME_STATE_REL,
} from '../contracts/paths'
import { PRESENTATION_MODES } from '../contracts/presentation'
import { getBrand } from './brand'

// Unified shape predicates - imported from skill/lib/contracts/schemas/
// so the app and skill share a single source of truth (Phase 7 follow-up).
import {
  isGraphPayload,
  isMapsManifest,
  isRuntimeEnvelope,
} from '../../../skill/lib/contracts/schemas/index.js'

export { isGraphPayload, isMapsManifest, isRuntimeEnvelope }

// Pure helpers for runtime data loading. No React, no store. Imported by
// useRuntimeGraph (loader pipeline) and by future tests/inspectors.

export function createDefaultRuntimeEnvelope() {
  return {
    graphRevision: -1,
    updatedAt: '',
    graphMeta: null,
    runtime: {
      healthOverlay: false,
      highlightedNodeIds: [],
      highlightColor: 'accent',
      focus: null,
      guidedFlow: null,
      presentation: {
        mode: PRESENTATION_MODES.FREE,
        lockInput: false,
        title: null,
        explanation: null,
        body: null,
        stepLabel: null,
        updatedAt: null,
      },
    },
  }
}

export function createLegacyManifest() {
  return {
    version: 1,
    activeMapId: DEFAULT_MAP_ID,
    maps: [
      {
        id: DEFAULT_MAP_ID,
        label: getBrand().displayName,
        summary: 'Full repo overview',
        scope: null,
        cachePath: CACHE_FILENAME,
        graphPath: RUNTIME_GRAPH_REL,
        statePath: RUNTIME_STATE_REL,
      },
    ],
  }
}

export function getActiveMapEntry(manifest) {
  if (!isMapsManifest(manifest)) {
    return createLegacyManifest().maps[0]
  }

  return manifest.maps.find((entry) => entry.id === manifest.activeMapId) || manifest.maps[0] || null
}

export function getRuntimeSignature(runtimeEnvelope) {
  return [
    runtimeEnvelope.graphRevision,
    runtimeEnvelope.updatedAt || '',
    JSON.stringify(runtimeEnvelope.runtime || {}),
  ].join(':')
}

export function getManifestSignature(manifest) {
  return JSON.stringify(manifest || {})
}

function createPublicAssetUrl(relativePath) {
  if (typeof window === 'undefined') {
    return `${import.meta.env.BASE_URL}${relativePath}`
  }

  const baseOrigin = new URL(import.meta.env.BASE_URL, window.location.origin)
  return new URL(relativePath, baseOrigin)
}

let seedGraphPromise = null

export async function loadSeedGraph() {
  if (!seedGraphPromise) {
    seedGraphPromise = import('../../../contracts/claudemap-seed-map.json')
      .then((module) => module.default || module)
      .catch(() => null)
  }

  return seedGraphPromise
}

export async function fetchGraphAsset(relativePath) {
  try {
    const runtimeGraphUrl = createPublicAssetUrl(relativePath)
    runtimeGraphUrl.searchParams.set('t', String(Date.now()))

    const response = await window.fetch(runtimeGraphUrl, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const graphData = await response.json()
    return isGraphPayload(graphData) ? graphData : null
  } catch {
    return null
  }
}

export async function fetchRuntimeEnvelopeAsset(relativePath) {
  try {
    const runtimeStateUrl = createPublicAssetUrl(relativePath)
    runtimeStateUrl.searchParams.set('t', String(Date.now()))

    const response = await window.fetch(runtimeStateUrl, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const runtimeEnvelope = await response.json()
    return isRuntimeEnvelope(runtimeEnvelope) ? runtimeEnvelope : null
  } catch {
    return null
  }
}

export async function fetchMapsManifest() {
  try {
    const manifestUrl = createPublicAssetUrl(MAPS_MANIFEST_FILENAME)
    manifestUrl.searchParams.set('t', String(Date.now()))

    const response = await window.fetch(manifestUrl, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return createLegacyManifest()
    }

    const manifest = await response.json()
    return isMapsManifest(manifest) ? manifest : createLegacyManifest()
  } catch {
    return createLegacyManifest()
  }
}
