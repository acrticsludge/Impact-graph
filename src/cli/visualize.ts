import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { analyzeImpactForPath, ImpactAnalysisResult } from '../mcp/tools/analyzeImpact.js';
import { openInBrowser } from './browser.js';
import { runVisualizeAll } from './visualizeAll.js';
import { escapeHtml, PANEL_STYLES, PANEL_RENDERER_JS } from './panelTemplate.js';
import { BASE_URL, ensureServer, pushHtml } from './devServer.js';

export async function runVisualize(args: string[] = process.argv.slice(3)): Promise<void> {
  const target = args[0];
  if (!target) {
    await runVisualizeAll(process.cwd());
    return;
  }

  const result = await analyzeImpactForPath(target, process.cwd());
  console.log(renderGraphSummary(result));

  if (process.env['IMPACT_GRAPH_NO_SERVER'] === '1') return;

  const html = renderGraphHtml(result);
  try {
    const justStarted = await ensureServer();
    await pushHtml(html);
    if (justStarted) {
      await openInBrowser(BASE_URL);
      console.log(`Opened graph visualization: ${BASE_URL}`);
    } else {
      console.log(`Updated visualization at ${BASE_URL}`);
    }
  } catch (error) {
    console.error(`Could not start visualization server: ${error instanceof Error ? error.message : String(error)}`);
    const htmlPath = await writeGraphHtml(result);
    console.error(`Falling back to file: ${htmlPath}`);
    try { await openInBrowser(htmlPath); } catch { /* ignore */ }
  }
}

export async function writeGraphHtml(result: ImpactAnalysisResult): Promise<string> {
  const filePath = path.join(os.tmpdir(), `impact-graph-${safeFileName(result.target)}-${Date.now()}.html`);
  await fs.writeFile(filePath, renderGraphHtml(result), 'utf-8');
  return filePath;
}

export function renderGraphSummary(result: ImpactAnalysisResult): string {
  const lines = [
    `Impact graph for ${result.target}`,
    `Risk: ${result.impact_summary.severity} (${result.risk_score}/100), blast radius: ${result.impact_summary.blast_radius}`,
    `Nodes: ${result.graph.nodes.length}, edges: ${result.graph.edges.length}`,
  ];

  for (const edge of result.graph.edges.slice(0, 12)) {
    lines.push(`  ${edge.from} -[${edge.type}]-> ${edge.to}`);
  }

  if (result.graph.edges.length > 12) {
    lines.push(`  ... ${result.graph.edges.length - 12} more edges`);
  }

  return lines.join('\n');
}

export function renderGraphHtml(result: ImpactAnalysisResult): string {
  const fullGraph  = JSON.stringify(result.graph).replace(/</g, '\\u003c');
  const focusGraph = JSON.stringify(result.focus_graph).replace(/</g, '\\u003c');
  const resultJson = JSON.stringify(result).replace(/</g, '\\u003c');
  const targetJson = JSON.stringify(result.target).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Impact Graph — ${escapeHtml(result.target)}</title>
  <style>${PANEL_STYLES}</style>
</head>
<body>
<header id="h-bar"></header>

<div class="main">
  <div class="graph-wrap">
    <div class="graph-toggle">
      <button class="tb active" id="btn-full"  onclick="switchGraph('full')">Full Graph</button>
      <button class="tb"        id="btn-focus" onclick="switchGraph('focus')">Focus Graph</button>
    </div>
    <button class="panel-btn" id="panel-btn" onclick="togglePanel()" title="Toggle analysis panel">⊟</button>
    <svg class="gsvg" id="gsvg" role="img" aria-label="Dependency graph"></svg>
    <div class="graph-legend">
      <div class="leg"><div class="leg-dot" style="background:#ef4444"></div>High risk</div>
      <div class="leg"><div class="leg-dot" style="background:#f97316"></div>Moderate</div>
      <div class="leg"><div class="leg-dot" style="background:#22c55e"></div>Low risk</div>
    </div>
    <div class="tip" id="tip"></div>
  </div>

  <div class="panel" id="panel"></div>
</div>

<script>
${PANEL_RENDERER_JS}

  const fullGraph = ${fullGraph};
  const focusGraph = ${focusGraph};
  const result = ${resultJson};
  const target = ${targetJson};

  const svg     = document.getElementById('gsvg');
  const tip     = document.getElementById('tip');
  const headerEl = document.getElementById('h-bar');
  const panelEl  = document.getElementById('panel');

  let currentGraph = fullGraph;

  renderHeader(result, headerEl);
  renderPanel(result, panelEl);
  renderGraph(currentGraph, target, svg, tip);

  function switchGraph(mode) {
    document.getElementById('btn-full').classList.toggle('active',  mode === 'full');
    document.getElementById('btn-focus').classList.toggle('active', mode === 'focus');
    currentGraph = mode === 'focus' ? focusGraph : fullGraph;
    renderGraph(currentGraph, target, svg, tip);
  }

  window.addEventListener('resize', function() { renderGraph(currentGraph, target, svg, tip); });
</script>
</body>
</html>`;
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'target';
}
