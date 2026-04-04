// ═══ STATE ════════════════════════════════════════════════════════════════════
let currentUser = null;
let userPlan = 'free';
let savedPapers  = JSON.parse(localStorage.getItem('nexus_saved_papers') || '[]');
let projects     = JSON.parse(localStorage.getItem('nexus_projects')     || '[]');
let activityLog  = JSON.parse(localStorage.getItem('nexus_activity')     || '[]');
let alerts       = JSON.parse(localStorage.getItem('nexus_alerts')       || '[]');
let currentCiteStyle = 'apa';
let comparisonSelection = new Set();

// ─ AI Disclaimer component HTML — injected after every AI-generated output ──
const AI_DISCLAIMER = `
<div class="ai-disclaimer" role="note" aria-label="AI output disclaimer">
  <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
  <span>
    <strong>AI-generated content — verify before use.</strong>
    Nexus uses AI to assist your research. All hypotheses, summaries, and suggestions are starting points and must be independently verified against primary literature before use in academic work, publications, or clinical decisions.
    <a href="../pages/terms.html" target="_blank">Terms of Service</a> · <a href="../pages/privacy.html" target="_blank">Privacy Policy</a>
  </span>
</div>`;


// ═══ INIT ═════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  const hour = new Date().getHours();
  const greetEl = document.getElementById('time-greeting');
  if (greetEl) greetEl.textContent = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  try {
    currentUser = await nexusAuth.requireAuth();
    initUser(currentUser);
  } catch (e) {
    currentUser = { id: 'dev-user', email: 'researcher@nexus.ai', user_metadata: { first_name: 'Researcher' } };
    initUser(currentUser);
  }

  loadDashboard();
  renderActivity();
  renderProjects();
  renderSavedPapers();
  renderAlerts();
  loadCompareSelector();
  renderCitations();
  renderCostTracker();

  // Always open Dashboard HOME on a fresh page load (new tab / F5).
  // Only restore the last page if the user is navigating within the same browser session.
  const isNewSession = !sessionStorage.getItem('nexus_session_active');
  sessionStorage.setItem('nexus_session_active', '1');
  const lastPage = isNewSession ? 'dashboard' : (localStorage.getItem('nexus_last_page') || 'dashboard');
  const navEl = document.getElementById(`nav-${lastPage}`);
  if (lastPage && document.getElementById(`page-${lastPage}`)) showPage(lastPage, navEl, false);
  else showPage('dashboard', document.getElementById('nav-dashboard'), false);

  document.getElementById('paper-search-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') searchPapers(); });
  document.getElementById('hyp-input')?.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generateHypotheses(); });
  document.getElementById('project-name-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitProject(); });
  document.getElementById('alert-topic-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitAlert(); });

  // Profile tag input — add on Enter or comma
  document.getElementById('prof-interests-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addProfileTag(); }
  });

  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  toggle?.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('open'); });
  overlay?.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); });

  // Auto-show profile setup modal on first visit
  if (nexusProfile.isFirstVisit()) {
    setTimeout(() => showModal('profile-modal'), 1200);
  }

  // Apply profile personalisation on load
  updateProfileUI();
});

function initUser(user) {
  const name = user.user_metadata?.first_name || user.email?.split('@')[0] || 'Researcher';
  document.getElementById('user-name').textContent = name;
  document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
  document.getElementById('greeting-name').textContent = name;
  updateUsageBar();
  updateProfileUI();
}

// ═══ PAGE NAVIGATION ══════════════════════════════════════════════════════════
const PAGE_NAMES = {
  'dashboard':         'Dashboard',
  'search':            'Paper Search',
  'hypothesis':        'Hypothesis Generator',
  'contradiction':     'Contradiction Detector',
  'trendforecast':     'Trend Forecaster',
  'litreview':         'Literature Review',
  'crossfield':        'Cross-Field Discovery',
  'plainlang':         'Plain Language Builder',
  'compare':           'Compare Papers',
  'citations':         'Citation Manager',
  'projects':          'My Projects',
  'saved':             'Saved Papers',
  'alerts':            'Research Alerts',
  'deepdiver':         'Paper Deep-Diver',
  'experimentblueprint': 'Experiment Blueprint',
  'grantwriter':       'Grant Writer AI',
  'peerreview':        'Peer Review Response',
  'pdfchat':           'PDF Chat',
  'notebook':          'Lab Notebook',
  'costtracker':       'AI Cost Tracker',
  'benchmark':         'Validation Tests',
  'profile':           'My Profile',
  'admin':             'Admin Panel',
  'teamhub':           'Team Workspace',
  'teammembers':       'Members',
  'teamlibrary':       'Shared Library',
  'teamprojects':      'Shared Projects',
  'teamhypotheses':    'Team Hypotheses',
  'teamsettings':      'Team Settings'
};

// ═══ HUB NAV ══════════════════════════════════════════════════════════════════
const HUB_MAP = {
  search: 'hub-discover', trendforecast: 'hub-discover', crossfield: 'hub-discover', alerts: 'hub-discover',
  contradiction: 'hub-analyse', compare: 'hub-analyse', deepdiver: 'hub-analyse',
  hypothesis: 'hub-create', litreview: 'hub-create', experimentblueprint: 'hub-create', grantwriter: 'hub-create',
  peerreview: 'hub-write', plainlang: 'hub-write',
  projects: 'hub-library', saved: 'hub-library', citations: 'hub-library'
};

function toggleHub(hubId) {
  const hub = document.getElementById(hubId);
  if (!hub) return;
  const isOpen = hub.classList.toggle('open');
  const btn = hub.querySelector('.hub-header');
  if (btn) btn.setAttribute('aria-expanded', isOpen);
  const openHubs = [...document.querySelectorAll('.nav-hub.open')].map(h => h.id);
  localStorage.setItem('nexus_open_hubs', JSON.stringify(openHubs));
}

function openHubForPage(pageId) {
  const hubId = HUB_MAP[pageId];
  if (!hubId) return;
  const hub = document.getElementById(hubId);
  if (hub && !hub.classList.contains('open')) {
    hub.classList.add('open');
    const btn = hub.querySelector('.hub-header');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    const openHubs = [...document.querySelectorAll('.nav-hub.open')].map(h => h.id);
    localStorage.setItem('nexus_open_hubs', JSON.stringify(openHubs));
  }
}

function restoreOpenHubs() {
  const saved = JSON.parse(localStorage.getItem('nexus_open_hubs') || '[]');
  saved.forEach(id => {
    const hub = document.getElementById(id);
    if (hub) { hub.classList.add('open'); const btn = hub.querySelector('.hub-header'); if (btn) btn.setAttribute('aria-expanded', 'true'); }
  });
}

function showPage(pageId, linkEl, persist = true) {

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById(`page-${pageId}`);
  if (page) page.classList.add('active');
  if (linkEl) linkEl.classList.add('active');
  if (persist) localStorage.setItem('nexus_last_page', pageId);
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
  document.getElementById('main-content')?.scrollTo(0, 0);
  // Auto-open the hub containing this page
  openHubForPage(pageId);

  // Update top bar breadcrumb
  const tbName = document.getElementById('tb-page-name');
  if (tbName) tbName.textContent = PAGE_NAMES[pageId] || pageId;

  // Update top bar user label
  const tbUser = document.getElementById('tb-user-label');
  const tbBtn = document.getElementById('tb-user-btn');
  if (tbUser || tbBtn) {
    const p = nexusProfile.get();
    const name = p?.name?.split(' ')[0] || 'Researcher';
    if (tbUser) tbUser.textContent = name;
    if (tbBtn) tbBtn.textContent = name.charAt(0).toUpperCase();
  }

  // Refresh data when navigating to dynamic pages
  if (pageId === 'costtracker') renderCostTracker();
  if (pageId === 'citations') renderCitations();
  if (pageId === 'compare') loadCompareSelector();
  if (pageId === 'alerts') renderAlerts();
}

// ═══ RESEARCHER PROFILE ═══════════════════════════════════════════════════════
let _profileTags = []; // In-memory interest tags during editing

