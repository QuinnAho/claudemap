import { Handle, Position } from '@xyflow/react'
import { useEffect, useState } from 'react'

const healthColors = {
  green: 'rgba(34, 197, 94, 0.4)',
  yellow: 'var(--health-yellow)',
  red: 'var(--health-red)',
}

const hiddenHandleStyle = {
  opacity: 0,
  pointerEvents: 'none',
}

export default function FileNode({ data }) {
  const [isVisible, setIsVisible] = useState(false)
  const finalOpacity = isVisible ? (data.isDimmed ? 0.4 : 1) : 0
  const boxShadow = data.isSelected
    ? '0 1px 4px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(232, 97, 60, 0.18)'
    : '0 1px 4px rgba(0, 0, 0, 0.2)'

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsVisible(true)
    }, 30)

    return () => window.clearTimeout(timeoutId)
  }, [])

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '10px 14px',
        minWidth: '120px',
        maxWidth: '180px',
        boxShadow,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        opacity: finalOpacity,
        transition: 'opacity 0.18s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        borderColor: data.isSelected ? 'rgba(232, 97, 60, 0.65)' : 'var(--border)',
      }}
    >
      <Handle type="target" position={Position.Top} style={hiddenHandleStyle} />
      <Handle type="source" position={Position.Bottom} style={hiddenHandleStyle} />

      <span
        style={{
          fontSize: '12px',
          color: 'var(--text-primary)',
          fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={data.label}
      >
        {data.label}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <span
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
          }}
        >
          {data.lineCount}L
        </span>

        {data.health && data.health !== 'green' && (
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: healthColors[data.health],
            }}
          />
        )}
      </div>
    </div>
  )
}
