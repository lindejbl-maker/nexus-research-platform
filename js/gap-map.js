// ═══ RESEARCH GAP MAP — Interactive Force-Directed Visualisation ══════════════
// Renders a field's research landscape as an interactive canvas:
//   • Blue/indigo glow nodes  = studied topics
//   • Pulsing cyan nodes       = unexplored gaps (linked to hypothesis cards)
//   • Dim connecting lines     = relationships between studied areas
//   • Click gap node           = scrolls to + highlights the linked hypothesis
//   • Mouse wheel              = zoom in/out
//   • Drag on canvas           = pan
// Uses a vanilla Fruchterman-Reingold force-directed layout, no dependencies.

class GapMap {
  constructor(canvas, data, onGapClick) {
    this.canvas    = canvas;
    this.ctx       = canvas.getContext('2d');
    this.onGapClick = onGapClick || (() => {});
    this.data      = data;       // { nodes, edges, gaps }
    this.nodes     = [];         // combined studied + gap nodes
    this.edges     = data.edges || [];
    this.zoom      = 1;
    this.panX      = 0;
    this.panY      = 0;
    this.isDragging = false;
    this.dragStart  = { x: 0, y: 0 };
    this.hoveredNode = null;
    this.tick       = 0;         // For pulse animation

    this._initNodes();
    this._attachEvents();
    this._layout(220);           // Run physics iterations
    this._centerView();
    this._startLoop();
  }

  // ─── Initialise nodes from data ─────────────────────────────────────────────
  _initNodes() {
    const W = this.canvas.width;
    const H = this.canvas.height;

    (this.data.nodes || []).forEach((n, i) => {
      this.nodes.push({
        id:       n.id,
        label:    n.label,
        cluster:  n.cluster || 0,
        type:     'studied',
        x:        n.x_hint != null ? n.x_hint * W * 0.8 + W * 0.1 : Math.random() * W,
        y:        n.y_hint != null ? n.y_hint * H * 0.8 + H * 0.1 : Math.random() * H,
        vx: 0, vy: 0,
        radius:   26,
        linkedHypIdx: null
      });
    });

    (this.data.gaps || []).forEach((g, i) => {
      this.nodes.push({
        id:       `gap_${g.id || i}`,
        label:    g.label,
        type:     'gap',
        x:        g.x_hint != null ? g.x_hint * W * 0.8 + W * 0.1 : Math.random() * W,
        y:        g.y_hint != null ? g.y_hint * H * 0.8 + H * 0.1 : Math.random() * H,
        vx: 0, vy: 0,
        radius:   22,
        linkedHypIdx: g.linkedHypothesisIdx ?? null
      });
    });
  }

  // ─── Fruchterman-Reingold layout ────────────────────────────────────────────
  _layout(iterations = 200) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const area = W * H;
    const k = Math.sqrt(area / Math.max(this.nodes.length, 1));
    let temp = W / 4;
    const cooling = temp / (iterations + 1);

