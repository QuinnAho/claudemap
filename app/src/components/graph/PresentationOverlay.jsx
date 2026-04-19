import { useEffect, useState } from 'react'
import { MOTION } from '../../contracts/motion'
import { PRESENTATION_MODES } from '../../contracts/presentation'
import { alpha } from '../../contracts/tokens'
import { useGraphStore } from '../../store/graphStore'
import {
  selectPresentationCaption,
  selectPresentationMode,
} from '../../store/selectors'

function getTypingStepSize(textLength) {
  if (textLength > 280) {
    return 4
  }

  if (textLength > 160) {
    return 3
  }

  if (textLength > 80) {
    return 2
  }

  return 1
}

export default function PresentationOverlay() {
  const presentationMode = useGraphStore(selectPresentationMode)
  const presentationCaption = useGraphStore(selectPresentationCaption)
  const explanation = presentationCaption?.explanation || presentationCaption?.body || ''
  const [typedExplanation, setTypedExplanation] = useState('')

  useEffect(() => {
    if (!explanation) {
      setTypedExplanation('')
      return undefined
    }

    let currentIndex = 0
    const stepSize = getTypingStepSize(explanation.length)
    setTypedExplanation('')

    const intervalId = window.setInterval(() => {
      currentIndex = Math.min(explanation.length, currentIndex + stepSize)
      setTypedExplanation(explanation.slice(0, currentIndex))

      if (currentIndex >= explanation.length) {
        window.clearInterval(intervalId)
      }
    }, MOTION.typeInterval)

    return () => window.clearInterval(intervalId)
  }, [explanation, presentationCaption?.updatedAt])

  if (presentationMode === PRESENTATION_MODES.FREE) {
    return null
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 24px 56px',
      }}
    >
      <div
        style={{
          width: 'min(760px, calc(100vw - 48px))',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            margin: '0 auto',
            maxWidth: '56ch',
            fontSize: 'clamp(17px, 2vw, 22px)',
            lineHeight: 1.6,
            color: 'var(--text-presentation)',
            fontFamily: 'inherit',
            fontWeight: 500,
            textShadow: `0 10px 28px ${alpha('black', 0.62)}`,
            letterSpacing: '0.01em',
          }}
        >
          {explanation ? (
            <>
              {typedExplanation}
              <span
                style={{
                  display: 'inline-block',
                  marginLeft: '2px',
                  color: alpha('accent', 0.92),
                  animation: 'presentationCaretBlink 1s steps(1) infinite',
                }}
              >
                |
              </span>
            </>
          ) : (
            'presentation mode'
          )}
        </div>
      </div>
    </div>
  )
}
