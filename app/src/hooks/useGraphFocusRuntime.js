import { useCallback, useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { MOTION } from '../contracts/motion'
import { PRESENTATION_MODES } from '../contracts/presentation'
import { FIT_VIEW, VIEWPORT } from '../contracts/zoom'
import {
  FILE_NODE_HEIGHT,
  FILE_NODE_WIDTH,
  FUNCTION_NODE_HEIGHT,
  FUNCTION_NODE_WIDTH,
} from '../components/graph/systemNodeSizing'
import { getNodeAbsolutePosition, getSystemPath, getTopLevelSystemId } from '../lib/graphNodeUtils'
import { useGraphStore } from '../store/graphStore'
import {
  selectFocusRequest,
  selectGuidedFlowRequest,
  selectPresentationMode,
  selectSetHoveredPathIds,
  selectSetSelectedNode,
} from '../store/selectors'

// useGraphFocusRuntime owns the runtime-driven viewport effects: applying
// focusRequest (single jump) and guidedFlowRequest (stepped tour). It caches
// the most recent focus/flow keys on refs so the store can broadcast identical
// request objects without retriggering animation, and tracks whether the
// first runtime viewport change has landed so subsequent ones animate while
// the initial one snaps instantly.

export function useGraphFocusRuntime({ graphReady, nodeById }) {
  const { setCenter } = useReactFlow()
  const focusRequest = useGraphStore(selectFocusRequest)
  const guidedFlowRequest = useGraphStore(selectGuidedFlowRequest)
  const presentationMode = useGraphStore(selectPresentationMode)
  const setHoveredPathIds = useGraphStore(selectSetHoveredPathIds)
  const setSelectedNode = useGraphStore(selectSetSelectedNode)

  const lastFocusKeyRef = useRef('')
  const lastGuidedFlowKeyRef = useRef('')
  const hasAppliedRuntimeViewportRef = useRef(false)

  const buildSelectedNodePayload = useCallback(
    (node) => ({
      id: node.id,
      type: node.type,
      parentId: node.parentId || null,
      ...node.data,
    }),
    [],
  )

  const focusNodeById = useCallback(
    (nodeId, zoom = 1, options = {}) => {
      const targetNode = nodeById.get(nodeId)

      if (!targetNode) {
        return
      }

      const pathIds =
        presentationMode === PRESENTATION_MODES.FREE ? getSystemPath(targetNode.id, nodeById) : []
      const viewportTargetNode =
        presentationMode !== PRESENTATION_MODES.FREE
          ? nodeById.get(getTopLevelSystemId(targetNode, nodeById)) || targetNode
          : zoom <= FIT_VIEW.maxZoom && targetNode.type !== 'system'
            ? nodeById.get(getTopLevelSystemId(targetNode, nodeById)) || targetNode
            : targetNode

      if (pathIds.length) {
        setHoveredPathIds(pathIds)
      }

      setSelectedNode(buildSelectedNodePayload(targetNode))
      const shouldAnimate = options.animate !== false

      window.setTimeout(
        () => {
          const absolutePosition = getNodeAbsolutePosition(viewportTargetNode, nodeById)

          if (!absolutePosition) {
            return
          }

          const nodeWidth =
            viewportTargetNode.width ||
            (viewportTargetNode.type === 'function'
              ? FUNCTION_NODE_WIDTH
              : viewportTargetNode.type === 'file'
                ? FILE_NODE_WIDTH
                : 0)
          const nodeHeight =
            viewportTargetNode.height ||
            (viewportTargetNode.type === 'function'
              ? FUNCTION_NODE_HEIGHT
              : viewportTargetNode.type === 'file'
                ? FILE_NODE_HEIGHT
                : 0)
          const centerX = absolutePosition.x + nodeWidth / 2
          const centerY =
            absolutePosition.y +
            nodeHeight / 2 -
            (presentationMode !== PRESENTATION_MODES.FREE ? VIEWPORT.presentationOffsetPx : 0)
          setCenter(centerX, centerY, {
            zoom: Math.max(VIEWPORT.minZoom, Math.min(zoom, VIEWPORT.maxZoom)),
            duration: shouldAnimate ? MOTION.viewport : 0,
          })
        },
        shouldAnimate ? MOTION.hoverExit : 0,
      )
    },
    [buildSelectedNodePayload, nodeById, presentationMode, setCenter, setHoveredPathIds, setSelectedNode],
  )

  useEffect(() => {
    if (!graphReady || !focusRequest?.nodeId) {
      return
    }

    const focusKey = `${focusRequest.nodeId}:${focusRequest.zoom || 1}:${focusRequest.requestedAt || ''}`
    const shouldAnimate = hasAppliedRuntimeViewportRef.current

    if (focusKey === lastFocusKeyRef.current) {
      return
    }

    lastFocusKeyRef.current = focusKey
    focusNodeById(focusRequest.nodeId, focusRequest.zoom || 1, {
      animate: shouldAnimate,
    })
    hasAppliedRuntimeViewportRef.current = true
  }, [focusNodeById, focusRequest, graphReady])

  useEffect(() => {
    if (
      !graphReady ||
      !Array.isArray(guidedFlowRequest?.steps) ||
      guidedFlowRequest.steps.length === 0
    ) {
      return
    }

    const flowKey = `${guidedFlowRequest.requestedAt || ''}:${guidedFlowRequest.steps.join('|')}`

    if (flowKey === lastGuidedFlowKeyRef.current) {
      return
    }

    lastGuidedFlowKeyRef.current = flowKey
    let stepIndex = 0
    const delay = Math.max(MOTION.guidedFlowStepMin, guidedFlowRequest.delay || MOTION.guidedFlowStep)
    const shouldAnimateFirstStep = hasAppliedRuntimeViewportRef.current

    focusNodeById(guidedFlowRequest.steps[stepIndex], 1, {
      animate: shouldAnimateFirstStep,
    })
    hasAppliedRuntimeViewportRef.current = true
    const intervalId = window.setInterval(() => {
      stepIndex += 1

      if (stepIndex >= guidedFlowRequest.steps.length) {
        window.clearInterval(intervalId)
        return
      }

      focusNodeById(guidedFlowRequest.steps[stepIndex], 1)
    }, delay)

    return () => window.clearInterval(intervalId)
  }, [focusNodeById, graphReady, guidedFlowRequest])

  return { buildSelectedNodePayload }
}
