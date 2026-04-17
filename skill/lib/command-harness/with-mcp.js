import { connectMcpClient, closeMcpClient } from '../mcp-client.js'
import { GRAPH_SOURCES } from '../contracts/graph-sources.js'
import { ClaudeMapError } from '../contracts/errors.js'

// MCP client lifecycle harness.
// This is the ONLY place in the skill layer that calls closeMcpClient.
// Every command uses this wrapper; no command touches the lifecycle directly.

export async function withMcp({ mode, requireStdio, activeMap, log }, handler) {
  if (!mode) {
    // Command does not require MCP
    return handler(null)
  }

  const client = await connectMcpClient({
    mode: mode === 'stdio' ? 'stdio' : GRAPH_SOURCES.FILE_SHIM,
    graphPath: activeMap.graphPath,
    statePath: activeMap.statePath,
  })

  if (requireStdio && client.fallbackReason) {
    await closeMcpClient(client)
    throw new ClaudeMapError(
      'MCP_FALLBACK_FORBIDDEN',
      'stdio MCP transport is required but unavailable',
      client.fallbackReason,
    )
  }

  if (client.fallbackReason) {
    log.warn('MCP_FALLBACK_FILE_SHIM', { reason: client.fallbackReason })
  }

  try {
    return await handler(client)
  } finally {
    await closeMcpClient(client)
  }
}
