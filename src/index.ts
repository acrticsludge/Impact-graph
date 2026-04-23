#!/usr/bin/env node

import { MCPServer } from './mcp/server.js';

const server = new MCPServer();
await server.start();
