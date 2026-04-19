import { API_ACTIVE_MAP_ENDPOINT } from '../contracts/paths'

// Client-side active-map override. On static builds (e.g. GitHub Pages) the
// Vite middleware that owns /__claudemap/active-map is absent, so POSTs from
// setActiveMap would 404. When that happens we persist the selection in the
// browser instead. useRuntimeGraph reads this override via
// getClientActiveMapOverride and uses it in place of manifest.activeMapId.

const CLIENT_ACTIVE_MAP_STORAGE_KEY = 'claudemap:activeMapId'

let clientActiveMapOverride = null

function readPersistedOverride() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null
  }

  try {
    return window.sessionStorage.getItem(CLIENT_ACTIVE_MAP_STORAGE_KEY) || null
  } catch {
    return null
  }
}

function writePersistedOverride(mapId) {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return
  }

  try {
    if (mapId) {
      window.sessionStorage.setItem(CLIENT_ACTIVE_MAP_STORAGE_KEY, mapId)
    } else {
      window.sessionStorage.removeItem(CLIENT_ACTIVE_MAP_STORAGE_KEY)
    }
  } catch {
    // Storage may be unavailable (private mode, quota); in-memory override
    // still works for the current page.
  }
}

export function getClientActiveMapOverride() {
  if (clientActiveMapOverride) {
    return clientActiveMapOverride
  }

  clientActiveMapOverride = readPersistedOverride()
  return clientActiveMapOverride
}

function setClientActiveMapOverride(mapId) {
  clientActiveMapOverride = mapId || null
  writePersistedOverride(clientActiveMapOverride)
}

function createApiUrl(relativePath) {
  if (typeof window === 'undefined') {
    return `${import.meta.env.BASE_URL}${relativePath.replace(/^\//, '')}`
  }

  const baseOrigin = new URL(import.meta.env.BASE_URL, window.location.origin)
  return new URL(relativePath.replace(/^\//, ''), baseOrigin)
}

async function readApiError(response, fallbackMessage) {
  try {
    const payload = await response.json()
    return payload?.error || payload?.reason || fallbackMessage
  } catch {
    try {
      const responseText = await response.text()
      return responseText || fallbackMessage
    } catch {
      return fallbackMessage
    }
  }
}

function isMissingEndpointStatus(status) {
  // 404 (no middleware) and 405 (static server returning 'Method not allowed'
  // for POST on an HTML file) both indicate the dev API isn't there.
  return status === 404 || status === 405
}

export async function setActiveMap(mapId) {
  let response
  try {
    response = await window.fetch(createApiUrl(API_ACTIVE_MAP_ENDPOINT), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mapId }),
    })
  } catch {
    // Network-level failure (no server at all): treat as static host.
    setClientActiveMapOverride(mapId)
    return { ok: true, activeMapId: mapId, source: 'client' }
  }

  if (response.ok) {
    setClientActiveMapOverride(null)
    return response.json()
  }

  if (isMissingEndpointStatus(response.status)) {
    setClientActiveMapOverride(mapId)
    return { ok: true, activeMapId: mapId, source: 'client' }
  }

  throw new Error(await readApiError(response, 'Failed to switch map'))
}
