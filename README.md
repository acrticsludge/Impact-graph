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

Or run the installer from a project root:

```bash
impact-graph install
```

## Tools

### `analyze_impact`

Analyzes the impact of modifying a function, file, or module.

**Input:**
- `target`: string - function name, file path, or module identifier
- `root_dir`: string - optional project root directory, defaults to the current working directory

**Output:**
- `direct_dependents`: Array of immediate callers/usages
- `indirect_dependents`: Array of downstream dependencies
- `usage_count`: Number of times the target is used
- `risk_score`: Numerical risk score (0-100)
- `risk_factors`: Array of contributing risk factors
- `entry_points`: Array of entry points that use this target (API, CLI)
- `layers_affected`: Array of system layers (api, auth, frontend, database, core)
- `is_critical`: Boolean indicating if target is in a critical path
- `impact_summary`: Severity, blast radius, and primary concern
- `recommended_strategy`: Rule-based next steps for safer modification
- `suggested_tests`: Context-aware test scenarios to run or add
- `safe_changes`: Changes that are usually safe for this target
- `risky_changes`: Changes that need extra care for this target
- `top_dependents`: The most important dependents to inspect first

Example decision-oriented fields:

```json
{
  "impact_summary": {
    "severity": "moderate",
    "blast_radius": "medium",
    "primary_concern": "affects authentication flow"
  },
  "recommended_strategy": [
    "avoid breaking API contracts",
    "validate authentication and session behavior"
  ],
  "suggested_tests": [
    "valid login",
    "invalid credentials",
    "response status"
  ],
  "safe_changes": [
    "internal logic refactors",
    "logging additions",
    "performance improvements without signature changes"
  ],
  "risky_changes": [
    "changing return types",
    "modifying function signatures",
    "altering authentication or authorization logic"
  ],
  "top_dependents": [
    "src/app/api/login/route.ts"
  ]
}
```

## Development

```bash
npm run dev      # Watch mode
npm run build    # Production build
npm test         # Run tests
```

## License

MIT