function updateProfileUI() {
  const p = nexusProfile.get();
  if (!p) return;

  // Update sidebar badge
  const badge = document.getElementById('profile-field-badge');
  const label = p.subfield?.split(' ').slice(0,2).join(' ') || p.field || null;
  if (badge && label) { badge.textContent = label; badge.style.display = ''; }

  // Update/inject greeting bar on dashboard home
  const greeting = nexusProfile.getGreeting();
  if (!greeting) return;
  const dashPage = document.getElementById('page-dashboard');
  if (!dashPage) return;
  let greetBar = dashPage.querySelector('.dash-greeting-bar');
  if (!greetBar) {
    greetBar = document.createElement('div');
    greetBar.className = 'dash-greeting-bar';
    dashPage.insertBefore(greetBar, dashPage.firstChild);
  }
  greetBar.innerHTML = `
    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    <span>${escHtml(greeting)}</span>
    <span class="setup-prompt" onclick="showProfile()">Edit profile →</span>`;
}

function showProfile() {
  const p = nexusProfile.get() || {};
  // Pre-fill the form
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('prof-field', p.field);
  set('prof-career', p.career_stage);
  set('prof-subfield', p.subfield);
  set('prof-institution', p.institution);
  set('prof-country', p.country);
  set('prof-grants', (p.grant_bodies || []).join(', '));
  // Restore tags
  _profileTags = [...(p.interests || [])];
  renderProfileTags();
  showModal('profile-modal');
}

function dismissProfile() {
  nexusProfile.markSeen();
  closeModal('profile-modal');
}

function addProfileTag() {
  const input = document.getElementById('prof-interests-input');
  if (!input) return;
  const val = input.value.trim().replace(/,$/, '');
  if (val && !_profileTags.includes(val) && _profileTags.length < 12) {
    _profileTags.push(val);
    renderProfileTags();
  }
  input.value = '';
}

function removeProfileTag(tag) {
  _profileTags = _profileTags.filter(t => t !== tag);
  renderProfileTags();
}

function renderProfileTags() {
  const wrap = document.getElementById('profile-tags-wrap');
  const input = document.getElementById('prof-interests-input');
  if (!wrap || !input) return;
  // Remove existing chips
  wrap.querySelectorAll('.profile-tag-chip').forEach(c => c.remove());
  _profileTags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'profile-tag-chip';
    chip.innerHTML = `${escHtml(tag)}<button onclick="removeProfileTag(${JSON.stringify(tag)})" aria-label="Remove ${escHtml(tag)}">✕</button>`;
    wrap.insertBefore(chip, input);
  });
}

function saveProfile() {
  const field = document.getElementById('prof-field')?.value;
  if (!field) { showToast('Please select your primary research field', 'error'); return; }
  // Capture any unsaved tag input
  const tagInput = document.getElementById('prof-interests-input');
  if (tagInput?.value.trim()) { _profileTags.push(tagInput.value.trim()); tagInput.value = ''; }
  const grantsRaw = document.getElementById('prof-grants')?.value || '';
  const grantBodies = grantsRaw.split(',').map(s => s.trim()).filter(Boolean);
  nexusProfile.save({
    field,
    career_stage:  document.getElementById('prof-career')?.value || '',
    subfield:      document.getElementById('prof-subfield')?.value || '',
    institution:   document.getElementById('prof-institution')?.value || '',
    country:       document.getElementById('prof-country')?.value || '',
    interests:     _profileTags,
    grant_bodies:  grantBodies
  });
  closeModal('profile-modal');
  updateProfileUI();
  showToast('Profile saved — AI outputs will now be personalised to your field', 'success');
}

// ═══ HYPOTHESIS TAB SWITCHER ══════════════════════════════════════════════════
function switchHypTab(tab) {
  const cardsTab   = document.getElementById('tab-cards');
  const mapTab     = document.getElementById('tab-map');
  const resultsEl  = document.getElementById('hyp-results');
  const mapSection = document.getElementById('gap-map-section');

  if (tab === 'cards') {
    cardsTab?.classList.add('active');   cardsTab?.setAttribute('aria-selected','true');
    mapTab?.classList.remove('active');  mapTab?.setAttribute('aria-selected','false');
    if (resultsEl)  resultsEl.style.display  = '';
    if (mapSection) mapSection.style.display = 'none';
  } else {
    mapTab?.classList.add('active');     mapTab?.setAttribute('aria-selected','true');
    cardsTab?.classList.remove('active');cardsTab?.setAttribute('aria-selected','false');
    if (resultsEl)  resultsEl.style.display  = 'none';
    if (mapSection) mapSection.style.display = '';
  }
}

function onGapNodeClick(hypothesisIdx, label) {
  // Switch back to cards tab and highlight the linked hypothesis
  switchHypTab('cards');
  const cards = document.querySelectorAll('#hyp-results .hyp-card');
  const target = cards[hypothesisIdx];
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.style.transition = 'box-shadow 0.3s, border-color 0.3s';
  target.style.boxShadow  = '0 0 0 2px rgba(34,211,238,0.5)';
  target.style.borderColor = 'rgba(34,211,238,0.6)';
  setTimeout(() => { target.style.boxShadow = ''; target.style.borderColor = ''; }, 2500);
  showToast(`Viewing hypothesis linked to gap: "${label}"`, 'info');
}

// ═══ USAGE BAR ════════════════════════════════════════════════════════════════
async function updateUsageBar() {
  try {
    const usage = await nexusUsage.getUsage(currentUser?.id || 'dev-user');
    const searchPct = Math.min(Math.round((usage.searches / 5)  * 100), 100);
    const hypPct    = Math.min(Math.round((usage.hypotheses / 2) * 100), 100);
    document.getElementById('search-bar').style.width   = `${searchPct}%`;
    document.getElementById('hyp-bar').style.width      = `${hypPct}%`;
    document.getElementById('search-usage-label').textContent = `${usage.searches} / 5`;
    document.getElementById('hyp-usage-label').textContent    = `${usage.hypotheses} / 2`;
    document.getElementById('dash-searches').textContent = usage.searches;
    document.getElementById('dash-hyps').textContent     = usage.hypotheses;
    const searchBar = document.getElementById('search-bar');
    const hypBar    = document.getElementById('hyp-bar');
    if (searchPct >= 100) searchBar.classList.add('danger');
    else if (searchPct >= 60) searchBar.classList.add('warning');
    if (hypPct >= 100) hypBar.classList.add('danger');
    else if (hypPct >= 50) hypBar.classList.add('warning');
  } catch (e) { /* silently fail */ }
}

// ═══ DASHBOARD ════════════════════════════════════════════════════════════════
function loadDashboard() {
  document.getElementById('dash-papers').textContent   = savedPapers.length;
  document.getElementById('dash-projects').textContent = projects.length;
}

// ═══ ACTIVITY LOG ═════════════════════════════════════════════════════════════
function logActivity(text, page) {
  activityLog.unshift({ text, time: Date.now(), page: page || null });
  activityLog = activityLog.slice(0, 30);
  localStorage.setItem('nexus_activity', JSON.stringify(activityLog));
  renderActivity();
}

function clearActivity() {
  activityLog = [];
  localStorage.removeItem('nexus_activity');
  renderActivity();
  showToast('Activity cleared', 'info');
}

