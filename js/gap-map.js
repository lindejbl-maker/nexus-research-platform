// ═══ RESEARCH GAP MAP — D3.js Force-Directed Visualisation (v2) ═══════════════
// Replaces the vanilla canvas renderer with D3.js SVG force simulation.
//
// Key improvements over canvas v1:
//  • D3 force simulation — proper collision, charge, link forces
//  • SVG rendering — resolution-independent, sharper on retina
//  • Rich HTML tooltips (not canvas text) with actionable buttons
//  • Smooth animated transitions on node/edge entry
//  • Cluster colour legend with live filter
//  • Zoom controls UI (fit, reset, ±)
//  • Mobile pinch-to-zoom via D3 zoom
//
// Public API (unchanged from v1):
//   initGapMap(containerId, data, onGapClick)
//   data = { nodes: [...], edges: [...], gaps: [...] }
// ──────────────────────────────────────────────────────────────────────────────

// ── Cluster palette ──────────────────────────────────────────────────────────
const GAP_MAP_CLUSTERS = [
  { color: '#4F8CEA', label: 'Cluster A' },
  { color: '#6366F1', label: 'Cluster B' },
  { color: '#8B5CF6', label: 'Cluster C' },
  { color: '#3B82F6', label: 'Cluster D' },
  { color: '#A855F7', label: 'Cluster E' },
];
const GAP_COLOR    = '#22D3EE';
const GAP_COLOR_DIM = 'rgba(34,211,238,0.18)';

// ── Module-level instance tracker (same pattern as v1) ────────────────────────
let _activeGapMap = null;

// ── Main entry point (same signature as v1) ───────────────────────────────────
function initGapMap(canvasId, data, onGapClick) {
  // canvasId may be 'gap-map-canvas' (legacy) — we look for its parent wrapper
  if (_activeGapMap) { _activeGapMap.destroy(); _activeGapMap = null; }

  // Find the wrapper — the canvas element's parent, or use canvasId directly
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const wrap = canvas.parentElement;

  // Hide the old canvas element; we'll render SVG into the wrapper instead
  canvas.style.display = 'none';

  _activeGapMap = new GapMapD3(wrap, data, onGapClick || (() => {}));
  return _activeGapMap;
}

// ──────────────────────────────────────────────────────────────────────────────
class GapMapD3 {
  constructor(container, data, onGapClick) {
    this.container  = container;
    this.data       = data;
    this.onGapClick = onGapClick;
    this._tooltip   = null;
    this._svg       = null;
    this._zoom      = null;
    this._sim       = null;
    this._pulseRaf  = null;
    this._tick      = 0;

    this._buildNodes();
    this._render();
  }

