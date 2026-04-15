import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { setActiveMap } from '../../lib/mapApi'
import { useGraphStore } from '../../store/graphStore'

export default function MapSelector() {
  const mapsManifest = useGraphStore((state) => state.mapsManifest)
  const activeMapId = useGraphStore((state) => state.activeMapId)
  const maps = mapsManifest?.maps || []
  const activeMap = maps.find((mapEntry) => mapEntry.id === activeMapId) || maps[0] || null
  const staleMaps = maps.filter((mapEntry) => mapEntry.scope?.stale === true)
  const [isOpen, setIsOpen] = useState(false)
  const [shouldRenderMenu, setShouldRenderMenu] = useState(false)
  const [isMenuVisible, setIsMenuVisible] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setShouldRenderMenu(true)
      const frameId = window.requestAnimationFrame(() => {
        setIsMenuVisible(true)
      })

      return () => window.cancelAnimationFrame(frameId)
    }

    setIsMenuVisible(false)
    const timeoutId = window.setTimeout(() => {
      setShouldRenderMenu(false)
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) {
        return
      }

      setIsOpen(false)
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  if (maps.length === 0 || !activeMap) {
    return null
  }

  const handleMapSelect = async (nextMapId) => {
    if (!nextMapId || nextMapId === activeMapId) {
      setIsOpen(false)
      return
    }

    setIsPending(true)

    try {
      await setActiveMap(nextMapId)
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to switch ClaudeMap map:', error)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div
      ref={rootRef}
      title={staleMaps.length ? 'One or more graphs are stale. Run /refresh to re-resolve them.' : 'Switch graph'}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
      }}
    >
      <button
        type="button"
        disabled={isPending}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: isOpen ? 'rgba(229, 229, 229, 0.92)' : 'var(--text-secondary)',
          cursor: isPending ? 'default' : 'pointer',
          transition:
            'color var(--motion-quick-duration) var(--motion-ease-soft), opacity var(--motion-quick-duration) var(--motion-ease-soft)',
          opacity: isPending ? 0.64 : 1,
          fontFamily: 'inherit',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 400,
            letterSpacing: '0.01em',
            color: 'inherit',
            maxWidth: '156px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {activeMap.label}
        </span>
        <ChevronDown
          size={12}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--text-muted)',
            transition:
              'transform var(--motion-surface-duration) var(--motion-ease-smooth), color var(--motion-quick-duration) var(--motion-ease-soft)',
          }}
        />
      </button>

      {shouldRenderMenu ? (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: '186px',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            background: 'rgba(12, 12, 12, 0.96)',
            boxShadow: '0 10px 22px rgba(0, 0, 0, 0.22)',
            opacity: isMenuVisible ? 1 : 0,
            transform: isMenuVisible
              ? 'translateY(0px) scale(1)'
              : 'translateY(-3px) scale(0.994)',
            transformOrigin: 'top right',
            transition:
              'opacity var(--motion-surface-duration) var(--motion-ease-soft), transform var(--motion-surface-duration) var(--motion-ease-smooth)',
            pointerEvents: isMenuVisible ? 'auto' : 'none',
            zIndex: 24,
            fontFamily: 'inherit',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
            }}
          >
            {maps.map((mapEntry) => {
              const isActive = mapEntry.id === activeMapId
              const isStale = mapEntry.scope?.stale === true

              return (
                <button
                  key={mapEntry.id}
                  type="button"
                  disabled={isPending || isStale}
                  onClick={() => handleMapSelect(mapEntry.id)}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderRadius: '8px',
                    background: isActive ? 'rgba(255, 255, 255, 0.035)' : 'transparent',
                    color: isStale
                      ? 'rgba(229, 229, 229, 0.36)'
                      : isActive
                        ? 'rgba(229, 229, 229, 0.96)'
                        : 'var(--text-secondary)',
                    cursor: isPending || isStale ? 'default' : 'pointer',
                    padding: '8px 9px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    textAlign: 'left',
                    transition:
                      'background-color var(--motion-quick-duration) var(--motion-ease-soft), color var(--motion-quick-duration) var(--motion-ease-soft)',
                  }}
                >
                  <div
                    style={{
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: isActive ? 500 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {mapEntry.label}
                    </span>
                    {isStale ? (
                      <span
                        style={{
                          fontSize: '10px',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: 'rgba(234, 179, 8, 0.76)',
                        }}
                      >
                        Stale
                      </span>
                    ) : null}
                  </div>

                  {isActive ? (
                    <div
                      style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent)',
                        flexShrink: 0,
                        opacity: 0.9,
                      }}
                    />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
