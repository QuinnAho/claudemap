import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { GRAPH_SOURCES } from './contracts/graph-sources.js'
import { PRESENTATION_MODES } from './contracts/presentation.js'
import {
  APP_PUBLIC_GRAPH_RUNTIME_REL,
  APP_PUBLIC_GRAPH_STATE_REL,
} from './contracts/paths.js'
import { SCHEMA_NAMES, validateWithWarning } from './contracts/schemas/index.js'
import { writeJsonFileAtomic } from './runtime-paths.js'

const DEFAULT_RUNTIME_GRAPH_PATH = path.resolve(
  fileURLToPath(new URL(`../../${APP_PUBLIC_GRAPH_RUNTIME_REL}`, import.meta.url)),
)
const DEFAULT_RUNTIME_STATE_PATH = path.resolve(
  fileURLToPath(new URL(`../../${APP_PUBLIC_GRAPH_STATE_REL}`, import.meta.url)),
)

function createDefaultRuntimeState() {
  return {
    healthOverlay: false,
    highlightedNodeIds: [],
    highlightColor: 'accent',
    focus: null,
    guidedFlow: null,
    presentation: {
      mode: PRESENTATION_MODES.FREE,
      lockInput: false,
      title: null,
      explanation: null,
      body: null,
      stepLabel: null,
      updatedAt: null,
    },
  }
}

function createDefaultRuntimeEnvelope() {
  return {
    graphRevision: 0,
    updatedAt: new Date().toISOString(),
    graphMeta: {
      repoName: 'claudemap',
      generatedAt: null,
      source: GRAPH_SOURCES.FILE_SHIM,
      nodeCount: 0,
      edgeCount: 0,
      fileCount: 0,
    },
    runtime: createDefaultRuntimeState(),
  }
}

function normalizePresentationMode(mode) {
  if (mode === 'locked-demo') {
    return PRESENTATION_MODES.LOCKED
  }

  if (mode === PRESENTATION_MODES.GUIDED || mode === PRESENTATION_MODES.LOCKED) {
    return mode
  }

  return PRESENTATION_MODES.FREE
}

function createEmptyGraph() {
  return {
    meta: {
      repoName: 'claudemap',
      branch: 'workspace',
      creditLabel: 'ClaudeMap skill',
      generatedAt: new Date().toISOString(),
      source: GRAPH_SOURCES.FILE_SHIM,
    },
    nodes: [],
    edges: [],
    files: [],
  }
}

function normalizeRuntimeState(runtime) {
  const normalizedMode = normalizePresentationMode(runtime?.presentation?.mode)
  const normalizedPresentation = {
    ...createDefaultRuntimeState().presentation,
    ...(runtime?.presentation || {}),
    mode: normalizedMode,
  }

  const normalizedExplanation =
    normalizedPresentation.explanation || normalizedPresentation.body || null

  return {
    ...createDefaultRuntimeState(),
    ...(runtime || {}),
    highlightedNodeIds: Array.isArray(runtime?.highlightedNodeIds)
      ? runtime.highlightedNodeIds
      : [],
    presentation: {
      ...normalizedPresentation,
      explanation: normalizedExplanation,
      body: normalizedPresentation.body || normalizedExplanation,
      mode: normalizedPresentation.mode || PRESENTATION_MODES.FREE,
      lockInput:
        typeof normalizedPresentation.lockInput === 'boolean'
          ? normalizedPresentation.lockInput
          : normalizedPresentation.mode === PRESENTATION_MODES.LOCKED,
    },
  }
}

function summarizeGraph(graph) {
  return {
    repoName: graph.meta?.repoName || 'claudemap',
    generatedAt: graph.meta?.generatedAt || null,
    source: graph.meta?.source || GRAPH_SOURCES.FILE_SHIM,
    nodeCount: Array.isArray(graph.nodes) ? graph.nodes.length : 0,
    edgeCount: Array.isArray(graph.edges) ? graph.edges.length : 0,
    fileCount: Array.isArray(graph.files) ? graph.files.length : 0,
  }
}

