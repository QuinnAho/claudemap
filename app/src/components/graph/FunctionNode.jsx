import { Handle, Position } from '@xyflow/react'

const hiddenHandleStyle = {
  opacity: 0,
  pointerEvents: 'none',
}

export default function FunctionNode({ data }) {
  const backgroundColor = data.isSelected ? 'rgba(232, 97, 60, 0.18)' : 'rgba(26, 26, 26, 0.8)'

  return (
    <div
      style={{
        backgroundColor,
        borderRadius: '4px',
        padding: '4px 10px',
        cursor: 'pointer',
        opacity: data.isDimmed ? 0.4 : 1,
        transition: 'opacity 0.2s ease, background-color 0.2s ease',
      }}
    >
      <Handle type="target" position={Position.Top} style={hiddenHandleStyle} />
      <Handle type="source" position={Position.Bottom} style={hiddenHandleStyle} />

      <span
        style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
          whiteSpace: 'nowrap',
        }}
      >
        {data.label}
      </span>
    </div>
  )
}