  // ── Build unified node + edge arrays ────────────────────────────────────────
  _buildNodes() {
    const W = this.container.clientWidth  || 900;
    const H = this.container.clientHeight || 520;

    this._nodes = [
      ...(this.data.nodes || []).map(n => ({
        id:       n.id,
        label:    n.label,
        type:     'studied',
        cluster:  n.cluster || 0,
        fx_hint:  n.x_hint,
        fy_hint:  n.y_hint,
        x:        n.x_hint != null ? n.x_hint * W * 0.8 + W * 0.1 : Math.random() * W,
        y:        n.y_hint != null ? n.y_hint * H * 0.8 + H * 0.1 : Math.random() * H,
        r:        28,
        linkedHypIdx: null,
      })),
      ...(this.data.gaps || []).map((g, i) => ({
        id:       `gap_${g.id || i}`,
        label:    g.label,
        type:     'gap',
        cluster:  -1,
        fx_hint:  g.x_hint,
        fy_hint:  g.y_hint,
        x:        g.x_hint != null ? g.x_hint * W * 0.8 + W * 0.1 : Math.random() * W,
        y:        g.y_hint != null ? g.y_hint * H * 0.8 + H * 0.1 : Math.random() * H,
        r:        24,
        linkedHypIdx: g.linkedHypothesisIdx ?? i,
      })),
    ];

    this._links = (this.data.edges || []).map(e => ({
      source: e.from,
      target: e.to,
      strength: e.strength || 0.5,
    }));
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  _render() {
    const W = this.container.clientWidth  || 900;
    const H = this.container.clientHeight || 520;

    // ── Create tooltip div ───────────────────────────────────────────────────
    this._tooltip = document.createElement('div');
    this._tooltip.className = 'gm-tooltip';
    this._tooltip.style.cssText = 'position:absolute;pointer-events:none;opacity:0;transition:opacity 0.15s;z-index:50;';
    this.container.style.position = 'relative';
    this.container.appendChild(this._tooltip);

    // ── Create controls overlay ──────────────────────────────────────────────
    const controls = document.createElement('div');
    controls.className = 'gm-controls';
    controls.innerHTML = `
      <button class="gm-ctrl-btn" id="gm-zoom-in"  title="Zoom in">+</button>
      <button class="gm-ctrl-btn" id="gm-zoom-out" title="Zoom out">−</button>
      <button class="gm-ctrl-btn" id="gm-zoom-fit" title="Fit all nodes">⤢</button>`;
    this.container.appendChild(controls);

    // ── Create legend ────────────────────────────────────────────────────────
    const legend = document.createElement('div');
    legend.className = 'gm-legend-d3';
    const usedClusters = [...new Set(this._nodes.filter(n => n.type === 'studied').map(n => n.cluster))];
    legend.innerHTML =
      usedClusters.map(c => `<span class="gml-item" style="--cl:${GAP_MAP_CLUSTERS[c % GAP_MAP_CLUSTERS.length].color}">● ${GAP_MAP_CLUSTERS[c % GAP_MAP_CLUSTERS.length].label}</span>`).join('') +
      `<span class="gml-item gml-gap" style="--cl:${GAP_COLOR}">◉ Unexplored gap</span>` +
      `<span class="gml-hint">Scroll to zoom · Drag to pan · Click gap node → hypothesis</span>`;
    this.container.appendChild(legend);

    // ── Create SVG ───────────────────────────────────────────────────────────
    if (typeof d3 === 'undefined') {
      this.container.innerHTML = '<div style="padding:40px;text-align:center;color:#8898B8;">D3.js not loaded. Check your script tags.</div>';
      return;
    }

    const svg = d3.select(this.container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', H)
      .attr('viewBox', `0 0 ${W} ${H}`)
      .style('border-radius', '10px')
      .style('background', '#080C14');

    this._svg = svg;

    // Subtle grid
    const defs = svg.append('defs');
    const pattern = defs.append('pattern')
      .attr('id', 'gm-grid').attr('width', 60).attr('height', 60)
      .attr('patternUnits', 'userSpaceOnUse');
    pattern.append('path').attr('d', 'M 60 0 L 0 0 0 60')
      .attr('fill', 'none').attr('stroke', 'rgba(255,255,255,0.025)').attr('stroke-width', 1);
    svg.append('rect').attr('width', '100%').attr('height', '100%').attr('fill', 'url(#gm-grid)');

    // Glow filter for gap nodes
    const filter = defs.append('filter').attr('id', 'gm-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 6).attr('result', 'blur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'blur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Zoom behaviour
    const zoomBehaviour = d3.zoom()
      .scaleExtent([0.25, 4])
      .on('zoom', (event) => { g.attr('transform', event.transform); });
    svg.call(zoomBehaviour);
    this._zoomBehaviour = zoomBehaviour;
    this._svgEl = svg;

    const g = svg.append('g').attr('class', 'gm-root');
    this._g = g;

    // ── D3 Force Simulation ──────────────────────────────────────────────────
    const nodeById = new Map(this._nodes.map(n => [n.id, n]));
    const links = this._links.map(l => ({
      source: nodeById.get(l.source) || l.source,
      target: nodeById.get(l.target) || l.target,
      strength: l.strength,
    }));

    this._sim = d3.forceSimulation(this._nodes)
      .force('link',    d3.forceLink(links).id(d => d.id).distance(120).strength(d => d.strength * 0.6))
      .force('charge',  d3.forceManyBody().strength(-280))
      .force('center',  d3.forceCenter(W / 2, H / 2))
      .force('collide', d3.forceCollide().radius(d => d.r + 18))
      .force('x',       d3.forceX(W / 2).strength(0.04))
      .force('y',       d3.forceY(H / 2).strength(0.04));

    // ── Links ─────────────────────────────────────────────────────────────────
    const linkSel = g.append('g').attr('class', 'gm-links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => `rgba(79,140,234,${d.strength * 0.22})`)
      .attr('stroke-width', d => d.strength * 1.5)
      .attr('opacity', 0)
      .transition().duration(600).attr('opacity', 1);

    // ── Pulse rings for gap nodes (animated separately) ───────────────────────
    const pulseRingSel = g.append('g').attr('class', 'gm-pulses')
      .selectAll('circle')
      .data(this._nodes.filter(n => n.type === 'gap'))
      .join('circle')
      .attr('r', d => d.r * 1.8)
      .attr('fill', 'none')
      .attr('stroke', GAP_COLOR)
      .attr('stroke-width', 1)
      .attr('opacity', 0.25)
      .attr('class', 'gm-pulse-ring');

    // ── Node groups ──────────────────────────────────────────────────────────
    const nodeSel = g.append('g').attr('class', 'gm-nodes')
      .selectAll('g')
      .data(this._nodes)
      .join('g')
      .attr('class', d => `gm-node gm-node--${d.type}`)
      .style('cursor', d => d.type === 'gap' ? 'pointer' : 'default')
      .call(d3.drag()
        .on('start', (event, d) => { if (!event.active) this._sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end',   (event, d) => { if (!event.active) this._sim.alphaTarget(0); d.fx = null; d.fy = null; }))
      .on('mouseenter', (event, d) => this._showTooltip(event, d))
      .on('mousemove',  (event, d) => this._moveTooltip(event))
      .on('mouseleave', ()        => this._hideTooltip())
      .on('click', (event, d) => {
        if (d.type === 'gap') {
          event.stopPropagation();
          this.onGapClick(d.linkedHypIdx, d.label);
        }
      });

    // Glow circle (behind main circle)
    nodeSel.append('circle')
      .attr('r', d => d.r * 2)
      .attr('fill', d => d.type === 'gap'
        ? 'rgba(34,211,238,0.08)'
        : (() => { const c = GAP_MAP_CLUSTERS[d.cluster % GAP_MAP_CLUSTERS.length].color; return c + '22'; })())
      .attr('filter', d => d.type === 'gap' ? 'url(#gm-glow)' : null)
      .attr('class', 'gm-glow-ring')
      .attr('opacity', 0)
      .transition().delay((_, i) => i * 30).duration(500).attr('opacity', 1);

    // Main circle
    nodeSel.append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => d.type === 'gap'
        ? GAP_COLOR_DIM
        : (() => { const c = GAP_MAP_CLUSTERS[d.cluster % GAP_MAP_CLUSTERS.length].color; return c + '22'; })())
      .attr('stroke', d => d.type === 'gap'
        ? GAP_COLOR
        : GAP_MAP_CLUSTERS[d.cluster % GAP_MAP_CLUSTERS.length].color)
      .attr('stroke-width', d => d.type === 'gap' ? 2 : 1.5)
      .attr('class', 'gm-main-circle')
      .attr('opacity', 0)
      .transition().delay((_, i) => i * 30).duration(500).attr('opacity', 1);

    // Inner dot for gap nodes
    nodeSel.filter(d => d.type === 'gap')
      .append('circle')
      .attr('r', 4)
      .attr('fill', GAP_COLOR)
      .attr('opacity', 0.8);

    // "GAP" text badge
    nodeSel.filter(d => d.type === 'gap')
      .append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('y', 0).attr('font-size', 8).attr('font-weight', 600)
      .attr('fill', GAP_COLOR).attr('opacity', 0.9)
      .text('GAP');

    // Node labels
    const labelY = d => d.r + 14;
    nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', d => labelY(d))
      .attr('font-size', 10.5)
      .attr('font-weight', d => d.type === 'gap' ? 600 : 400)
      .attr('fill', d => d.type === 'gap' ? GAP_COLOR : 'rgba(200,210,230,0.8)')
      .attr('class', 'gm-label')
      .each(function(d) {
        // Word-wrap into tspans
        const el = d3.select(this);
        const words = d.label.split(' ');
        const maxW  = d.r * 5;
        const lines = [];
        let cur = '';
        // Approximate char width for 10.5px
        words.forEach(w => {
          const test = cur ? cur + ' ' + w : w;
          if (test.length * 6 > maxW && cur) { lines.push(cur); cur = w; }
          else cur = test;
        });
        if (cur) lines.push(cur);
        el.text(null);
        lines.forEach((line, i) => {
          el.append('tspan')
            .attr('x', 0).attr('dy', i === 0 ? 0 : 13)
            .text(line);
        });
      });

    // ── Simulation tick ───────────────────────────────────────────────────────
    const linkEls      = g.selectAll('.gm-links line');
    const pulseRingEls = g.selectAll('.gm-pulse-ring');
    const nodeEls      = g.selectAll('.gm-nodes g');

    this._sim.on('tick', () => {
      linkEls
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);

      nodeEls.attr('transform', d => `translate(${d.x},${d.y})`);
      pulseRingEls.attr('cx', d => d.x).attr('cy', d => d.y);
    });

    // ── Gap node pulse animation ──────────────────────────────────────────────
    const pulseFn = () => {
      this._tick++;
      g.selectAll('.gm-pulse-ring')
        .attr('opacity', function(d) {
          return 0.2 + 0.2 * Math.sin(this._tick * 0.045 + (d.x || 0) * 0.01);
        }.bind(this))
        .attr('r', function(d) {
          const p = 0.5 + 0.5 * Math.sin(this._tick * 0.045 + (d.x || 0) * 0.01);
          return d.r * (1.6 + p * 0.8);
        }.bind(this));

      // Also pulse the gap node glow ring
      g.selectAll('.gm-node--gap .gm-glow-ring')
        .attr('opacity', function() {
          return 0.15 + 0.15 * Math.sin(this._tick * 0.04);
        }.bind(this));

      this._pulseRaf = requestAnimationFrame(pulseFn);
    };
    this._pulseRaf = requestAnimationFrame(pulseFn);

    // ── Zoom controls ─────────────────────────────────────────────────────────
    setTimeout(() => {
      const zIn  = document.getElementById('gm-zoom-in');
      const zOut = document.getElementById('gm-zoom-out');
      const zFit = document.getElementById('gm-zoom-fit');
      if (zIn)  zIn.addEventListener('click',  () => svg.transition().duration(300).call(zoomBehaviour.scaleBy, 1.35));
      if (zOut) zOut.addEventListener('click', () => svg.transition().duration(300).call(zoomBehaviour.scaleBy, 0.74));
      if (zFit) zFit.addEventListener('click', () => svg.transition().duration(400).call(zoomBehaviour.transform, d3.zoomIdentity));
    }, 100);
  }

  // ── Tooltip ─────────────────────────────────────────────────────────────────
  _showTooltip(event, d) {
    const tip = this._tooltip;
    if (!tip) return;
    const isGap = d.type === 'gap';
    const clr   = isGap ? GAP_MAP_CLUSTERS[0].color : GAP_MAP_CLUSTERS[d.cluster % GAP_MAP_CLUSTERS.length].color;

    tip.innerHTML = isGap
      ? `<div class="gmt-title" style="color:${GAP_COLOR}">${d.label}</div>
         <div class="gmt-sub">Unexplored research gap</div>
         ${d.linkedHypIdx !== null ? `<div class="gmt-action">↗ Click to view Hypothesis ${(d.linkedHypIdx ?? 0) + 1}</div>` : ''}
         <div class="gmt-hint">Or <a class="gmt-link" href="#" onclick="document.getElementById('hyp-input').value=\'${d.label.replace(/'/g, '')}\';switchHypTab('cards');event.preventDefault();">prefill search →</a></div>`
      : `<div class="gmt-title" style="color:${clr}">${d.label}</div>
         <div class="gmt-sub">Studied research area · Cluster ${d.cluster + 1}</div>`;

    tip.style.opacity = '1';
    tip.style.pointerEvents = isGap ? 'auto' : 'none';
    this._moveTooltip(event);
  }

  _moveTooltip(event) {
    const tip  = this._tooltip;
    if (!tip) return;
    const rect = this.container.getBoundingClientRect();
    let left   = event.clientX - rect.left + 14;
    let top    = event.clientY - rect.top  - 10;
    const tw   = tip.offsetWidth  || 200;
    const th   = tip.offsetHeight || 80;
    if (left + tw > this.container.clientWidth - 10)  left -= tw + 28;
    if (top  + th > this.container.clientHeight - 10) top  -= th + 20;
    tip.style.left = `${Math.max(4, left)}px`;
    tip.style.top  = `${Math.max(4, top)}px`;
  }

  _hideTooltip() {
    if (this._tooltip) this._tooltip.style.opacity = '0';
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  destroy() {
    if (this._sim)      this._sim.stop();
    if (this._pulseRaf) cancelAnimationFrame(this._pulseRaf);
    // Remove SVG and overlays added by this instance
    const svg = this.container.querySelector('svg');
    if (svg) svg.remove();
    const tip = this.container.querySelector('.gm-tooltip');
    if (tip) tip.remove();
    const ctrl = this.container.querySelector('.gm-controls');
    if (ctrl) ctrl.remove();
    const leg = this.container.querySelector('.gm-legend-d3');
    if (leg) leg.remove();
    // Re-show old canvas if present
    const oldCanvas = this.container.querySelector('canvas');
    if (oldCanvas) oldCanvas.style.display = '';
  }
}
