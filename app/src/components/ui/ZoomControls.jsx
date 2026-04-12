import { Activity, Locate, Minus, Plus } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useGraphStore } from '../../store/graphStore'

export default function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const healthOverlay = useGraphStore((state) => state.healthOverlay)
  const setHealthOverlay = useGraphStore((state) => state.setHealthOverlay)
  const presentationMode = useGraphStore((state) => state.presentationMode)

  const islandStyle = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.18)',
  }

  const getButtonStyle = (isActive = false) => ({
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
    transition: 'color 0.18s ease',
    opacity: 1,
  })

  const dividerStyle = {
    width: '100%',
    height: '1px',
    backgroundColor: 'var(--border)',
  }

  const setHoverColor = (event, { hover, active = false }) => {
    event.currentTarget.style.color = hover ? 'var(--text-primary)' : active ? 'var(--accent)' : 'var(--text-secondary)'
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 10,
        pointerEvents: 'auto',
      }}
    >
      {presentationMode === 'free' ? (
        <div style={islandStyle}>
          <button
            style={getButtonStyle(healthOverlay)}
            onClick={() => setHealthOverlay(!healthOverlay)}
            onMouseEnter={(event) => setHoverColor(event, { hover: true, active: healthOverlay })}
            onMouseLeave={(event) => setHoverColor(event, { hover: false, active: healthOverlay })}
            aria-label="Toggle health overlay"
          >
            <Activity size={16} />
          </button>
        </div>
      ) : null}

      <div style={islandStyle}>
        <button
          style={getButtonStyle()}
          onClick={() => zoomIn({ duration: 300 })}
          onMouseEnter={(event) => setHoverColor(event, { hover: true })}
          onMouseLeave={(event) => setHoverColor(event, { hover: false })}
          aria-label="Zoom in"
        >
          <Plus size={16} />
        </button>
        <div style={dividerStyle} />
        <button
          style={getButtonStyle()}
          onClick={() => zoomOut({ duration: 300 })}
          onMouseEnter={(event) => setHoverColor(event, { hover: true })}
          onMouseLeave={(event) => setHoverColor(event, { hover: false })}
          aria-label="Zoom out"
        >
          <Minus size={16} />
        </button>
        <div style={dividerStyle} />
        <button
          style={getButtonStyle()}
          onClick={() => fitView({ duration: 500, padding: 0.2, maxZoom: 0.65 })}
          onMouseEnter={(event) => setHoverColor(event, { hover: true })}
          onMouseLeave={(event) => setHoverColor(event, { hover: false })}
          aria-label="Fit view"
        >
          <Locate size={16} />
        </button>
      </div>
    </div>
  )
}
