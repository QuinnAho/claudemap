import { useEffect, useState } from 'react'
import { MOTION } from '../../contracts/motion'
import { alpha } from '../../contracts/tokens'

export default function FloatingDescription({ text, visible, position = 'above' }) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (visible) {
      setShouldRender(true)
      // Small delay to trigger CSS transition
      const timeout = setTimeout(() => setIsAnimating(true), MOTION.transitionTrigger)
      return () => clearTimeout(timeout)
    } else {
      setIsAnimating(false)
      // Wait for fade-out animation to complete
      const timeout = setTimeout(() => setShouldRender(false), MOTION.fadeOut)
      return () => clearTimeout(timeout)
    }
  }, [visible])

  if (!shouldRender || !text) {
    return null
  }

  const positionStyle =
    position === 'above'
      ? { bottom: '100%', marginBottom: '8px' }
      : { top: '100%', marginTop: '8px' }

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        transform: `translate(-50%, ${isAnimating ? '0px' : '10px'}) scale(${isAnimating ? 1 : 0.96})`,
        ...positionStyle,
        padding: '10px 14px',
        background:
          `linear-gradient(180deg, ${alpha('card', 0.98)} 0%, ${alpha('floating', 0.96)} 100%)`,
        border: `1px solid ${alpha('white', 0.1)}`,
        borderRadius: '8px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        lineHeight: 1.45,
        minWidth: '220px',
        maxWidth: '360px',
        textAlign: 'left',
        whiteSpace: 'normal',
        boxShadow: `0 4px 12px ${alpha('black', 0.4)}`,
        opacity: isAnimating ? 1 : 0,
        transition:
          'opacity var(--motion-surface-duration) var(--motion-ease-soft), transform var(--motion-surface-duration) var(--motion-ease-smooth)',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {text}
    </div>
  )
}
