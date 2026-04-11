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
  const strokeOpacity = data?.isHighlighted ? 0.92 : data?.isDimmed ? 0.18 : 0.54
  const strokeWidth = data?.isHighlighted ? 2.1 : 1.7

  return (
    <path
      id={id}
      d={edgePath}
      fill="none"
      stroke="rgba(255, 255, 255, 0.14)"
      strokeWidth={strokeWidth}
      strokeOpacity={strokeOpacity}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: 'stroke-opacity 0.2s ease, stroke-width 0.2s ease',
      }}
    />
  )
}
