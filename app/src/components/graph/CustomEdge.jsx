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
  const isPresentationHighlight = data?.isHighlighted && data?.highlightMode === 'presentation'
  const isSubtleHighlight = data?.isHighlighted && !isPresentationHighlight
  const strokeOpacity = isPresentationHighlight
    ? 0.9
    : isSubtleHighlight
      ? 0.6
      : data?.isDimmed
        ? 0.12
        : 0.52
  const strokeWidth = isPresentationHighlight ? 2.2 : isSubtleHighlight ? 1.9 : 1.8
  const stroke = isPresentationHighlight
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
        transition:
          'stroke 0.2s ease, stroke-opacity 0.2s ease, stroke-width 0.2s ease',
      }}
    />
  )
}
