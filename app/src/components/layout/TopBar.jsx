import { Compass } from 'lucide-react'
import { useState } from 'react'
import { PRESENTATION_MODES } from '../../contracts/presentation'
import { setActiveMap } from '../../lib/mapApi'
import { useGraphStore } from '../../store/graphStore'
import MapSelector from './MapSelector'

export default function TopBar() {
  const presentationMode = useGraphStore((state) => state.presentationMode)
  const activeMapId = useGraphStore((state) => state.activeMapId)
  const meta = useGraphStore((state) => state.meta)
  const [isReturningHome, setIsReturningHome] = useState(false)
  const headerText =
    presentationMode !== PRESENTATION_MODES.FREE
      ? 'shhh... claude is presenting...'
      : ''

  const homeLabel = meta?.repoName?.trim() || 'repository'

  const handleReturnHome = async () => {
    if (isReturningHome || activeMapId === 'root') {
      return
    }

    setIsReturningHome(true)

    try {
      await setActiveMap('root')
    } catch (error) {
      console.error('Failed to switch ClaudeMap map:', error)
    } finally {
      setIsReturningHome(false)
    }
  }

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
      <button
        type="button"
        className="topbar-home"
        disabled={isReturningHome}
        onClick={handleReturnHome}
        title={
          activeMapId === 'root'
            ? `${homeLabel} overview`
            : `Return to ${homeLabel} overview`
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: isReturningHome ? 'default' : 'pointer',
          opacity: isReturningHome ? 0.68 : 1,
        }}
      >
        <span
          className="topbar-home-icon"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
          }}
        >
          <Compass size={20} />
        </span>
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
      </button>

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
