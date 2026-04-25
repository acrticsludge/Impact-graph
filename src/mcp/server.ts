import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { analyzeImpact } from './tools/analyzeImpact.js';
import { z } from 'zod';

export class MCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: 'impact-graph', version: '0.1.0' },
      { capabilities: { tools: {} } }
    );
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'analyze_impact',
          description: 'Analyze the impact of modifying a function, file, or module',
          inputSchema: {
            type: 'object',
            properties: {
              target: { type: 'string', description: 'The function name, file path, or module to analyze' },
              files: { type: 'object', description: 'Map of file paths to file contents', additionalProperties: { type: 'string' } },
            },
            required: ['target'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'analyze_impact') {
        const parsed = z.object({ target: z.string(), files: z.record(z.string()).optional() }).parse(args);
        const files = parsed.files ? new Map(Object.entries(parsed.files)) : new Map<string, string>();
        const result = await analyzeImpact(parsed.target, files);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Impact Graph MCP server running on stdio');
  }
}
