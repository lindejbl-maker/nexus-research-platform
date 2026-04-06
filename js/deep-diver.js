// ═══ PAPER DEEP-DIVER ════════════════════════════════════════════════════════
// Feature 1: Paste DOI / arXiv ID / URL / abstract → instant structured analysis
// Outputs: PICO, statistics, red flags, limitations, follow-up experiments

// CORS proxy for local dev — mirrors the pattern in gemini.js / citation-graph.js
function _ddProxy(url) {
  const isLocal = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  return isLocal ? `https://corsproxy.io/?${encodeURIComponent(url)}` : url;
}

let deepDiverLoading = false;

// ─── Entry point ──────────────────────────────────────────────────────────────
async function runDeepDiver() {
  if (deepDiverLoading) return;
  const input   = document.getElementById('dd-input')?.value?.trim();
  const field   = document.getElementById('dd-field')?.value || '';
  const results = document.getElementById('dd-results');
  const status  = document.getElementById('dd-status');
  const btn     = document.getElementById('dd-btn');
  if (!input) { showToast('Paste a DOI, arXiv ID, URL, or abstract', 'error'); return; }

  deepDiverLoading = true;
  btn.disabled = true;
  results.innerHTML = '';
  status.style.display = 'flex';

  try {
    let paperData = null;

    // ── 1. Try to resolve identifier to a real paper ──────────────────────────
    const doiMatch   = input.match(/10\.\d{4,}\/\S+/);
    const arxivMatch = input.match(/(?:arxiv\.org\/abs\/|arXiv:)([\d\.]+v?\d*)/i);
    const pmidMatch  = input.match(/(?:^|\s)(PMID:?\s*)?(\d{7,8})(?:\s|$)/);

    if (doiMatch) {
      setStatus(status, 'Fetching paper by DOI…');
      try {
        const res = await fetch(_ddProxy(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doiMatch[0])}?fields=title,abstract,authors,year,fieldsOfStudy,externalIds,citationCount,publicationVenue`));
        if (res.ok) paperData = await res.json();
      } catch (_) {}
    } else if (arxivMatch) {
      setStatus(status, 'Fetching paper by arXiv ID…');
      try {
        const res = await fetch(_ddProxy(`https://api.semanticscholar.org/graph/v1/paper/ARXIV:${arxivMatch[1]}?fields=title,abstract,authors,year,fieldsOfStudy,externalIds,citationCount`));
        if (res.ok) paperData = await res.json();
      } catch (_) {}
    } else if (pmidMatch) {
      setStatus(status, 'Fetching paper by PubMed ID…');
      try {
        const pmid = pmidMatch[2];
        const res = await fetch(_ddProxy(`https://api.semanticscholar.org/graph/v1/paper/PMID:${pmid}?fields=title,abstract,authors,year,fieldsOfStudy,externalIds,citationCount`));
        if (res.ok) paperData = await res.json();
      } catch (_) {}
    }

    // ── 2. Build analysis content ─────────────────────────────────────────────
    const abstractText = paperData?.abstract || (input.length > 200 ? input : null);
    if (!abstractText && !paperData) {
      throw new Error('Could not find a paper with that identifier, and the input is too short to be an abstract. Try pasting the full abstract text.');
    }

    const analysisText = abstractText || paperData?.title || input;
    const paperMeta    = paperData ? {
      title:        paperData.title,
      authors:      paperData.authors?.map(a => a.name).join(', '),
      year:         paperData.year,
      citations:    paperData.citationCount,
      fields:       paperData.fieldsOfStudy?.map(f => f.name).join(', '),
      doi:          paperData.externalIds?.DOI
    } : null;

    setStatus(status, 'Gemini is reading the paper…');
    const analysis = await gemini.analyzePaper(analysisText, field, paperMeta);

    // ── 3. Render results ─────────────────────────────────────────────────────
    results.innerHTML = renderDeepDiverResult(analysis, paperMeta);
    if (typeof logActivity === 'function') logActivity(`Deep-dived: "${(paperMeta?.title || 'abstract').substring(0, 50)}…"`);

    // ── 4. Citation Verification (non-blocking) ───────────────────────────────
    if (typeof CitationVerifier !== 'undefined') {
      setTimeout(() => CitationVerifier.scanAndBadge(results), 400);
    }

    // ── 5. Save to notebook-compatible format if notebook is loaded ───────────
    if (typeof notebookAddEntry === 'function' && paperMeta?.title) {
      notebookAddEntry(`📄 Analysed: "${paperMeta.title}"\n\nKey finding: ${analysis.keyFinding || ''}\nRed flags: ${(analysis.redFlags || []).join('; ') || 'None'}`, ['deep-diver', 'paper-analysis'], false);
    }

  } catch (err) {
    results.innerHTML = `<div class="error-state">⚠ ${escHtml(err.message)}</div>`;
  } finally {
    deepDiverLoading = false;
    btn.disabled = false;
    status.style.display = 'none';
  }
}

