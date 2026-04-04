// ─── CONFIGURATION ────────────────────────────────────────────────────────────
// API key is loaded from js/config.js (gitignored). See js/config.example.js.
const GEMINI_API_KEY = (typeof NEXUS_CONFIG !== 'undefined' && NEXUS_CONFIG.GEMINI_API_KEY)
  ? NEXUS_CONFIG.GEMINI_API_KEY
  : 'YOUR_GEMINI_API_KEY';
const GEMINI_MODEL = 'gemini-2.5-flash';

const GEMINI_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_EMBED_BASE = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;
// ─────────────────────────────────────────────────────────────────────────────

// ─── COST TRACKING ────────────────────────────────────────────────────────────
// Gemini 2.0 Flash pricing (per 1K tokens)
const AI_COST_RATES = { inputPer1K: 0.000075, outputPer1K: 0.0003 };

function estimateTokens(text) { return Math.ceil((text || '').length / 4); }

function logApiCost(feature, inputText, outputText) {
  const inputTokens  = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);
  const cost = (inputTokens / 1000 * AI_COST_RATES.inputPer1K) + (outputTokens / 1000 * AI_COST_RATES.outputPer1K);
  const log = JSON.parse(localStorage.getItem('nexus_api_costs') || '[]');
  log.push({ date: new Date().toISOString(), feature, inputTokens, outputTokens, cost: parseFloat(cost.toFixed(7)) });
  if (log.length > 500) log.splice(0, log.length - 500);
  localStorage.setItem('nexus_api_costs', JSON.stringify(log));
}
// ─────────────────────────────────────────────────────────────────────────────

