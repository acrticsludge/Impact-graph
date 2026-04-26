import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProjectHtml, analyzeAllSymbolsFromFiles } from '../../src/cli/visualizeAll.js';
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

test('analyzeAllSymbolsFromFiles returns SymbolData for each symbol', async () => {
  const result = await analyzeAllSymbolsFromFiles(symbols, files);

  assert.equal(result.length, 2);
  assert.ok(result.every(s => typeof s.name === 'string'));
  assert.ok(result.every(s => typeof s.risk_score === 'number'));
  assert.ok(result.every(s => typeof s.layer === 'string'));
  assert.ok(result.every(s => typeof s.usage_count === 'number'));
  assert.ok(result.every(s => Array.isArray(s.graph.nodes)));
  assert.ok(result.every(s => Array.isArray(s.graph.edges)));
});

test('renderProjectHtml produces a self-contained HTML page', () => {
  const symbolData = symbols.map(s => ({
    name: s.name,
    risk_score: s.risk_score,
    layer: s.layer,
    usage_count: s.usage_count,
    graph: { nodes: [], edges: [] },
  }));

  const html = renderProjectHtml(symbolData);

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /const ALL_SYMBOLS = /);
  assert.match(html, /id="symbol-list"/);
  assert.match(html, /id="search"/);
  assert.match(html, /id="graph"/);
  assert.match(html, /Project Overview/);
  assert.doesNotMatch(html, /<script src=/);
});

test('renderProjectHtml embeds all symbol names in JSON', () => {
  const symbolData = symbols.map(s => ({
    name: s.name,
    risk_score: s.risk_score,
    layer: s.layer,
    usage_count: s.usage_count,
    graph: { nodes: [], edges: [] },
  }));

  const html = renderProjectHtml(symbolData);

  assert.match(html, /loginUser/);
  assert.match(html, /POST/);
});

test('renderProjectHtml escapes XSS in symbol names', () => {
  const xssData = [{
    name: '<script>alert(1)</script>',
    risk_score: 0,
    layer: 'core',
    usage_count: 0,
    graph: { nodes: [], edges: [] },
  }];

  const html = renderProjectHtml(xssData);

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});
