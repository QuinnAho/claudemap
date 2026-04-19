import { useEffect, useState } from 'react'
import { MOTION } from '../../contracts/motion'
import { FONT, alpha } from '../../contracts/tokens'
import FloatingDescription from './FloatingDescription'
import NodeHandles from './NodeHandles'

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
    ? alpha('accent', 0.7)
    : isPresentationHighlight
      ? alpha('accent', 0.42)
      : isSubtleHighlight
        ? alpha('white', 0.08)
      : alpha('white', 0.05)
  const boxShadow = data.isSelected
    ? `0 0 0 1px ${alpha('accent', 0.12)}, 0 10px 22px ${alpha('accent', 0.15)}`
    : isPresentationHighlight
      ? `0 0 0 1px ${alpha('accent', 0.08)}, 0 8px 18px ${alpha('accent', 0.12)}`
      : isSubtleHighlight
        ? `0 0 0 1px ${alpha('white', 0.025)}, 0 3px 8px ${alpha('black', 0.2)}`
      : `0 2px 8px ${alpha('black', 0.22)}`
  const showDescription = !data.hideDescription && data.isSelected && data.summary

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsVisible(true)
    }, MOTION.nodeVisibility)

    return () => window.clearTimeout(timeoutId)
  }, [])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: isPresentationHighlight
          ? alpha('highlightAccentBg', 0.96)
          : isSubtleHighlight
            ? alpha('highlightNeutralBg', 0.96)
            : alpha('floating', 0.96),
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
          'opacity var(--motion-surface-duration) var(--motion-ease-soft), transform var(--motion-layout-duration) var(--motion-ease-smooth), box-shadow var(--motion-surface-duration) var(--motion-ease-soft), border-color var(--motion-surface-duration) var(--motion-ease-soft)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <NodeHandles style={hiddenHandleStyle} />

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
            color: isPresentationHighlight ? 'var(--text-highlight)' : 'var(--text-primary)',
            fontFamily: FONT.mono,
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
            'flex var(--motion-surface-duration) var(--motion-ease-smooth), opacity var(--motion-surface-duration) var(--motion-ease-soft), margin-top var(--motion-surface-duration) var(--motion-ease-smooth), transform var(--motion-surface-duration) var(--motion-ease-smooth)',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderTop:
              data.isPresentationLead || isPresentationHighlight
                ? `1px solid ${alpha('accent', 0.18)}`
                : `1px solid ${alpha('white', 0.06)}`,
            background:
              data.isPresentationLead || isPresentationHighlight
                ? `linear-gradient(180deg, ${alpha('accent', 0.06)} 0%, ${alpha('accent', 0.02)} 100%)`
                : `linear-gradient(180deg, ${alpha('white', 0.025)} 0%, ${alpha('white', 0.01)} 100%)`,
          }}
        />
      </div>
    </div>
  )
}