const gemini = {
  async generate(prompt, systemPrompt = '', temperature = 0.7, feature = 'general') {
    if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
      throw new Error('Gemini API key not configured. Add your key to js/gemini.js');
    }
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: 4096 }
    };
    if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };
    const res = await fetch(GEMINI_BASE, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || `Gemini API error (${res.status})`); }
    const data = await res.json();
    const output = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    logApiCost(feature, prompt + systemPrompt, output);
    return output;
  },

  // ─── Item 1: RAG — Fetch live paper abstracts from Semantic Scholar ─────────
  // These are injected into hypothesis/review prompts so Gemini generates
  // grounded in real current literature, not frozen training data.
  async buildRagContext(topic, field = '', limit = 20) {
    try {
      const papers = await semanticScholar.searchPapers(topic, { field, limit, sort: 'relevance' });
      if (!papers.length) return '';
      const recent = papers
        .filter(p => p.abstract && p.year)
        .sort((a, b) => (b.year || 0) - (a.year || 0))
        .slice(0, 20);
      if (!recent.length) return '';
      const context = recent.map((p, i) =>
        `[Paper ${i + 1}] "${p.title}" (${p.year}) — ${(p.abstract || '').substring(0, 350).replace(/\n/g, ' ')}…`
      ).join('\n\n');
      return `\nCURRENT LITERATURE CONTEXT — ${recent.length} real papers retrieved live from Semantic Scholar:\n${context}\n\nBased on these real papers above, identify genuine gaps that NONE of them have addressed.\n`;
    } catch (e) {
      console.warn('[RAG] Failed to fetch live papers:', e.message);
      return '';
    }
  },

  // Ranked hypotheses with novelty scores — now RAG-grounded
  async generateHypotheses(topic, field = '', count = 3, profileContext = '') {
    const ragContext = await this.buildRagContext(topic, field, 20);
    const system = `You are a world-class scientific researcher specialising in identifying untested research gaps. You always respond with valid JSON only — no markdown fences, no preamble, no explanation.`;
    const prompt = `${profileContext}${ragContext}Research topic: "${topic}"\n${field ? `Research field: ${field}` : ''}\n\nAnalyse the real papers in the CURRENT LITERATURE CONTEXT above (if provided), then identify ${count} genuinely novel, testable hypotheses representing gaps that NONE of those papers have addressed. Tailor hypotheses to the researcher context if provided.\n\nReturn a JSON array where each item has exactly these fields:\n- "id": number (1-based)\n- "title": string (max 10 words, catchy and specific)\n- "hypothesis": string (a clear 2-3 sentence testable statement)\n- "rationale": string (2-3 sentences explaining why this gap exists in the current literature)\n- "novelty_score": number (integer 70–99)\n- "gap_type": string (one of: "untested combination", "missing population", "unexplored mechanism", "methodology gap", "cross-disciplinary gap")\n- "experiment_hint": string (one concrete sentence on how to test this)\n- "grounded": boolean (true if you can point to specific papers above that confirm this gap exists)\n\nReturn ONLY the JSON array.`;
    const raw = await this.generate(prompt, system, 0.75, 'hypothesis');
    const parsed = JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
    // Tag each hypothesis with whether it was RAG-grounded
    return parsed.map(h => ({ ...h, _ragGrounded: ragContext.length > 0 }));
  },

  // Full structured literature review — now RAG-grounded
  async generateLiteratureReview(topic, focus = '', depth = 'standard', style = 'academic', profileContext = '') {
    const ragContext = await this.buildRagContext(topic, '', 20);
    const wordTargets = { brief: 500, standard: 1000, deep: 2000 };
    const words = wordTargets[depth] || 1000;
    const system = `You are an expert academic researcher and scientific writer. Write rigorous, well-structured literature reviews. Write in ${style === 'plain' ? 'clear, accessible language suitable for a general scientific audience' : 'formal academic style suitable for journal submission'}.`;
    const prompt = `${profileContext}${ragContext}Write a comprehensive literature review on: "${topic}"\n${focus ? `Specific focus: ${focus}` : ''}\nTarget length: approximately ${words} words.\n\nIMPORTANT: Reference specific papers from the CURRENT LITERATURE CONTEXT above by their exact titles and years where relevant. Do not fabricate statistics.\n\nStructure with these exact headers:\n## Introduction & Background\n## Current State of Knowledge\n## Key Debates & Contradictions\n## Research Gaps & Open Questions\n## Conclusions & Future Directions\n\nUse [Author et al., Year] citation format throughout. Be specific about methodologies, findings, and evidence quality. Do not fabricate specific statistics.`;
    return await this.generate(prompt, system, 0.6, 'literature_review');
  },

  // Cross-Field Discovery Engine — Item 6: DB-grounded with real citations
  async crossFieldDiscovery(problem, problemField = '') {
    // Search the cross-domain database first (if available)
    let dbContext = '';
    let dbMatches = [];
    try {
      if (typeof crossDomainDB !== 'undefined') {
        dbMatches = crossDomainDB.search(problem, 3);
        dbContext = crossDomainDB.formatAsContext(dbMatches);
      }
    } catch (e) { console.warn('[CrossField] DB search failed:', e.message); }

    const system = `You are a world-class interdisciplinary scientist with deep knowledge across all scientific domains. You identify analogous principles between completely different fields and surface unexpected solutions. Always respond with valid JSON only — no markdown fences, no preamble.`;
    const prompt = `Research problem: "${problem}"\n${problemField ? `Primary field: ${problemField}` : ''}\n${dbContext}\nSearch across ALL scientific fields — biology, physics, chemistry, materials science, computer science, engineering, ecology, psychology, economics, aerospace, medicine, etc. — for analogous solutions, principles, materials, algorithms, or mechanisms that could solve this problem from a completely unexpected domain.\n\nReturn a JSON array of 4 cross-field discoveries. If KNOWN ANALOGUES WITH CITATIONS were provided above, include those (expanded and specific to this exact problem) as your first entries. Each object must have exactly these fields:\n- "source_field": string (the field where the solution was found)\n- "analogy_title": string (a catchy 8-word title for this cross-field connection)\n- "discovery": string (2-3 sentences: what exists in that source field that is analogous)\n- "mechanism": string (2 sentences: the underlying principle that makes it work in its original field)\n- "adaptation": string (2-3 sentences: specifically how this could be adapted to solve the original problem)\n- "novelty_score": number (integer 75-99)\n- "implementation_difficulty": string (exactly one of: "Low", "Medium", "High")\n- "precedent": string (1 sentence: has anything like this cross-field transfer been attempted before? Include DOI if known.)\n- "has_citation": boolean (true if this is based on a known analogue with real publications)\n\nReturn ONLY the JSON array.`;
    const raw = await this.generate(prompt, system, 0.85, 'cross_field');
    return JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
  },

  // Plain Language Report Builder
  async plainLanguageReport(content, format = 'investor') {
    const formatGuides = {
      investor:   'a compelling investor brief for startup founders or venture capitalists. Structure: Problem Statement, The Science, Key Evidence, Market Opportunity, Why Now, Call to Action.',
      press:      'a press release for science journalists and science communicators. Structure: Headline (bold), Lead paragraph (the news), What it means in practice, Expert context, What happens next.',
      government: 'a government policy briefing for senior civil servants and ministers. Structure: Executive Summary (3 bullets), Background, Evidence Base, Policy Implications, Recommendations.',
      board:      'a board report for non-technical executives and investors. Structure: Summary (3 bullets), Business Relevance, Key Risks, Opportunity Size, Decision Required.'
    };
    const system = `You are an expert science communicator who translates complex research into clear, compelling, jargon-free narratives. When you must use a technical term, immediately explain it in plain English in parentheses.`;
    const prompt = `Transform the following research content into ${formatGuides[format] || formatGuides.investor}\n\nResearch content:\n"${content}"\n\nWrite in clear, engaging, confident language. Maximum 450 words. Use proper paragraphs — avoid bullet soup. Write as if briefing a very smart non-scientist who has limited time.`;
    return await this.generate(prompt, system, 0.7, 'plain_language');
  },

  // Paper Comparison Table
  async comparePapers(papers) {
    const system = `You are a systematic review expert who extracts and compares research methodology and findings with precision. Always respond with valid JSON only — no markdown fences.`;
    const paperList = papers.map((p, i) =>
      `Paper ${i + 1}: "${p.title || 'Untitled'}" (${p.year || 'n/d'})\nAuthors: ${p.authors?.map(a => a.name).join(', ') || 'Unknown'}\nField: ${p.fieldsOfStudy?.join(', ') || 'Not specified'}\nAbstract: ${(p.abstract || 'No abstract available.').substring(0, 600)}`
    ).join('\n\n---\n\n');
    const prompt = `Systematically compare these ${papers.length} research papers:\n\n${paperList}\n\nReturn a JSON object with exactly these fields:\n- "dimensions": ["Study Design", "Sample Size", "Methodology", "Key Findings", "Limitations", "Evidence Quality"]\n- "papers": array of objects, one per paper, each with:\n  - "title": string (short title, max 6 words)\n  - "year": string or number\n  - "Study Design": string (max 20 words)\n  - "Sample Size": string (max 15 words)\n  - "Methodology": string (max 25 words)\n  - "Key Findings": string (max 30 words)\n  - "Limitations": string (max 25 words)\n  - "Evidence Quality": string (one of: "High", "Moderate", "Low", "Unclear")\n- "overall_synthesis": string (2-3 sentences: what do these papers collectively show?)\n- "key_gap": string (1-2 sentences: what important question do NONE of these papers answer?)\n\nReturn ONLY valid JSON.`;
    const raw = await this.generate(prompt, system, 0.4, 'comparison');
    return JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
  },

  // Distil a hypothesis into the best Semantic Scholar search string
  async generateSearchQuery(hypothesis) {
    const system = `You are a scientific literature search expert. You always respond with plain text only — no quotes, no JSON, no punctuation beyond what is in the query itself.`;
    const prompt = `Convert the following research hypothesis into a precise 5-8 word Semantic Scholar search query that would find papers directly testing this specific claim. Focus on the core mechanism being tested, not background concepts.\n\nHypothesis: "${hypothesis}"\n\nReturn ONLY the search query string, nothing else.`;
    return (await this.generate(prompt, system, 0.2, 'novelty_check')).trim().replace(/^["']|["']$/g, '');
  },

  // ─── Item 2: Semantic embedding-based novelty check ────────────────────────
  // Uses Gemini text-embedding-004 to embed hypothesis + paper abstracts,
  // then computes cosine similarity. Far more accurate than keyword counting.
  async embedText(text) {
    if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') return null;
    try {
      const res = await fetch(GEMINI_EMBED_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { parts: [{ text: text.substring(0, 2000) }] } })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.embedding?.values || null;
    } catch (e) {
      console.warn('[Embed] Failed:', e.message);
      return null;
    }
  },

  computeCosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot  += vecA[i] * vecB[i];
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  },

  // Embed hypothesis + all paper abstracts, return max similarity + closest paper
  // Returns { maxSimilarity, closestPaper, method: 'semantic' | 'keyword' }
  async semanticNoveltyCheck(hypothesisText, papers) {
    // Require at least 1 paper and a real API key
    if (!papers.length || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
      return { maxSimilarity: 0, closestPaper: null, method: 'keyword' };
    }
    try {
      // Embed all in parallel (limit to 8 papers to stay within rate limits)
      const papersToCheck = papers.filter(p => p.abstract).slice(0, 8);
      const [hypVec, ...paperVecs] = await Promise.all([
        this.embedText(hypothesisText),
        ...papersToCheck.map(p => this.embedText(p.abstract || p.title || ''))
      ]);

      if (!hypVec) return { maxSimilarity: 0, closestPaper: null, method: 'keyword' };

      let maxSim = 0;
      let closestPaper = null;
      for (let i = 0; i < paperVecs.length; i++) {
        const sim = this.computeCosineSimilarity(hypVec, paperVecs[i]);
        if (sim > maxSim) { maxSim = sim; closestPaper = papersToCheck[i]; }
      }
      return { maxSimilarity: maxSim, closestPaper, method: 'semantic' };
    } catch (e) {
      console.warn('[SemanticCheck] Falling back to keyword:', e.message);
      return { maxSimilarity: 0, closestPaper: null, method: 'keyword' };
    }
  },

  // Generate one replacement hypothesis, aware of already-explored claims
  async regenerateHypothesis(topic, field = '', exploredClaims = [], attempt = 1) {
    const system = `You are a world-class scientific researcher specialising in identifying untested research gaps. You always respond with valid JSON only — no markdown fences.`;
    const exploredList = exploredClaims.length
      ? `\n\nThe following hypotheses have ALREADY been published and tested — do NOT suggest anything similar:\n${exploredClaims.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
      : '';
    const prompt = `Research topic: "${topic}"\n${field ? `Research field: ${field}` : ''}${exploredList}\n\nGenerate exactly 1 genuinely novel, testable hypothesis that represents a real untested gap. It must be meaningfully different from any already-explored claim listed above.\n\nReturn a JSON object (not array) with exactly these fields:\n- "id": ${attempt}\n- "title": string (max 10 words, specific)\n- "hypothesis": string (clear 2-3 sentence testable statement)\n- "rationale": string (2-3 sentences explaining why this gap exists)\n- "novelty_score": number (integer 75-99)\n- "gap_type": string (one of: "untested combination", "missing population", "unexplored mechanism", "methodology gap", "cross-disciplinary gap")\n- "experiment_hint": string (one concrete sentence on how to test this)\n\nReturn ONLY the JSON object.`;
    const raw = await this.generate(prompt, system, 0.85, 'hypothesis_regen');
    return JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
  },

  // Gap Map data generator — maps the entire research field for visualisation
  async generateGapMapData(topic, field = '', hypotheses = [], profileContext = '') {
    const system = `You are a research landscape analyst. You map entire scientific fields as knowledge graphs. Always respond with valid JSON only — no markdown fences.`;
    const hypSummary = hypotheses.slice(0, 5).map((h, i) =>
      `Gap ${i}: "${h.title}" — ${h.hypothesis.substring(0, 100)}`).join('\n');
    const prompt = `${profileContext}Research field: "${topic}"${field ? ` (${field})` : ''}\n\nYou must map the research landscape of this field as a knowledge graph for visualisation.\n\nThe following unexplored gaps have already been identified:\n${hypSummary || 'None yet — generate based on your knowledge.'}\n\nReturn a JSON object with EXACTLY these fields:\n- "nodes": array of 8-14 objects representing STUDIED research topics/combinations, each with:\n  { "id": string, "label": string (3-5 words max), "cluster": number (0-4, group related nodes), "x_hint": number (0-1), "y_hint": number (0-1) }\n- "edges": array of 8-16 connections between studied nodes, each with:\n  { "from": string (node id), "to": string (node id), "strength": number (0.3-1.0) }\n- "gaps": array of 3-5 objects for unexplored areas matching the hypotheses, each with:\n  { "id": string, "label": string (3-5 words max), "x_hint": number (0-1), "y_hint": number (0-1), "linkedHypothesisIdx": number (0-based index into gaps array matching a hypothesis) }\n\nCRITICAL: x_hint and y_hint must place gap nodes in EMPTY SPACES between studied node clusters, not overlapping them. Spread nodes across the full 0-1 range. Return ONLY valid JSON.`;
    const raw = await this.generate(prompt, system, 0.7, 'gap_map');
    return JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
  }
};


// ─── SEMANTIC SCHOLAR API ──────────────────────────────────────────────────────
const semanticScholar = {
  BASE: 'https://api.semanticscholar.org/graph/v1',
  // CORS proxy for local dev — Semantic Scholar blocks browser requests from localhost/file://
  _proxy(url) {
    const isLocal = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return isLocal ? `https://corsproxy.io/?${encodeURIComponent(url)}` : url;
  },

  async searchPapers(query, { year, field, sort = 'relevance', limit = 10 } = {}) {
    const fields = 'paperId,title,abstract,year,authors,citationCount,externalIds,fieldsOfStudy,openAccessPdf,publicationDate';
    let url = `${this.BASE}/paper/search?query=${encodeURIComponent(query)}&fields=${fields}&limit=${limit}`;
    if (year) url += `&year=${year}-`;
    if (field) url += `&fieldsOfStudy=${encodeURIComponent(field)}`;
    const res = await fetch(this._proxy(url));
    if (!res.ok) {
      if (res.status === 429) throw new Error('Rate limit reached. Please wait a moment and try again.');
      throw new Error(`Paper search failed (${res.status}). Please try again.`);
    }
    const data = await res.json();
    return data.data || [];
  },


  getPaperUrl(paper) {
    if (paper.openAccessPdf?.url) return paper.openAccessPdf.url;
    if (paper.externalIds?.DOI) return `https://doi.org/${paper.externalIds.DOI}`;
    if (paper.externalIds?.ArXiv) return `https://arxiv.org/abs/${paper.externalIds.ArXiv}`;
    return `https://www.semanticscholar.org/paper/${paper.paperId}`;
  },

  formatAPA(paper) {
    const authors = paper.authors?.slice(0, 3).map(a => {
      const parts = a.name.split(' ');
      const last = parts[parts.length - 1];
      const initials = parts.slice(0, -1).map(p => p[0] + '.').join(' ');
      return `${last}, ${initials}`;
    }) || [];
    const authorStr = authors.length > 2 ? authors.slice(0, 1).join(', ') + ' et al.' : authors.join(', & ');
    const year = paper.year ? `(${paper.year})` : '';
    const title = paper.title || 'Untitled';
    const doi = paper.externalIds?.DOI ? `https://doi.org/${paper.externalIds.DOI}` : '';
    return `${authorStr} ${year}. ${title}.${doi ? ' ' + doi : ''}`;
  },

  formatMLA(paper) {
    const authors = paper.authors?.slice(0, 2).map(a => a.name) || ['Unknown'];
    const authorStr = authors.length > 1 ? authors[0] + ', and ' + authors[1] : authors[0];
    const title = paper.title || 'Untitled';
    const year = paper.year || 'n.d.';
    const doi = paper.externalIds?.DOI ? `doi:${paper.externalIds.DOI}` : 'Web';
    return `${authorStr}. "${title}." ${year}, ${doi}.`;
  },

  formatHarvard(paper) {
    const authors = paper.authors?.slice(0, 3).map(a => {
      const parts = a.name.split(' ');
      const last = parts[parts.length - 1];
      const initials = parts.slice(0, -1).map(p => p[0] + '.').join('');
      return `${last}, ${initials}`;
    }) || ['Unknown'];
    const authorStr = authors.length > 2 ? authors[0] + ' et al.' : authors.join(' and ');
    const year = paper.year || 'n.d.';
    const title = paper.title || 'Untitled';
    const doi = paper.externalIds?.DOI ? `Available at: https://doi.org/${paper.externalIds.DOI}` : '';
    return `${authorStr} (${year}) '${title}'. ${doi}`;
  },

  formatVancouver(paper) {
    const authors = paper.authors?.slice(0, 6).map(a => {
      const parts = a.name.split(' ');
      const last = parts[parts.length - 1];
      const initials = parts.slice(0, -1).map(p => p[0]).join('');
      return `${last} ${initials}`;
    }) || ['Unknown'];
    const authorStr = authors.length > 6 ? authors.slice(0, 6).join(', ') + ' et al.' : authors.join(', ');
    const title = paper.title || 'Untitled';
    const year = paper.year || 'n.d.';
    const doi = paper.externalIds?.DOI ? `https://doi.org/${paper.externalIds.DOI}` : '';
    return `${authorStr}. ${title}. ${year}. ${doi}`;
  },

  formatChicago(paper) {
    const authors = paper.authors?.slice(0, 3).map(a => a.name) || ['Unknown'];
    const authorStr = authors.length > 3 ? authors[0] + ' et al.' : authors.join(', ');
    const title = paper.title || 'Untitled';
    const year = paper.year || 'n.d.';
    const doi = paper.externalIds?.DOI ? `https://doi.org/${paper.externalIds.DOI}` : '';
    return `${authorStr}. "${title}." ${year}. ${doi}`;
  },

  // ─── Feature 4: BibTeX format ────────────────────────────────────────────
  formatBibtex(paper) {
    const firstAuthor = paper.authors?.[0]?.name?.split(' ').pop() || 'Unknown';
    const year        = paper.year || 'nd';
    const key         = `${firstAuthor}${year}`;
    const authors     = paper.authors?.map(a => a.name).join(' and ') || 'Unknown';
    const title       = (paper.title || 'Untitled').replace(/[{}]/g, '');
    const doi         = paper.externalIds?.DOI || '';
    const journal     = paper.publicationVenue?.name || paper.journal?.name || '';
    return `@article{${key},\n  author  = {${authors}},\n  title   = {{${title}}},\n  year    = {${year}},\n  journal = {${journal}},\n  doi     = {${doi}}\n}`;
  },

  // ─── Feature 4: RIS format ───────────────────────────────────────────────
  formatRIS(paper) {
    const lines = ['TY  - JOUR'];
    (paper.authors || []).forEach(a => lines.push(`AU  - ${a.name}`));
    lines.push(`TI  - ${paper.title || 'Untitled'}`);
    if (paper.year)   lines.push(`PY  - ${paper.year}`);
    if (paper.publicationVenue?.name) lines.push(`JO  - ${paper.publicationVenue.name}`);
    if (paper.externalIds?.DOI)       lines.push(`DO  - ${paper.externalIds.DOI}`);
    if (paper.abstract) lines.push(`AB  - ${paper.abstract.replace(/\n/g, ' ')}`);
    lines.push('ER  -');
    return lines.join('\n');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Feature 1 — Paper Deep-Diver: structured analysis of any paper
// ─────────────────────────────────────────────────────────────────────────────
gemini.analyzePaper = async function(abstractOrText, field = '', paperMeta = null) {
  const context = paperMeta ? `Paper: "${paperMeta.title}" (${paperMeta.year || 'n/a'})
Authors: ${paperMeta.authors || 'unknown'}
Citations: ${paperMeta.citations != null ? paperMeta.citations : 'unknown'}
Field: ${paperMeta.fields || field || 'unknown'}

` : '';

  const prompt = `${context}Analyse the following scientific text and return a JSON object with this exact structure:

{
  "keyFinding": "One sentence summary of the main result",
  "pico": {
    "population": "Who or what was studied",
    "intervention": "What was done / tested",
    "comparison": "What it was compared against (or N/A)",
    "outcome": "What was measured / what happened"
  },
  "statistics": [
    { "raw": "p=0.03", "explanation": "There is a 3% chance this result occurred by chance alone — generally considered statistically significant" },
    { "raw": "n=45", "explanation": "45 participants total — a small sample size, limits generalisability" }
  ],
  "redFlags": [
    "Sample size too small (n<30) to detect the reported effect reliably",
    "No control group mentioned"
  ],
  "notProven": "What the study CANNOT conclude — what remains unknown or unaddressed",
  "followUps": [
    { "experiment": "Descriptive experiment title", "rationale": "Why this should be tested next based on this paper's findings" },
    { "experiment": "Descriptive experiment title", "rationale": "A gap left open by this paper" },
    { "experiment": "Descriptive experiment title", "rationale": "A logical extension of the main finding" }
  ]
}

Include 2-5 statistics objects (only real ones found in the text — if none, return []).
Include 2-4 red flags (methodological, statistical, or reporting). Return [] if none.
Return ONLY JSON, no markdown.

TEXT TO ANALYSE:
${abstractOrText.substring(0, 4000)}`;

  const raw    = await this.generate(prompt, '', 0.2, 'deep-diver');
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); }
  catch { return { keyFinding: cleaned.substring(0, 300), pico: null, statistics: [], redFlags: [], notProven: '', followUps: [] }; }
};

