// ═══ EXPERIMENT BLUEPRINT BUILDER ════════════════════════════════════════════
// Takes any hypothesis → complete experiment protocol ready to run in a lab.

let blueprintLoading = false;
let lastBlueprintMd  = '';

function initExperimentBlueprint() {
  // Populate hypothesis selector from localStorage if hypotheses exist
  const select = document.getElementById('eb-hyp-select');
  if (!select) return;
  try {
    const stored = JSON.parse(localStorage.getItem('nexus_hypotheses') || '[]');
    if (stored.length) {
      stored.slice(0, 10).forEach((h, i) => {
        const opt = document.createElement('option');
        opt.value = h.text || h.title || h;
        opt.textContent = (h.text || h.title || h).substring(0, 80);
        select.appendChild(opt);
      });
    }
  } catch (_) {}
}

function ebSelectHypothesis() {
  const select = document.getElementById('eb-hyp-select');
  const input  = document.getElementById('eb-hypothesis');
  if (select?.value && input) input.value = select.value;
}

async function buildExperimentBlueprint() {
  if (blueprintLoading) return;
  const hypothesis = document.getElementById('eb-hypothesis')?.value?.trim();
  const field      = document.getElementById('eb-field')?.value || '';
  const budget     = document.getElementById('eb-budget')?.value || 'standard';
  const timeline   = document.getElementById('eb-timeline')?.value || '6 months';
  const results    = document.getElementById('eb-results');
  const status     = document.getElementById('eb-status');
  const btn        = document.getElementById('eb-btn');

  if (!hypothesis) { showToast('Enter a hypothesis to design an experiment for', 'error'); return; }

  blueprintLoading = true;
  btn.disabled = true;
  results.innerHTML = '';
  status.style.display = 'flex';

  try {
    const blueprint = await gemini.buildExperimentBlueprint(hypothesis, field, budget, timeline);
    lastBlueprintMd = blueprintToMarkdown(blueprint, hypothesis);
    results.innerHTML = renderBlueprint(blueprint, hypothesis);
    if (typeof logActivity === 'function') logActivity(`Blueprint: "${hypothesis.substring(0, 50)}"`);
  } catch (err) {
    results.innerHTML = `<div class="error-state">⚠ ${escHtml(err.message)}</div>`;
  } finally {
    blueprintLoading = false;
    btn.disabled = false;
    status.style.display = 'none';
  }
}

function renderBlueprint(bp, hypothesis) {
  const equipHtml = (bp.equipment || []).map(e =>
    `<div class="eb-equip-item">
      <div class="eb-equip-name">${escHtml(e.item || e)}</div>
      ${e.quantity ? `<div class="eb-equip-qty">${escHtml(e.quantity)}</div>` : ''}
      ${e.note ? `<div class="eb-equip-note">${escHtml(e.note)}</div>` : ''}
    </div>`
  ).join('');

  const stepsHtml = (bp.procedure || []).map((step, i) =>
    `<div class="eb-step">
      <div class="eb-step-num">${i + 1}</div>
      <div class="eb-step-body">
        <div class="eb-step-title">${escHtml(step.title || step)}</div>
        ${step.detail ? `<div class="eb-step-detail">${escHtml(step.detail)}</div>` : ''}
        ${step.duration ? `<div class="eb-step-duration">⏱ ${escHtml(step.duration)}</div>` : ''}
      </div>
    </div>`
  ).join('');

  const timelineHtml = (bp.timeline || []).map(t =>
    `<div class="eb-timeline-item">
      <div class="eb-tl-phase">${escHtml(t.phase || '')}</div>
      <div class="eb-tl-duration">${escHtml(t.duration || '')}</div>
      <div class="eb-tl-tasks">${escHtml(t.tasks || '')}</div>
    </div>`
  ).join('');

  const safetyHtml = (bp.safety || []).map(s =>
    `<div class="eb-safety-item"><span class="eb-safety-icon">⚠</span><span>${escHtml(s)}</span></div>`
  ).join('') || '<div class="eb-safety-item"><span class="eb-safety-icon ok">✓</span><span>No special safety requirements identified</span></div>';

  return `
    <div class="eb-header-card">
      <div class="eb-header-label">EXPERIMENT BLUEPRINT</div>
      <div class="eb-header-hypothesis">${escHtml(hypothesis)}</div>
      <div class="eb-header-meta">
        ${bp.studyType ? `<span class="eb-meta-tag">${escHtml(bp.studyType)}</span>` : ''}
        ${bp.estimatedDuration ? `<span class="eb-meta-tag">⏱ ${escHtml(bp.estimatedDuration)}</span>` : ''}
        ${bp.sampleSize ? `<span class="eb-meta-tag">n = ${escHtml(bp.sampleSize)}</span>` : ''}
        ${bp.difficulty ? `<span class="eb-meta-tag eb-diff-${bp.difficulty}">${bp.difficulty} complexity</span>` : ''}
      </div>
    </div>

    <div class="eb-grid">
      <div class="eb-section">
        <div class="eb-section-title">🎯 Objective</div>
        <div class="eb-text">${escHtml(bp.objective || '')}</div>
      </div>

      <div class="eb-section">
        <div class="eb-section-title">📐 Variables</div>
        <div class="eb-var-grid">
          <div class="eb-var"><div class="eb-var-label">Independent</div><div class="eb-var-val">${escHtml(bp.variables?.independent || '—')}</div></div>
          <div class="eb-var"><div class="eb-var-label">Dependent</div><div class="eb-var-val">${escHtml(bp.variables?.dependent || '—')}</div></div>
          <div class="eb-var"><div class="eb-var-label">Control</div><div class="eb-var-val">${escHtml(bp.variables?.control || '—')}</div></div>
          <div class="eb-var"><div class="eb-var-label">Confounders</div><div class="eb-var-val">${escHtml(bp.variables?.confounders || '—')}</div></div>
        </div>
      </div>

      <div class="eb-section">
        <div class="eb-section-title">📊 Statistical Plan</div>
        <div class="eb-stat-rows">
          <div class="eb-stat-row"><span>Sample size</span><span>${escHtml(bp.statistics?.sampleSize || '—')}</span></div>
          <div class="eb-stat-row"><span>Primary test</span><span>${escHtml(bp.statistics?.primaryTest || '—')}</span></div>
          <div class="eb-stat-row"><span>Significance</span><span>${escHtml(bp.statistics?.alpha || 'α = 0.05')}</span></div>
          <div class="eb-stat-row"><span>Power</span><span>${escHtml(bp.statistics?.power || '0.80')}</span></div>
          <div class="eb-stat-row"><span>Effect size</span><span>${escHtml(bp.statistics?.effectSize || '—')}</span></div>
        </div>
      </div>

      <div class="eb-section eb-section-wide">
        <div class="eb-section-title">🧪 Equipment & Materials</div>
        <div class="eb-equip-grid">${equipHtml || '<div class="eb-empty">No specific equipment identified</div>'}</div>
      </div>

      <div class="eb-section eb-section-wide">
        <div class="eb-section-title">📋 Step-by-Step Procedure</div>
        <div class="eb-steps">${stepsHtml}</div>
      </div>

      <div class="eb-section eb-section-wide">
        <div class="eb-section-title">📅 Timeline</div>
        <div class="eb-timeline">${timelineHtml || '<div class="eb-empty">Timeline not specified</div>'}</div>
      </div>

      <div class="eb-section">
        <div class="eb-section-title">✅ Expected Outcomes</div>
        <div class="eb-outcomes">
          <div class="eb-outcome eb-outcome-pos"><div class="eb-outcome-label">If hypothesis is CORRECT</div><div class="eb-outcome-text">${escHtml(bp.expectedOutcomes?.positive || '—')}</div></div>
          <div class="eb-outcome eb-outcome-neg"><div class="eb-outcome-label">If hypothesis is WRONG</div><div class="eb-outcome-text">${escHtml(bp.expectedOutcomes?.negative || '—')}</div></div>
        </div>
      </div>

      <div class="eb-section">
        <div class="eb-section-title">⚠ Safety Considerations</div>
        <div class="eb-safety-list">${safetyHtml}</div>
      </div>
    </div>

    <div class="eb-actions">
      <button class="paper-btn" onclick="exportBlueprint()">⬇ Export as Markdown</button>
      <button class="paper-btn" onclick="copyBlueprint()">📋 Copy to clipboard</button>
      ${typeof notebookAddEntry === 'function' ? `<button class="paper-btn" onclick="saveBlueprintToNotebook()">📓 Save to Notebook</button>` : ''}
    </div>
    ${AI_DISCLAIMER}`;
}

