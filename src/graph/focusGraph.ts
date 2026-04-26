import { ImpactGraph, ImpactGraphNode } from './graphTypes.js';

export const FOCUS_GRAPH_MAX_NODES = 20;
const CRITICAL_LAYERS = new Set(['api', 'auth', 'database']);

export interface FocusGraphAnalysis {
  target: string;
  direct_dependents: string[];
  indirect_dependents: string[];
  entry_points: string[];
}

interface ScoredNode {
  node: ImpactGraphNode;
  importance: number;
  distance: number;
}

export function buildFocusGraph(
  fullGraph: ImpactGraph,
  analysis: FocusGraphAnalysis,
  maxNodes: number = FOCUS_GRAPH_MAX_NODES
): ImpactGraph {
  const nodeMap = new Map(fullGraph.nodes.map(node => [node.id, node]));
  if (!nodeMap.has(analysis.target)) {
    return { nodes: [...fullGraph.nodes], edges: [...fullGraph.edges] };
  }

  const distance = computeDistance(fullGraph, analysis.target);
  const directDependents = new Set(analysis.direct_dependents.filter(id => nodeMap.has(id)));
  const indirectDependents = new Set(analysis.indirect_dependents);
  const entryPoints = new Set(analysis.entry_points);
  const directDependencies = new Set(
    fullGraph.edges.filter(edge => edge.from === analysis.target).map(edge => edge.to)
  );

  const scored: ScoredNode[] = fullGraph.nodes
    .filter(node => node.id !== analysis.target)
    .map(node => ({
      node,
      importance: scoreNode(node, {
        directDependents,
        indirectDependents,
        directDependencies,
        entryPoints,
      }),
      distance: distance.get(node.id) ?? Number.POSITIVE_INFINITY,
    }));

  const kept = new Set<string>([analysis.target]);

  // Always-include set: direct dependents + direct dependencies (as much as cap allows,
  // ranked by importance then proximity so the most relevant always-include wins).
  const required = scored
    .filter(item => directDependents.has(item.node.id) || directDependencies.has(item.node.id))
    .sort(compareScored);
  for (const item of required) {
    if (kept.size >= maxNodes) break;
    kept.add(item.node.id);
  }

  // High-priority nodes: entry points, high risk, critical layers.
  const priority = scored
    .filter(item => !kept.has(item.node.id) && isHighPriority(item.node, entryPoints))
    .sort(compareScored);
  for (const item of priority) {
    if (kept.size >= maxNodes) break;
    kept.add(item.node.id);
  }

  // Fill remaining slots with whatever has the highest importance, breaking ties by proximity.
  const remaining = scored
    .filter(item => !kept.has(item.node.id) && item.importance > 0)
    .sort(compareScored);
  for (const item of remaining) {
    if (kept.size >= maxNodes) break;
    kept.add(item.node.id);
  }

  return {
    nodes: fullGraph.nodes.filter(node => kept.has(node.id)),
    edges: fullGraph.edges.filter(edge => kept.has(edge.from) && kept.has(edge.to)),
  };
}

function scoreNode(
  node: ImpactGraphNode,
  context: {
    directDependents: Set<string>;
    indirectDependents: Set<string>;
    directDependencies: Set<string>;
    entryPoints: Set<string>;
  }
): number {
  let score = 0;
  if (context.entryPoints.has(node.id)) score += 10;
  if (node.risk === 'high') score += 8;
  if (context.directDependents.has(node.id) || context.directDependencies.has(node.id)) score += 6;
  if (context.indirectDependents.has(node.id)) score += 3;
  if (CRITICAL_LAYERS.has(node.layer)) score += 5;
  return score;
}

function isHighPriority(node: ImpactGraphNode, entryPoints: Set<string>): boolean {
  if (entryPoints.has(node.id)) return true;
  if (node.risk === 'high') return true;
  if (CRITICAL_LAYERS.has(node.layer)) return true;
  return false;
}

function compareScored(left: ScoredNode, right: ScoredNode): number {
  if (right.importance !== left.importance) return right.importance - left.importance;
  if (left.distance !== right.distance) return left.distance - right.distance;
  return left.node.id.localeCompare(right.node.id);
}

function computeDistance(graph: ImpactGraph, source: string): Map<string, number> {
  const adjacency = new Map<string, Set<string>>();
  for (const node of graph.nodes) adjacency.set(node.id, new Set());
  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }

  const distance = new Map<string, number>([[source, 0]]);
  const queue: string[] = [source];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const currentDistance = distance.get(current) as number;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (distance.has(neighbor)) continue;
      distance.set(neighbor, currentDistance + 1);
      queue.push(neighbor);
    }
  }
  return distance;
}

