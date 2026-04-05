// ─── RESEARCH MEMORY ──────────────────────────────────────────────────────────
// Gives Nexus persistent context about what the user is working on.
// When a project is "active", its context is automatically prepended to every
// AI call so responses are focused on the user's actual research goals.
//
// Public API:
//   ResearchMemory.setActive(projectId)   → activate a project
//   ResearchMemory.clearActive()           → deactivate
//   ResearchMemory.getActive()             → { id, name, field, notes, topics, paperCount }
//   ResearchMemory.getContext()            → formatted string injected into AI prompts
//   ResearchMemory.addNote(text)           → append a context note
//   ResearchMemory.addTopic(topic)         → log a searched/explored topic
//   ResearchMemory.applyToSidebar()        → update sidebar workspace block
//   ResearchMemory.renderBanner()          → show/hide in-page memory banner
// ──────────────────────────────────────────────────────────────────────────────

const ResearchMemory = (() => {
  const ACTIVE_KEY  = 'nexus_active_project';
  const MEMORY_KEY  = 'nexus_memory_';          // + projectId

  // ── Storage helpers ────────────────────────────────────────────────────────
  function _getActive() {
    try { return JSON.parse(localStorage.getItem(ACTIVE_KEY)); }
    catch { return null; }
  }

  function _saveActive(data) {
    try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(data)); }
    catch {}
  }

  function _getMemory(projectId) {
    try { return JSON.parse(localStorage.getItem(MEMORY_KEY + projectId) || 'null') || { notes: [], topics: [], paperCount: 0, hypothesisCount: 0 }; }
    catch { return { notes: [], topics: [], paperCount: 0, hypothesisCount: 0 }; }
  }

  function _saveMemory(projectId, data) {
    try { localStorage.setItem(MEMORY_KEY + projectId, JSON.stringify(data)); }
    catch {}
  }

  // ── Core API ───────────────────────────────────────────────────────────────
  function setActive(project) {
    // project = { id, name, field }
    _saveActive({ id: project.id, name: project.name, field: project.field || 'General', activatedAt: Date.now() });
    applyToSidebar();
    renderBanner();
    _updateTopBarMemory();
    if (typeof showToast === 'function') {
      showToast(`🧠 Research Memory active: "${project.name}"`, 'success');
    }
  }

  function clearActive() {
    localStorage.removeItem(ACTIVE_KEY);
    applyToSidebar();
    renderBanner();
    _updateTopBarMemory();
    if (typeof showToast === 'function') {
      showToast('Research Memory cleared', 'info');
    }
  }

  function getActive() {
    const active = _getActive();
    if (!active) return null;
    const mem = _getMemory(active.id);
    return { ...active, ...mem };
  }

  // Add a free-text note to the active project memory
  function addNote(text) {
    const active = _getActive();
    if (!active || !text?.trim()) return;
    const mem = _getMemory(active.id);
    mem.notes = [text.trim(), ...mem.notes].slice(0, 10); // keep latest 10
    _saveMemory(active.id, mem);
  }

  // Log a topic the user has explored
  function addTopic(topic) {
    const active = _getActive();
    if (!active || !topic?.trim()) return;
    const mem = _getMemory(active.id);
    // Deduplicate, keep latest 15
    mem.topics = [topic.trim(), ...mem.topics.filter(t => t !== topic.trim())].slice(0, 15);
    _saveMemory(active.id, mem);
  }

  // Increment paper/hypothesis counters
  function increment(type) {
    const active = _getActive();
    if (!active) return;
    const mem = _getMemory(active.id);
    if (type === 'paper')      mem.paperCount      = (mem.paperCount      || 0) + 1;
    if (type === 'hypothesis') mem.hypothesisCount = (mem.hypothesisCount || 0) + 1;
    _saveMemory(active.id, mem);
  }

  // Build the context string that gets prepended to AI prompts
  function getContext() {
    const active = getActive();
    if (!active) return '';

    const parts = [
      `RESEARCHER'S ACTIVE PROJECT CONTEXT (always consider this when generating output):`,
      `Project Name: "${active.name}"`,
      `Research Field: ${active.field || 'Not specified'}`,
    ];

    if (active.topics && active.topics.length) {
      parts.push(`Topics explored so far: ${active.topics.slice(0, 8).join(', ')}`);
    }
    if (active.notes && active.notes.length) {
      parts.push(`Researcher notes:\n${active.notes.slice(0, 3).map(n => `  - ${n}`).join('\n')}`);
    }
    if (active.paperCount > 0) {
      parts.push(`Papers saved to this project: ${active.paperCount}`);
    }
    if (active.hypothesisCount > 0) {
      parts.push(`Hypotheses generated so far: ${active.hypothesisCount}`);
    }

    return `\n---\n${parts.join('\n')}\n---\n\n`;
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  // Update the sidebar "ACTIVE WORKSPACE" block
  function applyToSidebar() {
    const active = _getActive();
    const block  = document.getElementById('team-nav-indicator');
    const nameEl = document.getElementById('sidebar-team-name');
    if (!block || !nameEl) return;
    if (active) {
      nameEl.textContent = active.name;
      block.style.display = '';
    } else {
      block.style.display = 'none';
    }
  }

  // Show/hide a subtle memory banner below the top bar on every page
  function renderBanner() {
    const active = _getActive();
    let banner = document.getElementById('memory-banner');

    if (!active) {
      if (banner) banner.remove();
      return;
    }

    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'memory-banner';
      banner.className = 'memory-banner';
      // Insert after top-bar
      const topBar = document.getElementById('top-bar');
      if (topBar?.parentNode) {
        topBar.parentNode.insertBefore(banner, topBar.nextSibling);
      } else {
        document.body.appendChild(banner);
      }
    }

    const mem = _getMemory(active.id);
    const topicStr = mem.topics.length
      ? `<span class="mem-topics">${mem.topics.slice(0, 3).map(t => `<span class="mem-topic">${t}</span>`).join('')}${mem.topics.length > 3 ? `<span class="mem-topic mem-topic--more">+${mem.topics.length - 3} more</span>` : ''}</span>`
      : '';

    banner.innerHTML = `
      <svg class="mem-icon" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/>
        <path d="M12 6v6l4 2"/>
      </svg>
      <span class="mem-label">Research Memory:</span>
      <span class="mem-project">${escHtml ? escHtml(active.name) : active.name}</span>
      ${topicStr}
      <button class="mem-add-note-btn" onclick="ResearchMemory.showNoteInput()" title="Add a context note">＋ Note</button>
      <button class="mem-clear-btn" onclick="ResearchMemory.clearActive()" title="Deactivate this project from memory">✕</button>`;
  }

  function _updateTopBarMemory() {
    // Future: update a top bar memory indicator if added
  }

  // Inline note input inside the banner
  function showNoteInput() {
    const banner = document.getElementById('memory-banner');
    if (!banner) return;
    let noteInput = banner.querySelector('.mem-note-input-row');
    if (noteInput) { noteInput.remove(); return; } // toggle off

    noteInput = document.createElement('div');
    noteInput.className = 'mem-note-input-row';
    noteInput.innerHTML = `
      <input type="text" class="mem-note-input" id="mem-note-field" placeholder="Add context note, e.g. 'Focus on rodent models only'..." maxlength="200">
      <button class="mem-note-save" onclick="ResearchMemory._saveNote()">Save</button>`;
    banner.appendChild(noteInput);
    setTimeout(() => banner.querySelector('#mem-note-field')?.focus(), 30);
  }

  function _saveNote() {
    const input = document.getElementById('mem-note-field');
    if (!input?.value.trim()) return;
    addNote(input.value.trim());
    renderBanner(); // re-render to show new note
    if (typeof showToast === 'function') showToast('Context note saved to Research Memory', 'success');
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    applyToSidebar();
    renderBanner();
  }

  return {
    setActive, clearActive, getActive,
    addNote, addTopic, increment,
    getContext, applyToSidebar, renderBanner,
    showNoteInput, _saveNote, init
  };
})();
