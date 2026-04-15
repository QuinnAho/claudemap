import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { copyTextToClipboard } from '../../hooks/useClipboard'

export default function MapAffordance({ affordance }) {
  const [isHovering, setIsHovering] = useState(false)
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef(null)

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
    },
    [],
  )

  if (!affordance) {
    return null
  }

  const handleClick = async (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (affordance.kind === 'open') {
      try {
        await affordance.onClick?.()
      } catch (error) {
        console.error('Failed to open scoped map:', error)
      }
      return
    }

    const copiedCommand = await copyTextToClipboard(affordance.command)

    if (!copiedCommand) {
      return
    }

    setCopied(true)
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current)
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false)
      resetTimerRef.current = null
    }, 1800)
  }

  const buttonLabel =
    affordance.kind === 'open'
      ? 'Open map'
      : copied
        ? 'Copied! Paste into Claude'
        : isHovering
          ? "Let's do it"
          : 'Create map?'
  const Icon = affordance.kind === 'open' ? ArrowUpRight : Sparkles

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: copied ? '6px 10px' : '5px 9px',
        borderRadius: '999px',
        border:
          affordance.kind === 'open'
            ? '1px solid rgba(232, 97, 60, 0.25)'
            : '1px solid rgba(255, 255, 255, 0.09)',
        background:
          affordance.kind === 'open'
            ? 'rgba(232, 97, 60, 0.08)'
            : copied
              ? 'rgba(232, 97, 60, 0.12)'
              : 'rgba(255, 255, 255, 0.05)',
        color: copied ? '#fff4ef' : 'var(--text-primary)',
        fontSize: copied ? '11px' : '10px',
        fontWeight: 600,
        letterSpacing: copied ? '0' : '0.02em',
        cursor: 'pointer',
        transition: 'opacity 0.18s ease, transform 0.18s ease, background-color 0.18s ease',
        pointerEvents: 'auto',
      }}
      title={affordance.kind === 'open' ? 'Open this scoped ClaudeMap' : affordance.command}
      type="button"
    >
      <Icon size={12} />
      <span>{buttonLabel}</span>
    </button>
  )
}
