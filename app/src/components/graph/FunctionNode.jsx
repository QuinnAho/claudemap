import { useEffect, useState } from 'react'
import { MOTION } from '../../contracts/motion'
import { FONT, alpha } from '../../contracts/tokens'
import NodeHandles from './NodeHandles'
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
  const revealDelayMs = Math.min((data.revealIndex || 0) * MOTION.revealIndexStep, MOTION.revealIndexMax)
  const backgroundColor = data.isSelected
    ? alpha('accent', 0.18)
    : isPresentationHighlight
      ? alpha('accent', 0.12)
      : isSubtleHighlight
        ? alpha('white', 0.025)
      : alpha('card', 0.82)
  const borderColor = data.isSelected
    ? alpha('accent', 0.55)
    : isPresentationHighlight
      ? alpha('accent', 0.34)
      : isSubtleHighlight
      ? alpha('white', 0.08)
      : alpha('white', 0.05)
  const restingOpacity = data.isGhosted ? 0.16 : data.isDimmed ? 0.48 : 1
  const finalOpacity = isRevealActive ? restingOpacity : 0

  useEffect(() => {
    setIsRevealActive(false)
    const timeoutId = window.setTimeout(() => {
      setIsRevealActive(true)
    }, revealDelayMs + MOTION.revealActivation)

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
          ? `0 8px 18px ${alpha('accent', 0.14)}`
          : isPresentationHighlight
          ? `0 6px 14px ${alpha('accent', 0.1)}`
          : isSubtleHighlight
            ? `0 3px 8px ${alpha('black', 0.14)}`
            : 'none',
        transition:
          'opacity var(--motion-surface-duration) var(--motion-ease-soft), transform var(--motion-surface-duration) var(--motion-ease-smooth), background-color var(--motion-quick-duration) var(--motion-ease-soft), border-color var(--motion-quick-duration) var(--motion-ease-soft), box-shadow var(--motion-surface-duration) var(--motion-ease-soft)',
      }}
    >
      <NodeHandles style={hiddenHandleStyle} />

      <span
        style={{
          display: 'block',
          fontSize: '11px',
          color: isLead || isPresentationHighlight ? 'var(--text-highlight)' : 'var(--text-secondary)',
          fontFamily: FONT.mono,
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
