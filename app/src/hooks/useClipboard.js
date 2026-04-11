export function copyNodeToClipboard(nodeData) {
  if (!navigator?.clipboard?.writeText) {
    return
  }

  const healthLine =
    nodeData.health && nodeData.health !== 'green'
      ? `\nHealth: ${nodeData.health} - ${nodeData.healthReason || 'unknown'}`
      : ''

  const text = `[ClaudeMap] ${nodeData.label}
Path: ${nodeData.filePath}
Summary: ${nodeData.summary}${healthLine}
Lines: ${nodeData.lineCount}`

  navigator.clipboard.writeText(text).catch((error) => {
    console.error('Failed to copy node reference:', error)
  })
}
