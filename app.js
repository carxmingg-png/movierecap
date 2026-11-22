/* ══════════════════════════════════════════
   AI RECAP STUDIO — app.js
   Full vanilla JS implementation
   AssemblyAI + OpenRouter integration
══════════════════════════════════════════ */

'use strict';

// ── Shortcuts ──────────────────────────────────────
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// ── Storage keys ──────────────────────────────────
const KEYS_KEY = 'ars_keys';
const PROJECTS_KEY = 'ars_projects';
const SETTINGS_KEY = 'ars_settings';

// ── State ─────────────────────────────────────────
let currentPage = 'overview';
let currentStep = 1;
let selectedSource = 'upload';
let selectedLanguage = 'Burmese';
let selectedDuration = '1–3 minutes';
let selectedFile = null;
let currentProjectId = null;      // project being created
let viewingProjectId = null;      // project in viewer
let activeFilter = 'All projects';

// ── Helpers ────────────────────────────────────────
function uuid() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatSize(bytes) {
  if (!bytes) return '—';
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function wordCount(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function estimateDuration(text) {
  const wpm = 140; // average narration speed
  const mins = wordCount(text) / wpm;
  if (mins < 1) return `~${Math.round(mins * 60)}s`;
  return `~${mins.toFixed(1)} min`;
}

function scriptMeta(text) {
  const chars = (text || '').length;
  const words = wordCount(text);
  const dur = estimateDuration(text);
  return { chars, words, dur };
}

// ── LocalStorage helpers ────────────────────────────
function loadKeys() {
  try { return JSON.parse(localStorage.getItem(KEYS_KEY)) || {}; } catch { return {}; }
}
function saveKeys(keys) {
  localStorage.setItem(KEYS_KEY, JSON.stringify(keys));
}
function loadProjects() {
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY)) || []; } catch { return []; }
}
function saveProjects(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; }
}
function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
function getProject(id) {
  return loadProjects().find(p => p.id === id) || null;
}
function upsertProject(proj) {
  const projects = loadProjects();
  const idx = projects.findIndex(p => p.id === proj.id);
  if (idx >= 0) projects[idx] = proj;
  else projects.unshift(proj);
  saveProjects(projects);
}
function deleteProject(id) {
  const projects = loadProjects().filter(p => p.id !== id);
  saveProjects(projects);
}

// ── Toast ──────────────────────────────────────────
function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = 'toast', 2800);
}

// ── Confirm dialog ─────────────────────────────────
function confirmDialog(title, msg) {
  return new Promise(resolve => {
    $('#confirmTitle').textContent = title;
    $('#confirmMsg').textContent = msg;
    $('#confirmOverlay').classList.remove('hidden');
    const yes = $('#confirmYes');
    const no = $('#confirmNo');
    const cleanup = () => { $('#confirmOverlay').classList.add('hidden'); yes.onclick = null; no.onclick = null; };
    yes.onclick = () => { cleanup(); resolve(true); };
    no.onclick = () => { cleanup(); resolve(false); };
  });
}

// ── Navigation ─────────────────────────────────────
const PAGES = ['overview', 'projects', 'create', 'projects', 'settings', 'project-view'];
function go(page) {
  $$('.page').forEach(el => el.classList.toggle('active', el.id === 'page-' + page));
  $$('.nav-item[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('#crumb').textContent = page.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  $('#sidebar').classList.remove('open');
  if (page === 'projects') renderAllProjects();
  if (page === 'overview') renderOverview();
  if (page === 'settings') renderSettingsPage();
  if (page === 'create') {
    if (currentStep === 1) resetCreateFlow();
  }
  currentPage = page;
}

// ── API Keys check ─────────────────────────────────
function getKeys() {
  return loadKeys();
}
function checkApiKeys() {
  const keys = getKeys();
  const hasAAI = !!(keys.assemblyai && keys.assemblyai.trim());
  const hasOR = !!(keys.openrouter && keys.openrouter.trim());
  const banner = $('#apiWarning');
  if (!hasAAI || !hasOR) {
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
  return { hasAAI, hasOR };
}

// ── Overview render ────────────────────────────────
function renderOverview() {
  const projects = loadProjects();
  const total = projects.length;
  const active = projects.filter(p => p.status === 'Processing').length;
  const ready = projects.filter(p => p.status === 'Ready').length;
  $('#totalProjects').textContent = String(total).padStart(2, '0');
  $('#activeProjects').textContent = String(active).padStart(2, '0');
  $('#readyProjects').textContent = String(ready).padStart(2, '0');

  const recent = projects.slice(0, 2);
  const grid = $('#recentProjects');
  const newBtn = `<button class="new-project-card" data-go="create"><span>＋</span><strong>Start a new story</strong><small>Bring a movie into your studio</small></button>`;
  if (recent.length === 0) {
    grid.innerHTML = newBtn;
  } else {
    grid.innerHTML = recent.map((p, i) => cardHtml(p, i)).join('') + newBtn;
  }
  $$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));

  if (projects.length > 0) {
    const last = Math.max(...projects.map(p => p.updatedAt || p.createdAt || 0));
    $('#lastUpdated').textContent = last ? 'UPDATED ' + formatDate(last).toUpperCase() : 'NO PROJECTS YET';
  } else {
    $('#lastUpdated').textContent = 'NO PROJECTS YET';
  }

  // Make recent project cards clickable
  $$('#recentProjects .project-card').forEach(card => {
    card.addEventListener('click', () => openProjectView(card.dataset.projectId));
  });
}