    for (let iter = 0; iter < iterations; iter++) {
      // Repulsion between all pairs
      for (let i = 0; i < this.nodes.length; i++) {
        this.nodes[i].dx = 0;
        this.nodes[i].dy = 0;
        for (let j = 0; j < this.nodes.length; j++) {
          if (i === j) continue;
          const dx = this.nodes[i].x - this.nodes[j].x;
          const dy = this.nodes[i].y - this.nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const repulse = (k * k) / dist;
          this.nodes[i].dx += (dx / dist) * repulse;
          this.nodes[i].dy += (dy / dist) * repulse;
        }
      }

      // Attraction along edges
      this.edges.forEach(e => {
        const u = this.nodes.find(n => n.id === e.from);
        const v = this.nodes.find(n => n.id === e.to);
        if (!u || !v) return;
        const dx = v.x - u.x;
        const dy = v.y - u.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const attract = (dist * dist) / k;
        const fx = (dx / dist) * attract;
        const fy = (dy / dist) * attract;
        u.dx += fx; u.dy += fy;
        v.dx -= fx; v.dy -= fy;
      });

      // Apply with temperature clamp + boundary
      this.nodes.forEach(n => {
        const mag = Math.sqrt(n.dx * n.dx + n.dy * n.dy) || 0.01;
        n.x += (n.dx / mag) * Math.min(mag, temp);
        n.y += (n.dy / mag) * Math.min(mag, temp);
        n.x = Math.max(50, Math.min(W - 50, n.x));
        n.y = Math.max(50, Math.min(H - 50, n.y));
      });

      temp -= cooling;
    }
  }

  // ─── Center view around node centroid ───────────────────────────────────────
  _centerView() {
    if (!this.nodes.length) return;
    const cx = this.nodes.reduce((s, n) => s + n.x, 0) / this.nodes.length;
    const cy = this.nodes.reduce((s, n) => s + n.y, 0) / this.nodes.length;
    this.panX = this.canvas.width  / 2 - cx;
    this.panY = this.canvas.height / 2 - cy;
  }

  // ─── Events ─────────────────────────────────────────────────────────────────
  _attachEvents() {
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.92 : 1.09;
      this.zoom = Math.max(0.3, Math.min(3, this.zoom * delta));
    }, { passive: false });

    this.canvas.addEventListener('mousedown', e => {
      this.isDragging = true;
      this.dragStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
    });
    this.canvas.addEventListener('mousemove', e => {
      if (this.isDragging) {
        this.panX = e.clientX - this.dragStart.x;
        this.panY = e.clientY - this.dragStart.y;
      } else {
        // Hover detection
        const { wx, wy } = this._screenToWorld(e.offsetX, e.offsetY);
        this.hoveredNode = this.nodes.find(n =>
          Math.hypot(n.x - wx, n.y - wy) < n.radius + 6
        ) || null;
        this.canvas.style.cursor = this.hoveredNode ? 'pointer' : 'grab';
      }
    });
    this.canvas.addEventListener('mouseup', e => {
      if (!this.isDragging) return;
      const moved = Math.hypot(e.clientX - this.dragStart.x - this.panX, e.clientY - this.dragStart.y - this.panY);
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
      if (moved < 5) this._handleClick(e); // click if barely moved
    });
    this.canvas.addEventListener('click', e => {
      this._handleClick(e);
    });

    // Touch support
    let lastTouchDist = 0;
    this.canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.dragStart = { x: e.touches[0].clientX - this.panX, y: e.touches[0].clientY - this.panY };
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });
    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && this.isDragging) {
        this.panX = e.touches[0].clientX - this.dragStart.x;
        this.panY = e.touches[0].clientY - this.dragStart.y;
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        this.zoom = Math.max(0.3, Math.min(3, this.zoom * (dist / lastTouchDist)));
        lastTouchDist = dist;
      }
    }, { passive: false });
    this.canvas.addEventListener('touchend', () => { this.isDragging = false; });
  }

  _screenToWorld(sx, sy) {
    const cx = this.canvas.width  / 2;
    const cy = this.canvas.height / 2;
    return {
      wx: (sx - cx - this.panX) / this.zoom + cx,
      wy: (sy - cy - this.panY) / this.zoom + cy
    };
  }

  _handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;
    const { wx, wy } = this._screenToWorld(ox, oy);
    const hit = this.nodes.find(n =>
      n.type === 'gap' && Math.hypot(n.x - wx, n.y - wy) < n.radius + 10
    );
    if (hit && hit.linkedHypIdx !== null) {
      this.onGapClick(hit.linkedHypIdx, hit.label);
    }
  }

  // ─── Render loop ────────────────────────────────────────────────────────────
  _startLoop() {
    const loop = () => {
      this._draw();
      this.tick++;
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  destroy() { cancelAnimationFrame(this._raf); }

  _draw() {
    const ctx  = this.ctx;
    const W    = this.canvas.width;
    const H    = this.canvas.height;
    const cx   = W / 2;
    const cy   = H / 2;
    const t    = this.tick;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#080C14';
    ctx.fillRect(0, 0, W, H);

    // Draw subtle grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    const gridSize = 60;
    for (let x = 0; x < W; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();

    // Apply pan + zoom from canvas centre
    ctx.save();
    ctx.translate(cx + this.panX, cy + this.panY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-cx, -cy);

    // ── Edges ────────────────────────────────────────────────────────────────
    this.edges.forEach(e => {
      const u = this.nodes.find(n => n.id === e.from);
      const v = this.nodes.find(n => n.id === e.to);
      if (!u || !v) return;
      const strength = e.strength || 0.5;
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(v.x, v.y);
      ctx.strokeStyle = `rgba(79,140,234,${strength * 0.22})`;
      ctx.lineWidth = strength * 1.5;
      ctx.stroke();
    });

    // ── Nodes ────────────────────────────────────────────────────────────────
    // Cluster colours for studied nodes
    const clusterColors = [
      [79,140,234],   // blue
      [99,102,241],   // indigo
      [139,92,246],   // violet
      [59,130,246],   // lighter blue
      [168,85,247],   // purple
    ];

    this.nodes.forEach(n => {
      const isHovered = this.hoveredNode === n;
      ctx.save();

      if (n.type === 'studied') {
        const [r, g, b] = clusterColors[n.cluster % clusterColors.length];
        const glowAlpha = isHovered ? 0.55 : 0.25;
        const nodeAlpha = isHovered ? 1 : 0.88;

        // Outer glow
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius * 2.4);
        grad.addColorStop(0, `rgba(${r},${g},${b},${glowAlpha})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},0.15)`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${r},${g},${b},${nodeAlpha})`;
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.stroke();

      } else if (n.type === 'gap') {
        // Pulsing cyan/accent for gap nodes
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.045 + n.x * 0.01);
        const glowR = n.radius * (1.8 + pulse * 1.2);
        const glowAlpha = isHovered ? 0.7 : 0.35 + pulse * 0.25;

        // Outer pulse ring
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR * 1.6);
        grad.addColorStop(0, `rgba(34,211,238,${glowAlpha})`);
        grad.addColorStop(0.5, `rgba(34,211,238,${glowAlpha * 0.3})`);
        grad.addColorStop(1, 'rgba(34,211,238,0)');
        ctx.beginPath();
        ctx.arc(n.x, n.y, glowR * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Node fill
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34,211,238,0.12)`;
        ctx.fill();
        ctx.strokeStyle = `rgba(34,211,238,${0.7 + pulse * 0.3})`;
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.setLineDash([]);
        ctx.stroke();

        // Inner dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34,211,238,${0.6 + pulse * 0.4})`;
        ctx.fill();

        // "GAP" label badge
        ctx.font = '500 8px "Inter", sans-serif';
        ctx.fillStyle = 'rgba(34,211,238,0.9)';
        ctx.textAlign = 'center';
        ctx.fillText('GAP', n.x, n.y + 3);
      }

      // ── Node label ─────────────────────────────────────────────────────────
      const labelY = n.y + n.radius + 14;
      const words  = n.label.split(' ');
      const maxW   = n.radius * 5;
      const lines  = [];
      let cur = '';
      ctx.font = `${n.type === 'gap' ? '600' : '400'} 10.5px "Inter", sans-serif`;
      words.forEach(w => {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && cur) {
          lines.push(cur); cur = w;
        } else { cur = test; }
      });
      if (cur) lines.push(cur);

      const lineH = 13;
      lines.forEach((line, i) => {
        ctx.fillStyle = n.type === 'gap'
          ? `rgba(34,211,238,${isHovered ? 1 : 0.85})`
          : `rgba(200,210,230,${isHovered ? 1 : 0.75})`;
        ctx.textAlign = 'center';
        ctx.fillText(line, n.x, labelY + i * lineH);
      });

      // Hover tooltip for gap nodes: show "Click to view hypothesis"
      if (isHovered && n.type === 'gap' && n.linkedHypIdx !== null) {
        const tip = '↗ Click to view hypothesis';
        ctx.font = '400 9px "Inter", sans-serif';
        const tw = ctx.measureText(tip).width;
        ctx.fillStyle = 'rgba(10,15,28,0.9)';
        ctx.beginPath();
        ctx.roundRect(n.x - tw / 2 - 8, labelY + lines.length * lineH + 2, tw + 16, 16, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(34,211,238,0.9)';
        ctx.textAlign = 'center';
        ctx.fillText(tip, n.x, labelY + lines.length * lineH + 13);
      }

      ctx.restore();
    });

    ctx.restore(); // end pan/zoom
  }
}

// ─── Module-level instance tracker ───────────────────────────────────────────
let _activeGapMap = null;

function initGapMap(canvasId, data, onGapClick) {
  if (_activeGapMap) { _activeGapMap.destroy(); _activeGapMap = null; }
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Make canvas fill its container
  const wrap = canvas.parentElement;
  canvas.width  = wrap.clientWidth  || 900;
  canvas.height = wrap.clientHeight || 520;

  _activeGapMap = new GapMap(canvas, data, onGapClick);
  return _activeGapMap;
}
