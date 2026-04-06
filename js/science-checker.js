// ═══ "IS THIS SETTLED SCIENCE?" CHECKER ═════════════════════════════════════
// Analyses a scientific claim against the real literature and returns a
// structured verdict: Settled · Debated · Emerging · Contradicted
//
// Flow:
//   1. User enters a claim
//   2. Semantic Scholar fetches up to 30 relevant papers
//   3. Gemini analyses the claim vs. paper abstracts, returns structured JSON
//   4. Verdict card + consensus meter + evidence papers are rendered
//   5. If verdict is "Debated" → button to send to Contradiction Detector
// ─────────────────────────────────────────────────────────────────────────────

let scienceCheckerLoading = false;

async function runScienceChecker() {
  if (scienceCheckerLoading) return;
  const claim   = document.getElementById('sc-claim')?.value?.trim();
  const results = document.getElementById('sc-results');
  const status  = document.getElementById('sc-status');
  const btn     = document.getElementById('sc-btn');

  if (!claim) { showToast('Enter a scientific claim to check', 'error'); return; }

  scienceCheckerLoading = true;
  btn.disabled  = true;
  results.innerHTML = '';
  status.style.display = 'flex';
  scSetStatus(status, 'Searching literature…');

  try {
    // ── 1. Fetch papers from Semantic Scholar ──────────────────────────────
    const papers = await semanticScholar.searchPapers(claim, { limit: 30, sort: 'relevance' });
    const withAbstracts = papers.filter(p => p.abstract && p.abstract.length > 80).slice(0, 25);

    scSetStatus(status, `Analysing ${withAbstracts.length} papers…`);

    // ── 2. Ask Gemini for a verdict ────────────────────────────────────────
    const verdict = await scGetVerdict(claim, withAbstracts);

    // ── 3. Render ──────────────────────────────────────────────────────────
    results.innerHTML = scRender(verdict, claim, withAbstracts.length);

    if (typeof logActivity === 'function') logActivity(`Science check: "${claim.substring(0, 60)}"`);

  } catch (err) {
    results.innerHTML = `<div class="error-state">⚠ ${escHtml(err.message)}</div>`;
  } finally {
    scienceCheckerLoading = false;
    btn.disabled = false;
    status.style.display = 'none';
  }
}

function scSetStatus(el, msg) {
  const s = el.querySelector('span');
  if (s) s.textContent = msg;
}

// ── Gemini verdict call ───────────────────────────────────────────────────────
async function scGetVerdict(claim, papers) {
  const abstracts = papers.slice(0, 20).map((p, i) =>
    `[${i + 1}] "${p.title}" (${p.year || 'n/a'}) — ${(p.abstract || '').substring(0, 250)}`
  ).join('\n\n');

  const prompt = `You are a scientific fact-checker with expertise in evidence-based medicine and research methodology.

CLAIM TO CHECK: "${claim}"

RELEVANT LITERATURE (${papers.length} papers from Semantic Scholar):
${abstracts}

Analyse whether this claim is supported, debated, emerging, or contradicted by the literature above.

Return a JSON object with EXACTLY these fields:
{
  "verdict": "Settled" | "Debated" | "Emerging" | "Contradicted",
  "verdictEmoji": "🟢" | "🟡" | "🔴" | "⚫",
  "consensusScore": number (0-100, where 100 = perfect scientific consensus),
  "summary": "2-3 sentence plain-English explanation of the overall evidence",
  "supportingEvidence": [
    { "point": "specific finding from the literature", "paperRef": "Author et al., Year" }
  ],
  "contradictingEvidence": [
    { "point": "specific counter-finding", "paperRef": "Author et al., Year" }
  ],
  "keyLimitations": "1-2 sentences on the main methodological gaps or caveats in this literature",
  "whatWouldSettleIt": "1-2 sentences on what research would definitively resolve this question",
  "forNonExperts": "One plain English sentence suitable for a patient or journalist",
  "sendToContradiction": boolean (true if contradictingEvidence is non-empty and the debate is significant)
}

Verdict definitions:
- "Settled": 80%+ papers agree, strong replication, robust methodology
- "Debated": Significant papers on both sides, active scientific controversy
- "Emerging": <10 papers, early-stage, limited replication
- "Contradicted": Weight of evidence AGAINST the claim

Return ONLY valid JSON, no markdown.`;

  const raw = await gemini.generate(prompt, '', 0.2, 'science-checker');
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); }
  catch { throw new Error('Could not parse verdict — try rephrasing the claim.'); }
}

