import * as path from 'node:path';
import { DependencyGraph } from '../analyzer/graph.js';
import { extractSymbols } from '../analyzer/ast.js';
import { FileUsage } from '../analyzer/usage.js';
import { detectLayers } from '../engine/layers.js';
import { calculateRiskScore } from '../engine/risk.js';
import { ImpactGraph, ImpactGraphEdge, ImpactGraphEdgeType, ImpactGraphNode, ImpactGraphNodeRisk } from './graphTypes.js';

const MAX_GRAPH_NODES = 30;

export interface BuildImpactGraphInput {
  target: string;
  files: Map<string, string>;
  fileUsages: Map<string, FileUsage>;
  symbolGraph: DependencyGraph;
  definingFiles: string[];
  directDependents: string[];
  indirectDependents: string[];
  isEntryPoint: (filePath: string) => boolean;
}

interface NodeContext {
  sourcePath: string | null;
  type: ImpactGraphNode['type'];
}

export function buildImpactGraph(input: BuildImpactGraphInput): ImpactGraph {
  const nodes = new Map<string, ImpactGraphNode>();
  const edges: ImpactGraphEdge[] = [];
  const contexts = new Map<string, NodeContext>();
  const centerType = input.definingFiles.length > 0 ? 'function' : inferTargetType(input.target);

  addNode(nodes, contexts, input.target, {
    id: input.target,
    label: labelFor(input.target),
    type: centerType,
    sourcePath: input.definingFiles[0] ?? (input.files.has(input.target) ? input.target : null),
    fileUsages: input.fileUsages,
    symbolGraph: input.symbolGraph,
    isEntryPoint: input.isEntryPoint,
  });

  for (const dependent of input.directDependents) {
    addFileNode(nodes, contexts, dependent, input);
    addEdge(edges, dependent, input.target, 'calls');
  }

  for (const dependency of getTargetDependencies(input)) {
    addNode(nodes, contexts, dependency.id, {
      id: dependency.id,
      label: dependency.label,
      type: dependency.type,
      sourcePath: dependency.sourcePath,
      fileUsages: input.fileUsages,
      symbolGraph: input.symbolGraph,
      isEntryPoint: input.isEntryPoint,
    });
    addEdge(edges, input.target, dependency.id, dependency.edgeType);
  }

  addOneLevelIndirectNodes(nodes, contexts, edges, input);
  return trimGraph({ nodes: Array.from(nodes.values()), edges }, input.target);
}

function getTargetDependencies(input: BuildImpactGraphInput): Array<{
  id: string;
  label: string;
  type: ImpactGraphNode['type'];
  sourcePath: string | null;
  edgeType: ImpactGraphEdgeType;
}> {
  if (input.definingFiles.length > 0) {
    return getFunctionDependencies(input);
  }

  const fileDependencies = new Map<string, ImpactGraphEdgeType>();
  for (const callee of input.symbolGraph.getCallees(input.target)) {
    fileDependencies.set(callee, 'calls');
  }

  const usage = input.fileUsages.get(input.target);
  if (usage) {
    for (const imp of usage.imports) {
      if (!imp.isLocal) continue;
      const resolved = resolveImport(input.target, imp.moduleName, input.files);
      if (resolved) fileDependencies.set(resolved, 'imports');
    }
  }

  return Array.from(fileDependencies, ([filePath, edgeType]) => ({
    id: filePath,
    label: labelFor(filePath),
    type: 'file' as const,
    sourcePath: filePath,
    edgeType,
  }));
}

function getFunctionDependencies(input: BuildImpactGraphInput): ReturnType<typeof getTargetDependencies> {
  const dependencies = new Map<string, ReturnType<typeof getTargetDependencies>[number]>();

  for (const filePath of input.definingFiles) {
    const content = input.files.get(filePath);
    if (!content) continue;

    const symbols = extractSymbols(content);
    const targetFunction = symbols.functions.find(fn => fn.name === input.target);
    if (!targetFunction) continue;

    // Restrict call edges to calls inside the target function span so the graph
    // shows what the target itself invokes, not every call in its file.
    const calls = symbols.calls.filter(call =>
      call.name !== input.target &&
      call.startOffset >= targetFunction.startOffset &&
      call.startOffset <= targetFunction.endOffset
    );

    for (const call of calls) {
      const sourcePath = findDefiningFile(call.name, input.fileUsages);
      const id = sourcePath ? `${sourcePath}#${call.name}` : call.name;
      dependencies.set(id, {
        id,
        label: call.name,
        type: 'function',
        sourcePath,
        edgeType: 'calls',
      });
    }
  }

  return Array.from(dependencies.values());
}

function addOneLevelIndirectNodes(
  nodes: Map<string, ImpactGraphNode>,
  contexts: Map<string, NodeContext>,
  edges: ImpactGraphEdge[],
  input: BuildImpactGraphInput
): void {
  const allowedIndirect = new Set(input.indirectDependents);

  for (const direct of input.directDependents) {
    for (const caller of input.symbolGraph.getCallers(direct)) {
      if (!allowedIndirect.has(caller)) continue;
      addFileNode(nodes, contexts, caller, input);
      addEdge(edges, caller, direct, 'calls');
    }
  }
}

