import { getBezierPath } from '@xyflow/react'

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })
  const isSelectionTrace = data?.isSelectionTrace
  const isPresentationHighlight = data?.isHighlighted && data?.highlightMode === 'presentation'
  const isSubtleHighlight =
    data?.isHighlighted && !isPresentationHighlight && !isSelectionTrace
  const strokeOpacity = isSelectionTrace
    ? 0.88
    : isPresentationHighlight
    ? 0.9
    : isSubtleHighlight
      ? 0.6
      : data?.isDimmed
        ? 0.12
        : 0.52
  const strokeWidth = isSelectionTrace ? 2.35 : isPresentationHighlight ? 2.2 : isSubtleHighlight ? 1.9 : 1.8
  const stroke = isSelectionTrace
    ? 'rgba(232, 97, 60, 0.82)'
    : isPresentationHighlight
    ? 'rgba(232, 97, 60, 0.9)'
    : isSubtleHighlight
      ? 'rgba(232, 97, 60, 0.24)'
      : 'rgba(255, 255, 255, 0.22)'

  return (
    <path
      id={id}
      d={edgePath}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeOpacity={strokeOpacity}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        filter: isSelectionTrace ? 'drop-shadow(0 0 3px rgba(232, 97, 60, 0.14))' : 'none',
        transition:
          'stroke var(--motion-quick-duration) var(--motion-ease-soft), stroke-opacity var(--motion-quick-duration) var(--motion-ease-soft), stroke-width var(--motion-quick-duration) var(--motion-ease-soft), filter var(--motion-quick-duration) var(--motion-ease-soft)',
      }}
    />
  )
}
