// ─── ADMIN CONFIG ─────────────────────────────────────────────────────────────
// CHANGE THIS PASSWORD before going to production!
const ADMIN_PASSWORD = 'nexus-admin-2026';
// ─────────────────────────────────────────────────────────────────────────────

// ─── AUTH GATE ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Update clock
  setInterval(() => {
    const el = document.getElementById('admin-time');
    if (el) el.textContent = new Date().toLocaleTimeString();
  }, 1000);

  // Enter key on password field
  document.getElementById('gate-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') checkPassword();
  });
});

function checkPassword() {
  const input = document.getElementById('gate-password').value;
  const errorEl = document.getElementById('gate-error');
  const btn = document.getElementById('gate-btn');

  if (input === ADMIN_PASSWORD) {
    document.getElementById('gate').style.display = 'none';
    document.getElementById('admin-app').style.display = 'block';
    loadAdminData();
  } else {
    errorEl.textContent = 'Incorrect password. Please try again.';
    errorEl.style.display = 'block';
    document.getElementById('gate-password').value = '';
    btn.textContent = 'Try again →';
    setTimeout(() => { btn.textContent = 'Continue →'; }, 2000);
    document.getElementById('gate-password').focus();
  }
}

// ─── LOAD ALL ADMIN DATA ─────────────────────────────────────────────────────
function loadAdminData() {
  const savedPapers  = JSON.parse(localStorage.getItem('nexus_saved_papers') || '[]');
  const projects     = JSON.parse(localStorage.getItem('nexus_projects')     || '[]');
  const activityLog  = JSON.parse(localStorage.getItem('nexus_activity')     || '[]');
  const alerts       = JSON.parse(localStorage.getItem('nexus_alerts')       || '[]');
  const costLog      = JSON.parse(localStorage.getItem('nexus_api_costs')    || '[]');

  renderStats(savedPapers, projects, activityLog, alerts, costLog);
  renderFeatureUsage(costLog);
  renderCostBreakdown(costLog);
  renderActivity(activityLog);
  renderAlerts(alerts);
  renderConfigStatus();
}

// ─── STATS ───────────────────────────────────────────────────────────────────
function renderStats(papers, projects, activity, alerts, costLog) {
  const totalCost = costLog.reduce((sum, e) => sum + (e.cost || 0), 0);
  const thisMonth = costLog.filter(e => new Date(e.date).getMonth() === new Date().getMonth());
  const monthCost = thisMonth.reduce((sum, e) => sum + (e.cost || 0), 0);

  const stats = [
    { label: 'Saved Papers', value: papers.length, sub: 'in library' },
    { label: 'Projects', value: projects.length, sub: 'active' },
    { label: 'API Calls (total)', value: costLog.length.toLocaleString(), sub: `${thisMonth.length} this month` },
    { label: 'Total AI Cost', value: `$${totalCost.toFixed(3)}`, sub: `$${monthCost.toFixed(3)} this month` },
    { label: 'Research Alerts', value: alerts.length, sub: 'configured' },
  ];

  document.getElementById('admin-stats-grid').innerHTML = stats.map(s => `
    <div class="admin-stat">
      <div class="as-label">${escHtml(s.label)}</div>
      <div class="as-value">${escHtml(String(s.value))}</div>
      <div class="as-sub">${escHtml(s.sub)}</div>
    </div>`).join('');
}

