# Impact Graph MCP

MCP plugin for AST-based impact analysis of TypeScript codebases.

Understand the blast radius of any code change before you make it.

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

This writes an `impact-graph` entry into `.mcp.json` in the current directory.

---

## Tools

### `analyze_impact`

Analyzes the impact of modifying a function, file, or module in a TypeScript project.

**Input:**

| Field | Type | Required | Description |
|---|---|---|---|
| `target` | `string` | Yes | Function name, file path, or module identifier |
| `root_dir` | `string` | No | Project root directory (defaults to CWD) |

**Output:**

| Field | Type | Description |
|---|---|---|
| `target` | `string` | The analyzed target |
| `direct_dependents` | `string[]` | Files/modules that directly call or import the target |
| `indirect_dependents` | `string[]` | Downstream callers (transitive) |
| `usage_count` | `number` | Number of direct usages |
| `risk_score` | `number` | Numerical risk score (0–100) |
| `risk_factors` | `string[]` | Scored risk signals contributing to the score |
| `risk_explanation` | `string[]` | Human-readable reasons behind the risk score |
| `next_actions` | `string[]` | Prioritized, actionable checklist for safe modification |
| `entry_points` | `string[]` | Entry points (API routes, CLI commands) that reach this target |
| `layers_affected` | `string[]` | System layers touched: `api`, `auth`, `frontend`, `database`, `core` |
| `is_critical` | `boolean` | Whether the target is on a critical path |
| `impact_summary` | `object` | Severity, blast radius, and primary concern |
| `recommended_strategy` | `string[]` | High-level rule-based modification strategies |
| `suggested_tests` | `string[]` | Test scenarios to add or run |
| `safe_changes` | `string[]` | Change types that are generally safe for this target |
| `risky_changes` | `string[]` | Change types that need extra care |
| `top_dependents` | `string[]` | The most important dependents to inspect first (up to 5) |
| `graph` | `ImpactGraph` | Full bounded dependency graph (up to 30 nodes) centered on the target |
| `focus_graph` | `ImpactGraph` | Filtered high-signal graph showing only the most important relationships (up to 20 nodes) |

#### `ImpactGraph` shape

```ts
interface ImpactGraph {
  nodes: {
    id: string;
    label: string;
    type: 'function' | 'file' | 'module';
    layer: string;
    risk: 'low' | 'moderate' | 'high';
  }[];
  edges: {
    from: string;
    to: string;
    type: 'calls' | 'imports';
  }[];
}
```

The `focus_graph` applies the same shape but retains only:
- The target node
- Direct dependents and direct dependencies
- High-priority nodes: entry points (+10), high-risk nodes (+8), critical-layer nodes (`api`/`auth`/`database`, +5), indirect dependents (+3)
- Edges are only included when both endpoints are in the graph

---

#### Example response

```json
{
  "target": "loginUser",
  "usage_count": 3,
  "risk_score": 72,
  "risk_explanation": [
    "Reachable from user-facing entry points",
    "Part of authentication flow",
    "Multiple modules directly depend on this"
  ],
  "next_actions": [
    "Add regression tests before modifying this code",
    "Make incremental changes instead of large refactors",
    "Test authentication flows thoroughly after changes",
    "Ensure session and token handling remain intact",
    "Test all user-facing flows that rely on this function"
  ],
  "impact_summary": {
    "severity": "high",
    "blast_radius": "medium",
    "primary_concern": "affects authentication flow"
  },
  "recommended_strategy": [
    "add tests before modifying",
    "validate authentication and session behavior"
  ],
  "suggested_tests": [
    "valid login",
    "invalid credentials",
    "expired session",
    "authorized access",
    "unauthorized access"
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
  ],
  "graph": {
    "nodes": [
      { "id": "loginUser", "label": "loginUser", "type": "function", "layer": "auth", "risk": "moderate" },
      { "id": "src/app/api/login/route.ts", "label": "route.ts", "type": "file", "layer": "api", "risk": "low" }
    ],
    "edges": [
      { "from": "src/app/api/login/route.ts", "to": "loginUser", "type": "calls" }
    ]
  },
  "focus_graph": {
    "nodes": [
      { "id": "loginUser", "label": "loginUser", "type": "function", "layer": "auth", "risk": "moderate" },
      { "id": "src/app/api/login/route.ts", "label": "route.ts", "type": "file", "layer": "api", "risk": "low" }
    ],
    "edges": [
      { "from": "src/app/api/login/route.ts", "to": "loginUser", "type": "calls" }
    ]
  }
}
```

---

## Visualization

Open a local browser visualization for a specific target:

```bash
impact-graph visualize loginUser
```

Open an interactive full-project visualization (searchable sidebar, click any node to graph it):

```bash
impact-graph visualize
```

Both commands run `analyze_impact`, write a temporary standalone HTML file, and open it in the default browser. If the browser cannot be opened, the file path and a compact terminal summary are printed instead.

### Browser visualization layout

The single-target visualization is a dark-theme two-panel page:

**Left panel — dependency graph**
- SVG node graph with radial layout; target node at center with glow ring
- **Full Graph / Focus Graph toggle** — switch between the full bounded graph and the filtered high-signal graph
- Arrowhead edges; dashed lines for `imports`, solid for `calls`
- Node hover tooltip showing path, layer, type, and risk
- Color legend: red = high risk, orange = moderate, green = low

