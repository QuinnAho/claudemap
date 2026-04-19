import {
  applyGraphPatch,
  addEdge,
  addNode,
  clearHighlight,
  clearCaption,
  createMcpClient,
  guidedFlow,
  highlightNodes,
  navigateTo,
  presentStep,
  removeEdge,
  removeNode,
  renderGraph,
  setPresentationMode,
  setHealthOverlay,
  showCaption,
  updateNode,
} from '../../../skill/lib/mcp-client.js'
import { PRESENTATION_MODES } from '../contracts/presentation.js'

export const toolDefinitions = [
  { name: 'render_graph', description: 'Render a full runtime graph payload.' },
  { name: 'apply_graph_patch', description: 'Apply a batched graph patch to the runtime graph.' },
  { name: 'add_node', description: 'Insert a single node into the runtime graph.' },
  { name: 'remove_node', description: 'Remove a node from the runtime graph.' },
  { name: 'update_node', description: 'Update fields on an existing runtime node.' },
  { name: 'add_edge', description: 'Insert a single edge into the runtime graph.' },
  { name: 'remove_edge', description: 'Remove an edge from the runtime graph.' },
  { name: 'highlight_nodes', description: 'Highlight one or more graph nodes.' },
  { name: 'clear_highlight', description: 'Clear highlighted graph nodes.' },
  { name: 'navigate_to', description: 'Focus the graph viewport on a node.' },
  { name: 'guided_flow', description: 'Step through a sequence of nodes in the graph.' },
  { name: 'set_health_overlay', description: 'Toggle the system health overlay.' },
  { name: 'set_presentation_mode', description: 'Set the presentation mode and input lock behavior.' },
  { name: 'present_step', description: 'Present a guided step by revealing a node and updating explanation text.' },
  { name: 'show_caption', description: 'Display a guided walkthrough caption.' },
  { name: 'clear_caption', description: 'Clear the current guided walkthrough caption.' },
]

function textResponse(toolName, text) {
  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
  }
}

function createRuntimeClient(runtimeTarget = null) {
  return createMcpClient({
    graphPath: runtimeTarget?.graphPath,
    statePath: runtimeTarget?.statePath,
  })
}

export function createToolHandlers() {
  return {
    render_graph: async ({ meta, nodes, edges, files, runtime, __runtimeTarget } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await renderGraph(client, {
        meta,
        nodes: nodes || [],
        edges: edges || [],
        files: files || [],
        runtime,
      })
      return textResponse('render_graph', `Rendered ${nodes?.length || 0} nodes`)
    },
    apply_graph_patch: async ({ changes, meta, files, runtime, __runtimeTarget } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await applyGraphPatch(client, {
        changes,
        meta,
        files,
        runtime,
      })
      return textResponse('apply_graph_patch', 'Applied batched graph patch')
    },
    add_node: async ({ node, __runtimeTarget } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await addNode(client, node)
      return textResponse('add_node', `Added node ${node?.id || 'unknown'}`)
    },
    remove_node: async ({ nodeId, __runtimeTarget } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await removeNode(client, nodeId)
      return textResponse('remove_node', `Removed node ${nodeId || 'unknown'}`)
    },
    update_node: async ({ nodeId, fields, __runtimeTarget } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await updateNode(client, nodeId, fields || {})
      return textResponse('update_node', `Updated node ${nodeId || 'unknown'}`)
    },
    add_edge: async ({ edge, __runtimeTarget } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await addEdge(client, edge)
      return textResponse('add_edge', `Added edge ${edge?.id || 'unknown'}`)
    },
    remove_edge: async ({ edgeId, __runtimeTarget } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await removeEdge(client, edgeId)
      return textResponse('remove_edge', `Removed edge ${edgeId || 'unknown'}`)
    },
    highlight_nodes: async ({ nodeIds, color, __runtimeTarget } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await highlightNodes(client, nodeIds || [], color)
      return textResponse('highlight_nodes', `Highlighted ${nodeIds?.length || 0} nodes`)
    },
    clear_highlight: async ({ __runtimeTarget } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await clearHighlight(client)
      return textResponse('clear_highlight', 'Cleared highlights')
    },
    navigate_to: async ({ nodeId, zoom, __runtimeTarget } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await navigateTo(client, nodeId, zoom)
      return textResponse('navigate_to', `Navigating to ${nodeId || 'unknown'}`)
    },
    guided_flow: async ({ steps, delay, __runtimeTarget } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await guidedFlow(client, steps || [], delay)
      return textResponse('guided_flow', `Started guided flow with ${steps?.length || 0} steps`)
    },
    set_health_overlay: async ({ enabled, __runtimeTarget } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await setHealthOverlay(client, !!enabled)
      return textResponse('set_health_overlay', `Health overlay ${enabled ? 'on' : 'off'}`)
    },
    set_presentation_mode: async ({
      mode,
      lockInput,
      title,
      stepLabel,
      explanation,
      resetScene,
      __runtimeTarget,
    } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await setPresentationMode(client, mode || PRESENTATION_MODES.FREE, {
        lockInput,
        title,
        stepLabel,
        explanation,
        resetScene,
      })
      return textResponse('set_presentation_mode', `Presentation mode ${mode || PRESENTATION_MODES.FREE}`)
    },
    present_step: async ({
      nodeId,
      nodeIds,
      color,
      zoom,
      mode,
      lockInput,
      title,
      stepLabel,
      explanation,
      __runtimeTarget,
    } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await presentStep(client, {
        nodeId,
        nodeIds,
        color,
        zoom,
        mode,
        lockInput,
        title,
        stepLabel,
        explanation,
      })
      return textResponse('present_step', `Presented ${nodeId || nodeIds?.[0] || 'step'}`)
    },
    show_caption: async ({ title, body, stepLabel, __runtimeTarget } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await showCaption(client, body || '', { title, stepLabel })
      return textResponse('show_caption', `Caption: ${title || body || 'updated'}`)
    },
    clear_caption: async ({ __runtimeTarget } = {}) => {
      const client = createRuntimeClient(__runtimeTarget)
      await clearCaption(client)
      return textResponse('clear_caption', 'Caption cleared')
    },
  }
}
