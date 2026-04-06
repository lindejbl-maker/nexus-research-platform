// ─── CITATION VERIFICATION ENGINE ─────────────────────────────────────────────
// Scans AI output containers for in-text citations, verifies each one against
// the Semantic Scholar API, and injects visual badges into the DOM.
//
// Usage:
//   await CitationVerifier.scanAndBadge(document.getElementById('lit-output'));
//
// Caches results in localStorage for 7 days to stay within free-tier rate limits.
// ──────────────────────────────────────────────────────────────────────────────

const CitationVerifier = (() => {

  const SS_SEARCH = 'https://api.semanticscholar.org/graph/v1/paper/search';
  const CACHE_KEY  = 'nexus_cite_cache';
  const CACHE_TTL  = 7 * 24 * 60 * 60 * 1000; // 7 days

  // ── Cache helpers ────────────────────────────────────────────────────────────
  function loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveCache(c) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
  }
  function cacheGet(key) {
    const c = loadCache();
    const entry = c[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) { delete c[key]; saveCache(c); return null; }
    return entry.data;
  }
  function cacheSet(key, data) {
    const c = loadCache();
    c[key] = { ts: Date.now(), data };
    // Prune if > 300 entries
    const keys = Object.keys(c);
    if (keys.length > 300) {
      keys.sort((a, b) => c[a].ts - c[b].ts).slice(0, 50).forEach(k => delete c[k]);
    }
    saveCache(c);
  }

  // ── Normalise title for cache key ────────────────────────────────────────────
  function normalise(title) {
    return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim().substring(0, 120);
  }

  // ── Query Semantic Scholar for a single title ─────────────────────────────────
  async function verifyCitation(rawTitle) {
    const key = normalise(rawTitle);
    if (!key || key.length < 10) return { status: 'skip' };

    const cached = cacheGet(key);
    if (cached !== null) return cached;

    try {
      const url = `${SS_SEARCH}?query=${encodeURIComponent(rawTitle)}&limit=3&fields=title,year,authors,url,externalIds`;
      const res  = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) { const r = { status: 'error' }; cacheSet(key, r); return r; }
      const data = await res.json();
      const papers = (data.data || []);

      // Fuzzy match: normalised title overlap (Jaccard-ish)
      const inputWords = new Set(key.split(' '));
      const match = papers.find(p => {
        const pWords = new Set(normalise(p.title || '').split(' '));
        const inter  = [...inputWords].filter(w => pWords.has(w)).length;
        const union  = new Set([...inputWords, ...pWords]).size;
        return union > 0 && (inter / union) >= 0.55;
      });

      const result = match
        ? {
            status: 'verified',
            title:   match.title,
            year:    match.year,
            authors: (match.authors || []).slice(0, 2).map(a => a.name).join(', '),
            url:     match.url || (match.externalIds?.DOI ? `https://doi.org/${match.externalIds.DOI}` : null)
          }
        : { status: 'unverified' };

      cacheSet(key, result);
      return result;
    } catch {
      const r = { status: 'error' };
      cacheSet(key, r);
      return r;
    }
  }

  // ── Extract candidate citation strings from a text string ─────────────────────
  // Matches:
  //   "Title of paper in quotes" (2020)
  //   *Italicised title* (2021)
  //   [1] Smith et al. (2022) — numbered ref style
  //   patterns like "study by Smith (2023) found..."
  function extractCitationTitles(text) {
    const found = new Set();

    // Pattern 1: "Quoted Title" or 'Quoted Title' followed by optional year
    const quoted = /[""]([A-Z][^"""]{15,120})[""](?:\s*\(\d{4}\))?/g;
    let m;
    while ((m = quoted.exec(text)) !== null) found.add(m[1].trim());

    // Pattern 2: *Italicised Title* (2020)
    const italic = /\*([A-Z][^*]{15,120})\*(?:\s*\(\d{4}\))?/g;
    while ((m = italic.exec(text)) !== null) found.add(m[1].trim());

    // Pattern 3: capital-letter sentence chunks before a year citation
    //   e.g. "The Role of X in Y (Smith, 2022)"
    const sentenceCite = /([A-Z][A-Za-z ,:\-]{20,120})\s*\([A-Za-z].*?\d{4}\)/g;
    while ((m = sentenceCite.exec(text)) !== null) {
      const candidate = m[1].trim().replace(/^(and|or|the|a|an|in|of|with|for|by)\s+/i, '');
      if (candidate.split(' ').length >= 4) found.add(candidate);
    }

    return [...found].slice(0, 15); // cap at 15 per document
  }

  // ── Badge HTML generators ─────────────────────────────────────────────────────
  function verifiedBadge(result) {
    const tip  = result.authors
      ? `${result.title} — ${result.authors}${result.year ? ', ' + result.year : ''}`
      : result.title || '';
    const href = result.url ? ` href="${result.url}" target="_blank" rel="noopener"` : '';
    const tag  = result.url ? 'a' : 'span';
    return `<${tag} class="cite-badge cite-badge--verified"${href} title="${tip.replace(/"/g, '&quot;')}">✓ Verified</${tag}>`;
  }

  function unverifiedBadge() {
    return `<span class="cite-badge cite-badge--unverified" title="Could not be found in Semantic Scholar — treat with caution">⚠ Unverified</span>`;
  }

  function summaryBar(verified, total) {
    if (total === 0) return '';
    const pct   = Math.round((verified / total) * 100);
    const color = pct === 100 ? 'var(--success)' : pct >= 50 ? '#F59E0B' : 'var(--error)';
    return `
      <div class="cite-summary">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>
        </svg>
        <span style="color:${color}"><strong>${verified} / ${total}</strong> citations verified</span>
        <span class="cite-summary-sub">via Semantic Scholar</span>
      </div>`;
  }

  // ── Main: scan a container element, extract + verify + badge ─────────────────
  async function scanAndBadge(containerEl) {
    if (!containerEl) return;

    // Remove any previous verification run on this container
    containerEl.querySelectorAll('.cite-badge, .cite-summary').forEach(el => el.remove());

    const rawText  = containerEl.innerText || containerEl.textContent || '';
    const titles   = extractCitationTitles(rawText);
    if (!titles.length) return;

    let verifiedCount = 0;
    const results = [];

    // Verify all (sequential to respect free-tier rate limits)
    for (const title of titles) {
      const result = await verifyCitation(title);
      results.push({ title, result });
      if (result.status === 'verified') verifiedCount++;
      await new Promise(r => setTimeout(r, 120)); // ~8 req/sec max
    }

    // Inject badges into the rendered HTML
    // Strategy: scan text nodes, find title matches, wrap in <mark> with badge
    injectBadgesIntoDOM(containerEl, results);

    // Append summary bar at bottom of container
    const verifiable = results.filter(r => r.result.status !== 'skip' && r.result.status !== 'error').length;
    if (verifiable > 0) {
      const bar = document.createElement('div');
      bar.innerHTML = summaryBar(verifiedCount, verifiable);
      containerEl.appendChild(bar.firstElementChild);
    }
  }

  // ── Inject badge spans around matching text in DOM ────────────────────────────
  function injectBadgesIntoDOM(root, results) {
    // Build a map: normalised title → badge HTML
    const badgeMap = {};
    results.forEach(({ title, result }) => {
      if (result.status === 'skip') return;
      badgeMap[normalise(title)] = result.status === 'verified'
        ? verifiedBadge(result)
        : unverifiedBadge();
    });

    // Walk all text nodes
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodesToProcess = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.trim().length > 10) {
        nodesToProcess.push(node);
      }
    }

    nodesToProcess.forEach(textNode => {
      let content = textNode.nodeValue;
      let modified = false;

      results.forEach(({ title, result }) => {
        if (result.status === 'skip' || result.status === 'error') return;
        if (content.toLowerCase().includes(normalise(title).substring(0, 30))) {
          const badge = result.status === 'verified' ? verifiedBadge(result) : unverifiedBadge();
          // Only badge the first occurrence
          const idx = content.toLowerCase().indexOf(title.toLowerCase().substring(0, 25));
          if (idx !== -1) {
            const after  = content.substring(idx + title.length);
            if (!after.startsWith('</') && !after.startsWith(' class=')) {
              // Replace text node with HTML (use a wrapper span)
              const wrapper = document.createElement('span');
              const before  = content.substring(0, idx + title.length);
              wrapper.innerHTML = before + badge + content.substring(idx + title.length);
              textNode.parentNode.replaceChild(wrapper, textNode);
              modified = true;
            }
          }
        }
      });
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  return {
    scanAndBadge,
    verifyCitation,
    extractCitationTitles,
    clearCache() {
      localStorage.removeItem(CACHE_KEY);
    }
  };
})();