// ── Render ────────────────────────────────────────────────────────────────────
function scRender(v, claim, paperCount) {
  const VERDICT_CONFIG = {
    'Settled':      { bg: 'rgba(52,211,153,0.06)',  border: 'rgba(52,211,153,0.2)',  textColor: '#34D399', barColor: '#34D399', label: 'Settled Science'    },
    'Debated':      { bg: 'rgba(251,191,36,0.06)',  border: 'rgba(251,191,36,0.2)',  textColor: '#FBBF24', barColor: '#FBBF24', label: 'Actively Debated'   },
    'Emerging':     { bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.2)', textColor: '#F87171', barColor: '#F87171', label: 'Emerging Evidence'   },
    'Contradicted': { bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.2)', textColor: '#94A3B8', barColor: '#64748B', label: 'Evidence Contradicts' },
  };
  const cfg = VERDICT_CONFIG[v.verdict] || VERDICT_CONFIG['Emerging'];
  const score = Math.min(100, Math.max(0, v.consensusScore || 50));

  const supportHTML = (v.supportingEvidence || []).slice(0, 4).map(e => `
    <div class="sc-evidence-item sc-evidence-for">
      <span class="sc-ev-dot" style="background:#34D399"></span>
      <div><div class="sc-ev-point">${escHtml(e.point || '')}</div>
      <div class="sc-ev-ref">${escHtml(e.paperRef || '')}</div></div>
    </div>`).join('');

  const againstHTML = (v.contradictingEvidence || []).slice(0, 4).map(e => `
    <div class="sc-evidence-item sc-evidence-against">
      <span class="sc-ev-dot" style="background:#F87171"></span>
      <div><div class="sc-ev-point">${escHtml(e.point || '')}</div>
      <div class="sc-ev-ref">${escHtml(e.paperRef || '')}</div></div>
    </div>`).join('');

  const contradictionBtn = v.sendToContradiction
    ? `<button class="sc-goto-contradiction-btn" onclick="scSendToContradiction(${JSON.stringify(claim)})">
        ⚔️ Deep-dive contradictions in Contradiction Detector →
      </button>`
    : '';

  return `
    <div class="sc-verdict-card" style="--vc-bg:${cfg.bg};--vc-border:${cfg.border};">
      <!-- Verdict banner -->
      <div class="sc-verdict-banner">
        <div class="sc-verdict-emoji">${v.verdictEmoji || '🔍'}</div>
        <div class="sc-verdict-meta">
          <div class="sc-verdict-label" style="color:${cfg.textColor}">${cfg.label}</div>
          <div class="sc-verdict-claim">"${escHtml(claim)}"</div>
          <div class="sc-verdict-sub">${paperCount} papers analysed via Semantic Scholar</div>
        </div>
        ${typeof ConfidenceBadge !== 'undefined'
          ? ConfidenceBadge.render(v.verdict === 'Settled' ? 'Supported' : v.verdict === 'Contradicted' ? 'No Evidence' : v.verdict === 'Debated' ? 'Contested' : 'Emerging', null)
          : ''}
      </div>

      <!-- Consensus meter -->
      <div class="sc-meter-section">
        <div class="sc-meter-label">
          <span>Disagreement</span>
          <span class="sc-meter-pct" style="color:${cfg.textColor}">${score}% consensus</span>
          <span>Consensus</span>
        </div>
        <div class="sc-meter-track">
          <div class="sc-meter-fill" style="width:${score}%;background:${cfg.barColor};"></div>
          <div class="sc-meter-needle" style="left:${score}%;" title="${score}% scientific consensus"></div>
        </div>
      </div>

      <!-- Plain English summary -->
      <div class="sc-section">
        <div class="sc-section-label">📋 Summary</div>
        <div class="sc-summary-text">${escHtml(v.summary || '')}</div>
      </div>

      <!-- For non-experts -->
      ${v.forNonExperts ? `
      <div class="sc-section sc-plain-section">
        <div class="sc-section-label">💬 In plain English</div>
        <div class="sc-plain-text">${escHtml(v.forNonExperts)}</div>
      </div>` : ''}

      <!-- Evidence columns -->
      <div class="sc-evidence-grid">
        <div class="sc-evidence-col">
          <div class="sc-ev-col-header" style="color:#34D399">✓ Supporting evidence</div>
          ${supportHTML || '<div class="sc-ev-empty">No supporting evidence found in this literature</div>'}
        </div>
        <div class="sc-evidence-col">
          <div class="sc-ev-col-header" style="color:#F87171">✗ Contradicting evidence</div>
          ${againstHTML || '<div class="sc-ev-empty">No significant contradictions found</div>'}
        </div>
      </div>

      <!-- Limitations + what would settle it -->
      ${v.keyLimitations ? `
      <div class="sc-section">
        <div class="sc-section-label">⚠ Key limitations in this literature</div>
        <div class="sc-limitation-text">${escHtml(v.keyLimitations)}</div>
      </div>` : ''}

      ${v.whatWouldSettleIt ? `
      <div class="sc-section sc-settle-section">
        <div class="sc-section-label">🔬 What would settle this question?</div>
        <div class="sc-settle-text">${escHtml(v.whatWouldSettleIt)}</div>
      </div>` : ''}

      <!-- Send to Contradiction Detector -->
      ${contradictionBtn}
    </div>
    ${AI_DISCLAIMER}`;
}

// ── Send claim to Contradiction Detector ──────────────────────────────────────
function scSendToContradiction(claim) {
  const input = document.getElementById('cd-topic');
  if (input) input.value = claim;
  const navItem = document.getElementById('nav-contradiction');
  if (navItem) showPage('contradiction', navItem);
  showToast('Claim sent to Contradiction Detector', 'success');
}

// ── Enter key support ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sc-claim')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') runScienceChecker();
  });
});

console.log('[ScienceChecker] Loaded');
