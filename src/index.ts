#!/usr/bin/env node

const command = process.argv[2];

if (command === 'install') {
  const { runInstall } = await import('./cli/install.js');
  await runInstall();
} else if (command === 'visualize') {
  const { runVisualize } = await import('./cli/visualize.js');
  await runVisualize();
} else {
  const { MCPServer } = await import('./mcp/server.js');
  const server = new MCPServer();
  await server.start();
}
