import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProjectHtml, analyzeAllSymbolsFromFiles, SymbolData } from '../../src/cli/visualizeAll.js';
import { ImpactAnalysisResult } from '../../src/mcp/tools/analyzeImpact.js';
import { ProjectSymbol } from '../../src/analyzer/scanner.js';

const files = new Map<string, string>([
  [
    'src/auth/session.ts',
    `export function loginUser() { return true; }`,
  ],
  [
    'src/app/api/route.ts',
    `export function POST() { return loginUser(); }`,
  ],
]);

const symbols: ProjectSymbol[] = [
  { name: 'loginUser', definingFile: 'src/auth/session.ts', risk_score: 20, layer: 'auth', usage_count: 1 },
  { name: 'POST', definingFile: 'src/app/api/route.ts', risk_score: 5, layer: 'api', usage_count: 0 },
];

const sampleGraph = { nodes: [], edges: [] };

const sampleResult: ImpactAnalysisResult = {
  target: 'loginUser',
  direct_dependents: [],
  indirect_dependents: [],
  usage_count: 0,
  risk_score: 20,
  risk_factors: [],
  risk_explanation: [],
  next_actions: [],
  entry_points: [],
  layers_affected: ['auth'],
  is_critical: false,
  impact_summary: { severity: 'low', blast_radius: 'narrow', primary_concern: 'low impact' },
  recommended_strategy: [],
  suggested_tests: [],
  safe_changes: [],
  risky_changes: [],
  top_dependents: [],
  graph: sampleGraph,
  focus_graph: sampleGraph,
};

const sampleSymbolData: SymbolData[] = [
  { name: 'loginUser', risk_score: 20, layer: 'auth', usage_count: 1, result: sampleResult },
  { name: 'POST', risk_score: 5, layer: 'api', usage_count: 0, result: { ...sampleResult, target: 'POST' } },
];

test('analyzeAllSymbolsFromFiles returns SymbolData with full result for each symbol', async () => {
  const result = await analyzeAllSymbolsFromFiles(symbols, files);

  assert.equal(result.length, 2);
  assert.ok(result.every(s => typeof s.name === 'string'));
  assert.ok(result.every(s => typeof s.risk_score === 'number'));
  assert.ok(result.every(s => typeof s.layer === 'string'));
  assert.ok(result.every(s => typeof s.usage_count === 'number'));
  assert.ok(result.every(s => Array.isArray(s.result.graph.nodes)));
  assert.ok(result.every(s => Array.isArray(s.result.graph.edges)));
  assert.ok(result.every(s => Array.isArray(s.result.next_actions)));
  assert.ok(result.every(s => s.result.focus_graph !== undefined));
});

test('renderProjectHtml produces a self-contained HTML page', () => {
  const html = renderProjectHtml(sampleSymbolData);

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /ALL_SYMBOLS/);
  assert.match(html, /id="symbol-list"/);
  assert.match(html, /id="search"/);
  assert.match(html, /Project Overview/);
  assert.doesNotMatch(html, /<script src=/);
});

test('renderProjectHtml embeds full ImpactAnalysisResult per symbol', () => {
  const html = renderProjectHtml(sampleSymbolData);

  assert.match(html, /"next_actions"/);
  assert.match(html, /"focus_graph"/);
  assert.match(html, /"risk_explanation"/);
  assert.match(html, /"impact_summary"/);
});

test('renderProjectHtml includes panel renderer and Full\/Focus toggle', () => {
  const html = renderProjectHtml(sampleSymbolData);

  assert.match(html, /function renderPanel/);
  assert.match(html, /function renderGraph/);
  assert.match(html, /function renderHeader/);
  assert.match(html, /Full Graph/);
  assert.match(html, /Focus Graph/);
  assert.match(html, /switchGraph/);
});

test('renderProjectHtml embeds all symbol names in JSON', () => {
  const html = renderProjectHtml(sampleSymbolData);

  assert.match(html, /loginUser/);
  assert.match(html, /POST/);
});

test('renderProjectHtml escapes XSS in symbol names', () => {
  const xssResult: ImpactAnalysisResult = { ...sampleResult, target: '<script>alert(1)</script>' };
  const xssData: SymbolData[] = [{
    name: '<script>alert(1)</script>',
    risk_score: 0,
    layer: 'core',
    usage_count: 0,
    result: xssResult,
  }];

  const html = renderProjectHtml(xssData);

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});