// ─────────────────────────────────────────────────────────────────────────────
// Feature 2 — Peer Review Response: generates point-by-point rebuttal letter
// ─────────────────────────────────────────────────────────────────────────────
gemini.generatePeerReviewResponse = async function(reviewerComments, abstract, journal = '', tone = 'professional', parsedPoints = []) {
  const toneGuide = {
    professional: 'firm, polite, and professional. Stand your ground on valid points while accepting genuine improvements',
    diplomatic:   'very diplomatic and deferential. Always thank reviewers and frame every response positively',
    assertive:    'confident and direct. Challenge weak reviewer points respectfully but clearly'
  }[tone] || 'professional';

  const prompt = `You are a senior academic helping write a peer review response letter.

Paper abstract: "${abstract.substring(0, 600)}"
Journal: ${journal || 'not specified'}
Tone: ${toneGuide}

Reviewer comments:
${reviewerComments.substring(0, 3000)}

Return a JSON object with this exact structure:
{
  "opening": "A warm, professional opening paragraph thanking the reviewers and editors",
  "points": [
    {
      "reviewer": 1,
      "originalComment": "First 80 chars of the specific comment being addressed",
      "stance": "accept",
      "response": "Your full response to this specific comment (3-5 sentences)",
      "paperEdit": "Exactly what you will change in the paper (or null)",
      "citeSuggestion": "A relevant paper type/topic to cite in your response (or null)"
    }
  ],
  "closing": "A professional closing paragraph",
  "letter": "The complete formatted letter as plain text, ready to copy-paste"
}

stance must be one of: "accept" (you agree and will change), "decline" (you disagree and explain why), "partial" (partial change).
Address every separate comment in parsedPoints as a separate item in points[].
Return ONLY JSON, no markdown.`;

  const raw     = await this.generate(prompt, '', 0.4, 'peer-review');
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); }
  catch { return { opening: '', points: [{ reviewer: 1, originalComment: reviewerComments.substring(0, 80), stance: 'accept', response: raw.substring(0, 600), paperEdit: null, citeSuggestion: null }], closing: '', letter: raw }; }
};

