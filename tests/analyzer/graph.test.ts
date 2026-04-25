import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DependencyGraph } from '../../src/analyzer/graph.js';

describe('DependencyGraph', () => {
  it('creates an empty graph', () => {
    const graph = new DependencyGraph();
    assert.strictEqual(graph.nodeCount, 0);
  });

  it('adds nodes to the graph', () => {
    const graph = new DependencyGraph();
    graph.addNode('foo');
    graph.addNode('bar');
    assert.strictEqual(graph.nodeCount, 2);
  });

  it('adds directed edges between nodes', () => {
    const graph = new DependencyGraph();
    graph.addNode('caller');
    graph.addNode('callee');
    graph.addEdge('caller', 'callee');

    const callees = graph.getCallees('caller');
    assert.deepStrictEqual(callees, ['callee']);
  });

  it('finds all callers of a node', () => {
    const graph = new DependencyGraph();
    graph.addEdge('a', 'c');
    graph.addEdge('b', 'c');
    graph.addEdge('d', 'c');

    const callers = graph.getCallers('c');
    assert.deepStrictEqual(callers, ['a', 'b', 'd']);
  });

  it('finds transitive dependencies (callees recursively)', () => {
    const graph = new DependencyGraph();
    graph.addEdge('a', 'b');
    graph.addEdge('b', 'c');
    graph.addEdge('c', 'd');

    const transitive = graph.getTransitiveCallees('a');
    assert.ok(transitive.includes('b'));
    assert.ok(transitive.includes('c'));
    assert.ok(transitive.includes('d'));
  });

  it('finds transitive dependents (callers recursively)', () => {
    const graph = new DependencyGraph();
    graph.addEdge('a', 'b');
    graph.addEdge('b', 'c');
    graph.addEdge('c', 'd');

    const transitive = graph.getTransitiveCallers('d');
    assert.ok(transitive.includes('c'));
    assert.ok(transitive.includes('b'));
    assert.ok(transitive.includes('a'));
  });

  it('handles diamond dependencies without duplicates', () => {
    const graph = new DependencyGraph();
    graph.addEdge('top', 'left');
    graph.addEdge('top', 'right');
    graph.addEdge('left', 'bottom');
    graph.addEdge('right', 'bottom');

    const transitive = graph.getTransitiveCallees('top');
    const unique = new Set(transitive);
    assert.strictEqual(transitive.length, unique.size);
    assert.ok(transitive.includes('bottom'));
  });

  it('returns empty array for non-existent node', () => {
    const graph = new DependencyGraph();
    graph.addEdge('a', 'b');

    assert.deepStrictEqual(graph.getCallers('z'), []);
    assert.deepStrictEqual(graph.getCallees('z'), []);
  });
});
