import { ReactFlowProvider } from '@xyflow/react'
import GraphCanvas from './GraphCanvas'
import PresentationOverlay from './PresentationOverlay'
import { useGraphStore } from '../../store/graphStore'

export default function GraphRuntime() {
  const presentationMode = useGraphStore((state) => state.presentationMode)

  return (
    <ReactFlowProvider>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <GraphCanvas />
        {presentationMode !== 'free' ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 15,
              background:
                'radial-gradient(circle at 50% 34%, rgba(10, 10, 10, 0.04) 0%, rgba(10, 10, 10, 0.18) 30%, rgba(10, 10, 10, 0.48) 70%, rgba(10, 10, 10, 0.68) 100%)',
              transition: 'opacity 0.28s ease',
            }}
          />
        ) : null}
        <PresentationOverlay />
      </div>
    </ReactFlowProvider>
  )
}