// ─────────────────────────────────────────────────────────────────────────────
// Feature 3 — Lab Notebook: find connections between an entry and saved papers
// ─────────────────────────────────────────────────────────────────────────────
gemini.findNotebookConnections = async function(entryBody, savedPapers = [], otherEntries = []) {
  const papersContext = savedPapers.slice(0, 20).map((p, i) =>
    `[P${i + 1}] "${p.title}" (${p.year || 'n/a'}) — ${(p.abstract || '').substring(0, 150)}`
  ).join('\n');

  const notesContext = otherEntries.slice(0, 10).map((e, i) =>
    `[N${i + 1}] "${e.title}" — ${(e.body || '').substring(0, 120)}`
  ).join('\n');

  const prompt = `You are a research AI helping a scientist find non-obvious connections between their notes and their paper library.

NOTEBOOK ENTRY:
"${entryBody.substring(0, 800)}"

SAVED PAPERS:
${papersContext || '(none)'}

OTHER NOTEBOOK ENTRIES:
${notesContext || '(none)'}

Find the 3-5 most meaningful conceptual connections. A good connection is non-obvious — not just a shared keyword, but a genuine intellectual link: shared mechanism, analogous finding, confirming or contradicting evidence, or a gap one fills for the other.

Return JSON:
[
  {
    "type": "paper",
    "title": "Paper or entry title",
    "reason": "Why these are connected — the specific conceptual link (2 sentences)",
    "insight": "A new hypothesis or idea this connection suggests (1 sentence)"
  }
]

type is "paper" or "note". Return an empty array [] if no strong connections exist.
Return ONLY JSON, no markdown.`;

  const raw     = await this.generate(prompt, '', 0.5, 'lab-notebook');
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); }
  catch { return []; }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTRADICTION DETECTOR — finds where studies directly disagree