function renderActivity() {
  const container = document.getElementById('recent-activity');
  const clearBtn  = document.getElementById('clear-activity-btn');
  if (!activityLog.length) {
    container.innerHTML = '<div class="activity-empty">No activity yet. Start by searching for papers.</div>';
    if (clearBtn) clearBtn.style.display = 'none';
    return;
  }
  if (clearBtn) clearBtn.style.display = 'block';
  container.innerHTML = activityLog.slice(0, 10).map((a, i) => `
    <div class="activity-item${a.page ? ' activity-item--link' : ''}" ${a.page ? `onclick="showPage('${a.page}', document.getElementById('nav-${a.page}'))" title="Go to ${PAGE_NAMES[a.page] || a.page}"` : ''} data-idx="${i}">
      <div class="act-dot"></div>
      <div class="act-text">${escHtml(a.text)}</div>
      <div class="act-right">
        ${a.page ? `<span class="act-go">↗</span>` : ''}
        <div class="act-time">${timeAgo(a.time)}</div>
      </div>
    </div>`).join('');
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ═══ PAPER SEARCH ════════════════════════════════════════════════════════════
async function searchPapers() {
  const query = document.getElementById('paper-search-input').value.trim();
  if (!query) { showToast('Please enter a search term', 'error'); return; }
  const check = await nexusUsage.checkLimit(currentUser?.id || 'dev', 'search', userPlan);
  if (!check.allowed) { showUpgradeModal(check.reason); return; }
  const btn = document.getElementById('paper-search-btn');
  const status = document.getElementById('search-status');
  const results = document.getElementById('search-results');
  btn.disabled = true; btn.textContent = 'Searching...';
  status.style.display = 'flex';
  status.innerHTML = '<div class="spinner"></div> Searching 200M+ papers...';
  results.innerHTML = '';
  try {
    const year = document.getElementById('search-year').value;
    const field = document.getElementById('search-field').value;
    const sort  = document.getElementById('search-sort').value;
    const papers = await semanticScholar.searchPapers(query, { year, field, sort, limit: 12 });
    await nexusUsage.logAction(currentUser?.id || 'dev', 'search');
    updateUsageBar();
    logActivity(`Searched: "${query}" — ${papers.length} result${papers.length !== 1 ? 's' : ''}`, 'search');
    status.style.display = 'none';
    if (!papers.length) { results.innerHTML = '<div class="empty-state">No papers found. Try different keywords or remove filters.</div>'; return; }
    results.innerHTML = papers.map(p => renderPaperCard(p)).join('');
  } catch (err) {
    status.innerHTML = `<span style="color:var(--error)">⚠ ${escHtml(err.message)}</span>`;
  } finally {
    btn.disabled = false; btn.textContent = 'Search →';
  }
}

function renderPaperCard(paper) {
  const isSaved  = savedPapers.some(s => s.paperId === paper.paperId);
  const authors  = paper.authors?.slice(0, 3).map(a => a.name).join(', ') || 'Unknown authors';
  const abstract = paper.abstract ? paper.abstract.substring(0, 240) + '…' : 'No abstract available.';
  const url      = semanticScholar.getPaperUrl(paper);
  const fields   = paper.fieldsOfStudy?.slice(0, 2).join(', ') || '';
  const safeId   = (paper.paperId || Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9]/g, '');
  const apa      = semanticScholar.formatAPA(paper);
  return `
    <div class="paper-card" id="card-${safeId}">
      <div class="paper-title"><a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(paper.title || 'Untitled')}</a></div>
      <div class="paper-meta">
        <span>${escHtml(authors)}</span>
        ${paper.year ? `<span class="paper-meta-sep">·</span><span>${paper.year}</span>` : ''}
        ${paper.citationCount ? `<span class="paper-meta-sep">·</span><span class="cite-count">↑ ${paper.citationCount.toLocaleString()} citations</span>` : ''}
        ${fields ? `<span class="paper-meta-sep">·</span><span>${escHtml(fields)}</span>` : ''}
      </div>
      <div class="paper-abstract">${escHtml(abstract)}</div>
      <div class="paper-actions">
        <button class="paper-btn ${isSaved ? 'saved' : ''}" id="save-${safeId}" onclick='toggleSave(${JSON.stringify(paper)}, "save-${safeId}")'>${isSaved ? '✓ Saved' : '+ Save'}</button>
        <a href="${escHtml(url)}" target="_blank" rel="noopener"><button class="paper-btn">View paper →</button></a>
        <button class="paper-btn" onclick="copyAPA(${JSON.stringify(apa)})">Copy APA citation</button>
      </div>
    </div>`;
}

// ═══ SAVE PAPERS ══════════════════════════════════════════════════════════════
function toggleSave(paper, btnId) {
  const btn = document.getElementById(btnId);
  const idx = savedPapers.findIndex(s => s.paperId === paper.paperId);
  if (idx > -1) {
    savedPapers.splice(idx, 1);
    if (btn) { btn.textContent = '+ Save'; btn.classList.remove('saved'); }
    showToast('Paper removed from library', 'info');
  } else {
    savedPapers.push({ ...paper, savedAt: Date.now() });
    if (btn) { btn.textContent = '✓ Saved'; btn.classList.add('saved'); }
    logActivity(`Saved: "${(paper.title || '').substring(0, 60)}"`, 'saved');
    showToast('Paper saved to library ✓', 'success');
  }
  localStorage.setItem('nexus_saved_papers', JSON.stringify(savedPapers));
  document.getElementById('dash-papers').textContent = savedPapers.length;
  updateSavedBadge();
  renderSavedPapers();
}

function updateSavedBadge() {
  const badge = document.getElementById('saved-count-badge');
  if (!badge) return;
  badge.textContent = `${savedPapers.length} paper${savedPapers.length !== 1 ? 's' : ''}`;
  badge.style.display = savedPapers.length ? 'block' : 'none';
}

function renderSavedPapers() {
  const container = document.getElementById('saved-papers-list');
  updateSavedBadge();
  if (!savedPapers.length) { container.innerHTML = '<div class="empty-state">No saved papers yet. Search for papers and click Save to add them here.</div>'; return; }
  const sorted = [...savedPapers].sort((a, b) => b.savedAt - a.savedAt);
  container.innerHTML = sorted.map(p => renderPaperCard(p)).join('');
}

function copyAPA(apa) {
  navigator.clipboard.writeText(apa)
    .then(() => showToast('APA citation copied to clipboard', 'success'))
    .catch(() => showToast('Could not access clipboard', 'error'));
}

// ═══ NOVELTY VERIFICATION ENGINE ═════════════════════════════════════════════
/**
 * Checks a single hypothesis against Semantic Scholar.
 * Returns { verified, matchCount, recentCount, papers, searchQuery, score }
 * verified = true means the hypothesis is genuinely novel (low match count)
 */
async function verifyNovelty(hypothesis, statusEl, label) {
  try {
    // Step 1 — Ask Gemini to convert the hypothesis into a search query
    if (statusEl) statusEl.innerHTML = `<div class="spinner"></div> ${escHtml(label)}: generating search query…`;
    const searchQuery = await gemini.generateSearchQuery(hypothesis.hypothesis);

    // Step 2 — Search Semantic Scholar for direct matches
    if (statusEl) statusEl.innerHTML = `<div class="spinner"></div> ${escHtml(label)}: searching Semantic Scholar for "${escHtml(searchQuery)}"…`;
    const papers = await semanticScholar.searchPapers(searchQuery, { limit: 8 });

    // Step 3 — Semantic similarity check (Item 2: embeddings-based)
    if (statusEl) statusEl.innerHTML = `<div class="spinner"></div> ${escHtml(label)}: running semantic similarity check…`;
    const semanticResult = await gemini.semanticNoveltyCheck(
      hypothesis.hypothesis + ' ' + hypothesis.rationale,
      papers
    );

    const recentPapers = papers.filter(p => p.year && p.year >= new Date().getFullYear() - 10);
    const matchCount   = papers.length;
    const recentCount  = recentPapers.length;

    // Step 4 — Determine novelty using semantic similarity if available, else keyword count
    let verified, partial, calibratedScore;
    const usingSemantic = semanticResult.method === 'semantic' && semanticResult.maxSimilarity > 0;

    if (usingSemantic) {
      const sim = semanticResult.maxSimilarity;
      verified = sim < 0.70;  // < 70% similarity = genuinely novel
      partial  = sim >= 0.70 && sim < 0.82; // 70-82% = partially explored
      // Calibrate novelty score from cosine distance
      if (sim < 0.60)       calibratedScore = Math.min(99, Math.max(hypothesis.novelty_score, 90));
      else if (sim < 0.70)  calibratedScore = Math.min(89, Math.max(hypothesis.novelty_score, 78));
      else if (sim < 0.82)  calibratedScore = Math.min(72, hypothesis.novelty_score);
      else                  calibratedScore = Math.min(50, hypothesis.novelty_score);
    } else {
      // Fallback: keyword count thresholds
      verified = recentCount <= 1;
      partial  = recentCount >= 2 && recentCount <= 3;
      if (recentCount === 0)      calibratedScore = Math.min(99, Math.max(hypothesis.novelty_score, 88));
      else if (recentCount === 1) calibratedScore = Math.min(87, Math.max(hypothesis.novelty_score, 78));
      else if (recentCount <= 3)  calibratedScore = Math.min(72, hypothesis.novelty_score);
      else                        calibratedScore = Math.min(55, hypothesis.novelty_score);
    }

    return {
      verified, partial, matchCount, recentCount,
      papers: papers.slice(0, 3), searchQuery, calibratedScore,
      semanticSimilarity: semanticResult.maxSimilarity,
      closestPaper: semanticResult.closestPaper,
      verificationMethod: semanticResult.method
    };
  } catch (err) {
    return { verified: true, partial: false, matchCount: -1, recentCount: -1, papers: [], searchQuery: '', calibratedScore: hypothesis.novelty_score, error: err.message, verificationMethod: 'unavailable' };
  }
}

