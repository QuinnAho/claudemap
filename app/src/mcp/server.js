import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createToolHandlers, toolDefinitions } from './handlers.js'

async function main() {
  const handlers = createToolHandlers()
  const server = new McpServer({
    name: 'claudemap-app',
    version: '0.1.0',
  })

  for (const toolDefinition of toolDefinitions) {
    server.registerTool(
      toolDefinition.name,
      {
        description: toolDefinition.description,
      },
      async (argumentsObject = {}) => handlers[toolDefinition.name](argumentsObject),
    )
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  console.error(`Runtime MCP server failed: ${error.message}`)
  process.exit(1)
})
