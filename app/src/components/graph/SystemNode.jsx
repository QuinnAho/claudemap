import { Handle, Position } from '@xyflow/react'
import { ChevronDown } from 'lucide-react'
import { getNodeIcon } from './nodeIcons'
import { SYSTEM_NODE_HEADER_HEIGHT, SYSTEM_NODE_MIN_HEIGHT } from './systemNodeSizing'
import FloatingDescription from './FloatingDescription'

const healthColors = {
  yellow: 'var(--health-yellow)',
  red: 'var(--health-red)',
}

const healthBackgrounds = {
  green: 'rgba(34, 197, 94, 0.05)',
  yellow: 'rgba(234, 179, 8, 0.08)',
  red: 'rgba(239, 68, 68, 0.1)',
}

const hiddenHandleStyle = {
  opacity: 0,
  pointerEvents: 'none',
}

export default function SystemNode({ data }) {
  const Icon = getNodeIcon(data.icon)
  const isExpanded = data.isExpanded
  const hasChildren = data.hasChildren
  const showDescription = data.isSelected && data.summary

  const surfaceColor = data.healthOverlay
    ? healthBackgrounds[data.health] || healthBackgrounds.green
    : 'var(--bg-card)'
  const borderColor = data.isSelected
    ? 'rgba(232, 97, 60, 0.7)'
    : isExpanded
      ? 'var(--border-light)'
      : 'transparent'
  const baseStyle = {
    width: '100%',
    height: '100%',
    backgroundColor: isExpanded ? 'rgba(255, 255, 255, 0.01)' : surfaceColor,
    border: `1px solid ${borderColor}`,
    borderRadius: '12px',
    minHeight: `${SYSTEM_NODE_MIN_HEIGHT}px`,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    opacity: data.isDimmed ? 0.32 : 1,
    transition:
      'opacity 0.25s ease, box-shadow 0.25s ease, background-color 0.3s ease, border-color 0.25s ease',
  }

  return (
    <div style={{ ...baseStyle, position: 'relative' }}>
      <Handle type="target" position={Position.Top} style={hiddenHandleStyle} />
      <Handle type="source" position={Position.Bottom} style={hiddenHandleStyle} />

      <FloatingDescription text={data.summary} visible={showDescription} position="above" />

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
          transition: 'min-height 0.3s ease, border-bottom 0.3s ease',
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
            <Icon size={20} color="var(--text-secondary)" />
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary)',
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
                  transition: 'transform 0.25s ease',
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
            'linear-gradient(180deg, rgba(255, 255, 255, 0.025) 0%, rgba(255, 255, 255, 0.01) 100%)',
          borderTop: isExpanded ? '1px dashed rgba(255, 255, 255, 0.04)' : 'none',
          opacity: isExpanded ? 1 : 0,
          transition: 'flex 0.3s ease, opacity 0.3s ease, border-top 0.3s ease',
          overflow: 'hidden',
        }}
      />
    </div>
  )
}
