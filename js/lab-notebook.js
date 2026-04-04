// ═══ LAB NOTEBOOK ════════════════════════════════════════════════════════════
// Feature 3: Private daily research journal with AI connection surfacing.
// Entries persist to localStorage + Supabase. AI surfaces cross-entry connections.

const NOTEBOOK_KEY = 'nexus_lab_notebook';
let notebookEntries  = [];
let notebookFilter   = '';
let notebookActiveId = null;
let notebookFindingConnections = false;

// ─── Load + render ────────────────────────────────────────────────────────────
function initLabNotebook() {
  try {
    notebookEntries = JSON.parse(localStorage.getItem(NOTEBOOK_KEY) || '[]');
  } catch { notebookEntries = []; }
  renderNotebookList();
  renderNotebookEditor();
}

function renderNotebook() {
  initLabNotebook();
}

// ─── Entry CRUD ───────────────────────────────────────────────────────────────
function notebookNewEntry() {
  const entry = {
    id:        Date.now().toString(),
    title:     '',
    body:      '',
    tags:      [],
    mood:      '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    connections: []
  };
  notebookEntries.unshift(entry);
  notebookSaveAll();
  notebookActiveId = entry.id;
  renderNotebookList();
  renderNotebookEditor(entry);
  setTimeout(() => document.getElementById('nb-title')?.focus(), 100);
}

// Programmatic add (called by deep-diver etc.)
function notebookAddEntry(body, tags = [], showNotebook = false) {
  const entry = {
    id:        Date.now().toString(),
    title:     body.split('\n')[0].substring(0, 60) || 'Quick note',
    body,
    tags,
    mood:      '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    connections: []
  };
  notebookEntries.unshift(entry);
  notebookSaveAll();
  if (showNotebook) {
    showPage('notebook', document.getElementById('nav-notebook'));
    notebookActiveId = entry.id;
    renderNotebookList();
    renderNotebookEditor(entry);
  }
  return entry.id;
}

function notebookSave() {
  if (!notebookActiveId) return;
  const entry = notebookEntries.find(e => e.id === notebookActiveId);
  if (!entry) return;
  entry.title     = document.getElementById('nb-title')?.value?.trim() || 'Untitled entry';
  entry.body      = document.getElementById('nb-body')?.value || '';
  entry.mood      = document.getElementById('nb-mood')?.value || '';
  const tagStr    = document.getElementById('nb-tags')?.value || '';
  entry.tags      = tagStr.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  entry.updatedAt = new Date().toISOString();
  notebookSaveAll();
  renderNotebookList();
  showToast('Entry saved', 'success');
  if (typeof logActivity === 'function') logActivity(`Saved notebook entry: "${entry.title.substring(0, 40)}"`);
}

function notebookSaveAll() {
  // Always prune to latest 500 entries
  notebookEntries = notebookEntries.slice(0, 500);
  localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(notebookEntries));
  // Supabase sync (non-blocking)
  try {
    if (typeof nexusDB !== 'undefined' && typeof currentUser !== 'undefined' && currentUser?.id && nexusDB._isReal()) {
      window._supabase?.from('notebook_entries').upsert(
        notebookEntries.slice(0, 30).map(e => ({ user_id: currentUser.id, ...e })),
        { onConflict: 'id' }
      ).catch(() => {});
    }
  } catch (_) {}
}

function notebookDelete(id) {
  if (!confirm('Delete this entry? This cannot be undone.')) return;
  notebookEntries = notebookEntries.filter(e => e.id !== id);
  notebookSaveAll();
  if (notebookActiveId === id) notebookActiveId = notebookEntries[0]?.id || null;
  renderNotebookList();
  renderNotebookEditor(notebookEntries.find(e => e.id === notebookActiveId));
}

// ─── Select entry ─────────────────────────────────────────────────────────────
function notebookSelect(id) {
  // Auto-save current before switching
  if (notebookActiveId && notebookActiveId !== id) {
    const entry = notebookEntries.find(e => e.id === notebookActiveId);
    if (entry) {
      entry.title     = document.getElementById('nb-title')?.value?.trim() || entry.title;
      entry.body      = document.getElementById('nb-body')?.value || entry.body;
      entry.updatedAt = new Date().toISOString();
      notebookSaveAll();
    }
  }
  notebookActiveId = id;
  renderNotebookList();
  renderNotebookEditor(notebookEntries.find(e => e.id === id));
}