// ── Project card HTML ──────────────────────────────
const POSTER_CLASSES = ['poster-one', 'poster-two', 'poster-three', 'poster-four'];
function cardHtml(p, i) {
  const cls = POSTER_CLASSES[i % POSTER_CLASSES.length];
  const pillCls = {
    Ready: 'ready', Draft: 'draft', Processing: 'processing', Error: 'error-pill'
  }[p.status] || 'draft';
  const meta = p.script ? `${wordCount(p.script)} words · ${estimateDuration(p.script)}` : (p.status === 'Error' ? 'Error — click to view' : 'Script not generated');
  return `<article class="project-card" data-project-id="${escapeHtml(p.id)}">
    <div class="poster ${cls}">
      <span>PROJECT ${String(i + 1).padStart(3, '0')}</span>
      <strong>${escapeHtml(p.name.toUpperCase().substring(0, 20))}</strong>
      <small>STORY RECAP</small>
    </div>
    <div class="project-info">
      <div><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.language)} · ${escapeHtml(p.duration)}</span></div>
      <span class="pill ${pillCls}">${escapeHtml(p.status)}</span>
    </div>
    <div class="project-meta"><span>${escapeHtml(meta)}</span><button class="more-button" aria-label="More" data-project-id="${escapeHtml(p.id)}">•••</button></div>
  </article>`;
}

// ── All Projects render ────────────────────────────
function renderAllProjects() {
  const projects = loadProjects();
  const container = $('#allProjects');
  let list = projects;
  if (activeFilter && activeFilter !== 'All projects') {
    list = projects.filter(p => p.status === activeFilter);
  }
  if (list.length === 0) {
    container.innerHTML = `<p class="subtle-label" style="padding:20px 0;grid-column:1/-1">${activeFilter === 'All projects' ? 'No projects yet. Create your first recap!' : 'No projects in this category.'}</p>`;
    return;
  }
  container.innerHTML = list.map((p, i) => cardHtml(p, i)).join('');
  $$('#allProjects .project-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('more-button')) return;
      openProjectView(card.dataset.projectId);
    });
  });
}

// ── Project viewer ─────────────────────────────────
function openProjectView(id) {
  const p = getProject(id);
  if (!p) { toast('Project not found.', 'error'); return; }
  viewingProjectId = id;

  $('#pvProjectName').textContent = p.name;
  $('#pvProjectMeta').textContent = `${p.language} · ${p.duration} · ${p.source === 'upload' ? (p.fileName || 'uploaded file') : 'link'}`;
  const pillCls = { Ready: 'ready', Draft: 'draft', Processing: 'processing', Error: 'error-pill' }[p.status] || 'draft';
  $('#pvStatusPill').className = `pill ${pillCls}`;
  $('#pvStatusPill').textContent = p.status;

  $('#pvScriptTextarea').value = p.script || '';
  updateScriptMetaDisplay(p.script || '', 'pv');

  $('#pvLang').textContent = p.language || '—';
  $('#pvDuration').textContent = p.duration || '—';
  $('#pvSource').textContent = p.source === 'upload' ? `Upload (${p.fileName || 'unknown'}, ${formatSize(p.fileSize)})` : 'Link';
  $('#pvCreated').textContent = formatDate(p.createdAt);
  $('#pvUpdated').textContent = formatDate(p.updatedAt);
  $('#pvTranscriptPreview').textContent = p.transcript ? p.transcript.substring(0, 600) + (p.transcript.length > 600 ? '...' : '') : 'No transcript available.';

  go('project-view');
}

function updateScriptMetaDisplay(text, prefix) {
  const { chars, words, dur } = scriptMeta(text);
  if ($(`#${prefix}CharCount`)) $(`#${prefix}CharCount`).textContent = `${chars.toLocaleString()} characters`;
  if ($(`#${prefix}WordCount`)) $(`#${prefix}WordCount`).textContent = `${words.toLocaleString()} words`;
  if ($(`#${prefix}EstDuration`)) $(`#${prefix}EstDuration`).textContent = dur;
}

