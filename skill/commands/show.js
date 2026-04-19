#!/usr/bin/env node
import {
  clearHighlight,
  clearCaption,
  guidedFlow,
  highlightNodes,
  navigateTo,
  presentStep,
  readRuntimeGraph,
  setPresentationMode,
  setHealthOverlay,
  showCaption,
} from '../lib/mcp-client.js'
import { PRESENTATION_MODES, PRESENTATION_MODE_LIST } from '../lib/contracts/presentation.js'
import { runCommand, exitOnError } from '../lib/command-harness/run-command.js'
import { success, failure, ERROR_CODES } from '../lib/contracts/errors.js'
import { fileURLToPath } from 'url'
import path from 'path'

const CURRENT_FILE_PATH = fileURLToPath(import.meta.url)

function scoreNode(node, query) {
  const normalizedQuery = query.toLowerCase()
  const label = String(node.label || '').toLowerCase()
  const filePath = String(node.filePath || '').toLowerCase()
  const id = String(node.id || '').toLowerCase()

  if (id === normalizedQuery) return 100
  if (label === normalizedQuery) return 95
  if (filePath === normalizedQuery) return 90
  if (label.includes(normalizedQuery)) return 70
  if (filePath.includes(normalizedQuery)) return 65
  if (id.includes(normalizedQuery)) return 60
  return -1
}

function resolveNode(graph, query) {
  const rankedNodes = graph.nodes
    .map((node) => ({ node, score: scoreNode(node, query) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.node.label.localeCompare(right.node.label))

  return rankedNodes[0]?.node || null
}

function parseQueryList(query) {
  return uniqueArray(
    query
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )
}

function resolveNodes(graph, query) {
  return uniqueArray(parseQueryList(query)).map((queryPart) => {
    const node = resolveNode(graph, queryPart)

    if (!node) {
      throw new Error(`No node matched "${queryPart}"`)
    }

    return node
  })
}

function collectDescendantIds(nodes, parentId) {
  const descendants = []
  const queue = [parentId]

  while (queue.length) {
    const currentParentId = queue.shift()
    const children = nodes.filter((node) => node.parentId === currentParentId)

    for (const child of children) {
      descendants.push(child.id)
      queue.push(child.id)
    }
  }

  return descendants
}

function collectBranchIds(nodes, nodeId) {
  return [nodeId, ...collectDescendantIds(nodes, nodeId)]
}

function collectAncestorIds(nodes, nodeId) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const ancestors = []
  let walker = nodeById.get(nodeId)

  while (walker?.parentId) {
    const parentNode = nodeById.get(walker.parentId)

    if (!parentNode) {
      break
    }

    ancestors.unshift(parentNode.id)
    walker = parentNode
  }

  return ancestors
}

function buildHighlightNodeIds(graph, node) {
  const ancestorIds = collectAncestorIds(graph.nodes, node.id)

  if (node.type === 'system') {
    return uniqueArray(collectBranchIds(graph.nodes, node.id))
  }

  if (node.type === 'file') {
    return uniqueArray([
      ...ancestorIds,
      node.id,
      ...collectDescendantIds(graph.nodes, node.id),
    ])
  }

  return uniqueArray([...ancestorIds, node.id])
}

function getDefaultZoomForNode(node) {
  if (node.type === 'function') {
    return 1.18
  }

  if (node.type === 'file') {
    return 1.04
  }

  return node.parentId ? 0.94 : 0.82
}

function findWorstNode(graph) {
  const severity = { red: 3, yellow: 2, green: 1 }

  return [...graph.nodes]
    .filter((node) => node.type === 'system' || node.type === 'file')
    .sort((left, right) => {
      const severityDelta = (severity[right.health] || 0) - (severity[left.health] || 0)

      if (severityDelta !== 0) {
        return severityDelta
      }

      return (right.lineCount || 0) - (left.lineCount || 0)
    })[0]
}

function parseIntentTarget(phrase, prefixes, suffixes = []) {
  let value = phrase

  for (const prefix of prefixes) {
    if (value.startsWith(prefix)) {
      value = value.slice(prefix.length)
      break
    }
  }

  for (const suffix of suffixes) {
    if (value.endsWith(suffix)) {
      value = value.slice(0, -suffix.length)
      break
    }
  }

  return value.trim()
}

function findDependentSystemIds(graph, targetSystemId) {
  return graph.edges
    .filter((edge) => edge.target === targetSystemId)
    .map((edge) => edge.source)
}

function buildGuidedSteps(graph, node) {
  if (node.type === 'system') {
    return collectBranchIds(graph.nodes, node.id).slice(0, 5)
  }

  if (node.type === 'file') {
    return [node.parentId, node.id, ...collectDescendantIds(graph.nodes, node.id).slice(0, 3)].filter(Boolean)
  }

  return [node.parentId, node.id].filter(Boolean)
}

async function revertToFreeMode(client) {
  await setPresentationMode(client, PRESENTATION_MODES.FREE, { resetScene: false })
}

function readGraphOrExit(graphPath) {
  const graph = readRuntimeGraph(graphPath)

  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    throw new Error('No runtime graph found. Run /setup-claudemap first.')
  }

  return graph
}

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))]
}

