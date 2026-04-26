export interface RiskExplanationInput {
  usage_count: number;
  direct_dependents: string[];
  indirect_dependents: string[];
  entry_points: string[];
  entry_point_types: string[];
  layers_affected: string[];
  is_critical: boolean;
}

const LAYER_MESSAGES: Record<string, string> = {
  auth: 'Part of authentication flow',
  api: 'Affects API responses',
  database: 'Affects data persistence',
  frontend: 'Impacts user interface behavior',
};

export function generateRiskExplanation(input: RiskExplanationInput): string[] {
  const reasons: string[] = [];

  if (input.usage_count > 50) {
    reasons.push('Core dependency used in many modules');
  } else if (input.usage_count > 20) {
    reasons.push('Widely used across the codebase');
  }

  if (input.entry_points.length > 0) {
    reasons.push('Reachable from user-facing entry points');
    if (input.entry_point_types.some(t => t === 'api' || t === 'route')) {
      reasons.push('Used in API routes (externally visible behavior)');
    }
  }

  for (const layer of input.layers_affected) {
    const msg = LAYER_MESSAGES[layer];
    if (msg) reasons.push(msg);
  }

  if (input.direct_dependents.length > 5) {
    reasons.push('Multiple modules directly depend on this');
  }

  if (input.indirect_dependents.length > 0) {
    reasons.push('Changes may cause cascading failures');
  }

  if (input.is_critical) {
    reasons.push('Core system function with high impact');
  }

  const unique = Array.from(new Set(reasons));
  return unique.length > 0 ? unique : ['No significant risk factors detected'];
}