function renderVerifiedBadge(result) {
  if (result.matchCount === -1) {
    return `<span class="novelty-verified warning" title="Could not verify — ${escHtml(result.error || 'unknown error')}">&#9888; Verification unavailable</span>`;
  }
  const methodLabel = result.verificationMethod === 'semantic'
    ? `Semantic similarity: ${Math.round(result.semanticSimilarity * 100)}%`
    : `${result.recentCount} recent matching papers`;
  if (result.verified) {
    return `<span class="novelty-verified success" title="Verified via ${result.verificationMethod === 'semantic' ? 'embedding similarity' : 'Semantic Scholar search'} — ${methodLabel}">&#10003; Verified novel &middot; ${methodLabel}</span>`;
  }
  if (result.partial) {
    return `<span class="novelty-verified partial" title="Partially explored — ${methodLabel}">&#11042; Partially explored &middot; ${methodLabel}</span>`;
  }
  return `<span class="novelty-verified explored" title="Already explored — ${methodLabel}">&#10007; Already explored &middot; ${methodLabel}</span>`;
}

function renderVerificationEvidence(result) {
  if (result.matchCount === -1 || !result.searchQuery) return '';

  const paperLinks = result.papers.slice(0, 2).map(p =>
    `<a href="${semanticScholar.getPaperUrl(p)}" target="_blank" rel="noopener" class="ver-paper-link">"${escHtml((p.title || '').substring(0, 70))}${(p.title || '').length > 70 ? '\u2026' : ''}" (${p.year || 'n.d.'})</a>`
  ).join('');

  // Item 2: Show closest semantic match if embedding was used
  const semanticNote = (result.verificationMethod === 'semantic' && result.closestPaper)
    ? `<div class="ver-semantic-note">&#x25CB; Closest semantic match: <a href="${semanticScholar.getPaperUrl(result.closestPaper)}" target="_blank" rel="noopener" class="ver-paper-link">&ldquo;${escHtml((result.closestPaper.title || '').substring(0, 70))}&rdquo;</a> &mdash; ${Math.round(result.semanticSimilarity * 100)}% similarity</div>`
    : '';

  return `
    <div class="verification-evidence">
      <div class="ver-label">
        <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        Verified via ${result.verificationMethod === 'semantic' ? '<strong>embedding similarity</strong>' : 'Semantic Scholar'} &middot; query: <em>&ldquo;${escHtml(result.searchQuery)}&rdquo;</em> &middot; ${result.matchCount} result${result.matchCount !== 1 ? 's' : ''}
      </div>
      ${semanticNote}
      ${paperLinks ? `<div class="ver-papers">${paperLinks}</div>` : ''}
    </div>`;
}

// ═══ HYPOTHESIS GENERATOR ════════════════════════════════════════════════════
async function generateHypotheses() {
  const input = document.getElementById('hyp-input').value.trim();
  if (!input) { showToast('Please enter a research topic', 'error'); return; }
  const check = await nexusUsage.checkLimit(currentUser?.id || 'dev', 'hypothesis', userPlan);
  if (!check.allowed) { showUpgradeModal(check.reason); return; }
  const btn     = document.getElementById('hyp-btn');
  const status  = document.getElementById('hyp-status');
  const results = document.getElementById('hyp-results');
  const field   = document.getElementById('hyp-field').value;
  const count   = parseInt(document.getElementById('hyp-depth').value);

  btn.disabled = true;
  btn.textContent = 'Generating & verifying…';
  status.style.display = 'flex';
  status.innerHTML = '<div class="spinner"></div> Fetching live papers from Semantic Scholar…';
  results.innerHTML = '';

  const MAX_REGEN_ATTEMPTS = 3; // max regeneration cycles per slot

  try {
    // Phase 1 — Generate initial batch (RAG context fetched inside generateHypotheses)
    const profileCtx = nexusProfile.getContext();
    status.innerHTML = '<div class="spinner"></div> Fetching live papers & generating hypotheses' + (profileCtx ? ' (personalised to your field)' : '') + '…';
    let hypotheses = await gemini.generateHypotheses(input, field, count, profileCtx);
    await nexusUsage.logAction(currentUser?.id || 'dev', 'hypothesis');
    updateUsageBar();

    // Phase 2 — Verify each hypothesis against Semantic Scholar
    const verified = [];
    const exploredClaims = []; // accumulate explored claims to avoid regenerating them

    for (let i = 0; i < hypotheses.length; i++) {
      let h = hypotheses[i];
      let attempt = 0;
      let result;

      while (attempt <= MAX_REGEN_ATTEMPTS) {
        const label = `Hypothesis ${i + 1}/${count}${attempt > 0 ? ` (retry ${attempt})` : ''}`;
        result = await verifyNovelty(h, status, label);

        if (result.verified || result.partial || attempt >= MAX_REGEN_ATTEMPTS) {
          break; // Accept it — novel, partially explored, or we've tried enough
        }

        // This hypothesis is already fully explored — record it and regenerate
        exploredClaims.push(h.hypothesis.substring(0, 200));
        status.innerHTML = `<div class="spinner"></div> Hypothesis ${i + 1} already published — regenerating a novel alternative…`;
        try {
          h = await gemini.regenerateHypothesis(input, field, exploredClaims, i + 1);
        } catch (regenErr) {
          break; // If regen fails, use what we have
        }
        attempt++;
      }

      // Attach verification result to the hypothesis
      h._verification = result;
      h.novelty_score = result.calibratedScore;
      h._ragGrounded = true; // Item 1: Mark as RAG grounded
      verified.push(h);

      // Show partial results as they come in
      status.innerHTML = `<div class="spinner"></div> Verified ${verified.length}/${count} hypotheses…`;
    }

    // Phase 3 — Render all verified hypotheses
    status.style.display = 'none';
    const novelCount = verified.filter(h => h._verification?.verified).length;
    const partialCount = verified.filter(h => h._verification?.partial).length;
    logActivity(`Generated ${verified.length} hypotheses (${novelCount} verified novel) for: "${input.substring(0, 50)}"`, 'hypothesis');
    showToast(`${verified.length} hypotheses · ${novelCount} verified novel${partialCount ? ` · ${partialCount} partially explored` : ''}`, 'success');

    results.innerHTML = verified.map((h, idx) => {
      const vr = h._verification || {};
      const isExplored = vr.verified === false && !vr.partial;
      const ragBadge   = h._ragGrounded
        ? `<span class="rag-badge" title="Generated from ${field || 'topic'} papers retrieved live from Semantic Scholar">&#128196; Live grounded</span>`
        : '';
      return `
      <div class="hyp-card${isExplored ? ' hyp-card--explored' : ''}" style="animation-delay:${idx * 0.1}s">
        <div class="hyp-card-top">
          <div class="hyp-num">HYPOTHESIS ${String(h.id || idx + 1).padStart(2, '0')}</div>
          ${renderVerifiedBadge(vr)}
        </div>
        <div class="hyp-title">${escHtml(h.title)}</div>
        <div class="hyp-body">${escHtml(h.hypothesis)}</div>
        <div class="hyp-body"><strong style="color:var(--text)">Why this gap exists:</strong> ${escHtml(h.rationale)}</div>
        ${h.experiment_hint ? `<div class="hyp-body"><strong style="color:var(--text)">How to test it:</strong> ${escHtml(h.experiment_hint)}</div>` : ''}
        ${renderVerificationEvidence(vr)}
        <div class="hyp-footer">
          <span class="novelty-score">● ${h.novelty_score}% verified novelty</span>
          <span class="gap-tag">${escHtml(h.gap_type || 'research gap')}</span>
          <button class="paper-btn" onclick="copyTextContent(${JSON.stringify(h.title + '\n\n' + h.hypothesis + '\n\n' + h.rationale)})">Copy</button>
          <button class="paper-btn" onclick="sendToPlainLang(${JSON.stringify(h.hypothesis + ' ' + h.rationale)})">→ Plain Language</button>
        </div>
      </div>`;
    }).join('') + AI_DISCLAIMER;

    // Phase 4 — Build Research Gap Map (Item 4: real citation data preferred)
    const tabsEl = document.getElementById('hyp-tabs');
    if (tabsEl) tabsEl.style.display = 'flex';
    switchHypTab('cards');

    const mapStatus = document.getElementById('gap-map-status');
    if (mapStatus) { mapStatus.style.display = 'flex'; mapStatus.innerHTML = '<div class="spinner"></div> Analysing citation network…'; }

    // Try real citation graph first, fall back to AI-generated
    (async () => {
      try {
        // Attempt to build from real citation data
        let mapData = null;
        if (typeof citationGraph !== 'undefined') {
          if (mapStatus) mapStatus.innerHTML = '<div class="spinner"></div> Fetching citation data from Semantic Scholar…';
          mapData = await citationGraph.build(input, field, verified);
        }

        // If citation graph fails or returns null, fall back to AI
        if (!mapData) {
          if (mapStatus) mapStatus.innerHTML = '<div class="spinner"></div> Building AI Research Gap Map…';
          mapData = await gemini.generateGapMapData(input, field, verified, profileCtx);
          mapData._source = 'ai';
        } else {
          mapData._source = 'real';
        }

        if (mapStatus) mapStatus.style.display = 'none';
        initGapMap('gap-map-canvas', mapData, onGapNodeClick);

        const mapTab = document.getElementById('tab-map');
        if (mapTab) {
          const studiedCount = (mapData.nodes || []).length;
          const gapCount     = (mapData.gaps  || []).length;
          const sourceLabel  = mapData._source === 'real' ? ' · from real citations' : ' · AI-generated';
          mapTab.title = `${studiedCount} studied topics · ${gapCount} unexplored gaps${sourceLabel}`;
          if (mapData._source === 'real') {
            mapTab.textContent = `Research Gap Map LIVE (★ Real Data)`;
          }
        }
      } catch (e) {
        if (mapStatus) { mapStatus.innerHTML = `<span style="color:var(--muted);font-size:12px;">Gap map unavailable: ${escHtml(e.message)}</span>`; }
      }
    })();

  } catch (err) {
    status.innerHTML = `<span style="color:var(--error)">⚠ ${escHtml(err.message)}</span>`;
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Hypotheses →';
  }
}


