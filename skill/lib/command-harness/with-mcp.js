import { connectMcpClient, closeMcpClient } from '../mcp-client.js'
import { GRAPH_SOURCES } from '../contracts/graph-sources.js'
import { ClaudeMapError, ERROR_CODES } from '../contracts/errors.js'

export async function withMcp({ mode, requireStdio, activeMap, log }, handler) {
  if (!mode) {
    return handler(null)
  }

  const client = await connectMcpClient({
    mode: mode === 'stdio' ? 'stdio' : GRAPH_SOURCES.FILE_SHIM,
    graphPath: activeMap.graphPath,
    statePath: activeMap.statePath,
  })

  try {
    if (requireStdio && client.fallbackReason) {
      throw new ClaudeMapError(
        ERROR_CODES.MCP_FALLBACK_FORBIDDEN,
        'stdio MCP transport is required but unavailable',
        client.fallbackReason,
      )
    }

    if (client.fallbackReason) {
      log.warn(ERROR_CODES.MCP_FALLBACK_FILE_SHIM, { reason: client.fallbackReason })
    }

    return await handler(client)
  } finally {
    await closeMcpClient(client)
  }
}
