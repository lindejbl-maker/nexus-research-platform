// ─── NEXUS ROLE SYSTEM ────────────────────────────────────────────────────────
// Manages user roles — what they are, what they see, how Nexus speaks to them.
// Storage: localStorage (Cloud SQL migration path: swap _load/_save only).
//
// Public API:
//   NexusRole.get()                → current role object or null
//   NexusRole.set(roleId)          → save role
//   NexusRole.getConfig()          → ROLE_CONFIGS[roleId] for active role
//   NexusRole.applyToSidebar()     → show/hide nav elements based on role
//   NexusRole.getWelcomeMessage()  → role-specific greeting string
//   NexusRole.getQuickActions()    → array of {label, page, icon} for home
// ──────────────────────────────────────────────────────────────────────────────

const ROLE_DEFINITIONS = [
  {
    id: 'researcher',
    label: 'Researcher / PhD',
    emoji: '🔬',
    description: 'Deep analysis, citation networks, novel hypotheses',
    color: '#8B5CF6'
  },
  {
    id: 'student',
    label: 'Student',
    emoji: '📚',
    description: 'Simplified explanations, topic overviews, guided prompts',
    color: '#3B82F6'
  },
  {
    id: 'patient',
    label: 'Patient / Caregiver',
    emoji: '🏥',
    description: 'Understand conditions, find the latest treatments in plain English',
    color: '#10B981'
  },
  {
    id: 'investor',
    label: 'Investor / VC',
    emoji: '📈',
    description: 'Validate science claims, spot overhyped tech, track trends',
    color: '#F59E0B'
  },
  {
    id: 'journalist',
    label: 'Journalist',
    emoji: '🗞️',
    description: 'Verify claims, find expert consensus, check if science is settled',
    color: '#EC4899'
  },
  {
    id: 'lawyer',
    label: 'Lawyer',
    emoji: '⚖️',
    description: 'Find gaps in precedent, synthesise case patterns from literature',
    color: '#6366F1'
  },
  {
    id: 'teacher',
    label: 'Teacher',
    emoji: '🎓',
    description: 'Find curriculum-relevant research, simplified summaries',
    color: '#14B8A6'
  },
  {
    id: 'curious',
    label: 'Curious Person',
    emoji: '🌟',
    description: 'Just wants to understand — plain English everything',
    color: '#F97316'
  }
];