// ═══ LITERATURE REVIEW ════════════════════════════════════════════════════════
async function generateLitReview() {
  const topic = document.getElementById('lit-topic').value.trim();
  if (!topic) { showToast('Please enter a research topic', 'error'); return; }
  const btn = document.getElementById('lit-btn');
  const status = document.getElementById('lit-status');
  const results = document.getElementById('lit-results');
  const focus = document.getElementById('lit-focus').value.trim();
  const depth = document.getElementById('lit-depth').value;
  const style = document.getElementById('lit-style').value;
  btn.disabled = true; btn.textContent = 'Writing review…';
  status.style.display = 'flex';
  status.innerHTML = '<div class="spinner"></div> Synthesising literature — this may take 30–60 seconds…';
  results.innerHTML = '';
  try {
    const review = await gemini.generateLiteratureReview(topic, focus, depth, style);
    logActivity(`Generated literature review: "${topic.substring(0, 50)}"`, 'litreview');
    status.style.display = 'none';
    showToast('Literature review complete', 'success');
    const formatted = renderMarkdown(review);
    const safeTitle = escHtml(topic.substring(0, 60));
    results.innerHTML = `
      <div class="lit-card">
        <div class="lit-card-header">
          <div class="lit-card-title">Literature Review: ${safeTitle}</div>
          <div class="lit-export-btns">
            <button class="paper-btn" onclick="copyReview()">Copy</button>
            <button class="paper-btn" onclick="downloadReview('${safeTitle.replace(/'/g, '')}')">Download .txt</button>
            <button class="paper-btn" onclick="exportToPDF('lit-output', '${safeTitle.replace(/'/g, '')}')">Export PDF</button>
            <button class="paper-btn" onclick="exportToDOCX('lit-output', '${safeTitle.replace(/'/g, '')}')">Export DOCX</button>
            <button class="paper-btn" onclick="sendToPlainLang(document.getElementById('lit-output').innerText)">→ Plain Language</button>
          </div>
        </div>
        <div class="lit-body" id="lit-output">${formatted}</div>
      </div>
      ${AI_DISCLAIMER}`;
  } catch (err) {
    status.innerHTML = `<span style="color:var(--error)">⚠ ${escHtml(err.message)}</span>`;
    showToast(err.message, 'error');
  } finally { btn.disabled = false; btn.textContent = 'Generate Literature Review →'; }
}

function renderMarkdown(text) {
  return text
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+?et al\.[^\]]*?)\]/g, '<span style="color:var(--blue);font-family:var(--font-mono);font-size:11px;">[$1]</span>')
    .replace(/\[([^\]]+?[0-9]{4}[^\]]*?)\]/g, '<span style="color:var(--blue);font-family:var(--font-mono);font-size:11px;">[$1]</span>')
    .replace(/\n\n/g, '</p><p>');
}

function copyReview() {
  navigator.clipboard.writeText(document.getElementById('lit-output')?.innerText || '')
    .then(() => showToast('Review copied to clipboard', 'success'))
    .catch(() => showToast('Could not access clipboard', 'error'));
}

