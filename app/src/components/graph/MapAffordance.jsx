import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { MOTION } from '../../contracts/motion'
import { copyTextToClipboard } from '../../hooks/useClipboard'

export default function MapAffordance({ affordance }) {
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
    }, MOTION.mapAffordanceReset)
  }

  const isOpen = affordance.kind === 'open'
  const Icon = isOpen ? ArrowUpRight : Sparkles
  const label = isOpen ? 'Open map' : copied ? 'Copied! Paste into Claude' : 'Create map?'

  return (
    <button
      className="map-affordance"
      onClick={handleClick}
      data-copied={copied ? 'true' : undefined}
      title={isOpen ? 'Open this scoped ClaudeMap' : affordance.command}
      type="button"
    >
      <Icon size={11} />
      <span>{label}</span>
    </button>
  )
}
