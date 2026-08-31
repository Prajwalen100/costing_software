# CalibiAI Costing Agent

Internal pricing & proposal copilot for the **CalibiAI Pvt. Ltd.** BD team (Business Development Officers, Sales Executives, Founders, Project Managers).

Paste a client requirement in plain English → the agent performs the full commercial analysis automatically and streams back a **CalibiAI Commercial Estimate** with:

- Requirement analysis (business objective, functional & technical scope, complexity, assumptions, price-critical questions)
- Indian market benchmark + Pune competitive benchmark (clearly labelled estimates)
- **Basic / Recommended / Premium** packages
- Internal economics: delivery cost, gross profit, margin, negotiation price, absolute floor
- Included scope, exclusions, third-party costs, timeline, payment terms
- AMC opportunity (CalibiAI AI Care & Optimization) and upsells
- Sales positioning, negotiation guidance and a client-safe summary

Two branded PDFs can be downloaded for every estimate:

| PDF | Contains | Audience |
|---|---|---|
| **Internal PDF** | Full 18-section estimate incl. internal economics, floor price, negotiation strategy; watermarked "INTERNAL ONLY" | BDO / internal |
| **Client Quotation PDF** | Only client-safe sections (summary, solution, timeline, payment terms, client summary) — internal economics are **automatically stripped** | Client |

The agent streams its answer token-by-token (typewriter effect) via the **DeepSeek** streaming API.

---

## Quick start

```bash
npm install

# 1) Configure your DeepSeek API key
cp .env.example .env
# edit .env → DEEPSEEK_API_KEY=sk-...  (https://platform.deepseek.com/api_keys)

# 2) Run
npm start
# → http://localhost:3000
```

Without a key the app runs in **demo mode** and streams a canned example estimate, so the whole pipeline (chat → PDF) can be tested immediately.

### `.env` options

| Variable | Default | Purpose |
|---|---|---|
| `DEEPSEEK_API_KEY` | — | Your DeepSeek API key (live mode) |
| `DEEPSEEK_MODEL` | `deepseek-chat` | Model used for estimates |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | API base URL |
| `PORT` | `3000` | Server port |
| `UPSTREAM_TIMEOUT_MS` | `300000` (5 min) | Hard cap on waiting for the DeepSeek response |

---

## Features

- **Streaming chat UI** — branded, responsive; white (light) theme by default with a light/dark toggle; responses type out in real time
- **Markdown rendering** — headings, tables, lists, bold, inline code
- **Chat history** — recent conversations saved in the browser (localStorage)
- **Sample prompts** — one-click example requirements (chatbot, automation, training, outsourcing)
- **Estimate action bar** — appears automatically when an estimate is ready: Internal PDF, Client PDF, Copy
- **Stop generation** — abort a stream mid-response
- **Resilient streaming** — the DeepSeek request is never aborted by socket hiccups; heartbeats keep proxies from dropping idle connections, a hard timeout caps runaway requests, and failed generations show an inline **Retry** button
- **Demo mode banner** — clearly shows when no API key is configured
- **Auto-detected client name + estimate reference** (`CST-YYYYMMDD-XXXX`) on every PDF

## Project structure

```
costing_software/
├── server/
│   ├── index.js           # Express server: /api/chat (SSE), /api/pdf/:mode, /api/status
│   ├── systemPrompt.js    # The full CalibiAI commercial playbook (system prompt)
│   ├── pdf.js             # Branded PDF generator (internal + client modes)
│   └── demo.js            # Canned demo estimate used when no API key is set
├── shared/
│   └── mdToBlocks.js      # Shared markdown parser — used by BOTH the chat UI and the PDFs
│                          #   (screen and PDF always render the same content)
├── public/
│   ├── index.html         # Chat UI
│   ├── style.css          # White theme (default) + dark violet theme toggle
│   ├── app.js             # Client logic: SSE streaming, history, PDF downloads
│   ├── logo.png           # CalibiAI logo (used by web UI AND PDFs)
│   └── logo.svg           # Editable logo source
├── .env.example
└── package.json
```

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/chat` | POST | SSE stream. Body: `{ message, sessionId?, history?, retry? }`. Events: `start`, `notice`, `token`, `error`, `done`. Pass `retry: true` when re-sending the immediately-preceding message — the server won't duplicate it in history. |
| `/api/pdf/internal?session=<id>` | GET | Full internal estimate PDF (confidential) |
| `/api/pdf/client?session=<id>` | GET | Client-facing quotation PDF (internal data stripped) |
| `/api/status` | GET | `{ demo: true/false, model }` |

Sessions live in memory for 12 hours.

## Customizing

- **Logo** — replace `public/logo.png` (transparent PNG, ≈500×140 px recommended). The same file is used by the web UI and the PDF cover.
- **Pricing rules / rates / margins / playbook** — edit `server/systemPrompt.js`. Everything the agent knows about CalibiAI's commercial policy lives there.
- **Demo response** — `server/demo.js`.
- **PDF sections exposed to clients** — the filter in `server/pdf.js` (`filterClientBlocks`), currently sections 1, 2, 11, 12, 18. Keep internal economics out of it.

## Notes

- Requires Node.js ≥ 18 (uses global `fetch`).
- Streaming is deliberately resilient: if the browser disconnects mid-estimate (network blip, proxy timeout, tab close), the server finishes the generation in the background and saves the estimate to the session instead of failing it — this is what previously surfaced as `Estimation failed: This operation was aborted`. Clicking **Retry** re-runs the same request without duplicating the message.
- The PDF generator embeds the DejaVu fonts (found on most Linux systems) so the ₹ symbol renders correctly. If they are missing it falls back to pdfkit's built-in Unicode fonts (so PDFs never fail to generate); to get the ₹ glyph on non-Linux hosts, drop the TTFs into `assets/fonts/`.
- Internal economics, floor price and negotiation guidance are **never** included in the client-facing PDF.
