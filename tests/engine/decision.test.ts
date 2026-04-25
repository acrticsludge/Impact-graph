import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DecisionInput,
  getChangeGuidance,
  getImpactSummary,
  getRecommendedStrategy,
  getSuggestedTests,
  getTopDependents,
} from '../../src/engine/decision.js';

function input(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    target: 'updateUser',
    riskScore: 10,
    riskFactors: [],
    usageCount: 1,
    directDependents: ['src/lib/user.ts'],
    indirectDependents: [],
    entryPoints: [],
    layersAffected: [],
    isCritical: false,
    dependencyDepth: 0,
    dependents: [],
    ...overrides,
  };
}

test('impact summary maps risk scores to severity thresholds', () => {
  assert.equal(getImpactSummary(input({ riskScore: 24 })).severity, 'low');
  assert.equal(getImpactSummary(input({ riskScore: 25 })).severity, 'moderate');
  assert.equal(getImpactSummary(input({ riskScore: 50 })).severity, 'high');
  assert.equal(getImpactSummary(input({ riskScore: 75 })).severity, 'critical');
});

test('impact summary computes blast radius from usage, indirect dependents, and depth', () => {
  assert.equal(getImpactSummary(input({ usageCount: 1, indirectDependents: [], dependencyDepth: 1 })).blast_radius, 'narrow');
  assert.equal(
    getImpactSummary(input({ usageCount: 4, indirectDependents: ['a', 'b'], dependencyDepth: 2 })).blast_radius,
    'medium'
  );
  assert.equal(
    getImpactSummary(input({ usageCount: 7, indirectDependents: ['a', 'b'], dependencyDepth: 2 })).blast_radius,
    'wide'
  );
});

test('impact summary chooses primary concern by layer priority', () => {
  assert.equal(getImpactSummary(input({ layersAffected: ['database', 'auth', 'api'] })).primary_concern, 'affects authentication flow');
  assert.equal(getImpactSummary(input({ layersAffected: ['database', 'api'] })).primary_concern, 'affects API behavior');
  assert.equal(getImpactSummary(input({ layersAffected: ['database'] })).primary_concern, 'affects data integrity');
  assert.equal(getImpactSummary(input({ riskScore: 80, isCritical: true })).primary_concern, 'affects critical path');
  assert.equal(getImpactSummary(input()).primary_concern, 'localized impact');
});

test('impact summary falls back to highest scored risk factor', () => {
  const summary = getImpactSummary(
    input({
      riskFactors: ['Usage frequency: 2 uses (+4 pts)', 'Entry point usage: api (+15 pts)'],
    })
  );

  assert.equal(summary.primary_concern, 'Entry point usage: api (+15 pts)');
});

test('recommended strategy is generated from risk and layer context', () => {
  const strategies = getRecommendedStrategy(
    input({
      riskScore: 70,
      usageCount: 8,
      indirectDependents: ['a', 'b', 'c', 'd'],
      dependencyDepth: 2,
      layersAffected: ['api', 'auth', 'database'],
    })
  );

  assert.deepEqual(strategies, [
    'add tests before modifying',
    'avoid breaking API contracts',
    'consider wrapper instead of direct modification',
    'refactor incrementally',
    'validate authentication and session behavior',
    'verify data consistency before release',
  ]);
});

test('suggested tests are derived from target patterns and layers', () => {
  const tests = getSuggestedTests(
    input({
      target: 'loginPaymentRequest',
      layersAffected: ['auth', 'api', 'database'],
    })
  );

  assert.deepEqual(tests, [
    'valid login',
    'invalid credentials',
    'expired session',
    'successful payment',
    'failed payment',
    'duplicate payment prevention',
    'successful fetch',
    'network error handling',
    'empty response handling',
    'authorized access',
    'unauthorized access',
    'response status',
    'error handling',
    'data consistency',
    'transaction rollback',
  ]);
});

test('change guidance includes contextual risky changes', () => {
  const guidance = getChangeGuidance(
    input({
      layersAffected: ['api', 'auth', 'database'],
      entryPoints: ['src/app/api/users/route.ts'],
      isCritical: true,
    })
  );

  assert.deepEqual(guidance.safe_changes, [
    'internal logic refactors',
    'logging additions',
    'performance improvements without signature changes',
  ]);
  assert.deepEqual(guidance.risky_changes, [
    'changing return types',
    'modifying function signatures',
    'changing external API behavior',
    'altering authentication or authorization logic',
    'altering database writes or schema assumptions',
    'changing critical path control flow',
  ]);
});

test('top dependents ranks entry points, critical layers, usage, then path', () => {
  const topDependents = getTopDependents(
    input({
      dependents: [
        { path: 'src/lib/z.ts', usageCount: 3, isEntryPoint: false, layers: ['core'] },
        { path: 'src/app/api/users/route.ts', usageCount: 1, isEntryPoint: true, layers: ['api'] },
        { path: 'src/auth/session.ts', usageCount: 4, isEntryPoint: false, layers: ['auth'] },
        { path: 'src/db/users.ts', usageCount: 2, isEntryPoint: false, layers: ['database'] },
        { path: 'src/lib/a.ts', usageCount: 3, isEntryPoint: false, layers: ['core'] },
        { path: 'src/lib/unused.ts', usageCount: 0, isEntryPoint: false, layers: [] },
      ],
    })
  );

  assert.deepEqual(topDependents, [
    'src/app/api/users/route.ts',
    'src/auth/session.ts',
    'src/db/users.ts',
    'src/lib/a.ts',
    'src/lib/z.ts',
  ]);
});
