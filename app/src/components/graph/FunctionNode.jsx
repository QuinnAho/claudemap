import { Handle, Position } from '@xyflow/react'
import { useEffect, useState } from 'react'
import { FUNCTION_NODE_WIDTH } from './systemNodeSizing'

const hiddenHandleStyle = {
  opacity: 0,
  pointerEvents: 'none',
}

export default function FunctionNode({ data }) {
  const [isRevealActive, setIsRevealActive] = useState(false)
  const isPresentationHighlight = data.isHighlighted && data.highlightMode === 'presentation'
  const isSubtleHighlight = data.isHighlighted && !isPresentationHighlight
  const isLead = data.isSelected || data.isPresentationLead
  const revealDelayMs = Math.min((data.revealIndex || 0) * 40, 140)
  const backgroundColor = data.isSelected
    ? 'rgba(232, 97, 60, 0.18)'
    : isPresentationHighlight
      ? 'rgba(232, 97, 60, 0.12)'
      : isSubtleHighlight
        ? 'rgba(255, 255, 255, 0.025)'
      : 'rgba(26, 26, 26, 0.82)'
  const borderColor = data.isSelected
    ? 'rgba(232, 97, 60, 0.55)'
    : isPresentationHighlight
      ? 'rgba(232, 97, 60, 0.34)'
      : isSubtleHighlight
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(255, 255, 255, 0.05)'
  const restingOpacity = data.isGhosted ? 0.16 : data.isDimmed ? 0.48 : 1
  const finalOpacity = isRevealActive ? restingOpacity : 0

  useEffect(() => {
    setIsRevealActive(false)
    const timeoutId = window.setTimeout(() => {
      setIsRevealActive(true)
    }, revealDelayMs + 24)

    return () => window.clearTimeout(timeoutId)
  }, [revealDelayMs])

  return (
    <div
      style={{
        width: `${FUNCTION_NODE_WIDTH}px`,
        backgroundColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '4px',
        padding: '4px 10px',
        cursor: 'pointer',
        opacity: finalOpacity,
        transform: isRevealActive
          ? isLead
            ? 'translateY(0) scale(1.04)'
            : 'translateY(0) scale(1)'
          : 'translateY(10px) scale(0.96)',
        boxShadow: data.isSelected
          ? '0 8px 18px rgba(232, 97, 60, 0.14)'
          : isPresentationHighlight
          ? '0 6px 14px rgba(232, 97, 60, 0.1)'
          : isSubtleHighlight
            ? '0 3px 8px rgba(0, 0, 0, 0.14)'
            : 'none',
        transition:
          'opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1), transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.22s ease',
      }}
    >
      <Handle type="target" position={Position.Top} style={hiddenHandleStyle} />
      <Handle type="source" position={Position.Bottom} style={hiddenHandleStyle} />

      <span
        style={{
          display: 'block',
          fontSize: '11px',
          color: isLead || isPresentationHighlight ? '#fff4ef' : 'var(--text-secondary)',
          fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {data.label}
      </span>
    </div>
  )
}