async function handleClearHighlight({ ctx }) {
  await clearHighlight(ctx.mcp)
  console.log(`[${ctx.activeMap.mapId}] Cleared highlights`)
  return success()
}

async function handleClearCaption({ ctx }) {
  await clearCaption(ctx.mcp)
  console.log(`[${ctx.activeMap.mapId}] Cleared presentation caption`)
  return success()
}

async function handleHealth({ ctx, args }) {
  const value = args._positional?.[0]?.toLowerCase()

  if (!['on', 'off'].includes(value)) {
    return failure(ERROR_CODES.INVALID_ARGUMENT, 'Usage: health <on|off>')
  }

  await setHealthOverlay(ctx.mcp, value === 'on')
  console.log(`[${ctx.activeMap.mapId}] Health overlay ${value}`)
  return success()
}

async function handleMode({ ctx, args }) {
  const requestedMode = args._positional?.[0]?.toLowerCase()
  const mode = requestedMode === 'locked-demo' ? PRESENTATION_MODES.LOCKED : requestedMode

  if (![PRESENTATION_MODES.FREE, PRESENTATION_MODES.GUIDED, PRESENTATION_MODES.LOCKED].includes(mode)) {
    return failure(ERROR_CODES.INVALID_ARGUMENT, 'Usage: mode <free|guided|locked>')
  }

  await setPresentationMode(ctx.mcp, mode, {
    lockInput: mode === PRESENTATION_MODES.LOCKED,
  })
  console.log(`[${ctx.activeMap.mapId}] Presentation mode ${mode}`)
  return success()
}

async function handleCaption({ ctx, args }) {
  const body = args.body

  if (!body) {
    return failure(ERROR_CODES.MISSING_ARGUMENT, 'Usage: caption [--title <title>] [--step <step>] <body>')
  }

  await showCaption(ctx.mcp, body, {
    title: args.title || null,
    stepLabel: args.step || null,
  })
  console.log(`[${ctx.activeMap.mapId}] Caption updated${args.title ? `: ${args.title}` : ''}`)
  return success()
}

async function handleHighlight({ ctx, args }) {
  const query = args.query

  if (!query) {
    return failure(ERROR_CODES.MISSING_ARGUMENT, 'Usage: highlight <query[, query2 ...]> [--zoom <value>] [--explain "..."]')
  }

  const graph = readGraphOrExit(ctx.activeMap.graphPath)
  const resolvedNodes = resolveNodes(graph, query)
  const primaryNode = resolvedNodes[0]
  const nodeIds = uniqueArray(
    resolvedNodes.flatMap((node) => buildHighlightNodeIds(graph, node)),
  )
  const zoom = args.zoom ?? getDefaultZoomForNode(primaryNode)

  if (
    args.explain ||
    args.title ||
    args.step ||
    args.mode ||
    typeof args.lockInput === 'boolean'
  ) {
    await presentStep(ctx.mcp, {
      nodeId: primaryNode.id,
      nodeIds,
      zoom,
      mode: args.mode || PRESENTATION_MODES.GUIDED,
      lockInput: args.lockInput,
      title: args.title || null,
      stepLabel: args.step || null,
      explanation: args.explain || null,
    })
    if (!args.keepMode) {
      await revertToFreeMode(ctx.mcp)
    }
    console.log(`[${ctx.activeMap.mapId}] Presented ${resolvedNodes.map((node) => node.label).join(', ')}`)
    return success()
  }

  await highlightNodes(ctx.mcp, nodeIds)
  await navigateTo(ctx.mcp, primaryNode.id, zoom)
  console.log(
    `[${ctx.activeMap.mapId}] Highlighted ${resolvedNodes.map((node) => node.label).join(', ')} (${nodeIds.length} nodes)`,
  )
  return success()
}

