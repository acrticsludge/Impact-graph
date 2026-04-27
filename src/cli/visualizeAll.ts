import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { analyzeImpact, ImpactAnalysisResult } from '../mcp/tools/analyzeImpact.js';
import { extractProjectSymbols, ProjectSymbol } from '../analyzer/scanner.js';
import { findTypeScriptFiles, readProjectFiles } from '../analyzer/fs.js';
import { openInBrowser } from './browser.js';
import { escapeHtml, PANEL_STYLES, PANEL_RENDERER_JS } from './panelTemplate.js';
import { BASE_URL, ensureServer, pushHtml } from './devServer.js';

export interface SymbolData {
  name: string;
  risk_score: number;
  layer: string;
  usage_count: number;
  result: ImpactAnalysisResult;
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
      result,
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

  if (process.env['IMPACT_GRAPH_NO_SERVER'] === '1') return;

  const html = renderProjectHtml(symbols);
  try {
    const justStarted = await ensureServer();
    await pushHtml(html);
    if (justStarted) {
      await openInBrowser(BASE_URL);
      console.log(`Opened project visualization: ${BASE_URL}`);
    } else {
      console.log(`Updated visualization at ${BASE_URL}`);
    }
  } catch (error) {
    console.error(`Could not start visualization server: ${error instanceof Error ? error.message : String(error)}`);
    const filePath = path.join(os.tmpdir(), `impact-graph-project-${Date.now()}.html`);
    await fs.writeFile(filePath, html, 'utf-8');
    console.error(`Falling back to file: ${filePath}`);
    try { await openInBrowser(filePath); } catch { /* ignore */ }
  }
}

