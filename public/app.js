import { mdToBlocks, blocksToHtml } from '/shared/mdToBlocks.js';

/* ============================================================ elements */
const $ = (s) => document.querySelector(s);
const messagesEl = $('#messages');
const emptyState = $('#emptyState');
const inputEl = $('#input');
const sendBtn = $('#sendBtn');
const stopBtn = $('#stopBtn');
const historyList = $('#historyList');
const newChatBtn = $('#newChatBtn');
const modeChip = $('#modeChip');
const modeText = $('#modeText');
const demoChip = $('#demoChip');
const themeToggle = $('#themeToggle');

/* ============================================================ theme */
const THEME_KEY = 'calibiai_theme';

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}
function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(THEME_KEY, t); } catch {}
  if (themeToggle) themeToggle.title = t === 'dark' ? 'Switch to white theme' : 'Switch to dark theme';
}
function toggleTheme() {
  applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}
if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

/* ============================================================ state */
const HISTORY_KEY = 'calibiai_chats_v1';
let chats = loadChats();
let activeChatId = null;
let currentSessionId = null;
let streaming = false;
let currentAbort = null;
let currentRaw = '';
let flushTimer = null;
let aiShell = null; // { bodyEl, actionsEl }
let isDemo = false;

/* ============================================================ helpers */
function loadChats() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}
function saveChats() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(chats.slice(0, 20))); } catch {}
}
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toast(msg, type = 'info', ms = 4200) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }, ms - 300);
  setTimeout(() => el.remove(), ms);
}

function isNearBottom() {
  return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 140;
}
function scrollBottom(force = false) {
  if (force || isNearBottom()) messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* ============================================================ history sidebar */
function renderHistory() {
  historyList.innerHTML = '';
  chats.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = 'hist-item' + (c.id === activeChatId ? ' active' : '');
    btn.textContent = c.title || 'Untitled';
    btn.addEventListener('click', () => openChat(c));
    historyList.appendChild(btn);
  });
}

let sessionMessages = []; // [{role, content}] for the active conversation

function aiShellHistorySnapshot() {
  return sessionMessages.filter((m) => m.content && m.content.trim());
}

function newConversation() {
  if (streaming) stopStreaming();
  sessionMessages = [];
  activeChatId = null;
  currentSessionId = null;
  messagesEl.querySelectorAll('.msg').forEach((m) => m.remove());
  emptyState.hidden = false;
  inputEl.focus();
  renderHistory();
}

function openChat(c) {
  if (streaming) stopStreaming();
  sessionMessages = (c.messages || []).map((m) => ({ ...m }));
  activeChatId = c.id;
  currentSessionId = c.sessionId || null;
  messagesEl.querySelectorAll('.msg').forEach((m) => m.remove());
  emptyState.hidden = sessionMessages.length > 0;
  sessionMessages.forEach((m) => renderMessage(m, { animate: false }));
  scrollBottom(true);
  renderHistory();
}

function ensureChatEntry() {
  if (activeChatId) return;
  const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  activeChatId = id;
  chats.unshift({ id, title: null, sessionId: null, updatedAt: Date.now(), messages: [] });
  saveChats();
  renderHistory();
}

/* ============================================================ message rendering */
function renderUserMessage(text) {
  const wrap = document.createElement('div');
  wrap.className = 'msg user';
  const bubble = document.createElement('div');
  bubble.className = 'bubble-user';
  bubble.textContent = text;
  wrap.appendChild(bubble);
  messagesEl.appendChild(wrap);
  emptyState.hidden = true;
  scrollBottom(true);
}

function renderMessage(m, { animate = false } = {}) {
  if (m.role === 'user') { renderUserMessage(m.content); return; }
  const shell = createAiShell();
  shell.bodyEl.innerHTML = blocksToHtml(mdToBlocks(m.content));
  if (m.content.includes('# CALIBIAI COMMERCIAL ESTIMATE')) {
    shell.head.querySelector('.pill-est').hidden = false;
    attachEstimateActions(shell, m.content, currentSessionId);
  }
  if (animate) scrollBottom(true);
}

function createAiShell() {
  const wrap = document.createElement('div');
  wrap.className = 'msg ai';

  const head = document.createElement('div');
  head.className = 'msg-head';
  head.innerHTML = `
    <img src="/logo.png" alt="CalibiAI" class="mini-avatar" />
    <div class="who">CalibiAI Costing Agent</div>
    <span class="pill-est" hidden>Estimate ready</span>
    <div class="when">${nowTime()}</div>`;
  wrap.appendChild(head);

  const bubble = document.createElement('div');
  bubble.className = 'bubble-ai';
  const body = document.createElement('div');
  body.className = 'md';
  bubble.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.hidden = true;
  bubble.appendChild(actions);

  wrap.appendChild(bubble);
  messagesEl.appendChild(wrap);

  return { wrap, head, bodyEl: body, actionsEl: actions };
}

/* ============================================================ streaming */
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 42);
}

function flush() {
  if (!aiShell) return;
  const html = blocksToHtml(mdToBlocks(currentRaw));
  aiShell.bodyEl.innerHTML = html + '<span class="cursor"></span>';
  scrollBottom();
}

