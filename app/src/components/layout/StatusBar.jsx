import { useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'

export default function StatusBar() {
  const branch = useGraphStore((state) => state.meta.branch)
  const creditLabel = useGraphStore((state) => state.meta.creditLabel)
  const lastSyncedAt = useGraphStore((state) => state.meta.lastSyncedAt)
  const presentationMode = useGraphStore((state) => state.presentationMode)
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    setCurrentTime(Date.now())
  }, [lastSyncedAt])

  const statusGroupStyle = { display: 'flex', alignItems: 'center', gap: '16px' }
  const statusItemStyle = { display: 'flex', alignItems: 'center', gap: '8px' }
  const creditStyle = { whiteSpace: 'nowrap' }

  const getSyncLabel = () => {
    const elapsedMs = Math.max(0, currentTime - lastSyncedAt)
    const elapsedSeconds = Math.floor(elapsedMs / 1000)

    if (elapsedSeconds < 60) {
      return 'Synced just now'
    }

    const elapsedMinutes = Math.floor(elapsedSeconds / 60)

    if (elapsedMinutes < 60) {
      return `Synced ${elapsedMinutes}m ago`
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60)
    return `Synced ${elapsedHours}h ago`
  }

  return (
    <div
      style={{
        height: '32px',
        backgroundColor: 'var(--bg-topbar)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
        fontSize: '12px',
        color: 'var(--text-secondary)',
      }}
    >
      <div style={statusGroupStyle}>
        <div style={statusItemStyle}>
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--health-green)',
            }}
          />
          <span>{branch}</span>
        </div>
        <div style={{ ...statusItemStyle, gap: '6px' }}>
          <Clock3 size={12} />
          <span>{getSyncLabel()}</span>
        </div>
        <div style={statusItemStyle}>
          <span>{`Mode: ${presentationMode}`}</span>
        </div>
      </div>

      <div style={creditStyle}>
        <span>{creditLabel}</span>
      </div>
    </div>
  )
}