// ─── FEATURE USAGE ───────────────────────────────────────────────────────────
function renderFeatureUsage(costLog) {
  const container = document.getElementById('admin-feature-usage');
  if (!costLog.length) { container.innerHTML = '<div class="empty-admin">No API calls logged yet.</div>'; return; }

  const featureLabels = {
    hypothesis: 'Hypothesis Generator', literature_review: 'Literature Review',
    cross_field: 'Cross-Field Discovery', plain_language: 'Plain Language Builder',
    comparison: 'Paper Comparison', general: 'General'
  };

  const counts = {};
  costLog.forEach(e => { const f = e.feature || 'general'; counts[f] = (counts[f] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;

  container.innerHTML = sorted.map(([feature, count]) => `
    <div class="feature-usage-row">
      <div class="fu-name">${escHtml(featureLabels[feature] || feature)}</div>
      <div class="fu-bar-wrap"><div class="fu-bar" style="width:${Math.round((count / max) * 100)}%"></div></div>
      <div class="fu-count">${count}</div>
    </div>`).join('');
}

// ─── COST BREAKDOWN ──────────────────────────────────────────────────────────
function renderCostBreakdown(costLog) {
  const container = document.getElementById('admin-cost-breakdown');
  if (!costLog.length) { container.innerHTML = '<div class="empty-admin">No costs logged yet.</div>'; return; }

  const featureLabels = {
    hypothesis: 'Hypothesis Generator', literature_review: 'Literature Review',
    cross_field: 'Cross-Field Discovery', plain_language: 'Plain Language Builder',
    comparison: 'Paper Comparison', general: 'General'
  };

  const byFeature = {};
  costLog.forEach(e => {
    const f = e.feature || 'general';
    if (!byFeature[f]) byFeature[f] = { cost: 0, calls: 0 };
    byFeature[f].cost += (e.cost || 0);
    byFeature[f].calls++;
  });

  const sorted = Object.entries(byFeature).sort((a, b) => b[1].cost - a[1].cost);

  container.innerHTML = sorted.map(([feature, data]) => `
    <div class="cost-breakdown-row">
      <span class="cbr-name">${escHtml(featureLabels[feature] || feature)}</span>
      <span class="cbr-calls">${data.calls} calls</span>
      <span class="cbr-cost">$${data.cost.toFixed(4)}</span>
    </div>`).join('');
}

// ─── ACTIVITY ────────────────────────────────────────────────────────────────
function renderActivity(activityLog) {
  const container = document.getElementById('admin-activity');
  if (!activityLog.length) { container.innerHTML = '<div class="empty-admin">No activity logged.</div>'; return; }

  container.innerHTML = activityLog.slice(0, 20).map(a => `
    <div class="admin-activity-item">
      <div class="aai-text">${escHtml(a.text)}</div>
      <div class="aai-time">${timeAgo(a.time)}</div>
    </div>`).join('');
}

// ─── ALERTS ──────────────────────────────────────────────────────────────────
function renderAlerts(alerts) {
  const container = document.getElementById('admin-alerts');
  if (!alerts.length) { container.innerHTML = '<div class="empty-admin">No research alerts configured.</div>'; return; }

  const freqLabels = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
  container.innerHTML = alerts.map(a => `
    <div class="admin-alert-row">
      <div class="aar-topic">${escHtml(a.topic)}</div>
      <div class="aar-meta">${escHtml(freqLabels[a.frequency] || a.frequency)} · ${a.email ? escHtml(a.email) : 'No email'} · Created ${timeAgo(a.createdAt)}</div>
    </div>`).join('');
}

// ─── CONFIG STATUS ────────────────────────────────────────────────────────────
function renderConfigStatus() {
  // Detect what's configured by checking for placeholder values (client-side only)
  const configs = [
    {
      name: 'GEMINI API KEY',
      check: () => {
        try {
          // We can't read the constant directly, so check if it's the placeholder string
          return typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY';
        } catch(e) { return false; }
      },
      ok: 'Configured',
      warn: 'Not configured — add to js/gemini.js',
      note: 'Required for all AI features'
    },
    {
      name: 'SUPABASE',
      check: () => {
        try { return typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL !== 'YOUR_SUPABASE_URL'; }
        catch(e) { return false; }
      },
      ok: 'Configured',
      warn: 'Not configured — add to js/supabase-client.js',
      note: 'Required for auth & email alerts'
    },
    {
      name: 'DEV MODE',
      check: () => { try { return typeof DEV_MODE !== 'undefined' && DEV_MODE === true; } catch(e) { return false; } },
      ok: 'Active (bypasses auth)',
      warn: 'Disabled (auth enforced)',
      note: 'Set DEV_MODE=false for production',
      invert: true
    },
    {
      name: 'JSPDF LIBRARY',
      check: () => typeof window.jspdf !== 'undefined',
      ok: 'Loaded',
      warn: 'Not loaded (check CDN)',
      note: 'Required for PDF export'
    },
    {
      name: 'HTML-DOCX LIBRARY',
      check: () => typeof window.htmlDocx !== 'undefined',
      ok: 'Loaded',
      warn: 'Fallback mode (opens in Word)',
      note: 'Required for DOCX export',
      warn_is_ok: true
    },
    {
      name: 'EMAIL DELIVERY',
      check: () => false, // Always shows as pending until Supabase edge function is deployed
      ok: 'Active',
      warn: 'Pending Supabase setup',
      note: 'Needs pg_cron + Resend configured'
    }
  ];

  document.getElementById('config-grid').innerHTML = configs.map(c => {
    const isOk = c.check();
    const status = isOk ? 'ok' : (c.warn_is_ok ? 'warn' : (c.invert ? 'warn' : 'err'));
    const label  = isOk ? c.ok : c.warn;
    return `
      <div class="config-item">
        <div class="config-name">${escHtml(c.name)}</div>
        <div class="config-status">
          <div class="config-dot ${status}"></div>
          ${escHtml(label)}
        </div>
        <div class="config-note">${escHtml(c.note)}</div>
      </div>`;
  }).join('');
}

// ─── DATA EXPORT ──────────────────────────────────────────────────────────────
function exportData(type) {
  const keys = {
    papers: 'nexus_saved_papers', projects: 'nexus_projects',
    costs: 'nexus_api_costs', activity: 'nexus_activity'
  };
  const data = localStorage.getItem(keys[type]) || '[]';
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url, download: `nexus-${type}-export-${new Date().toISOString().split('T')[0]}.json`
  });
  a.click();
  URL.revokeObjectURL(url);
}

function confirmReset() {
  const confirmed = window.confirm('⚠️ This will permanently delete ALL user data (papers, projects, activity, costs, alerts) stored in this browser. This cannot be undone. Are you sure?');
  if (!confirmed) return;
  const confirmed2 = window.confirm('Last warning — are you absolutely sure you want to delete all data?');
  if (!confirmed2) return;
  ['nexus_saved_papers', 'nexus_projects', 'nexus_activity', 'nexus_api_costs', 'nexus_alerts', 'nexus_last_page'].forEach(k => localStorage.removeItem(k));
  alert('All user data has been cleared. Reloading dashboard...');
  loadAdminData();
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function timeAgo(ts) {
  if (!ts) return 'n/a';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
