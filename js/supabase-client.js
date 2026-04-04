// ─── DEV MODE ────────────────────────────────────────────────────────────────
// Set DEV_MODE = true to skip login entirely and use a mock user for testing.
// Set it back to false when you have real Supabase credentials and are ready
// to accept real users.
const DEV_MODE = true;

const DEV_USER = {
  id: 'dev-user',
  email: 'researcher@nexus.ai',
  user_metadata: { first_name: 'Researcher', last_name: 'Dev' }
};
// ─────────────────────────────────────────────────────────────────────────────

// ─── CONFIGURATION ───────────────────────────────────────────────────────────
// 1. Go to https://supabase.com → New project
// 2. Settings → API → copy Project URL and anon/public key
// 3. Paste them below, then set DEV_MODE = false above
const SUPABASE_URL      = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
// ─────────────────────────────────────────────────────────────────────────────

// Dynamically load Supabase SDK
const supabaseScript = document.createElement('script');
supabaseScript.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
supabaseScript.onload = () => {
  window._supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.dispatchEvent(new Event('supabase-ready'));
};
supabaseScript.onerror = () => {
  console.warn('Nexus: Supabase SDK failed to load. Running in offline/demo mode.');
  window.dispatchEvent(new Event('supabase-ready'));
};
document.head.appendChild(supabaseScript);

// ─── AUTH ─────────────────────────────────────────────────────────────────────
const nexusAuth = {
  async signUp(email, password, metadata = {}) {
    if (DEV_MODE) return { data: { user: DEV_USER }, error: null };
    await waitForSupabase();
    if (!window._supabase) throw new Error('Database not connected. Please configure Supabase.');
    const result = await window._supabase.auth.signUp({
      email, password, options: { data: metadata }
    });
    // Auto-create profile row on sign-up
    if (result.data?.user && !result.error) {
      await nexusDB.saveProfile(result.data.user.id, {
        first_name: metadata.first_name || '',
        last_name:  metadata.last_name  || '',
        field:      metadata.field      || ''
      });
    }
    return result;
  },

  async signIn(email, password) {
    if (DEV_MODE) {
      window.location.href = 'dashboard.html';
      return { data: { user: DEV_USER }, error: null };
    }
    await waitForSupabase();
    if (!window._supabase) throw new Error('Database not connected. Please configure Supabase.');
    return await window._supabase.auth.signInWithPassword({ email, password });
  },

  async signInWithGoogle() {
    if (DEV_MODE) {
      window.location.href = 'dashboard.html';
      return;
    }
    await waitForSupabase();
    if (!window._supabase) throw new Error('Database not connected. Please configure Supabase.');
    return await window._supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/pages/dashboard.html' }
    });
  },

  async signOut() {
    if (DEV_MODE) { window.location.href = '../index.html'; return; }
    await waitForSupabase();
    if (window._supabase) await window._supabase.auth.signOut();
    window.location.href = '../index.html';
  },

  async getUser() {
    if (DEV_MODE) return DEV_USER;
    await waitForSupabase();
    if (!window._supabase) return null;
    const { data: { user } } = await window._supabase.auth.getUser();
    return user;
  },

  async requireAuth() {
    if (DEV_MODE) return DEV_USER;
    const user = await this.getUser();
    if (!user) {
      window.location.href = '/pages/login.html';
      throw new Error('Not authenticated');
    }
    return user;
  }
};

