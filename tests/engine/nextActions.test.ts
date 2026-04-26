import test from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions, NextActionsInput } from '../../src/engine/nextActions.js';

function input(overrides: Partial<NextActionsInput> = {}): NextActionsInput {
  return {
    risk_score: 10,
    usage_count: 1,
    direct_dependents: [],
    indirect_dependents: [],
    entry_points: [],
    layers_affected: [],
    ...overrides,
  };
}

test('high risk_score emits regression test recommendations', () => {
  const actions = generateNextActions(input({ risk_score: 71 }));
  assert.ok(actions.includes('Add regression tests before modifying this code'));
  assert.ok(actions.includes('Make incremental changes instead of large refactors'));
});

test('risk_score at or below 70 does not emit regression recommendations', () => {
  const actions = generateNextActions(input({ risk_score: 70 }));
  assert.ok(!actions.includes('Add regression tests before modifying this code'));
});

test('api layer adds API-specific actions', () => {
  const actions = generateNextActions(input({ layers_affected: ['api'] }));
  assert.ok(actions.includes('Avoid breaking API contracts (request/response shape)'));
  assert.ok(actions.includes('Verify all endpoints using this function'));
});

test('auth layer adds auth-specific actions', () => {
  const actions = generateNextActions(input({ layers_affected: ['auth'] }));
  assert.ok(actions.includes('Test authentication flows thoroughly after changes'));
  assert.ok(actions.includes('Ensure session and token handling remain intact'));
});

test('database layer adds db-specific actions', () => {
  const actions = generateNextActions(input({ layers_affected: ['database'] }));
  assert.ok(actions.includes('Validate data consistency after modification'));
  assert.ok(actions.includes('Check for unintended data mutations'));
});

test('usage_count > 20 adds usage actions', () => {
  const actions = generateNextActions(input({ usage_count: 21 }));
  assert.ok(actions.includes('Refactor incrementally to avoid widespread breakage'));
  assert.ok(actions.includes('Search for all usages before modifying'));
});

test('many dependents (>5 combined) adds wrapper/signature actions', () => {
  const actions = generateNextActions(input({
    direct_dependents: ['a', 'b', 'c'],
    indirect_dependents: ['d', 'e', 'f'],
  }));
  assert.ok(actions.includes('Consider creating a wrapper instead of modifying directly'));
  assert.ok(actions.includes('Update dependents carefully if changing function signature'));
});

test('entry points present adds user-facing flow action', () => {
  const actions = generateNextActions(input({ entry_points: ['src/app/api/route.ts'] }));
  assert.ok(actions.includes('Test all user-facing flows that rely on this function'));
});

test('multiple conditions combine, dedupe, and cap at 7', () => {
  const actions = generateNextActions(input({
    risk_score: 90,
    usage_count: 25,
    layers_affected: ['api', 'auth', 'database'],
    direct_dependents: ['a', 'b', 'c'],
    indirect_dependents: ['d', 'e', 'f'],
    entry_points: ['src/app/api/route.ts'],
  }));
  assert.ok(actions.length <= 7);
  assert.equal(actions.length, new Set(actions).size, 'no duplicates');
});

test('empty/low-risk input returns fallback default', () => {
  const actions = generateNextActions(input());
  assert.deepEqual(actions, ['Proceed with the smallest behavior-preserving change']);
});
