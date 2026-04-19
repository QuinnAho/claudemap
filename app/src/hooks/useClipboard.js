import { getBrand } from '../lib/brand'

function buildNodeContextText(nodeData, meta = {}) {
  const nodeType = nodeData.type ? `\nType: ${nodeData.type}` : ''
  const repoLine = meta.repoName ? `\nRepo: ${meta.repoName}` : ''
  const healthLine =
    nodeData.health && nodeData.health !== 'green'
      ? `\nHealth: ${nodeData.health} - ${nodeData.healthReason || 'unknown'}`
      : ''
  const brandLabel = getBrand().displayName

  return `[${brandLabel}] ${nodeData.label}${repoLine}${nodeType}
Path: ${nodeData.filePath}
Summary: ${nodeData.summary}${healthLine}
Lines: ${nodeData.lineCount}`
}

function copyTextWithExecCommand(text) {
  if (typeof document === 'undefined') {
    return false
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  let copied = false

  try {
    copied = document.execCommand('copy')
  } catch (error) {
    console.error('Failed to copy node reference:', error)
  } finally {
    document.body.removeChild(textarea)
  }

  return copied
}

export async function copyTextToClipboard(text) {
  if (!text) {
    return false
  }

  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      console.error('Failed to copy node reference via Clipboard API:', error)
    }
  }

  return copyTextWithExecCommand(text)
}

export async function copyNodeToClipboard(nodeData, meta = {}) {
  if (!nodeData) {
    return false
  }

  return copyTextToClipboard(buildNodeContextText(nodeData, meta))
}