// ─── Search/filter ────────────────────────────────────────────────────────────
function notebookSearch(q) {
  notebookFilter = q.toLowerCase();
  renderNotebookList();
}

function notebookFilteredEntries() {
  if (!notebookFilter) return notebookEntries;
  return notebookEntries.filter(e =>
    e.title.toLowerCase().includes(notebookFilter) ||
    e.body.toLowerCase().includes(notebookFilter) ||
    e.tags.some(t => t.includes(notebookFilter))
  );
}

// ─── AI Connection Finder ─────────────────────────────────────────────────────
async function notebookFindConnections() {
  if (notebookFindingConnections) return;
  const entry = notebookEntries.find(e => e.id === notebookActiveId);
  if (!entry) { showToast('Open an entry first', 'error'); return; }
  if (!entry.body?.trim()) { showToast('Add some content to the entry first', 'error'); return; }

  notebookFindingConnections = true;
  const btn = document.getElementById('nb-connections-btn');
  const panel = document.getElementById('nb-connections-panel');
  if (btn) { btn.disabled = true; btn.textContent = '🔍 Finding connections…'; }
  if (panel) panel.innerHTML = '<div class="nb-connecting"><div class="spinner"></div><span>Gemini is scanning your notes and papers…</span></div>';

  try {
    const connections = await gemini.findNotebookConnections(
      entry.body,
      savedPapers.slice(0, 30),
      notebookEntries.filter(e => e.id !== entry.id).slice(0, 20)
    );
    entry.connections = connections;
    notebookSaveAll();
    renderNotebookConnections(connections);
  } catch (err) {
    if (panel) panel.innerHTML = `<div class="nb-conn-empty">⚠ ${escHtml(err.message)}</div>`;
  } finally {
    notebookFindingConnections = false;
    if (btn) { btn.disabled = false; btn.textContent = '🔍 Find connections'; }
  }
}

