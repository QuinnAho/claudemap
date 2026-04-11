export const SYSTEM_NODE_MIN_HEIGHT = 70
export const SYSTEM_NODE_LAYOUT_HEIGHT = 84

export function getSystemNodeWidth(lineCount = 100) {
  return 180 + Math.min(100, (lineCount / 50) * 10)
}
