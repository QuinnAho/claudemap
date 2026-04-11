export const toolDefinitions = [
  {
    name: 'render_graph',
    description: 'Placeholder for full graph rendering.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'add_node',
    description: 'Placeholder for incremental node insertion.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'remove_node',
    description: 'Placeholder for node removal.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'update_node',
    description: 'Placeholder for node updates.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'add_edge',
    description: 'Placeholder for edge insertion.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'remove_edge',
    description: 'Placeholder for edge removal.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'highlight_nodes',
    description: 'Placeholder for node highlighting.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'clear_highlight',
    description: 'Placeholder for highlight reset.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'navigate_to',
    description: 'Placeholder for camera navigation.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'guided_flow',
    description: 'Placeholder for guided flow playback.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'set_health_overlay',
    description: 'Placeholder for health overlay toggling.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function textResponse(toolName) {
  return {
    content: [
      {
        type: 'text',
        text: `${toolName} is not implemented yet.`,
      },
    ],
  };
}

export function createToolHandlers() {
  return Object.fromEntries(
    toolDefinitions.map((definition) => [
      definition.name,
      async () => textResponse(definition.name),
    ]),
  );
}