export function renderProjectHtml(symbols: SymbolData[]): string {
  const dataJson = JSON.stringify(
    symbols.map(s => ({
      name: escapeHtml(s.name),
      risk_score: s.risk_score,
      layer: escapeHtml(s.layer),
      usage_count: s.usage_count,
      result: s.result,
    }))
  ).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Impact Graph - Project Overview</title>
  <style>
${PANEL_STYLES}

    /* ── project-page sidebar ── */
    .layout { display: flex; flex: 1; overflow: hidden; }
    .sidebar { width: 280px; border-right: 1px solid #1e293b; display: flex; flex-direction: column; flex-shrink: 0; }
    .search-wrap { padding: 10px; border-bottom: 1px solid #1e293b; }
    input[type=search] { width: 100%; background: #1e293b; border: 1px solid #334155;
                         border-radius: 6px; padding: 6px 10px; color: #f9fafb; font-size: 13px; outline: none; }
    input[type=search]:focus { border-color: #3b82f6; }
    .symbol-list { flex: 1; overflow-y: auto; }
    .symbol-item { padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px;
                   border-bottom: 1px solid #0f172a; }
    .symbol-item:hover { background: #1e293b; }
    .symbol-item.active { background: #1e3a5f; }
    .risk-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .risk-high { background: #ef4444; }
    .risk-moderate { background: #f97316; }
    .risk-low { background: #22c55e; }
    .symbol-name { font-size: 13px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .layer-badge { font-size: 10px; color: #64748b; background: #1e293b; padding: 1px 6px;
                   border-radius: 3px; flex-shrink: 0; border: 1px solid #334155; }

    /* ── inner right area (graph + panel) ── */
    .inner-main { display: flex; flex: 1; overflow: hidden; }

    /* placeholder when nothing selected */
    .placeholder { display: flex; align-items: center; justify-content: center;
                   flex: 1; color: #475569; font-size: 14px; }
  </style>
</head>
<body>
  <header>
    <h1 style="margin:0;font-size:15px;font-weight:700;color:#f1f5f9">Impact Graph — Project Overview</h1>
    <span class="h-meta" id="subtitle"></span>
  </header>

  <div class="layout">
    <div class="sidebar">
      <div class="search-wrap">
        <input type="search" id="search" placeholder="Search symbols…" autocomplete="off">
      </div>
      <div class="symbol-list" id="symbol-list"></div>
    </div>

    <div class="inner-main" id="inner-main">
      <div class="placeholder">Select a symbol from the sidebar to view its impact graph and analysis</div>
    </div>
  </div>

<script>
${PANEL_RENDERER_JS}

  var ALL_SYMBOLS = ${dataJson};
  var activeIndex = -1;
  var graphMode   = 'full';
  var svg, tip, headerEl, panelEl;

  document.getElementById('subtitle').textContent = ALL_SYMBOLS.length + ' symbols analyzed';

  function riskLevel(score) {
    return score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low';
  }

  ALL_SYMBOLS.forEach(function(sym, i) {
    sym._origIndex = i;
    sym.risk_level = riskLevel(sym.risk_score);
  });

  var filtered = ALL_SYMBOLS.slice();

  /* ── build main pane once on first select ── */
  function ensureMainPane() {
    if (svg) return;
    var inner = document.getElementById('inner-main');
    inner.innerHTML =
      '<header id="h-bar" style="flex-shrink:0"></header>' +
      '<div class="main" style="flex:1;overflow:hidden">' +
        '<div class="graph-wrap">' +
          '<div class="graph-toggle">' +
            '<button class="tb active" id="btn-full"  onclick="switchGraph(\\'full\\')">Full Graph</button>' +
            '<button class="tb"        id="btn-focus" onclick="switchGraph(\\'focus\\')">Focus Graph</button>' +
          '</div>' +
          '<svg class="gsvg" id="gsvg" role="img" aria-label="Dependency graph"></svg>' +
          '<div class="graph-legend">' +
            '<div class="leg"><div class="leg-dot" style="background:#ef4444"></div>High risk</div>' +
            '<div class="leg"><div class="leg-dot" style="background:#f97316"></div>Moderate</div>' +
            '<div class="leg"><div class="leg-dot" style="background:#22c55e"></div>Low risk</div>' +
          '</div>' +
          '<div class="tip" id="tip"></div>' +
        '</div>' +
        '<div class="panel" id="panel"></div>' +
      '</div>';
    svg      = document.getElementById('gsvg');
    tip      = document.getElementById('tip');
    headerEl = document.getElementById('h-bar');
    panelEl  = document.getElementById('panel');
    window.addEventListener('resize', function() {
      if (activeIndex >= 0) {
        var sym = ALL_SYMBOLS[activeIndex];
        var g = graphMode === 'focus' ? sym.result.focus_graph : sym.result.graph;
        renderGraph(g, sym.result.target, svg, tip);
      }
    });
  }

  function switchGraph(mode) {
    graphMode = mode;
    document.getElementById('btn-full').classList.toggle('active',  mode === 'full');
    document.getElementById('btn-focus').classList.toggle('active', mode === 'focus');
    if (activeIndex < 0) return;
    var sym = ALL_SYMBOLS[activeIndex];
    renderGraph(mode === 'focus' ? sym.result.focus_graph : sym.result.graph, sym.result.target, svg, tip);
  }

  function selectSymbol(index) {
    ensureMainPane();
    activeIndex = index;
    var sym = ALL_SYMBOLS[index];
    renderHeader(sym.result, headerEl);
    renderPanel(sym.result, panelEl);
    var g = graphMode === 'focus' ? sym.result.focus_graph : sym.result.graph;
    renderGraph(g, sym.result.target, svg, tip);
  }

  /* ── sidebar ── */
  var listEl   = document.getElementById('symbol-list');
  var searchEl = document.getElementById('search');

  function renderList() {
    listEl.innerHTML = '';
    filtered.forEach(function(sym) {
      var item = document.createElement('div');
      item.className = 'symbol-item' + (sym._origIndex === activeIndex ? ' active' : '');

      var dot = document.createElement('div');
      dot.className = 'risk-dot risk-' + sym.risk_level;

      var nameEl = document.createElement('div');
      nameEl.className = 'symbol-name';
      nameEl.title = sym.name;
      nameEl.textContent = sym.name;

      var badge = document.createElement('div');
      badge.className = 'layer-badge';
      badge.textContent = sym.layer;

      item.appendChild(dot);
      item.appendChild(nameEl);
      item.appendChild(badge);
      item.addEventListener('click', function() {
        listEl.querySelectorAll('.symbol-item').forEach(function(el) { el.classList.remove('active'); });
        item.classList.add('active');
        selectSymbol(sym._origIndex);
      });
      listEl.appendChild(item);
    });
  }

  searchEl.addEventListener('input', function() {
    var q = searchEl.value.toLowerCase();
    filtered = q
      ? ALL_SYMBOLS.filter(function(s) { return s.name.toLowerCase().includes(q) || s.layer.toLowerCase().includes(q); })
      : ALL_SYMBOLS.slice();
    renderList();
  });

  renderList();
  if (ALL_SYMBOLS.length > 0) {
    selectSymbol(0);
    var firstItem = listEl.querySelector('.symbol-item');
    if (firstItem) firstItem.classList.add('active');
  }
</script>
</body>
</html>`;
}
