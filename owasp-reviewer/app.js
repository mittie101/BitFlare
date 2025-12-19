const state = {
  files: [],
  context: {
    app_type: 'unknown',
    deployment: 'unknown',
    openai_calling_pattern: 'unknown',
    streaming: 'unknown',
    auth_session: 'unknown',
    data_storage: 'unknown',
    target_browsers: 'unknown',
    compliance_needs: 'unknown',
    app_name: ''
  },
  settings: {
    target_score: 95,
    strictness: 'normal',
    output_mode: 'json_markdown',
    assume_missing_unknown: true
  },
  output: null,
  status: 'idle',
  error: null,
  history: []
};

const selectors = {
  fileInput: document.getElementById('file-input'),
  fileList: document.getElementById('file-list'),
  pasteBundle: document.getElementById('paste-bundle'),
  targetScore: document.getElementById('target-score'),
  strictness: document.getElementById('strictness'),
  outputMode: document.getElementById('output-mode'),
  assumeUnknown: document.getElementById('assume-unknown'),
  generate: document.getElementById('generate'),
  validation: document.getElementById('validation-warning'),
  statusIndicator: document.getElementById('status-indicator'),
  warningBanner: document.getElementById('warning-banner'),
  summaryWorks: document.getElementById('summary-works'),
  summaryRisks: document.getElementById('summary-risks'),
  summaryFast: document.getElementById('summary-fast'),
  findingsList: document.getElementById('findings-list'),
  fixPlanList: document.getElementById('fix-plan-list'),
  markdownOutput: document.getElementById('markdown-output'),
  findingsTab: document.querySelector('[data-tab="findings"]'),
  fixTab: document.querySelector('[data-tab="fix-plan"]'),
  markdownTab: document.querySelector('[data-tab="markdown"]'),
  findingsPanel: document.getElementById('findings'),
  fixPanel: document.getElementById('fix-plan'),
  markdownPanel: document.getElementById('markdown'),
  filter: document.getElementById('finding-filter'),
  overall: document.getElementById('overall-score'),
  scoreSecurity: document.getElementById('score-security'),
  scoreCorrectness: document.getElementById('score-correctness'),
  scoreUx: document.getElementById('score-ux'),
  scoreA11y: document.getElementById('score-accessibility'),
  scorePerf: document.getElementById('score-performance'),
  scoreMaint: document.getElementById('score-maintainability'),
  copyJson: document.getElementById('copy-json'),
  downloadJson: document.getElementById('download-json'),
  downloadMd: document.getElementById('download-markdown'),
  saveHistory: document.getElementById('save-history'),
  historyList: document.getElementById('history-list'),
  toggleHistory: document.getElementById('toggle-history'),
  clearAll: document.getElementById('clear-all'),
  appName: document.getElementById('app-name'),
  historyPanel: document.querySelector('.history')
};

const contextFields = {
  app_type: document.getElementById('app-type'),
  deployment: document.getElementById('deployment'),
  openai_calling_pattern: document.getElementById('calling-pattern'),
  streaming: document.getElementById('streaming'),
  auth_session: document.getElementById('auth-session'),
  data_storage: document.getElementById('data-storage'),
  target_browsers: document.getElementById('target-browsers'),
  compliance_needs: document.getElementById('compliance'),
  app_name: selectors.appName
};

function setStatus(status, message = '') {
  state.status = status;
  selectors.statusIndicator.textContent = message || status.charAt(0).toUpperCase() + status.slice(1);
  selectors.statusIndicator.className = `badge ${status}`;
}

function readFiles(fileList) {
  const readers = Array.from(fileList).map((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ path: file.name, content: reader.result });
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  });
  return Promise.all(readers);
}

function renderFiles() {
  selectors.fileList.innerHTML = '';
  state.files.forEach((file) => {
    const li = document.createElement('li');
    li.textContent = file.path;
    selectors.fileList.appendChild(li);
  });
}