function downloadReview(topic) {
  const text = document.getElementById('lit-output')?.innerText || '';
  downloadBlob(text, `nexus-review-${topic || 'review'}.txt`, 'text/plain');
  showToast('Review downloaded', 'success');
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ═══ CROSS-FIELD DISCOVERY ════════════════════════════════════════════════════
async function runCrossFieldDiscovery() {
  const problem = document.getElementById('cf-problem').value.trim();
  if (!problem) { showToast('Please describe your research problem', 'error'); return; }
  const field   = document.getElementById('cf-field').value;
  const btn     = document.getElementById('cf-btn');
  const status  = document.getElementById('cf-status');
  const results = document.getElementById('cf-results');
  btn.disabled = true; btn.textContent = 'Scanning all fields…';
  status.style.display = 'flex';
  status.innerHTML = '<div class="spinner"></div> AI is searching biology, physics, materials science, computer science, and 20+ other fields…';
  results.innerHTML = '';
  try {
    const discoveries = await gemini.crossFieldDiscovery(problem, field);
    logActivity(`Cross-field discovery: "${problem.substring(0, 50)}"`, 'crossfield');
    status.style.display = 'none';
    showToast(`${discoveries.length} cross-field solutions found`, 'success');
    const diffColors = { Low: 'var(--success)', Medium: '#F59E0B', High: 'var(--error)' };
    results.innerHTML = discoveries.map((d, idx) => `
      <div class="cf-card" style="animation-delay:${idx * 0.12}s">
        <div class="cf-card-header">
          <div class="cf-field-badge">${escHtml(d.source_field)}</div>
          <div class="cf-novelty">⬡ ${d.novelty_score}% novel</div>
        </div>
        <div class="cf-title">${escHtml(d.analogy_title)}</div>
        <div class="cf-section-label">What exists in ${escHtml(d.source_field)}</div>
        <div class="cf-body">${escHtml(d.discovery)}</div>
        <div class="cf-section-label">Underlying mechanism</div>
        <div class="cf-body">${escHtml(d.mechanism)}</div>
        <div class="cf-section-label">How to adapt it to your problem</div>
        <div class="cf-body">${escHtml(d.adaptation)}</div>
        <div class="cf-footer">
          <span class="cf-difficulty" style="color:${diffColors[d.implementation_difficulty] || 'var(--text2)'}">● ${escHtml(d.implementation_difficulty || '?')} difficulty</span>
          <span class="gap-tag">${escHtml(d.precedent || 'No known precedent')}</span>
          <button class="paper-btn" onclick="sendToPlainLang(${JSON.stringify(d.analogy_title + ': ' + d.discovery + ' ' + d.adaptation)})">→ Plain Language</button>
        </div>
      </div>`).join('') + AI_DISCLAIMER;
  } catch (err) {
    status.innerHTML = `<span style="color:var(--error)">⚠ ${escHtml(err.message)}</span>`;
    showToast(err.message, 'error');
  } finally { btn.disabled = false; btn.textContent = 'Discover Cross-Field Solutions →'; }
}

// ═══ PLAIN LANGUAGE BUILDER ══════════════════════════════════════════════════
function sendToPlainLang(text) {
  showPage('plainlang', document.getElementById('nav-plainlang'));
  const input = document.getElementById('pl-input');
  if (input) { input.value = text; input.focus(); }
  showToast('Content sent to Plain Language Builder', 'info');
}

async function generatePlainLanguage() {
  const content = document.getElementById('pl-input').value.trim();
  if (!content) { showToast('Please paste your technical content', 'error'); return; }
  const format  = document.getElementById('pl-format').value;
  const btn     = document.getElementById('pl-btn');
  const status  = document.getElementById('pl-status');
  const results = document.getElementById('pl-results');
  btn.disabled = true; btn.textContent = 'Building report…';
  status.style.display = 'flex';
  status.innerHTML = '<div class="spinner"></div> Rewriting for non-scientists…';
  results.innerHTML = '';
  try {
    const report = await gemini.plainLanguageReport(content, format);
    const formatLabels = { investor: 'Investor Brief', press: 'Press Release', government: 'Government Briefing', board: 'Board Report' };
    logActivity(`Plain language ${formatLabels[format] || format} generated`, 'plainlang');
    status.style.display = 'none';
    showToast('Report ready', 'success');
    const safeTitle = escHtml(formatLabels[format] || 'Report');
    results.innerHTML = `
      <div class="lit-card">
        <div class="lit-card-header">
          <div class="lit-card-title">${safeTitle}</div>
          <div class="lit-export-btns">
            <button class="paper-btn" onclick="copyTextContent(document.getElementById('pl-output').innerText)">Copy</button>
            <button class="paper-btn" onclick="downloadBlob(document.getElementById('pl-output').innerText,'nexus-${format}-report.txt','text/plain');showToast('Downloaded','success')">Download .txt</button>
            <button class="paper-btn" onclick="exportToPDF('pl-output','${format}-report')">Export PDF</button>
            <button class="paper-btn" onclick="exportToDOCX('pl-output','${format}-report')">Export DOCX</button>
          </div>
        </div>
        <div class="lit-body" id="pl-output">${renderMarkdown(escHtml(report)).replace(/\n/g, '<br>')}</div>
      </div>
      ${AI_DISCLAIMER}`;
  } catch (err) {
    status.innerHTML = `<span style="color:var(--error)">⚠ ${escHtml(err.message)}</span>`;
    showToast(err.message, 'error');
  } finally { btn.disabled = false; btn.textContent = 'Build Report →'; }
}

// ═══ PAPER COMPARISON ════════════════════════════════════════════════════════
function loadCompareSelector() {
  const container = document.getElementById('compare-paper-list');
  const btn       = document.getElementById('compare-btn');
  const emptyEl   = document.getElementById('compare-empty-state');
  if (!container) return;

  if (!savedPapers.length) {
    // Show the pre-built empty state with "Search Papers" button
    if (emptyEl) emptyEl.style.display = '';
    if (btn) btn.style.display = 'none';
    return;
  }

  // Has saved papers — hide empty state, show checkboxes + compare button
  if (emptyEl) emptyEl.style.display = 'none';
  if (btn) btn.style.display = '';

  // Remove existing checkboxes (keep the empty-state div)
  container.querySelectorAll('.compare-paper-item').forEach(el => el.remove());

  const items = savedPapers.map(p => {
    const sid = (p.paperId || Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9]/g, '');
    return `
      <label class="compare-paper-item" for="cmp-${sid}">
        <input type="checkbox" id="cmp-${sid}" value="${escHtml(p.paperId || '')}" onchange="updateCompareSelection()">
        <div class="cmp-paper-info">
          <div class="cmp-paper-title">${escHtml((p.title || 'Untitled').substring(0, 80))}</div>
          <div class="cmp-paper-meta">${escHtml(p.authors?.slice(0,2).map(a => a.name).join(', ') || '')}${p.year ? ' · ' + p.year : ''}</div>
        </div>
      </label>`;
  }).join('');

  container.insertAdjacentHTML('beforeend', items);
  updateCompareSelection();
}

function updateCompareSelection() {
  const checkboxes = document.querySelectorAll('#compare-paper-list input[type="checkbox"]');
  comparisonSelection = new Set([...checkboxes].filter(c => c.checked).map(c => c.value));
  const btn = document.getElementById('compare-btn');
  const count = comparisonSelection.size;
  if (btn) {
    btn.disabled = count < 2 || count > 10;
    btn.textContent = count < 2 ? `Select at least 2 papers (${count} selected)` : count > 10 ? `Too many papers selected (max 10)` : `Compare ${count} Selected Papers →`;
  }
}

async function runComparison() {
  const selectedPapers = savedPapers.filter(p => comparisonSelection.has(p.paperId));
  if (selectedPapers.length < 2) { showToast('Select at least 2 papers', 'error'); return; }
  const btn = document.getElementById('compare-btn');
  const status = document.getElementById('compare-status');
  const results = document.getElementById('compare-results');
  btn.disabled = true; btn.textContent = 'Comparing…';
  status.style.display = 'flex';
  status.innerHTML = `<div class="spinner"></div> AI is analysing ${selectedPapers.length} papers across 6 dimensions…`;
  results.innerHTML = '';
  try {
    const comparison = await gemini.comparePapers(selectedPapers);
    logActivity(`Compared ${selectedPapers.length} papers`, 'compare');
    status.style.display = 'none';
    showToast('Comparison complete', 'success');
    const qColors = { High: '#34D399', Moderate: '#F59E0B', Low: '#F87171', Unclear: '#6B7280' };
    const dimensions = comparison.dimensions || [];
    const papers = comparison.papers || [];
    const tableHtml = `
      <div class="comparison-table-wrap">
        <table class="comparison-table">
          <thead>
            <tr>
              <th class="dim-col">Dimension</th>
              ${papers.map(p => `<th>${escHtml(p.title?.substring(0,40) || 'Paper')} <span class="cmp-year">${escHtml(String(p.year || ''))}</span></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${dimensions.map(dim => `
              <tr>
                <td class="dim-label">${escHtml(dim)}</td>
                ${papers.map(p => {
                  const val = p[dim] || '—';
                  const isQuality = dim === 'Evidence Quality';
                  return `<td ${isQuality ? `style="color:${qColors[val] || 'inherit'};font-weight:600;"` : ''}>${escHtml(String(val))}</td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${comparison.overall_synthesis ? `<div class="comparison-synthesis"><div class="cs-label">Synthesis</div><p>${escHtml(comparison.overall_synthesis)}</p></div>` : ''}
      ${comparison.key_gap ? `<div class="comparison-gap"><div class="cs-label">Key Gap None of These Papers Address</div><p>${escHtml(comparison.key_gap)}</p></div>` : ''}
      <div class="comparison-actions">
        <button class="paper-btn" onclick="exportComparisonTable()">Export as CSV</button>
        <button class="paper-btn" onclick="exportToPDF('comparison-output','paper-comparison')">Export PDF</button>
      </div>`;
    results.innerHTML = `<div id="comparison-output">${tableHtml}</div>${AI_DISCLAIMER}`;  } catch (err) {
    status.innerHTML = `<span style="color:var(--error)">⚠ ${escHtml(err.message)}</span>`;
    showToast(err.message, 'error');
  } finally {
    updateCompareSelection();
  }
}

function exportComparisonTable() {
  const table = document.querySelector('.comparison-table');
  if (!table) return;
  const rows = [...table.querySelectorAll('tr')].map(row =>
    [...row.querySelectorAll('th,td')].map(c => `"${c.innerText.replace(/"/g, '""')}"`).join(',')
  );
  downloadBlob(rows.join('\n'), 'nexus-paper-comparison.csv', 'text/csv');
  showToast('Comparison exported as CSV', 'success');
}

// ═══ CITATION MANAGER ════════════════════════════════════════════════════════
function setCiteStyle(style, tabEl) {
  currentCiteStyle = style;
  document.querySelectorAll('.cite-tab').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');
  renderCitations();
}

function getCitation(paper, style) {
  switch(style) {
    case 'mla':       return semanticScholar.formatMLA(paper);
    case 'harvard':   return semanticScholar.formatHarvard(paper);
    case 'vancouver': return semanticScholar.formatVancouver(paper);
    case 'chicago':   return semanticScholar.formatChicago(paper);
    default:          return semanticScholar.formatAPA(paper);
  }
}

function renderCitations() {
  const container = document.getElementById('citation-list');
  if (!container) return;
  if (!savedPapers.length) {
    container.innerHTML = '<div class="empty-state" style="padding:3rem 0;">No saved papers. Search for papers and save them to your library to generate citations.</div>';
    return;
  }
  const sorted = [...savedPapers].sort((a, b) => (a.authors?.[0]?.name || '').localeCompare(b.authors?.[0]?.name || ''));
  container.innerHTML = sorted.map((p, i) => {
    const citation = getCitation(p, currentCiteStyle);
    const safeId = `cite-${i}`;
    return `
      <div class="citation-item" id="${safeId}">
        <div class="citation-num">${i + 1}</div>
        <div class="citation-text" id="ctext-${i}">${escHtml(citation)}</div>
        <div class="citation-item-btns">
          <button class="paper-btn" onclick="copyCitation(${i})">Copy</button>
        </div>
      </div>`;
  }).join('');
}

