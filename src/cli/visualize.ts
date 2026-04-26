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
  const fullGraphJson  = JSON.stringify(result.graph).replace(/</g, '\\u003c');
  const focusGraphJson = JSON.stringify(result.focus_graph).replace(/</g, '\\u003c');
  const targetJson     = JSON.stringify(result.target).replace(/</g, '\\u003c');

  const severity  = result.impact_summary.severity;
  const scoreColor =
    severity === 'critical' ? '#ef4444' :
    severity === 'high'     ? '#f97316' :
    severity === 'moderate' ? '#facc15' : '#22c55e';
  const badgeBg =
    severity === 'critical' ? '#450a0a' :
    severity === 'high'     ? '#431407' :
    severity === 'moderate' ? '#422006' : '#052e16';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Impact Graph — ${escapeHtml(result.target)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
           background: #0f172a; color: #e2e8f0; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

    /* ── header ── */
    header { display: flex; align-items: center; gap: 12px; padding: 10px 18px;
             border-bottom: 1px solid #1e293b; flex-shrink: 0; min-height: 52px; flex-wrap: wrap; }
    .h-target { font-size: 15px; font-weight: 700; color: #f1f5f9; }
    .h-badge  { padding: 3px 11px; border-radius: 9999px; font-size: 11px; font-weight: 700;
                letter-spacing: .03em; color: ${scoreColor}; background: ${badgeBg}; border: 1px solid ${scoreColor}40; }
    .h-meta   { margin-left: auto; font-size: 12px; color: #64748b; }

    /* ── layout ── */
    .main { display: flex; flex: 1; overflow: hidden; }

    /* ── graph panel ── */
    .graph-wrap { position: relative; flex: 1; overflow: hidden; background: #080f1e; }
    .graph-toggle { position: absolute; top: 10px; left: 10px; z-index: 10; display: flex;
                    background: #1e293b; border-radius: 8px; padding: 3px; gap: 3px; }
    .tb { padding: 4px 14px; border: none; border-radius: 6px; font-size: 12px; font-weight: 600;
          cursor: pointer; color: #94a3b8; background: transparent; transition: all .15s; }
    .tb.active { background: #3b82f6; color: #fff; }
    .graph-legend { position: absolute; bottom: 12px; left: 12px; display: flex; gap: 10px; }
    .leg { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #64748b; }
    .leg-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    svg#gsvg { width: 100%; height: 100%; display: block; }
    .edge-line { stroke: #334155; stroke-width: 1.5; }
    .edge-line.imports { stroke-dasharray: 5 3; stroke: #475569; }
    .node-circle { cursor: pointer; stroke-width: 2; transition: r .1s; }
    .node-circle:hover { stroke-width: 3; }
    .node-label { fill: #e2e8f0; font-size: 11px; pointer-events: none;
                  paint-order: stroke; stroke: #080f1e; stroke-width: 4px; stroke-linejoin: round; }

    /* ── tooltip ── */
    .tip { position: absolute; background: #1e293b; border: 1px solid #334155; border-radius: 10px;
           padding: 10px 14px; font-size: 12px; pointer-events: none; z-index: 200; display: none;
           max-width: 260px; box-shadow: 0 8px 24px #00000060; }
    .tip.show { display: block; }
    .tip-title { font-weight: 700; color: #f1f5f9; margin-bottom: 6px; word-break: break-all; }
    .tip-row { color: #94a3b8; margin: 3px 0; display: flex; gap: 6px; }
    .tip-key { color: #64748b; flex-shrink: 0; }

    /* ── analysis panel ── */
    .panel { width: 340px; border-left: 1px solid #1e293b; overflow-y: auto; flex-shrink: 0; }
    .panel::-webkit-scrollbar { width: 4px; }
    .panel::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }

    /* stats grid */
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px; }
    .stat { background: #1e293b; border-radius: 8px; padding: 10px 12px; }
    .stat-label { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;
                  letter-spacing: .06em; margin-bottom: 4px; }
    .stat-value { font-size: 20px; font-weight: 800; }
    .stat-sub   { font-size: 12px; font-weight: 600; margin-top: 2px; color: #94a3b8; }

    /* sections */
    .sec { border-top: 1px solid #1e293b; }
    .sec-hdr { display: flex; justify-content: space-between; align-items: center;
               padding: 10px 14px; cursor: pointer; user-select: none; }
    .sec-hdr:hover .sec-title { color: #e2e8f0; }
    .sec-title { font-size: 10px; font-weight: 700; text-transform: uppercase;
                 letter-spacing: .08em; color: #64748b; }
    .sec-arrow { font-size: 10px; color: #475569; transition: transform .2s; }
    .sec-body { padding: 2px 14px 12px; }
    .sec.collapsed .sec-body { display: none; }
    .sec.collapsed .sec-arrow { transform: rotate(-90deg); }

    /* action list */
    .alist { list-style: none; }
    .alist li { display: flex; gap: 8px; padding: 6px 0; font-size: 12px; color: #cbd5e1;
                border-bottom: 1px solid #1e293b15; }
    .alist li:last-child { border-bottom: none; }
    .alist li .arr { color: #3b82f6; flex-shrink: 0; }

    /* tags */
    .tags { display: flex; flex-wrap: wrap; gap: 5px; }
    .tag { padding: 2px 8px; border-radius: 5px; font-size: 11px; font-weight: 600; }
    .tag.api      { background:#1e3a5f; color:#60a5fa; }
    .tag.auth     { background:#3b1f5e; color:#c084fc; }
    .tag.database { background:#14362a; color:#4ade80; }
    .tag.frontend { background:#3d2210; color:#fb923c; }
    .tag.core     { background:#1e293b; color:#94a3b8; }
    .tag.default  { background:#1e293b; color:#94a3b8; }

    /* paths */
    .paths { list-style: none; }
    .paths li { font-size: 11px; color: #64748b; font-family: ui-monospace, "Cascadia Code", "Fira Code", monospace;
                padding: 3px 0; border-bottom: 1px solid #1e293b15; word-break: break-all; }
    .paths li:last-child { border-bottom: none; }
    .paths li.entry { color: #60a5fa; }

    /* change cols */
    .change-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .change-box { background: #1e293b; border-radius: 8px; padding: 10px 12px; }
    .change-box.safe  { border-top: 2px solid #22c55e; }
    .change-box.risky { border-top: 2px solid #ef4444; }
    .cb-title { font-size: 10px; font-weight: 700; text-transform: uppercase;
                letter-spacing: .05em; margin-bottom: 6px; }
    .change-box.safe  .cb-title { color: #22c55e; }
    .change-box.risky .cb-title { color: #ef4444; }
    .cb-item { font-size: 11px; color: #94a3b8; padding: 2px 0; }

    /* risk bar */
    .risk-bar-wrap { background: #1e293b; border-radius: 9999px; height: 6px; margin-top: 6px; }
    .risk-bar { height: 6px; border-radius: 9999px; background: ${scoreColor}; width: ${Math.min(result.risk_score, 100)}%; }

    .empty { color: #475569; font-size: 12px; font-style: italic; }
  </style>
</head>
<body>
<header>
  <span class="h-target">${escapeHtml(result.target)}</span>
  <span class="h-badge">${escapeHtml(severity)} · ${result.risk_score}/100</span>
  <span class="h-meta">${result.usage_count} usages &nbsp;·&nbsp; ${result.direct_dependents.length} direct &nbsp;·&nbsp; ${result.indirect_dependents.length} indirect</span>
</header>

<div class="main">
  <!-- graph -->
  <div class="graph-wrap">
    <div class="graph-toggle">
      <button class="tb active" id="btn-full"  onclick="switchGraph('full')">Full Graph</button>
      <button class="tb"        id="btn-focus" onclick="switchGraph('focus')">Focus Graph</button>
    </div>
    <svg id="gsvg" role="img" aria-label="Dependency graph"></svg>
    <div class="graph-legend">
      <div class="leg"><div class="leg-dot" style="background:#ef4444"></div>High risk</div>
      <div class="leg"><div class="leg-dot" style="background:#f97316"></div>Moderate</div>
      <div class="leg"><div class="leg-dot" style="background:#22c55e"></div>Low risk</div>
    </div>
    <div class="tip" id="tip"></div>
  </div>

  <!-- analysis panel -->
  <div class="panel" id="panel">

    <!-- stats -->
    <div class="stats">
      <div class="stat">
        <div class="stat-label">Risk Score</div>
        <div class="stat-value" style="color:${scoreColor}">${result.risk_score}</div>
        <div class="risk-bar-wrap"><div class="risk-bar"></div></div>
      </div>
      <div class="stat">
        <div class="stat-label">Severity</div>
        <div class="stat-value" style="font-size:15px;margin-top:4px;color:${scoreColor}">${escapeHtml(severity)}</div>
        <div class="stat-sub">${escapeHtml(result.impact_summary.blast_radius)} blast radius</div>
      </div>
      <div class="stat" style="grid-column:1/-1">
        <div class="stat-label">Primary Concern</div>
        <div class="stat-sub" style="font-size:13px;color:#e2e8f0;margin-top:4px">${escapeHtml(result.impact_summary.primary_concern)}</div>
      </div>
    </div>

    <!-- next actions -->
    <div class="sec" id="sec-actions">
      <div class="sec-hdr" onclick="toggle('sec-actions')">
        <span class="sec-title">Next Actions</span><span class="sec-arrow">▼</span>
      </div>
      <div class="sec-body">
        ${result.next_actions.length
          ? `<ul class="alist">${result.next_actions.map(a => `<li><span class="arr">→</span>${escapeHtml(a)}</li>`).join('')}</ul>`
          : '<span class="empty">No actions generated</span>'}
      </div>
    </div>

    <!-- risk explanation -->
    <div class="sec" id="sec-risk">
      <div class="sec-hdr" onclick="toggle('sec-risk')">
        <span class="sec-title">Risk Explanation</span><span class="sec-arrow">▼</span>
      </div>
      <div class="sec-body">
        ${result.risk_explanation.length
          ? `<ul class="alist">${result.risk_explanation.map(r => `<li><span class="arr">·</span>${escapeHtml(r)}</li>`).join('')}</ul>`
          : '<span class="empty">No risk factors detected</span>'}
      </div>
    </div>

    <!-- layers affected -->
    <div class="sec" id="sec-layers">
      <div class="sec-hdr" onclick="toggle('sec-layers')">
        <span class="sec-title">Layers Affected</span><span class="sec-arrow">▼</span>
      </div>
      <div class="sec-body">
        ${result.layers_affected.length
          ? `<div class="tags">${result.layers_affected.map(l => `<span class="tag ${escapeHtml(l)}">${escapeHtml(l)}</span>`).join('')}</div>`
          : '<span class="empty">No layers detected</span>'}
      </div>
    </div>

    <!-- recommended strategy -->
    <div class="sec" id="sec-strategy">
      <div class="sec-hdr" onclick="toggle('sec-strategy')">
        <span class="sec-title">Recommended Strategy</span><span class="sec-arrow">▼</span>
      </div>
      <div class="sec-body">
        ${result.recommended_strategy.length
          ? `<ul class="alist">${result.recommended_strategy.map(s => `<li><span class="arr">→</span>${escapeHtml(s)}</li>`).join('')}</ul>`
          : '<span class="empty">No strategy generated</span>'}
      </div>
    </div>

    <!-- suggested tests -->
    <div class="sec" id="sec-tests">
      <div class="sec-hdr" onclick="toggle('sec-tests')">
        <span class="sec-title">Suggested Tests</span><span class="sec-arrow">▼</span>
      </div>
      <div class="sec-body">
        ${result.suggested_tests.length
          ? `<div class="tags">${result.suggested_tests.map(t => `<span class="tag default">${escapeHtml(t)}</span>`).join('')}</div>`
          : '<span class="empty">No tests suggested</span>'}
      </div>
    </div>

    <!-- safe / risky changes -->
    <div class="sec" id="sec-changes">
      <div class="sec-hdr" onclick="toggle('sec-changes')">
        <span class="sec-title">Safe &amp; Risky Changes</span><span class="sec-arrow">▼</span>
      </div>
      <div class="sec-body">
        <div class="change-cols">
          <div class="change-box safe">
            <div class="cb-title">Safe</div>
            ${result.safe_changes.map(c => `<div class="cb-item">${escapeHtml(c)}</div>`).join('')}
          </div>
          <div class="change-box risky">
            <div class="cb-title">Risky</div>
            ${result.risky_changes.map(c => `<div class="cb-item">${escapeHtml(c)}</div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- top dependents -->
    <div class="sec" id="sec-deps">
      <div class="sec-hdr" onclick="toggle('sec-deps')">
        <span class="sec-title">Top Dependents</span><span class="sec-arrow">▼</span>
      </div>
      <div class="sec-body">
        ${result.top_dependents.length
          ? `<ul class="paths">${result.top_dependents.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>`
          : '<span class="empty">No dependents</span>'}
      </div>
    </div>

    <!-- entry points -->
    <div class="sec" id="sec-entry">
      <div class="sec-hdr" onclick="toggle('sec-entry')">
        <span class="sec-title">Entry Points</span><span class="sec-arrow">▼</span>
      </div>
      <div class="sec-body">
        ${result.entry_points.length
          ? `<ul class="paths">${result.entry_points.map(e => `<li class="entry">${escapeHtml(e)}</li>`).join('')}</ul>`
          : '<span class="empty">No entry points detected</span>'}
      </div>
    </div>

    <!-- all dependents -->
    <div class="sec collapsed" id="sec-alldeps">
      <div class="sec-hdr" onclick="toggle('sec-alldeps')">
        <span class="sec-title">All Dependents (${result.direct_dependents.length + result.indirect_dependents.length})</span><span class="sec-arrow">▼</span>
      </div>
      <div class="sec-body">
        ${result.direct_dependents.length || result.indirect_dependents.length ? `
          ${result.direct_dependents.length ? `<div class="stat-label" style="margin-bottom:6px">Direct (${result.direct_dependents.length})</div><ul class="paths">${result.direct_dependents.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
          ${result.indirect_dependents.length ? `<div class="stat-label" style="margin:10px 0 6px">Indirect (${result.indirect_dependents.length})</div><ul class="paths">${result.indirect_dependents.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
        ` : '<span class="empty">No dependents</span>'}
      </div>
    </div>

    <!-- risk factors -->
    <div class="sec collapsed" id="sec-factors">
      <div class="sec-hdr" onclick="toggle('sec-factors')">
        <span class="sec-title">Risk Factors</span><span class="sec-arrow">▼</span>
      </div>
      <div class="sec-body">
        ${result.risk_factors.length
          ? `<ul class="alist">${result.risk_factors.map(f => `<li><span class="arr">·</span><span style="font-family:ui-monospace,monospace;font-size:11px">${escapeHtml(f)}</span></li>`).join('')}</ul>`
          : '<span class="empty">No risk factors</span>'}
      </div>
    </div>

  </div><!-- /panel -->
</div><!-- /main -->

<script>
  const fullGraph = ${fullGraphJson};
  const focusGraph = ${focusGraphJson};
  const target = ${targetJson};
  const tip        = document.getElementById('tip');
  const svg        = document.getElementById('gsvg');
  const colors     = { high: '#ef4444', moderate: '#f97316', low: '#22c55e' };

  let currentGraph = fullGraph;

  function toggle(id) {
    document.getElementById(id).classList.toggle('collapsed');
  }

  function switchGraph(mode) {
    document.getElementById('btn-full').classList.toggle('active', mode === 'full');
    document.getElementById('btn-focus').classList.toggle('active', mode === 'focus');
    currentGraph = mode === 'focus' ? focusGraph : fullGraph;
    renderGraph();
  }

  function renderGraph() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const wrap   = svg.parentElement;
    const width  = wrap.clientWidth;
    const height = wrap.clientHeight;
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);

    const graph = currentGraph;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.max(100, Math.min(width, height) / 2.8);

    // Separate target node from others to lay them out on a circle
    const others = graph.nodes.filter(n => n.id !== target);
    const positioned = graph.nodes.map((node, i) => {
      if (node.id === target) return { ...node, x: cx, y: cy };
      const idx   = others.indexOf(node);
      const angle = (idx / Math.max(1, others.length)) * Math.PI * 2 - Math.PI / 2;
      return { ...node, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
    const byId = new Map(positioned.map(n => [n.id, n]));

    // defs for arrowhead
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrow');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('refX', '6');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M0,0 L0,6 L8,3 z');
    arrowPath.setAttribute('fill', '#475569');
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // edges
    for (const edge of graph.edges) {
      const from = byId.get(edge.from);
      const to   = byId.get(edge.to);
      if (!from || !to) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(from.x));
      line.setAttribute('y1', String(from.y));
      line.setAttribute('x2', String(to.x));
      line.setAttribute('y2', String(to.y));
      line.setAttribute('class', 'edge-line' + (edge.type === 'imports' ? ' imports' : ''));
      line.setAttribute('marker-end', 'url(#arrow)');
      svg.appendChild(line);
    }

    // nodes
    for (const node of positioned) {
      const isTarget = node.id === target;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      if (isTarget) {
        // outer glow ring
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('cx', String(node.x));
        ring.setAttribute('cy', String(node.y));
        ring.setAttribute('r', '20');
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', colors[node.risk] || colors.low);
        ring.setAttribute('stroke-width', '1.5');
        ring.setAttribute('opacity', '0.35');
        g.appendChild(ring);
      }

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(node.x));
      circle.setAttribute('cy', String(node.y));
      circle.setAttribute('r', isTarget ? '14' : '9');
      circle.setAttribute('fill', colors[node.risk] || colors.low);
      circle.setAttribute('stroke', isTarget ? '#fff' : '#0f172a');
      circle.setAttribute('class', 'node-circle');

      circle.addEventListener('mousemove', (e) => {
        tip.innerHTML = '<div class="tip-title">' + node.label + '</div>'
          + '<div class="tip-row"><span class="tip-key">path</span>' + node.id + '</div>'
          + '<div class="tip-row"><span class="tip-key">layer</span>' + node.layer + '</div>'
          + '<div class="tip-row"><span class="tip-key">type</span>' + node.type + '</div>'
          + '<div class="tip-row"><span class="tip-key">risk</span><span style="color:' + (colors[node.risk]||colors.low) + '">' + node.risk + '</span></div>';
        const rect = svg.parentElement.getBoundingClientRect();
        const px = e.clientX - rect.left + 14;
        const py = e.clientY - rect.top  + 14;
        tip.style.left = (px + 240 > rect.width ? e.clientX - rect.left - 254 : px) + 'px';
        tip.style.top  = py + 'px';
        tip.classList.add('show');
      });
      circle.addEventListener('mouseleave', () => tip.classList.remove('show'));

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(node.x + (isTarget ? 17 : 13)));
      label.setAttribute('y', String(node.y + 4));
      label.setAttribute('class', 'node-label');
      label.textContent = node.label;

      g.appendChild(circle);
      g.appendChild(label);
      svg.appendChild(g);
    }
  }

  renderGraph();
  window.addEventListener('resize', renderGraph);
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