function buildPayload() {
  const files = [...state.files];
  const pasteText = selectors.pasteBundle.value.trim();
  if (pasteText) {
    files.push({ path: 'pasted-bundle.txt', content: pasteText });
  }

  const context = Object.keys(contextFields).reduce((acc, key) => {
    const value = contextFields[key].value || 'unknown';
    acc[key] = value;
    return acc;
  }, {});

  const settings = {
    target_score: Number(selectors.targetScore.value) || 95,
    strictness: selectors.strictness.value,
    output_preference: selectors.outputMode.value,
    assume_missing_unknown: selectors.assumeUnknown.checked
  };

  return { files, context, settings };
}

function validatePayload(payload) {
  if (!payload.files.length) {
    selectors.validation.textContent = 'Provide at least one file or a pasted bundle.';
    return false;
  }
  selectors.validation.textContent = '';
  return true;
}

function checkIndexWarning(files) {
  const hasIndex = files.some((file) => file.path.toLowerCase() === 'index.html');
  if (!hasIndex) {
    selectors.warningBanner.textContent = 'Hard warning: index.html not found. Proceeding with UNKNOWN assumptions.';
    selectors.warningBanner.classList.remove('hidden');
  } else {
    selectors.warningBanner.classList.add('hidden');
    selectors.warningBanner.textContent = '';
  }
}

function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function basicSchemaCheck(obj) {
  const requiredKeys = ['overall_score', 'score_breakdown', 'summary', 'findings', 'fix_plan', 'assumptions', 'unknowns', 'markdown_export'];
  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(obj, key));
}

function renderSummary(list, target) {
  target.innerHTML = '';
  (list || []).forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    target.appendChild(li);
  });
}

function renderFindings(findings) {
  selectors.findingsList.innerHTML = '';
  const filter = selectors.filter.value;
  findings
    .filter((finding) => filter === 'all' || finding.category === filter)
    .forEach((finding) => {
      const template = document.getElementById('finding-template');
      const clone = template.content.cloneNode(true);
      const badge = clone.querySelector('.badge');
      badge.textContent = finding.severity;
      badge.classList.add(finding.severity.toLowerCase());
      clone.querySelector('.title').textContent = `${finding.id} · ${finding.title}`;
      clone.querySelector('.subtitle').textContent = `${finding.category} · ${finding.impact}`;
      clone.querySelector('.impact').textContent = finding.likelihood ? `Likelihood: ${finding.likelihood} · Confidence: ${finding.confidence}` : '';
      const evidence = clone.querySelector('.evidence');
      evidence.innerHTML = finding.evidence
        .map((e) => `<div><strong>${e.path}</strong><pre>${escapeHtml(e.snippet || e.quote || '')}</pre><small>${e.note || ''}</small></div>`)
        .join('');
      clone.querySelector('.recommendation').textContent = finding.recommendation;
      selectors.findingsList.appendChild(clone);
    });
}

function renderFixPlan(plan) {
  selectors.fixPlanList.innerHTML = '';
  plan.forEach((item) => {
    const template = document.getElementById('fix-template');
    const clone = template.content.cloneNode(true);
    clone.querySelector('.priority').textContent = item.priority;
    clone.querySelector('.priority').classList.add(item.priority.toLowerCase());
    clone.querySelector('.goal').textContent = `${item.goal} (covers: ${(item.findings || []).join(', ')})`;
    const steps = clone.querySelector('.steps');
    (item.steps || []).forEach((step) => {
      const li = document.createElement('li');
      li.textContent = step;
      steps.appendChild(li);
    });
    const patches = clone.querySelector('.patches');
    (item.patches || []).forEach((patch) => {
      const block = document.createElement('div');
      block.className = 'patch-snippet';
      block.innerHTML = `<p><strong>${patch.path}</strong></p><pre>${escapeHtml(patch.before || '')}</pre><pre>${escapeHtml(patch.after || '')}</pre><small>${patch.notes || ''}</small>`;
      patches.appendChild(block);
    });
    selectors.fixPlanList.appendChild(clone);
  });
}

