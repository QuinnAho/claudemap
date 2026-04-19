import { ReactFlowProvider } from '@xyflow/react'
import GraphCanvas from './GraphCanvas'
import PresentationOverlay from './PresentationOverlay'
import { PRESENTATION_MODES } from '../../contracts/presentation'
import { alpha } from '../../contracts/tokens'
import { useGraphStore } from '../../store/graphStore'
import { selectPresentationMode } from '../../store/selectors'

export default function GraphRuntime() {
  const presentationMode = useGraphStore(selectPresentationMode)

  return (
    <ReactFlowProvider>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <GraphCanvas />
        {presentationMode !== PRESENTATION_MODES.FREE ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 15,
              background:
                `radial-gradient(circle at 50% 34%, ${alpha('canvas', 0.04)} 0%, ${alpha('canvas', 0.18)} 30%, ${alpha('canvas', 0.48)} 70%, ${alpha('canvas', 0.68)} 100%)`,
              transition: 'opacity 0.28s ease',
            }}
          />
        ) : null}
        <PresentationOverlay />
      </div>
    </ReactFlowProvider>
  )
}
