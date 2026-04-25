import test from 'node:test';
import assert from 'node:assert/strict';
import { DependencyGraph } from '../../src/analyzer/graph.js';
import { analyzeUsage, FileUsage } from '../../src/analyzer/usage.js';
import { buildImpactGraph } from '../../src/graph/buildGraph.js';

function buildUsage(files: Map<string, string>): Map<string, FileUsage> {
  const usages = new Map<string, FileUsage>();
  for (const [filePath, content] of files) {
    usages.set(filePath, analyzeUsage(content, filePath));
  }
  return usages;
}

function buildSymbolGraph(usages: Map<string, FileUsage>): DependencyGraph {
  const graph = new DependencyGraph();
  for (const [filePath, usage] of usages) {
    graph.addNode(filePath);
    for (const call of usage.localCalls) {
      for (const [definitionPath, definitionUsage] of usages) {
        if (definitionUsage.exportedSymbols.includes(call.name)) {
          graph.addEdge(filePath, definitionPath);
        }
      }
    }
  }
  return graph;
}

test('buildImpactGraph centers the target and includes direct, dependency, and indirect nodes', () => {
  const files = new Map<string, string>([
    ['src/auth/session.ts', 'export function loginUser() { validateToken(); writeAudit(); return true; }'],
    ['src/auth/token.ts', 'export function validateToken() { return true; }'],
    ['src/db/audit.ts', 'export function writeAudit() { return true; }'],
    ['src/app/api/login/route.ts', 'export function POST() { return loginUser(); }'],
    ['src/lib/wrapper.ts', 'export function wrappedLogin() { return POST(); }'],
  ]);
  const fileUsages = buildUsage(files);
  const symbolGraph = buildSymbolGraph(fileUsages);

  const graph = buildImpactGraph({
    target: 'loginUser',
    files,
    fileUsages,
    symbolGraph,
    definingFiles: ['src/auth/session.ts'],
    directDependents: ['src/app/api/login/route.ts'],
    indirectDependents: ['src/lib/wrapper.ts'],
    isEntryPoint: filePath => filePath.includes('/api/') || filePath.endsWith('/route.ts'),
  });

  assert.equal(graph.nodes[0].id, 'loginUser');
  assert.ok(graph.nodes.some(node => node.id === 'src/app/api/login/route.ts'));
  assert.ok(graph.nodes.some(node => node.id === 'src/auth/token.ts#validateToken'));
  assert.ok(graph.nodes.some(node => node.id === 'src/db/audit.ts#writeAudit'));
  assert.ok(graph.nodes.some(node => node.id === 'src/lib/wrapper.ts'));
  assert.ok(graph.edges.some(edge => edge.from === 'src/app/api/login/route.ts' && edge.to === 'loginUser'));
  assert.ok(graph.edges.some(edge => edge.from === 'loginUser' && edge.to === 'src/auth/token.ts#validateToken'));
  assert.ok(graph.edges.some(edge => edge.from === 'src/lib/wrapper.ts' && edge.to === 'src/app/api/login/route.ts'));
});

test('buildImpactGraph caps large graphs at 30 nodes', () => {
  const files = new Map<string, string>([['src/core/target.ts', 'export function targetFn() { return true; }']]);
  const directDependents = Array.from({ length: 40 }, (_, index) => `src/lib/caller${index}.ts`);
  for (const filePath of directDependents) {
    files.set(filePath, 'export function caller() { return targetFn(); }');
  }

  const fileUsages = buildUsage(files);
  const symbolGraph = buildSymbolGraph(fileUsages);
  const graph = buildImpactGraph({
    target: 'targetFn',
    files,
    fileUsages,
    symbolGraph,
    definingFiles: ['src/core/target.ts'],
    directDependents,
    indirectDependents: [],
    isEntryPoint: () => false,
  });

  assert.equal(graph.nodes.length, 30);
  assert.ok(graph.nodes.some(node => node.id === 'targetFn'));
});

test('buildImpactGraph assigns deterministic node risk levels', () => {
  const files = new Map<string, string>([
    ['src/app/api/high/route.ts', 'export function highRisk() { return true; }'],
    ['src/lib/low.ts', 'export function lowRisk() { return true; }'],
  ]);
  const callers = Array.from({ length: 6 }, (_, index) => `src/lib/highCaller${index}.ts`);
  for (const filePath of callers) {
    files.set(filePath, 'export function caller() { return highRisk(); }');
  }

  const fileUsages = buildUsage(files);
  const symbolGraph = buildSymbolGraph(fileUsages);
  const graph = buildImpactGraph({
    target: 'lowRisk',
    files,
    fileUsages,
    symbolGraph,
    definingFiles: ['src/lib/low.ts'],
    directDependents: ['src/app/api/high/route.ts'],
    indirectDependents: [],
    isEntryPoint: filePath => filePath.endsWith('/route.ts'),
  });

  const apiNode = graph.nodes.find(node => node.id === 'src/app/api/high/route.ts');
  const targetNode = graph.nodes.find(node => node.id === 'lowRisk');

  assert.equal(apiNode?.risk, 'high');
  assert.equal(targetNode?.risk, 'low');
});