function blueprintToMarkdown(bp, hypothesis) {
  return `# Experiment Blueprint\n\n**Hypothesis:** ${hypothesis}\n\n## Objective\n${bp.objective || ''}\n\n## Variables\n- **Independent:** ${bp.variables?.independent || ''}\n- **Dependent:** ${bp.variables?.dependent || ''}\n- **Control:** ${bp.variables?.control || ''}\n- **Confounders:** ${bp.variables?.confounders || ''}\n\n## Statistical Plan\n- Sample size: ${bp.statistics?.sampleSize || ''}\n- Primary test: ${bp.statistics?.primaryTest || ''}\n- Significance: ${bp.statistics?.alpha || 'α = 0.05'}\n- Power: ${bp.statistics?.power || '0.80'}\n\n## Equipment\n${(bp.equipment || []).map(e => `- ${e.item || e}${e.quantity ? ` (${e.quantity})` : ''}`).join('\n')}\n\n## Procedure\n${(bp.procedure || []).map((s, i) => `${i + 1}. **${s.title || s}**${s.detail ? `\n   ${s.detail}` : ''}`).join('\n')}\n\n## Timeline\n${(bp.timeline || []).map(t => `- **${t.phase}** (${t.duration}): ${t.tasks}`).join('\n')}\n\n## Expected Outcomes\n- If correct: ${bp.expectedOutcomes?.positive || ''}\n- If wrong: ${bp.expectedOutcomes?.negative || ''}\n\n## Safety\n${(bp.safety || []).map(s => `- ${s}`).join('\n') || 'None identified'}\n`;
}

function exportBlueprint() {
  if (!lastBlueprintMd) { showToast('Generate a blueprint first', 'error'); return; }
  const blob = new Blob([lastBlueprintMd], { type: 'text/markdown' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = 'experiment-blueprint.md';
  a.click(); URL.revokeObjectURL(url);
  showToast('Blueprint exported as Markdown', 'success');
}

function copyBlueprint() {
  if (!lastBlueprintMd) { showToast('Generate a blueprint first', 'error'); return; }
  navigator.clipboard.writeText(lastBlueprintMd)
    .then(() => showToast('Blueprint copied to clipboard', 'success'))
    .catch(() => showToast('Copy failed', 'error'));
}

function saveBlueprintToNotebook() {
  if (!lastBlueprintMd) { showToast('Generate a blueprint first', 'error'); return; }
  notebookAddEntry(lastBlueprintMd, ['experiment', 'blueprint'], false);
  showToast('Blueprint saved to Lab Notebook', 'success');
}

console.log('[ExperimentBlueprint] Loaded');
