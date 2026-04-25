# Impact Graph MCP Plugin - CLAUDE.md

## Project Overview

Impact Graph is a local MCP plugin that helps developers and AI agents understand the blast radius of code changes before editing. It analyzes TypeScript projects with the TypeScript Compiler API and returns structured impact, dependency, risk, entry point, and layer data.

The project goal is safe, dependency-aware code modification.

---

## Stack

- **Language:** TypeScript
- **Runtime:** Node.js 20+
- **Analysis Engine:** TypeScript Compiler API
- **Interface:** Model Context Protocol (MCP), stdio transport
- **CLI:** `impact-graph`
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
- `entry_points`
- `layers_affected`
- `is_critical`

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

---

### 4. Risk Scoring

The risk engine scores a target using:

- usage count
- direct dependent count
- indirect dependent count
- entry point involvement
- affected layers
- critical path signals

Risk scores are returned as structured data so the agent can explain change safety before editing.

---

### 5. Entry Point and Layer Detection

Entry point detection recognizes API, route, handler, CLI, and command-style paths.

Layer detection categorizes affected paths into:

- `api`
- `auth`
- `frontend`
- `database`
- `core`

---

### 6. CLI Install Command

Running:

```bash
impact-graph install
```

adds an `impact-graph` MCP server entry to `.mcp.json` in the current project if one does not already exist.

Running `impact-graph` without a subcommand starts the MCP server over stdio.

---

## Project Structure

```text
/src
  /analyzer
    ast.ts
    fs.ts
    graph.ts
    usage.ts
  /cli
    install.ts
  /engine
    layers.ts
    risk.ts
  /mcp
    server.ts
    /tools
      analyzeImpact.ts
  index.ts
/tests
  /analyzer
  /engine
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
4. Identify affected layers and external behavior.
5. Choose the smallest safe change.
6. Validate with tests and build.

For docs-only or release-only changes, still confirm the affected targets have no runtime dependents when practical.