function readJsonFile(filePath, fallbackFactory, schemaName) {
  if (!fs.existsSync(filePath)) {
    return fallbackFactory()
  }

  let parsed = null
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallbackFactory()
  }

  if (schemaName) {
    validateWithWarning(schemaName, parsed, { filePath })
  }

  return parsed
}

function readGraph(graphPath) {
  return readJsonFile(graphPath, createEmptyGraph, SCHEMA_NAMES.GRAPH)
}

function readRuntimeEnvelope(statePath) {
  return readJsonFile(statePath, createDefaultRuntimeEnvelope, SCHEMA_NAMES.RUNTIME_ENVELOPE)
}

function writeJsonFile(filePath, data) {
  writeJsonFileAtomic(filePath, data)
}

function writeGraph(graphPath, graphData) {
  writeJsonFile(graphPath, graphData)
}

function writeRuntimeEnvelope(statePath, runtimeEnvelope) {
  writeJsonFile(statePath, runtimeEnvelope)
}

function sanitizeRuntimeState(graph, runtime) {
  const normalizedState = normalizeRuntimeState(runtime)
  const nodeIds = new Set((graph.nodes || []).map((node) => node.id))

  return {
    ...normalizedState,
    highlightedNodeIds: normalizedState.highlightedNodeIds.filter((nodeId) => nodeIds.has(nodeId)),
    focus:
      normalizedState.focus?.nodeId && nodeIds.has(normalizedState.focus.nodeId)
        ? normalizedState.focus
        : null,
    guidedFlow:
      Array.isArray(normalizedState.guidedFlow?.steps) &&
      normalizedState.guidedFlow.steps.some((nodeId) => nodeIds.has(nodeId))
        ? {
            ...normalizedState.guidedFlow,
            steps: normalizedState.guidedFlow.steps.filter((nodeId) => nodeIds.has(nodeId)),
          }
        : null,
  }
}

function buildFocusRequest(previousFocus, nodeId, zoom = 1) {
  if (!nodeId) {
    return null
  }

  const normalizedZoom = Number.isFinite(zoom) ? zoom : 1

  if (
    previousFocus?.nodeId === nodeId &&
    (previousFocus.zoom || 1) === normalizedZoom
  ) {
    return previousFocus
  }

  return {
    nodeId,
    zoom: normalizedZoom,
    requestedAt: new Date().toISOString(),
  }
}

function buildNextRuntimeEnvelope(previousEnvelope, graph, runtime, graphChanged) {
  return {
    graphRevision: graphChanged ? previousEnvelope.graphRevision + 1 : previousEnvelope.graphRevision,
    updatedAt: new Date().toISOString(),
    graphMeta: summarizeGraph(graph),
    runtime: sanitizeRuntimeState(graph, runtime),
  }
}

function applyGraphChangesToGraph(graph, payload = {}) {
  const changes = payload.changes || {}
  const removedNodeIds = new Set(Array.isArray(changes.removedNodes) ? changes.removedNodes : [])
  const removedEdgeIds = new Set(Array.isArray(changes.removedEdges) ? changes.removedEdges : [])
  const updatedNodes = Array.isArray(changes.updatedNodes) ? changes.updatedNodes : []
  const addedNodes = Array.isArray(changes.addedNodes) ? changes.addedNodes : []
  const addedEdges = Array.isArray(changes.addedEdges) ? changes.addedEdges : []

  if (payload.meta) {
    graph.meta = {
      ...graph.meta,
      ...payload.meta,
      generatedAt: payload.meta.generatedAt || graph.meta?.generatedAt || new Date().toISOString(),
      source: payload.meta.source || graph.meta?.source || GRAPH_SOURCES.FILE_SHIM,
    }
  }

  if (Array.isArray(payload.files)) {
    graph.files = payload.files
  }

  graph.edges = graph.edges.filter(
    (edge) =>
      !removedEdgeIds.has(edge.id) &&
      !removedNodeIds.has(edge.source) &&
      !removedNodeIds.has(edge.target),
  )
  graph.nodes = graph.nodes.filter((node) => !removedNodeIds.has(node.id))

  if (updatedNodes.length || addedNodes.length) {
    const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]))

    for (const entry of updatedNodes) {
      const existingNode = nodeMap.get(entry.nodeId)

      if (existingNode) {
        nodeMap.set(entry.nodeId, {
          ...existingNode,
          ...entry.fields,
        })
      }
    }

    for (const node of addedNodes) {
      if (node?.id) {
        nodeMap.set(node.id, node)
      }
    }

    graph.nodes = [...nodeMap.values()]
  }

  if (addedEdges.length) {
    const edgeMap = new Map(graph.edges.map((edge) => [edge.id, edge]))

    for (const edge of addedEdges) {
      if (edge?.id) {
        edgeMap.set(edge.id, edge)
      }
    }

    graph.edges = [...edgeMap.values()]
  }

  const validNodeIds = new Set(graph.nodes.map((node) => node.id))
  graph.edges = graph.edges.filter(
    (edge) => validNodeIds.has(edge.source) && validNodeIds.has(edge.target),
  )

  return graph
}