function finalizeStream(aborted = false) {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  streaming = false;
  currentAbort = null;
  stopBtn.hidden = true;
  sendBtn.hidden = false;

  if (aiShell) {
    if (aborted && !currentRaw.trim()) {
      aiShell.bodyEl.innerHTML = '<p class="streaming-note">Generation stopped.</p>';
    } else if (currentRaw.trim()) {
      aiShell.bodyEl.innerHTML = blocksToHtml(mdToBlocks(currentRaw));
      const isEstimate = currentRaw.includes('# CALIBIAI COMMERCIAL ESTIMATE');
      if (isEstimate) {
        aiShell.head.querySelector('.pill-est').hidden = false;
        attachEstimateActions(aiShell, currentRaw.trim(), currentSessionId);
      }
      sessionMessages.push({ role: 'assistant', content: currentRaw.trim() });
      if (activeChatId) {
        const chat = chats.find((c) => c.id === activeChatId);
        if (chat) {
          chat.sessionId = currentSessionId;
          chat.messages = aiShellHistorySnapshot();
          if (!chat.title) chat.title = sessionMessages.find((m) => m.role === 'user')?.content?.slice(0, 52) || 'Untitled';
          chat.updatedAt = Date.now();
          saveChats();
          renderHistory();
        }
      }
    }
    aiShell = null;
  }
  currentRaw = '';
}

function stopStreaming() {
  if (currentAbort) { try { currentAbort.abort(); } catch {} }
  finalizeStream(true);
}

async function sendMessage(text) {
  text = (text || '').trim();
  if (!text || streaming) return;

  ensureChatEntry();
  renderUserMessage(text);
  sessionMessages.push({ role: 'user', content: text });
  inputEl.value = '';
  autoResize();

  streaming = true;
  currentRaw = '';
  currentAbort = new AbortController();
  sendBtn.hidden = true;
  stopBtn.hidden = false;
  const shell = createAiShell();
  aiShell = shell;
  shell.bodyEl.innerHTML = '<span class="cursor"></span>';
  scrollBottom(true);

  const historyForServer = sessionMessages.slice(0, -1);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        sessionId: currentSessionId,
        history: historyForServer,
      }),
      signal: currentAbort.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        let ev;
        try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }

        if (ev.t === 'start') {
          currentSessionId = ev.sessionId;
          if (activeChatId) {
            const chat = chats.find((c) => c.id === activeChatId);
            if (chat) chat.sessionId = ev.sessionId;
          }
          if (ev.mode === 'demo') { isDemo = true; demoChip.hidden = false; }
        } else if (ev.t === 'notice') {
          toast(ev.text, 'info', 6000);
        } else if (ev.t === 'token') {
          currentRaw += ev.v;
          scheduleFlush();
        } else if (ev.t === 'error') {
          currentRaw += `\n\n> ⚠ ${ev.message}\n`;
          scheduleFlush();
          toast(ev.message, 'error', 7000);
        } else if (ev.t === 'done') {
          // done — fallthrough to finalize
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      toast('Connection error: ' + err.message, 'error', 7000);
      if (aiShell && !currentRaw.trim()) {
        aiShell.bodyEl.innerHTML = '<p class="streaming-note">⚠ Could not reach the estimation service. Please check that the server is running and try again.</p>';
      }
    }
  } finally {
    finalizeStream(false);
  }
}

/* ============================================================ estimate actions (PDFs) */
function attachEstimateActions(shell, content, sessionId) {
  if (!shell) return;
  const actionsEl = shell.actionsEl;
  actionsEl.hidden = false;
  actionsEl.innerHTML = '';

  const mk = (label, cls, svg, onClick) => {
    const b = document.createElement('button');
    b.className = `action-btn ${cls}`;
    b.innerHTML = `${svg}<span>${label}</span>`;
    b.addEventListener('click', onClick);
    return b;
  };

  const internalBtn = mk(
    'Download Internal PDF', 'primary',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>',
    () => downloadPdf('internal', sessionId, internalBtn)
  );
  const clientBtn = mk(
    'Download Client Quotation PDF', 'green',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>',
    () => downloadPdf('client', sessionId, clientBtn)
  );
  const copyBtn = mk(
    'Copy', '',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    () => copyEstimate(content, copyBtn)
  );

  actionsEl.appendChild(internalBtn);
  actionsEl.appendChild(clientBtn);
  actionsEl.appendChild(copyBtn);
}

async function downloadPdf(mode, sessionId, btn) {
  if (!sessionId) { toast('This conversation is no longer linked to a live session. Please ask for a new estimate.', 'error'); return; }
  btn.disabled = true;
  try {
    const res = await fetch(`/api/pdf/${mode}?session=${encodeURIComponent(sessionId)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'PDF generation failed');
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="([^"]+)"/);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = m ? m[1] : `CalibiAI_${mode}_estimate.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(mode === 'internal' ? 'Internal PDF downloaded (confidential).' : 'Client quotation PDF downloaded.', 'success');
  } catch (err) {
    toast(err.message, 'error', 6000);
  } finally {
    btn.disabled = false;
  }
}

async function copyEstimate(content, btn) {
  try {
    await navigator.clipboard.writeText(content);
    toast('Estimate copied to clipboard.', 'success', 2500);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = content;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Estimate copied to clipboard.', 'success', 2500);
  }
}

/* ============================================================ composer behavior */
function autoResize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 190) + 'px';
}

inputEl.addEventListener('input', autoResize);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(inputEl.value);
  }
});
sendBtn.addEventListener('click', () => sendMessage(inputEl.value));
stopBtn.addEventListener('click', stopStreaming);
newChatBtn.addEventListener('click', newConversation);

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    sendMessage(chip.dataset.prompt);
  });
});

/* ============================================================ status on load */
(async () => {
  applyTheme(currentTheme());
  renderHistory();
  try {
    const res = await fetch('/api/status');
    const st = await res.json();
    modeChip.classList.add(st.demo ? 'demo' : 'live');
    modeText.textContent = st.demo
      ? 'Demo mode — no API key'
      : `Live — ${st.model || 'DeepSeek'} · streaming`;
    demoChip.hidden = !st.demo;
  } catch {
    modeChip.classList.add('demo');
    modeText.textContent = 'Server unreachable';
  }
})();
