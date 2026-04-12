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
  const isPresentationHighlight = data.isHighlighted && data.highlightMode === 'presentation'
  const isSubtleHighlight = data.isHighlighted && !isPresentationHighlight
  const hasNestedFunctions = (data.visibleFunctionCount || 0) > 0
  const restingOpacity = data.isGhosted ? 0.14 : data.isDimmed ? 0.48 : 1
  const finalOpacity = isVisible ? restingOpacity : 0
  const borderColor = data.isSelected
    ? 'rgba(232, 97, 60, 0.7)'
    : isPresentationHighlight
      ? 'rgba(232, 97, 60, 0.42)'
      : isSubtleHighlight
        ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(255, 255, 255, 0.05)'
  const boxShadow = data.isSelected
    ? '0 0 0 1px rgba(232, 97, 60, 0.12), 0 10px 22px rgba(232, 97, 60, 0.15)'
    : isPresentationHighlight
      ? '0 0 0 1px rgba(232, 97, 60, 0.08), 0 8px 18px rgba(232, 97, 60, 0.12)'
      : isSubtleHighlight
        ? '0 0 0 1px rgba(255, 255, 255, 0.025), 0 3px 8px rgba(0, 0, 0, 0.2)'
      : '0 2px 8px rgba(0, 0, 0, 0.22)'
  const showDescription = !data.hideDescription && data.isSelected && data.summary

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
        backgroundColor: isPresentationHighlight
          ? 'rgba(28, 18, 14, 0.96)'
          : isSubtleHighlight
            ? 'rgba(19, 19, 19, 0.96)'
            : 'rgba(18, 18, 18, 0.96)',
        border: `1px solid ${borderColor}`,
        borderRadius: '10px',
        boxShadow,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        opacity: finalOpacity,
        transform:
          data.isPresentationLead ? 'translateY(0) scale(1.03)' : 'translateY(0) scale(1)',
        transition:
          'opacity 0.24s ease, transform 0.26s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Handle type="target" position={Position.Top} style={hiddenHandleStyle} />
      <Handle type="source" position={Position.Bottom} style={hiddenHandleStyle} />

      <FloatingDescription text={data.summary} visible={showDescription} position="above" />

      <div
        style={{
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '10px',
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: isPresentationHighlight ? '#fff4ef' : 'var(--text-primary)',
            fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            lineHeight: 1.4,
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

      <div
        style={{
          flex: hasNestedFunctions ? 1 : 0,
          minHeight: hasNestedFunctions ? 0 : '0px',
          opacity: hasNestedFunctions ? 1 : 0,
          marginTop: hasNestedFunctions ? '6px' : '0px',
          transform: hasNestedFunctions ? 'translateY(0)' : 'translateY(-6px)',
          transition:
            'flex 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease, margin-top 0.28s cubic-bezier(0.22, 1, 0.36, 1), transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderTop:
              data.isPresentationLead || isPresentationHighlight
                ? '1px solid rgba(232, 97, 60, 0.18)'
                : '1px solid rgba(255, 255, 255, 0.06)',
            background:
              data.isPresentationLead || isPresentationHighlight
                ? 'linear-gradient(180deg, rgba(232, 97, 60, 0.06) 0%, rgba(232, 97, 60, 0.02) 100%)'
                : 'linear-gradient(180deg, rgba(255, 255, 255, 0.025) 0%, rgba(255, 255, 255, 0.01) 100%)',
          }}
        />
      </div>
    </div>
  )
}
