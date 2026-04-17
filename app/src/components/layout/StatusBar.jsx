import { useEffect, useState } from 'react'
import { MOTION } from '../../contracts/motion'
import { FONT } from '../../contracts/tokens'
import { useGraphStore } from '../../store/graphStore'
import {
  selectMetaLastSyncedAt,
  selectPresentationMode,
} from '../../store/selectors'

export default function StatusBar() {
  const lastSyncedAt = useGraphStore(selectMetaLastSyncedAt)
  const presentationMode = useGraphStore(selectPresentationMode)
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, MOTION.statusBarRefresh)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    setCurrentTime(Date.now())
  }, [lastSyncedAt])

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
        fontFamily: FONT.mono,
        fontSize: '12px',
        color: 'var(--text-secondary)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
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
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--health-green)',
            }}
          />
          <span>{getSyncLabel()}</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>{`Mode: ${presentationMode}`}</span>
        </div>
      </div>

      <div style={{ whiteSpace: 'nowrap' }}>
        <span>A Project by Quinn Aho</span>
      </div>
    </div>
  )
}
