export interface NextActionsInput {
  risk_score: number;
  usage_count: number;
  direct_dependents: string[];
  indirect_dependents: string[];
  entry_points: string[];
  layers_affected: string[];
}

export function generateNextActions(input: NextActionsInput): string[] {
  const actions: string[] = [];

  if (input.risk_score > 70) {
    actions.push('Add regression tests before modifying this code');
    actions.push('Make incremental changes instead of large refactors');
  }

  if (input.layers_affected.includes('api')) {
    actions.push('Avoid breaking API contracts (request/response shape)');
    actions.push('Verify all endpoints using this function');
  }

  if (input.layers_affected.includes('auth')) {
    actions.push('Test authentication flows thoroughly after changes');
    actions.push('Ensure session and token handling remain intact');
  }

  if (input.layers_affected.includes('database')) {
    actions.push('Validate data consistency after modification');
    actions.push('Check for unintended data mutations');
  }

  if (input.usage_count > 20) {
    actions.push('Refactor incrementally to avoid widespread breakage');
    actions.push('Search for all usages before modifying');
  }

  if (input.direct_dependents.length + input.indirect_dependents.length > 5) {
    actions.push('Consider creating a wrapper instead of modifying directly');
    actions.push('Update dependents carefully if changing function signature');
  }

  if (input.entry_points.length > 0) {
    actions.push('Test all user-facing flows that rely on this function');
  }

  const unique = Array.from(new Set(actions)).slice(0, 7);
  return unique.length > 0 ? unique : ['Proceed with the smallest behavior-preserving change'];
}
