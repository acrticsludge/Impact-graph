import test from 'node:test';
import assert from 'node:assert/strict';
import { runVisualize, renderGraphHtml, renderGraphSummary } from '../../src/cli/visualize.js';
import { ImpactAnalysisResult } from '../../src/mcp/tools/analyzeImpact.js';

// Prevent tests from spawning a background server or opening a browser
process.env['IMPACT_GRAPH_NO_SERVER'] = '1';

const sampleGraph = {
  nodes: [
    { id: 'loginUser', label: 'loginUser', type: 'function' as const, layer: 'auth', risk: 'moderate' as const },
    { id: 'src/app/api/login/route.ts', label: 'route.ts', type: 'file' as const, layer: 'api', risk: 'low' as const },
  ],
  edges: [{ from: 'src/app/api/login/route.ts', to: 'loginUser', type: 'calls' as const }],
};

const result: ImpactAnalysisResult = {
  target: 'loginUser',
  direct_dependents: ['src/app/api/login/route.ts'],
  indirect_dependents: [],
  usage_count: 1,
  risk_score: 30,
  risk_factors: ['Direct dependents: 1 (+4 pts)'],
  risk_explanation: ['Multiple modules directly depend on this'],
  next_actions: ['Test all user-facing flows that rely on this function'],
  entry_points: ['src/app/api/login/route.ts'],
  layers_affected: ['auth', 'api'],
  is_critical: false,
  impact_summary: {
    severity: 'moderate',
    blast_radius: 'narrow',
    primary_concern: 'affects authentication flow',
  },
  recommended_strategy: ['avoid breaking API contracts'],
  suggested_tests: ['valid login'],
  safe_changes: ['internal logic refactors'],
  risky_changes: ['changing return types'],
  top_dependents: ['src/app/api/login/route.ts'],
  graph: sampleGraph,
  focus_graph: sampleGraph,
};

test('renderGraphSummary prints a compact terminal graph', () => {
  const summary = renderGraphSummary(result);

  assert.match(summary, /Impact graph for loginUser/);
  assert.match(summary, /src\/app\/api\/login\/route\.ts -\[calls\]-> loginUser/);
});

test('renderGraphHtml embeds graph data and escapes title text', () => {
  const html = renderGraphHtml({ ...result, target: '<loginUser>' });

  assert.match(html, /Impact Graph \S+ &lt;loginUser&gt;/);
  assert.match(html, /const fullGraph = /);
  assert.doesNotMatch(html, /<loginUser>/);
});

test('runVisualize with no args does not throw and does not set error exitCode', async () => {
  const originalExitCode = process.exitCode;
  process.exitCode = 0;
  await runVisualize([]);
  assert.equal(process.exitCode, 0, 'should not error when scanning project symbols');
  process.exitCode = originalExitCode;
});
