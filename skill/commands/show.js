#!/usr/bin/env node
import {
  clearHighlight,
  clearCaption,
  closeMcpClient,
  connectMcpClient,
  guidedFlow,
  highlightNodes,
  navigateTo,
  presentStep,
  readRuntimeGraph,
  setPresentationMode,
  setHealthOverlay,
  showCaption,
} from '../lib/mcp-client.js'

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

function parseCommandOptions(args) {
  const positional = []
  const options = {}

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]

    if (argument === '--lock') {
      options.lockInput = true
      continue
    }

    if (argument === '--unlock') {
      options.lockInput = false
      continue
    }

    if (['--title', '--step', '--explain', '--mode', '--zoom'].includes(argument)) {
      const nextValue = args[index + 1]

      if (!nextValue || nextValue.startsWith('--')) {
        throw new Error(`Missing value for ${argument}`)
      }

      options[argument.slice(2)] = argument === '--zoom' ? Number(nextValue) : nextValue
      index += 1
      continue
    }

    positional.push(argument)
  }

  if (options.zoom !== undefined && !Number.isFinite(options.zoom)) {
    throw new Error('Invalid --zoom value')
  }

  return { positional, options }
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

function readGraphOrExit() {
  const graph = readRuntimeGraph()

  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    throw new Error('No runtime graph found. Run /setup-claudemap first.')
  }

  return graph
}

function printUsage() {
  console.log('ClaudeMap show commands:')
  console.log(
    '  node skill/commands/show.js highlight <query[, query2 ...]> [--zoom <value>] [--explain "..."]',
  )
  console.log('  node skill/commands/show.js clear-highlight')
  console.log(
    '  node skill/commands/show.js present <query[, query2 ...]> [--title "..."] [--step "..."] [--explain "..."]',
  )
  console.log('  node skill/commands/show.js navigate <query> [--zoom <value>]')
  console.log('  node skill/commands/show.js health <on|off>')
  console.log('  node skill/commands/show.js mode <free|guided|locked-demo>')
  console.log('  node skill/commands/show.js caption [--title <title>] [--step <step>] <body>')
  console.log('  node skill/commands/show.js clear-caption')
  console.log('  node skill/commands/show.js flow <query1> <query2> [query3 ...]')
  console.log('  node skill/commands/show.js ask "<phrase>"')
}

