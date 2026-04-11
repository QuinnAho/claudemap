import { Compass } from 'lucide-react'
import { useState } from 'react'
import { useGraphStore } from '../../store/graphStore'

export default function TopBar() {
  const [activeTab, setActiveTab] = useState('graph')
  const repoName = useGraphStore((state) => state.meta.repoName)

  const getTabStyle = (isActive) => ({
    background: 'none',
    border: 'none',
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '0 0 2px',
    borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
    display: 'flex',
    alignItems: 'center',
    height: '100%',
  })

  return (
    <div
      style={{
        height: '48px',
        backgroundColor: 'var(--bg-topbar)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Compass size={20} color="var(--accent)" />
          <span
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--accent)',
              letterSpacing: '-0.01em',
            }}
          >
            ClaudeMap
          </span>
        </div>

        <div style={{ display: 'flex', gap: '24px', height: '48px' }}>
          <button onClick={() => setActiveTab('graph')} style={getTabStyle(activeTab === 'graph')}>
            Graph View
          </button>
          <button onClick={() => setActiveTab('map')} style={getTabStyle(activeTab === 'map')}>
            Map View
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '6px 12px',
        }}
      >
        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{repoName}</span>
      </div>
    </div>
  )
}
