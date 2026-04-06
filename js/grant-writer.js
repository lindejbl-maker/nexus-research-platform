// ═══ GRANT WRITER AI ═════════════════════════════════════════════════════════
// Generates a complete grant application from project details.
// Sections: Executive Summary, Background, Innovation, Aims, Research Plan,
//           Team Qualifications, Budget Justification, Timeline.

let grantLoading = false;
let lastGrantOutput = '';
let grantStep = 1;

function initGrantWriter() {
  showGrantStep(1);
}

function showGrantStep(step) {
  grantStep = step;
  [1, 2, 3].forEach(s => {
    const el = document.getElementById(`gw-step-${s}`);
    if (el) el.style.display = s === step ? '' : 'none';
    const dot = document.getElementById(`gw-dot-${s}`);
    if (dot) {
      dot.className = `gw-step-dot ${s < step ? 'gw-dot-done' : s === step ? 'gw-dot-active' : ''}`;
    }
  });
}

function gwNext() {
  const title = document.getElementById('gw-title')?.value?.trim();
  const desc  = document.getElementById('gw-description')?.value?.trim();
  if (grantStep === 1 && (!title || !desc)) {
    showToast('Please fill in the project title and description', 'error'); return;
  }
  if (grantStep < 3) showGrantStep(grantStep + 1);
}

function gwBack() {
  if (grantStep > 1) showGrantStep(grantStep - 1);
}

async function generateGrant() {
  if (grantLoading) return;

  const data = {
    title:        document.getElementById('gw-title')?.value?.trim(),
    description:  document.getElementById('gw-description')?.value?.trim(),
    aims:         document.getElementById('gw-aims')?.value?.trim(),
    funder:       document.getElementById('gw-funder')?.value || 'NIH R01',
    customFunder: document.getElementById('gw-custom-funder')?.value?.trim(),
    teamSize:     document.getElementById('gw-team-size')?.value || '5',
    piExperience: document.getElementById('gw-pi-experience')?.value?.trim(),
    budget:       document.getElementById('gw-budget')?.value || '250000',
    duration:     document.getElementById('gw-duration')?.value || '3 years',
    institution:  document.getElementById('gw-institution')?.value?.trim(),
    field:        nexusProfile?.get()?.field || ''
  };

  if (!data.title || !data.description) {
    showGrantStep(1);
    showToast('Required fields missing — go back to Step 1', 'error'); return;
  }

  const results = document.getElementById('gw-results');
  const status  = document.getElementById('gw-status');
  const btn     = document.getElementById('gw-btn');

  grantLoading = true;
  btn.disabled = true;
  results.innerHTML = '';
  status.style.display = 'flex';
  showGrantStep(3);

  try {
    const grant = await gemini.generateGrant(data);
    lastGrantOutput = grantToText(grant, data);
    results.innerHTML = renderGrant(grant, data);
    if (typeof logActivity === 'function') logActivity(`Grant written: "${data.title.substring(0, 50)}"`);
    // ── Citation Verification (non-blocking) ──────────────────────────────────
    if (typeof CitationVerifier !== 'undefined') {
      setTimeout(() => CitationVerifier.scanAndBadge(results), 400);
    }
    // ── Advance pipeline: grant complete ── signals full pipeline completion ──
    if (typeof NexusPipeline !== 'undefined' && NexusPipeline.getState()) {
      NexusPipeline.advance('grant', { grant });
    }
  } catch (err) {
    results.innerHTML = `<div class="error-state">⚠ ${escHtml(err.message)}</div>`;
  } finally {
    grantLoading = false;
    btn.disabled  = false;
    status.style.display = 'none';
  }
}

