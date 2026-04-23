import { describe, it } from 'node:test';
import assert from 'node:assert';
import { extractSymbols, parseFile } from '../../src/analyzer/ast.js';

describe('AST Module', () => {
  it('parses a TypeScript file and returns AST', () => {
    const code = `
      export function foo() { return 42; }
      const bar = () => foo();
    `;
    const result = parseFile(code);
    assert.ok(result !== undefined);
    assert.ok(result.sourceFile !== undefined);
  });

  it('extracts exported functions', () => {
    const code = `
      export function foo() { return 42; }
      export const bar = () => foo();
      function internal() { return 1; }
    `;
    const symbols = extractSymbols(code);
    assert.strictEqual(symbols.functions.length, 3);
    assert.ok(symbols.functions.find(f => f.name === 'foo' && f.isExported));
    assert.ok(symbols.functions.find(f => f.name === 'bar' && f.isExported));
    assert.ok(symbols.functions.find(f => f.name === 'internal' && !f.isExported));
  });

  it('extracts imported modules', () => {
    const code = `
      import { foo } from './foo';
      import * as utils from './utils';
      import type { Config } from './types';
    `;
    const symbols = extractSymbols(code);
    assert.strictEqual(symbols.imports.length, 3);
    assert.ok(symbols.imports.find(i => i.moduleName === './foo'));
    assert.ok(symbols.imports.find(i => i.moduleName === './utils'));
    assert.ok(symbols.imports.find(i => i.moduleName === './types'));
  });

  it('extracts function calls within a file', () => {
    const code = `
      function caller() {
        foo();
        bar.baz();
        return helper(1, 2);
      }
    `;
    const symbols = extractSymbols(code);
    assert.ok(symbols.calls.some(c => c.name === 'foo'));
    assert.ok(symbols.calls.some(c => c.name === 'helper'));
  });

  it('extracts class definitions and methods', () => {
    const code = `
      export class UserService {
        getUser(id: string) { return null; }
        createUser(data: any) { return null; }
      }
    `;
    const symbols = extractSymbols(code);
    assert.strictEqual(symbols.classes.length, 1);
    assert.strictEqual(symbols.classes[0].name, 'UserService');
    assert.strictEqual(symbols.classes[0].methods.length, 2);
  });
});