async function main() {
  const [action, ...args] = process.argv.slice(2)
  const useStdioMcp = args.includes('--stdio-mcp')
  const commandArgs = args.filter((arg) => arg !== '--stdio-mcp')
  const client = await connectMcpClient({ mode: useStdioMcp ? 'stdio' : 'file-shim' })

  if (!action) {
    printUsage()
    process.exitCode = 1
    await closeMcpClient(client)
    return
  }

  if (action === 'clear-highlight') {
    await clearHighlight(client)
    console.log('Cleared highlights')
    await closeMcpClient(client)
    return
  }

  if (action === 'clear-caption') {
    await clearCaption(client)
    console.log('Cleared presentation caption')
    await closeMcpClient(client)
    return
  }

  if (action === 'health') {
    const value = (commandArgs[0] || '').toLowerCase()

    if (!['on', 'off'].includes(value)) {
      throw new Error('Usage: health <on|off>')
    }

    await setHealthOverlay(client, value === 'on')
    console.log(`Health overlay ${value}`)
    await closeMcpClient(client)
    return
  }

  if (action === 'mode') {
    const mode = (commandArgs[0] || '').toLowerCase()

    if (!['free', 'guided', 'locked-demo'].includes(mode)) {
      throw new Error('Usage: mode <free|guided|locked-demo>')
    }

    await setPresentationMode(client, mode, {
      lockInput: mode === 'locked-demo',
    })
    console.log(`Presentation mode ${mode}`)
    await closeMcpClient(client)
    return
  }

  if (action === 'caption') {
    const titleIndex = commandArgs.indexOf('--title')
    const stepIndex = commandArgs.indexOf('--step')
    const title = titleIndex !== -1 ? commandArgs[titleIndex + 1] || '' : ''
    const stepLabel = stepIndex !== -1 ? commandArgs[stepIndex + 1] || '' : ''
    const bodyTokens = commandArgs.filter((argument, index) => {
      if (argument === '--title' || argument === '--step') {
        return false
      }

      const previousArgument = commandArgs[index - 1]
      return previousArgument !== '--title' && previousArgument !== '--step'
    })
    const body = bodyTokens.join(' ').trim()

    if (!body) {
      throw new Error('Usage: caption [--title <title>] [--step <step>] <body>')
    }

    await showCaption(client, body, {
      title: title || null,
      stepLabel: stepLabel || null,
    })
    console.log(`Caption updated${title ? `: ${title}` : ''}`)
    await closeMcpClient(client)
    return
  }

  const graph = readGraphOrExit()

  if (action === 'highlight') {
    const { positional, options } = parseCommandOptions(commandArgs)
    const query = positional.join(' ').trim()

    if (!query) {
      throw new Error('Usage: highlight <query[, query2 ...]> [--zoom <value>] [--explain "..."]')
    }

    const resolvedNodes = resolveNodes(graph, query)
    const primaryNode = resolvedNodes[0]
    const nodeIds = uniqueArray(
      resolvedNodes.flatMap((node) => buildHighlightNodeIds(graph, node)),
    )
    const zoom = options.zoom ?? getDefaultZoomForNode(primaryNode)

    if (
      options.explain ||
      options.title ||
      options.step ||
      options.mode ||
      typeof options.lockInput === 'boolean'
    ) {
      await presentStep(client, {
        nodeId: primaryNode.id,
        nodeIds,
        zoom,
        mode: options.mode || 'guided',
        lockInput: options.lockInput,
        title: options.title || null,
        stepLabel: options.step || null,
        explanation: options.explain || null,
      })
      console.log(`Presented ${resolvedNodes.map((node) => node.label).join(', ')}`)
      await closeMcpClient(client)
      return
    }

    await highlightNodes(client, nodeIds)
    await navigateTo(client, primaryNode.id, zoom)
    console.log(
      `Highlighted ${resolvedNodes.map((node) => node.label).join(', ')} (${nodeIds.length} nodes)`,
    )
    await closeMcpClient(client)
    return
  }

  if (action === 'present') {
    const { positional, options } = parseCommandOptions(commandArgs)
    const query = positional.join(' ').trim()

    if (!query) {
      throw new Error(
        'Usage: present <query[, query2 ...]> [--title "..."] [--step "..."] [--explain "..."]',
      )
    }

    const resolvedNodes = resolveNodes(graph, query)
    const primaryNode = resolvedNodes[0]
    const nodeIds = uniqueArray(
      resolvedNodes.flatMap((node) => buildHighlightNodeIds(graph, node)),
    )
    await presentStep(client, {
      nodeId: primaryNode.id,
      nodeIds,
      zoom: options.zoom ?? getDefaultZoomForNode(primaryNode),
      mode: options.mode || 'guided',
      lockInput: options.lockInput,
      title: options.title || null,
      stepLabel: options.step || null,
      explanation: options.explain || null,
    })
    console.log(`Presented ${resolvedNodes.map((node) => node.label).join(', ')}`)
    await closeMcpClient(client)
    return
  }

  if (action === 'navigate') {
    const { positional, options } = parseCommandOptions(commandArgs)
    const query = positional.join(' ').trim()

    if (!query) {
      throw new Error('Usage: navigate <query> [--zoom <value>]')
    }

    const node = resolveNode(graph, query)

    if (!node) {
      throw new Error(`No node matched "${query}"`)
    }

    await navigateTo(client, node.id, options.zoom ?? getDefaultZoomForNode(node))
    console.log(`Navigating to ${node.label}`)
    await closeMcpClient(client)
    return
  }

  if (action === 'flow') {
    if (commandArgs.length < 2) {
      throw new Error('Usage: flow <query1> <query2> [query3 ...]')
    }

    const resolvedNodes = commandArgs.map((query) => {
      const node = resolveNode(graph, query)

      if (!node) {
        throw new Error(`No node matched "${query}"`)
      }

      return node
    })

    await guidedFlow(
      client,
      resolvedNodes.map((node) => node.id),
      1200,
    )
    console.log(`Started guided flow across ${resolvedNodes.length} nodes`)
    await closeMcpClient(client)
    return
  }

  if (action === 'ask') {
    const phrase = commandArgs.join(' ').trim().toLowerCase()

    if (!phrase) {
      throw new Error('Usage: ask "<phrase>"')
    }

    if (phrase.includes("what's wrong") || phrase.includes('what is wrong')) {
      const worstNode = findWorstNode(graph)

      if (!worstNode) {
        throw new Error('Could not determine a worst node from the runtime graph')
      }

      await setHealthOverlay(client, true)
      await navigateTo(client, worstNode.id, 1.05)
      console.log(
        `${worstNode.label}: ${worstNode.healthReason || 'This node has the highest current health severity.'}`,
      )
      await closeMcpClient(client)
      return
    }

    if (phrase.startsWith('highlight ')) {
      const query = parseIntentTarget(phrase, ['highlight the ', 'highlight '], [' system'])
      const node = resolveNode(graph, query)

      if (!node) {
        throw new Error(`No node matched "${query}"`)
      }

      const nodeIds = buildHighlightNodeIds(graph, node)
      await highlightNodes(client, nodeIds)
      await navigateTo(client, node.id, getDefaultZoomForNode(node))
      console.log(`Highlighted ${node.label}`)
      await closeMcpClient(client)
      return
    }

    if (phrase.startsWith('what depends on ')) {
      const query = parseIntentTarget(phrase, ['what depends on the ', 'what depends on '])
      const node = resolveNode(graph, query)
      const targetSystemId = node?.type === 'system' ? node.id : node?.parentId

      if (!node || !targetSystemId) {
        throw new Error(`No system matched "${query}"`)
      }

      const dependentSystemIds = findDependentSystemIds(graph, targetSystemId)
      const nodeIds = uniqueArray(
        dependentSystemIds.flatMap((systemId) => collectBranchIds(graph.nodes, systemId)),
      )

      await highlightNodes(client, nodeIds)
      console.log(
        nodeIds.length
          ? `Highlighted ${dependentSystemIds.length} dependent systems for ${node.label}`
          : `No systems currently depend on ${node.label}`,
      )
      await closeMcpClient(client)
      return
    }

    if (phrase.startsWith('show me how ') && phrase.endsWith(' works')) {
      const query = parseIntentTarget(phrase, ['show me how '], [' works'])
      const node = resolveNode(graph, query)

      if (!node) {
        throw new Error(`No node matched "${query}"`)
      }

      const steps = buildGuidedSteps(graph, node)
      await guidedFlow(client, steps, 1200)
      console.log(`Started guided flow for ${node.label}`)
      await closeMcpClient(client)
      return
    }

    throw new Error(`No built-in intent matched "${phrase}"`)
  }

  printUsage()
  process.exitCode = 1
  await closeMcpClient(client)
}

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))]
}

main().catch((error) => {
  console.error(`ClaudeMap show failed: ${error.message}`)
  process.exitCode = 1
})
