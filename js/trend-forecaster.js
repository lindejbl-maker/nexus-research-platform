// ═══ TREND FORECASTER ════════════════════════════════════════════════════════
// Shows which research areas are about to explode — before everyone else knows.
// Uses real Semantic Scholar publication velocity + citation data + Gemini synthesis.

let trendLoading = false;

async function runTrendForecaster() {
  if (trendLoading) return;
  const domain  = document.getElementById('tf-domain')?.value?.trim();
  const field   = document.getElementById('tf-field')?.value || '';
  const results = document.getElementById('tf-results');
  const status  = document.getElementById('tf-status');
  const btn     = document.getElementById('tf-btn');
  if (!domain) { showToast('Enter a research domain to forecast', 'error'); return; }

  trendLoading = true;
  btn.disabled = true;
  results.innerHTML = '';
  status.style.display = 'flex';
  tfSetStatus(status, 'Scanning recent literature…');

  try {
    // ── 1. Fetch papers from two time windows to compute velocity ─────────────
    const currentYear = new Date().getFullYear();
    const [recentPapers, olderPapers] = await Promise.all([
      semanticScholar.searchPapers(domain, { field, limit: 50, sort: 'relevance' }),
      semanticScholar.searchPapers(domain, { field, limit: 50, sort: 'citationCount' })
    ]);

    tfSetStatus(status, `Processing ${recentPapers.length + olderPapers.length} papers…`);

    // ── 2. Compute publication metrics ────────────────────────────────────────
    const allPapers    = [...recentPapers, ...olderPapers];
    const uniquePapers = Array.from(new Map(allPapers.map(p => [p.paperId, p])).values());
    const yearBuckets  = {};
    uniquePapers.forEach(p => {
      if (p.year && p.year >= currentYear - 10) {
        yearBuckets[p.year] = (yearBuckets[p.year] || 0) + 1;
      }
    });

    const institutions = {};
    uniquePapers.forEach(p => {
      (p.authors || []).forEach(a => {
        (a.affiliations || []).forEach(aff => {
          const name = aff.name || aff;
          if (name) institutions[name] = (institutions[name] || 0) + 1;
        });
      });
    });
    const topInstitutions = Object.entries(institutions)
      .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name]) => name);

    const avgCitations = uniquePapers.filter(p => p.citationCount > 0)
      .reduce((sum, p) => sum + (p.citationCount || 0), 0) / (uniquePapers.filter(p => p.citationCount > 0).length || 1);

    tfSetStatus(status, 'Gemini is identifying emerging trends…');

    // ── 3. Gemini synthesise trends ───────────────────────────────────────────
    const forecast = await gemini.forecastTrends(domain, uniquePapers, yearBuckets, topInstitutions, field);
    results.innerHTML = renderTrendForecast(forecast, domain, uniquePapers.length, yearBuckets, topInstitutions, avgCitations);
    if (typeof logActivity === 'function') logActivity(`Trend forecast: "${domain.substring(0, 50)}"`);

  } catch (err) {
    results.innerHTML = `<div class="error-state">⚠ ${escHtml(err.message)}</div>`;
  } finally {
    trendLoading = false;
    btn.disabled  = false;
    status.style.display = 'none';
  }
}

function tfSetStatus(el, msg) {
  const s = el.querySelector('span');
  if (s) s.textContent = msg;
}

