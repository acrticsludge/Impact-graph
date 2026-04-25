import { DependencyGraph } from '../../analyzer/graph.js';
import { analyzeUsage, FileUsage } from '../../analyzer/usage.js';
import { calculateRiskScore, RiskFactors } from '../../engine/risk.js';
import { detectLayers } from '../../engine/layers.js';
import { readProjectFiles, findTypeScriptFiles } from '../../analyzer/fs.js';

export interface ImpactAnalysisResult {
  target: string;
  direct_dependents: string[];
  indirect_dependents: string[];
  usage_count: number;
  risk_score: number;
  risk_factors: string[];
  entry_points: string[];
  layers_affected: string[];
  is_critical: boolean;
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

  return {
    target,
    direct_dependents: directDependents,
    indirect_dependents: indirectDependents,
    usage_count: directDependents.length,
    risk_score: riskResult.score,
    risk_factors: riskResult.breakdown,
    entry_points: entryPoints,
    layers_affected: layersAffected,
    is_critical: riskResult.score > 75 || riskFactors.isCriticalPath,
  };
}

export async function analyzeImpactForPath(
  target: string,
  rootDir: string
): Promise<ImpactAnalysisResult> {
  const files = await readProjectFiles(findTypeScriptFiles(rootDir));
  return analyzeImpact(target, files);
}
