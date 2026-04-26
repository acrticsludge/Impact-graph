import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { analyzeImpact } from '../mcp/tools/analyzeImpact.js';
import { extractProjectSymbols, ProjectSymbol } from '../analyzer/scanner.js';
import { findTypeScriptFiles, readProjectFiles } from '../analyzer/fs.js';
import { ImpactGraph } from '../graph/graphTypes.js';
import { openInBrowser } from './browser.js';

export interface SymbolData {
  name: string;
  risk_score: number;
  layer: string;
  usage_count: number;
  graph: ImpactGraph;
}

export async function analyzeAllSymbolsFromFiles(
  symbols: ProjectSymbol[],
  files: Map<string, string>
): Promise<SymbolData[]> {
  const results: SymbolData[] = [];
  for (const sym of symbols) {
    const result = await analyzeImpact(sym.name, files);
    results.push({
      name: sym.name,
      risk_score: result.risk_score,
      layer: sym.layer,
      usage_count: sym.usage_count,
      graph: result.graph,
    });
  }
  return results;
}

export async function analyzeAllSymbols(rootDir: string): Promise<SymbolData[]> {
  const filePaths = findTypeScriptFiles(rootDir, ['node_modules', 'dist', '.git']);
  const files = await readProjectFiles(filePaths);
  const symbols = extractProjectSymbols(files);
  return analyzeAllSymbolsFromFiles(symbols, files);
}

