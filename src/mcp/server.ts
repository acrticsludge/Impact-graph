import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { analyzeImpactForPath } from './tools/analyzeImpact.js';
import { z } from 'zod';

export class MCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: 'impact-graph', version: '0.1.2' },
      { capabilities: { tools: {} } }
    );
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'analyze_impact',
          description: 'Analyze the impact of modifying a function, file, or module in the current project',
          inputSchema: {
            type: 'object',
            properties: {
              target: { type: 'string', description: 'Function name, file path, or module to analyze' },
              root_dir: { type: 'string', description: 'Project root directory (defaults to cwd)' },
            },
            required: ['target'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'analyze_impact') {
        const parsed = z.object({ target: z.string(), root_dir: z.string().optional() }).parse(args);
        const rootDir = parsed.root_dir ?? process.cwd();
        const result = await analyzeImpactForPath(parsed.target, rootDir);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`Impact Graph MCP server running (root: ${process.cwd()})`);
  }
}
