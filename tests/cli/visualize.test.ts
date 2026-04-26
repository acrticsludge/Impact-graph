import test from 'node:test';
import assert from 'node:assert/strict';
import { runVisualize, renderGraphHtml, renderGraphSummary } from '../../src/cli/visualize.js';
import { ImpactAnalysisResult } from '../../src/mcp/tools/analyzeImpact.js';

const result: ImpactAnalysisResult = {
  target: 'loginUser',
  direct_dependents: ['src/app/api/login/route.ts'],
  indirect_dependents: [],
  usage_count: 1,
  risk_score: 30,
  risk_factors: ['Direct dependents: 1 (+4 pts)'],
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
  graph: {
    nodes: [
      { id: 'loginUser', label: 'loginUser', type: 'function', layer: 'auth', risk: 'moderate' },
      { id: 'src/app/api/login/route.ts', label: 'route.ts', type: 'file', layer: 'api', risk: 'low' },
    ],
    edges: [{ from: 'src/app/api/login/route.ts', to: 'loginUser', type: 'calls' }],
  },
};

test('renderGraphSummary prints a compact terminal graph', () => {
  const summary = renderGraphSummary(result);

  assert.match(summary, /Impact graph for loginUser/);
  assert.match(summary, /src\/app\/api\/login\/route\.ts -\[calls\]-> loginUser/);
});

test('renderGraphHtml embeds graph data and escapes title text', () => {
  const html = renderGraphHtml({ ...result, target: '<loginUser>' });

  assert.match(html, /Impact Graph - &lt;loginUser&gt;/);
  assert.match(html, /const graph = /);
  assert.doesNotMatch(html, /<loginUser>/);
});

test('runVisualize with no args does not throw and does not set error exitCode', async () => {
  const originalExitCode = process.exitCode;
  process.exitCode = 0;
  await runVisualize([]);
  assert.equal(process.exitCode, 0, 'should not error when scanning project symbols');
  process.exitCode = originalExitCode;
});
