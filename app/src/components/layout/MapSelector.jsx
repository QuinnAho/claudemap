import { ChevronDown, CornerDownRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MOTION } from '../../contracts/motion'
import { FONT, alpha } from '../../contracts/tokens'
import { setActiveMap } from '../../lib/mapApi'
import { useGraphStore } from '../../store/graphStore'
import {
  selectActiveMapId,
  selectMapsManifest,
  selectMeta,
} from '../../store/selectors'

function getMapDepth(mapEntry) {
  if (!mapEntry?.scope) {
    return 0
  }

  return (mapEntry.scope.ancestorPath?.length || 0) + 1
}

function getMapTreeKey(mapEntry) {
  if (!mapEntry?.scope) {
    return ''
  }

  return [...(mapEntry.scope.ancestorPath || []), mapEntry.scope.rootSystemLabel || mapEntry.label]
    .join('/')
    .toLowerCase()
}

function getMapDisplayLabel(mapEntry, rootMapLabel) {
  if (!mapEntry) {
    return ''
  }

  return !mapEntry.scope || mapEntry.id === 'root' ? rootMapLabel : mapEntry.label
}

export default function MapSelector() {
  const mapsManifest = useGraphStore(selectMapsManifest)
  const activeMapId = useGraphStore(selectActiveMapId)
  const meta = useGraphStore(selectMeta)
  const maps = mapsManifest?.maps || []
  const activeMap = maps.find((mapEntry) => mapEntry.id === activeMapId) || maps[0] || null
  const staleMaps = maps.filter((mapEntry) => mapEntry.scope?.stale === true)
  const rootMapLabel = meta?.repoName?.trim() || activeMap?.label || 'Repository'
  const orderedMaps = [...maps].sort((leftMap, rightMap) => {
    const leftDepth = getMapDepth(leftMap)
    const rightDepth = getMapDepth(rightMap)

    if (leftDepth !== rightDepth) {
      return leftDepth - rightDepth
    }

    return getMapTreeKey(leftMap).localeCompare(getMapTreeKey(rightMap))
  })
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
    }, MOTION.menuHide)

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
      console.error('Failed to switch map:', error)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div
      ref={rootRef}
      title={staleMaps.length ? 'One or more graphs are stale. Run the refresh command to re-resolve them.' : 'Switch graph'}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        fontFamily: FONT.mono,
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
          color: isOpen ? alpha('textPrimary', 0.92) : 'var(--text-secondary)',
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
          {getMapDisplayLabel(activeMap, rootMapLabel)}
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
            border: `1px solid ${alpha('white', 0.05)}`,
            background: alpha('menu', 0.96),
            boxShadow: `0 10px 22px ${alpha('black', 0.22)}`,
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
            {orderedMaps.map((mapEntry) => {
              const isActive = mapEntry.id === activeMapId
              const isStale = mapEntry.scope?.stale === true
              const depth = getMapDepth(mapEntry)
              const displayLabel = getMapDisplayLabel(mapEntry, rootMapLabel)

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
                    background: isActive ? alpha('white', 0.035) : 'transparent',
                    color: isStale
                      ? alpha('textPrimary', 0.36)
                      : isActive
                        ? alpha('textPrimary', 0.96)
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
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        paddingLeft: `${depth * 14}px`,
                          flexShrink: 0,
                      }}
                    >
                      {depth > 0 ? (
                        <CornerDownRight
                          size={12}
                          style={{
                            color: isActive
                              ? alpha('textPrimary', 0.56)
                              : alpha('white', 0.22),
                          }}
                        />
                      ) : null}
                    </div>
                    <span
                      style={{
                        minWidth: 0,
                        fontSize: '12px',
                        fontWeight: isActive ? 500 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {displayLabel}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexShrink: 0,
                    }}
                  >
                    {isStale ? (
                      <span
                        style={{
                          fontSize: '10px',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: alpha('healthYellow', 0.76),
                        }}
                      >
                        Stale
                      </span>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