// ─────────────────────────────────────────────────────────────────────────────
gemini.detectContradictions = async function(papers, topic, field = '') {
  const abstracts = papers.slice(0, 25).map((p, i) =>
    `[${i + 1}] "${p.title}" (${p.year || 'n/a'}) — ${(p.abstract || '').substring(0, 300)}`
  ).join('\n\n');

  const prompt = `You are a scientific literature analyst. Analyse these ${papers.length} paper abstracts on "${topic}" and identify where they directly CONTRADICT each other — not just disagree in nuance, but reach genuinely opposite conclusions on the same claim.

ABSTRACTS:
${abstracts}

Return a JSON object:
{
  "overallConsensus": 72,
  "overallNote": "The field is broadly aligned on X but deeply split on Y",
  "contradictions": [
    {
      "claim": "The specific contested scientific claim (concise)",
      "severity": "high",
      "sideAConsensus": 65,
      "sideA": {
        "claim": "What side A concludes (1-2 sentences)",
        "papers": ["Author et al., Year", "Author2 et al., Year"]
      },
      "sideB": {
        "claim": "What side B concludes — directly opposing (1-2 sentences)",
        "papers": ["Author3 et al., Year"]
      },
      "whyItExists": "The methodological, population, dosage, or measurement reason why the same question produces opposite results",
      "resolution": "What experiment or meta-analysis would settle this debate",
      "hypothesisOpportunity": "A novel hypothesis that could explain both findings"
    }
  ]
}

severity: "high" (direct contradiction), "medium" (significant disagreement), "low" (minor nuance).
overallConsensus: 0 = complete disagreement, 100 = perfect consensus.
Return 2-6 contradictions. If none exist, return an empty contradictions array.
Return ONLY JSON, no markdown.`;

  const raw     = await this.generate(prompt, '', 0.3, 'contradiction-detector');
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); }
  catch { return { overallConsensus: null, overallNote: '', contradictions: [] }; }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPERIMENT BLUEPRINT BUILDER