function addFileNode(
  nodes: Map<string, ImpactGraphNode>,
  contexts: Map<string, NodeContext>,
  filePath: string,
  input: BuildImpactGraphInput
): void {
  addNode(nodes, contexts, filePath, {
    id: filePath,
    label: labelFor(filePath),
    type: 'file',
    sourcePath: filePath,
    fileUsages: input.fileUsages,
    symbolGraph: input.symbolGraph,
    isEntryPoint: input.isEntryPoint,
  });
}

function addNode(
  nodes: Map<string, ImpactGraphNode>,
  contexts: Map<string, NodeContext>,
  id: string,
  options: {
    id: string;
    label: string;
    type: ImpactGraphNode['type'];
    sourcePath: string | null;
    fileUsages: Map<string, FileUsage>;
    symbolGraph: DependencyGraph;
    isEntryPoint: (filePath: string) => boolean;
  }
): void {
  if (nodes.has(id)) return;

  const layer = options.sourcePath ? (detectLayers([options.sourcePath])[0] ?? 'unknown') : 'unknown';
  const risk = getNodeRisk(options.sourcePath, options.fileUsages, options.symbolGraph, options.isEntryPoint);
  nodes.set(id, { id: options.id, label: options.label, type: options.type, layer, risk });
  contexts.set(id, { sourcePath: options.sourcePath, type: options.type });
}

function addEdge(edges: ImpactGraphEdge[], from: string, to: string, type: ImpactGraphEdgeType): void {
  if (from === to) return;
  if (edges.some(edge => edge.from === from && edge.to === to && edge.type === type)) return;
  edges.push({ from, to, type });
}

function trimGraph(graph: ImpactGraph, target: string): ImpactGraph {
  if (graph.nodes.length <= MAX_GRAPH_NODES) {
    return {
      nodes: sortNodes(graph.nodes, target),
      edges: sortEdges(graph.edges),
    };
  }

  const scoredNodes = graph.nodes
    .map(node => ({ node, score: nodeScore(node, target) }))
    .sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id));
  const keptIds = new Set(scoredNodes.slice(0, MAX_GRAPH_NODES).map(item => item.node.id));
  keptIds.add(target);

  return {
    nodes: sortNodes(graph.nodes.filter(node => keptIds.has(node.id)), target),
    edges: sortEdges(graph.edges.filter(edge => keptIds.has(edge.from) && keptIds.has(edge.to))),
  };
}

function nodeScore(node: ImpactGraphNode, target: string): number {
  if (node.id === target) return 1000;
  const riskScore = node.risk === 'high' ? 30 : node.risk === 'moderate' ? 15 : 0;
  const typeScore = node.type === 'function' ? 10 : 0;
  return riskScore + typeScore;
}

function getNodeRisk(
  sourcePath: string | null,
  fileUsages: Map<string, FileUsage>,
  symbolGraph: DependencyGraph,
  isEntryPoint: (filePath: string) => boolean
): ImpactGraphNodeRisk {
  if (!sourcePath) return 'low';

  const usageCount = symbolGraph.getCallers(sourcePath).length;
  const layersAffected = detectLayers([sourcePath]);
  const risk = calculateRiskScore({
    usageCount,
    directDependents: usageCount,
    indirectDependents: symbolGraph.getTransitiveCallers(sourcePath).length,
    isEntryPoint: isEntryPoint(sourcePath),
    entryPointTypes: isEntryPoint(sourcePath) ? ['entry'] : [],
    layersAffected,
    isCriticalPath: layersAffected.length > 2 || usageCount > 5,
  }).score;

  if (risk >= 50) return 'high';
  if (risk >= 25) return 'moderate';
  return fileUsages.has(sourcePath) ? 'low' : 'low';
}

function inferTargetType(target: string): ImpactGraphNode['type'] {
  if (/\.[cm]?[tj]sx?$/.test(target)) return 'file';
  if (target.includes('/') || target.includes('\\')) return 'module';
  return 'function';
}

function findDefiningFile(symbolName: string, fileUsages: Map<string, FileUsage>): string | null {
  for (const [filePath, usage] of fileUsages) {
    if (usage.exportedSymbols.includes(symbolName)) return filePath;
  }
  return null;
}

function labelFor(id: string): string {
  const hashIndex = id.lastIndexOf('#');
  if (hashIndex >= 0) return id.slice(hashIndex + 1);
  return id.split(/[\\/]/).pop() ?? id;
}

function resolveImport(fromFile: string, importPath: string, files: Map<string, string>): string | null {
  const fromDir = path.posix.dirname(normalizePath(fromFile));
  const base = path.posix.normalize(path.posix.join(fromDir, importPath));
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find(candidate => files.has(candidate)) ?? null;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function sortNodes(nodes: ImpactGraphNode[], target: string): ImpactGraphNode[] {
  return [...nodes].sort((a, b) => {
    if (a.id === target) return -1;
    if (b.id === target) return 1;
    return a.id.localeCompare(b.id);
  });
}

function sortEdges(edges: ImpactGraphEdge[]): ImpactGraphEdge[] {
  return [...edges].sort((a, b) =>
    `${a.from}\u0000${a.to}\u0000${a.type}`.localeCompare(`${b.from}\u0000${b.to}\u0000${b.type}`)
  );
}
