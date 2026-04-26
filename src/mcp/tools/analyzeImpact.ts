import { DependencyGraph } from '../../analyzer/graph.js';
import { analyzeUsage, FileUsage } from '../../analyzer/usage.js';
import { calculateRiskScore, RiskFactors } from '../../engine/risk.js';
import { detectLayers } from '../../engine/layers.js';
import { buildDecisionOutput, DecisionOutput, DependentCandidate, ImpactSummary } from '../../engine/decision.js';
import { buildImpactGraph } from '../../graph/buildGraph.js';
import { buildFocusGraph } from '../../graph/focusGraph.js';
import { ImpactGraph } from '../../graph/graphTypes.js';
import { readProjectFiles, findTypeScriptFiles } from '../../analyzer/fs.js';
import { generateRiskExplanation } from '../../engine/riskExplanation.js';
import { generateNextActions } from '../../engine/nextActions.js';

export interface ImpactAnalysisResult extends DecisionOutput {
  target: string;
  direct_dependents: string[];
  indirect_dependents: string[];
  usage_count: number;
  risk_score: number;
  risk_factors: string[];
  risk_explanation: string[];
  next_actions: string[];
  entry_points: string[];
  layers_affected: string[];
  is_critical: boolean;
  impact_summary: ImpactSummary;
  recommended_strategy: string[];
  suggested_tests: string[];
  safe_changes: string[];
  risky_changes: string[];
  top_dependents: string[];
  graph: ImpactGraph;
  focus_graph: ImpactGraph;
}

const ENTRY_POINT_PATTERNS = [/app\/api\//, /\/route\.ts$/, /\/handler\.ts$/, /cli\//, /\/command\//];

function isEntryPoint(filePath: string): boolean {
  return ENTRY_POINT_PATTERNS.some(p => p.test(filePath));
}

export async function analyzeImpact(
  target: string,
  files: Map<string, string>
): Promise<ImpactAnalysisResult> {
  const fileUsages = new Map<string, FileUsage>();
  for (const [filePath, content] of files) {
    fileUsages.set(filePath, analyzeUsage(content, filePath));
  }

  const definingFiles: string[] = [];
  for (const [filePath, usage] of fileUsages) {
    if (usage.exportedSymbols.includes(target)) definingFiles.push(filePath);
  }

  const directDependents: string[] = [];
  for (const [filePath, usage] of fileUsages) {
    const callsTarget = usage.localCalls.some(c => c.name === target);
    const importsTarget = usage.imports.some(
      imp => imp.symbols.includes(target) && definingFiles.some(def => imp.moduleName.includes(def))
    );
    if (callsTarget || importsTarget) directDependents.push(filePath);
  }

  const symbolGraph = new DependencyGraph();
  for (const [filePath, usage] of fileUsages) {
    symbolGraph.addNode(filePath);
    for (const call of usage.localCalls) {
      for (const [defPath, defUsage] of fileUsages) {
        if (defUsage.exportedSymbols.includes(call.name)) {
          symbolGraph.addEdge(filePath, defPath);
        }
      }
    }
  }

  const indirectDependentsSet = new Set<string>();
  for (const direct of directDependents) {
    for (const t of symbolGraph.getTransitiveCallers(direct)) {
      if (!directDependents.includes(t)) indirectDependentsSet.add(t);
    }
  }
  const indirectDependents = Array.from(indirectDependentsSet);

  const entryPoints = directDependents.filter(isEntryPoint);
  const layersAffected = detectLayers([...definingFiles, ...directDependents, ...indirectDependents]);

  const riskFactors: RiskFactors = {
    usageCount: directDependents.length,
    directDependents: directDependents.length,
    indirectDependents: indirectDependents.length,
    isEntryPoint: entryPoints.length > 0,
    entryPointTypes: entryPoints.some(p => /api|route/.test(p)) ? ['api'] :
                     entryPoints.some(p => /cli|command/.test(p)) ? ['cli'] : [],
    layersAffected,
    isCriticalPath: layersAffected.length > 2 || directDependents.length > 5,
  };

  const riskResult = calculateRiskScore(riskFactors, true);
  const isCritical = riskResult.score > 75 || riskFactors.isCriticalPath;
  const riskExplanation = generateRiskExplanation({
    usage_count: directDependents.length,
    direct_dependents: directDependents,
    indirect_dependents: indirectDependents,
    entry_points: entryPoints,
    entry_point_types: riskFactors.entryPointTypes,
    layers_affected: layersAffected,
    is_critical: isCritical,
  });
  const nextActions = generateNextActions({
    risk_score: riskResult.score,
    usage_count: directDependents.length,
    direct_dependents: directDependents,
    indirect_dependents: indirectDependents,
    entry_points: entryPoints,
    layers_affected: layersAffected,
  });
  const allDependents = [...directDependents, ...indirectDependents];
  const dependencyDepth = getMaxDependencyDepth(symbolGraph, directDependents);
  const dependentCandidates: DependentCandidate[] = allDependents.map(filePath => ({
    path: filePath,
    usageCount: symbolGraph.getCallers(filePath).length,
    isEntryPoint: isEntryPoint(filePath),
    layers: detectLayers([filePath]),
  }));
  const decisionOutput = buildDecisionOutput({
    target,
    riskScore: riskResult.score,
    riskFactors: riskResult.breakdown,
    usageCount: directDependents.length,
    directDependents,
    indirectDependents,
    entryPoints,
    layersAffected,
    isCritical,
    dependencyDepth,
    dependents: dependentCandidates,
  });
  const graph = buildImpactGraph({
    target,
    files,
    fileUsages,
    symbolGraph,
    definingFiles,
    directDependents,
    indirectDependents,
    isEntryPoint,
  });
  const focusGraph = buildFocusGraph(graph, {
    target,
    direct_dependents: directDependents,
    indirect_dependents: indirectDependents,
    entry_points: entryPoints,
  });

  return {
    target,
    direct_dependents: directDependents,
    indirect_dependents: indirectDependents,
    usage_count: directDependents.length,
    risk_score: riskResult.score,
    risk_factors: riskResult.breakdown,
    risk_explanation: riskExplanation,
    next_actions: nextActions,
    entry_points: entryPoints,
    layers_affected: layersAffected,
    is_critical: isCritical,
    graph,
    focus_graph: focusGraph,
    ...decisionOutput,
  };
}

function getMaxDependencyDepth(graph: DependencyGraph, directDependents: string[]): number {
  let maxDepth = 0;

  for (const dependent of directDependents) {
    maxDepth = Math.max(maxDepth, getCallerDepth(graph, dependent, new Set()));
  }

  return maxDepth;
}

function getCallerDepth(graph: DependencyGraph, node: string, visited: Set<string>): number {
  if (visited.has(node)) return 0;
  visited.add(node);

  const callers = graph.getCallers(node);
  if (callers.length === 0) return 0;

  return 1 + Math.max(...callers.map(caller => getCallerDepth(graph, caller, new Set(visited))));
}

export async function analyzeImpactForPath(
  target: string,
  rootDir: string
): Promise<ImpactAnalysisResult> {
  const files = await readProjectFiles(findTypeScriptFiles(rootDir));
  return analyzeImpact(target, files);
}
