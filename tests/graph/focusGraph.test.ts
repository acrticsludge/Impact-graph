import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFocusGraph } from '../../src/graph/focusGraph.js';
import { ImpactGraph, ImpactGraphNode, ImpactGraphEdge } from '../../src/graph/graphTypes.js';

function node(
  id: string,
  overrides: Partial<ImpactGraphNode> = {}
): ImpactGraphNode {
  return {
    id,
    label: id.split(/[\\/]/).pop() ?? id,
    type: 'file',
    layer: 'core',
    risk: 'low',
    ...overrides,
  };
}

function edge(from: string, to: string, type: ImpactGraphEdge['type'] = 'calls'): ImpactGraphEdge {
  return { from, to, type };
}

test('focus graph always includes target, direct dependents, and direct dependencies', () => {
  const fullGraph: ImpactGraph = {
    nodes: [
      node('target', { type: 'function' }),
      node('src/a.ts'),
      node('src/b.ts'),
      node('src/dep.ts'),
    ],
    edges: [
      edge('src/a.ts', 'target'),
      edge('src/b.ts', 'target'),
      edge('target', 'src/dep.ts'),
    ],
  };

  const focus = buildFocusGraph(fullGraph, {
    target: 'target',
    direct_dependents: ['src/a.ts', 'src/b.ts'],
    indirect_dependents: [],
    entry_points: [],
  });

  const ids = focus.nodes.map(n => n.id).sort();
  assert.deepEqual(ids, ['src/a.ts', 'src/b.ts', 'src/dep.ts', 'target']);
  assert.equal(focus.edges.length, 3);
});

test('focus graph respects max node cap and prioritizes entry points and high risk', () => {
  const nodes: ImpactGraphNode[] = [node('target', { type: 'function' })];
  const edges: ImpactGraphEdge[] = [];
  for (let i = 0; i < 30; i += 1) {
    nodes.push(node(`src/file${i}.ts`));
    edges.push(edge(`src/file${i}.ts`, 'target'));
  }
  // Mark file29 as entry point (in api layer, high risk).
  const entry = nodes.find(n => n.id === 'src/file29.ts')!;
  entry.layer = 'api';
  entry.risk = 'high';

  const focus = buildFocusGraph(
    { nodes, edges },
    {
      target: 'target',
      direct_dependents: nodes.slice(1).map(n => n.id),
      indirect_dependents: [],
      entry_points: ['src/file29.ts'],
    },
    20
  );

  assert.ok(focus.nodes.length <= 20);
  assert.ok(focus.nodes.some(n => n.id === 'target'));
  assert.ok(focus.nodes.some(n => n.id === 'src/file29.ts'), 'entry point must be retained');
});

test('focus graph filters edges so both endpoints are included', () => {
  const fullGraph: ImpactGraph = {
    nodes: [
      node('target', { type: 'function' }),
      node('src/keep.ts'),
      node('src/drop1.ts'),
      node('src/drop2.ts'),
    ],
    edges: [
      edge('src/keep.ts', 'target'),
      edge('src/drop1.ts', 'src/drop2.ts'),
    ],
  };

  const focus = buildFocusGraph(fullGraph, {
    target: 'target',
    direct_dependents: ['src/keep.ts'],
    indirect_dependents: [],
    entry_points: [],
  });

  for (const e of focus.edges) {
    assert.ok(focus.nodes.some(n => n.id === e.from));
    assert.ok(focus.nodes.some(n => n.id === e.to));
  }
});

test('focus graph includes high-priority critical-layer and high-risk nodes over low-priority ones', () => {
  const fullGraph: ImpactGraph = {
    nodes: [
      node('target', { type: 'function' }),
      node('src/dep.ts'),
      node('src/auth/check.ts', { layer: 'auth' }),
      node('src/api/route.ts', { layer: 'api', risk: 'high' }),
      node('src/util/noise.ts'),
    ],
    edges: [
      edge('target', 'src/dep.ts'),
      edge('src/dep.ts', 'src/auth/check.ts'),
      edge('src/auth/check.ts', 'src/api/route.ts'),
      edge('src/util/noise.ts', 'src/dep.ts'),
    ],
  };

  const focus = buildFocusGraph(
    fullGraph,
    {
      target: 'target',
      direct_dependents: [],
      indirect_dependents: ['src/auth/check.ts', 'src/api/route.ts'],
      entry_points: ['src/api/route.ts'],
    },
    4
  );

  const ids = new Set(focus.nodes.map(n => n.id));
  assert.ok(ids.has('target'));
  assert.ok(ids.has('src/api/route.ts'), 'entry point must be retained');
  assert.ok(ids.has('src/auth/check.ts'), 'auth-layer indirect should be retained over plain util');
  assert.ok(!ids.has('src/util/noise.ts'), 'low-priority noise should be dropped');
});

test('focus graph returns full graph if target node is missing', () => {
  const fullGraph: ImpactGraph = {
    nodes: [node('a'), node('b')],
    edges: [edge('a', 'b')],
  };
  const focus = buildFocusGraph(fullGraph, {
    target: 'missing',
    direct_dependents: [],
    indirect_dependents: [],
    entry_points: [],
  });
  assert.equal(focus.nodes.length, 2);
  assert.equal(focus.edges.length, 1);
});