// ── Wizard flow ────────────────────────────────────
function goToStep(step) {
  currentStep = step;
  $$('.wizard-panel').forEach(p => p.classList.toggle('active', p.id === `step-${step}`));
  $$('.wizard-step').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.remove('active', 'done');
    if (s === step) el.classList.add('active');
    else if (s < step) el.classList.add('done');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetCreateFlow() {
  currentStep = 1;
  currentProjectId = null;
  selectedFile = null;
  selectedSource = 'upload';
  selectedLanguage = 'Burmese';
  selectedDuration = '1–3 minutes';
  $('#movieFile').value = '';
  $('#movieUrl').value = '';
  $('#projectName').value = '';
  $('#fileSelected').textContent = '';
  $('#manualTranscript').value = '';
  $('#uploadZone').classList.remove('hidden');
  $('#linkField').classList.add('hidden');
  $$('.source-tab').forEach(t => t.classList.toggle('selected', t.dataset.source === 'upload'));
  $$('.choice[data-choice="language"]').forEach(b => b.classList.toggle('selected', b.dataset.value === 'Burmese'));
  $$('.choice[data-choice="duration"]').forEach(b => b.classList.toggle('selected', b.dataset.value === '1–3 minutes'));
  resetGeneratePanel();
  goToStep(1);
}

function resetGeneratePanel() {
  // Reset pipeline steps
  $$('.pipeline-step').forEach(ps => {
    ps.classList.remove('active', 'done', 'error');
    ps.querySelector('.ps-status').textContent = 'waiting';
  });
  $('#progressTrack').style.display = 'none';
  $('#progressBar').style.width = '0';
  $('#progressLabel').textContent = 'Starting...';
  $('#generateBtn').disabled = false;
  $('#generateBtn').textContent = '✦ Generate script →';
  $('#scriptEmpty').style.display = '';
  $('#scriptContent').style.display = 'none';
  $('#scriptTextarea').value = '';
}

// ── Step 1 → 2 ─────────────────────────────────────
$('#step1Next').addEventListener('click', () => {
  const name = $('#projectName').value.trim();
  const url = $('#movieUrl').value.trim();

  if (!name) { toast('Please enter a project name.', 'error'); $('#projectName').focus(); return; }
  if (selectedSource === 'upload' && !selectedFile) { toast('Please choose a video file.', 'error'); return; }
  if (selectedSource === 'link' && !url) { toast('Please enter a movie URL.', 'error'); $('#movieUrl').focus(); return; }

  updateApiStatusBlock();
  refreshStep3Info();
  goToStep(2);
});

// ── Step 2 ─────────────────────────────────────────
function updateApiStatusBlock() {
  const { hasAAI, hasOR } = checkApiKeys();
  const keys = getKeys();

  const updateRow = (rowId, iconId, textId, badgeId, hasKey, label) => {
    const row = $(rowId);
    const icon = $(iconId);
    const text = $(textId);
    const badge = $(badgeId);
    if (hasKey) {
      row.classList.add('ok'); row.classList.remove('missing');
      icon.style.color = 'var(--green)';
      text.textContent = 'Connected';
      badge.textContent = 'Active'; badge.className = 'api-badge ok';
    } else {
      row.classList.add('missing'); row.classList.remove('ok');
      icon.style.color = 'var(--red)';
      text.textContent = 'Not configured — go to Settings';
      badge.textContent = 'Missing'; badge.className = 'api-badge bad';
    }
  };

  updateRow('#aaiStatus', '#aaiStatus .api-status-icon', '#aaiStatusText', '#aaiStatusBadge', hasAAI);
  updateRow('#orStatus', '#orStatus .api-status-icon', '#orStatusText', '#orStatusBadge', hasOR);

  // Show skip box if no AAI key but have OR key
  $('#skipTranscriptionBox').style.display = (!hasAAI && hasOR) ? 'block' : 'none';
}

$('#step2Back').addEventListener('click', () => goToStep(1));
$('#step2Next').addEventListener('click', () => {
  refreshStep3Info();
  goToStep(3);
});

// ── Step 3 info refresh ─────────────────────────────
function refreshStep3Info() {
  const name = $('#projectName').value.trim();
  $('#genProjectName').textContent = name || '—';
  $('#genLanguage').textContent = selectedLanguage;
  $('#genDuration').textContent = selectedDuration;
  $('#genSource').textContent = selectedSource === 'upload' && selectedFile ? selectedFile.name : (selectedSource === 'link' ? 'URL link' : '—');
}

$('#step3Back').addEventListener('click', () => goToStep(2));

// ── AssemblyAI API ─────────────────────────────────
async function uploadToAssemblyAI(file, apiKey) {
  const response = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/octet-stream' },
    body: file
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed (${response.status})`);
  }
  const data = await response.json();
  return data.upload_url;
}

async function createTranscript(audioUrl, apiKey) {
  const response = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: audioUrl, sentiment_analysis: true })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Transcription request failed (${response.status})`);
  }
  return response.json();
}