// ─── Render functions ─────────────────────────────────────────────────────────
function renderNotebookList() {
  const list   = document.getElementById('nb-list');
  if (!list) return;
  const filtered = notebookFilteredEntries();

  if (!filtered.length) {
    list.innerHTML = `<div class="nb-list-empty">${notebookFilter ? 'No entries match your search.' : 'No entries yet. Click + New Entry to start.'}</div>`;
    return;
  }

  list.innerHTML = filtered.map(e => {
    const isActive  = e.id === notebookActiveId;
    const date      = new Date(e.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const preview   = e.body?.replace(/\n/g, ' ').substring(0, 60) || '';
    const tagsHtml  = (e.tags || []).slice(0, 3).map(t => `<span class="nb-tag">${escHtml(t)}</span>`).join('');
    return `
      <div class="nb-list-item ${isActive ? 'nb-active' : ''}" onclick="notebookSelect('${e.id}')">
        <div class="nb-item-title">${escHtml(e.title || 'Untitled')}</div>
        <div class="nb-item-preview">${escHtml(preview)}</div>
        <div class="nb-item-footer">
          <span class="nb-item-date">${date}</span>
          ${tagsHtml}
          ${e.connections?.length ? `<span class="nb-conn-badge">${e.connections.length} connections</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

function renderNotebookEditor(entry) {
  const editor = document.getElementById('nb-editor');
  if (!editor) return;

  if (!entry) {
    editor.innerHTML = `
      <div class="nb-empty-editor">
        <div style="font-size:2.5rem;margin-bottom:1rem;">📓</div>
        <h3>Your Research Lab Notebook</h3>
        <p>Record observations, ideas, failed experiments, and hypotheses. AI will surface connections between your notes and your saved papers.</p>
        <button class="btn-accent" onclick="notebookNewEntry()" style="margin-top:1.5rem;">+ New Entry</button>
      </div>`;
    return;
  }

  const title  = escHtml(entry.title || '');
  const body   = escHtml(entry.body || '').replace(/&amp;/g, '&');
  const tags   = (entry.tags || []).join(', ');
  const mood   = entry.mood || '';
  const date   = new Date(entry.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  editor.innerHTML = `
    <div class="nb-editor-header">
      <input type="text" id="nb-title" class="nb-title-input" placeholder="Entry title…" value="${title}" maxlength="100">
      <div class="nb-editor-meta">
        <select id="nb-mood" class="nb-meta-select" title="How did this session go?">
          <option value="" ${!mood ? 'selected' : ''}>— mood —</option>
          <option value="🔥 Productive" ${mood === '🔥 Productive' ? 'selected' : ''}>🔥 Productive</option>
          <option value="🤔 Thinking" ${mood === '🤔 Thinking' ? 'selected' : ''}>🤔 Thinking</option>
          <option value="😤 Frustrated" ${mood === '😤 Frustrated' ? 'selected' : ''}>😤 Frustrated</option>
          <option value="💡 Eureka" ${mood === '💡 Eureka' ? 'selected' : ''}>💡 Eureka</option>
          <option value="😴 Slow day" ${mood === '😴 Slow day' ? 'selected' : ''}>😴 Slow day</option>
        </select>
        <span class="nb-date-label">Last saved: ${date}</span>
        <button class="nb-delete-btn" onclick="notebookDelete('${entry.id}')" title="Delete entry">🗑</button>
      </div>
    </div>
    <textarea id="nb-body" class="nb-body" placeholder="Write your observations, ideas, results, or anything on your mind…">${body}</textarea>
    <div class="nb-editor-footer">
      <input type="text" id="nb-tags" class="nb-tags-input" placeholder="Tags (comma-separated): e.g. crispr, failure, idea" value="${tags}">
      <button class="btn-accent" onclick="notebookSave()">Save entry</button>
    </div>

    <div class="nb-connections-section">
      <div class="nb-connections-header">
        <div class="nb-conn-title">AI Connections</div>
        <button class="paper-btn" id="nb-connections-btn" onclick="notebookFindConnections()">🔍 Find connections</button>
      </div>
      <div id="nb-connections-panel">
        ${entry.connections?.length ? '' : '<div class="nb-conn-empty">Click "Find connections" to let Gemini surface links between this entry and your saved papers and other notes.</div>'}
      </div>
    </div>`;

  if (entry.connections?.length) {
    renderNotebookConnections(entry.connections);
  }
}

function renderNotebookConnections(connections) {
  const panel = document.getElementById('nb-connections-panel');
  if (!panel) return;
  if (!connections?.length) {
    panel.innerHTML = '<div class="nb-conn-empty">No strong connections found with your current saved papers and notes. Add more papers to your library first.</div>';
    return;
  }
  panel.innerHTML = connections.map(c => `
    <div class="nb-conn-card nb-conn-${c.type || 'paper'}">
      <div class="nb-conn-type-badge">${c.type === 'note' ? '📓 Related entry' : '📄 Related paper'}</div>
      <div class="nb-conn-title">${escHtml(c.title || '')}</div>
      <div class="nb-conn-reason">${escHtml(c.reason || '')}</div>
      ${c.insight ? `<div class="nb-conn-insight">💡 ${escHtml(c.insight)}</div>` : ''}
    </div>`).join('');
}

// ─── Export notebook as markdown ──────────────────────────────────────────────
function exportNotebook() {
  const md = notebookEntries.map(e =>
    `# ${e.title || 'Untitled'}\n*${new Date(e.createdAt).toLocaleDateString()}* | Tags: ${e.tags?.join(', ') || 'none'}\n\n${e.body || ''}\n\n---\n`
  ).join('\n');
  const blob = new Blob([md], { type: 'text/markdown' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'nexus-lab-notebook.md';
  a.click(); URL.revokeObjectURL(url);
  showToast('Notebook exported as Markdown', 'success');
}

// Auto-save every 30 seconds when an entry is open
setInterval(() => {
  if (notebookActiveId && document.getElementById('nb-body')) {
    const entry = notebookEntries.find(e => e.id === notebookActiveId);
    if (entry) {
      const newBody = document.getElementById('nb-body')?.value || '';
      if (newBody !== entry.body) {
        entry.body      = newBody;
        entry.title     = document.getElementById('nb-title')?.value?.trim() || entry.title;
        entry.updatedAt = new Date().toISOString();
        notebookSaveAll();
      }
    }
  }
}, 30000);

console.log('[LabNotebook] Research Lab Notebook loaded');