async function handlePresent({ ctx, args }) {
  const query = args.query

  if (!query) {
    return failure(
      ERROR_CODES.MISSING_ARGUMENT,
      'Usage: present <query[, query2 ...]> [--title "..."] [--step "..."] [--explain "..."]',
    )
  }

  const graph = readGraphOrExit(ctx.activeMap.graphPath)
  const resolvedNodes = resolveNodes(graph, query)
  const primaryNode = resolvedNodes[0]
  const nodeIds = uniqueArray(
    resolvedNodes.flatMap((node) => buildHighlightNodeIds(graph, node)),
  )
  await presentStep(ctx.mcp, {
    nodeId: primaryNode.id,
    nodeIds,
    zoom: args.zoom ?? getDefaultZoomForNode(primaryNode),
    mode: args.mode || PRESENTATION_MODES.GUIDED,
    lockInput: args.lockInput,
    title: args.title || null,
    stepLabel: args.step || null,
    explanation: args.explain || null,
  })
  if (!args.keepMode) {
    await revertToFreeMode(ctx.mcp)
  }
  console.log(`[${ctx.activeMap.mapId}] Presented ${resolvedNodes.map((node) => node.label).join(', ')}`)
  return success()
}

async function handleNavigate({ ctx, args }) {
  const query = args.query

  if (!query) {
    return failure(ERROR_CODES.MISSING_ARGUMENT, 'Usage: navigate <query> [--zoom <value>]')
  }

  const graph = readGraphOrExit(ctx.activeMap.graphPath)
  const node = resolveNode(graph, query)

  if (!node) {
    return failure(ERROR_CODES.NO_NODE_MATCHED, `No node matched "${query}"`)
  }

  await navigateTo(ctx.mcp, node.id, args.zoom ?? getDefaultZoomForNode(node))
  console.log(`[${ctx.activeMap.mapId}] Navigating to ${node.label}`)
  return success()
}

async function handleFlow({ ctx, args }) {
  const queries = args._positional

  if (!queries || queries.length < 2) {
    return failure(ERROR_CODES.MISSING_ARGUMENT, 'Usage: flow <query1> <query2> [query3 ...]')
  }

  const graph = readGraphOrExit(ctx.activeMap.graphPath)
  const resolvedNodes = queries.map((query) => {
    const node = resolveNode(graph, query)

    if (!node) {
      throw new Error(`No node matched "${query}"`)
    }

    return node
  })

  await guidedFlow(
    ctx.mcp,
    resolvedNodes.map((node) => node.id),
    1200,
  )
  console.log(`[${ctx.activeMap.mapId}] Started guided flow across ${resolvedNodes.length} nodes`)
  return success()
}