export async function runVisualizeAll(rootDir: string): Promise<void> {
  console.log('Scanning project symbols...');
  const symbols = await analyzeAllSymbols(rootDir);
  if (symbols.length === 0) {
    console.error('No exported symbols found in project.');
    process.exitCode = 1;
    return;
  }
  console.log(`Analyzed ${symbols.length} symbols. Generating visualization...`);
  const html = renderProjectHtml(symbols);
  const filePath = path.join(os.tmpdir(), `impact-graph-project-${Date.now()}.html`);
  await fs.writeFile(filePath, html, 'utf-8');

  try {
    await openInBrowser(filePath);
    console.log(`Opened project visualization: ${filePath}`);
  } catch (error) {
    console.error(`Could not open browser: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`Open this file manually: ${filePath}`);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return replacements[char];
  });
}

export function renderProjectHtml(symbols: SymbolData[]): string {
  const dataJson = JSON.stringify(
    symbols.map(s => ({
      name: escapeHtml(s.name),
      risk_score: s.risk_score,
      layer: escapeHtml(s.layer),
      usage_count: s.usage_count,
      graph: s.graph,
    }))
  ).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Impact Graph - Project Overview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #111827; color: #f9fafb; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    header { padding: 12px 20px; border-bottom: 1px solid #374151; flex-shrink: 0; }
    h1 { margin: 0; font-size: 16px; font-weight: 600; }
    .subtitle { color: #9ca3af; font-size: 12px; margin-top: 2px; }
    .layout { display: flex; flex: 1; overflow: hidden; }
    .sidebar { width: 280px; border-right: 1px solid #374151; display: flex; flex-direction: column; flex-shrink: 0; }
    .search-wrap { padding: 10px; border-bottom: 1px solid #374151; }
    input[type=search] { width: 100%; background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 6px 10px; color: #f9fafb; font-size: 13px; outline: none; }
    input[type=search]:focus { border-color: #6366f1; }
    .symbol-list { flex: 1; overflow-y: auto; }
    .symbol-item { padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #1f2937; }
    .symbol-item:hover { background: #1f2937; }
    .symbol-item.active { background: #312e81; }
    .risk-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .risk-high { background: #ef4444; }
    .risk-moderate { background: #facc15; }
    .risk-low { background: #22c55e; }
    .symbol-name { font-size: 13px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .layer-badge { font-size: 10px; color: #9ca3af; background: #1f2937; padding: 1px 5px; border-radius: 3px; flex-shrink: 0; }
    .graph-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .graph-header { padding: 10px 16px; border-bottom: 1px solid #374151; font-size: 13px; color: #d1d5db; flex-shrink: 0; }
    svg { display: block; flex: 1; width: 100%; height: 100%; }
    .edge { stroke: #6b7280; stroke-width: 1.5; }
    .edge-imports { stroke-dasharray: 5,3; }
    circle { stroke: #111827; stroke-width: 2; cursor: pointer; }
    text { fill: #f9fafb; font-size: 11px; pointer-events: none; paint-order: stroke; stroke: #111827; stroke-width: 3px; stroke-linejoin: round; }
  </style>
</head>
<body>
  <header>
    <h1>Impact Graph — Project Overview</h1>
    <div class="subtitle" id="subtitle"></div>
  </header>
  <div class="layout">
    <div class="sidebar">
      <div class="search-wrap">
        <input type="search" id="search" placeholder="Search symbols..." autocomplete="off">
      </div>
      <div class="symbol-list" id="symbol-list"></div>
    </div>
    <div class="graph-panel">
      <div class="graph-header" id="graph-header">Select a symbol to view its dependency graph</div>
      <svg id="graph" role="img" aria-label="Dependency graph"></svg>
    </div>
  </div>
  <script>
    const ALL_SYMBOLS = ${dataJson};
    const colors = { high: '#ef4444', moderate: '#facc15', low: '#22c55e' };
    let activeIndex = -1;
    let filtered = [];

    const subtitleEl = document.getElementById('subtitle');
    const searchEl = document.getElementById('search');
    const listEl = document.getElementById('symbol-list');
    const graphHeader = document.getElementById('graph-header');
    const svg = document.getElementById('graph');

    subtitleEl.textContent = ALL_SYMBOLS.length + ' symbols analyzed';

    function riskLevel(score) {
      if (score >= 50) return 'high';
      if (score >= 25) return 'moderate';
      return 'low';
    }

    ALL_SYMBOLS.forEach((sym, i) => {
      sym._origIndex = i;
      sym.risk_level = riskLevel(sym.risk_score);
    });

    function renderList() {
      listEl.innerHTML = '';
      filtered.forEach(sym => {
        const item = document.createElement('div');
        item.className = 'symbol-item' + (sym._origIndex === activeIndex ? ' active' : '');
        const dot = document.createElement('div');
        dot.className = 'risk-dot risk-' + sym.risk_level;
        const nameEl = document.createElement('div');
        nameEl.className = 'symbol-name';
        nameEl.title = sym.name;
        nameEl.textContent = sym.name;
        const badge = document.createElement('div');
        badge.className = 'layer-badge';
        badge.textContent = sym.layer;
        item.appendChild(dot);
        item.appendChild(nameEl);
        item.appendChild(badge);
        item.addEventListener('click', () => {
          listEl.querySelectorAll('.symbol-item').forEach(el => el.classList.remove('active'));
          item.classList.add('active');
          selectSymbol(sym._origIndex);
        });
        listEl.appendChild(item);
      });
    }

    function selectSymbol(index) {
      activeIndex = index;
      const sym = ALL_SYMBOLS[index];
      graphHeader.textContent = sym.name + '  |  risk: ' + sym.risk_score + '/100  |  callers: ' + sym.usage_count + '  |  layer: ' + sym.layer;
      renderGraph(sym.graph, sym.name);
    }

    function renderGraph(graph, target) {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const rect = svg.getBoundingClientRect();
      const width = rect.width || 800;
      const height = rect.height || 500;
      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.max(100, Math.min(width, height) / 2.8);
      const nodes = graph.nodes.map((node, idx) => {
        if (node.id === target) return { ...node, x: cx, y: cy };
        const angle = ((idx - 1) / Math.max(1, graph.nodes.length - 1)) * Math.PI * 2;
        return { ...node, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
      });
      const byId = new Map(nodes.map(n => [n.id, n]));
      for (const edge of graph.edges) {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        if (!from || !to) continue;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'edge' + (edge.type === 'imports' ? ' edge-imports' : ''));
        line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
        line.setAttribute('x2', to.x); line.setAttribute('y2', to.y);
        svg.appendChild(line);
      }
      for (const node of nodes) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', node.x); circle.setAttribute('cy', node.y);
        circle.setAttribute('r', node.id === target ? '14' : '10');
        circle.setAttribute('fill', colors[node.risk] || colors.low);
        if (node.id === target) circle.setAttribute('stroke', '#ffffff');
        circle.addEventListener('click', () => alert(node.label + '\\n' + node.id + '\\nLayer: ' + node.layer + '\\nRisk: ' + node.risk));
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', node.x + 15); label.setAttribute('y', node.y + 4);
        label.textContent = node.label;
        g.appendChild(circle);
        g.appendChild(label);
        svg.appendChild(g);
      }
    }

    searchEl.addEventListener('input', () => {
      const q = searchEl.value.toLowerCase();
      filtered = q
        ? ALL_SYMBOLS.filter(s => s.name.toLowerCase().includes(q) || s.layer.toLowerCase().includes(q))
        : ALL_SYMBOLS.slice();
      renderList();
    });

    filtered = ALL_SYMBOLS.slice();
    renderList();
    if (ALL_SYMBOLS.length > 0) {
      selectSymbol(0);
      const firstItem = listEl.querySelector('.symbol-item');
      if (firstItem) firstItem.classList.add('active');
    }
  </script>
</body>
</html>`;
}