// ─── DATABASE LAYER ────────────────────────────────────────────────────────────
// Item 3: Replaces direct localStorage usage throughout the app.
// All methods fall back to localStorage in dev/offline mode so the app
// always works — even without Supabase credentials configured.
const nexusDB = {

  _isReal() {
    return !DEV_MODE && window._supabase && SUPABASE_URL !== 'YOUR_SUPABASE_URL';
  },

  // ── Profile ──────────────────────────────────────────────────────────────
  async saveProfile(userId, data) {
    const local = { ...data, updatedAt: new Date().toISOString() };
    localStorage.setItem('nexus_researcher_profile', JSON.stringify(local));
    if (!this._isReal()) return;
    try {
      await window._supabase.from('profiles').upsert({
        id:           userId,
        first_name:   data.first_name || data.field || '',
        last_name:    data.last_name || '',
        field:        data.field || '',
        subfield:     data.subfield || '',
        institution:  data.institution || '',
        career_stage: data.career_stage || '',
        country:      data.country || '',
        interests:    data.interests || [],
        grant_bodies: data.grant_bodies || [],
        updated_at:   new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (e) { console.warn('[nexusDB] saveProfile remote failed:', e.message); }
  },

  async getProfile(userId) {
    // Always try remote first if available
    if (this._isReal()) {
      try {
        const { data, error } = await window._supabase
          .from('profiles').select('*').eq('id', userId).single();
        if (!error && data) {
          localStorage.setItem('nexus_researcher_profile', JSON.stringify(data));
          return data;
        }
      } catch (e) { console.warn('[nexusDB] getProfile remote failed:', e.message); }
    }
    // Fallback: localStorage
    try { return JSON.parse(localStorage.getItem('nexus_researcher_profile') || 'null'); }
    catch { return null; }
  },

  // ── Saved Papers ─────────────────────────────────────────────────────────
  async savePaper(userId, paper) {
    // Always write locally for instant UI update
    const local = JSON.parse(localStorage.getItem('nexus_saved_papers') || '[]');
    if (!local.some(p => p.paperId === paper.paperId)) {
      local.push({ ...paper, savedAt: Date.now() });
      localStorage.setItem('nexus_saved_papers', JSON.stringify(local));
    }
    if (!this._isReal()) return;
    try {
      await window._supabase.from('saved_papers').upsert({
        user_id:           userId,
        paper_id:          paper.paperId,
        title:             paper.title || '',
        authors:           paper.authors || [],
        year:              paper.year || null,
        abstract:          paper.abstract || '',
        fields_of_study:   paper.fieldsOfStudy || [],
        external_ids:      paper.externalIds || {},
        open_access_pdf:   paper.openAccessPdf || {},
        citation_count:    paper.citationCount || 0
      }, { onConflict: 'user_id,paper_id' });
    } catch (e) { console.warn('[nexusDB] savePaper remote failed:', e.message); }
  },

  async removePaper(userId, paperId) {
    const local = JSON.parse(localStorage.getItem('nexus_saved_papers') || '[]');
    const updated = local.filter(p => p.paperId !== paperId);
    localStorage.setItem('nexus_saved_papers', JSON.stringify(updated));
    if (!this._isReal()) return;
    try {
      await window._supabase.from('saved_papers')
        .delete().eq('user_id', userId).eq('paper_id', paperId);
    } catch (e) { console.warn('[nexusDB] removePaper remote failed:', e.message); }
  },

  async getSavedPapers(userId) {
    if (this._isReal()) {
      try {
        const { data, error } = await window._supabase
          .from('saved_papers').select('*').eq('user_id', userId).order('saved_at', { ascending: false });
        if (!error && data) {
          // Normalise to match Semantic Scholar paper shape
          const normalised = data.map(p => ({
            paperId:       p.paper_id,
            title:         p.title,
            authors:       p.authors,
            year:          p.year,
            abstract:      p.abstract,
            fieldsOfStudy: p.fields_of_study,
            externalIds:   p.external_ids,
            openAccessPdf: p.open_access_pdf,
            citationCount: p.citation_count,
            savedAt:       new Date(p.saved_at).getTime()
          }));
          localStorage.setItem('nexus_saved_papers', JSON.stringify(normalised));
          return normalised;
        }
      } catch (e) { console.warn('[nexusDB] getSavedPapers remote failed:', e.message); }
    }
    return JSON.parse(localStorage.getItem('nexus_saved_papers') || '[]');
  },

  // ── Projects ─────────────────────────────────────────────────────────────
  async createProject(userId, project) {
    const local = JSON.parse(localStorage.getItem('nexus_projects') || '[]');
    const newProject = { ...project, id: Date.now().toString(), createdAt: Date.now() };
    local.push(newProject);
    localStorage.setItem('nexus_projects', JSON.stringify(local));
    if (!this._isReal()) return newProject;
    try {
      const { data } = await window._supabase.from('projects').insert({
        user_id:     userId,
        name:        project.name || '',
        description: project.description || '',
        color:       project.color || '#00d4ff'
      }).select().single();
      return data || newProject;
    } catch (e) { console.warn('[nexusDB] createProject remote failed:', e.message); return newProject; }
  },

  async deleteProject(userId, projectId) {
    const local = JSON.parse(localStorage.getItem('nexus_projects') || '[]');
    localStorage.setItem('nexus_projects', JSON.stringify(local.filter(p => p.id !== projectId)));
    if (!this._isReal()) return;
    try {
      await window._supabase.from('projects').delete().eq('id', projectId).eq('user_id', userId);
    } catch (e) { console.warn('[nexusDB] deleteProject remote failed:', e.message); }
  },

  async getProjects(userId) {
    if (this._isReal()) {
      try {
        const { data, error } = await window._supabase
          .from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (!error && data) {
          const normalised = data.map(p => ({ ...p, createdAt: new Date(p.created_at).getTime() }));
          localStorage.setItem('nexus_projects', JSON.stringify(normalised));
          return normalised;
        }
      } catch (e) { console.warn('[nexusDB] getProjects remote failed:', e.message); }
    }
    return JSON.parse(localStorage.getItem('nexus_projects') || '[]');
  },

  // ── Research Alerts ───────────────────────────────────────────────────────
  async addAlert(userId, alert) {
    const local = JSON.parse(localStorage.getItem('nexus_alerts') || '[]');
    const newAlert = { ...alert, id: Date.now().toString(), createdAt: Date.now() };
    local.push(newAlert);
    localStorage.setItem('nexus_alerts', JSON.stringify(local));
    if (!this._isReal()) return newAlert;
    try {
      const { data } = await window._supabase.from('alerts').insert({
        user_id:   userId,
        topic:     alert.topic || '',
        frequency: alert.frequency || 'weekly'
      }).select().single();
      return data || newAlert;
    } catch (e) { console.warn('[nexusDB] addAlert remote failed:', e.message); return newAlert; }
  },

  async removeAlert(userId, alertId) {
    const local = JSON.parse(localStorage.getItem('nexus_alerts') || '[]');
    localStorage.setItem('nexus_alerts', JSON.stringify(local.filter(a => a.id !== alertId)));
    if (!this._isReal()) return;
    try {
      await window._supabase.from('alerts').delete().eq('id', alertId).eq('user_id', userId);
    } catch (e) { console.warn('[nexusDB] removeAlert remote failed:', e.message); }
  },

  async getAlerts(userId) {
    if (this._isReal()) {
      try {
        const { data, error } = await window._supabase
          .from('alerts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (!error && data) {
          const normalised = data.map(a => ({ ...a, createdAt: new Date(a.created_at).getTime() }));
          localStorage.setItem('nexus_alerts', JSON.stringify(normalised));
          return normalised;
        }
      } catch (e) { console.warn('[nexusDB] getAlerts remote failed:', e.message); }
    }
    return JSON.parse(localStorage.getItem('nexus_alerts') || '[]');
  },

  // ── Activity Log ──────────────────────────────────────────────────────────
  async logActivity(userId, message) {
    const local = JSON.parse(localStorage.getItem('nexus_activity') || '[]');
    local.unshift({ text: message, time: Date.now() });
    const trimmed = local.slice(0, 30);
    localStorage.setItem('nexus_activity', JSON.stringify(trimmed));
    if (!this._isReal()) return;
    try {
      await window._supabase.from('activity_log').insert({ user_id: userId, message });
    } catch (e) { /* silently fail — activity log is non-critical */ }
  },

  async getActivity(userId) {
    if (this._isReal()) {
      try {
        const { data, error } = await window._supabase
          .from('activity_log').select('*').eq('user_id', userId)
          .order('created_at', { ascending: false }).limit(30);
        if (!error && data) {
          const normalised = data.map(a => ({ text: a.message, time: new Date(a.created_at).getTime() }));
          localStorage.setItem('nexus_activity', JSON.stringify(normalised));
          return normalised;
        }
      } catch (e) { console.warn('[nexusDB] getActivity remote failed:', e.message); }
    }
    return JSON.parse(localStorage.getItem('nexus_activity') || '[]');
  }
};

// ─── USAGE TRACKING ──────────────────────────────────────────────────────────
const nexusUsage = {
  async getUsage(userId) {
    await waitForSupabase();
    if (!window._supabase || userId === 'dev-user' || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
      const local = JSON.parse(localStorage.getItem('nexus_usage_local') || '{"searches":0,"hypotheses":0}');
      return local;
    }
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data, error } = await window._supabase
      .from('usage_logs').select('action').eq('user_id', userId).gte('created_at', monthStart);
    if (error) return { searches: 0, hypotheses: 0 };
    return {
      searches:    data.filter(r => r.action === 'search').length,
      hypotheses:  data.filter(r => r.action === 'hypothesis').length
    };
  },

  async logAction(userId, action) {
    await waitForSupabase();
    if (!window._supabase || userId === 'dev-user' || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
      const local = JSON.parse(localStorage.getItem('nexus_usage_local') || '{"searches":0,"hypotheses":0}');
      if (action === 'search')     local.searches++;
      if (action === 'hypothesis') local.hypotheses++;
      localStorage.setItem('nexus_usage_local', JSON.stringify(local));
      return;
    }
    await window._supabase.from('usage_logs').insert({ user_id: userId, action });
  },

  async checkLimit(userId, action, plan = 'free') {
    // All limits removed — unlimited access for all users
    return { allowed: true };
  }
};

// ─── UTILITY ─────────────────────────────────────────────────────────────────
function waitForSupabase() {
  return new Promise(resolve => {
    if (window._supabase !== undefined) return resolve();
    window.addEventListener('supabase-ready', resolve, { once: true });
    setTimeout(resolve, 5000); // timeout fallback
  });
}
