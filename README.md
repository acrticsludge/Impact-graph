# Impact Graph MCP

MCP plugin for AST-based impact analysis of TypeScript codebases.

## Installation

```bash
npm install -g impact-graph-mcp
```

## Usage

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "impact-graph": {
      "command": "impact-graph",
      "args": [],
      "type": "stdio"
    }
  }
}
```

## Tools

### `analyze_impact`

Analyzes the impact of modifying a function, file, or module.

**Input:**
- `target`: string — function name, file path, or module identifier

**Output:**
- `direct_dependents`: Array of immediate callers/usages
- `indirect_dependents`: Array of downstream dependencies
- `usage_count`: Number of times the target is used
- `risk_score`: Numerical risk score (0-100)
- `risk_factors`: Array of contributing risk factors
- `entry_points`: Array of entry points that use this target (API, CLI)
- `layers_affected`: Array of system layers (api, auth, frontend, database, core)
- `is_critical`: Boolean indicating if target is in a critical path

## Development

```bash
npm run dev      # Watch mode
npm run build    # Production build
npm test         # Run tests
```

## License

MIT
