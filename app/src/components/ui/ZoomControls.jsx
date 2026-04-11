import { Locate, Minus, Plus } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'

export default function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  const buttonStyle = {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
  }

  const dividerStyle = {
    width: '100%',
    height: '1px',
    backgroundColor: 'var(--border)',
  }

  const setHoverColor = (event, color) => {
    event.currentTarget.style.color = color
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      <button
        style={buttonStyle}
        onClick={() => zoomIn({ duration: 300 })}
        onMouseEnter={(event) => setHoverColor(event, 'var(--text-primary)')}
        onMouseLeave={(event) => setHoverColor(event, 'var(--text-secondary)')}
      >
        <Plus size={16} />
      </button>
      <div style={dividerStyle} />
      <button
        style={buttonStyle}
        onClick={() => zoomOut({ duration: 300 })}
        onMouseEnter={(event) => setHoverColor(event, 'var(--text-primary)')}
        onMouseLeave={(event) => setHoverColor(event, 'var(--text-secondary)')}
      >
        <Minus size={16} />
      </button>
      <div style={dividerStyle} />
      <button
        style={buttonStyle}
        onClick={() => fitView({ duration: 500, padding: 0.2 })}
        onMouseEnter={(event) => setHoverColor(event, 'var(--text-primary)')}
        onMouseLeave={(event) => setHoverColor(event, 'var(--text-secondary)')}
      >
        <Locate size={16} />
      </button>
    </div>
  )
}
