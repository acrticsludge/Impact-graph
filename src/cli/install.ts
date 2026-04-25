import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const MCP_CONFIG_PATH = path.join(process.cwd(), '.mcp.json');

const ENTRY = {
  command: 'impact-graph',
  type: 'stdio',
};

export async function runInstall(): Promise<void> {
  let config: Record<string, unknown> = { mcpServers: {} };

  try {
    const existing = await fs.readFile(MCP_CONFIG_PATH, 'utf-8');
    config = JSON.parse(existing);
  } catch {
    // file doesn't exist yet — start fresh
  }

  if (!config.mcpServers || typeof config.mcpServers !== 'object') {
    config.mcpServers = {};
  }

  const servers = config.mcpServers as Record<string, unknown>;

  if (servers['impact-graph']) {
    console.log('impact-graph already configured in .mcp.json');
    return;
  }

  servers['impact-graph'] = ENTRY;

  await fs.writeFile(MCP_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  console.log('✓ Added impact-graph to .mcp.json');
  console.log('  Restart Claude Code to activate.');
}
