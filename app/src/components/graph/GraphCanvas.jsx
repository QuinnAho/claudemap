import { Background, ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import ZoomControls from '../ui/ZoomControls'
import { useGraphStore } from '../../store/graphStore'

export default function GraphCanvas() {
  const { nodes, edges } = useGraphStore()

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: 'var(--bg-canvas)' }}
      >
        <Background color="#1a1a1a" gap={40} size={1} />
      </ReactFlow>
      <ZoomControls />
    </div>
  )
}
