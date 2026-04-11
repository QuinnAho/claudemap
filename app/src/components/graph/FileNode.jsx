import { Handle, Position } from '@xyflow/react'
import { useEffect, useState } from 'react'
import FloatingDescription from './FloatingDescription'

const healthColors = {
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
  const borderColor = data.isSelected
    ? 'rgba(232, 97, 60, 0.7)'
    : data.isHighlighted
      ? 'rgba(255, 255, 255, 0.16)'
      : 'rgba(255, 255, 255, 0.05)'
  const boxShadow = data.isSelected
    ? '0 2px 10px rgba(0, 0, 0, 0.3)'
    : '0 2px 8px rgba(0, 0, 0, 0.22)'
  const showDescription = data.isSelected && data.summary

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsVisible(true)
    }, 30)

    return () => window.clearTimeout(timeoutId)
  }, [])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(18, 18, 18, 0.96)',
        border: `1px solid ${borderColor}`,
        borderRadius: '10px',
        padding: '10px 12px',
        boxShadow,
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        opacity: finalOpacity,
        transition: 'opacity 0.18s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={hiddenHandleStyle} />
      <Handle type="source" position={Position.Bottom} style={hiddenHandleStyle} />

      <FloatingDescription text={data.summary} visible={showDescription} position="above" />

      <span
        style={{
          fontSize: '12px',
          color: 'var(--text-primary)',
          fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
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
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: healthColors[data.health],
            }}
          />
        )}
      </div>
    </div>
  )
}