// ─────────────────────────────────────────────────────────────────────────────
gemini.buildExperimentBlueprint = async function(hypothesis, field = '', budget = 'standard', timeline = '6 months') {
  const profile = typeof nexusProfile !== 'undefined' ? nexusProfile.getContext() : '';
  const prompt = `${profile}You are an expert research methodologist. Design a complete, ready-to-run experiment to test this hypothesis:

HYPOTHESIS: "${hypothesis}"
FIELD: ${field || 'unspecified'}
BUDGET LEVEL: ${budget}
TARGET TIMELINE: ${timeline}

Return a JSON object with this exact structure:
{
  "studyType": "Randomised controlled trial / In vitro / Observational / Computational / etc.",
  "estimatedDuration": "6 months",
  "difficulty": "low/medium/high",
  "objective": "One clear sentence describing what this experiment will definitively prove or disprove",
  "sampleSize": "n=45 per group (based on power analysis: α=0.05, β=0.80, effect size d=0.5)",
  "variables": {
    "independent": "Variable you will manipulate",
    "dependent": "Variable you will measure",
    "control": "Control group / condition",
    "confounders": "Key variables to control for"
  },
  "equipment": [
    { "item": "Equipment name", "quantity": "1 unit", "note": "Optional note" }
  ],
  "procedure": [
    { "title": "Step title", "detail": "Detailed description", "duration": "2 days" }
  ],
  "statistics": {
    "sampleSize": "30 per group",
    "primaryTest": "Independent samples t-test",
    "alpha": "α = 0.05",
    "power": "0.80",
    "effectSize": "Cohen's d = 0.5 (medium)"
  },
  "timeline": [
    { "phase": "Phase name", "duration": "Weeks 1-4", "tasks": "What happens in this phase" }
  ],
  "expectedOutcomes": {
    "positive": "What results would confirm the hypothesis",
    "negative": "What results would refute it and what that means"
  },
  "safety": ["Any safety, ethical, or IRB/IACUC considerations"]
}

Be specific — use real equipment names, real statistical tests, realistic sample sizes.
Return ONLY JSON, no markdown.`;

  const raw     = await this.generate(prompt, '', 0.3, 'experiment-blueprint');
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); }
  catch { return { objective: raw.substring(0, 300), variables: {}, equipment: [], procedure: [], statistics: {}, timeline: [], safety: [] }; }
};

