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
  const strokeOpacity = data?.isHighlighted ? 0.8 : data?.isDimmed ? 0.1 : 0.4
  const strokeWidth = data?.isHighlighted ? 1.8 : 1.5

  return (
    <path
      id={id}
      d={edgePath}
      fill="none"
      stroke="var(--border-light)"
      strokeWidth={strokeWidth}
      strokeOpacity={strokeOpacity}
      style={{
        transition: 'stroke-opacity 0.2s ease, stroke-width 0.2s ease',
      }}
    />
  )
}