async function invokeFileShim(client, toolName, payload) {
  const graphPath = client.graphPath || DEFAULT_RUNTIME_GRAPH_PATH
  const statePath = client.statePath || DEFAULT_RUNTIME_STATE_PATH
  const graph = readGraph(graphPath)
  const runtimeEnvelope = readRuntimeEnvelope(statePath)

  switch (toolName) {
    case 'render_graph': {
      const nextGraph = {
        meta: {
          ...graph.meta,
          ...(payload.meta || {}),
          generatedAt: payload.meta?.generatedAt || new Date().toISOString(),
          source: payload.meta?.source || GRAPH_SOURCES.FILE_SHIM,
        },
        nodes: payload.nodes || [],
        edges: payload.edges || [],
        files: payload.files || [],
      }

      writeGraph(graphPath, nextGraph)
      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(runtimeEnvelope, nextGraph, payload.runtime || runtimeEnvelope.runtime, true),
      )
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, statePath }
    }

    case 'add_node': {
      graph.nodes = [...graph.nodes.filter((node) => node.id !== payload.node.id), payload.node]
      writeGraph(graphPath, graph)
      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(runtimeEnvelope, graph, runtimeEnvelope.runtime, true),
      )
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, statePath }
    }

    case 'remove_node': {
      graph.nodes = graph.nodes.filter((node) => node.id !== payload.nodeId)
      graph.edges = graph.edges.filter(
        (edge) => edge.source !== payload.nodeId && edge.target !== payload.nodeId,
      )
      writeGraph(graphPath, graph)
      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(runtimeEnvelope, graph, runtimeEnvelope.runtime, true),
      )
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, statePath }
    }

    case 'update_node': {
      graph.nodes = graph.nodes.map((node) =>
        node.id === payload.nodeId ? { ...node, ...payload.fields } : node,
      )
      writeGraph(graphPath, graph)
      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(runtimeEnvelope, graph, runtimeEnvelope.runtime, true),
      )
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, statePath }
    }

    case 'add_edge': {
      graph.edges = [...graph.edges.filter((edge) => edge.id !== payload.edge.id), payload.edge]
      writeGraph(graphPath, graph)
      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(runtimeEnvelope, graph, runtimeEnvelope.runtime, true),
      )
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, statePath }
    }

    case 'remove_edge': {
      graph.edges = graph.edges.filter((edge) => edge.id !== payload.edgeId)
      writeGraph(graphPath, graph)
      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(runtimeEnvelope, graph, runtimeEnvelope.runtime, true),
      )
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, statePath }
    }

    case 'apply_graph_patch': {
      const nextGraph = applyGraphChangesToGraph(graph, payload)
      writeGraph(graphPath, nextGraph)
      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(runtimeEnvelope, nextGraph, payload.runtime || runtimeEnvelope.runtime, true),
      )
      return {
        transport: GRAPH_SOURCES.FILE_SHIM,
        toolName,
        graphPath,
        statePath,
        operationCount:
          (payload.changes?.addedNodes?.length || 0) +
          (payload.changes?.removedNodes?.length || 0) +
          (payload.changes?.updatedNodes?.length || 0) +
          (payload.changes?.addedEdges?.length || 0) +
          (payload.changes?.removedEdges?.length || 0),
      }
    }

    case 'highlight_nodes': {
      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(graph ? runtimeEnvelope : createDefaultRuntimeEnvelope(), graph, {
          ...runtimeEnvelope.runtime,
          highlightedNodeIds: payload.nodeIds || [],
          highlightColor: payload.color || 'accent',
          guidedFlow: null,
        }, false),
      )
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, statePath }
    }

    case 'clear_highlight': {
      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(runtimeEnvelope, graph, {
          ...runtimeEnvelope.runtime,
          highlightedNodeIds: [],
          guidedFlow: null,
        }, false),
      )
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, statePath }
    }

    case 'navigate_to': {
      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(runtimeEnvelope, graph, {
          ...runtimeEnvelope.runtime,
          focus: buildFocusRequest(
            runtimeEnvelope.runtime.focus,
            payload.nodeId,
            payload.zoom || 1,
          ),
        }, false),
      )
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, statePath }
    }

    case 'guided_flow': {
      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(runtimeEnvelope, graph, {
          ...runtimeEnvelope.runtime,
          highlightedNodeIds: payload.steps || [],
          guidedFlow: {
            steps: payload.steps || [],
            delay: payload.delay || 1500,
            requestedAt: new Date().toISOString(),
          },
        }, false),
      )
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, statePath }
    }

    case 'set_health_overlay': {
      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(runtimeEnvelope, graph, {
          ...runtimeEnvelope.runtime,
          healthOverlay: !!payload.enabled,
        }, false),
      )
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, statePath }
    }

    case 'set_presentation_mode': {
      const nextMode = normalizePresentationMode(payload.mode)
      const shouldResetScene = payload.resetScene !== false
      const nextPresentation =
        nextMode === PRESENTATION_MODES.FREE
          ? {
              mode: PRESENTATION_MODES.FREE,
              lockInput: false,
              title: null,
              explanation: null,
              body: null,
              stepLabel: null,
              updatedAt: new Date().toISOString(),
            }
          : {
              ...runtimeEnvelope.runtime.presentation,
              mode: nextMode,
              lockInput:
                typeof payload.lockInput === 'boolean'
                  ? payload.lockInput
                  : nextMode === PRESENTATION_MODES.LOCKED,
              explanation:
                payload.explanation === undefined
                  ? shouldResetScene
                    ? 'entering presentation'
                    : runtimeEnvelope.runtime.presentation?.explanation || null
                  : payload.explanation || null,
              body:
                payload.explanation === undefined
                  ? shouldResetScene
                    ? 'entering presentation'
                    : runtimeEnvelope.runtime.presentation?.body || null
                  : payload.explanation || null,
              title:
                payload.title === undefined
                  ? shouldResetScene
                    ? null
                    : runtimeEnvelope.runtime.presentation?.title || null
                  : payload.title || null,
              stepLabel:
                payload.stepLabel === undefined
                  ? shouldResetScene
                    ? null
                    : runtimeEnvelope.runtime.presentation?.stepLabel || null
                  : payload.stepLabel || null,
              updatedAt: new Date().toISOString(),
            }

      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(runtimeEnvelope, graph, {
          ...runtimeEnvelope.runtime,
          highlightedNodeIds: shouldResetScene ? [] : runtimeEnvelope.runtime.highlightedNodeIds,
          focus: shouldResetScene ? null : runtimeEnvelope.runtime.focus,
          guidedFlow: shouldResetScene ? null : runtimeEnvelope.runtime.guidedFlow,
          presentation: nextPresentation,
        }, false),
      )
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, statePath }
    }

    case 'present_step': {
      const nextMode = normalizePresentationMode(
        payload.mode || runtimeEnvelope.runtime.presentation?.mode || PRESENTATION_MODES.GUIDED,
      )
      const nextExplanation = payload.explanation || null

      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(runtimeEnvelope, graph, {
          ...runtimeEnvelope.runtime,
          highlightedNodeIds: payload.nodeIds || [],
          highlightColor: payload.color || 'accent',
          guidedFlow: null,
          focus: buildFocusRequest(
            runtimeEnvelope.runtime.focus,
            payload.nodeId,
            payload.zoom || 1,
          ),
          presentation: {
            ...runtimeEnvelope.runtime.presentation,
            mode: nextMode,
            lockInput:
              typeof payload.lockInput === 'boolean'
                ? payload.lockInput
                : nextMode === PRESENTATION_MODES.LOCKED,
            title: payload.title || null,
            explanation: nextExplanation,
            body: nextExplanation,
            stepLabel: payload.stepLabel || null,
            updatedAt: new Date().toISOString(),
          },
        }, false),
      )
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, statePath }
    }

    case 'show_caption': {
      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(runtimeEnvelope, graph, {
          ...runtimeEnvelope.runtime,
          presentation: {
            ...runtimeEnvelope.runtime.presentation,
            mode: runtimeEnvelope.runtime.presentation?.mode || PRESENTATION_MODES.GUIDED,
            lockInput:
              typeof runtimeEnvelope.runtime.presentation?.lockInput === 'boolean'
                ? runtimeEnvelope.runtime.presentation.lockInput
                : normalizePresentationMode(runtimeEnvelope.runtime.presentation?.mode) === PRESENTATION_MODES.LOCKED,
            title: payload.title || null,
            explanation: payload.body || '',
            body: payload.body || '',
            stepLabel: payload.stepLabel || null,
            updatedAt: new Date().toISOString(),
          },
        }, false),
      )
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, statePath }
    }

    case 'clear_caption': {
      writeRuntimeEnvelope(
        statePath,
        buildNextRuntimeEnvelope(runtimeEnvelope, graph, {
          ...runtimeEnvelope.runtime,
          presentation: {
            ...runtimeEnvelope.runtime.presentation,
            title: null,
            explanation: null,
            body: null,
            stepLabel: null,
            updatedAt: new Date().toISOString(),
          },
        }, false),
      )
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, statePath }
    }

    default:
      return { transport: GRAPH_SOURCES.FILE_SHIM, toolName, graphPath, supported: false }
  }
}

