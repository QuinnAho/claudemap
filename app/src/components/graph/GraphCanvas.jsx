import { Background, ReactFlow } from '@xyflow/react'
import { useCallback } from 'react'
import '@xyflow/react/dist/style.css'
import ZoomControls from '../ui/ZoomControls'
import { useGraphStore } from '../../store/graphStore'
import { useGraphData } from '../../hooks/useGraphData'
import { useLayout } from '../../hooks/useLayout'
import SystemNode from './SystemNode'
import CustomEdge from './CustomEdge'
import FileNode from './FileNode'
import FunctionNode from './FunctionNode'
import { useZoomLevel, ZOOM_LEVELS } from '../../hooks/useZoomLevel'
import { copyNodeToClipboard } from '../../hooks/useClipboard'

const nodeTypes = {
  system: SystemNode,
  file: FileNode,
  function: FunctionNode,
}

const edgeTypes = {
  custom: CustomEdge,
}

export default function GraphCanvas() {
  const nodes = useGraphStore((state) => state.nodes)
  const edges = useGraphStore((state) => state.edges)
  const healthOverlay = useGraphStore((state) => state.healthOverlay)
  const selectedNode = useGraphStore((state) => state.selectedNode)
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode)
  const graphLoaded = useGraphData()
  const layoutReady = useLayout()
  const { zoomLevel, onViewportChange } = useZoomLevel()
  const graphReady = graphLoaded && layoutReady
  const visibleNodes = nodes.filter((node) => {
    if (node.type === 'system') {
      return true
    }

    if (node.type === 'file') {
      return zoomLevel !== ZOOM_LEVELS.OVERVIEW
    }

    if (node.type === 'function') {
      return zoomLevel === ZOOM_LEVELS.DEEP
    }

    return true
  })
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id))
  const activeSelectedNode =
    selectedNode && visibleNodeIds.has(selectedNode.id) ? selectedNode : null
  const visibleEdges = edges.filter(
    (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
  )
  const connectedNodeIds = new Set()

  if (activeSelectedNode) {
    visibleEdges.forEach((edge) => {
      if (edge.source === activeSelectedNode.id) {
        connectedNodeIds.add(edge.target)
      }

      if (edge.target === activeSelectedNode.id) {
        connectedNodeIds.add(edge.source)
      }
    })
  }

  const styledNodes = visibleNodes.map((node) => {
    if (!activeSelectedNode) {
      return {
        ...node,
        data: {
          ...node.data,
          isSelected: false,
          isDimmed: false,
          isHighlighted: false,
          healthOverlay: node.type === 'system' ? healthOverlay : false,
        },
      }
    }

    const isSelected = node.id === activeSelectedNode.id
    const isConnected = connectedNodeIds.has(node.id)

    return {
      ...node,
      data: {
        ...node.data,
        isSelected,
        isDimmed: !isSelected && !isConnected,
        isHighlighted: isConnected,
        healthOverlay: node.type === 'system' ? healthOverlay : false,
      },
    }
  })

  const styledEdges = visibleEdges.map((edge) => {
    if (!activeSelectedNode) {
      return {
        ...edge,
        data: {
          ...edge.data,
          isHighlighted: false,
          isDimmed: false,
        },
      }
    }

    const isHighlighted =
      edge.source === activeSelectedNode.id || edge.target === activeSelectedNode.id

    return {
      ...edge,
      data: {
        ...edge.data,
        isHighlighted,
        isDimmed: !isHighlighted,
      },
    }
  })

  const onNodeClick = useCallback(
    (_event, node) => {
      const nodeData = {
        id: node.id,
        type: node.type,
        ...node.data,
      }

      setSelectedNode(nodeData)
      copyNodeToClipboard(nodeData)
    },
    [setSelectedNode],
  )

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [setSelectedNode])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {graphReady ? (
        <>
          <ReactFlow
            nodes={styledNodes}
            edges={styledEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.24, maxZoom: 0.65 }}
            onViewportChange={onViewportChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            proOptions={{ hideAttribution: true }}
            style={{ backgroundColor: 'var(--bg-canvas)' }}
          >
            <Background color="#1a1a1a" gap={40} size={1} />
          </ReactFlow>
          <ZoomControls />
        </>
      ) : (
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
          Loading sample graph...
        </div>
      )}
    </div>
  )
}
