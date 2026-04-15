import { Layers3, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { setActiveMap } from '../../lib/mapApi'
import { useGraphStore } from '../../store/graphStore'

export default function MapSelector() {
  const mapsManifest = useGraphStore((state) => state.mapsManifest)
  const activeMapId = useGraphStore((state) => state.activeMapId)
  const maps = mapsManifest?.maps || []
  const staleMaps = maps.filter((mapEntry) => mapEntry.scope?.stale === true)
  const [isPending, setIsPending] = useState(false)

  if (maps.length === 0) {
    return null
  }

  const handleChange = async (event) => {
    const nextMapId = event.target.value

    if (!nextMapId || nextMapId === activeMapId) {
      return
    }

    setIsPending(true)

    try {
      await setActiveMap(nextMapId)
    } catch (error) {
      console.error('Failed to switch ClaudeMap map:', error)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div
      title={
        staleMaps.length
          ? 'One or more scoped maps are stale. Run /refresh to re-resolve them.'
          : 'Switch between ClaudeMap scopes'
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '6px 10px',
      }}
    >
      <Layers3 size={14} color="var(--text-secondary)" />
      <select
        disabled={isPending}
        onChange={handleChange}
        value={activeMapId}
        style={{
          appearance: 'none',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          fontSize: '12px',
          outline: 'none',
          lineHeight: 1.2,
          minWidth: 0,
          width: 'auto',
        }}
      >
        {maps.map((mapEntry) => (
          <option
            disabled={mapEntry.scope?.stale === true}
            key={mapEntry.id}
            value={mapEntry.id}
          >
            {mapEntry.label}
            {mapEntry.scope?.stale ? ' (stale)' : ''}
          </option>
        ))}
      </select>
      {staleMaps.length > 0 ? <TriangleAlert size={14} color="var(--health-yellow)" /> : null}
    </div>
  )
}
