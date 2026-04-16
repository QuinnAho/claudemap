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

export async function setActiveMap(mapId) {
  const response = await window.fetch(createApiUrl('/__claudemap/active-map'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mapId }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to switch ClaudeMap'))
  }

  return response.json()
}
