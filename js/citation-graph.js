// ═══ CITATION GRAPH ENGINE ════════════════════════════════════════════════════
// Builds a real research landscape map from Semantic Scholar citation data.
// Replaces AI-invented gap map nodes with data derived from actual papers.
// ─────────────────────────────────────────────────────────────────────────────

const citationGraph = {

  // CORS proxy for local dev
  _proxy(url) {
    const isLocal = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return isLocal ? `https://corsproxy.io/?${encodeURIComponent(url)}` : url;
  },

  // ─── Step 1: Fetch papers with their reference lists ───────────────────────
  async fetchPapersWithRefs(topic, field = '', limit = 40) {
    const fields = 'paperId,title,abstract,year,authors,fieldsOfStudy,references,citationCount';
    let url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(topic)}&fields=${fields}&limit=${limit}`;
    if (field) url += `&fieldsOfStudy=${encodeURIComponent(field)}`;

    const res = await fetch(this._proxy(url));
    if (!res.ok) throw new Error(`Semantic Scholar fetch failed (${res.status})`);
    const data = await res.json();
    return (data.data || []).filter(p => p.title && p.abstract);
  },


  // ─── Step 2: Build co-citation frequency matrix ────────────────────────────
  // Two papers are "co-cited" when they appear together in a reference list.
  // High co-citation = strong relationship between topics.
  buildCoCitationMatrix(papers) {
    const coMatrix = {}; // { "id1::id2": count }

    papers.forEach(paper => {
      const refs = (paper.references || []).map(r => r.paperId).filter(Boolean);
      // Find which of our fetched papers are referenced by this paper
      const myPaperIds = new Set(papers.map(p => p.paperId));
      const localRefs = refs.filter(id => myPaperIds.has(id));

      // Count every pair that appears together in this paper's references
      for (let i = 0; i < localRefs.length; i++) {
        for (let j = i + 1; j < localRefs.length; j++) {
          const key = [localRefs[i], localRefs[j]].sort().join('::');
          coMatrix[key] = (coMatrix[key] || 0) + 1;
        }
      }
    });

    return coMatrix;
  },

  // ─── Step 3: Cluster papers by fieldsOfStudy overlap ──────────────────────
  clusterPapers(papers) {
    const clusterMap = {}; // fieldLabel → [paperId]

    papers.forEach(paper => {
      const fields = paper.fieldsOfStudy || ['General'];
      // Use the first field as primary cluster
      const primaryField = fields[0] || 'General';
      if (!clusterMap[primaryField]) clusterMap[primaryField] = [];
      clusterMap[primaryField].push(paper.paperId);
    });

    // Assign cluster indices (max 5 clusters for visualisation clarity)
    const clusterKeys = Object.keys(clusterMap).slice(0, 5);
    const clusterIndex = {};
    clusterKeys.forEach((key, idx) => {
      clusterMap[key].forEach(id => { clusterIndex[id] = idx; });
    });

    return clusterIndex;
  },

  // ─── Step 4: Convert to graph data format for gap-map.js ──────────────────
  toGraphData(papers, coMatrix, clusterIndex, hypotheses = []) {
    // Select best papers as nodes (limit to 12 for readability)
    const topPapers = [...papers]
      .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))
      .slice(0, 12);

    const nodeIds = new Set(topPapers.map(p => p.paperId));

    // Build nodes — each studied paper becomes a node
    const nodes = topPapers.map((paper, i) => {
      // Spread nodes across the canvas using golden ratio for even distribution
      const angle = i * 2.399963; // golden angle in radians
      const radius = 0.25 + (i % 4) * 0.12;
      return {
        id: paper.paperId,
        label: this._shortenTitle(paper.title),
        fullTitle: paper.title,
        year: paper.year,
        cluster: clusterIndex[paper.paperId] ?? (i % 5),
        x_hint: 0.5 + radius * Math.cos(angle),
        y_hint: 0.5 + radius * Math.sin(angle),
        citationCount: paper.citationCount || 0,
        real: true // flag: derived from real data
      };
    });

    // Build edges from co-citation matrix
    const edges = [];
    Object.entries(coMatrix).forEach(([key, count]) => {
      const [fromId, toId] = key.split('::');
      if (nodeIds.has(fromId) && nodeIds.has(toId) && count >= 1) {
        edges.push({
          from: fromId,
          to: toId,
          strength: Math.min(count / 5, 1.0) // normalise to 0–1
        });
      }
    });

    // Identify REAL gaps: topic combinations with zero co-citation
    // Gaps are placed in the visual empty space between dense clusters
    const gaps = this._identifyGaps(nodes, edges, hypotheses);

    return { nodes, edges, gaps, paperCount: papers.length, isReal: true };
  },

  // ─── Step 5: Identify gaps from sparse co-citation pairs ──────────────────
  _identifyGaps(nodes, edges, hypotheses = []) {
    const connectedPairs = new Set(edges.map(e => [e.from, e.to].sort().join('::')));

    // Find cluster centroids
    const clusterCentroids = {};
    nodes.forEach(n => {
      if (!clusterCentroids[n.cluster]) clusterCentroids[n.cluster] = { x: 0, y: 0, count: 0 };
      clusterCentroids[n.cluster].x += n.x_hint;
      clusterCentroids[n.cluster].y += n.y_hint;
      clusterCentroids[n.cluster].count++;
    });
    Object.keys(clusterCentroids).forEach(k => {
      clusterCentroids[k].x /= clusterCentroids[k].count;
      clusterCentroids[k].y /= clusterCentroids[k].count;
    });

    const clusterKeys = Object.keys(clusterCentroids);
    const gaps = [];

    // Each gap is positioned at the midpoint between two under-connected clusters
    for (let i = 0; i < clusterKeys.length && gaps.length < 5; i++) {
      for (let j = i + 1; j < clusterKeys.length && gaps.length < 5; j++) {
        const ca = clusterCentroids[clusterKeys[i]];
        const cb = clusterCentroids[clusterKeys[j]];

        // Check if any edge spans these two clusters — if not, it's a real gap
        const hasConnection = edges.some(e => {
          const nFrom = nodes.find(n => n.id === e.from);
          const nTo   = nodes.find(n => n.id === e.to);
          return (nFrom?.cluster === +clusterKeys[i] && nTo?.cluster === +clusterKeys[j]) ||
                 (nFrom?.cluster === +clusterKeys[j] && nTo?.cluster === +clusterKeys[i]);
        });

        if (!hasConnection) {
          const linkedHyp = hypotheses[gaps.length];
          gaps.push({
            id: `gap-${clusterKeys[i]}-${clusterKeys[j]}`,
            label: linkedHyp ? this._shortenTitle(linkedHyp.title) : `Gap: Cluster ${+clusterKeys[i] + 1} ↔ ${+clusterKeys[j] + 1}`,
            x_hint: (ca.x + cb.x) / 2,
            y_hint: (ca.y + cb.y) / 2,
            linkedHypothesisIdx: gaps.length,
            real: true
          });
        }
      }
    }

    // If no cluster gaps found (tightly connected field), use position-based gaps
    if (gaps.length === 0) {
      const gapPositions = [
        { x: 0.15, y: 0.15 }, { x: 0.85, y: 0.15 },
        { x: 0.5, y: 0.85 }, { x: 0.15, y: 0.75 }, { x: 0.85, y: 0.75 }
      ];
      hypotheses.slice(0, 5).forEach((h, i) => {
        gaps.push({
          id: `gap-pos-${i}`,
          label: this._shortenTitle(h.title),
          x_hint: gapPositions[i % gapPositions.length].x,
          y_hint: gapPositions[i % gapPositions.length].y,
          linkedHypothesisIdx: i,
          real: false
        });
      });
    }

    return gaps;
  },

  // ─── Helper: shorten title to 4 words max for node labels ─────────────────
  _shortenTitle(title) {
    if (!title) return 'Unknown';
    const words = title.split(' ').filter(w => w.length > 2); // skip short words
    return words.slice(0, 4).join(' ');
  },

  // ─── Main entry point ──────────────────────────────────────────────────────
  // Fetches papers, builds the graph, returns structured data.
  // Falls back gracefully if Semantic Scholar is unavailable.
  async build(topic, field = '', hypotheses = []) {
    try {
      const papers = await this.fetchPapersWithRefs(topic, field, 40);
      if (!papers.length) throw new Error('No papers found');

      const coMatrix     = this.buildCoCitationMatrix(papers);
      const clusterIndex = this.clusterPapers(papers);
      const graphData    = this.toGraphData(papers, coMatrix, clusterIndex, hypotheses);

      console.log(`[CitationGraph] Built real graph: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges, ${graphData.gaps.length} gaps from ${papers.length} papers`);
      return graphData;

    } catch (err) {
      console.warn(`[CitationGraph] Falling back to AI-generated map: ${err.message}`);
      // Return null to signal that gemini.generateGapMapData() should be used as fallback
      return null;
    }
  }
};
