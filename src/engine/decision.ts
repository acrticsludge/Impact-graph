export type ImpactSeverity = 'low' | 'moderate' | 'high' | 'critical';
export type BlastRadius = 'narrow' | 'medium' | 'wide';

export interface ImpactSummary {
  severity: ImpactSeverity;
  blast_radius: BlastRadius;
  primary_concern: string;
}

export interface DependentCandidate {
  path: string;
  usageCount: number;
  isEntryPoint: boolean;
  layers: string[];
}

export interface DecisionInput {
  target: string;
  riskScore: number;
  riskFactors: string[];
  usageCount: number;
  directDependents: string[];
  indirectDependents: string[];
  entryPoints: string[];
  layersAffected: string[];
  isCritical: boolean;
  dependencyDepth: number;
  dependents: DependentCandidate[];
}

export interface ChangeGuidance {
  safe_changes: string[];
  risky_changes: string[];
}

export interface DecisionOutput extends ChangeGuidance {
  impact_summary: ImpactSummary;
  recommended_strategy: string[];
  suggested_tests: string[];
  top_dependents: string[];
}

const CRITICAL_LAYERS = new Set(['api', 'auth', 'database']);

export function buildDecisionOutput(input: DecisionInput): DecisionOutput {
  return {
    impact_summary: getImpactSummary(input),
    recommended_strategy: getRecommendedStrategy(input),
    suggested_tests: getSuggestedTests(input),
    ...getChangeGuidance(input),
    top_dependents: getTopDependents(input),
  };
}

export function getImpactSummary(input: DecisionInput): ImpactSummary {
  return {
    severity: getSeverity(input.riskScore),
    blast_radius: getBlastRadius(input),
    primary_concern: getPrimaryConcern(input),
  };
}

export function getRecommendedStrategy(input: DecisionInput): string[] {
  const strategies: string[] = [];
  const severity = getSeverity(input.riskScore);

  if (severity === 'high' || severity === 'critical') {
    strategies.push('add tests before modifying');
  }

  if (input.layersAffected.includes('api')) {
    strategies.push('avoid breaking API contracts');
  }

  if (input.dependencyDepth > 1 || input.indirectDependents.length > 3) {
    strategies.push('consider wrapper instead of direct modification');
  }

  if (input.usageCount > 5) {
    strategies.push('refactor incrementally');
  }

  if (input.layersAffected.includes('auth')) {
    strategies.push('validate authentication and session behavior');
  }

  if (input.layersAffected.includes('database')) {
    strategies.push('verify data consistency before release');
  }

  if (strategies.length === 0) {
    strategies.push('make the smallest behavior-preserving change');
  }

  return unique(strategies);
}

export function getSuggestedTests(input: DecisionInput): string[] {
  const tests: string[] = [];
  const normalizedTarget = input.target.toLowerCase();

  if (/(login|auth|session)/.test(normalizedTarget)) {
    tests.push('valid login', 'invalid credentials', 'expired session');
  }

  if (/(payment|checkout|billing)/.test(normalizedTarget)) {
    tests.push('successful payment', 'failed payment', 'duplicate payment prevention');
  }

  if (/(fetch|load|request)/.test(normalizedTarget)) {
    tests.push('successful fetch', 'network error handling', 'empty response handling');
  }

  if (input.layersAffected.includes('auth')) {
    tests.push('authorized access', 'unauthorized access');
  }

  if (input.layersAffected.includes('api')) {
    tests.push('response status', 'error handling');
  }

  if (input.layersAffected.includes('database')) {
    tests.push('data consistency', 'transaction rollback');
  }

  if (tests.length === 0) {
    tests.push('existing behavior remains unchanged');
  }

  return unique(tests);
}

export function getChangeGuidance(input: DecisionInput): ChangeGuidance {
  const safeChanges = [
    'internal logic refactors',
    'logging additions',
    'performance improvements without signature changes',
  ];
  const riskyChanges = [
    'changing return types',
    'modifying function signatures',
  ];

  if (input.layersAffected.includes('api') || input.entryPoints.length > 0) {
    riskyChanges.push('changing external API behavior');
  }

  if (input.layersAffected.includes('auth')) {
    riskyChanges.push('altering authentication or authorization logic');
  }

  if (input.layersAffected.includes('database')) {
    riskyChanges.push('altering database writes or schema assumptions');
  }

  if (input.isCritical) {
    riskyChanges.push('changing critical path control flow');
  }

  return {
    safe_changes: unique(safeChanges),
    risky_changes: unique(riskyChanges),
  };
}

export function getTopDependents(input: DecisionInput): string[] {
  return [...input.dependents]
    .sort((left, right) => {
      const scoreDifference = scoreDependent(right) - scoreDependent(left);
      return scoreDifference !== 0 ? scoreDifference : left.path.localeCompare(right.path);
    })
    .slice(0, 5)
    .map(dependent => dependent.path);
}

function getSeverity(riskScore: number): ImpactSeverity {
  if (riskScore < 25) return 'low';
  if (riskScore < 50) return 'moderate';
  if (riskScore < 75) return 'high';
  return 'critical';
}

function getBlastRadius(input: DecisionInput): BlastRadius {
  // Depth is weighted because a deep caller chain usually means less obvious breakage.
  const radiusScore = input.usageCount + input.indirectDependents.length + input.dependencyDepth * 2;
  if (radiusScore <= 3) return 'narrow';
  if (radiusScore <= 10) return 'medium';
  return 'wide';
}

function getPrimaryConcern(input: DecisionInput): string {
  if (input.layersAffected.includes('auth')) return 'affects authentication flow';
  if (input.layersAffected.includes('api')) return 'affects API behavior';
  if (input.layersAffected.includes('database')) return 'affects data integrity';
  if (input.isCritical || input.riskScore >= 75) return 'affects critical path';

  const highestRiskFactor = getHighestRiskFactor(input.riskFactors);
  return highestRiskFactor ?? 'localized impact';
}

function getHighestRiskFactor(riskFactors: string[]): string | null {
  let highestFactor: string | null = null;
  let highestScore = Number.NEGATIVE_INFINITY;

  for (const factor of riskFactors) {
    const match = /\+(\d+(?:\.\d+)?) pts/.exec(factor);
    const score = match ? Number(match[1]) : 0;
    if (score > highestScore) {
      highestScore = score;
      highestFactor = factor;
    }
  }

  return highestFactor;
}

function scoreDependent(dependent: DependentCandidate): number {
  let score = dependent.usageCount * 10;
  if (dependent.isEntryPoint) score += 100;

  // API/auth/database dependents deserve priority because they shape external behavior or data safety.
  for (const layer of dependent.layers) {
    if (CRITICAL_LAYERS.has(layer)) score += 25;
  }

  return score;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