function renderTrendForecast(forecast, domain, paperCount, yearBuckets, topInstitutions, avgCitations) {
  // ── Publication velocity sparkline (CSS bars) ──────────────────────────────
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => currentYear - 7 + i);
  const maxCount = Math.max(...years.map(y => yearBuckets[y] || 0), 1);
  const sparkHtml = years.map(y => {
    const count = yearBuckets[y] || 0;
    const h = Math.max(4, Math.round((count / maxCount) * 60));
    const isCurrent = y >= currentYear - 1;
    return `<div class="tf-spark-bar-wrap" title="${y}: ${count} papers">
      <div class="tf-spark-bar ${isCurrent ? 'tf-spark-recent' : ''}" style="height:${h}px"></div>
      <div class="tf-spark-label">${String(y).slice(2)}</div>
    </div>`;
  }).join('');

  // ── Trend cards ────────────────────────────────────────────────────────────
  const trendsHtml = (forecast.trends || []).map((t, i) => {
    const score     = Math.min(100, Math.max(0, t.growthScore || 50));
    const momentum  = score >= 80 ? 'tf-momentum-hot' : score >= 60 ? 'tf-momentum-rising' : 'tf-momentum-emerging';
    const momentumLabel = score >= 80 ? '🔥 Exploding' : score >= 60 ? '📈 Rising fast' : '🌱 Emerging';
    const signalsHtml = (t.signals || []).map(s =>
      `<div class="tf-signal-item"><span class="tf-signal-dot"></span><span>${escHtml(s)}</span></div>`
    ).join('');
    const instHtml = (t.leadingInstitutions || []).slice(0, 4).map(inst =>
      `<span class="tf-inst-badge">${escHtml(inst)}</span>`
    ).join('');

    return `
      <div class="tf-trend-card">
        <div class="tf-trend-header">
          <div class="tf-trend-rank">${String(i + 1).padStart(2, '0')}</div>
          <div class="tf-trend-name">${escHtml(t.trend || '')}</div>
          <div class="tf-trend-right">
            <span class="tf-momentum-badge ${momentum}">${momentumLabel}</span>
            <div class="tf-growth-score">${score}<span>/100</span></div>
          </div>
        </div>

        <div class="tf-score-bar"><div class="tf-score-fill" style="width:${score}%"></div></div>

        <div class="tf-trend-body">
          <p class="tf-trend-desc">${escHtml(t.description || '')}</p>

          ${signalsHtml ? `<div class="tf-subsection-label">KEY SIGNALS</div><div class="tf-signals">${signalsHtml}</div>` : ''}
          ${instHtml ? `<div class="tf-subsection-label" style="margin-top:10px;">LEADING INSTITUTIONS</div><div class="tf-institutions">${instHtml}</div>` : ''}

          <div class="tf-meta-row">
            ${t.timeToPeak ? `<div class="tf-meta-item"><span>⏱ Time to peak</span><span>${escHtml(t.timeToPeak)}</span></div>` : ''}
            ${t.investmentLevel ? `<div class="tf-meta-item"><span>💰 Funding activity</span><span>${escHtml(t.investmentLevel)}</span></div>` : ''}
            ${t.riskLevel ? `<div class="tf-meta-item"><span>⚡ Risk level</span><span>${escHtml(t.riskLevel)}</span></div>` : ''}
          </div>

          ${t.whyNow ? `<div class="tf-why-now">💡 <strong>Why now:</strong> ${escHtml(t.whyNow)}</div>` : ''}
          ${t.researchOpportunity ? `<div class="tf-opportunity">🎯 <strong>Your opportunity:</strong> ${escHtml(t.researchOpportunity)}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  const instBadges = topInstitutions.slice(0, 6).map(i => `<span class="tf-inst-badge">${escHtml(i)}</span>`).join('');

  return `
    <div class="tf-overview">
      <div class="tf-overview-main">
        <div class="tf-overview-title">Trend Forecast: <em>${escHtml(domain)}</em></div>
        <div class="tf-overview-sub">${paperCount} papers analysed · ${(forecast.trends || []).length} emerging trends identified</div>
        ${forecast.fieldSentiment ? `<div class="tf-sentiment">${escHtml(forecast.fieldSentiment)}</div>` : ''}
      </div>
      <div class="tf-velocity-widget">
        <div class="tf-velocity-label">PUBLICATION VELOCITY (8 years)</div>
        <div class="tf-sparkline">${sparkHtml}</div>
      </div>
    </div>

    ${instBadges ? `<div class="tf-top-institutions"><div class="tf-ti-label">ACTIVE INSTITUTIONS IN THIS DOMAIN</div><div class="tf-ti-badges">${instBadges}</div></div>` : ''}

    <div class="tf-trend-list">${trendsHtml}</div>
    ${AI_DISCLAIMER}`;
}

console.log('[TrendForecaster] Loaded');
