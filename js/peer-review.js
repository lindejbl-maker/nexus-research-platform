// ═══ PEER REVIEW RESPONSE GENERATOR ═════════════════════════════════════════
// Feature 2: Paste reviewer comments + your abstract → professional rebuttal letter

let peerReviewLoading = false;
let lastPeerReviewOutput = '';

// ─── Entry point ──────────────────────────────────────────────────────────────
async function generatePeerReview() {
  if (peerReviewLoading) return;
  const comments  = document.getElementById('pr-comments')?.value?.trim();
  const abstract  = document.getElementById('pr-abstract')?.value?.trim();
  const journal   = document.getElementById('pr-journal')?.value?.trim() || '';
  const tone      = document.getElementById('pr-tone')?.value || 'professional';
  const results   = document.getElementById('pr-results');
  const status    = document.getElementById('pr-status');
  const btn       = document.getElementById('pr-btn');

  if (!comments) { showToast('Paste the reviewer comments first', 'error'); return; }
  if (!abstract) { showToast('Add your paper abstract or title', 'error'); return; }

  peerReviewLoading = true;
  btn.disabled = true;
  results.innerHTML = '';
  status.style.display = 'flex';

  try {
    status.querySelector('span').textContent = 'Reading reviewer comments…';
    const parsed   = parseReviewerComments(comments);
    status.querySelector('span').textContent = `Generating responses to ${parsed.length} comment${parsed.length !== 1 ? 's' : ''}…`;
    const response = await gemini.generatePeerReviewResponse(comments, abstract, journal, tone, parsed);

    lastPeerReviewOutput = response.letter || '';
    results.innerHTML    = renderPeerReviewResult(response, parsed.length, journal);
    if (typeof logActivity === 'function') logActivity('Generated peer review response letter');
  } catch (err) {
    results.innerHTML = `<div class="error-state">⚠ ${escHtml(err.message)}</div>`;
  } finally {
    peerReviewLoading = false;
    btn.disabled      = false;
    status.style.display = 'none';
  }
}

// ─── Parse reviewer comments into numbered points ─────────────────────────────
// Handles formats: "1.", "Comment 1:", "Reviewer 1:", bullet points, line breaks
function parseReviewerComments(raw) {
  const lines   = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const points  = [];
  let current   = '';
  let reviewer  = 1;

  for (const line of lines) {
    const isHeader = /^(reviewer\s*\d+|major\s+comments?|minor\s+comments?|general\s+comments?)/i.test(line);
    const isNumbered = /^(\d+[\.\)\-]|[•\-\*])\s/.test(line);

    if (isHeader) {
      const m = line.match(/reviewer\s*(\d+)/i);
      if (m) reviewer = parseInt(m[1]);
      if (current.trim()) { points.push({ reviewer, text: current.trim() }); current = ''; }
    } else if (isNumbered && current.trim()) {
      points.push({ reviewer, text: current.trim() });
      current = line.replace(/^(\d+[\.\)\-]|[•\-\*])\s/, '');
    } else {
      current += (current ? ' ' : '') + line;
    }
  }
  if (current.trim()) points.push({ reviewer, text: current.trim() });

  // If no structure detected, treat each paragraph as a separate comment
  if (points.length <= 1 && raw.includes('\n\n')) {
    return raw.split('\n\n').filter(p => p.trim().length > 20)
      .map((text, i) => ({ reviewer: Math.floor(i / 3) + 1, text: text.trim() }));
  }
  return points.length ? points : [{ reviewer: 1, text: raw }];
}

// ─── Render the response ──────────────────────────────────────────────────────
function renderPeerReviewResult(response, commentCount, journal) {
  const pointsHtml = (response.points || []).map((p, i) => `
    <div class="pr-point-card ${p.stance === 'accept' ? 'pr-accept' : p.stance === 'decline' ? 'pr-decline' : 'pr-partial'}">
      <div class="pr-point-header">
        <div class="pr-point-label">
          <span class="pr-reviewer-badge">R${p.reviewer || 1}</span>
          Comment ${i + 1}
        </div>
        <span class="pr-stance-badge pr-stance-${p.stance || 'accept'}">
          ${p.stance === 'accept' ? '✓ Accept' : p.stance === 'decline' ? '✗ Decline' : '~ Partial'}
        </span>
      </div>
      <div class="pr-original-comment">"${escHtml((p.originalComment || '').substring(0, 200))}${(p.originalComment || '').length > 200 ? '…' : ''}"</div>
      <div class="pr-response-text">${escHtml(p.response || '')}</div>
      ${p.paperEdit ? `<div class="pr-paper-edit"><strong>📝 Suggested paper edit:</strong> ${escHtml(p.paperEdit)}</div>` : ''}
      ${p.citeSuggestion ? `<div class="pr-cite-suggest"><strong>📚 Cite:</strong> ${escHtml(p.citeSuggestion)}</div>` : ''}
    </div>`).join('');

  const openingHtml = response.opening
    ? `<div class="pr-letter-section"><div class="pr-section-label">OPENING</div><div class="pr-letter-text">${escHtml(response.opening)}</div></div>`
    : '';

  const closingHtml = response.closing
    ? `<div class="pr-letter-section"><div class="pr-section-label">CLOSING</div><div class="pr-letter-text">${escHtml(response.closing)}</div></div>`
    : '';

  return `
    <div class="pr-result-header">
      <div>
        <div class="pr-result-title">Response Letter Generated</div>
        <div class="pr-result-sub">${commentCount} reviewer comment${commentCount !== 1 ? 's' : ''} addressed${journal ? ` · ${escHtml(journal)}` : ''}</div>
      </div>
      <div class="pr-export-row">
        <button class="paper-btn" onclick="copyPeerReview()">📋 Copy letter</button>
        <button class="paper-btn" onclick="exportPeerReviewDocx()">⬇ Export DOCX</button>
      </div>
    </div>

    ${openingHtml}

    <div class="pr-section-label" style="margin:1.5rem 0 0.75rem;">POINT-BY-POINT RESPONSES</div>
    <div class="pr-points-list">${pointsHtml}</div>

    ${closingHtml}
    ${AI_DISCLAIMER}`;
}

// ─── Export utilities ─────────────────────────────────────────────────────────
function copyPeerReview() {
  if (!lastPeerReviewOutput) { showToast('Generate a response first', 'error'); return; }
  navigator.clipboard.writeText(lastPeerReviewOutput)
    .then(() => showToast('Response letter copied to clipboard', 'success'))
    .catch(() => showToast('Copy failed — please select and copy manually', 'error'));
}

function exportPeerReviewDocx() {
  if (!lastPeerReviewOutput && !document.getElementById('pr-results')?.textContent?.trim()) {
    showToast('Generate a response first', 'error'); return;
  }
  if (typeof htmlDocx !== 'undefined') {
    const content = `<html><body><pre style="font-family:Arial;font-size:11pt;line-height:1.6;">${escHtml(lastPeerReviewOutput)}</pre></body></html>`;
    const blob = htmlDocx.asBlob(content);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url; a.download = 'peer-review-response.docx';
    a.click(); URL.revokeObjectURL(url);
  } else {
    // Fallback: download as .txt
    const blob = new Blob([lastPeerReviewOutput], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url; a.download = 'peer-review-response.txt';
    a.click(); URL.revokeObjectURL(url);
  }
  showToast('Response letter exported', 'success');
}

console.log('[PeerReview] Peer Review Response Generator loaded');
