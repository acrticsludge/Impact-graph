# Impact Graph MCP Plugin — CLAUDE.md

## Project Overview

Impact Graph is an MCP plugin that analyzes how changes to a function, file, or module affect the rest of a codebase. It helps prevent unsafe edits by exposing dependencies, usage patterns, and risk signals before modifications are made.

It is designed for developers and AI agents to make **safe, informed code changes**.

---

## Stack

- **Language:** TypeScript
- **Runtime:** Node.js
- **Analysis Engine:** TypeScript Compiler API (AST-based)
- **Interface:** MCP (Model Context Protocol)
- **Execution:** Local (user machine or project environment)

---

## Core Features

### 1. Impact Analysis (`analyze_impact`)

Analyzes the consequences of modifying a given target.

#### Input

- `target`: function name, file path, or module

#### Output

- `direct_dependents`
- `indirect_dependents`
- `usage_count`
- `risk_score`
- `risk_factors`
- `entry_points`
- `layers_affected`
- `is_critical`

---

### 2. Dependency Mapping

Builds a graph of:

- function calls
- module imports
- usage relationships

Used internally to compute impact.

---

### 3. Risk Scoring Engine

Assigns a risk score based on:

- usage frequency
- dependency depth
- involvement in critical paths
- presence in entry points (API, CLI, etc.)

---

### 4. Entry Point Detection

Identifies whether code is used in:

- API routes
- server handlers
- CLI scripts

These significantly increase risk.

---

### 5. Layer Detection

Categorizes affected areas:

- `api`
- `auth`
- `frontend`
- `database`
- `core`

---

### 6. Structured Output for AI

All outputs are returned as structured JSON.

The tool does NOT interpret results—it provides signals for reasoning.

---

## Project Structure

```
/src
  /analyzer
    ast.ts
    graph.ts
    usage.ts
  /engine
    risk.ts
    layers.ts
  /mcp
    server.ts
    tools/
      analyzeImpact.ts
  index.ts
```

---

## Key Rules for Claude

- ALWAYS call `analyze_impact` before making non-trivial code changes
- NEVER assume dependency relationships without using the tool
- Use returned data to guide decisions, not guesses
- Prefer structured data over intuition
- Highlight risk before suggesting modifications
- If risk is high, proceed cautiously and explain why

---

## MCP Tools: impact-graph

**IMPORTANT: This plugin provides structural understanding of the codebase. ALWAYS use it BEFORE making code modifications or reasoning about dependencies.**

---

### When to use impact-graph FIRST

- Before editing any function, file, or module
- When asked:
  - “What will break if…”
  - “Where is this used?”
  - “Is this safe to change?”

- During refactoring tasks
- During debugging where dependencies are unclear
- When working across multiple files

---

### When NOT to use

- Simple syntax or isolated code questions
- Clearly local changes with no external usage
- Pure explanations with no modification intent

---

### Tool: `analyze_impact`

#### Purpose

Determine the impact of modifying a target.

#### Returns

- `direct_dependents`: immediate callers/usages
- `indirect_dependents`: downstream effects
- `usage_count`: frequency of usage
- `risk_score`: numerical impact score
- `risk_factors`: reasons contributing to risk
- `entry_points`: whether used in API/CLI
- `layers_affected`: system layers involved
- `is_critical`: whether part of core systems

---

### How to Interpret Results

- High `usage_count` → widespread impact
- Many dependents → tightly coupled code
- Entry point involvement → externally visible changes
- Multiple layers → cross-system impact
- `is_critical = true` → high-risk modification

---

### Required Workflow

When modifying code:

1. Call `analyze_impact`
2. Review risk and affected components
3. Explain consequences
4. Suggest validation steps
5. Proceed with careful changes

---

### Safety Guidelines

- Do NOT modify code blindly
- Always analyze impact for non-trivial changes
- Clearly communicate risk to the user
- Suggest tests or checks after changes
- Prefer minimal, targeted edits in high-risk areas

---

## /me Context Integration

This project may include a `/me` directory containing:

- coding rules
- stack conventions
- audit requirements
- architectural preferences

### Instructions

- ALWAYS respect rules defined in `/me`
- Treat `/me` as higher priority than general assumptions
- Apply `/me` practices when suggesting changes
- If `/me` conflicts with default behavior, follow `/me`

---

## Goal

Enable safe, dependency-aware code changes by providing accurate impact analysis before modifications.
