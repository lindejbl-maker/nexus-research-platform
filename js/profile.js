// ═══ NEXUS RESEARCHER PROFILE ════════════════════════════════════════════════
// Manages user profile data in localStorage + Supabase (via nexusDB).
// getContext() returns a formatted string injected into every AI prompt
// to personalise outputs to the researcher's specific field and interests.

const PROFILE_KEY = 'nexus_researcher_profile';
const PROFILE_SEEN_KEY = 'nexus_profile_setup_seen';

const nexusProfile = {

  // ─── Read / Write ──────────────────────────────────────────────────────────
  get() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    } catch { return null; }
  },

  save(data) {
    const existing = this.get() || {};
    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt || new Date().toISOString()
    };
    // Always write locally first for instant UI update
    localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    localStorage.setItem(PROFILE_SEEN_KEY, 'true');
    // Sync to Supabase if available (non-blocking)
    try {
      if (typeof nexusDB !== 'undefined' && typeof currentUser !== 'undefined' && currentUser?.id) {
        nexusDB.saveProfile(currentUser.id, updated).catch(e =>
          console.warn('[Profile] Cloud sync failed:', e.message)
        );
      }
    } catch (e) { /* silently skip if nexusDB not yet loaded */ }
    return updated;
  },

  clear() {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(PROFILE_SEEN_KEY);
  },

  markSeen() {
    localStorage.setItem(PROFILE_SEEN_KEY, 'true');
  },

  // ─── State helpers ─────────────────────────────────────────────────────────
  isComplete() {
    const p = this.get();
    return !!(p && p.field && p.interests && p.interests.length > 0);
  },

  isFirstVisit() {
    return !localStorage.getItem(PROFILE_SEEN_KEY);
  },

  // ─── Greeting ──────────────────────────────────────────────────────────────
  getGreeting() {
    const p = this.get();
    if (!p) return null;
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const name = p.name ? p.name.split(' ')[0] : null;
    const parts = [timeGreeting + (name ? `, ${name}` : '')];
    if (p.field) parts.push(p.field);
    if (p.institution) parts.push(p.institution);
    return parts.join(' · ');
  },

  // ─── AI Context Injection ──────────────────────────────────────────────────
  // Returns a string appended to AI prompts for personalisation.
  // Keep concise — this is prepended to every prompt.
  getContext() {
    const p = this.get();
    if (!p || !p.field) return '';

    const lines = [`Researcher context (personalise your response accordingly):`];
    if (p.field)          lines.push(`- Primary field: ${p.field}`);
    if (p.subfield)       lines.push(`- Specialisation: ${p.subfield}`);
    if (p.career_stage)   lines.push(`- Career stage: ${p.career_stage}`);
    if (p.institution)    lines.push(`- Institution: ${p.institution}`);
    if (p.country)        lines.push(`- Country: ${p.country}`);
    if (p.interests?.length) lines.push(`- Key interests: ${p.interests.join(', ')}`);
    if (p.grant_bodies?.length) lines.push(`- Relevant funding bodies: ${p.grant_bodies.join(', ')}`);
    return lines.join('\n') + '\n\n';
  },

  // Returns just the field string for Semantic Scholar field filter
  getFieldFilter() {
    const p = this.get();
    if (!p?.field) return '';
    // Map to Semantic Scholar's fieldsOfStudy values
    const fieldMap = {
      'Neuroscience':      'Neuroscience',
      'Biology':           'Biology',
      'Biomedical':        'Medicine',
      'Medicine':          'Medicine',
      'Chemistry':         'Chemistry',
      'Physics':           'Physics',
      'Computer Science':  'Computer Science',
      'Materials Science': 'Materials Science',
      'Climate Science':   'Environmental Science',
      'Drug Discovery':    'Medicine',
      'Psychology':        'Psychology',
      'Economics':         'Economics',
      'Engineering':       'Engineering',
    };
    return fieldMap[p.field] || '';
  },

  // Formatted display label for sidebar
  getDisplayField() {
    const p = this.get();
    if (!p) return null;
    return p.subfield || p.field || null;
  }
};
