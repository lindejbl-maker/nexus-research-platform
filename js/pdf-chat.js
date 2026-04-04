// ═══ PDF UPLOAD & CHAT ═══════════════════════════════════════════════════════
// Client-side PDF text extraction via PDF.js — no server, no upload.
// Gemini answers questions in the full context of the paper.

let pdfText        = '';
let pdfMeta        = {};
let pdfChatHistory = [];
let pdfChatLoading = false;

// ─── PDF.js loader ────────────────────────────────────────────────────────────
function ensurePdfjsLoaded(callback) {
  if (typeof pdfjsLib !== 'undefined') { callback(); return; }
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  script.onload = () => {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    callback();
  };
  script.onerror = () => showToast('Could not load PDF reader. Check your internet connection.', 'error');
  document.head.appendChild(script);
}

// ─── Drag and drop ────────────────────────────────────────────────────────────
function initPdfDrop() {
  const zone = document.getElementById('pdf-drop-zone');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('pdf-drop-active'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('pdf-drop-active'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('pdf-drop-active');
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') loadPdf(file);
    else showToast('Please drop a PDF file', 'error');
  });
}

function openPdfPicker() {
  ensurePdfjsLoaded(() => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/pdf';
    input.onchange = e => { if (e.target.files[0]) loadPdf(e.target.files[0]); };
    input.click();
  });
}

// ─── Load and extract PDF ─────────────────────────────────────────────────────
async function loadPdf(file) {
  ensurePdfjsLoaded(async () => {
    const dropZone    = document.getElementById('pdf-drop-zone');
    const loadingBar  = document.getElementById('pdf-loading');
    const chatPanel   = document.getElementById('pdf-chat-panel');
    if (loadingBar) { loadingBar.style.display = ''; loadingBar.textContent = 'Reading PDF…'; }
    if (dropZone) dropZone.style.display = 'none';

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages    = pdf.numPages;

      // Extract text from all pages
      let fullText = '';
      for (let i = 1; i <= numPages; i++) {
        if (loadingBar) loadingBar.textContent = `Reading page ${i} of ${numPages}…`;
        const page   = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(' ') + '\n';
      }

      pdfText = fullText.substring(0, 80000); // Keep first 80K chars (~60K tokens) — well within Gemini limit
      pdfMeta = {
        name:     file.name,
        pages:    numPages,
        size:     (file.size / 1024).toFixed(0) + ' KB',
        words:    fullText.split(/\s+/).length.toLocaleString(),
        chars:    fullText.length.toLocaleString()
      };
      pdfChatHistory = [];

      if (loadingBar) loadingBar.style.display = 'none';
      renderPdfChatPanel();
      if (chatPanel) chatPanel.style.display = '';

      // Auto-generate suggested questions
      generatePdfSuggestions();

    } catch (err) {
      if (loadingBar) { loadingBar.style.display = 'none'; }
      if (dropZone) dropZone.style.display = '';
      showToast(`Could not read PDF: ${err.message}`, 'error');
    }
  });
}

