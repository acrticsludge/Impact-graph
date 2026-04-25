export interface RiskFactors {
  usageCount: number;
  directDependents: number;
  indirectDependents: number;
  isEntryPoint: boolean;
  entryPointTypes: string[];
  layersAffected: string[];
  isCriticalPath: boolean;
}

export interface RiskResult {
  score: number;
  breakdown: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export function calculateRiskScore(factors: RiskFactors, includeBreakdown: boolean = false): RiskResult {
  let score = 0;
  const breakdown: string[] = [];

  const usageScore = Math.min(factors.usageCount * 2, 25);
  score += usageScore;
  if (includeBreakdown && usageScore > 0)
    breakdown.push(`Usage frequency: ${factors.usageCount} uses (+${Math.round(usageScore)} pts)`);

  const directScore = Math.min(factors.directDependents * 4, 20);
  score += directScore;
  if (includeBreakdown && directScore > 0)
    breakdown.push(`Direct dependents: ${factors.directDependents} (+${Math.round(directScore)} pts)`);

  const indirectScore = Math.min(factors.indirectDependents * 0.5, 15);
  score += indirectScore;
  if (includeBreakdown && indirectScore > 0)
    breakdown.push(`Indirect dependents: ${factors.indirectDependents} (+${Math.round(indirectScore)} pts)`);

  if (factors.isEntryPoint) {
    const entryScore = Math.min(10 + factors.entryPointTypes.length * 5, 20);
    score += entryScore;
    if (includeBreakdown)
      breakdown.push(`Entry point usage: ${factors.entryPointTypes.join(', ')} (+${entryScore} pts)`);
  }

  const layerScore = Math.min(factors.layersAffected.length * 5, 15);
  score += layerScore;
  if (includeBreakdown && layerScore > 0)
    breakdown.push(`Layers affected: ${factors.layersAffected.join(', ')} (+${layerScore} pts)`);

  if (factors.isCriticalPath) {
    score += 15;
    if (includeBreakdown) breakdown.push('Critical path involvement (+15 pts)');
  }

  score = Math.min(Math.max(score, 0), 100);

  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (score < 25) riskLevel = 'low';
  else if (score < 50) riskLevel = 'medium';
  else if (score < 75) riskLevel = 'high';
  else riskLevel = 'critical';

  return { score: Math.round(score), breakdown, riskLevel };
}
