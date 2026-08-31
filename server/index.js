import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { mdToBlocks } from '../shared/mdToBlocks.js';
import { blocksToPdf } from './pdf.js';
import { DEMO_RESPONSE } from './demo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------- config
function loadEnvFile() {
  const p = path.join(ROOT, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnvFile();

const PORT = Number(process.env.PORT) || 3000;
const DEEPSEEK_API_KEY = (process.env.DEEPSEEK_API_KEY || '').trim();
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const DEMO = !DEEPSEEK_API_KEY;

if (DEMO) {
  console.log('[CalibiAI] ⚠  No DEEPSEEK_API_KEY found — running in DEMO mode (canned example stream).');
  console.log('[CalibiAI]    Copy .env.example to .env and set your key to enable live DeepSeek estimates.');
} else {
  console.log(`[CalibiAI] ✓ Live mode — model: ${DEEPSEEK_MODEL} @ ${DEEPSEEK_BASE_URL}`);
}

// ---------------------------------------------------------------- app
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/shared', express.static(path.join(ROOT, 'shared')));

const sessions = new Map();
const SESSION_TTL = 12 * 3600 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.updatedAt > SESSION_TTL) sessions.delete(id);
}, 30 * 60 * 1000).unref();

function newSession() {
  const id = crypto.randomBytes(6).toString('hex');
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const s = {
    id,
    ref: `CST-${ymd}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    history: [],
    lastEstimate: null,
    title: null,
    clientName: null,
  };
  sessions.set(id, s);
  return s;
}

const deriveTitle = (msg) => String(msg || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'New estimate';

function detectClientName(userTexts) {
  const all = userTexts.join('\n');
  const patterns = [
    /(?:client|company|brand)(?:\s+name)?\s*(?:is|:|-|—)\s*"?([A-Za-z0-9&.'\- ]{2,40}?)"?\s*[,.;]?(?:\n|$)/i,
    /\b([A-Z][A-Za-z0-9&'\-]{2,29}?\s+(?:Pvt\.?\s*Ltd\.?|Ltd\.?|LLP|LLC|Inc\.?|Corp\.?))\b/,
    /(?:for|to)\s+([A-Z][A-Za-z0-9&.'\- ]{2,40}?)[,.\n:]/,
  ];
  for (const re of patterns) {
    const m = all.match(re);
    if (m && m[1] && m[1].trim().length > 1) return m[1].trim();
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sse = (res, obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

async function streamDeepSeek(messages, onToken, signal) {
  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      stream: true,
      temperature: 0.35,
      max_tokens: 6000,
    }),
    signal,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`DeepSeek API ${res.status}: ${errText.slice(0, 200)}`);
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
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content ?? '';
        if (delta) onToken(delta);
      } catch { /* partial chunk — ignore */ }
    }
  }
}

// ---------------------------------------------------------------- API: status
app.get('/api/status', (req, res) => {
  res.json({ demo: DEMO, model: DEMO ? null : DEEPSEEK_MODEL });
});

// ---------------------------------------------------------------- API: chat (SSE streaming)
app.post('/api/chat', async (req, res) => {
  const { message, sessionId, history } = req.body || {};
  const text = String(message || '').trim();
  if (!text) return res.status(400).json({ error: 'Message is required.' });

  let session = sessionId ? sessions.get(sessionId) : null;
  if (!session) {
    session = newSession();
    if (Array.isArray(history) && history.length) {
      for (const h of history) {
        if ((h?.role === 'user' || h?.role === 'assistant') && typeof h.content === 'string' && h.content.trim()) {
          session.history.push({ role: h.role, content: h.content.slice(0, 20000) });
        }
      }
    }
  }

  const userTexts = [...session.history.filter((h) => h.role === 'user').map((h) => h.content), text];
  const client = detectClientName(userTexts);
  if (client) session.clientName = client;
  if (!session.title) session.title = deriveTitle(text);

  session.history.push({ role: 'user', content: text });
  session.updatedAt = Date.now();

  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  sse(res, { t: 'start', sessionId: session.id, mode: DEMO ? 'demo' : 'live', ref: session.ref });

  let full = '';
  try {
    if (DEMO) {
      sse(res, {
        t: 'notice',
        text: 'Demo mode — no DEEPSEEK_API_KEY configured. Add your key in .env for live DeepSeek estimates.',
      });
      const tokens = DEMO_RESPONSE.match(/\S+\s*/g) || [DEMO_RESPONSE];
      for (const tok of tokens) {
        if (res.writableEnded) break;
        full += tok;
        sse(res, { t: 'token', v: tok });
        await sleep(16);
      }
    } else {
      const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...session.history.slice(-14)];
      const ac = new AbortController();
      // Use the RESPONSE stream's close event to detect a real client disconnect.
      // `req.on('close')` fires as soon as the POST body has been parsed (in live mode
      // that aborts the DeepSeek request immediately → "This operation was aborted").
      res.on('close', () => ac.abort());
      await streamDeepSeek(
        messages,
        (tok) => {
          full += tok;
          if (!res.writableEnded) sse(res, { t: 'token', v: tok });
        },
        ac.signal
      );
    }
  } catch (err) {
    console.error('[CalibiAI] chat error:', err.message);
    if (!res.writableEnded) {
      sse(res, { t: 'error', message: `Estimation failed: ${err.message}. Please try again.` });
    }
  }

  if (full.trim()) {
    session.history.push({ role: 'assistant', content: full });
    if (full.includes('# CALIBIAI COMMERCIAL ESTIMATE')) session.lastEstimate = full;
    session.updatedAt = Date.now();
  }
  if (!res.writableEnded) sse(res, { t: 'done', sessionId: session.id });
  res.end();
});

// ---------------------------------------------------------------- API: PDF download
app.get('/api/pdf/:mode', async (req, res) => {
  const { mode } = req.params;
  if (!['internal', 'client'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid PDF mode.' });
  }
  const session = sessions.get(String(req.query.session || ''));
  if (!session?.lastEstimate) {
    return res.status(404).json({ error: 'No estimate available for this conversation yet. Ask the agent for a quotation first.' });
  }

  try {
    const blocks = mdToBlocks(session.lastEstimate);
    const meta = {
      title: session.title || 'Commercial Estimate',
      client: session.clientName || 'To be confirmed',
      ref: session.ref,
    };
    const pdf = await blocksToPdf(blocks, { mode, meta });

    const d = new Date();
    const ymd = d.toISOString().slice(0, 10);
    const safe = (s) => String(s || '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    const fname =
      mode === 'internal'
        ? `CalibiAI_Internal_Estimate_${ymd}.pdf`
        : `CalibiAI_Quotation_${safe(session.clientName) || 'Client'}_${ymd}.pdf`;

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(pdf);
  } catch (err) {
    console.error('[CalibiAI] pdf error:', err);
    res.status(500).json({ error: `PDF generation failed: ${err.message}` });
  }
});

// ---------------------------------------------------------------- 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[CalibiAI] Costing Agent running at http://localhost:${PORT}`);
});
