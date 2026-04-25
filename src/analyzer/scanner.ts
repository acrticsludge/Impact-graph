import { analyzeUsage } from './usage.js';
import { detectLayers } from '../engine/layers.js';
import { calculateRiskScore } from '../engine/risk.js';
import { findTypeScriptFiles, readProjectFiles } from './fs.js';

export interface ProjectSymbol {
  name: string;
  definingFile: string;
  risk_score: number;
  layer: string;
  usage_count: number;
}

const MAX_SYMBOLS = 200;

export function extractProjectSymbols(files: Map<string, string>): ProjectSymbol[] {
  const nonTestFiles = new Map(
    [...files].filter(([p]) => !/\.(test|spec)\.tsx?$/.test(p))
  );

  const fileUsages = new Map<string, ReturnType<typeof analyzeUsage>>();
  for (const [filePath, content] of nonTestFiles) {
    fileUsages.set(filePath, analyzeUsage(content, filePath));
  }

  const symbolFiles = new Map<string, string>();
  for (const [filePath, usage] of fileUsages) {
    for (const sym of usage.exportedSymbols) {
      if (!symbolFiles.has(sym)) symbolFiles.set(sym, filePath);
    }
  }

  const callerCount = new Map<string, number>();
  for (const [, usage] of fileUsages) {
    for (const call of usage.localCalls) {
      if (symbolFiles.has(call.name)) {
        callerCount.set(call.name, (callerCount.get(call.name) ?? 0) + 1);
      }
    }
  }

  const symbols: ProjectSymbol[] = [];
  for (const [name, definingFile] of symbolFiles) {
    const usage_count = callerCount.get(name) ?? 0;
    const layers = detectLayers([definingFile]);
    const layer = layers[0] ?? 'core';
    const risk_score = calculateRiskScore({
      usageCount: usage_count,
      directDependents: usage_count,
      indirectDependents: 0,
      isEntryPoint: false,
      entryPointTypes: [],
      layersAffected: layers,
      isCriticalPath: usage_count > 5,
    }).score;
    symbols.push({ name, definingFile, risk_score, layer, usage_count });
  }

  return symbols
    .sort((a, b) => b.risk_score - a.risk_score || b.usage_count - a.usage_count)
    .slice(0, MAX_SYMBOLS);
}

export async function scanProjectSymbols(rootDir: string): Promise<ProjectSymbol[]> {
  const filePaths = findTypeScriptFiles(rootDir, ['node_modules', 'dist', '.git']);
  const files = await readProjectFiles(filePaths);
  return extractProjectSymbols(files);
}
