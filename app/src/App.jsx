import { Suspense, lazy } from 'react'
import TopBar from './components/layout/TopBar'
import StatusBar from './components/layout/StatusBar'

const GraphRuntime = lazy(() => import('./components/graph/GraphRuntime'))

function GraphBootFallback() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        fontSize: '13px',
        letterSpacing: '0.01em',
      }}
    >
      Loading graph runtime...
    </div>
  )
}

export default function App() {
  return (
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
        <Suspense fallback={<GraphBootFallback />}>
          <GraphRuntime />
        </Suspense>
      </div>
      <StatusBar />
    </div>
  )
}
