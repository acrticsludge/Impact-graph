import test from 'node:test';
import assert from 'node:assert/strict';
import { extractProjectSymbols } from '../../src/analyzer/scanner.js';

const files = new Map<string, string>([
  [
    'src/auth/session.ts',
    `export function loginUser() { return true; }
     export function logoutUser() { return true; }`,
  ],
  [
    'src/app/api/route.ts',
    `import { loginUser } from '../auth/session.js';
     export function POST() { return loginUser(); }`,
  ],
  [
    'src/auth/session.test.ts',
    `export function testHelper() {}`,
  ],
]);

test('extractProjectSymbols finds exported symbols from non-test files', () => {
  const symbols = extractProjectSymbols(files);
  const names = symbols.map(s => s.name);

  assert.ok(names.includes('loginUser'), 'loginUser should be found');
  assert.ok(names.includes('logoutUser'), 'logoutUser should be found');
  assert.ok(names.includes('POST'), 'POST should be found');
  assert.ok(!names.includes('testHelper'), 'testHelper from .test.ts should be excluded');
});

test('extractProjectSymbols sorts by risk_score descending', () => {
  const symbols = extractProjectSymbols(files);
  for (let i = 1; i < symbols.length; i++) {
    assert.ok(
      symbols[i - 1].risk_score >= symbols[i].risk_score,
      `symbols should be sorted by risk_score desc`
    );
  }
});

test('extractProjectSymbols includes usage_count reflecting callers', () => {
  const symbols = extractProjectSymbols(files);
  const loginUser = symbols.find(s => s.name === 'loginUser');
  assert.ok(loginUser !== undefined);
  assert.equal(loginUser.usage_count, 1, 'loginUser is called once');
});

test('extractProjectSymbols respects MAX_SYMBOLS cap', () => {
  const manyFiles = new Map<string, string>();
  for (let i = 0; i < 250; i++) {
    manyFiles.set(`src/module${i}.ts`, `export function fn${i}() {}`);
  }
  const symbols = extractProjectSymbols(manyFiles);
  assert.ok(symbols.length <= 200, `should cap at 200, got ${symbols.length}`);
});