async function pollTranscript(transcriptId, apiKey, onProgress) {
  let attempts = 0;
  while (true) {
    if (attempts > 180) throw new Error('Transcription timed out after 9 minutes.');
    const r = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { 'Authorization': apiKey }
    });
    if (!r.ok) throw new Error(`Polling failed (${r.status})`);
    const data = await r.json();
    if (data.status === 'completed') return data;
    if (data.status === 'error') throw new Error(data.error || 'Transcription error');
    if (onProgress) onProgress(data.status, data);
    await new Promise(res => setTimeout(res, 3000));
    attempts++;
  }
}

// ── OpenRouter API ─────────────────────────────────
async function generateScriptFromTranscript(transcript, language, duration, openRouterKey, model) {
  const langInstruction = language === 'Burmese'
    ? 'Write the ENTIRE script in Burmese (မြန်မာဘာသာ). Use natural, engaging, modern Burmese language. All text must be in Burmese script.'
    : 'Write the entire script in English. Use cinematic, dramatic American English.';
  const lengthInstruction = duration === '1–3 minutes'
    ? 'Make it a SHORT recap of approximately 300-500 words suitable for 1-3 minutes of narration.'
    : 'Make it a LONG recap of approximately 800-1200 words suitable for 5-10 minutes of narration.';

  const prompt = `You are a professional movie recap narrator creating content for TikTok and YouTube Shorts. Based on the following transcript, write a cinematic, engaging recap script.

TRANSCRIPT:
${transcript.substring(0, 10000)}

INSTRUCTIONS:
- ${langInstruction}
- ${lengthInstruction}
- Write in a dramatic, storytelling style with high energy
- Start with a powerful hook that immediately grabs attention
- Build tension and suspense throughout
- Include key plot points and character moments
- End with an emotional punch or cliffhanger
- Do NOT include timestamps, speaker labels, or stage directions
- Write as continuous narration paragraphs only
- Make it sound like a professional movie narrator speaking directly to the audience

Write only the script, no introduction or meta-commentary.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost',
      'X-Title': 'AI Recap Studio'
    },
    body: JSON.stringify({
      model: model || 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error((data.error && data.error.message) || `OpenRouter error (${response.status})`);
  if (data.error) throw new Error(data.error.message || 'OpenRouter error');
  if (!data.choices || !data.choices[0]) throw new Error('No response from AI model');
  return data.choices[0].message.content;
}

// ── Pipeline step helpers ──────────────────────────
function setPipelineStep(id, state) {
  // state: 'active' | 'done' | 'error' | 'waiting'
  const el = $(`#${id}`);
  if (!el) return;
  el.classList.remove('active', 'done', 'error');
  const statusEl = el.querySelector('.ps-status');
  if (state === 'active') {
    el.classList.add('active');
    statusEl.textContent = 'running...';
  } else if (state === 'done') {
    el.classList.add('done');
    statusEl.textContent = 'done ✓';
  } else if (state === 'error') {
    el.classList.add('error');
    statusEl.textContent = 'error';
  } else {
    statusEl.textContent = 'waiting';
  }
}

function setProgress(pct, label) {
  const track = $('#progressTrack');
  track.style.display = 'block';
  if (pct === 'indeterminate') {
    $('#progressBar').className = 'progress-bar indeterminate';
  } else {
    $('#progressBar').className = 'progress-bar';
    $('#progressBar').style.width = `${pct}%`;
  }
  if (label) $('#progressLabel').textContent = label;
}

function setStatusBusy(busy) {
  const dot = $('#statusDot');
  const text = $('#statusText');
  if (busy) {
    dot.classList.add('busy');
    text.textContent = 'Processing...';
  } else {
    dot.classList.remove('busy');
    text.textContent = 'Ready';
  }
}

