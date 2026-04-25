import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';

export async function readProjectFiles(filePaths: string[]): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  for (const filePath of filePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      files.set(filePath, content);
    } catch {
      // skip unreadable files
    }
  }

  return files;
}

export function findTypeScriptFiles(
  rootDir: string,
  exclude: string[] = ['node_modules', 'dist', '.git']
): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    const entries = fsSync.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (exclude.some(ex => fullPath.includes(ex))) continue;
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && /\.tsx?$/.test(entry.name)) results.push(fullPath);
    }
  }

  walk(rootDir);
  return results;
}
