export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[char];
  });
}

export const PANEL_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
         background: #0f172a; color: #e2e8f0; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

  /* ── header ── */
  header { display: flex; align-items: center; gap: 12px; padding: 10px 18px;
           border-bottom: 1px solid #1e293b; flex-shrink: 0; min-height: 52px; flex-wrap: wrap; }
  .h-target { font-size: 15px; font-weight: 700; color: #f1f5f9; }
  .h-badge  { padding: 3px 11px; border-radius: 9999px; font-size: 11px; font-weight: 700;
              letter-spacing: .03em; border: 1px solid transparent; }
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
  svg.gsvg { width: 100%; height: 100%; display: block; }
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
  .panel { width: 340px; border-left: 1px solid #1e293b; overflow-y: auto; flex-shrink: 0;
           transition: width .15s ease; }
  .panel.hidden { width: 0; border-left: none; overflow: hidden; }
  .panel::-webkit-scrollbar { width: 4px; }
  .panel::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }

  /* ── panel toggle button ── */
  .panel-btn { position: absolute; top: 10px; right: 10px; z-index: 10;
               width: 28px; height: 28px; border: 1px solid #334155; border-radius: 6px;
               background: #1e293b; color: #64748b; font-size: 13px; cursor: pointer;
               display: flex; align-items: center; justify-content: center; padding: 0; }
  .panel-btn:hover { color: #e2e8f0; background: #273549; }

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
  .risk-bar { height: 6px; border-radius: 9999px; }

  .empty { color: #475569; font-size: 12px; font-style: italic; }
`;

export const PANEL_RENDERER_JS = `
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function sevColor(sev) {
    return sev==='critical'?'#ef4444':sev==='high'?'#f97316':sev==='moderate'?'#facc15':'#22c55e';
  }
  function sevBg(sev) {
    return sev==='critical'?'#450a0a':sev==='high'?'#431407':sev==='moderate'?'#422006':'#052e16';
  }

  function toggle(id) { document.getElementById(id).classList.toggle('collapsed'); }

  function renderHeader(result, el) {
    var sev = result.impact_summary.severity;
    var sc  = sevColor(sev), bg = sevBg(sev);
    el.innerHTML =
      '<span class="h-target">'  + escHtml(result.target) + '</span>' +
      '<span class="h-badge" style="color:' + sc + ';background:' + bg + ';border-color:' + sc + '40">' +
        escHtml(sev) + ' &middot; ' + result.risk_score + '/100</span>' +
      '<span class="h-meta">' + result.usage_count + ' usages  &middot;  ' +
        result.direct_dependents.length + ' direct  &middot;  ' +
        result.indirect_dependents.length + ' indirect</span>';
  }

  var NODE_COLORS = { high: '#ef4444', moderate: '#f97316', low: '#22c55e' };

  function renderGraph(graph, target, svg, tip) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var wrap = svg.parentElement;
    var width = wrap.clientWidth, height = wrap.clientHeight;
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    var cx = width / 2, cy = height / 2;

    var others = graph.nodes.filter(function(n) { return n.id !== target; });
    var n = others.length;

    // Scale radius so adjacent nodes have ≥36 px arc-gap; clamp to visible area
    var minR  = Math.max(110, Math.min(width, height) / 3.2);
    var byGap = n > 1 ? (n * 36) / (2 * Math.PI) : minR;
    var maxR  = Math.min(width, height) / 2 - 72;
    var radius = Math.max(minR, Math.min(byGap, maxR));

    // Hide outer labels when the graph is too dense to read them
    var showOuterLabels = n <= 20;

    var positioned = graph.nodes.map(function(node) {
      if (node.id === target) return Object.assign({}, node, {x: cx, y: cy, _angle: 0});
      var idx = others.indexOf(node);
      var angle = (idx / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
      return Object.assign({}, node, {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        _angle: angle,
      });
    });
    var byId = new Map(positioned.map(function(nd) { return [nd.id, nd]; }));

    var NS = 'http://www.w3.org/2000/svg';
    var defs   = document.createElementNS(NS, 'defs');
    var marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', 'arrow'); marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8'); marker.setAttribute('refX', '6');
    marker.setAttribute('refY', '3'); marker.setAttribute('orient', 'auto');
    var ap = document.createElementNS(NS, 'path');
    ap.setAttribute('d', 'M0,0 L0,6 L8,3 z'); ap.setAttribute('fill', '#475569');
    marker.appendChild(ap); defs.appendChild(marker); svg.appendChild(defs);

    // Dense-graph hint
    if (!showOuterLabels) {
      var hint = document.createElementNS(NS, 'text');
      hint.setAttribute('x', String(width - 10));
      hint.setAttribute('y', String(height - 14));
      hint.setAttribute('text-anchor', 'end');
      hint.setAttribute('fill', '#334155');
      hint.setAttribute('font-size', '11');
      hint.setAttribute('font-family', 'Inter,ui-sans-serif,sans-serif');
      hint.textContent = 'hover nodes for details';
      svg.appendChild(hint);
    }

    graph.edges.forEach(function(edge) {
      var from = byId.get(edge.from), to = byId.get(edge.to);
      if (!from || !to) return;
      var line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', String(from.x)); line.setAttribute('y1', String(from.y));
      line.setAttribute('x2', String(to.x));   line.setAttribute('y2', String(to.y));
      line.setAttribute('class', 'edge-line' + (edge.type === 'imports' ? ' imports' : ''));
      line.setAttribute('marker-end', 'url(#arrow)');
      svg.appendChild(line);
    });

    positioned.forEach(function(node) {
      var isTarget = node.id === target;
      var g = document.createElementNS(NS, 'g');
      if (isTarget) {
        var ring = document.createElementNS(NS, 'circle');
        ring.setAttribute('cx', String(node.x)); ring.setAttribute('cy', String(node.y));
        ring.setAttribute('r', '20'); ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', NODE_COLORS[node.risk] || NODE_COLORS.low);
        ring.setAttribute('stroke-width', '1.5'); ring.setAttribute('opacity', '0.35');
        g.appendChild(ring);
      }
      var circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', String(node.x)); circle.setAttribute('cy', String(node.y));
      circle.setAttribute('r', isTarget ? '14' : '9');
      circle.setAttribute('fill', NODE_COLORS[node.risk] || NODE_COLORS.low);
      circle.setAttribute('stroke', isTarget ? '#fff' : '#0f172a');
      circle.setAttribute('class', 'node-circle');
      if (tip) {
        circle.addEventListener('mousemove', function(e) {
          tip.innerHTML =
            '<div class="tip-title">' + escHtml(node.label) + '</div>' +
            '<div class="tip-row"><span class="tip-key">path</span>'  + escHtml(node.id)    + '</div>' +
            '<div class="tip-row"><span class="tip-key">layer</span>' + escHtml(node.layer) + '</div>' +
            '<div class="tip-row"><span class="tip-key">type</span>'  + escHtml(node.type)  + '</div>' +
            '<div class="tip-row"><span class="tip-key">risk</span><span style="color:' +
              (NODE_COLORS[node.risk]||NODE_COLORS.low) + '">' + escHtml(node.risk) + '</span></div>';
          var rect = svg.parentElement.getBoundingClientRect();
          var px = e.clientX - rect.left + 14, py = e.clientY - rect.top + 14;
          tip.style.left = (px + 240 > rect.width ? e.clientX - rect.left - 254 : px) + 'px';
          tip.style.top  = py + 'px';
          tip.classList.add('show');
        });
        circle.addEventListener('mouseleave', function() { tip.classList.remove('show'); });
      }
      g.appendChild(circle);

      if (isTarget || showOuterLabels) {
        var nodeR  = isTarget ? 14 : 9;
        var angle  = node._angle !== undefined ? node._angle : 0;
        var cosA   = Math.cos(angle);
        var sinA   = Math.sin(angle);
        var label  = document.createElementNS(NS, 'text');
        label.setAttribute('x', String(node.x + cosA * (nodeR + 5)));
        label.setAttribute('y', String(node.y + sinA * (nodeR + 5)));
        label.setAttribute('text-anchor', cosA >= -0.1 ? 'start' : 'end');
        label.setAttribute('dominant-baseline', 'central');
        label.setAttribute('class', 'node-label');
        label.textContent = node.label;
        g.appendChild(label);
      }

      svg.appendChild(g);
    });
  }

  function _sec(id, title, body, collapsed) {
    return '<div class="sec' + (collapsed ? ' collapsed' : '') + '" id="' + id + '">' +
      '<div class="sec-hdr" onclick="toggle(\\'' + id + '\\')">' +
      '<span class="sec-title">' + title + '</span><span class="sec-arrow">▼</span></div>' +
      '<div class="sec-body">' + body + '</div></div>';
  }
  function _list(items, prefix) {
    if (!items || !items.length) return '<span class="empty">None</span>';
    return '<ul class="alist">' +
      items.map(function(a) { return '<li><span class="arr">' + prefix + '</span>' + escHtml(a) + '</li>'; }).join('') +
      '</ul>';
  }
  function _paths(items, cls) {
    if (!items || !items.length) return '<span class="empty">None</span>';
    return '<ul class="paths">' +
      items.map(function(d) { return '<li' + (cls ? ' class="' + cls + '"' : '') + '>' + escHtml(d) + '</li>'; }).join('') +
      '</ul>';
  }

  function togglePanel() {
    var panel = document.getElementById('panel');
    var btn   = document.getElementById('panel-btn');
    var hidden = panel.classList.toggle('hidden');
    if (btn) btn.textContent = hidden ? '⊞' : '⊟';
  }

  function renderPanel(result, el) {
    var sev = result.impact_summary.severity;
    var sc  = sevColor(sev);
    var sw  = Math.min(result.risk_score, 100);
    var allDeps = (result.direct_dependents||[]).length + (result.indirect_dependents||[]).length;

    var layerTags = (result.layers_affected||[]).length
      ? '<div class="tags">' + result.layers_affected.map(function(l) {
          return '<span class="tag ' + escHtml(l) + '">' + escHtml(l) + '</span>';
        }).join('') + '</div>'
      : '<span class="empty">No layers detected</span>';

    var testTags = (result.suggested_tests||[]).length
      ? '<div class="tags">' + result.suggested_tests.map(function(t) {
          return '<span class="tag default">' + escHtml(t) + '</span>';
        }).join('') + '</div>'
      : '<span class="empty">None</span>';

    var changeCols =
      '<div class="change-cols">' +
        '<div class="change-box safe"><div class="cb-title">Safe</div>' +
          (result.safe_changes||[]).map(function(c) { return '<div class="cb-item">' + escHtml(c) + '</div>'; }).join('') +
        '</div>' +
        '<div class="change-box risky"><div class="cb-title">Risky</div>' +
          (result.risky_changes||[]).map(function(c) { return '<div class="cb-item">' + escHtml(c) + '</div>'; }).join('') +
        '</div>' +
      '</div>';

    var allDepsBody = '';
    if ((result.direct_dependents||[]).length)
      allDepsBody += '<div class="stat-label" style="margin-bottom:6px">Direct (' + result.direct_dependents.length + ')</div>' + _paths(result.direct_dependents);
    if ((result.indirect_dependents||[]).length)
      allDepsBody += '<div class="stat-label" style="margin:10px 0 6px">Indirect (' + result.indirect_dependents.length + ')</div>' + _paths(result.indirect_dependents);
    if (!allDepsBody) allDepsBody = '<span class="empty">No dependents</span>';

    var riskFactorsBody = (result.risk_factors||[]).length
      ? '<ul class="alist">' + result.risk_factors.map(function(f) {
          return '<li><span class="arr">·</span><span style="font-family:ui-monospace,monospace;font-size:11px">' + escHtml(f) + '</span></li>';
        }).join('') + '</ul>'
      : '<span class="empty">No risk factors</span>';

    el.innerHTML =
      '<div class="stats">' +
        '<div class="stat"><div class="stat-label">Risk Score</div>' +
          '<div class="stat-value" style="color:' + sc + '">' + result.risk_score + '</div>' +
          '<div class="risk-bar-wrap"><div class="risk-bar" style="background:' + sc + ';width:' + sw + '%"></div></div></div>' +
        '<div class="stat"><div class="stat-label">Severity</div>' +
          '<div class="stat-value" style="font-size:15px;margin-top:4px;color:' + sc + '">' + escHtml(sev) + '</div>' +
          '<div class="stat-sub">' + escHtml(result.impact_summary.blast_radius) + ' blast radius</div></div>' +
        '<div class="stat" style="grid-column:1/-1"><div class="stat-label">Primary Concern</div>' +
          '<div class="stat-sub" style="font-size:13px;color:#e2e8f0;margin-top:4px">' + escHtml(result.impact_summary.primary_concern) + '</div></div>' +
      '</div>' +
      _sec('sec-actions',   'Next Actions',           _list(result.next_actions, '→'),    false) +
      _sec('sec-risk',      'Risk Explanation',        _list(result.risk_explanation, '·'), false) +
      _sec('sec-layers',    'Layers Affected',         layerTags,                               false) +
      _sec('sec-strategy',  'Recommended Strategy',    _list(result.recommended_strategy, '→'), false) +
      _sec('sec-tests',     'Suggested Tests',         testTags,                                false) +
      _sec('sec-changes',   'Safe &amp; Risky Changes', changeCols,                             false) +
      _sec('sec-deps',      'Top Dependents',          _paths(result.top_dependents),           false) +
      _sec('sec-entry',     'Entry Points',            _paths(result.entry_points, 'entry'),    false) +
      _sec('sec-alldeps',   'All Dependents (' + allDeps + ')', allDepsBody,                   true)  +
      _sec('sec-factors',   'Risk Factors',            riskFactorsBody,                         true);
  }
`;
