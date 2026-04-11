import { ReactFlowProvider } from '@xyflow/react'
import TopBar from './components/layout/TopBar'
import StatusBar from './components/layout/StatusBar'
import GraphCanvas from './components/graph/GraphCanvas'

export default function App() {
  return (
    <ReactFlowProvider>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: '100vw',
          backgroundColor: 'var(--bg-canvas)',
        }}
      >
        <TopBar />
        <div style={{ flex: 1, position: 'relative' }}>
          <GraphCanvas />
        </div>
        <StatusBar />
      </div>
    </ReactFlowProvider>
  )
}