// ─── Render analysis result ───────────────────────────────────────────────────
function renderDeepDiverResult(analysis, meta) {
  const flagsHtml = (analysis.redFlags || []).map(f =>
    `<div class="dd-flag-item"><span class="dd-flag-icon">⚠</span><span>${escHtml(f)}</span></div>`
  ).join('') || '<div class="dd-flag-item"><span class="dd-flag-icon ok">✓</span><span>No major red flags detected</span></div>';

  const statsHtml = (analysis.statistics || []).map(s =>
    `<div class="dd-stat-item">
      <div class="dd-stat-raw">${escHtml(s.raw)}</div>
      <div class="dd-stat-plain">${escHtml(s.explanation)}</div>
    </div>`
  ).join('') || '<div class="dd-empty-item">No statistical values found in this text.</div>';

  const followUpsHtml = (analysis.followUps || []).map((f, i) =>
    `<div class="dd-followup-item">
      <span class="dd-followup-num">${i + 1}</span>
      <div>
        <div class="dd-followup-title">${escHtml(f.experiment)}</div>
        <div class="dd-followup-why">${escHtml(f.rationale)}</div>
      </div>
    </div>`
  ).join('');

  const metaHtml = meta ? `
    <div class="dd-paper-meta">
      <div class="dd-meta-title">${escHtml(meta.title || '')}</div>
      <div class="dd-meta-sub">
        ${meta.authors ? `<span>${escHtml(meta.authors.substring(0, 80))}${meta.authors.length > 80 ? '…' : ''}</span>` : ''}
        ${meta.year   ? `<span>${meta.year}</span>` : ''}
        ${meta.citations != null ? `<span>${meta.citations.toLocaleString()} citations</span>` : ''}
        ${meta.doi    ? `<a href="https://doi.org/${escHtml(meta.doi)}" target="_blank" rel="noopener">View paper ↗</a>` : ''}
      </div>
    </div>` : '';

  const picoHtml = analysis.pico ? `
    <div class="dd-section">
      <div class="dd-section-title"><span class="dd-section-icon">🎯</span>PICO Breakdown</div>
      <div class="dd-pico-grid">
        <div class="dd-pico-item"><div class="dd-pico-label">P — Population</div><div class="dd-pico-val">${escHtml(analysis.pico.population || '—')}</div></div>
        <div class="dd-pico-item"><div class="dd-pico-label">I — Intervention</div><div class="dd-pico-val">${escHtml(analysis.pico.intervention || '—')}</div></div>
        <div class="dd-pico-item"><div class="dd-pico-label">C — Comparison</div><div class="dd-pico-val">${escHtml(analysis.pico.comparison || '—')}</div></div>
        <div class="dd-pico-item"><div class="dd-pico-label">O — Outcome</div><div class="dd-pico-val">${escHtml(analysis.pico.outcome || '—')}</div></div>
      </div>
    </div>` : '';

  return `
    ${metaHtml}
    <div class="dd-analysis-grid">
      ${picoHtml}

      <div class="dd-section">
        <div class="dd-section-title"><span class="dd-section-icon">💡</span>Key Finding</div>
        <div class="dd-key-finding">${escHtml(analysis.keyFinding || '—')}</div>
      </div>

      <div class="dd-section">
        <div class="dd-section-title"><span class="dd-section-icon">📊</span>Statistics Explained</div>
        <div class="dd-stats-list">${statsHtml}</div>
      </div>

      <div class="dd-section dd-section-danger">
        <div class="dd-section-title"><span class="dd-section-icon">🚩</span>Red Flags & Limitations</div>
        <div class="dd-flags-list">${flagsHtml}</div>
      </div>

      <div class="dd-section">
        <div class="dd-section-title"><span class="dd-section-icon">🚫</span>What This Does NOT Prove</div>
        <div class="dd-not-proven">${escHtml(analysis.notProven || '—')}</div>
      </div>

      <div class="dd-section dd-section-followups">
        <div class="dd-section-title"><span class="dd-section-icon">🧪</span>Suggested Follow-Up Experiments</div>
        <div class="dd-followups-list">${followUpsHtml}</div>
      </div>
    </div>
    ${AI_DISCLAIMER}`;
}

// ─── Populate DD from a saved paper (called from Saved Papers page) ───────────
function deepDivePaper(paperId) {
  const paper = savedPapers.find(p => p.paperId === paperId);
  if (!paper) return;
  showPage('deepdiver', document.getElementById('nav-deepdiver'));
  const input = document.getElementById('dd-input');
  if (input) {
    input.value = paper.externalIds?.DOI
      ? `https://doi.org/${paper.externalIds.DOI}`
      : (paper.abstract || paper.title || '');
    document.getElementById('dd-field').value = paper.fieldsOfStudy?.[0]?.name || '';
  }
}

function setStatus(el, msg) {
  const txt = el.querySelector('span');
  if (txt) txt.textContent = msg;
}

console.log('[DeepDiver] Paper Deep-Diver loaded');
