import { createToolHandlers, toolDefinitions } from './handlers.js';

const handlers = createToolHandlers();

console.log('ClaudeMap MCP scaffold');
console.log(`Planned tools: ${toolDefinitions.map((tool) => tool.name).join(', ')}`);
console.log(`Stub handlers loaded: ${Object.keys(handlers).length}`);