// ─── ROLE CONFIGS ─────────────────────────────────────────────────────────────
// visibleHubs: which hub-* divs to show (undefined = show all)
// visibleItems: which nav-item IDs to show inside hubs (undefined = all in hub)
// hiddenHubs: hubs to completely hide
const ROLE_CONFIGS = {
  researcher: {
    hiddenHubs: [],           // sees everything
    hiddenItems: [],
    welcomeVerb: 'research',
    tone: 'technical',
    quickActions: [
      { label: 'Search Papers',       page: 'search',        icon: '🔍' },
      { label: 'Generate Hypothesis', page: 'hypothesis',    icon: '💡' },
      { label: 'Settled Science?',    page: 'sciencechecker',icon: '✅' },
      { label: 'Contradiction Check', page: 'contradiction', icon: '⚔️' },
      { label: 'Literature Review',   page: 'litreview',     icon: '📄' },
      { label: 'Grant Writer',        page: 'grantwriter',   icon: '💰' }
    ],
    tagline: "Your AI-powered research co-pilot."
  },
  student: {
    hiddenHubs: ['hub-team'],
    hiddenItems: ['nav-grantwriter', 'nav-deepdiver', 'nav-contradiction', 'nav-trendforecast', 'nav-alerts'],
    welcomeVerb: 'study',
    tone: 'educational',
    quickActions: [
      { label: 'Search Papers',       page: 'search',     icon: '🔍' },
      { label: 'Generate Hypothesis', page: 'hypothesis', icon: '💡' },
      { label: 'Literature Review',   page: 'litreview',  icon: '📄' },
      { label: 'Plain Language',      page: 'plainlang',  icon: '💬' },
      { label: 'My Projects',         page: 'projects',   icon: '📁' },
      { label: 'Saved Papers',        page: 'saved',      icon: '🔖' }
    ],
    tagline: "Understand any topic. Ace your research."
  },
  patient: {
    hiddenHubs: ['hub-create', 'hub-team'],
    hiddenItems: ['nav-trendforecast', 'nav-crossfield', 'nav-peerreview', 'nav-contradiction', 'nav-compare', 'nav-deepdiver'],
    welcomeVerb: 'understand',
    tone: 'plain',
    quickActions: [
      { label: 'Search Medical Papers',  page: 'search',        icon: '🔍' },
      { label: 'Is This Settled Science?', page: 'sciencechecker', icon: '✅' },
      { label: 'Plain English Explainer', page: 'plainlang',    icon: '💬' },
      { label: 'Research Alerts',        page: 'alerts',        icon: '🔔' },
      { label: 'Saved Papers',           page: 'saved',         icon: '🔖' }
    ],
    tagline: "What does science actually say about your condition?"
  },
  investor: {
    hiddenHubs: ['hub-write', 'hub-team'],
    hiddenItems: ['nav-peerreview', 'nav-hypothesis', 'nav-litreview', 'nav-experimentblueprint', 'nav-grantwriter', 'nav-alerts', 'nav-deepdiver'],
    welcomeVerb: 'analyse',
    tone: 'executive',
    quickActions: [
      { label: 'Trend Forecaster',      page: 'trendforecast', icon: '📈' },
      { label: 'Contradiction Detector',page: 'contradiction', icon: '⚔️' },
      { label: 'Cross-Field Discovery', page: 'crossfield',    icon: '🔗' },
      { label: 'Compare Papers',        page: 'compare',       icon: '⚖️' },
      { label: 'Search Papers',         page: 'search',        icon: '🔍' },
      { label: 'Saved Papers',          page: 'saved',         icon: '🔖' }
    ],
    tagline: "Validate the science. Spot hype before it costs you."
  },
  journalist: {
    hiddenHubs: ['hub-create', 'hub-write', 'hub-team'],
    hiddenItems: ['nav-experimentblueprint', 'nav-grantwriter', 'nav-trendforecast', 'nav-deepdiver'],
    welcomeVerb: 'verify',
    tone: 'plain',
    quickActions: [
      { label: 'Is This Settled Science?', page: 'sciencechecker', icon: '✅' },
      { label: 'Contradiction Detector', page: 'contradiction', icon: '⚔️' },
      { label: 'Search Papers',          page: 'search',        icon: '🔍' },
      { label: 'Cross-Field Discovery',  page: 'crossfield',    icon: '🔗' },
      { label: 'Saved Papers',           page: 'saved',         icon: '🔖' }
    ],
    tagline: "Is this settled science? Find out in seconds."
  },
  lawyer: {
    hiddenHubs: ['hub-write', 'hub-team'],
    hiddenItems: ['nav-trendforecast', 'nav-alerts', 'nav-grantwriter', 'nav-experimentblueprint', 'nav-peerreview', 'nav-plainlang'],
    welcomeVerb: 'research',
    tone: 'technical',
    quickActions: [
      { label: 'Search Papers',         page: 'search',        icon: '🔍' },
      { label: 'Literature Review',     page: 'litreview',     icon: '📄' },
      { label: 'Contradiction Detector',page: 'contradiction', icon: '⚔️' },
      { label: 'Compare Papers',        page: 'compare',       icon: '⚖️' },
      { label: 'Saved Papers',          page: 'saved',         icon: '🔖' },
      { label: 'Citation Manager',      page: 'citations',     icon: '📎' }
    ],
    tagline: "Find the gaps in precedent. Ground every claim in evidence."
  },
  teacher: {
    hiddenHubs: ['hub-team'],
    hiddenItems: ['nav-grantwriter', 'nav-contradiction', 'nav-deepdiver', 'nav-trendforecast', 'nav-peerreview', 'nav-experimentblueprint'],
    welcomeVerb: 'teach',
    tone: 'educational',
    quickActions: [
      { label: 'Search Papers',       page: 'search',     icon: '🔍' },
      { label: 'Plain Language',      page: 'plainlang',  icon: '💬' },
      { label: 'Generate Hypothesis', page: 'hypothesis', icon: '💡' },
      { label: 'Literature Review',   page: 'litreview',  icon: '📄' },
      { label: 'Cross-Field Discovery', page: 'crossfield', icon: '🔗' },
      { label: 'Saved Papers',        page: 'saved',      icon: '🔖' }
    ],
    tagline: "Bring the latest research into your classroom."
  },
  curious: {
    hiddenHubs: ['hub-create', 'hub-team'],
    hiddenItems: ['nav-trendforecast', 'nav-alerts', 'nav-peerreview', 'nav-contradiction', 'nav-compare', 'nav-deepdiver'],
    welcomeVerb: 'explore',
    tone: 'plain',
    quickActions: [
      { label: 'Search Any Topic',     page: 'search',        icon: '🔍' },
      { label: 'Is This Settled Science?', page: 'sciencechecker', icon: '✅' },
      { label: 'Plain English',        page: 'plainlang',     icon: '💬' },
      { label: 'Saved Papers',         page: 'saved',         icon: '🔖' }
    ],
    tagline: "Understand anything. No PhD required."
  }
};

// ─── Storage (localStorage → Cloud SQL migration point) ───────────────────────
const _ROLE_KEY = 'nexus_user_role';