**Right panel — full analysis data (340 px, scrollable)**

| Section | Content |
|---|---|
| Stats grid | Risk score + color bar, severity, blast radius, primary concern |
| Next Actions | Imperative checklist (up to 7 items) |
| Risk Explanation | Plain-language reasons behind the score |
| Layers Affected | Color-coded layer tags (`api`, `auth`, `database`, `frontend`, `core`) |
| Recommended Strategy | High-level modification strategies |
| Suggested Tests | Test scenario tags |
| Safe & Risky Changes | Side-by-side columns |
| Top Dependents | Most important files to inspect first |
| Entry Points | API routes and CLI commands that reach the target |
| All Dependents (collapsed) | Full direct + indirect dependent lists |
| Risk Factors (collapsed) | Raw scored risk signal breakdown |

All sections are collapsible. The page has no external dependencies — CSS, JS, and SVG are fully inlined.

### Full-project visualization layout

The no-target visualization (`impact-graph visualize`) adds a **sidebar** on the left. Clicking any symbol swaps both the graph and the analysis panel to show that symbol's impact data. The full analysis panel and Full/Focus toggle are identical to the single-target page.

| Region | Content |
|---|---|
| Sidebar (280px) | Searchable list of all exported symbols, sorted by risk; risk-dot, layer badge |
| Graph wrap (flex) | SVG dependency graph with Full/Focus toggle, arrowhead edges, hover tooltips |
| Analysis panel (340px) | Same collapsible sections as single-target — stats, Next Actions, Risk Explanation, Layers, Strategy, Tests, Safe/Risky Changes, Top Dependents, Entry Points, All Dependents, Risk Factors |

For React or Next.js apps, the package also exposes a minimal SVG force graph component:

```tsx
import { GraphView } from 'impact-graph-mcp/web/GraphView';
import type { ImpactGraph } from 'impact-graph-mcp/graph';

export function GraphPage({ graph }: { graph: ImpactGraph }) {
  return <GraphView graph={graph} target="loginUser" />;
}
```

The viewer uses `d3-force`, colors high-risk nodes red, moderate-risk nodes yellow, and low-risk nodes green.

---

## CLI Commands

| Command | Description |
|---|---|
| `impact-graph` | Start MCP server over stdio |
| `impact-graph install` | Add impact-graph MCP entry to `.mcp.json` in the current project |
| `impact-graph visualize <target>` | Open browser visualization for a specific function/file |
| `impact-graph visualize` | Open interactive full-project visualization with searchable sidebar |

---

## Layers Detected

| Layer | Matched paths |
|---|---|
| `api` | `app/api/`, `/route.ts`, `/handler.ts`, `/api/` |
| `auth` | `/auth/`, `auth.ts`, `/middleware.ts`, `/session/` |
| `frontend` | `/page.tsx`, `/components/`, `.tsx`, `/ui/` |
| `database` | `/db/`, `/schema`, `/queries`, `/migrations/`, `.sql` |
| `core` | `/lib/`, `/utils`, `/types`, `/config/`, `/constants` |

---

## `next_actions` Rules

The `next_actions` field produces a concise, deduped checklist (max 7 items) using these deterministic rules:

| Condition | Actions added |
|---|---|
| `risk_score > 70` | "Add regression tests before modifying this code"; "Make incremental changes instead of large refactors" |
| `layers_affected` includes `api` | "Avoid breaking API contracts (request/response shape)"; "Verify all endpoints using this function" |
| `layers_affected` includes `auth` | "Test authentication flows thoroughly after changes"; "Ensure session and token handling remain intact" |
| `layers_affected` includes `database` | "Validate data consistency after modification"; "Check for unintended data mutations" |
| `usage_count > 20` | "Refactor incrementally to avoid widespread breakage"; "Search for all usages before modifying" |
| Combined dependents > 5 | "Consider creating a wrapper instead of modifying directly"; "Update dependents carefully if changing function signature" |
| Entry points present | "Test all user-facing flows that rely on this function" |

If no rules match, falls back to: `"Proceed with the smallest behavior-preserving change"`.

---

## `focus_graph` Filtering

The `focus_graph` reduces the full graph to ≤ 20 nodes using an importance score:

| Signal | Score |
|---|---|
| Entry point | +10 |
| High risk | +8 |
| Direct dependent or direct dependency | +6 |
| Critical layer (`api`, `auth`, `database`) | +5 |
| Indirect dependent | +3 |

Priority order when capping:
1. Target (always kept)
2. Direct dependents + direct dependencies (always attempted, trimmed by score if over cap)
3. High-priority nodes (entry points, high risk, critical layers)
4. Remaining nodes with any positive importance score, closest first

Only edges where both endpoints are included in the focused set are kept.

---

## Development

```bash
npm run dev       # Watch mode
npm run build     # Production build
npm test          # Run tests
npm run lint      # ESLint
npm pack --dry-run  # Inspect package contents before publish
```

---

## Publishing

Publishing is handled via GitHub Actions on each GitHub Release:

1. Update code; run lint, tests, build, and pack dry-run.
2. `npm version <patch|minor|major>` — bumps `package.json` and creates the git tag.
3. `git push origin main && git push origin <tag>`.
4. Create a GitHub Release for that tag — Actions publishes to npm automatically.

---

## License

MIT
