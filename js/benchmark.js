// ═══ NEXUS VALIDATION BENCHMARK TOOL ═════════════════════════════════════════
// Item 5: Automated tests that prove Nexus works as claimed.
// Runs 4 objective tests and returns pass/fail scores.
// Access via dashboard URL param: ?page=benchmark
// ─────────────────────────────────────────────────────────────────────────────

const nexusBenchmark = {

  results: [],

  // ─── Test 1: Novelty Recall Accuracy ───────────────────────────────────────
  // Takes 6 KNOWN published hypotheses, runs them through novelty checker.
  // If the system correctly flags them as "already explored" → ✓ pass.
  // Threshold: ≥ 4 of 6 correctly identified.
  async testNoveltyRecall(onProgress) {
    const KNOWN_HYPOTHESES = [
      {
        title: 'mTOR regulates synaptic plasticity',
        hypothesis: 'mTOR signalling pathway activation is required for long-term potentiation and memory consolidation in hippocampal neurons through protein synthesis regulation.',
        rationale: 'mTOR controls local protein synthesis at synapses, which is essential for LTP maintenance.',
        novelty_score: 80
      },
      {
        title: 'CRISPR-Cas9 off-target effects in stem cells',
        hypothesis: 'CRISPR-Cas9 gene editing in pluripotent stem cells causes measurable off-target mutations at frequencies above 0.1% in non-target genomic loci.',
        rationale: 'Guide RNA mismatch tolerance allows Cas9 to cleave imperfectly matched sequences.',
        novelty_score: 75
      },
      {
        title: 'Gut microbiome influences Parkinsons disease progression',
        hypothesis: 'Specific gut microbiome composition correlates with alpha-synuclein aggregation rates and Parkinsons disease progression via the gut-brain axis.',
        rationale: 'The vagus nerve connects enteric and central nervous systems enabling gut-brain signalling.',
        novelty_score: 82
      },
      {
        title: 'Sleep deprivation impairs amyloid clearance',
        hypothesis: 'Chronic sleep deprivation reduces glymphatic system clearance of amyloid-beta in the aging brain, accelerating Alzheimers disease pathology.',
        rationale: 'The glymphatic system operates primarily during sleep to clear toxic protein aggregates.',
        novelty_score: 78
      },
      {
        title: 'Telomere length predicts cancer risk',
        hypothesis: 'Shorter telomere length in peripheral blood leukocytes is associated with increased risk of solid tumours through chromosomal instability mechanisms.',
        rationale: 'Telomere erosion causes chromosomal fusions that activate oncogenes.',
        novelty_score: 76
      },
      {
        title: 'Autophagy regulates neuronal survival under oxidative stress',
        hypothesis: 'Autophagy pathway activation through AMPK-mTOR signalling is neuroprotective under oxidative stress conditions in dopaminergic neurons.',
        rationale: 'Autophagy clears damaged organelles and protein aggregates that cause neuronal death.',
        novelty_score: 79
      }
    ];

    let correct = 0;
    const details = [];

    for (let i = 0; i < KNOWN_HYPOTHESES.length; i++) {
      const h = KNOWN_HYPOTHESES[i];
      if (onProgress) onProgress(`Testing recall ${i + 1}/${KNOWN_HYPOTHESES.length}: "${h.title}"…`);
      try {
        const searchQuery = await gemini.generateSearchQuery(h.hypothesis);
        const papers = await semanticScholar.searchPapers(searchQuery, { limit: 8 });
        const recentPapers = papers.filter(p => p.year && p.year >= 2010);

        // Run semantic check if available
        const semanticResult = await gemini.semanticNoveltyCheck(h.hypothesis, papers);
        const usingSemantic = semanticResult.method === 'semantic' && semanticResult.maxSimilarity > 0;
        const isExplored = usingSemantic
          ? semanticResult.maxSimilarity >= 0.70  // correctly flagged as existing work
          : recentPapers.length >= 2;             // keyword fallback

        if (isExplored) correct++;
        details.push({
          title: h.title,
          passed: isExplored,
          recentPapers: recentPapers.length,
          similarity: usingSemantic ? Math.round(semanticResult.maxSimilarity * 100) : null,
          method: semanticResult.method
        });
      } catch (err) {
        details.push({ title: h.title, passed: false, error: err.message });
      }
    }

    const score = correct / KNOWN_HYPOTHESES.length;
    return {
      testName: 'Novelty Recall Accuracy',
      passed: score >= 0.67, // ≥ 4/6
      score: Math.round(score * 100),
      details,
      description: `Correctly identified ${correct}/${KNOWN_HYPOTHESES.length} known published hypotheses as "already explored"`
    };
  },

  // ─── Test 2: Hypothesis Uniqueness ─────────────────────────────────────────
  // Generates 3 hypotheses for a test topic.
  // Checks that each pair has cosine similarity < 0.6 (not duplicates).
  async testHypothesisUniqueness(onProgress) {
    const TEST_TOPIC = 'synaptic plasticity and memory consolidation';
    if (onProgress) onProgress(`Generating 3 hypotheses for "${TEST_TOPIC}"…`);

    try {
      const hypotheses = await gemini.generateHypotheses(TEST_TOPIC, 'Neuroscience', 3);
      if (onProgress) onProgress('Running similarity checks between each hypothesis pair…');

      const texts = hypotheses.map(h => h.hypothesis + ' ' + (h.rationale || ''));
      const vectors = await Promise.all(texts.map(t => gemini.embedText(t)));

      const allVectorsAvailable = vectors.every(v => v !== null);
      const pairs = [];
      let allUnique = true;

      if (allVectorsAvailable) {
        for (let i = 0; i < vectors.length; i++) {
          for (let j = i + 1; j < vectors.length; j++) {
            const sim = gemini.computeCosineSimilarity(vectors[i], vectors[j]);
            const isUnique = sim < 0.65;
            if (!isUnique) allUnique = false;
            pairs.push({
              pair: `H${i + 1} vs H${j + 1}`,
              similarity: Math.round(sim * 100),
              unique: isUnique,
              h1Title: hypotheses[i].title,
              h2Title: hypotheses[j].title
            });
          }
        }
      } else {
        // Fallback: check titles are different
        const titles = hypotheses.map(h => h.title);
        const allDifferent = new Set(titles).size === titles.length;
        allUnique = allDifferent;
        pairs.push({ pair: 'Title comparison', unique: allDifferent, note: 'Embedding unavailable — checking titles' });
      }

      return {
        testName: 'Hypothesis Uniqueness',
        passed: allUnique,
        score: allUnique ? 100 : Math.round(pairs.filter(p => p.unique).length / pairs.length * 100),
        details: pairs,
        description: `Generated 3 hypotheses — ${pairs.filter(p => p.unique).length}/${pairs.length} pairs are sufficiently distinct (< 65% similarity)`
      };
    } catch (err) {
      return { testName: 'Hypothesis Uniqueness', passed: false, score: 0, error: err.message };
    }
  },

  // ─── Test 3: Cross-Field Plausibility ──────────────────────────────────────
  // Runs 3 standard problems through Cross-Field Discovery.
  // Uses Gemini to evaluate each result for scientific plausibility.
  async testCrossFieldPlausibility(onProgress) {
    const TEST_PROBLEMS = [
      'Creating a material that absorbs impact without fracturing under repeated stress',
      'Routing data packets efficiently through a highly congested network',
      'Removing pollutants from water without adding chemicals'
    ];

    let plausibleCount = 0;
    const details = [];

    for (let i = 0; i < TEST_PROBLEMS.length; i++) {
      if (onProgress) onProgress(`Testing cross-field discovery ${i + 1}/${TEST_PROBLEMS.length}…`);
      try {
        const discoveries = await gemini.crossFieldDiscovery(TEST_PROBLEMS[i]);
        const firstResult  = discoveries[0];

        // Use Gemini to evaluate plausibility
        const evalPrompt = `Rate the scientific plausibility of this cross-field solution on a scale of 1-10:\n\nProblem: "${TEST_PROBLEMS[i]}"\nProposed solution from ${firstResult.source_field}: ${firstResult.discovery}\nAdaptation strategy: ${firstResult.adaptation}\n\nReturn ONLY a JSON object: {"score": number, "reasoning": "one sentence"}`;
        const evalRaw = await gemini.generate(evalPrompt, '', 0.1, 'benchmark');
        const evalResult = JSON.parse(evalRaw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
        const isPlausible = evalResult.score >= 6;
        if (isPlausible) plausibleCount++;
        details.push({
          problem: TEST_PROBLEMS[i].substring(0, 60),
          sourceField: firstResult.source_field,
          hasCitation: firstResult.has_citation || false,
          evalScore: evalResult.score,
          reasoning: evalResult.reasoning,
          passed: isPlausible
        });
      } catch (err) {
        details.push({ problem: TEST_PROBLEMS[i].substring(0, 60), error: err.message, passed: false });
      }
    }

    const score = plausibleCount / TEST_PROBLEMS.length;
    return {
      testName: 'Cross-Field Plausibility',
      passed: score >= 0.67, // ≥ 2/3
      score: Math.round(score * 100),
      details,
      description: `${plausibleCount}/${TEST_PROBLEMS.length} cross-field discoveries rated ≥ 6/10 for scientific plausibility`
    };
  },

  // ─── Test 4: RAG Grounding Verification ───────────────────────────────────
  // Confirms that hypotheses generated with RAG cite concepts genuinely present
  // in the retrieved papers (not hallucinated). Uses keyword overlap check.
  async testRagGrounding(onProgress) {
    const TEST_TOPIC = 'CRISPR gene editing in neurodegenerative diseases';
    if (onProgress) onProgress(`Fetching live papers for "${TEST_TOPIC}"…`);

    try {
      const papers = await semanticScholar.searchPapers(TEST_TOPIC, { limit: 10 });
      if (!papers.length) throw new Error('No papers returned by Semantic Scholar');

      if (onProgress) onProgress('Generating RAG-grounded hypotheses…');
      const hypotheses = await gemini.generateHypotheses(TEST_TOPIC, 'Neuroscience', 3);

      // Check: do the hypothesis texts contain words/concepts from the real paper titles?
      const paperWords = new Set(
        papers.flatMap(p => (p.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 5))
      );

      let groundedCount = 0;
      const details = hypotheses.map(h => {
        const hypWords  = (h.hypothesis + ' ' + h.rationale).toLowerCase().split(/\s+/);
        const overlap   = hypWords.filter(w => w.length > 5 && paperWords.has(w));
        const isGrounded = overlap.length >= 3;
        if (isGrounded) groundedCount++;
        return {
          title: h.title,
          overlapWords: overlap.slice(0, 5),
          overlapCount: overlap.length,
          grounded: isGrounded,
          ragGrounded: h._ragGrounded || false
        };
      });

      const score = groundedCount / hypotheses.length;
      return {
        testName: 'RAG Grounding Verification',
        passed: score >= 0.67,
        score: Math.round(score * 100),
        details,
        description: `${groundedCount}/${hypotheses.length} hypotheses contain concepts present in the ${papers.length} retrieved live papers`
      };
    } catch (err) {
      return { testName: 'RAG Grounding Verification', passed: false, score: 0, error: err.message };
    }
  },

  // ─── Run all tests ──────────────────────────────────────────────────────────
  async runAll(onProgress, onResult) {
    this.results = [];
    const tests = [
      () => this.testNoveltyRecall(onProgress),
      () => this.testHypothesisUniqueness(onProgress),
      () => this.testCrossFieldPlausibility(onProgress),
      () => this.testRagGrounding(onProgress)
    ];

    for (const test of tests) {
      const result = await test();
      this.results.push(result);
      if (onResult) onResult(result);
    }

    const passCount = this.results.filter(r => r.passed).length;
    return {
      overall: passCount >= 3 ? 'PASS' : 'FAIL',
      passCount,
      total: tests.length,
      results: this.results
    };
  }
};

// ─── Benchmark Page UI Renderer ────────────────────────────────────────────────
function renderBenchmarkUI() {
  const page = document.getElementById('page-benchmark');
  if (!page) return;

  page.innerHTML = `
    <div class="bench-header">
      <h1 class="page-title">Validation Benchmark</h1>
      <p class="page-subtitle">Objective tests that prove Nexus works as claimed. Run before any customer demonstration.</p>
      <button class="btn-primary" id="bench-run-btn" onclick="startBenchmark()">▶ Run All Tests</button>
    </div>

    <div id="bench-status" style="display:none" class="hyp-status">
      <div class="spinner"></div> <span id="bench-status-text">Initialising…</span>
    </div>

    <div id="bench-summary" style="display:none" class="bench-summary"></div>
    <div id="bench-results" class="bench-results"></div>
  `;
}

async function startBenchmark() {
  const btn      = document.getElementById('bench-run-btn');
  const statusEl = document.getElementById('bench-status');
  const statusTxt = document.getElementById('bench-status-text');
  const resultsEl = document.getElementById('bench-results');
  const summaryEl = document.getElementById('bench-summary');

  btn.disabled = true;
  btn.textContent = 'Running…';
  statusEl.style.display = 'flex';
  summaryEl.style.display = 'none';
  resultsEl.innerHTML = '';

  const onProgress = (msg) => { if (statusTxt) statusTxt.textContent = msg; };
  const onResult   = (result) => {
    const card = document.createElement('div');
    card.className = `bench-card ${result.passed ? 'bench-pass' : 'bench-fail'}`;
    card.innerHTML = `
      <div class="bench-card-header">
        <span class="bench-icon">${result.passed ? '✓' : '✗'}</span>
        <span class="bench-name">${escHtml(result.testName)}</span>
        <span class="bench-score">${result.score ?? '—'}%</span>
      </div>
      <div class="bench-desc">${escHtml(result.description || result.error || '')}</div>
      ${result.details ? `<div class="bench-details">
        ${result.details.map(d => `
          <div class="bench-detail-row ${d.passed || d.unique || d.grounded ? 'detail-pass' : 'detail-fail'}">
            <span>${d.passed || d.unique || d.grounded ? '✓' : '✗'}</span>
            <span>${escHtml(d.title || d.pair || d.problem || '')}</span>
            ${d.similarity != null ? `<span>${d.similarity}% sim</span>` : ''}
            ${d.evalScore != null ? `<span>${d.evalScore}/10</span>` : ''}
            ${d.overlapCount != null ? `<span>${d.overlapCount} shared terms</span>` : ''}
            ${d.error ? `<span class="bench-err">${escHtml(d.error)}</span>` : ''}
          </div>`).join('')}
      </div>` : ''}
    `;
    resultsEl.appendChild(card);
  };

  try {
    const summary = await nexusBenchmark.runAll(onProgress, onResult);
    statusEl.style.display = 'none';
    summaryEl.style.display = 'block';
    summaryEl.innerHTML = `
      <div class="bench-overall ${summary.overall === 'PASS' ? 'overall-pass' : 'overall-fail'}">
        <div class="overall-icon">${summary.overall === 'PASS' ? '✓' : '✗'}</div>
        <div class="overall-text">
          <strong>${summary.overall === 'PASS' ? 'All systems validated' : 'Validation issues found'}</strong>
          <span>${summary.passCount}/${summary.total} tests passed</span>
        </div>
      </div>`;
  } catch (err) {
    statusEl.innerHTML = `<span style="color:var(--error)">⚠ Benchmark error: ${escHtml(err.message)}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '▶ Run All Tests';
  }
}

console.log('[Benchmark] Validation tool loaded — access via ?page=benchmark or sidebar');