function renderGrant(grant, data) {
  const funder = data.customFunder || data.funder;
  const sections = [
    { key: 'executiveSummary',  label: '📋 Executive Summary / Abstract', icon: '📋' },
    { key: 'background',        label: '📚 Background & Significance',    icon: '📚' },
    { key: 'innovation',        label: '💡 Innovation',                   icon: '💡' },
    { key: 'specificAims',      label: '🎯 Specific Aims',                icon: '🎯' },
    { key: 'researchPlan',      label: '🧪 Research Plan & Methodology',  icon: '🧪' },
    { key: 'teamQualification', label: '👥 Team Qualifications',          icon: '👥' },
    { key: 'budgetJustification',label: '💰 Budget Justification',        icon: '💰' },
    { key: 'timeline',          label: '📅 Timeline',                     icon: '📅' },
  ];

  const sectionsHtml = sections.filter(s => grant[s.key]).map(s => `
    <div class="gw-section" id="gw-sec-${s.key}">
      <div class="gw-section-header">
        <div class="gw-section-title">${s.label}</div>
        <button class="paper-btn gw-copy-section" onclick="gwCopySection('${s.key}')" title="Copy this section">📋</button>
      </div>
      <div class="gw-section-body">${escHtml(grant[s.key])}</div>
    </div>`).join('');

  return `
    <div class="gw-result-header">
      <div>
        <div class="gw-result-title">${escHtml(data.title)}</div>
        <div class="gw-result-sub">Grant application for <strong>${escHtml(funder)}</strong> · ${escHtml(data.duration)} · Budget: $${parseInt(data.budget).toLocaleString()}</div>
      </div>
      <div class="gw-export-row">
        <button class="paper-btn" onclick="copyGrant()">📋 Copy all</button>
        <button class="paper-btn" onclick="exportGrant()">⬇ Export .txt</button>
        <button class="paper-btn gw-new-btn" onclick="resetGrantWriter()">✏ New grant</button>
      </div>
    </div>
    ${grant.reviewerTips ? `<div class="gw-reviewer-tips">💡 <strong>Reviewer tips for ${escHtml(funder)}:</strong> ${escHtml(grant.reviewerTips)}</div>` : ''}
    <div class="gw-sections">${sectionsHtml}</div>
    ${AI_DISCLAIMER}`;
}

function gwCopySection(key) {
  const el = document.getElementById(`gw-sec-${key}`)?.querySelector('.gw-section-body');
  if (!el) return;
  navigator.clipboard.writeText(el.textContent)
    .then(() => showToast('Section copied', 'success'))
    .catch(() => showToast('Copy failed', 'error'));
}

function copyGrant() {
  if (!lastGrantOutput) { showToast('Generate a grant first', 'error'); return; }
  navigator.clipboard.writeText(lastGrantOutput)
    .then(() => showToast('Full grant application copied', 'success'))
    .catch(() => showToast('Copy failed', 'error'));
}

function exportGrant() {
  if (!lastGrantOutput) { showToast('Generate a grant first', 'error'); return; }
  const blob = new Blob([lastGrantOutput], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = 'grant-application.txt';
  a.click(); URL.revokeObjectURL(url);
  showToast('Grant exported', 'success');
}

function grantToText(grant, data) {
  const funder = data.customFunder || data.funder;
  const sections = [
    ['EXECUTIVE SUMMARY', grant.executiveSummary],
    ['BACKGROUND & SIGNIFICANCE', grant.background],
    ['INNOVATION', grant.innovation],
    ['SPECIFIC AIMS', grant.specificAims],
    ['RESEARCH PLAN & METHODOLOGY', grant.researchPlan],
    ['TEAM QUALIFICATIONS', grant.teamQualification],
    ['BUDGET JUSTIFICATION', grant.budgetJustification],
    ['TIMELINE', grant.timeline],
  ];
  const divider = '═'.repeat(70);
  return `GRANT APPLICATION\n${divider}\nProject: ${data.title}\nFunder: ${funder}\nDuration: ${data.duration}\nBudget: $${parseInt(data.budget).toLocaleString()}\n${divider}\n\n` +
    sections.filter(([, v]) => v).map(([title, content]) =>
      `${title}\n${'─'.repeat(title.length)}\n${content}\n`
    ).join('\n');
}

function resetGrantWriter() {
  lastGrantOutput = '';
  document.getElementById('gw-results').innerHTML = '';
  ['gw-title','gw-description','gw-aims','gw-pi-experience','gw-institution','gw-custom-funder'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  showGrantStep(1);
}

console.log('[GrantWriter] Loaded');
