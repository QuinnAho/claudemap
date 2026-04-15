import { Compass } from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import MapSelector from './MapSelector'

export default function TopBar() {
  const presentationMode = useGraphStore((state) => state.presentationMode)
  const headerText =
    presentationMode !== 'free'
      ? 'shhh... claude is presenting...'
      : ''

  return (
    <div
      style={{
        position: 'relative',
        height: '48px',
        backgroundColor: 'var(--bg-topbar)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Compass size={20} color="var(--accent)" />
        <span
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--accent)',
            letterSpacing: '-0.01em',
            fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
          }}
        >
          ClaudeMap
        </span>
      </div>

      {headerText ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '11px',
            letterSpacing: '0.08em',
            color: 'rgba(229, 229, 229, 0.52)',
            fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {headerText}
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <MapSelector />
      </div>
    </div>
  )
}