async function invokeTool(client, toolName, payload) {
  if (typeof client?.callTool === 'function') {
    return client.callTool(toolName, {
      ...(payload || {}),
      __runtimeTarget: {
        graphPath: client.graphPath || DEFAULT_RUNTIME_GRAPH_PATH,
        statePath: client.statePath || DEFAULT_RUNTIME_STATE_PATH,
      },
    })
  }

  return invokeFileShim(client, toolName, payload)
}

export function createMcpClient(options = {}) {
  return {
    mode: options.mode || GRAPH_SOURCES.FILE_SHIM,
    graphPath: options.graphPath || DEFAULT_RUNTIME_GRAPH_PATH,
    statePath: options.statePath || DEFAULT_RUNTIME_STATE_PATH,
    callTool: options.callTool,
  }
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

export async function connectMcpClient(options = {}) {
  if (options.mode !== 'stdio') {
    return createMcpClient(options)
  }

  try {
    const [{ Client }, { StdioClientTransport }] = await Promise.all([
      import('@modelcontextprotocol/sdk/client/index.js'),
      import('@modelcontextprotocol/sdk/client/stdio.js'),
    ])
    const repoRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)))
    const transport = new StdioClientTransport({
      command: npmCommand(),
      args: ['run', 'mcp'],
      cwd: repoRoot,
      stderr: 'pipe',
    })
    const client = new Client({
      name: 'claudemap-skill',
      version: '0.1.0',
    })

    await client.connect(transport)

    return {
      mode: 'stdio',
      client,
      transport,
      graphPath: options.graphPath || DEFAULT_RUNTIME_GRAPH_PATH,
      statePath: options.statePath || DEFAULT_RUNTIME_STATE_PATH,
      callTool: (toolName, args) =>
        client.callTool({
          name: toolName,
          arguments: args,
        }),
    }
  } catch (error) {
    if (options.allowFallback === false) {
      throw error
    }

    return {
      ...createMcpClient(options),
      requestedMode: 'stdio',
      fallbackReason: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function closeMcpClient(mcpClient) {
  if (mcpClient?.client && typeof mcpClient.client.close === 'function') {
    await mcpClient.client.close()
  }
}

export function getRuntimeGraphPath() {
  return DEFAULT_RUNTIME_GRAPH_PATH
}

export function getRuntimeStatePath() {
  return DEFAULT_RUNTIME_STATE_PATH
}

export function readRuntimeGraph(graphPath = DEFAULT_RUNTIME_GRAPH_PATH) {
  return readGraph(graphPath)
}

export function readRuntimeState(statePath = DEFAULT_RUNTIME_STATE_PATH) {
  return readRuntimeEnvelope(statePath)
}

export async function renderGraph(mcpClient, graphData) {
  return invokeTool(mcpClient, 'render_graph', {
    meta: graphData.meta,
    nodes: graphData.nodes,
    edges: graphData.edges,
    files: graphData.files,
    runtime: graphData.runtime,
  })
}

export async function highlightNodes(mcpClient, nodeIds, color = 'accent') {
  return invokeTool(mcpClient, 'highlight_nodes', { nodeIds, color })
}

export async function clearHighlight(mcpClient) {
  return invokeTool(mcpClient, 'clear_highlight', {})
}

export async function navigateTo(mcpClient, nodeId, zoom = 1) {
  return invokeTool(mcpClient, 'navigate_to', { nodeId, zoom })
}

export async function guidedFlow(mcpClient, steps, delay = 1500) {
  return invokeTool(mcpClient, 'guided_flow', { steps, delay })
}

export async function setHealthOverlay(mcpClient, enabled) {
  return invokeTool(mcpClient, 'set_health_overlay', { enabled })
}

export async function setPresentationMode(mcpClient, mode = PRESENTATION_MODES.FREE, options = {}) {
  return invokeTool(mcpClient, 'set_presentation_mode', {
    mode,
    lockInput: options.lockInput,
    title: options.title,
    stepLabel: options.stepLabel,
    explanation: options.explanation,
    resetScene: options.resetScene,
  })
}

export async function presentStep(mcpClient, options = {}) {
  return invokeTool(mcpClient, 'present_step', {
    nodeId: options.nodeId || null,
    nodeIds: options.nodeIds || [],
    color: options.color || 'accent',
    zoom: options.zoom || 1,
    mode: options.mode || PRESENTATION_MODES.GUIDED,
    lockInput: options.lockInput,
    title: options.title || null,
    stepLabel: options.stepLabel || null,
    explanation: options.explanation || null,
  })
}

export async function showCaption(mcpClient, body, options = {}) {
  return invokeTool(mcpClient, 'show_caption', {
    title: options.title || null,
    body,
    stepLabel: options.stepLabel || null,
  })
}

export async function clearCaption(mcpClient) {
  return invokeTool(mcpClient, 'clear_caption', {})
}

export async function addNode(mcpClient, node) {
  return invokeTool(mcpClient, 'add_node', { node })
}

export async function removeNode(mcpClient, nodeId) {
  return invokeTool(mcpClient, 'remove_node', { nodeId })
}

export async function updateNode(mcpClient, nodeId, fields) {
  return invokeTool(mcpClient, 'update_node', { nodeId, fields })
}

export async function addEdge(mcpClient, edge) {
  return invokeTool(mcpClient, 'add_edge', { edge })
}

export async function removeEdge(mcpClient, edgeId) {
  return invokeTool(mcpClient, 'remove_edge', { edgeId })
}

export async function applyGraphPatch(mcpClient, payload) {
  return invokeTool(mcpClient, 'apply_graph_patch', payload)
}
