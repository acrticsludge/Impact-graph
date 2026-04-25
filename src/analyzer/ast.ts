import ts from 'typescript';

export interface ParsedFile {
  sourceFile: ts.SourceFile;
}

export interface FunctionSymbol {
  name: string;
  isExported: boolean;
  startOffset: number;
  endOffset: number;
}

export interface ClassSymbol {
  name: string;
  isExported: boolean;
  methods: string[];
  startOffset: number;
  endOffset: number;
}

export interface ImportSymbol {
  moduleName: string;
  namedImports: string[];
  namespaceImport: string | null;
  defaultImport: string | null;
  isTypeOnly: boolean;
}

export interface CallSymbol {
  name: string;
  startOffset: number;
}

export interface ExtractedSymbols {
  functions: FunctionSymbol[];
  classes: ClassSymbol[];
  imports: ImportSymbol[];
  calls: CallSymbol[];
}

export function parseFile(code: string): ParsedFile {
  const sourceFile = ts.createSourceFile(
    'virtual.ts',
    code,
    ts.ScriptTarget.Latest,
    true
  );
  return { sourceFile };
}

export function extractSymbols(code: string): ExtractedSymbols {
  const { sourceFile } = parseFile(code);
  const functions: FunctionSymbol[] = [];
  const classes: ClassSymbol[] = [];
  const imports: ImportSymbol[] = [];
  const calls: CallSymbol[] = [];

  function isExported(node: ts.Node): boolean {
    if (!ts.canHaveModifiers(node)) return false;
    return node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
  }

  function visit(node: ts.Node) {
    // Extract functions (declarations and expressions)
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
      if (node.name) {
        functions.push({
          name: node.name.text,
          isExported: isExported(node),
          startOffset: node.pos,
          endOffset: node.end,
        });
      }
    }

    // Extract arrow functions assigned to variables
    if (ts.isVariableStatement(node)) {
      const isVarExported = isExported(node);
      node.declarationList.declarations.forEach(decl => {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
            functions.push({
              name: decl.name.text,
              isExported: isVarExported,
              startOffset: node.pos,
              endOffset: node.end,
            });
          }
        }
      });
    }

    // Extract classes
    if (ts.isClassDeclaration(node)) {
      if (node.name) {
        const methods: string[] = [];
        node.members.forEach(member => {
          if (ts.isMethodDeclaration(member) && member.name) {
            methods.push(member.name.getText(sourceFile));
          }
        });
        classes.push({
          name: node.name.text,
          isExported: isExported(node),
          methods,
          startOffset: node.pos,
          endOffset: node.end,
        });
      }
    }

    // Extract imports
    if (ts.isImportDeclaration(node)) {
      const importClause = node.importClause;
      const moduleName = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
      const isTypeOnly = importClause?.isTypeOnly ?? false;

      const namedImports: string[] = [];
      let namespaceImport: string | null = null;
      let defaultImport: string | null = null;

      if (importClause) {
        if (importClause.name) {
          defaultImport = importClause.name.text;
        }
        if (importClause.namedBindings) {
          if (ts.isNamedImports(importClause.namedBindings)) {
            importClause.namedBindings.elements.forEach(el => {
              namedImports.push(el.name.text);
            });
          } else if (ts.isNamespaceImport(importClause.namedBindings)) {
            namespaceImport = importClause.namedBindings.name.text;
          }
        }
      }

      imports.push({
        moduleName,
        namedImports,
        namespaceImport,
        defaultImport,
        isTypeOnly,
      });
    }

    // Extract function calls
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      let callName: string | null = null;

      if (ts.isIdentifier(expr)) {
        callName = expr.text;
      } else if (ts.isPropertyAccessExpression(expr)) {
        callName = expr.name.text;
      }

      if (callName) {
        calls.push({
          name: callName,
          startOffset: node.pos,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return { functions, classes, imports, calls };
}