async function handleAsk({ ctx, args }) {
  const phrase = args.query?.toLowerCase()

  if (!phrase) {
    return failure(ERROR_CODES.MISSING_ARGUMENT, 'Usage: ask "<phrase>"')
  }

  const graph = readGraphOrExit(ctx.activeMap.graphPath)

  if (phrase.includes("what's wrong") || phrase.includes('what is wrong')) {
    const worstNode = findWorstNode(graph)

    if (!worstNode) {
      return failure(ERROR_CODES.NO_NODE_MATCHED, 'Could not determine a worst node from the runtime graph')
    }

    await setHealthOverlay(ctx.mcp, true)
    await navigateTo(ctx.mcp, worstNode.id, 1.05)
    console.log(
      `[${ctx.activeMap.mapId}] ${worstNode.label}: ${worstNode.healthReason || 'This node has the highest current health severity.'}`,
    )
    return success()
  }

  if (phrase.startsWith('highlight ')) {
    const query = parseIntentTarget(phrase, ['highlight the ', 'highlight '], [' system'])
    const node = resolveNode(graph, query)

    if (!node) {
      return failure(ERROR_CODES.NO_NODE_MATCHED, `No node matched "${query}"`)
    }

    const nodeIds = buildHighlightNodeIds(graph, node)
    await highlightNodes(ctx.mcp, nodeIds)
    await navigateTo(ctx.mcp, node.id, getDefaultZoomForNode(node))
    console.log(`[${ctx.activeMap.mapId}] Highlighted ${node.label}`)
    return success()
  }

  if (phrase.startsWith('what depends on ')) {
    const query = parseIntentTarget(phrase, ['what depends on the ', 'what depends on '])
    const node = resolveNode(graph, query)
    const targetSystemId = node?.type === 'system' ? node.id : node?.parentId

    if (!node || !targetSystemId) {
      return failure(ERROR_CODES.NO_NODE_MATCHED, `No system matched "${query}"`)
    }

    const dependentSystemIds = findDependentSystemIds(graph, targetSystemId)
    const nodeIds = uniqueArray(
      dependentSystemIds.flatMap((systemId) => collectBranchIds(graph.nodes, systemId)),
    )

    await highlightNodes(ctx.mcp, nodeIds)
    console.log(
      nodeIds.length
        ? `[${ctx.activeMap.mapId}] Highlighted ${dependentSystemIds.length} dependent systems for ${node.label}`
        : `[${ctx.activeMap.mapId}] No systems currently depend on ${node.label}`,
    )
    return success()
  }

  if (phrase.startsWith('show me how ') && phrase.endsWith(' works')) {
    const query = parseIntentTarget(phrase, ['show me how '], [' works'])
    const node = resolveNode(graph, query)

    if (!node) {
      return failure(ERROR_CODES.NO_NODE_MATCHED, `No node matched "${query}"`)
    }

    const steps = buildGuidedSteps(graph, node)
    await guidedFlow(ctx.mcp, steps, 1200)
    console.log(`[${ctx.activeMap.mapId}] Started guided flow for ${node.label}`)
    return success()
  }

  return failure(ERROR_CODES.NO_INTENT_MATCH, `No built-in intent matched "${phrase}"`)
}