// ─── Render chat panel ────────────────────────────────────────────────────────
function renderPdfChatPanel() {
  const panel = document.getElementById('pdf-chat-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div class="pdf-meta-bar">
      <div class="pdf-meta-info">
        <div class="pdf-meta-name">📄 ${escHtml(pdfMeta.name)}</div>
        <div class="pdf-meta-stats">
          <span>${pdfMeta.pages} pages</span>
          <span>${pdfMeta.words} words</span>
          <span>${pdfMeta.size}</span>
          ${pdfText.length >= 79000 ? '<span class="pdf-truncated-note" title="Very large PDF — first 80,000 characters loaded">⚠ Truncated</span>' : ''}
        </div>
      </div>
      <button class="paper-btn" onclick="closePdfSession()">✕ Close PDF</button>
    </div>

    <div id="pdf-suggestions" class="pdf-suggestions">
      <div class="pdf-sug-label">Suggested questions</div>
      <div id="pdf-sug-list" class="pdf-sug-list">
        <div class="nb-connecting"><div class="spinner"></div><span>Generating questions…</span></div>
      </div>
    </div>

    <div id="pdf-messages" class="pdf-messages"></div>

    <div class="pdf-input-row">
      <textarea id="pdf-question" class="pdf-question-input" placeholder="Ask anything about this paper…" rows="2" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){askPdf();event.preventDefault();}"></textarea>
      <button class="btn-accent pdf-send-btn" id="pdf-send-btn" onclick="askPdf()">Send</button>
    </div>
    <div class="pdf-input-hint">Ctrl+Enter to send</div>`;
}

// ─── Generate suggested questions from first page ─────────────────────────────
async function generatePdfSuggestions() {
  try {
    const firstChunk = pdfText.substring(0, 2000);
    const prompt = `Based on the start of this research paper, generate 5 specific and useful questions a researcher would want answered. Return ONLY a JSON array of strings, no markdown:\n\n"${firstChunk}"`;
    const raw     = await gemini.generate(prompt, '', 0.5, 'pdf-chat');
    const cleaned = raw.replace(/```json\s*/gi,'').replace(/```/g,'').trim();
    const questions = JSON.parse(cleaned);
    const list = document.getElementById('pdf-sug-list');
    if (list && Array.isArray(questions)) {
      list.innerHTML = questions.slice(0, 5).map(q =>
        `<button class="pdf-sug-btn" onclick="useSuggestion(this)">${escHtml(q)}</button>`
      ).join('');
    }
  } catch {
    const list = document.getElementById('pdf-sug-list');
    if (list) list.innerHTML = ['What is the main finding?', 'What methodology was used?', 'What are the limitations?', 'What are the key results?', 'What future research is suggested?']
      .map(q => `<button class="pdf-sug-btn" onclick="useSuggestion(this)">${escHtml(q)}</button>`).join('');
  }
}

function useSuggestion(btn) {
  const input = document.getElementById('pdf-question');
  if (input) { input.value = btn.textContent; askPdf(); }
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
async function askPdf() {
  if (pdfChatLoading || !pdfText) return;
  const input   = document.getElementById('pdf-question');
  const question = input?.value?.trim();
  if (!question) return;
  input.value = '';

  pdfChatLoading = true;
  document.getElementById('pdf-send-btn').disabled = true;

  // Add user message
  appendPdfMessage('user', question);

  // Typing indicator
  const thinkingId = `think-${Date.now()}`;
  appendPdfMessage('thinking', '…', thinkingId);

  try {
    const answer = await gemini.chatWithPdf(pdfText, question, pdfChatHistory);
    pdfChatHistory.push({ role: 'user', text: question });
    pdfChatHistory.push({ role: 'assistant', text: answer });
    // Keep history manageable
    if (pdfChatHistory.length > 20) pdfChatHistory = pdfChatHistory.slice(-20);

    // Replace thinking with real answer
    const thinkEl = document.getElementById(thinkingId);
    if (thinkEl) thinkEl.remove();

    appendPdfMessage('assistant', answer);
  } catch (err) {
    const thinkEl = document.getElementById(thinkingId);
    if (thinkEl) thinkEl.remove();
    appendPdfMessage('error', err.message);
  } finally {
    pdfChatLoading = false;
    document.getElementById('pdf-send-btn').disabled = false;
    document.getElementById('pdf-question')?.focus();
  }
}

function appendPdfMessage(role, text, id = null) {
  const container = document.getElementById('pdf-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `pdf-msg pdf-msg-${role}`;
  if (id) div.id = id;

  if (role === 'thinking') {
    div.innerHTML = '<div class="pdf-thinking"><span></span><span></span><span></span></div>';
  } else if (role === 'assistant') {
    div.innerHTML = `
      <div class="pdf-msg-content">${escHtml(text).replace(/\n/g, '<br>')}</div>
      <div class="pdf-msg-actions">
        <button class="pdf-action-btn" onclick="copyPdfAnswer(this)" title="Copy">📋</button>
        <button class="pdf-action-btn" onclick="savePdfAnswerToNotebook(this)" title="Save to Notebook">📓</button>
      </div>`;
  } else {
    div.innerHTML = `<div class="pdf-msg-content">${escHtml(text).replace(/\n/g, '<br>')}</div>`;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function copyPdfAnswer(btn) {
  const text = btn.closest('.pdf-msg')?.querySelector('.pdf-msg-content')?.textContent || '';
  navigator.clipboard.writeText(text).then(() => showToast('Answer copied', 'success'));
}

function savePdfAnswerToNotebook(btn) {
  const text = btn.closest('.pdf-msg')?.querySelector('.pdf-msg-content')?.textContent || '';
  if (typeof notebookAddEntry === 'function') {
    notebookAddEntry(`📄 From "${pdfMeta.name}":\n\n${text}`, ['pdf-chat', 'paper-note'], false);
    showToast('Saved to Lab Notebook', 'success');
  }
}

function closePdfSession() {
  pdfText = ''; pdfMeta = {}; pdfChatHistory = [];
  const chatPanel = document.getElementById('pdf-chat-panel');
  const dropZone  = document.getElementById('pdf-drop-zone');
  if (chatPanel) { chatPanel.innerHTML = ''; chatPanel.style.display = 'none'; }
  if (dropZone) dropZone.style.display = '';
}

// ─── Init on page navigation ──────────────────────────────────────────────────
function initPdfChat() {
  initPdfDrop();
  if (pdfText && document.getElementById('pdf-chat-panel')) {
    document.getElementById('pdf-drop-zone').style.display = 'none';
    document.getElementById('pdf-chat-panel').style.display = '';
    renderPdfChatPanel();
  }
}

console.log('[PdfChat] PDF Chat loaded');
