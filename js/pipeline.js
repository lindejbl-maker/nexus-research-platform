// ─── NEXUS RESEARCH PIPELINE ──────────────────────────────────────────────────
// Feature 8: End-to-End Research Pipeline
//
// Flow: Topic → Paper Search → Gap Map → Hypothesis → Experiment → Grant
// Each step feeds the next automatically (pre-fills inputs, passes context).
//
// Usage:
//   NexusPipeline.start('CRISPR therapy for cancer');  // kick off step 1
//   NexusPipeline.getState();                          // get current state
//   NexusPipeline.advance('hypothesis', hyp);          // pass data to next step
// ──────────────────────────────────────────────────────────────────────────────

const NexusPipeline = (() => {

  // ─── Steps definition ───────────────────────────────────────────────────────
  const STEPS = [
    { id: 'topic',      label: 'Topic',      page: null,                  icon: '🎯' },
    { id: 'search',     label: 'Papers',     page: 'search',              icon: '🔍' },
    { id: 'hypothesis', label: 'Hypothesis', page: 'hypothesis',          icon: '💡' },
    { id: 'experiment', label: 'Experiment', page: 'experimentblueprint', icon: '🧪' },
    { id: 'grant',      label: 'Grant',      page: 'grantwriter',         icon: '📋' },
  ];

  const STORAGE_KEY = 'nexus_pipeline_state';

  // ─── State ──────────────────────────────────────────────────────────────────
  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch { return null; }
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function clearState() {
    localStorage.removeItem(STORAGE_KEY);
    _hideBanner();
  }

  // ─── Start pipeline with a topic ────────────────────────────────────────────
  function start(topic, field = '') {
    const state = {
      startedAt:   Date.now(),
      topic,
      field,
      currentStep: 1, // 0 = topic (done since we have it), start at search
      data: {
        topic,
        papers:     [],
        hypothesis: null,
        experiment: null,
        grant:      null,
      }
    };
    saveState(state);
    _renderBanner(state);

    // Navigate to paper search and pre-fill
    if (typeof showPage === 'function') {
      showPage('search', document.querySelector('[data-page="search"]'));
    }

    // Pre-fill the search input after a brief delay (page transition)
    setTimeout(() => {
      const searchInput = document.getElementById('search-query');
      if (searchInput) {
        searchInput.value = topic;
        // Auto-trigger search
        if (typeof runSearch === 'function') runSearch();
      }
    }, 300);

    if (typeof showToast === 'function') {
      showToast(`🚀 Pipeline started: "${topic.substring(0, 40)}" — Step 1 of ${STEPS.length - 1}`, 'info');
    }
  }

  // ─── Called by each tool when it has output to pass forward ─────────────────
  function advance(stepId, data) {
    const state = loadState();
    if (!state) return; // no active pipeline

    switch (stepId) {
      case 'search': {
        // Papers found → pre-fill hypothesis generator
        state.data.papers = data.papers || [];
        state.currentStep = 2;
        saveState(state);
        _renderBanner(state);

        // Show pipeline "next step" toast
        if (typeof showToast === 'function') {
          showToast('📍 Pipeline: Papers found! Ready to generate hypotheses →', 'info');
        }
        _showNextButton(2, () => goToHypothesis(state));
        break;
      }

      case 'hypothesis': {
        // Hypothesis selected → pre-fill experiment blueprint
        state.data.hypothesis = data.hypothesis;
        state.currentStep = 3;
        saveState(state);
        _renderBanner(state);

        if (typeof showToast === 'function') {
          showToast('📍 Pipeline: Hypothesis selected → Building experiment blueprint…', 'info');
        }
        _showNextButton(3, () => goToExperiment(state));
        break;
      }

      case 'experiment': {
        // Experiment designed → pre-fill grant writer
        state.data.experiment = data.experiment;
        state.currentStep = 4;
        saveState(state);
        _renderBanner(state);

        if (typeof showToast === 'function') {
          showToast('📍 Pipeline: Experiment ready → Writing grant application…', 'info');
        }
        _showNextButton(4, () => goToGrant(state));
        break;
      }

      case 'grant': {
        // Pipeline complete!
        state.data.grant = data.grant;
        state.currentStep = 5;
        state.completedAt = Date.now();
        saveState(state);
        _renderBanner(state);

        if (typeof showToast === 'function') {
          showToast('🎉 Pipeline complete! Topic → Papers → Hypothesis → Experiment → Grant. Well done!', 'success');
        }
        break;
      }
    }
  }

  // ─── Navigation helpers (pre-fill each tool's inputs) ───────────────────────
  function goToHypothesis(state) {
    if (typeof showPage === 'function') showPage('hypothesis');
    setTimeout(() => {
      const topicInput = document.getElementById('hyp-topic');
      if (topicInput) topicInput.value = state.data.topic;
    }, 200);
  }

  function goToExperiment(state) {
    if (typeof showPage === 'function') showPage('experimentblueprint');
    setTimeout(() => {
      const hyp = state.data.hypothesis;
      if (!hyp) return;
      const hypInput = document.getElementById('eb-hypothesis');
      if (hypInput) hypInput.value = typeof hyp === 'string' ? hyp : (hyp.hypothesis || hyp.title || '');
      const fieldInput = document.getElementById('eb-field');
      if (fieldInput && state.data.field) fieldInput.value = state.data.field;
    }, 200);
  }

  function goToGrant(state) {
    if (typeof showPage === 'function') showPage('grantwriter');
    setTimeout(() => {
      const exp = state.data.experiment;
      const hyp = state.data.hypothesis;
      if (!exp && !hyp) return;

      const titleInput = document.getElementById('gw-title');
      if (titleInput) {
        titleInput.value = typeof hyp === 'object' ? (hyp.title || state.data.topic) : state.data.topic;
      }
      const descInput = document.getElementById('gw-description');
      if (descInput) {
        const hypText = typeof hyp === 'object' ? (hyp.hypothesis || '') : (hyp || '');
        descInput.value = hypText;
      }
      const fieldInput = document.getElementById('gw-field');
      if (fieldInput && state.data.field) fieldInput.value = state.data.field;
    }, 200);
  }

  // ─── Banner UI (injected into dashboard header area) ────────────────────────
  function _renderBanner(state) {
    let banner = document.getElementById('pipeline-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'pipeline-banner';
      // Insert after topbar
      const topbar = document.querySelector('.topbar');
      if (topbar) topbar.insertAdjacentElement('afterend', banner);
      else document.body.insertAdjacentElement('afterbegin', banner);
    }

    const currentStep = state.currentStep;
    const stepsHtml = STEPS.slice(1).map((step, i) => {
      const stepNum = i + 1;
      const isDone    = currentStep > stepNum;
      const isActive  = currentStep === stepNum;
      return `
        <div class="pipeline-step ${isDone ? 'pipeline-step--done' : ''} ${isActive ? 'pipeline-step--active' : ''}">
          <div class="pipeline-step-icon">${isDone ? '✓' : step.icon}</div>
          <div class="pipeline-step-label">${step.label}</div>
        </div>
        ${i < STEPS.length - 2 ? '<div class="pipeline-connector' + (isDone ? ' pipeline-connector--done' : '') + '"></div>' : ''}
      `;
    }).join('');

    const isComplete = currentStep >= STEPS.length;

    banner.innerHTML = `
      <div class="pipeline-banner-inner">
        <div class="pipeline-topic">
          <span class="pipeline-label">🚀 Pipeline</span>
          <span class="pipeline-topic-text">${escHtml ? escHtml(state.data.topic.substring(0, 50)) : state.data.topic.substring(0, 50)}</span>
        </div>
        <div class="pipeline-steps">
          ${stepsHtml}
        </div>
        <button class="pipeline-close" onclick="NexusPipeline.stop()" title="Exit pipeline">✕ Exit</button>
      </div>
    `;
    banner.style.display = '';
  }

  function _hideBanner() {
    const banner = document.getElementById('pipeline-banner');
    if (banner) banner.style.display = 'none';
  }

  // ─── "Next Step" button injected into current tool output ───────────────────
  function _showNextButton(nextStepNum, onClick) {
    // Remove any existing next-step buttons
    document.querySelectorAll('.pipeline-next-btn').forEach(el => el.remove());

    const step = STEPS[nextStepNum];
    if (!step) return;

    const btn = document.createElement('button');
    btn.className = 'pipeline-next-btn';
    btn.innerHTML = `${step.icon} Continue Pipeline → ${step.label}`;
    btn.onclick = onClick;

    // Find the most recently rendered results container to append to
    const targets = [
      '#hyp-results', '#cf-results', '#lit-results',
      '#eb-results', '#gw-results', '#dd-results',
    ];
    let appended = false;
    for (const sel of targets) {
      const el = document.querySelector(sel);
      if (el && el.children.length > 0) {
        el.appendChild(btn);
        appended = true;
        break;
      }
    }
    if (!appended) document.body.appendChild(btn);
  }

  // ─── Restore pipeline banner on page load ───────────────────────────────────
  function init() {
    const state = loadState();
    if (state && !state.completedAt) {
      // Pipeline in progress — restore banner
      setTimeout(() => _renderBanner(state), 500);
    }
  }

  // ─── Stop pipeline ───────────────────────────────────────────────────────────
  function stop() {
    clearState();
    document.querySelectorAll('.pipeline-next-btn').forEach(el => el.remove());
    if (typeof showToast === 'function') showToast('Pipeline exited', 'info');
  }

  // ─── Public API ─────────────────────────────────────────────────────────────
  return {
    start,
    advance,
    stop,
    init,
    getState: loadState,
    STEPS,
  };
})();