export const SHOW_COMMAND = {
  name: 'show',
  summary: 'Direct the live ClaudeMap session. Use it to focus the map, highlight architecture, present a step, compare regions, or show flow.',
  argumentHint: '[intent]',
  body: `Use ClaudeMap as a live presentation and navigation surface.

Principles:

- optimize for the fewest actions that make the user's intent visually obvious
- prefer \`present\` when the user wants explanation plus focus
- prefer \`highlight\` or \`navigate\` when the user wants quick emphasis without narration
- prefer \`flow\` when the user wants sequence or dependency motion
- keep the map legible and avoid noisy multi-step show-command spam

Workflow:
1. Resolve the bundled command script at \`.claude/skills/claudemap-runtime/skill/commands/show.js\`.
2. Read the user request as presentation intent, not just a literal command request.
3. If needed, inspect the currently active ClaudeMap runtime graph rather than assuming the root map. Prefer the bundled command's own active-map resolution over hardcoded runtime file paths.
4. Translate the request into the smallest useful set of show commands.
5. Run the show command or short command sequence with Node.
6. Briefly report what changed in the UI.

Built-in show actions include:
- \`highlight <query> [--zoom <value>] [--explain "..."] [--keep-mode]\`
- \`clear-highlight\`
- \`present <query> [--title "..."] [--step "..."] [--explain "..."] [--keep-mode]\`
- \`navigate <query> [--zoom <value>]\`
- \`health <on|off>\`
- \`mode <free|guided|locked>\`
- \`caption [--title <title>] [--step <step>] <body>\`
- \`clear-caption\`
- \`flow <query1> <query2> [query3 ...]\`
- \`ask "<phrase>"\`

Mode handling:
- \`present\` and \`highlight\` (with explain/title/step/mode/lock options) automatically revert the UI to free mode after the command runs, so one-shot \`/show\` requests never leave the user trapped in guided or locked mode.
- Pass \`--keep-mode\` when you are running multiple presentation steps in sequence (for example inside \`/explain\`) and want the UI to remain in guided or locked mode between steps.
- \`mode <x>\` still sets the mode explicitly and is not auto-reverted.

Examples of intent translation:

- "focus the auth system" -> \`navigate\` or \`highlight\`
- "walk me through request handling" -> a short \`present\` or \`flow\` sequence
- "show the riskiest area" -> \`ask "what's wrong"\`
- "put the UI in guided mode and caption this step" -> \`mode\` plus \`caption\``,
  globalFlags: [
    { name: 'stdio-mcp', type: 'boolean' },
  ],
  actions: [
    {
      name: 'highlight',
      summary: 'Highlight one or more nodes and navigate to the primary node.',
      positional: {
        name: 'query',
        rest: true,
        required: true,
      },
      flags: [
        { name: 'zoom', type: 'number' },
        { name: 'explain', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'step', type: 'string' },
        { name: 'keep-mode', type: 'boolean' },
        { name: 'mode', type: 'enum', values: PRESENTATION_MODE_LIST },
        { name: 'lock', type: 'boolean' },
        { name: 'lockInput', type: 'boolean' },
      ],
      withMcp: true,
      handler: handleHighlight,
    },
    {
      name: 'clear-highlight',
      summary: 'Clear all node highlights.',
      withMcp: true,
      handler: handleClearHighlight,
    },
    {
      name: 'present',
      summary: 'Present one or more nodes with a caption and guidance.',
      positional: {
        name: 'query',
        rest: true,
        required: true,
      },
      flags: [
        { name: 'zoom', type: 'number' },
        { name: 'title', type: 'string' },
        { name: 'step', type: 'string' },
        { name: 'explain', type: 'string' },
        { name: 'keep-mode', type: 'boolean' },
        { name: 'mode', type: 'enum', values: PRESENTATION_MODE_LIST },
        { name: 'lockInput', type: 'boolean' },
      ],
      withMcp: true,
      handler: handlePresent,
    },
    {
      name: 'navigate',
      summary: 'Navigate to a node without highlighting.',
      positional: {
        name: 'query',
        rest: true,
        required: true,
      },
      flags: [
        { name: 'zoom', type: 'number' },
      ],
      withMcp: true,
      handler: handleNavigate,
    },
    {
      name: 'health',
      summary: 'Toggle health overlay.',
      positional: {
        name: 'value',
        required: true,
      },
      withMcp: true,
      handler: handleHealth,
    },
    {
      name: 'mode',
      summary: 'Set presentation mode.',
      positional: {
        name: 'mode',
        required: true,
      },
      withMcp: true,
      handler: handleMode,
    },
    {
      name: 'caption',
      summary: 'Show a caption on the graph.',
      positional: {
        name: 'body',
        rest: true,
        required: true,
      },
      flags: [
        { name: 'title', type: 'string' },
        { name: 'step', type: 'string' },
      ],
      withMcp: true,
      handler: handleCaption,
    },
    {
      name: 'clear-caption',
      summary: 'Clear the presentation caption.',
      withMcp: true,
      handler: handleClearCaption,
    },
    {
      name: 'flow',
      summary: 'Show a guided flow across multiple nodes.',
      positional: {
        name: 'queries',
        rest: true,
        required: true,
      },
      withMcp: true,
      handler: handleFlow,
    },
    {
      name: 'ask',
      summary: 'Ask an intent-driven question about the graph.',
      positional: {
        name: 'query',
        rest: true,
        required: true,
      },
      withMcp: true,
      handler: handleAsk,
    },
  ],
}

export async function main(argv = process.argv.slice(2)) {
  return runCommand(SHOW_COMMAND, argv)
}

function isDirectExecution(fileUrl) {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(fileUrl)
}

if (isDirectExecution(import.meta.url)) {
  main().catch(exitOnError)
}