// ── Main generate function ─────────────────────────
$('#generateBtn').addEventListener('click', async () => {
  const keys = getKeys();
  const hasAAI = !!(keys.assemblyai && keys.assemblyai.trim());
  const hasOR = !!(keys.openrouter && keys.openrouter.trim());
  const manualTranscript = $('#manualTranscript').value.trim();

  if (!hasOR) {
    toast('OpenRouter API key is required. Please add it in Settings.', 'error');
    return;
  }

  // If no AAI key but no manual transcript either
  if (!hasAAI && !manualTranscript) {
    toast('Add an AssemblyAI key or paste a manual transcript to continue.', 'error');
    return;
  }

  if (selectedSource === 'upload' && !selectedFile && !manualTranscript) {
    toast('Please upload a video file or paste a manual transcript.', 'error');
    return;
  }

  const name = $('#projectName').value.trim();
  const model = loadKeys().model || 'meta-llama/llama-3.1-8b-instruct:free';

  // Create / update project record
  const project = {
    id: currentProjectId || uuid(),
    name,
    language: selectedLanguage,
    duration: selectedDuration,
    status: 'Processing',
    source: selectedSource,
    fileName: selectedFile ? selectedFile.name : null,
    fileSize: selectedFile ? selectedFile.size : null,
    transcript: '',
    script: '',
    errorMsg: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  currentProjectId = project.id;
  upsertProject(project);

  // Disable button, show progress
  const btn = $('#generateBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Generating...';
  setStatusBusy(true);
  resetGeneratePanel();

  let transcriptText = manualTranscript;

  try {
    if (!manualTranscript && selectedFile && hasAAI) {
      // ── Step 1: Upload ──────────────────────────
      setPipelineStep('ps1', 'active');
      setProgress('indeterminate', '📤 Uploading video to AssemblyAI...');

      let uploadUrl;
      try {
        uploadUrl = await uploadToAssemblyAI(selectedFile, keys.assemblyai.trim());
      } catch (err) {
        throw new Error(`Upload failed: ${err.message}`);
      }
      setPipelineStep('ps1', 'done');
      setProgress(30, '🎙 Starting transcription...');

      // ── Step 2: Transcribe ──────────────────────
      setPipelineStep('ps2', 'active');
      let transcriptJob;
      try {
        transcriptJob = await createTranscript(uploadUrl, keys.assemblyai.trim());
      } catch (err) {
        throw new Error(`Transcription start failed: ${err.message}`);
      }

      transcriptText = await pollTranscript(transcriptJob.id, keys.assemblyai.trim(), (status, data) => {
        setProgress('indeterminate', `🎙 Transcribing audio (${status})...`);
      });

      transcriptText = transcriptText.text || '';
      setPipelineStep('ps2', 'done');
      setProgress(65, '🤖 Transcript ready — generating script...');
    } else if (!transcriptText) {
      transcriptText = `Movie: ${name}. The user did not provide a transcript. Please create a generic cinematic recap script for a movie titled "${name}" based on whatever you know about it, or if unknown, create a compelling dramatic narrative about the themes suggested by the title.`;
    }

    // Save transcript to project
    project.transcript = transcriptText;
    project.updatedAt = Date.now();
    upsertProject(project);

    // ── Step 3: Generate script ─────────────────────
    setPipelineStep('ps3', 'active');
    setProgress('indeterminate', '🤖 Generating cinematic script with AI...');

    const script = await generateScriptFromTranscript(
      transcriptText, selectedLanguage, selectedDuration,
      keys.openrouter.trim(), model
    );

    setPipelineStep('ps3', 'done');
    setProgress(95, '✅ Script ready!');

    // ── Step 4: Done ────────────────────────────────
    setPipelineStep('ps4', 'done');
    setProgress(100, '✅ All done!');

    // Update project
    project.status = 'Ready';
    project.script = script;
    project.updatedAt = Date.now();
    upsertProject(project);

    // Show script
    $('#scriptEmpty').style.display = 'none';
    $('#scriptContent').style.display = 'block';
    $('#scriptTextarea').value = script;
    updateScriptMetaDisplay(script, 'script');

    toast('Script generated successfully!', 'success');
    btn.disabled = false;
    btn.textContent = '✦ Regenerate →';
    setStatusBusy(false);

  } catch (err) {
    console.error('Generation error:', err);
    // Mark error step
    const activeStep = $$('.pipeline-step.active')[0];
    if (activeStep) activeStep.classList.replace('active', 'error');
    const statusEl = activeStep && activeStep.querySelector('.ps-status');
    if (statusEl) statusEl.textContent = 'error';

    setProgress(0, `Error: ${err.message}`);
    $('#progressBar').style.background = 'var(--red)';

    project.status = 'Error';
    project.errorMsg = err.message;
    project.updatedAt = Date.now();
    upsertProject(project);

    toast(`Error: ${err.message}`, 'error');
    btn.disabled = false;
    btn.textContent = '✦ Retry →';
    setStatusBusy(false);
  }
});

// ── Script textarea live meta update ───────────────
$('#scriptTextarea').addEventListener('input', () => {
  updateScriptMetaDisplay($('#scriptTextarea').value, 'script');
  // Autosave to current project
  if (currentProjectId) {
    const p = getProject(currentProjectId);
    if (p) {
      p.script = $('#scriptTextarea').value;
      p.updatedAt = Date.now();
      upsertProject(p);
    }
  }
});

// ── Step 3 → 4 ─────────────────────────────────────
$('#step3Next').addEventListener('click', () => {
  const script = $('#scriptTextarea').value.trim();
  if (!script) { toast('No script to export yet.', 'error'); return; }

  // Populate export page
  const p = getProject(currentProjectId);
  $('#exportProjectName').textContent = p ? p.name : ($$('#projectName')[0].value.trim() || 'Untitled');
  $('#exportMeta').textContent = `${selectedLanguage} · ${selectedDuration} · Vertical 9:16`;
  $('#exportTextarea').value = script;
  updateScriptMetaDisplay(script, 'export');
  goToStep(4);
});

$('#step4Back').addEventListener('click', () => goToStep(3));

$('#finishProject').addEventListener('click', () => {
  go('projects');
  toast('Project saved!', 'success');
});

// ── Export actions ─────────────────────────────────
$('#copyScriptBtn').addEventListener('click', () => {
  const text = $('#exportTextarea').value;
  if (!text) { toast('Nothing to copy.', 'error'); return; }
  navigator.clipboard.writeText(text).then(() => toast('Script copied to clipboard!', 'success')).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    toast('Script copied!', 'success');
  });
});

