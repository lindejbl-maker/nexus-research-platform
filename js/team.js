// ═══ NEXUS TEAM COLLABORATION ════════════════════════════════════════════════
// Full team workspace: create/join teams, shared library, shared projects,
// activity feed, member management, role system.
// localStorage-first — Supabase-synced when configured.

const TeamManager = (() => {

  const STORAGE_KEY = 'nexus_team_workspace';
  const ACTIVITY_KEY = 'nexus_team_activity';
  const INVITE_KEY   = 'nexus_team_invites';

  // ── Roles ─────────────────────────────────────────────────────────────────
  const ROLES = {
    owner:  { label: 'Owner',  level: 3, color: '#F59E0B' },
    admin:  { label: 'Admin',  level: 2, color: '#4F8CEA' },
    member: { label: 'Member', level: 1, color: '#34D399' },
    viewer: { label: 'Viewer', level: 0, color: '#6B7280' }
  };

  // ── Generate IDs ──────────────────────────────────────────────────────────
  function genId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  function save(team) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(team)); } catch (_) {}
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
  }

  function saveActivity(feed) {
    try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(feed.slice(0, 200))); } catch (_) {}
  }

  function loadActivity() {
    try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]'); } catch { return []; }
  }

  // ── Current user (from profile/auth) ──────────────────────────────────────
  function currentUser() {
    const profile  = (typeof nexusProfile !== 'undefined') ? (nexusProfile.get() || {}) : {};
    const authUser = JSON.parse(localStorage.getItem('nexus_user') || '{}') || {};
    return {
      id:          authUser.id   || 'local_user',
      name:        authUser.name || profile.name || 'Researcher',
      email:       authUser.email || profile.email || '',
      institution: profile.institution || '',
      field:       profile.field || ''
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEAM CRUD
  // ═════════════════════════════════════════════════════════════════════════
  function createTeam(name, institution, plan = 'department') {
    const me = currentUser();
    const team = {
      id:          genId('team'),
      name:        name.trim(),
      institution: institution.trim(),
      code:        genCode(),
      plan,
      ownerId:     me.id,
      createdAt:   new Date().toISOString(),
      members: [{
        id:         me.id,
        name:       me.name,
        email:      me.email,
        role:       'owner',
        joinedAt:   new Date().toISOString(),
        lastActive: new Date().toISOString(),
        field:      me.field,
        papersShared: 0,
        hypothesesGenerated: 0
      }],
      sharedPapers:     [],
      sharedProjects:   [],
      sharedHypotheses: [],
      settings: {
        allowMemberInvites: true,
        defaultRole:        'member',
        shareHypotheses:    true,
        shareNotebook:      false,
        allowPublicJoin:    true
      }
    };
    save(team);
    logActivity('team_created', `Created team workspace "${name}"`, me);
    renderTeamUI();
    return team;
  }

  function joinTeam(code) {
    // In local mode, look for a team with this code in localStorage
    // In Supabase mode, would query the DB
    const existing = load();
    if (existing && existing.code === code.toUpperCase()) {
      showToast('You are already in this team', 'info');
      return existing;
    }
    // Simulate joining — in production this looks up the team in Supabase
    showToast('Team not found locally. Share your Supabase config to join remote teams.', 'error');
    return null;
  }

  function leaveTeam() {
    const team = load();
    if (!team) return;
    const me = currentUser();
    if (team.ownerId === me.id) {
      showToast('Transfer ownership before leaving your team', 'error');
      return;
    }
    team.members = team.members.filter(m => m.id !== me.id);
    save(team);
    showToast('You have left the team', 'success');
    renderTeamUI();
  }

  function disbandTeam() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    showToast('Team disbanded', 'success');
    renderTeamUI();
  }

  function getTeam() {
    return load();
  }

  function isInTeam() {
    return !!load();
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MEMBER MANAGEMENT
  // ═════════════════════════════════════════════════════════════════════════
  function inviteMember(name, email, role = 'member') {
    const team = load();
    if (!team) return null;

    // Check if already a member
    if (team.members.some(m => m.email === email)) {
      showToast('This email is already a team member', 'error');
      return null;
    }

    const newMember = {
      id:         genId('mbr'),
      name:       name.trim() || email.split('@')[0],
      email:      email.trim(),
      role,
      joinedAt:   new Date().toISOString(),
      lastActive: null,
      field:      '',
      papersShared: 0,
      hypothesesGenerated: 0,
      status: 'invited' // invited | active
    };

    team.members.push(newMember);
    save(team);

    const me = currentUser();
    logActivity('member_invited', `Invited ${newMember.name} (${email}) as ${role}`, me);
    showToast(`Invite sent to ${email}`, 'success');
    renderMemberList(team);
    return newMember;
  }

  function updateMemberRole(memberId, newRole) {
    const team = load();
    if (!team) return;
    const member = team.members.find(m => m.id === memberId);
    if (!member) return;
    const oldRole = member.role;
    member.role = newRole;
    save(team);
    const me = currentUser();
    logActivity('role_changed', `Changed ${member.name}'s role from ${oldRole} to ${newRole}`, me);
    showToast(`${member.name} is now ${ROLES[newRole].label}`, 'success');
    renderMemberList(team);
  }

  function removeMember(memberId) {
    const team = load();
    if (!team) return;
    const member = team.members.find(m => m.id === memberId);
    if (!member) return;
    if (member.role === 'owner') { showToast('Cannot remove team owner', 'error'); return; }
    team.members = team.members.filter(m => m.id !== memberId);
    save(team);
    const me = currentUser();
    logActivity('member_removed', `Removed ${member.name} from the team`, me);
    showToast(`${member.name} removed`, 'success');
    renderMemberList(team);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SHARED LIBRARY
  // ═════════════════════════════════════════════════════════════════════════
  function sharePaper(paper) {
    const team = load();
    if (!team) { showToast('Join a team first to share papers', 'error'); return; }
    if (team.sharedPapers.some(p => p.paperId === paper.paperId)) {
      showToast('Already shared with team', 'info'); return;
    }
    const me = currentUser();
    const sharedPaper = {
      ...paper,
      sharedBy:   me.id,
      sharedByName: me.name,
      sharedAt:   new Date().toISOString()
    };
    team.sharedPapers.unshift(sharedPaper);
    save(team);
    logActivity('paper_shared', `Shared "${paper.title.substring(0, 60)}"`, me);
    showToast('Paper shared with team', 'success');
    // Update member stats
    const memberEntry = team.members.find(m => m.id === me.id);
    if (memberEntry) { memberEntry.papersShared = (memberEntry.papersShared || 0) + 1; save(team); }
  }

  function unSharePaper(paperId) {
    const team = load();
    if (!team) return;
    team.sharedPapers = team.sharedPapers.filter(p => p.paperId !== paperId);
    save(team);
    showToast('Paper removed from shared library', 'success');
    renderSharedLibrary();
  }

  function getSharedPapers(filterMemberId = null) {
    const team = load();
    if (!team) return [];
    if (filterMemberId) return team.sharedPapers.filter(p => p.sharedBy === filterMemberId);
    return team.sharedPapers;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SHARED PROJECTS
  // ═════════════════════════════════════════════════════════════════════════
  function createSharedProject(name, description, field = '') {
    const team = load();
    if (!team) return null;
    const me = currentUser();
    const project = {
      id:          genId('proj'),
      name:        name.trim(),
      description: description.trim(),
      field,
      createdBy:   me.id,
      createdByName: me.name,
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
      collaborators: [me.id],
      papers:      [],
      notes:       '',
      hypotheses:  [],
      status:      'active' // active | completed | archived
    };
    team.sharedProjects.unshift(project);
    save(team);
    logActivity('project_created', `Created shared project "${name}"`, me);
    showToast('Shared project created', 'success');
    renderSharedProjects();
    return project;
  }

  function updateProject(projectId, updates) {
    const team = load();
    if (!team) return;
    const proj = team.sharedProjects.find(p => p.id === projectId);
    if (!proj) return;
    Object.assign(proj, updates, { updatedAt: new Date().toISOString() });
    save(team);
    showToast('Project updated', 'success');
    renderSharedProjects();
  }

  function addPaperToProject(projectId, paper) {
    const team = load();
    if (!team) return;
    const proj = team.sharedProjects.find(p => p.id === projectId);
    if (!proj) return;
    if (!proj.papers.some(p => p.paperId === paper.paperId)) {
      proj.papers.push(paper);
      proj.updatedAt = new Date().toISOString();
      save(team);
      const me = currentUser();
      logActivity('paper_added_to_project', `Added paper to "${proj.name}"`, me);
      showToast('Paper added to project', 'success');
    }
  }

  function addNoteToProject(projectId, note) {
    const team = load();
    if (!team) return;
    const proj = team.sharedProjects.find(p => p.id === projectId);
    if (!proj) return;
    proj.notes = note;
    proj.updatedAt = new Date().toISOString();
    save(team);
    showToast('Notes saved', 'success');
  }

  function archiveProject(projectId) {
    const team = load();
    if (!team) return;
    const proj = team.sharedProjects.find(p => p.id === projectId);
    if (!proj) return;
    proj.status = proj.status === 'archived' ? 'active' : 'archived';
    save(team);
    showToast(proj.status === 'archived' ? 'Project archived' : 'Project restored', 'success');
    renderSharedProjects();
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SHARED HYPOTHESES
  // ═════════════════════════════════════════════════════════════════════════
  function shareHypothesis(hypothesis) {
    const team = load();
    if (!team) return;
    const me = currentUser();
    team.sharedHypotheses.unshift({
      id:           genId('hyp'),
      text:         hypothesis.text || hypothesis,
      score:        hypothesis.score || null,
      sharedBy:     me.id,
      sharedByName: me.name,
      sharedAt:     new Date().toISOString(),
      comments:     [],
      reactions:    { useful: 0, interesting: 0, needsWork: 0 }
    });
    save(team);
    logActivity('hypothesis_shared', `Shared a hypothesis with the team`, me);
    showToast('Hypothesis shared with team', 'success');
  }

  function reactToHypothesis(hypId, reaction) {
    const team = load();
    if (!team) return;
    const hyp = team.sharedHypotheses.find(h => h.id === hypId);
    if (!hyp) return;
    hyp.reactions[reaction] = (hyp.reactions[reaction] || 0) + 1;
    save(team);
    renderSharedHypotheses();
  }

  function commentOnHypothesis(hypId, text) {
    const team = load();
    if (!team) return;
    const hyp = team.sharedHypotheses.find(h => h.id === hypId);
    if (!hyp) return;
    const me = currentUser();
    hyp.comments.push({ author: me.name, text, at: new Date().toISOString() });
    save(team);
    renderSharedHypotheses();
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ACTIVITY FEED
  // ═════════════════════════════════════════════════════════════════════════
  function logActivity(type, message, user = null) {
    const me = user || currentUser();
    const feed = loadActivity();
    feed.unshift({
      id:      genId('act'),
      type,
      message,
      userId:  me.id,
      userName: me.name,
      at:      new Date().toISOString()
    });
    saveActivity(feed);
  }

  function getActivity(limit = 30) {
    return loadActivity().slice(0, limit);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEAM SETTINGS
  // ═════════════════════════════════════════════════════════════════════════
  function updateSettings(settings) {
    const team = load();
    if (!team) return;
    Object.assign(team.settings, settings);
    save(team);
    showToast('Team settings saved', 'success');
  }

  function renewCode() {
    const team = load();
    if (!team) return;
    team.code = genCode();
    save(team);
    showToast('New join code generated', 'success');
    renderTeamSettings(team);
    return team.code;
  }

  function updateTeamName(name, institution) {
    const team = load();
    if (!team) return;
    team.name = name.trim();
    if (institution) team.institution = institution.trim();
    save(team);
    showToast('Team updated', 'success');
    renderTeamHub();
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STATS
  // ═════════════════════════════════════════════════════════════════════════
  function getStats() {
    const team = load();
    if (!team) return {};
    return {
      members:     team.members.length,
      papers:      team.sharedPapers.length,
      projects:    team.sharedProjects.filter(p => p.status !== 'archived').length,
      hypotheses:  team.sharedHypotheses.length,
      activity:    loadActivity().length
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UI RENDER FUNCTIONS
  // ═════════════════════════════════════════════════════════════════════════

  // ── Avatar helper ──────────────────────────────────────────────────────
  function avatarHtml(name, size = 36, color = null) {
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const colors   = ['#4F8CEA','#34D399','#F59E0B','#EC4899','#8B5CF6','#06B6D4','#F97316'];
    const bg       = color || colors[name.charCodeAt(0) % colors.length];
    return `<div class="team-avatar" style="width:${size}px;height:${size}px;background:${bg};font-size:${Math.floor(size*0.37)}px;">${initials}</div>`;
  }

  function roleHtml(role) {
    const r = ROLES[role] || ROLES.member;
    return `<span class="team-role-badge" style="color:${r.color};border-color:${r.color}33;background:${r.color}11">${r.label}</span>`;
  }

  function timeAgo(isoStr) {
    if (!isoStr) return 'Never';
    const diff = Date.now() - new Date(isoStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)   return 'Just now';
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30)  return `${d}d ago`;
    return new Date(isoStr).toLocaleDateString();
  }

  // ── Team Hub (main overview) ──────────────────────────────────────────
  function renderTeamHub() {
    const container = document.getElementById('team-hub-content');
    if (!container) return;
    const team = load();

    if (!team) {
      container.innerHTML = renderNoTeam();
      return;
    }

    const stats = getStats();
    const activity = getActivity(8);
    const recentMembers = team.members.slice(0, 6);

    container.innerHTML = `
      <div class="team-header-card">
        <div class="team-header-left">
          <div class="team-header-icon">${avatarHtml(team.name, 52, '#4F8CEA')}</div>
          <div>
            <div class="team-header-name">${escHtml(team.name)}</div>
            <div class="team-header-inst">${escHtml(team.institution || 'Research Team')}</div>
            <div class="team-header-meta">
              <span class="team-plan-badge">${team.plan.toUpperCase()}</span>
              <span class="team-code-display">Join code: <strong>${team.code}</strong></span>
              <button class="team-copy-code" onclick="TeamManager.copyCode()" title="Copy join code">📋 Copy</button>
            </div>
          </div>
        </div>
        <div class="team-header-actions">
          <button class="paper-btn" onclick="showPage('teammembers', document.getElementById('nav-teammembers'))">Manage Members</button>
          <button class="paper-btn" onclick="showPage('teamsettings', document.getElementById('nav-teamsettings'))">Settings</button>
        </div>
      </div>

      <div class="team-stats-row">
        <div class="team-stat-card">
          <div class="team-stat-num">${stats.members}</div>
          <div class="team-stat-label">Members</div>
        </div>
        <div class="team-stat-card">
          <div class="team-stat-num">${stats.papers}</div>
          <div class="team-stat-label">Shared Papers</div>
        </div>
        <div class="team-stat-card">
          <div class="team-stat-num">${stats.projects}</div>
          <div class="team-stat-label">Active Projects</div>
        </div>
        <div class="team-stat-card">
          <div class="team-stat-num">${stats.hypotheses}</div>
          <div class="team-stat-label">Hypotheses Shared</div>
        </div>
      </div>

      <div class="team-two-col">
        <div class="team-panel">
          <div class="team-panel-header">
            <div class="team-panel-title">Recent Activity</div>
            <div class="team-panel-sub">${activity.length} events</div>
          </div>
          ${activity.length ? activity.map(a => `
            <div class="team-activity-item">
              <div class="team-act-icon">${activityIcon(a.type)}</div>
              <div class="team-act-body">
                <span class="team-act-user">${escHtml(a.userName)}</span>
                <span class="team-act-msg"> ${escHtml(a.message)}</span>
                <div class="team-act-time">${timeAgo(a.at)}</div>
              </div>
            </div>`).join('') : '<div class="team-empty-state">No activity yet — start by sharing a paper</div>'}
        </div>

        <div class="team-panel">
          <div class="team-panel-header">
            <div class="team-panel-title">Team Members</div>
            <button class="paper-btn" style="font-size:11px;padding:5px 12px;" onclick="TeamManager.showInviteModal()">+ Invite</button>
          </div>
          ${recentMembers.map(m => `
            <div class="team-member-row">
              ${avatarHtml(m.name, 34)}
              <div class="team-member-info">
                <div class="team-member-name">${escHtml(m.name)}${m.status === 'invited' ? ' <span class="team-invited-tag">invited</span>' : ''}</div>
                <div class="team-member-email">${escHtml(m.email)}</div>
              </div>
              ${roleHtml(m.role)}
              <div class="team-member-active">${timeAgo(m.lastActive)}</div>
            </div>`).join('')}
          ${team.members.length > 6 ? `<div class="team-see-all"><a href="#" onclick="showPage('teammembers',document.getElementById('nav-teammembers'));return false;">See all ${team.members.length} members →</a></div>` : ''}
        </div>
      </div>`;
  }

  function activityIcon(type) {
    const icons = {
      team_created:      '🏗',
      member_invited:    '✉️',
      member_removed:    '👋',
      role_changed:      '🔑',
      paper_shared:      '📄',
      project_created:   '📁',
      hypothesis_shared: '💡',
      paper_added_to_project: '📄',
    };
    return icons[type] || '📌';
  }

  function renderNoTeam() {
    return `
      <div class="team-no-team">
        <div class="team-no-team-icon">🏛</div>
        <h2>No team workspace yet</h2>
        <p>Create a team workspace for your lab or department, or join an existing one with a join code.</p>
        <div class="team-no-team-actions">
          <button class="btn-accent" onclick="TeamManager.showCreateTeamModal()">Create Team Workspace</button>
          <button class="paper-btn" onclick="TeamManager.showJoinTeamModal()">Join with Code</button>
        </div>
        <div class="team-no-team-hint">
          <strong>Department plan</strong> — one workspace for your entire team, shared libraries, collaborative projects. Starts at $199/month.
        </div>
      </div>`;
  }

  // ── Member List ───────────────────────────────────────────────────────
  function renderMemberList(team) {
    team = team || load();
    const container = document.getElementById('team-members-list');
    if (!container || !team) return;

    container.innerHTML = team.members.map(m => `
      <div class="team-member-card" id="mcard-${m.id}">
        <div class="team-member-card-left">
          ${avatarHtml(m.name, 44)}
          <div class="team-member-card-info">
            <div class="team-member-card-name">${escHtml(m.name)}${m.status === 'invited' ? ' <span class="team-invited-tag">Pending invite</span>' : ''}</div>
            <div class="team-member-card-email">${escHtml(m.email)}</div>
            <div class="team-member-card-meta">
              ${m.field ? `<span>${escHtml(m.field)}</span> ·` : ''}
              <span>Joined ${timeAgo(m.joinedAt)}</span> ·
              <span>Last active ${timeAgo(m.lastActive)}</span>
            </div>
          </div>
        </div>
        <div class="team-member-card-right">
          <div class="team-member-stats">
            <div class="tm-stat"><span>${m.papersShared || 0}</span><small>Papers</small></div>
            <div class="tm-stat"><span>${m.hypothesesGenerated || 0}</span><small>Hypotheses</small></div>
          </div>
          ${m.role !== 'owner' ? `
          <select class="dd-field-select" style="font-size:11px;padding:5px 8px;" onchange="TeamManager.updateMemberRole('${m.id}',this.value)">
            ${['admin','member','viewer'].map(r => `<option value="${r}"${m.role===r?' selected':''}>${ROLES[r].label}</option>`).join('')}
          </select>
          <button class="team-remove-btn" onclick="TeamManager.confirmRemoveMember('${m.id}','${escHtml(m.name)}')">Remove</button>
          ` : roleHtml('owner')}
        </div>
      </div>`).join('');
  }

  function confirmRemoveMember(id, name) {
    if (confirm(`Remove ${name} from the team?`)) removeMember(id);
  }

  // ── Shared Library ────────────────────────────────────────────────────
  function renderSharedLibrary() {
    const container = document.getElementById('team-shared-library');
    if (!container) return;
    const papers = getSharedPapers();

    if (!papers.length) {
      container.innerHTML = '<div class="team-empty-state">No papers shared yet. Save a paper and click "Share with Team".</div>';
      return;
    }

    container.innerHTML = papers.map(p => `
      <div class="team-shared-paper-card">
        <div class="team-shared-paper-header">
          <div class="team-shared-by">${avatarHtml(p.sharedByName || 'Team', 24)} <span>${escHtml(p.sharedByName || 'Team')}</span> <span class="team-shared-time">${timeAgo(p.sharedAt)}</span></div>
          <button class="team-remove-btn" style="font-size:10px;" onclick="TeamManager.unSharePaper('${p.paperId}')">Remove</button>
        </div>
        <div class="team-shared-paper-title">${escHtml(p.title || 'Untitled')}</div>
        <div class="team-shared-paper-meta">
          ${p.authors?.length ? `<span>${p.authors.slice(0,3).map(a=>a.name||a).join(', ')}${p.authors.length>3?` +${p.authors.length-3}`:''}</span> ·` : ''}
          ${p.year ? `<span>${p.year}</span> ·` : ''}
          ${p.citationCount != null ? `<span>${p.citationCount} citations</span>` : ''}
        </div>
        ${p.abstract ? `<div class="team-shared-paper-abstract">${escHtml(p.abstract.substring(0, 200))}…</div>` : ''}
        ${p.externalIds?.DOI ? `<a class="team-paper-link" href="https://doi.org/${p.externalIds.DOI}" target="_blank">View paper →</a>` : ''}
      </div>`).join('');
  }

  // ── Shared Projects ───────────────────────────────────────────────────
  function renderSharedProjects() {
    const container = document.getElementById('team-shared-projects');
    if (!container) return;
    const team = load();
    if (!team?.sharedProjects?.length) {
      container.innerHTML = '<div class="team-empty-state">No shared projects yet. Create one to collaborate with your team.</div>';
      return;
    }

    container.innerHTML = team.sharedProjects.map(p => `
      <div class="team-project-card ${p.status === 'archived' ? 'team-project-archived' : ''}">
        <div class="team-project-header">
          <div>
            <div class="team-project-name">${escHtml(p.name)}</div>
            <div class="team-project-meta">
              ${p.field ? `${escHtml(p.field)} · ` : ''}
              Created by ${escHtml(p.createdByName)} · Updated ${timeAgo(p.updatedAt)}
            </div>
          </div>
          <div class="team-project-actions">
            <span class="team-project-status ${p.status === 'archived' ? 'status-archived' : 'status-active'}">${p.status}</span>
            <button class="paper-btn" style="font-size:11px;padding:4px 10px;" onclick="TeamManager.openProjectDetail('${p.id}')">Open</button>
            <button class="team-remove-btn" style="font-size:10px;" onclick="TeamManager.archiveProject('${p.id}')">${p.status==='archived'?'Restore':'Archive'}</button>
          </div>
        </div>
        ${p.description ? `<div class="team-project-desc">${escHtml(p.description)}</div>` : ''}
        <div class="team-project-footer">
          <span>📄 ${p.papers.length} papers</span>
          <span>💡 ${p.hypotheses.length} hypotheses</span>
        </div>
      </div>`).join('');
  }

  // ── Shared Hypotheses ─────────────────────────────────────────────────
  function renderSharedHypotheses() {
    const container = document.getElementById('team-shared-hypotheses');
    if (!container) return;
    const team = load();
    if (!team?.sharedHypotheses?.length) {
      container.innerHTML = '<div class="team-empty-state">No hypotheses shared yet. Generate a hypothesis and share it with your team.</div>';
      return;
    }
    container.innerHTML = team.sharedHypotheses.map(h => `
      <div class="team-hyp-card">
        <div class="team-hyp-header">
          ${avatarHtml(h.sharedByName || 'Team', 28)} <span class="team-hyp-author">${escHtml(h.sharedByName)}</span>
          <span class="team-hyp-time">${timeAgo(h.sharedAt)}</span>
          ${h.score ? `<span class="team-hyp-score">Score: ${h.score}</span>` : ''}
        </div>
        <div class="team-hyp-text">${escHtml(h.text)}</div>
        <div class="team-hyp-reactions">
          <button class="team-react-btn" onclick="TeamManager.reactToHypothesis('${h.id}','useful')">👍 Useful (${h.reactions.useful||0})</button>
          <button class="team-react-btn" onclick="TeamManager.reactToHypothesis('${h.id}','interesting')">🔭 Interesting (${h.reactions.interesting||0})</button>
          <button class="team-react-btn" onclick="TeamManager.reactToHypothesis('${h.id}','needsWork')">🔧 Needs work (${h.reactions.needsWork||0})</button>
        </div>
        ${h.comments.length ? `<div class="team-hyp-comments">${h.comments.map(c => `<div class="team-comment"><strong>${escHtml(c.author)}</strong>: ${escHtml(c.text)}</div>`).join('')}</div>` : ''}
        <div class="team-hyp-comment-row">
          <input type="text" class="modal-input" id="comment-${h.id}" placeholder="Add comment…" style="font-size:12px;padding:6px 10px;" onkeydown="if(event.key==='Enter'){TeamManager.commentOnHypothesis('${h.id}',this.value);this.value='';}">
          <button class="paper-btn" style="font-size:11px;" onclick="const el=document.getElementById('comment-${h.id}');TeamManager.commentOnHypothesis('${h.id}',el.value);el.value='';">Post</button>
        </div>
      </div>`).join('');
  }

  // ── Team Settings ─────────────────────────────────────────────────────
  function renderTeamSettings(team) {
    team = team || load();
    const container = document.getElementById('team-settings-content');
    if (!container || !team) return;

    container.innerHTML = `
      <div class="team-settings-section">
        <div class="team-settings-title">Team Details</div>
        <div class="form-group-modal"><label class="modal-label">Team name</label>
          <input type="text" id="ts-name" class="modal-input" value="${escHtml(team.name)}">
        </div>
        <div class="form-group-modal"><label class="modal-label">Institution</label>
          <input type="text" id="ts-institution" class="modal-input" value="${escHtml(team.institution || '')}">
        </div>
        <button class="paper-btn" onclick="TeamManager.updateTeamName(document.getElementById('ts-name').value, document.getElementById('ts-institution').value)">Save Changes</button>
      </div>

      <div class="team-settings-section">
        <div class="team-settings-title">Join Code</div>
        <div class="team-code-box">
          <div class="team-code-big" id="team-code-display">${team.code}</div>
          <div class="team-code-hint">Share this code with colleagues to let them join your workspace</div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button class="paper-btn" onclick="TeamManager.copyCode()">📋 Copy Code</button>
            <button class="paper-btn" onclick="if(confirm('Generate a new code? The old code will stop working.'))TeamManager.renewCode()">🔄 New Code</button>
          </div>
        </div>
      </div>

      <div class="team-settings-section">
        <div class="team-settings-title">Permissions</div>
        <label class="team-toggle-row">
          <input type="checkbox" ${team.settings.allowMemberInvites?'checked':''} onchange="TeamManager.updateSettings({allowMemberInvites:this.checked})">
          <span>Allow members to invite others</span>
        </label>
        <label class="team-toggle-row">
          <input type="checkbox" ${team.settings.shareHypotheses?'checked':''} onchange="TeamManager.updateSettings({shareHypotheses:this.checked})">
          <span>Members can share hypotheses with team</span>
        </label>
        <label class="team-toggle-row">
          <input type="checkbox" ${team.settings.shareNotebook?'checked':''} onchange="TeamManager.updateSettings({shareNotebook:this.checked})">
          <span>Members can share Notebook entries with team</span>
        </label>
      </div>

      <div class="team-settings-section team-danger-zone">
        <div class="team-settings-title" style="color:var(--error);">Danger Zone</div>
        <button class="paper-btn team-danger-btn" onclick="if(confirm('Disband team? This cannot be undone.'))TeamManager.disbandTeam()">Disband Team</button>
      </div>`;
  }

  // ── Full page renders ──────────────────────────────────────────────────
  function renderTeamUI() {
    renderTeamHub();
    const team = load();
    if (team) {
      renderMemberList(team);
      renderSharedLibrary();
      renderSharedProjects();
      renderSharedHypotheses();
      renderTeamSettings(team);
    }
    // Update sidebar team indicator
    const indicator = document.getElementById('team-nav-indicator');
    if (indicator) indicator.style.display = team ? '' : 'none';
    const teamName = document.getElementById('sidebar-team-name');
    if (teamName) teamName.textContent = team ? team.name : '';
  }

  // ── Copy join code ─────────────────────────────────────────────────────
  function copyCode() {
    const team = load();
    if (!team) return;
    navigator.clipboard.writeText(team.code)
      .then(() => showToast(`Join code ${team.code} copied to clipboard`, 'success'));
  }

  // ── Modals ────────────────────────────────────────────────────────────
  function showCreateTeamModal() {
    document.getElementById('create-team-modal').style.display = 'flex';
  }

  function showJoinTeamModal() {
    document.getElementById('join-team-modal').style.display = 'flex';
  }

  function showInviteModal() {
    const el = document.getElementById('invite-member-modal');
    if (el) el.style.display = 'flex';
  }

  function submitCreateTeam() {
    const name = document.getElementById('ct-name')?.value?.trim();
    const inst  = document.getElementById('ct-institution')?.value?.trim();
    if (!name) { showToast('Enter a team name', 'error'); return; }
    createTeam(name, inst || '');
    closeModal('create-team-modal');
    showToast(`Team "${name}" created`, 'success');
    showPage('teamhub', document.getElementById('nav-teamhub'));
  }

  function submitJoinTeam() {
    const code = document.getElementById('jt-code')?.value?.trim();
    if (!code || code.length < 6) { showToast('Enter a valid 6-character code', 'error'); return; }
    joinTeam(code);
    closeModal('join-team-modal');
  }

  function submitInvite() {
    const name  = document.getElementById('inv-name')?.value?.trim();
    const email = document.getElementById('inv-email')?.value?.trim();
    const role  = document.getElementById('inv-role')?.value || 'member';
    if (!email) { showToast('Enter an email address', 'error'); return; }
    inviteMember(name, email, role);
    closeModal('invite-member-modal');
    if (document.getElementById('inv-name'))  document.getElementById('inv-name').value = '';
    if (document.getElementById('inv-email')) document.getElementById('inv-email').value = '';
  }

  function openProjectDetail(projectId) {
    const team = load();
    const proj = team?.sharedProjects?.find(p => p.id === projectId);
    if (!proj) return;
    document.getElementById('proj-detail-name').textContent  = proj.name;
    document.getElementById('proj-detail-notes').value       = proj.notes || '';
    document.getElementById('proj-detail-id').value          = proj.id;
    document.getElementById('project-detail-modal').style.display = 'flex';
    // Render papers in project
    const paperList = document.getElementById('proj-detail-papers');
    if (paperList) {
      paperList.innerHTML = proj.papers.length
        ? proj.papers.map(p => `<div class="proj-detail-paper"><span>${escHtml(p.title?.substring(0,60)||'Untitled')}</span></div>`).join('')
        : '<div class="team-empty-state" style="padding:1rem;">No papers added yet</div>';
    }
  }

  function saveProjectNotes() {
    const id    = document.getElementById('proj-detail-id')?.value;
    const notes = document.getElementById('proj-detail-notes')?.value || '';
    if (id) { addNoteToProject(id, notes); showToast('Notes saved', 'success'); }
  }

  // ── Auto-log research activity ─────────────────────────────────────────
  function autoLog(type, message) {
    if (!isInTeam()) return;
    logActivity(type, message);
  }

  return {
    // Core
    createTeam, joinTeam, leaveTeam, disbandTeam, getTeam, isInTeam, getStats,
    // Members
    inviteMember, updateMemberRole, removeMember, confirmRemoveMember,
    // Papers
    sharePaper, unSharePaper, getSharedPapers,
    // Projects
    createSharedProject, updateProject, addPaperToProject, addNoteToProject, archiveProject,
    // Hypotheses
    shareHypothesis, reactToHypothesis, commentOnHypothesis,
    // Settings
    updateSettings, renewCode, updateTeamName,
    // Activity
    logActivity, getActivity, autoLog,
    // UI
    renderTeamHub, renderMemberList, renderSharedLibrary, renderSharedProjects,
    renderSharedHypotheses, renderTeamSettings, renderTeamUI, copyCode,
    // Modals
    showCreateTeamModal, showJoinTeamModal, showInviteModal,
    submitCreateTeam, submitJoinTeam, submitInvite,
    openProjectDetail, saveProjectNotes, ROLES
  };

})();

// ─── Auto-init on load ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  TeamManager.renderTeamUI();
});

console.log('[Team] Team collaboration module loaded');
