import { useCallback } from 'react'
import { MOTION } from '../contracts/motion'
import { getSystemPath } from '../lib/graphNodeUtils'
import { useGraphStore } from '../store/graphStore'
import {
  selectClearRuntimeEmphasis,
  selectMeta,
  selectSelectedNode,
  selectSetSelectedNode,
} from '../store/selectors'
import { copyNodeToClipboard } from './useClipboard'
import { ZOOM_LEVELS } from './useZoomLevel'

// useGraphPointerHandlers centralizes the four ReactFlow event handlers that
// GraphCanvas forwards to <ReactFlow>. It mediates between three concerns
// that would otherwise leak into the render body: scene interaction locking
// during presentation mode, hover-path scheduling for non-overview zoom, and
// selection/emphasis lifecycle on node/pane click. All hover state is owned
// by useHoverPathScheduler; this hook just calls into it.

export function useGraphPointerHandlers({
  buildSelectedNodePayload,
  cancelHoverClear,
  childCountByParentId,
  clearHoveredPath,
  hoveredPathIds,
  nodeById,
  pendingHoverPathRef,
  sceneInteractionLocked,
  scheduleHoverPath,
  zoomLevel,
}) {
  const meta = useGraphStore(selectMeta)
  const selectedNode = useGraphStore(selectSelectedNode)
  const setSelectedNode = useGraphStore(selectSetSelectedNode)
  const clearRuntimeEmphasis = useGraphStore(selectClearRuntimeEmphasis)

  const onNodeClick = useCallback(
    (_event, node) => {
      if (sceneInteractionLocked) {
        return
      }

      const nextSelectedNode = buildSelectedNodePayload(node)
      void copyNodeToClipboard(nextSelectedNode, meta)

      if (selectedNode?.id === node.id) {
        setSelectedNode(null)
        return
      }

      setSelectedNode(nextSelectedNode)
    },
    [buildSelectedNodePayload, meta, sceneInteractionLocked, selectedNode, setSelectedNode],
  )

  const onNodeMouseEnter = useCallback(
    (_event, node) => {
      if (sceneInteractionLocked) {
        return
      }

      if (zoomLevel === ZOOM_LEVELS.OVERVIEW) {
        return
      }

      if (node.type !== 'system' || !childCountByParentId.has(node.id)) {
        return
      }

      scheduleHoverPath(getSystemPath(node.id, nodeById), {
        delay: hoveredPathIds.length ? MOTION.hoverEnterSettle : MOTION.hoverEnter,
      })
    },
    [
      childCountByParentId,
      hoveredPathIds.length,
      nodeById,
      sceneInteractionLocked,
      scheduleHoverPath,
      zoomLevel,
    ],
  )

  const onPaneMouseMove = useCallback(
    (event) => {
      if (sceneInteractionLocked) {
        return
      }

      if (!hoveredPathIds.length && !pendingHoverPathRef.current.length) {
        return
      }

      const isOverNode =
        event.target instanceof Element && !!event.target.closest('.react-flow__node')

      if (!isOverNode) {
        scheduleHoverPath([], { delay: MOTION.hoverExit })
      }
    },
    [hoveredPathIds.length, pendingHoverPathRef, sceneInteractionLocked, scheduleHoverPath],
  )

  const onPaneClick = useCallback(() => {
    if (sceneInteractionLocked) {
      return
    }

    cancelHoverClear()
    pendingHoverPathRef.current = []
    clearHoveredPath()
    clearRuntimeEmphasis()
    setSelectedNode(null)
  }, [
    cancelHoverClear,
    clearHoveredPath,
    clearRuntimeEmphasis,
    pendingHoverPathRef,
    sceneInteractionLocked,
    setSelectedNode,
  ])

  return { onNodeClick, onNodeMouseEnter, onPaneMouseMove, onPaneClick }
}