function copyCitation(idx) {
  const el = document.getElementById(`ctext-${idx}`);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText)
    .then(() => showToast('Citation copied', 'success'))
    .catch(() => showToast('Could not copy', 'error'));
}

function copyAllCitations() {
  const sorted = [...savedPapers].sort((a, b) => (a.authors?.[0]?.name || '').localeCompare(b.authors?.[0]?.name || ''));
  const text = sorted.map((p, i) => `${i + 1}. ${getCitation(p, currentCiteStyle)}`).join('\n\n');
  navigator.clipboard.writeText(text)
    .then(() => showToast(`${savedPapers.length} citations copied`, 'success'))
    .catch(() => showToast('Could not copy', 'error'));
}

function exportCitations() {
  const styleLabels = { apa: 'APA', mla: 'MLA', harvard: 'Harvard', vancouver: 'Vancouver', chicago: 'Chicago' };
  const sorted = [...savedPapers].sort((a, b) => (a.authors?.[0]?.name || '').localeCompare(b.authors?.[0]?.name || ''));
  const header = `Nexus Reference List — ${styleLabels[currentCiteStyle] || currentCiteStyle.toUpperCase()} Format\nGenerated: ${new Date().toLocaleDateString()}\n${'─'.repeat(60)}\n\n`;
  const body = sorted.map((p, i) => `${i + 1}. ${getCitation(p, currentCiteStyle)}`).join('\n\n');
  downloadBlob(header + body, `nexus-references-${currentCiteStyle}.txt`, 'text/plain');
  showToast('Reference list exported', 'success');
}

// ─── Feature 4: BibTeX export ─────────────────────────────────────────────────
function exportBibtex() {
  if (!savedPapers.length) { showToast('No saved papers to export', 'error'); return; }
  const entries = savedPapers.map(p => citations.formatBibtex(p)).join('\n\n');
  const header  = `% Nexus BibTeX Export — ${new Date().toLocaleDateString()}\n% ${savedPapers.length} reference${savedPapers.length !== 1 ? 's' : ''}\n\n`;
  downloadBlob(header + entries, 'nexus-references.bib', 'text/plain');
  showToast(`${savedPapers.length} references exported as BibTeX`, 'success');
  logActivity('Exported BibTeX reference list', 'citations');
}

// ─── Feature 4: RIS export (Mendeley / Zotero / EndNote) ─────────────────────
function exportRIS() {
  if (!savedPapers.length) { showToast('No saved papers to export', 'error'); return; }
  const entries = savedPapers.map(p => citations.formatRIS(p)).join('\n\n');
  const header  = `; Nexus RIS Export — ${new Date().toLocaleDateString()}\n; ${savedPapers.length} reference${savedPapers.length !== 1 ? 's' : ''}\n\n`;
  downloadBlob(header + entries, 'nexus-references.ris', 'application/x-research-info-systems');
  showToast(`${savedPapers.length} references exported as RIS (Mendeley/Zotero/EndNote)`, 'success');
  logActivity('Exported RIS reference list', 'citations');
}

// ═══ PROJECTS ════════════════════════════════════════════════════════════════
function openProjectModal() {
  document.getElementById('project-name-input').value  = '';
  document.getElementById('project-field-input').value = '';
  showModal('project-modal');
  setTimeout(() => document.getElementById('project-name-input')?.focus(), 50);
}

function submitProject() {
  const name  = document.getElementById('project-name-input')?.value.trim();
  const field = document.getElementById('project-field-input')?.value.trim() || 'General';
  if (!name) { showToast('Please enter a project name', 'error'); return; }
  const project = { id: Date.now(), name, field, papers: 0, hypotheses: 0, createdAt: Date.now() };
  projects.push(project);
  localStorage.setItem('nexus_projects', JSON.stringify(projects));
  document.getElementById('dash-projects').textContent = projects.length;
  renderProjects();
  logActivity(`Created project: "${name}"`, 'projects');
  closeModal('project-modal');
  showToast(`Project "${name}" created`, 'success');
}

function deleteProject(id) {
  const proj = projects.find(p => p.id === id);
  projects = projects.filter(p => p.id !== id);
  localStorage.setItem('nexus_projects', JSON.stringify(projects));
  document.getElementById('dash-projects').textContent = projects.length;
  renderProjects();
  if (proj) showToast(`"${proj.name}" deleted`, 'info');
}

function renderProjects() {
  const container = document.getElementById('projects-grid');
  if (!projects.length) { container.innerHTML = '<div class="empty-state">No projects yet. Create your first project to organise your research.</div>'; return; }
  const sorted = [...projects].sort((a, b) => b.createdAt - a.createdAt);
  container.innerHTML = sorted.map(p => `
    <div class="project-card">
      <button class="proj-delete" onclick="event.stopPropagation();deleteProject(${p.id})" title="Delete project">✕</button>
      <div class="proj-name">${escHtml(p.name)}</div>
      <div class="proj-field">${escHtml(p.field)}</div>
      <div class="proj-stats">
        <div class="proj-stat"><span>${p.papers}</span> papers</div>
        <div class="proj-stat"><span>${p.hypotheses}</span> hypotheses</div>
      </div>
      <div class="proj-date">Created ${timeAgo(p.createdAt)}</div>
    </div>`).join('');
}

// ═══ RESEARCH ALERTS ═════════════════════════════════════════════════════════
function openAlertModal() {
  document.getElementById('alert-topic-input').value = '';
  document.getElementById('alert-email-input').value = '';
  document.getElementById('alert-frequency-input').value = 'weekly';
  showModal('alert-modal');
  setTimeout(() => document.getElementById('alert-topic-input')?.focus(), 50);
}

function submitAlert() {
  const topic = document.getElementById('alert-topic-input')?.value.trim();
  const email = document.getElementById('alert-email-input')?.value.trim();
  const frequency = document.getElementById('alert-frequency-input')?.value;
  if (!topic) { showToast('Please enter a research topic', 'error'); return; }
  const alert = { id: Date.now(), topic, email, frequency, createdAt: Date.now(), lastChecked: null };
  alerts.push(alert);
  localStorage.setItem('nexus_alerts', JSON.stringify(alerts));
  closeModal('alert-modal');
  renderAlerts();
  logActivity(`Created alert: "${topic}"`, 'alerts');
  showToast(`Alert created for "${topic}"`, 'success');
}

function deleteAlert(id) {
  const al = alerts.find(a => a.id === id);
  alerts = alerts.filter(a => a.id !== id);
  localStorage.setItem('nexus_alerts', JSON.stringify(alerts));
  renderAlerts();
  if (al) showToast(`Alert deleted`, 'info');
}

function renderAlerts() {
  const container = document.getElementById('alerts-list');
  if (!container) return;
  if (!alerts.length) {
    container.innerHTML = '<div class="empty-state" style="padding:3rem 0;">No alerts yet. Create your first alert to stay updated on new publications.</div>';
    return;
  }
  const freqLabels = { daily: 'Daily digest', weekly: 'Weekly digest', monthly: 'Monthly digest' };
  container.innerHTML = alerts.map(a => `
    <div class="alert-card">
      <div class="alert-topic">${escHtml(a.topic)}</div>
      <div class="alert-meta">
        <span class="alert-freq">${escHtml(freqLabels[a.frequency] || a.frequency)}</span>
        ${a.email ? `<span class="alert-email">→ ${escHtml(a.email)}</span>` : '<span class="alert-email" style="color:var(--muted)">No email set</span>'}
        <span class="alert-date">Created ${timeAgo(a.createdAt)}</span>
      </div>
      <div class="alert-status">
        <div class="alert-status-dot"></div>
        <span>Active · Email delivery pending Supabase configuration</span>
      </div>
      <button class="alert-delete" onclick="deleteAlert(${a.id})">Delete</button>
    </div>`).join('');
}