$('#downloadScriptBtn').addEventListener('click', () => {
  const text = $('#exportTextarea').value;
  if (!text) { toast('Nothing to download.', 'error'); return; }
  const p = getProject(currentProjectId);
  const name = (p ? p.name : 'recap').replace(/\s+/g, '_');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name}_recap.txt`; a.click();
  URL.revokeObjectURL(url);
  toast('Script downloaded!', 'success');
});

// ── Project viewer actions ─────────────────────────
$('#pvBack').addEventListener('click', () => {
  go(currentPage === 'project-view' ? 'projects' : currentPage);
});

$('#pvCopyBtn').addEventListener('click', () => {
  const text = $('#pvScriptTextarea').value;
  if (!text) { toast('No script to copy.', 'error'); return; }
  navigator.clipboard.writeText(text).then(() => toast('Copied!', 'success')).catch(() => toast('Copy failed.', 'error'));
});

$('#pvDownloadBtn').addEventListener('click', () => {
  const text = $('#pvScriptTextarea').value;
  if (!text) { toast('No script to download.', 'error'); return; }
  const p = getProject(viewingProjectId);
  const name = (p ? p.name : 'recap').replace(/\s+/g, '_');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name}_recap.txt`; a.click();
  URL.revokeObjectURL(url);
  toast('Downloaded!', 'success');
});

$('#pvSaveBtn').addEventListener('click', () => {
  if (!viewingProjectId) return;
  const p = getProject(viewingProjectId);
  if (!p) return;
  p.script = $('#pvScriptTextarea').value;
  p.updatedAt = Date.now();
  if (p.status === 'Draft' && p.script.trim()) p.status = 'Ready';
  upsertProject(p);
  updateScriptMetaDisplay(p.script, 'pv');
  toast('Script saved!', 'success');
});

$('#pvScriptTextarea').addEventListener('input', () => {
  updateScriptMetaDisplay($('#pvScriptTextarea').value, 'pv');
});

$('#pvDeleteBtn').addEventListener('click', async () => {
  const ok = await confirmDialog('Delete project?', 'This will permanently delete the project and its script. This cannot be undone.');
  if (!ok) return;
  deleteProject(viewingProjectId);
  viewingProjectId = null;
  toast('Project deleted.', 'success');
  go('projects');
});

