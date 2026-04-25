#!/usr/bin/env node

const command = process.argv[2];

if (command === 'install') {
  const { runInstall } = await import('./cli/install.js');
  await runInstall();
} else {
  const { MCPServer } = await import('./mcp/server.js');
  const server = new MCPServer();
  await server.start();
}