// ═══ AI COST TRACKER ══════════════════════════════════════════════════════════
function renderCostTracker() {
  const summaryContainer = document.getElementById('cost-summary-row');
  const tableContainer   = document.getElementById('cost-table-wrap');
  if (!summaryContainer || !tableContainer) return;

  const log = JSON.parse(localStorage.getItem('nexus_api_costs') || '[]');

  if (!log.length) {
    summaryContainer.innerHTML = '';
    tableContainer.innerHTML = '<div class="empty-state" style="padding:3rem 0;">No API calls logged yet. Configure your Gemini API key and start using AI features to see costs here.</div>';
    return;
  }

  // Aggregate by feature
  const byFeature = {};
  let totalCost = 0, totalIn = 0, totalOut = 0;
  log.forEach(entry => {
    const f = entry.feature || 'general';
    if (!byFeature[f]) byFeature[f] = { calls: 0, cost: 0, inputTokens: 0, outputTokens: 0 };
    byFeature[f].calls++;
    byFeature[f].cost += entry.cost;
    byFeature[f].inputTokens += entry.inputTokens;
    byFeature[f].outputTokens += entry.outputTokens;
    totalCost += entry.cost;
    totalIn += entry.inputTokens;
    totalOut += entry.outputTokens;
  });

  const featureLabels = {
    hypothesis: 'Hypothesis Generator', literature_review: 'Literature Review',
    cross_field: 'Cross-Field Discovery', plain_language: 'Plain Language Builder',
    comparison: 'Paper Comparison', general: 'General'
  };

  summaryContainer.innerHTML = `
    <div class="cost-card"><div class="cost-card-label">Total spent</div><div class="cost-card-value">$${totalCost.toFixed(4)}</div></div>
    <div class="cost-card"><div class="cost-card-label">Total API calls</div><div class="cost-card-value">${log.length.toLocaleString()}</div></div>
    <div class="cost-card"><div class="cost-card-label">Input tokens</div><div class="cost-card-value">${(totalIn/1000).toFixed(1)}K</div></div>
    <div class="cost-card"><div class="cost-card-label">Output tokens</div><div class="cost-card-value">${(totalOut/1000).toFixed(1)}K</div></div>`;

  const sortedFeatures = Object.entries(byFeature).sort((a, b) => b[1].cost - a[1].cost);
  const maxCost = sortedFeatures[0]?.[1].cost || 1;

  tableContainer.innerHTML = `
    <div class="cost-header">Cost by Feature</div>
    <div class="cost-feature-list">
      ${sortedFeatures.map(([feature, data]) => `
        <div class="cost-feature-row">
          <div class="cost-feature-name">${escHtml(featureLabels[feature] || feature)}</div>
          <div class="cost-bar-wrap">
            <div class="cost-bar" style="width:${Math.round((data.cost / maxCost) * 100)}%"></div>
          </div>
          <div class="cost-feature-stats">
            <span class="cost-amt">$${data.cost.toFixed(4)}</span>
            <span class="cost-calls">${data.calls} call${data.calls !== 1 ? 's' : ''}</span>
          </div>
        </div>`).join('')}
    </div>
    <div class="cost-header" style="margin-top:1.5rem;">Recent Calls</div>
    <div class="cost-table-scroll">
      <table class="cost-table">
        <thead><tr><th>Date</th><th>Feature</th><th>Input tokens</th><th>Output tokens</th><th>Cost</th></tr></thead>
        <tbody>
          ${[...log].reverse().slice(0, 50).map(entry => `
            <tr>
              <td>${new Date(entry.date).toLocaleDateString()}</td>
              <td>${escHtml(featureLabels[entry.feature] || entry.feature || '—')}</td>
              <td style="font-family:var(--font-mono)">${entry.inputTokens.toLocaleString()}</td>
              <td style="font-family:var(--font-mono)">${entry.outputTokens.toLocaleString()}</td>
              <td style="font-family:var(--font-mono);color:var(--cyan)">$${entry.cost.toFixed(5)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function clearCostLog() {
  localStorage.removeItem('nexus_api_costs');
  renderCostTracker();
  showToast('Cost log cleared', 'info');
}

// ═══ PDF & DOCX EXPORT ═══════════════════════════════════════════════════════
function exportToPDF(contentId, filename = 'nexus-export') {
  const el = document.getElementById(contentId);
  if (!el) { showToast('Nothing to export', 'error'); return; }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const text = el.innerText;
    const lines = doc.splitTextToSize(text, 170);
    let y = 20;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    lines.forEach(line => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(line, 20, y);
      y += 6;
    });
    doc.save(`${filename}.pdf`);
    showToast('PDF exported', 'success');
  } catch (e) {
    showToast('PDF export failed — check CDN loaded', 'error');
    console.error(e);
  }
}

function exportToDOCX(contentId, filename = 'nexus-export') {
  const el = document.getElementById(contentId);
  if (!el) { showToast('Nothing to export', 'error'); return; }
  try {
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.8;margin:2cm;}</style></head><body>${el.innerHTML}</body></html>`;
    if (window.htmlDocx) {
      const blob = window.htmlDocx.asBlob(htmlContent);
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `${filename}.docx` });
      a.click();
      URL.revokeObjectURL(url);
      showToast('DOCX exported', 'success');
    } else {
      // Fallback: save as .doc (HTML that Word can open)
      downloadBlob(htmlContent, `${filename}.doc`, 'application/msword');
      showToast('Document exported (open with Word)', 'success');
    }
  } catch (e) {
    showToast('DOCX export failed', 'error');
    console.error(e);
  }
}

// ═══ MODALS ═══════════════════════════════════════════════════════════════════
const ALL_MODALS = ['upgrade-modal', 'project-modal', 'signout-modal', 'alert-modal', 'profile-modal'];


function showModal(id) {
  document.getElementById(id).style.display = 'flex';
  document.addEventListener('keydown', handleModalEsc);
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
  document.removeEventListener('keydown', handleModalEsc);
}

function handleModalEsc(e) {
  if (e.key === 'Escape') {
    ALL_MODALS.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') closeModal(id);
    });
  }
}

function showUpgradeModal(reason = 'Upgrade to get unlimited access.') {
  document.getElementById('modal-reason').textContent = reason;

  // Populate PayFast form with current user's email
  const email = currentUser?.email || '';
  const pfEmail = document.getElementById('pf-email');
  if (pfEmail) pfEmail.value = email;

  // Set return/cancel URLs dynamically
  const base = window.location.origin + window.location.pathname.replace('dashboard.html', '');
  const returnUrl = document.getElementById('pf-return-url');
  const cancelUrl = document.getElementById('pf-cancel-url');
  if (returnUrl) returnUrl.value = base + 'payment-success.html';
  if (cancelUrl) cancelUrl.value = window.location.href;

  // Set billing date to today
  const today = new Date();
  const billingDate = document.getElementById('pf-billing-date');
  if (billingDate) billingDate.value = today.toISOString().split('T')[0];

  // Wire Stripe button — replace placeholder with real link once configured
  const stripeBtn = document.getElementById('upgrade-stripe-btn');
  const STRIPE_LINK = 'https://buy.stripe.com/YOUR_PAYMENT_LINK_HERE'; // ← replace with your Stripe Payment Link
  if (stripeBtn) {
    stripeBtn.href = STRIPE_LINK;
    if (STRIPE_LINK.includes('YOUR_PAYMENT_LINK_HERE')) {
      stripeBtn.style.opacity = '0.5';
      stripeBtn.title = 'Configure STRIPE_LINK in dashboard.js to enable';
      stripeBtn.addEventListener('click', e => { e.preventDefault(); showToast('Add your Stripe Payment Link to dashboard.js first', 'info'); });
    }
  }

  showModal('upgrade-modal');
}


function confirmSignOut() { showModal('signout-modal'); }

// ═══ SIGN OUT ════════════════════════════════════════════════════════════════
async function handleSignOut() {
  closeModal('signout-modal');
  try { await nexusAuth.signOut(); } catch (e) { /* ignore */ }
  localStorage.removeItem('nexus_last_page');
  window.location.href = '../index.html';
}

// ═══ TOAST ═══════════════════════════════════════════════════════════════════
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// ═══ UTILITIES ════════════════════════════════════════════════════════════════
function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function copyTextContent(text) {
  navigator.clipboard.writeText(text)
    .then(() => showToast('Copied to clipboard', 'success'))
    .catch(() => showToast('Could not access clipboard', 'error'));
}

// Restore hub open states on load
document.addEventListener('DOMContentLoaded', restoreOpenHubs);