// ── Settings page ──────────────────────────────────
function renderSettingsPage() {
  const keys = loadKeys();
  const settings = loadSettings();

  if (keys.assemblyai) {
    $('#aaiKeyInput').value = keys.assemblyai;
    $('#aaiKeyPill').textContent = 'Set ✓';
    $('#aaiKeyPill').className = 'pill ready';
  } else {
    $('#aaiKeyInput').value = '';
    $('#aaiKeyPill').textContent = 'Not set';
    $('#aaiKeyPill').className = 'pill draft';
  }

  if (keys.openrouter) {
    $('#orKeyInput').value = keys.openrouter;
    $('#orKeyPill').textContent = 'Set ✓';
    $('#orKeyPill').className = 'pill ready';
  } else {
    $('#orKeyInput').value = '';
    $('#orKeyPill').textContent = 'Not set';
    $('#orKeyPill').className = 'pill draft';
  }

  // Model
  const model = keys.model || 'meta-llama/llama-3.1-8b-instruct:free';
  const presetEl = $('#modelPreset');
  const customEl = $('#modelCustom');
  const isPreset = [...presetEl.options].some(o => o.value === model && o.value !== 'custom');
  if (isPreset) {
    presetEl.value = model;
    customEl.classList.add('hidden');
  } else {
    presetEl.value = 'custom';
    customEl.value = model;
    customEl.classList.remove('hidden');
  }

  // Default lang setting
  const defaultLang = settings.defaultLang || 'Burmese';
  $$('.choice[data-choice="defaultLang"]').forEach(b => b.classList.toggle('selected', b.dataset.value === defaultLang));

  // Local storage size
  const projects = loadProjects();
  const size = new Blob([JSON.stringify(projects)]).size;
  $('#localDataSize').textContent = `${projects.length} project(s) · ${formatSize(size)} stored locally`;

  // Hide test results
  $('#aaiTestResult').classList.remove('show');
  $('#orTestResult').classList.remove('show');
}

// Save settings
$('#saveSettingsBtn').addEventListener('click', () => {
  const aaiKey = $('#aaiKeyInput').value.trim();
  const orKey = $('#orKeyInput').value.trim();
  const presetVal = $('#modelPreset').value;
  const customVal = $('#modelCustom').value.trim();
  const model = presetVal === 'custom' ? (customVal || 'meta-llama/llama-3.1-8b-instruct:free') : presetVal;

  saveKeys({ assemblyai: aaiKey, openrouter: orKey, model });

  const defaultLang = $$('.choice[data-choice="defaultLang"]').find(b => b.classList.contains('selected'))?.dataset.value || 'Burmese';
  saveSettings({ defaultLang });

  checkApiKeys();
  renderSettingsPage();
  toast('Settings saved!', 'success');
});

// Model preset change
$('#modelPreset').addEventListener('change', () => {
  const val = $('#modelPreset').value;
  $('#modelCustom').classList.toggle('hidden', val !== 'custom');
});

// Toggle key visibility
$$('.toggle-key-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = $(`#${btn.dataset.target}`);
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

// Test AssemblyAI key
$('#testAaiKey').addEventListener('click', async () => {
  const key = $('#aaiKeyInput').value.trim();
  if (!key) { toast('Enter an AssemblyAI key first.', 'error'); return; }
  const result = $('#aaiTestResult');
  result.className = 'key-test-result show';
  result.textContent = 'Testing...';

  try {
    // Test by hitting the transcripts list endpoint
    const r = await fetch('https://api.assemblyai.com/v2/transcript?limit=1', {
      headers: { 'Authorization': key }
    });
    if (r.ok || r.status === 200) {
      result.className = 'key-test-result show ok';
      result.textContent = '✓ AssemblyAI key is valid!';
    } else if (r.status === 401) {
      result.className = 'key-test-result show fail';
      result.textContent = '✗ Invalid key — check your AssemblyAI API key.';
    } else {
      result.className = 'key-test-result show ok';
      result.textContent = `✓ Key accepted (status ${r.status})`;
    }
  } catch (err) {
    result.className = 'key-test-result show fail';
    result.textContent = `✗ Connection error: ${err.message}`;
  }
});

// Test OpenRouter key
$('#testOrKey').addEventListener('click', async () => {
  const key = $('#orKeyInput').value.trim();
  if (!key) { toast('Enter an OpenRouter key first.', 'error'); return; }
  const result = $('#orTestResult');
  result.className = 'key-test-result show';
  result.textContent = 'Testing...';

  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    if (r.ok) {
      result.className = 'key-test-result show ok';
      result.textContent = '✓ OpenRouter key is valid!';
    } else if (r.status === 401 || r.status === 403) {
      result.className = 'key-test-result show fail';
      result.textContent = '✗ Invalid key — check your OpenRouter API key.';
    } else {
      const data = await r.json().catch(() => ({}));
      result.className = 'key-test-result show fail';
      result.textContent = `✗ Error ${r.status}: ${data.error?.message || 'Unknown error'}`;
    }
  } catch (err) {
    result.className = 'key-test-result show fail';
    result.textContent = `✗ Connection error: ${err.message}`;
  }
});

// Clear all keys
$('#clearKeysBtn').addEventListener('click', async () => {
  const ok = await confirmDialog('Clear API keys?', 'This will remove all saved API keys. AI features will stop working until you re-enter them.');
  if (!ok) return;
  saveKeys({});
  renderSettingsPage();
  checkApiKeys();
  toast('API keys cleared.', 'success');
});

