# Impact Graph MCP Plugin - CLAUDE.md

## Project Overview

Impact Graph is a local MCP plugin that helps developers and AI agents understand the blast radius of code changes before editing. It analyzes TypeScript projects with the TypeScript Compiler API and returns structured impact, dependency, risk, entry point, layer, decision guidance, and graph visualization data.

The project goal is safe, dependency-aware code modification with actionable, deterministic guidance.

---

## Stack

- **Language:** TypeScript
- **Runtime:** Node.js 20+
- **Analysis Engine:** TypeScript Compiler API
- **Interface:** Model Context Protocol (MCP), stdio transport
- **CLI:** `impact-graph`
- **Visualization:** CLI-generated HTML and reusable React/D3 SVG viewer
- **Package:** `impact-graph-mcp`
- **Publishing:** GitHub Release triggers GitHub Actions npm publish workflow

---

## Core Features

### 1. Impact Analysis (`analyze_impact`)

Analyzes the consequences of modifying a function, file, or module.

#### Input

- `target`: function name, file path, or module identifier
- `root_dir`: optional project root directory; defaults to the current working directory

#### Output

- `target`
- `direct_dependents`
- `indirect_dependents`
- `usage_count`
- `risk_score`
- `risk_factors`
- `risk_explanation` — human-readable reasons behind the risk score
- `next_actions` — prioritized, deduped checklist of safe modification steps (max 7)
- `entry_points`
- `layers_affected`
- `is_critical`
- `impact_summary`
- `recommended_strategy`
- `suggested_tests`
- `safe_changes`
- `risky_changes`
- `top_dependents`
- `graph` — full bounded dependency graph (up to 30 nodes)
- `focus_graph` — filtered high-signal graph (up to 20 nodes, highest-importance nodes only)

---

### 2. Project Auto-Scanning

The MCP tool scans TypeScript files from the selected project root and skips generated or dependency folders such as:

- `node_modules`
- `dist`
- `.git`

---

### 3. Dependency Mapping

The analyzer builds a graph from:

- exported symbols
- local function calls
- module imports
- file-level usage relationships

This graph powers direct and indirect dependent detection.

The MCP response includes two graph objects:

**`graph`** — bounded full graph (up to 30 nodes):
- `nodes`: target, direct dependents, dependencies, and one-level indirect nodes
- `edges`: `calls` and `imports` relationships
- node metadata: label, type, layer, and low/moderate/high risk

**`focus_graph`** — filtered high-signal graph (up to 20 nodes):
- Always includes target, direct dependents, and direct dependencies
- Adds high-priority nodes: entry points (+10), high-risk (+8), critical-layer (`api`/`auth`/`database`, +5), indirect dependents (+3)
- Drops edges where either endpoint is excluded
- Designed for quick visual understanding of the most important relationships

---

### 4. Visualization

Running:

```bash
impact-graph visualize <target>
```

runs impact analysis for the current project, writes a temporary standalone HTML graph, and opens it in the default browser.

Running without a target:

```bash
impact-graph visualize
```

opens an interactive full-project visualization with a searchable sidebar. Click any symbol to graph its dependencies.

The package also exposes:

```ts
import { GraphView } from 'impact-graph-mcp/web/GraphView';
```

`GraphView` is a minimal React component backed by `d3-force`. React is a peer dependency for web consumers.

---

### 5. Risk Scoring

The risk engine scores a target using:

- usage count
- direct dependent count
- indirect dependent count
- entry point involvement
- affected layers
- critical path signals

Risk scores are returned as structured data so the agent can explain change safety before editing. The `risk_explanation` field translates these signals into plain-language sentences.

---

### 6. Decision Guidance

The decision engine adds deterministic guidance without using LLMs or external APIs.

It computes:

- severity and blast radius
- primary concern from risk factors and affected layers
- recommended strategy
- suggested tests
- safe and risky change categories
- top dependents to inspect first

This guidance is rule-based TypeScript logic in `src/engine/decision.ts`.

---

### 7. Next Actions

The `next_actions` field (module: `src/engine/nextActions.ts`) generates a concrete, imperative checklist distinct from the higher-level `recommended_strategy`. Rules:

| Condition | Actions |
|---|---|
| `risk_score > 70` | Add regression tests; make incremental changes |
| `layers_affected` includes `api` | Avoid breaking API contracts; verify all endpoints |
| `layers_affected` includes `auth` | Test auth flows; ensure session/token handling |
| `layers_affected` includes `database` | Validate data consistency; check for unintended mutations |
| `usage_count > 20` | Refactor incrementally; search for all usages |
| Combined dependents > 5 | Consider a wrapper; update dependents carefully |
| Entry points present | Test all user-facing flows |

Output is deduped and capped at 7 items. Falls back to `"Proceed with the smallest behavior-preserving change"` when no rules match.

---

### 8. Entry Point and Layer Detection

Entry point detection recognizes API, route, handler, CLI, and command-style paths.

Layer detection categorizes affected paths into:

- `api`
- `auth`
- `frontend`
- `database`
- `core`

---

### 9. CLI Commands

Running:

```bash
impact-graph install
```

adds an `impact-graph` MCP server entry to `.mcp.json` in the current project if one does not already exist.

Running `impact-graph` without a subcommand starts the MCP server over stdio.

Running:

```bash
impact-graph visualize loginUser
```

opens a browser visualization for the selected target.

Running:

```bash
impact-graph visualize
```

opens the interactive full-project visualization.

---

## Project Structure

```text
/src
  /analyzer
    ast.ts
    fs.ts
    graph.ts
    scanner.ts
    usage.ts
  /cli
    browser.ts
    install.ts
    visualize.ts
    visualizeAll.ts
  /engine
    decision.ts
    layers.ts
    nextActions.ts
    risk.ts
    riskExplanation.ts
  /graph
    buildGraph.ts
    focusGraph.ts
    graphTypes.ts
  /mcp
    server.ts
    /tools
      analyzeImpact.ts
  /web
    GraphView.tsx
  index.ts
/tests
  /analyzer
  /engine
  /graph
  /mcp
```

---

## Development Commands

Use `npm.cmd` on Windows PowerShell if script execution policy blocks `npm`.

```bash
npm run lint
npm test
npm run build
npm pack --dry-run
```

Before release, run all four commands and confirm the package contents only include intended npm files.

---

## Publishing

Publishing is handled by GitHub Actions in `.github/workflows/publish.yml`.

Release flow:

1. Update docs/code as needed.
2. Run lint, tests, build, and pack dry-run.
3. Bump the package version with `npm version`.
4. Push `main` and the release tag.
5. Publish a GitHub Release for that tag.
6. GitHub Actions publishes to npm using Trusted Publishing.

The workflow runs:

- `npm ci`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm publish`

---

## Key Rules for Claude

- ALWAYS call `analyze_impact` before making non-trivial code changes.
- NEVER assume dependency relationships without using impact data.
- Assess risk using `risk_score`, `usage_count`, `entry_points`, and `layers_affected`.
- Use `next_actions` to guide the agent's modification plan step by step.
- Use `focus_graph` for a quick visual understanding; use `graph` for full dependency context.
- Explain direct breakage from `direct_dependents`.
- Explain possible indirect breakage from `indirect_dependents`.
- Highlight authentication, API, database, core logic, or external behavior involvement.
- Prefer minimal, targeted edits when risk is high.
- If risk is critical, warn explicitly before proceeding.
- Run the relevant validation commands after changes.

---

## Project-Local `/me` Practices

This repo contains a personal knowledge base in `/me`. It is intentionally ignored by git and should not be committed.

Relevant practices for this project:

- Keep `/me`, `graphify-out`, coverage, dependency folders, build output, logs, and env files uncommitted.
- Use present-tense imperative commit messages under 72 characters.
- Run lint, type/build, and tests before commits.
- Use TypeScript throughout.
- Avoid unnecessary dependencies and speculative abstractions.
- Add comments only where logic is not self-evident.

---

## Safety Workflow

When modifying code:

1. Run `analyze_impact` for the relevant function, file, or module.
2. Classify risk as safe, moderate, high, or critical.
3. Explain what breaks immediately and what may break indirectly.
4. Review `next_actions` for a concrete checklist before editing.
5. Identify affected layers and external behavior.
6. Choose the smallest safe change.
7. Validate with tests and build.

For docs-only or release-only changes, still confirm the affected targets have no runtime dependents when practical.