function _loadRole() {
  try { return JSON.parse(localStorage.getItem(_ROLE_KEY)); }
  catch { return null; }
}

function _saveRole(roleId) {
  try { localStorage.setItem(_ROLE_KEY, JSON.stringify({ id: roleId, setAt: new Date().toISOString() })); }
  catch {}
}

// ─── Public API ───────────────────────────────────────────────────────────────
const NexusRole = {
  get() { return _loadRole(); },

  set(roleId) {
    if (!ROLE_DEFINITIONS.find(r => r.id === roleId)) return;
    _saveRole(roleId);
    this.applyToSidebar();
    this.applyRoleBadge();
  },

  getDefinition(roleId) {
    const id = roleId || (_loadRole()?.id) || 'researcher';
    return ROLE_DEFINITIONS.find(r => r.id === id) || ROLE_DEFINITIONS[0];
  },

  getConfig(roleId) {
    const id = roleId || (_loadRole()?.id) || 'researcher';
    return ROLE_CONFIGS[id] || ROLE_CONFIGS.researcher;
  },

  // Apply show/hide rules to every sidebar element
  applyToSidebar() {
    const cfg = this.getConfig();

    // Show all hubs and items first (reset)
    document.querySelectorAll('.nav-hub').forEach(h => h.style.display = '');
    document.querySelectorAll('.nav-item[id^="nav-"]').forEach(el => el.style.display = '');

    // Hide specified hubs
    (cfg.hiddenHubs || []).forEach(hubId => {
      const hub = document.getElementById(hubId);
      if (hub) hub.style.display = 'none';
    });

    // Hide specified items
    (cfg.hiddenItems || []).forEach(itemId => {
      const item = document.getElementById(itemId);
      if (item) item.style.display = 'none';
    });
  },

  // Inject/update the role badge in the top bar
  applyRoleBadge() {
    const def = this.getDefinition();
    let badge = document.getElementById('role-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'role-badge';
      badge.className = 'role-badge';
      badge.onclick = () => NexusRole.showRolePicker();
      // Insert into top bar before the user button
      const tbRight = document.querySelector('.tb-right');
      if (tbRight) tbRight.insertBefore(badge, tbRight.firstChild);
    }
    badge.innerHTML = `<span class="role-badge-emoji">${def.emoji}</span><span class="role-badge-label">${def.label}</span>`;
    badge.title = `Your role: ${def.label} — click to change`;
  },

  // Role-specific home page quick actions
  getQuickActions() {
    return this.getConfig().quickActions || ROLE_CONFIGS.researcher.quickActions;
  },

  // Tagline shown on the dashboard home
  getTagline() {
    return this.getConfig().tagline || '';
  },

  // Show the role picker modal (can be called anytime)
  showRolePicker(afterSave = null) {
    let modal = document.getElementById('role-picker-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'role-picker-modal';
      modal.className = 'modal-overlay role-picker-overlay';
      modal.innerHTML = `
        <div class="modal role-picker-modal" role="dialog" aria-label="Choose your role">
          <div class="role-picker-header">
            <div class="role-picker-title">Who are you?</div>
            <div class="role-picker-sub">Nexus adapts its tools and language to your role.</div>
          </div>
          <div class="role-grid" id="role-grid"></div>
          <div class="role-picker-footer">
            <button class="paper-btn" onclick="NexusRole.closeRolePicker()">Cancel</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    const grid = modal.querySelector('#role-grid');
    const current = _loadRole()?.id;
    grid.innerHTML = ROLE_DEFINITIONS.map(r => `
      <button class="role-card${r.id === current ? ' role-card--active' : ''}"
        onclick="NexusRole._selectRole('${r.id}', ${afterSave ? 'NexusRole._afterSave' : 'null'})"
        style="--role-color:${r.color}">
        <span class="role-card-emoji">${r.emoji}</span>
        <div class="role-card-label">${r.label}</div>
        <div class="role-card-desc">${r.description}</div>
      </button>`).join('');

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  _afterSave: null,

  _selectRole(roleId, cb) {
    this.set(roleId);
    this.closeRolePicker();
    // Update quick actions on home if visible
    if (typeof renderRoleQuickActions === 'function') renderRoleQuickActions();
    if (typeof showToast === 'function') {
      const def = this.getDefinition(roleId);
      showToast(`Role set to ${def.label} ${def.emoji}`, 'success');
    }
    if (typeof cb === 'function') cb();
  },

  closeRolePicker() {
    const modal = document.getElementById('role-picker-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  },

  // Called on first signup — force role selection before entering dashboard
  promptIfNew() {
    if (!_loadRole()) {
      this.showRolePicker();
    } else {
      this.applyToSidebar();
      this.applyRoleBadge();
    }
  }
};
