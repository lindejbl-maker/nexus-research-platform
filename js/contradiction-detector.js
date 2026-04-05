// ═══ CONTRADICTION DETECTOR ══════════════════════════════════════════════════
// Scans recent literature on any topic, finds where studies directly contradict
// each other, shows both sides, consensus score, and why the contradiction exists.

let contradictionLoading = false;

async function runContradictionDetector() {
  if (contradictionLoading) return;
  const topic   = document.getElementById('cd-topic')?.value?.trim();
  const field   = document.getElementById('cd-field')?.value || '';
  const results = document.getElementById('cd-results');
  const status  = document.getElementById('cd-status');
  const btn     = document.getElementById('cd-btn');
  if (!topic) { showToast('Enter a research topic or claim', 'error'); return; }

  contradictionLoading = true;
  btn.disabled = true;
  results.innerHTML = '';
  status.style.display = 'flex';
  cdSetStatus(status, 'Searching literature…');

  try {
    // ── 1. Fetch papers from Semantic Scholar ─────────────────────────────────
    const papers = await semanticScholar.searchPapers(topic, { field, limit: 30, sort: 'relevance' });
    const withAbstracts = papers.filter(p => p.abstract && p.abstract.length > 100).slice(0, 25);
    if (withAbstracts.length < 4) {
      throw new Error(`Only found ${withAbstracts.length} papers with abstracts on this topic. Try a broader search term.`);
    }
    cdSetStatus(status, `Analysing ${withAbstracts.length} papers for contradictions…`);

    // ── 2. Ask Gemini to detect contradictions ────────────────────────────────
    const analysis = await gemini.detectContradictions(withAbstracts, topic, field);

    // ── 3. Render results ─────────────────────────────────────────────────────
    results.innerHTML = renderContradictions(analysis, topic, withAbstracts.length);
    if (typeof logActivity === 'function') logActivity(`Contradiction scan: "${topic.substring(0, 50)}"`);

  } catch (err) {
    results.innerHTML = `<div class="error-state">⚠ ${escHtml(err.message)}</div>`;
  } finally {
    contradictionLoading = false;
    btn.disabled = false;
    status.style.display = 'none';
  }
}

function cdSetStatus(el, msg) {
  const s = el.querySelector('span');
  if (s) s.textContent = msg;
}

function renderContradictions(analysis, topic, paperCount) {
  if (!analysis?.contradictions?.length) {
    return `<div class="cd-no-conflicts">
      <div style="font-size:2rem;margin-bottom:1rem;">✅</div>
      <h3>No significant contradictions found</h3>
      <p>The literature on "<strong>${escHtml(topic)}</strong>" appears broadly consistent across ${paperCount} papers. This could mean strong scientific consensus, or the field is still early-stage with limited replication studies.</p>
    </div>`;
  }

  const overallHtml = analysis.overallConsensus != null ? `
    <div class="cd-overview">
      <div class="cd-overview-label">FIELD CONSENSUS STRENGTH</div>
      <div class="cd-consensus-bar-wrap">
        <div class="cd-consensus-bar" style="width:${analysis.overallConsensus}%"></div>
      </div>
      <div class="cd-overview-row">
        <div class="cd-consensus-pct">${analysis.overallConsensus}%</div>
        ${typeof ConfidenceBadge !== 'undefined' ? ConfidenceBadge.fromConsensus(analysis.overallConsensus) : ''}
      </div>
      <div class="cd-overview-note">${escHtml(analysis.overallNote || '')}</div>
    </div>` : '';

  const contraHtml = analysis.contradictions.map((c, i) => {
    const sideAScore = c.sideAConsensus || 50;
    const sideBScore = 100 - sideAScore;
    const severity   = c.severity === 'high' ? 'cd-sev-high' : c.severity === 'medium' ? 'cd-sev-med' : 'cd-sev-low';
    return `
      <div class="cd-card">
        <div class="cd-card-header">
          <div class="cd-card-num">${String(i + 1).padStart(2, '0')}</div>
          <div class="cd-card-title">${escHtml(c.claim || 'Contested claim')}</div>
          <div class="cd-card-badges">
            ${typeof ConfidenceBadge !== 'undefined' ? ConfidenceBadge.fromSeverity(c.severity) : ''}
            <span class="cd-severity ${severity}">${c.severity || 'medium'} conflict</span>
          </div>
        </div>
        <div class="cd-sides">
          <div class="cd-side cd-side-a">
            <div class="cd-side-label">
              <span class="cd-side-badge cd-badge-a">SIDE A</span>
              <span class="cd-side-score">${sideAScore}% of studies</span>
            </div>
            <div class="cd-side-claim">${escHtml(c.sideA?.claim || '')}</div>
            <div class="cd-side-papers">${(c.sideA?.papers || []).map(p => `<span class="cd-paper-ref">${escHtml(p)}</span>`).join('')}</div>
          </div>
          <div class="cd-vs">VS</div>
          <div class="cd-side cd-side-b">
            <div class="cd-side-label">
              <span class="cd-side-badge cd-badge-b">SIDE B</span>
              <span class="cd-side-score">${sideBScore}% of studies</span>
            </div>
            <div class="cd-side-claim">${escHtml(c.sideB?.claim || '')}</div>
            <div class="cd-side-papers">${(c.sideB?.papers || []).map(p => `<span class="cd-paper-ref">${escHtml(p)}</span>`).join('')}</div>
          </div>
        </div>

        <div class="cd-bar-row">
          <div class="cd-split-bar">
            <div class="cd-split-a" style="width:${sideAScore}%"></div>
            <div class="cd-split-b" style="width:${sideBScore}%"></div>
          </div>
        </div>

        <div class="cd-why">
          <div class="cd-why-label">🔍 Why this contradiction exists</div>
          <div class="cd-why-text">${escHtml(c.whyItExists || '')}</div>
        </div>

        ${c.resolution ? `<div class="cd-resolution"><strong>🧩 How to resolve it:</strong> ${escHtml(c.resolution)}</div>` : ''}
        ${c.hypothesisOpportunity ? `<div class="cd-opportunity">💡 <strong>Research opportunity:</strong> ${escHtml(c.hypothesisOpportunity)}</div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="cd-results-header">
      <div>
        <div class="cd-results-title">Contradiction Analysis: <em>${escHtml(topic)}</em></div>
        <div class="cd-results-sub">${paperCount} papers analysed · ${analysis.contradictions.length} contradiction${analysis.contradictions.length !== 1 ? 's' : ''} found</div>
      </div>
    </div>
    ${overallHtml}
    <div class="cd-cards">${contraHtml}</div>
    ${AI_DISCLAIMER}`;
}

console.log('[ContradictionDetector] Loaded');
