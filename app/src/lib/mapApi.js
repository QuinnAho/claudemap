function createApiUrl(relativePath) {
  if (typeof window === 'undefined') {
    return `${import.meta.env.BASE_URL}${relativePath.replace(/^\//, '')}`
  }

  const baseOrigin = new URL(import.meta.env.BASE_URL, window.location.origin)
  return new URL(relativePath.replace(/^\//, ''), baseOrigin)
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
    let errorMessage = 'Failed to switch ClaudeMap'

    try {
      const payload = await response.json()
      errorMessage = payload?.error || errorMessage
    } catch {
      errorMessage = await response.text()
    }

    throw new Error(errorMessage)
  }

  return response.json()
}