// ─────────────────────────────────────────────────────────────────────────────
// TREND FORECASTER
// ─────────────────────────────────────────────────────────────────────────────
gemini.forecastTrends = async function(domain, papers, yearBuckets, topInstitutions, field = '') {
  const titles = papers.slice(0, 30).map(p => `"${p.title}" (${p.year || 'n/a'}, ${p.citationCount || 0} citations)`).join('\n');
  const yearsStr = Object.entries(yearBuckets).sort((a,b) => a[0]-b[0]).map(([y,c]) => `${y}: ${c} papers`).join(', ');
  const instStr  = topInstitutions.slice(0, 6).join(', ');

  const prompt = `You are a science trend analyst. Based on the following data about research on "${domain}", identify the top 5 EMERGING trends that are just starting to accelerate.

RECENT PAPERS (sample):
${titles}

PUBLICATION VELOCITY BY YEAR: ${yearsStr}
ACTIVE INSTITUTIONS: ${instStr}
FIELD: ${field || 'general'}

Identify 5 specific sub-topics or methodological approaches that show accelerating momentum — things that will be mainstream in 2-4 years.

Return JSON:
{
  "fieldSentiment": "One sentence on the overall state and direction of this field",
  "trends": [
    {
      "trend": "Specific trend name (not the full domain, a specific sub-area or approach)",
      "growthScore": 87,
      "description": "2-3 sentences: what it is and why it's accelerating now",
      "signals": ["Signal 1 from the data", "Signal 2", "Signal 3"],
      "leadingInstitutions": ["Institution 1", "Institution 2"],
      "timeToPeak": "2-3 years",
      "investmentLevel": "High / Medium / Growing",
      "riskLevel": "Low / Medium / High",
      "whyNow": "The specific technological, clinical, or policy trigger that makes this trend accelerate NOW",
      "researchOpportunity": "The specific gap a researcher in this field could exploit today"
    }
  ]
}

growthScore: 0-100 (100 = explosive, confirmed). Be realistic — not everything is 90+.
Return ONLY JSON, no markdown.`;

  const raw     = await this.generate(prompt, '', 0.5, 'trend-forecaster');
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); }
  catch { return { fieldSentiment: '', trends: [] }; }
};