function renderScores(breakdown, overall) {
  selectors.overall.textContent = overall ?? '–';
  selectors.scoreSecurity.textContent = breakdown?.security ?? '–';
  selectors.scoreCorrectness.textContent = breakdown?.correctness ?? '–';
  selectors.scoreUx.textContent = breakdown?.ux ?? '–';
  selectors.scoreA11y.textContent = breakdown?.accessibility ?? '–';
  selectors.scorePerf.textContent = breakdown?.performance ?? '–';
  selectors.scoreMaint.textContent = breakdown?.maintainability ?? '–';
}

function escapeHtml(value) {
  return (value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function makeMarkdown(output) {
  const lines = [];
  lines.push(`# Review for ${state.context.app_name || 'submitted bundle'}`);
  lines.push(`Overall score: ${output.overall_score}`);
  lines.push('## Summary');
  lines.push('### What works');
  output.summary?.what_works?.forEach((item) => lines.push(`- ${item}`));
  lines.push('### Top risks');
  output.summary?.top_risks?.forEach((item) => lines.push(`- ${item}`));
  lines.push('### Fastest path to 95+');
  output.summary?.fastest_path_to_95?.forEach((item) => lines.push(`- ${item}`));
  lines.push('## Findings');
  output.findings?.forEach((f) => {
    lines.push(`- **${f.id} (${f.severity})** ${f.title} — ${f.impact}`);
  });
  lines.push('## Fix plan');
  output.fix_plan?.forEach((step) => {
    lines.push(`- (${step.priority}) ${step.goal}`);
  });
  return lines.join('\n');
}

function download(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function copy(text) {
  navigator.clipboard?.writeText(text).catch(() => {
    selectors.validation.textContent = 'Copy failed. Please use download instead.';
  });
}

function saveHistory() {
  if (!state.output) return;
  const entry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    appName: state.context.app_name || 'Untitled review',
    files: state.files.map((f) => f.path),
    context: state.context,
    output: state.output
  };
  const safeEntry = { ...entry, output: state.output, context: { ...state.context, app_name: state.context.app_name || 'Untitled review' } };
  const history = loadHistory();
  history.unshift(safeEntry);
  localStorage.setItem('owasp-review-history', JSON.stringify(history));
  state.history = history;
  renderHistory();
}

function loadHistory() {
  const stored = localStorage.getItem('owasp-review-history');
  try {
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function renderHistory() {
  selectors.historyList.innerHTML = '';
  state.history.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'history-entry';
    const meta = document.createElement('div');
    meta.className = 'history-meta';
    const title = document.createElement('strong');
    title.textContent = item.context.app_name || 'Untitled review';
    const time = document.createElement('small');
    time.textContent = new Date(item.timestamp).toLocaleString();
    meta.appendChild(title);
    meta.appendChild(time);
    const controls = document.createElement('div');
    controls.className = 'actions';
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', () => applyHistory(item));
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteHistory(item.id));
    controls.appendChild(loadBtn);
    controls.appendChild(deleteBtn);
    li.appendChild(meta);
    li.appendChild(controls);
    selectors.historyList.appendChild(li);
  });
}

function applyHistory(item) {
  state.context = { ...item.context };
  selectors.appName.value = state.context.app_name || '';
  Object.entries(contextFields).forEach(([key, el]) => {
    el.value = state.context[key] ?? '';
  });
  state.output = item.output;
  renderOutput();
}

function deleteHistory(id) {
  state.history = state.history.filter((h) => h.id !== id);
  localStorage.setItem('owasp-review-history', JSON.stringify(state.history));
  renderHistory();
}

function renderOutput() {
  if (!state.output) return;
  renderScores(state.output.score_breakdown, state.output.overall_score);
  renderSummary(state.output.summary?.what_works, selectors.summaryWorks);
  renderSummary(state.output.summary?.top_risks, selectors.summaryRisks);
  renderSummary(state.output.summary?.fastest_path_to_95, selectors.summaryFast);
  renderFindings(state.output.findings || []);
  renderFixPlan(state.output.fix_plan || []);
  selectors.markdownOutput.value = state.output.markdown_export || '';
}

function toggleTabs(event) {
  const tab = event.target;
  if (!tab.classList.contains('tab')) return;
  [selectors.findingsTab, selectors.fixTab, selectors.markdownTab].forEach((t) => t.classList.remove('active'));
  [selectors.findingsPanel, selectors.fixPanel, selectors.markdownPanel].forEach((p) => p.classList.add('hidden'));
  tab.classList.add('active');
  const targetId = tab.dataset.tab;
  document.getElementById(targetId).classList.remove('hidden');
}

function fabricateResponse(payload) {
  const now = new Date().toISOString();
  return {
    overall_score: 72,
    score_breakdown: {
      security: 22,
      correctness: 18,
      ux: 12,
      accessibility: 8,
      performance: 7,
      maintainability: 5
    },
    summary: {
      what_works: ['Deterministic scoring model present', 'Input payload enforces required fields'],
      top_risks: ['LLM call stubbed; real integration pending', 'No sanitisation in uploaded bundle until parsed'],
      fastest_path_to_95: ['Harden file validation and sanitisation', 'Implement real LLM call with retry', 'Add accessibility labels across controls']
    },
    findings: [
      {
        id: 'F-001',
        category: 'security',
        severity: 'high',
        title: 'LLM call is stubbed without network error handling',
        impact: 'Real audits cannot run until wired to an API with retries.',
        likelihood: 'medium',
        confidence: 'medium',
        evidence: [
          { path: 'app.js', quote: 'function fabricateResponse(payload) {\n  const now = new Date().toISOString();\n  return {\n    overall_score: 72,', note: 'Static scaffold output.' }
        ],
        recommendation: 'Replace fabricateResponse with a real callLLM implementation and handle error states gracefully.'
      },
      {
        id: 'F-002',
        category: 'accessibility',
        severity: 'medium',
        title: 'Markdown output is plain textarea without live region',
        impact: 'Screen-reader users may not be notified when new content appears.',
        likelihood: 'low',
        confidence: 'medium',
        evidence: [
          { path: 'index.html', quote: '<div id="markdown" class="tab-panel hidden">\n            <textarea id="markdown-output" readonly rows="16"></textarea>\n          </div>', note: 'No aria-live indicator.' }
        ],
        recommendation: 'Add aria-live or focus management to announce new markdown exports.'
      }
    ],
    fix_plan: [
      {
        priority: 'high',
        goal: 'Implement resilient LLM call path (addresses F-001)',
        findings: ['F-001'],
        steps: ['Replace fabricateResponse with a real API call', 'Add timeout/retry and schema validation', 'Display actionable errors to the user'],
        patches: [
          {
            path: 'app.js',
            before: 'function fabricateResponse(payload) {\n  const now = new Date().toISOString();\n  return {\n    overall_score: 72,',
            after: 'async function callLLM(payload) {\n  const response = await fetch("/api/review", { method: "POST", body: JSON.stringify(payload) });\n  const text = await response.text();\n  const parsed = safeParseJSON(text);\n  if (!parsed || !basicSchemaCheck(parsed)) throw new Error("Invalid response");\n  return parsed;\n}',
            notes: 'Ensure backend endpoint exists and protects keys.'
          }
        ]
      },
      {
        priority: 'medium',
        goal: 'Improve Markdown announcement for screen readers (addresses F-002)',
        findings: ['F-002'],
        steps: ['Add aria-live to the markdown panel', 'Move focus to the markdown output after generation'],
        patches: [
          {
            path: 'index.html',
            before: '<div id="markdown" class="tab-panel hidden">\n            <textarea id="markdown-output" readonly rows="16"></textarea>\n          </div>',
            after: '<div id="markdown" class="tab-panel hidden" aria-live="polite">\n            <textarea id="markdown-output" readonly rows="16"></textarea>\n          </div>',
            notes: 'Keep content text-only to avoid script execution.'
          }
        ]
      }
    ],
    assumptions: ['LLM endpoint will be added separately', `Review generated at ${now}`],
    unknowns: payload.files.length ? [] : ['No files provided; results are placeholders'],
    markdown_export: makeMarkdown({
      overall_score: 72,
      summary: {
        what_works: ['Deterministic scoring model present', 'Input payload enforces required fields'],
        top_risks: ['LLM call stubbed; real integration pending', 'No sanitisation in uploaded bundle until parsed'],
        fastest_path_to_95: ['Harden file validation and sanitisation', 'Implement real LLM call with retry', 'Add accessibility labels across controls']
      },
      findings: [
        { id: 'F-001', severity: 'high', title: 'LLM call is stubbed without network error handling', impact: 'Real audits cannot run until wired to an API with retries.' },
        { id: 'F-002', severity: 'medium', title: 'Markdown output is plain textarea without live region', impact: 'Screen-reader users may not be notified when new content appears.' }
      ],
      fix_plan: [
        { priority: 'high', goal: 'Implement resilient LLM call path (addresses F-001)' },
        { priority: 'medium', goal: 'Improve Markdown announcement for screen readers (addresses F-002)' }
      ]
    })
  };
}

function callLLM(payload) {
  // Placeholder for real LLM call. Fabricated response keeps UI usable offline.
  return Promise.resolve(fabricateResponse(payload));
}

async function handleGenerate() {
  const payload = buildPayload();
  state.context = payload.context;
  state.settings = { ...state.settings, ...payload.settings };

  if (!validatePayload(payload)) return;
  checkIndexWarning(payload.files);

  setStatus('loading', 'Loading');
  try {
    const response = await callLLM(payload);
    if (!basicSchemaCheck(response)) {
      throw new Error('Response failed schema check');
    }
    state.output = response;
    renderOutput();
    setStatus('success', 'Ready');
  } catch (error) {
    state.error = error;
    setStatus('error', 'Error');
    selectors.validation.textContent = 'Generation failed. Please verify your payload and try again.';
  }
}

function resetForm() {
  state.files = [];
  selectors.pasteBundle.value = '';
  selectors.fileInput.value = '';
  selectors.warningBanner.classList.add('hidden');
  selectors.warningBanner.textContent = '';
  selectors.summaryFast.innerHTML = '';
  selectors.summaryRisks.innerHTML = '';
  selectors.summaryWorks.innerHTML = '';
  selectors.findingsList.innerHTML = '';
  selectors.fixPlanList.innerHTML = '';
  selectors.markdownOutput.value = '';
  selectors.validation.textContent = '';
  selectors.overall.textContent = selectors.scoreSecurity.textContent = selectors.scoreCorrectness.textContent = selectors.scoreUx.textContent = selectors.scoreA11y.textContent = selectors.scorePerf.textContent = selectors.scoreMaint.textContent = '–';
  renderFiles();
  setStatus('idle', 'Idle');
}

function toggleHistoryPanel() {
  if (selectors.historyPanel.classList.contains('hidden')) {
    selectors.historyPanel.classList.remove('hidden');
    selectors.toggleHistory.textContent = 'Hide';
  } else {
    selectors.historyPanel.classList.add('hidden');
    selectors.toggleHistory.textContent = 'Show';
  }
}

function init() {
  selectors.fileInput.addEventListener('change', async (event) => {
    const files = await readFiles(event.target.files);
    state.files = files;
    renderFiles();
  });

  selectors.generate.addEventListener('click', () => {
    handleGenerate();
  });

  selectors.clearAll.addEventListener('click', resetForm);
  selectors.filter.addEventListener('change', () => renderFindings(state.output?.findings || []));
  document.querySelector('.tabs').addEventListener('click', toggleTabs);
  selectors.copyJson.addEventListener('click', () => {
    if (!state.output) return;
    copy(JSON.stringify(state.output, null, 2));
  });
  selectors.downloadJson.addEventListener('click', () => {
    if (!state.output) return;
    download('review.json', JSON.stringify(state.output, null, 2));
  });
  selectors.downloadMd.addEventListener('click', () => {
    if (!state.output) return;
    download('review.md', selectors.markdownOutput.value || '', 'text/markdown');
  });
  selectors.saveHistory.addEventListener('click', saveHistory);
  selectors.toggleHistory.addEventListener('click', toggleHistoryPanel);

  state.history = loadHistory();
  renderHistory();
}

document.addEventListener('DOMContentLoaded', init);
