import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeImpact } from '../../../src/mcp/tools/analyzeImpact.js';

test('analyzeImpact returns existing fields and decision guidance', async () => {
  const files = new Map<string, string>([
    [
      'src/auth/session.ts',
      `
      export function loginUser() {
        return true;
      }
      `,
    ],
    [
      'src/app/api/login/route.ts',
      `
      export function POST() {
        return loginUser();
      }
      `,
    ],
    [
      'src/db/audit.ts',
      `
      export function auditLogin() {
        return loginUser();
      }
      `,
    ],
    [
      'src/lib/wrapper.ts',
      `
      export function wrappedLogin() {
        return loginUser();
      }
      `,
    ],
  ]);

  const result = await analyzeImpact('loginUser', files);

  assert.equal(result.target, 'loginUser');
  assert.equal(result.usage_count, 3);
  assert.ok(result.direct_dependents.includes('src/app/api/login/route.ts'));
  assert.ok(result.direct_dependents.includes('src/db/audit.ts'));
  assert.ok(result.risk_score >= 0);
  assert.ok(Array.isArray(result.risk_factors));
  assert.deepEqual(result.entry_points, ['src/app/api/login/route.ts']);
  assert.ok(result.layers_affected.includes('auth'));
  assert.ok(result.layers_affected.includes('api'));
  assert.ok(result.layers_affected.includes('database'));
  assert.equal(typeof result.is_critical, 'boolean');

  assert.equal(result.impact_summary.primary_concern, 'affects authentication flow');
  assert.match(result.impact_summary.severity, /low|moderate|high|critical/);
  assert.match(result.impact_summary.blast_radius, /narrow|medium|wide/);
  assert.ok(result.recommended_strategy.includes('avoid breaking API contracts'));
  assert.ok(result.suggested_tests.includes('valid login'));
  assert.ok(result.suggested_tests.includes('response status'));
  assert.ok(result.suggested_tests.includes('data consistency'));
  assert.ok(result.safe_changes.includes('internal logic refactors'));
  assert.ok(result.risky_changes.includes('altering authentication or authorization logic'));
  assert.ok(result.top_dependents.length <= 5);
});