// Clear all data
$('#clearAllDataBtn').addEventListener('click', async () => {
  const ok = await confirmDialog('Clear all data?', 'This will permanently delete all projects, scripts, transcripts, and API keys stored in this browser. This cannot be undone.');
  if (!ok) return;
  localStorage.removeItem(KEYS_KEY);
  localStorage.removeItem(PROJECTS_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  renderSettingsPage();
  renderOverview();
  checkApiKeys();
  toast('All data cleared.', 'success');
});

// Export data
$('#exportDataBtn').addEventListener('click', () => {
  const data = {
    projects: loadProjects(),
    keys: loadKeys(),
    settings: loadSettings(),
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ai-recap-studio-backup-${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
  toast('Data exported!', 'success');
});

// ── Upload zone ────────────────────────────────────
$('#browseFile').addEventListener('click', () => $('#movieFile').click());
$('#movieFile').addEventListener('change', e => {
  selectedFile = e.target.files[0] || null;
  if (selectedFile) {
    $('#fileSelected').textContent = `✓ ${selectedFile.name} · ${formatSize(selectedFile.size)}`;
    if (!$('#projectName').value.trim()) {
      // Auto-fill project name from filename
      const name = selectedFile.name.replace(/\.[^.]+$/, '').replace(/[_.-]+/g, ' ');
      $('#projectName').value = name.charAt(0).toUpperCase() + name.slice(1);
    }
  } else {
    $('#fileSelected').textContent = '';
  }
});

const zone = $('#uploadZone');
zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
zone.addEventListener('drop', e => {
  e.preventDefault();
  zone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('video/')) {
    selectedFile = f;
    $('#fileSelected').textContent = `✓ ${f.name} · ${formatSize(f.size)}`;
    if (!$('#projectName').value.trim()) {
      const name = f.name.replace(/\.[^.]+$/, '').replace(/[_.-]+/g, ' ');
      $('#projectName').value = name.charAt(0).toUpperCase() + name.slice(1);
    }
  } else {
    toast('Please drop a video file (MP4, MOV, MKV).', 'error');
  }
});

// ── Source tabs ────────────────────────────────────
$$('.source-tab').forEach(b => b.addEventListener('click', () => {
  selectedSource = b.dataset.source;
  $$('.source-tab').forEach(x => x.classList.toggle('selected', x === b));
  $('#uploadZone').classList.toggle('hidden', selectedSource !== 'upload');
  $('#linkField').classList.toggle('hidden', selectedSource !== 'link');
}));

// ── Choice buttons (global) ────────────────────────
$$('.choice').forEach(b => b.addEventListener('click', () => {
  const group = b.dataset.choice;
  $$(`.choice[data-choice="${group}"]`).forEach(x => x.classList.toggle('selected', x === b));
  if (group === 'language') selectedLanguage = b.dataset.value;
  if (group === 'duration') selectedDuration = b.dataset.value;
}));

// ── Nav buttons ────────────────────────────────────
$$('[data-page]').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
$$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));

// Mobile menu
$('#mobileMenu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

// Close API warning
$('#closeWarning').addEventListener('click', () => { $('#apiWarning').style.display = 'none'; });

// Filter buttons
$$('.filter').forEach(b => b.addEventListener('click', () => {
  $$('.filter').forEach(x => x.classList.toggle('active', x === b));
  activeFilter = b.dataset.filter;
  renderAllProjects();
}));

// Confirm overlay — close on backdrop click
$('#confirmOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) {
    $('#confirmOverlay').classList.add('hidden');
  }
});

// Settings inline buttons
$$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));

// ── Init ───────────────────────────────────────────
function init() {
  checkApiKeys();
  renderOverview();
  goToStep(1);

  // Apply saved default language from settings
  const settings = loadSettings();
  if (settings.defaultLang) {
    selectedLanguage = settings.defaultLang;
    $$('.choice[data-choice="language"]').forEach(b => b.classList.toggle('selected', b.dataset.value === selectedLanguage));
  }

  // Check for processing projects on load (UI only — cannot resume)
  const projects = loadProjects();
  const processing = projects.filter(p => p.status === 'Processing');
  processing.forEach(p => {
    // Mark them as error since we lost the browser session
    p.status = 'Error';
    p.errorMsg = 'Processing was interrupted (page was closed).';
    p.updatedAt = Date.now();
    upsertProject(p);
  });
  if (processing.length > 0) {
    toast(`${processing.length} interrupted job(s) marked as Error.`, 'error');
    renderOverview();
  }
}

init();
