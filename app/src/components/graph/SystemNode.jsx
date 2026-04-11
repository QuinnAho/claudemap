import { Handle, Position } from '@xyflow/react'
import { getNodeIcon } from './nodeIcons'
import { getSystemNodeWidth, SYSTEM_NODE_MIN_HEIGHT } from './systemNodeSizing'

const healthColors = {
  green: 'rgba(34, 197, 94, 0.4)',
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

function truncateSummary(summary = '') {
  if (summary.length <= 60) {
    return summary
  }

  return `${summary.slice(0, 57)}...`
}

export default function SystemNode({ data }) {
  const Icon = getNodeIcon(data.icon)
  const width = getSystemNodeWidth(data.lineCount)
  const summary = truncateSummary(data.summary)
  const backgroundColor = data.healthOverlay
    ? healthBackgrounds[data.health] || healthBackgrounds.green
    : 'var(--bg-card)'
  const baseStyle = {
    backgroundColor,
    border: '1px solid var(--border)',
    borderLeft: `3px solid ${healthColors[data.health] || healthColors.green}`,
    borderRadius: '12px',
    padding: '16px',
    width: `${width}px`,
    minHeight: `${SYSTEM_NODE_MIN_HEIGHT}px`,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    opacity: data.isDimmed ? 0.4 : 1,
    transition:
      'opacity 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease',
  }

  if (data.health === 'red') {
    baseStyle.boxShadow =
      '0 2px 8px rgba(0, 0, 0, 0.3), 0 0 12px rgba(239, 68, 68, 0.15)'
  }

  if (data.isSelected) {
    baseStyle.borderColor = 'rgba(232, 97, 60, 0.65)'
    baseStyle.boxShadow = `${baseStyle.boxShadow}, 0 0 0 1px rgba(232, 97, 60, 0.18)`
  }

  return (
    <div style={baseStyle}>
      <Handle type="target" position={Position.Top} style={hiddenHandleStyle} />
      <Handle type="source" position={Position.Bottom} style={hiddenHandleStyle} />

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

        {data.health && data.health !== 'green' && (
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: healthColors[data.health],
              flexShrink: 0,
            }}
          />
        )}
      </div>

      <div
        style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={data.summary}
      >
        {summary}
      </div>
    </div>
  )
}
