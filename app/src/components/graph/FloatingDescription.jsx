import { useEffect, useState } from 'react'

export default function FloatingDescription({ text, visible, position = 'above' }) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (visible) {
      setShouldRender(true)
      // Small delay to trigger CSS transition
      const timeout = setTimeout(() => setIsAnimating(true), 10)
      return () => clearTimeout(timeout)
    } else {
      setIsAnimating(false)
      // Wait for fade-out animation to complete
      const timeout = setTimeout(() => setShouldRender(false), 200)
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
        transform: `translate(-50%, ${isAnimating ? '0px' : '6px'})`,
        ...positionStyle,
        padding: '8px 12px',
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        lineHeight: 1.4,
        maxWidth: '280px',
        textAlign: 'center',
        whiteSpace: 'normal',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        opacity: isAnimating ? 1 : 0,
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {text}
    </div>
  )
}