// ─────────────────────────────────────────────────────────────────────────────
// GRANT WRITER AI
// ─────────────────────────────────────────────────────────────────────────────
gemini.generateGrant = async function(data) {
  const funder = data.customFunder || data.funder;
  const budget = parseInt(data.budget).toLocaleString();

  const funderGuidance = {
    'NIH R01':            'Follow NIH R01 structure. Use specific aims page. Focus on significance, innovation, and approach.',
    'NIH R21':            'Exploratory/developmental grant. Emphasise feasibility and preliminary data.',
    'NSF':                'Emphasise broader impacts alongside intellectual merit. Use clear objectives.',
    'Wellcome Trust':     'UK-based. Emphasise global health relevance and interdisciplinary approach.',
    'NRF':                'South African NRF. Link to national development goals and local capacity building.',
    'EU Horizon Europe':  'European. Emphasise collaboration, open science, and EU strategic priorities.',
    'MRC':                'Medical Research Council UK. Emphasise translational impact and patient benefit.',
    'Gates Foundation':   'Focus on global health equity, scalable solutions, and measurable outcomes.',
    'ERC':                'European Research Council. Emphasise scientific excellence and PI track record.'
  }[funder] || `Tailor to ${funder}'s known priorities.`;

  const prompt = `You are an expert grant writer who has helped researchers win millions in funding. Write a complete, compelling grant application.

PROJECT DETAILS:
- Title: ${data.title}
- Description: ${data.description}
- Specific aims: ${data.aims || 'To be developed based on description'}
- Target funder: ${funder}
- Budget: $${budget}
- Duration: ${data.duration}
- Team size: ${data.teamSize}
- PI experience: ${data.piExperience || 'Experienced researcher'}
- Institution: ${data.institution || 'Research university'}
- Field: ${data.field || 'Biomedical research'}

FUNDER GUIDANCE: ${funderGuidance}

Write ALL sections. Be specific, compelling, and use concrete language. Avoid vague claims.

Return ONLY a JSON object with these exact keys (each is a multi-paragraph string):
{
  "executiveSummary": "...",
  "background": "...",
  "innovation": "...",
  "specificAims": "...",
  "researchPlan": "...",
  "teamQualification": "...",
  "budgetJustification": "...",
  "timeline": "...",
  "reviewerTips": "One sentence tip specific to ${funder} reviewers"
}

Each section should be 2-4 substantial paragraphs. Make it grant-winning quality.
Return ONLY JSON, no markdown.`;

  const raw     = await this.generate(prompt, '', 0.5, 'grant-writer');
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); }
  catch {
    // Fallback: wrap raw text as executive summary
    return { executiveSummary: raw, background: '', innovation: '', specificAims: '', researchPlan: '', teamQualification: '', budgetJustification: '', timeline: '', reviewerTips: '' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF CHAT — answers questions in context of a full paper
// ─────────────────────────────────────────────────────────────────────────────
gemini.chatWithPdf = async function(pdfText, question, history = []) {
  const historyStr = history.slice(-6).map(h =>
    `${h.role === 'user' ? 'Researcher' : 'Nexus'}: ${h.text.substring(0, 300)}`
  ).join('\n');

  const prompt = `You are an expert research assistant helping a scientist understand a research paper. Answer their question accurately and specifically based ONLY on the paper content provided. If the answer is not in the paper, say so clearly.

PAPER CONTENT (full text):
${pdfText.substring(0, 60000)}

${historyStr ? `CONVERSATION SO FAR:\n${historyStr}\n\n` : ''}RESEARCHER'S QUESTION: ${question}

Answer in a clear, direct, expert tone. Use specific details, numbers, and quotes from the paper where relevant. If the question asks for something not in the paper, explicitly state that and suggest where they might find that information.`;

  return await this.generate(prompt, '', 0.2, 'pdf-chat');
};
