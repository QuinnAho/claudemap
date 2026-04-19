import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { alpha } from '../../contracts/tokens'
import { getNodeIcon } from './nodeIcons'
import MapAffordance from './MapAffordance'
import NodeHandles from './NodeHandles'
import { SYSTEM_NODE_HEADER_HEIGHT, SYSTEM_NODE_MIN_HEIGHT } from './systemNodeSizing'
import FloatingDescription from './FloatingDescription'

const healthColors = {
  yellow: 'var(--health-yellow)',
  red: 'var(--health-red)',
}

const healthBackgrounds = {
  green: alpha('healthGreen', 0.05),
  yellow: alpha('healthYellow', 0.08),
  red: alpha('healthRed', 0.1),
}

const hiddenHandleStyle = {
  opacity: 0,
  pointerEvents: 'none',
}

export default function SystemNode({ data }) {
  const [isHovered, setIsHovered] = useState(false)
  const Icon = getNodeIcon(data.icon)
  const isExpanded = data.isExpanded
  const hasChildren = data.hasChildren
  const showDescription = !data.hideDescription && data.isSelected && data.summary
  const isHighlighted = data.isHighlighted && !data.isSelected
  const isPresentationHighlight = isHighlighted && data.highlightMode === 'presentation'
  const isSubtleHighlight = isHighlighted && !isPresentationHighlight
  const isPresentationAncestor = data.isPresentationAncestor && !data.isPresentationLead

  const surfaceColor = data.healthOverlay
    ? healthBackgrounds[data.health] || healthBackgrounds.green
    : isPresentationHighlight
      ? alpha('accent', 0.08)
      : isSubtleHighlight
        ? alpha('white', 0.012)
      : 'var(--bg-card)'
  const restingOpacity = data.isGhosted
    ? 0.1
    : isPresentationAncestor
      ? 0.2
      : data.isDimmed
        ? 0.42
        : 1
  const borderColor = data.isSelected
    ? alpha('accent', 0.7)
    : isPresentationHighlight
      ? alpha('accent', 0.42)
      : isSubtleHighlight
        ? alpha('white', 0.07)
    : isExpanded
      ? 'var(--border-light)'
      : 'transparent'
  const baseStyle = {
    width: '100%',
    height: '100%',
    backgroundColor: surfaceColor,
    border: `1px solid ${borderColor}`,
    borderRadius: '12px',
    minHeight: `${SYSTEM_NODE_MIN_HEIGHT}px`,
    boxShadow: isPresentationAncestor
      ? 'none'
      : data.isSelected
      ? `0 0 0 1px ${alpha('accent', 0.12)}, 0 10px 24px ${alpha('accent', 0.14)}`
      : isPresentationHighlight
        ? `0 0 0 1px ${alpha('accent', 0.1)}, 0 8px 22px ${alpha('accent', 0.12)}`
        : isSubtleHighlight
          ? `0 0 0 1px ${alpha('white', 0.025)}, 0 3px 8px ${alpha('black', 0.22)}`
        : `0 2px 8px ${alpha('black', 0.3)}`,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    opacity: restingOpacity,
    transform:
      data.isPresentationLead ? 'translateY(0) scale(1.02)' : 'translateY(0) scale(1)',
    transition:
      'opacity var(--motion-surface-duration) var(--motion-ease-soft), transform var(--motion-layout-duration) var(--motion-ease-smooth), box-shadow var(--motion-surface-duration) var(--motion-ease-soft), background-color var(--motion-surface-duration) var(--motion-ease-soft), border-color var(--motion-surface-duration) var(--motion-ease-soft)',
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'visible' }}
    >
      <NodeHandles style={hiddenHandleStyle} />

      <FloatingDescription text={data.summary} visible={showDescription} position="above" />
      {data.mapAffordance ? (
        <div
          style={{
            position: 'absolute',
            top: '2px',
            right: '9px',
            zIndex: 4,
            opacity: isHovered ? 1 : 0,
            transform: isHovered ? 'translateY(0)' : 'translateY(-2px)',
            transition:
              'opacity var(--motion-quick-duration) var(--motion-ease-soft), transform var(--motion-quick-duration) var(--motion-ease-soft)',
            pointerEvents: isHovered ? 'auto' : 'none',
          }}
        >
          <MapAffordance affordance={data.mapAffordance} />
        </div>
      ) : null}

      <div style={baseStyle}>
        <div
          style={{
            minHeight: isExpanded ? `${SYSTEM_NODE_HEADER_HEIGHT}px` : '100%',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '10px',
            backgroundColor: surfaceColor,
            borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
            transition:
              'min-height var(--motion-surface-duration) var(--motion-ease-smooth), border-bottom var(--motion-surface-duration) var(--motion-ease-soft)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: 0,
              }}
            >
              <Icon
                size={20}
                color={
                  data.isSelected || isPresentationHighlight
                    ? 'var(--accent)'
                    : isSubtleHighlight
                      ? alpha('highlightText', 0.55)
                      : 'var(--text-secondary)'
                }
              />
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color:
                    data.isSelected || isPresentationHighlight
                      ? 'var(--text-highlight)'
                      : 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {data.label}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {data.health && data.health !== 'green' && (
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: healthColors[data.health],
                  }}
                />
              )}

              {hasChildren && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition:
                      'transform var(--motion-surface-duration) var(--motion-ease-smooth)',
                    transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                  }}
                >
                  <ChevronDown size={16} color="var(--text-muted)" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            flex: isExpanded ? 1 : 0,
            background:
              `linear-gradient(180deg, ${alpha('white', 0.025)} 0%, ${alpha('white', 0.01)} 100%)`,
            borderTop: isExpanded ? `1px dashed ${alpha('white', 0.04)}` : 'none',
            opacity: isExpanded ? 1 : 0,
            transition:
              'flex var(--motion-surface-duration) var(--motion-ease-smooth), opacity var(--motion-surface-duration) var(--motion-ease-soft), border-top var(--motion-surface-duration) var(--motion-ease-soft)',
            overflow: 'hidden',
          }}
        />
      </div>
    </div>
  )
}
