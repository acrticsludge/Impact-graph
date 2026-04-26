import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { analyzeImpactForPath, ImpactAnalysisResult } from '../mcp/tools/analyzeImpact.js';
import { openInBrowser } from './browser.js';
import { runVisualizeAll } from './visualizeAll.js';

export async function runVisualize(args: string[] = process.argv.slice(3)): Promise<void> {
  const target = args[0];
  if (!target) {
    await runVisualizeAll(process.cwd());
    return;
  }

  const result = await analyzeImpactForPath(target, process.cwd());
  const htmlPath = await writeGraphHtml(result);
  console.log(renderGraphSummary(result));

  try {
    await openInBrowser(htmlPath);
    console.log(`Opened graph visualization: ${htmlPath}`);
  } catch (error) {
    console.error(`Could not open browser: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`Open this file manually: ${htmlPath}`);
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
  const graphJson = JSON.stringify(result.graph).replace(/</g, '\\u003c');
  const targetJson = JSON.stringify(result.target).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Impact Graph - ${escapeHtml(result.target)}</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #111827; color: #f9fafb; }
    header { padding: 16px 20px; border-bottom: 1px solid #374151; }
    h1 { margin: 0; font-size: 18px; }
    p { margin: 6px 0 0; color: #d1d5db; font-size: 13px; }
    svg { display: block; width: 100vw; height: calc(100vh - 72px); }
    line { stroke: #6b7280; stroke-width: 1.5; }
    circle { stroke: #111827; stroke-width: 2; cursor: pointer; }
    text { fill: #f9fafb; font-size: 12px; pointer-events: none; paint-order: stroke; stroke: #111827; stroke-width: 4px; stroke-linejoin: round; }
  </style>
</head>
<body>
  <header>
    <h1>Impact Graph: ${escapeHtml(result.target)}</h1>
    <p>${escapeHtml(result.impact_summary.severity)} risk, ${escapeHtml(result.impact_summary.blast_radius)} blast radius, ${result.graph.nodes.length} nodes</p>
  </header>
  <svg id="graph" role="img" aria-label="Impact dependency graph"></svg>
  <script>
    const graph = ${graphJson};
    const target = ${targetJson};
    const svg = document.getElementById('graph');
    const width = window.innerWidth;
    const height = window.innerHeight - 72;
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.max(120, Math.min(width, height) / 2.8);
    const colors = { high: '#ef4444', moderate: '#facc15', low: '#22c55e' };
    const nodes = graph.nodes.map((node, index) => {
      if (node.id === target) return { ...node, x: cx, y: cy };
      const angle = ((index - 1) / Math.max(1, graph.nodes.length - 1)) * Math.PI * 2;
      return { ...node, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
    const byId = new Map(nodes.map(node => [node.id, node]));

    for (const edge of graph.edges) {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y);
      svg.appendChild(line);
    }

    for (const node of nodes) {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', node.x);
      circle.setAttribute('cy', node.y);
      circle.setAttribute('r', node.id === target ? '14' : '10');
      circle.setAttribute('fill', colors[node.risk] || colors.low);
      if (node.id === target) circle.setAttribute('stroke', '#ffffff');
      circle.addEventListener('click', () => alert(node.label + '\\n' + node.id + '\\nLayer: ' + node.layer + '\\nRisk: ' + node.risk));
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', node.x + 14);
      label.setAttribute('y', node.y + 4);
      label.textContent = node.label;
      group.appendChild(circle);
      group.appendChild(label);
      svg.appendChild(group);
    }
  </script>
</body>
</html>`;
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'target';
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
