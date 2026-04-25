import { extractSymbols } from './ast.js';
import { DependencyGraph } from './graph.js';

export interface LocalCall {
  name: string;
  line: number;
}

export interface ImportInfo {
  moduleName: string;
  isLocal: boolean;
  symbols: string[];
}

export interface ReExport {
  from: string;
  symbols: string[];
}

export interface FileUsage {
  filePath: string;
  localCalls: LocalCall[];
  imports: ImportInfo[];
  reExports: ReExport[];
  exportedSymbols: string[];
}

export function analyzeUsage(code: string, filePath: string): FileUsage {
  const symbols = extractSymbols(code);

  const localCalls: LocalCall[] = symbols.calls.map(call => ({
    name: call.name,
    line: code.substring(0, call.startOffset).split('\n').length,
  }));

  const imports: ImportInfo[] = symbols.imports.map(imp => ({
    moduleName: imp.moduleName,
    isLocal: imp.moduleName.startsWith('.'),
    symbols: [...imp.namedImports, ...(imp.defaultImport ? [imp.defaultImport] : [])],
  }));

  const reExports: ReExport[] = [];
  const exportedSymbols: string[] = [
    ...symbols.functions.filter(f => f.isExported).map(f => f.name),
    ...symbols.classes.filter(c => c.isExported).map(c => c.name),
  ];

  return { filePath, localCalls, imports, reExports, exportedSymbols };
}

export function buildFileGraph(files: Map<string, string>): DependencyGraph {
  const graph = new DependencyGraph();

  for (const [filePath, content] of files) {
    graph.addNode(filePath);
    const usage = analyzeUsage(content, filePath);

    for (const imp of usage.imports) {
      if (imp.isLocal) {
        const resolvedPath = resolveImport(filePath, imp.moduleName);
        if (resolvedPath) {
          graph.addEdge(filePath, resolvedPath);
        }
      }
    }
  }

  return graph;
}

function resolveImport(fromFile: string, importPath: string): string | null {
  const dir = fromFile.substring(0, fromFile.lastIndexOf('/'));
  if (!importPath.startsWith('./') && !importPath.startsWith('../')) return null;
  let resolved = `${dir}/${importPath}`;
  if (!resolved.endsWith('.ts')) resolved += '.ts';
  return resolved;
}
