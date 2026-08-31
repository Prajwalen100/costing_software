import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runsToText } from '../shared/mdToBlocks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------- fonts & logo
function findFontFile(name) {
  const candidates = [
    path.join('/usr/share/fonts/truetype/dejavu', name),
    path.join('/usr/share/fonts', name),
    path.join('/usr/local/share/fonts', name),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Fonts', name),
    path.join(process.env.WINDIR || '', 'Fonts', name),
    path.join('/Library/Fonts', name),
    path.join('/System/Library/Fonts', name),
    path.join(ROOT, 'assets', 'fonts', name),
  ];
  for (const p of candidates) if (p && fs.existsSync(p)) return p;
  return null;
}

const SANS = findFontFile('DejaVuSans.ttf');
const SANS_BOLD = findFontFile('DejaVuSans-Bold.ttf');
const MONO = findFontFile('DejaVuSansMono.ttf');

// Font names used by the document. If the DejaVu TTFs are not installed on the
// host (common on Windows/macOS), fall back to pdfkit's always-available
// built-in fonts so PDF generation never crashes with an "ENOENT" font error.
const FONT_REGULAR = SANS ? 'Sans' : 'Helvetica';
const FONT_BOLD = SANS_BOLD ? 'SansB' : 'Helvetica-Bold';
const FONT_MONO = MONO ? 'Mono' : 'Courier';

let LOGO = null;
try {
  const logoPath = path.join(ROOT, 'public', 'logo.png');
  if (fs.existsSync(logoPath)) LOGO = fs.readFileSync(logoPath);
} catch { /* logo optional */ }

// ---------------------------------------------------------------- palette & layout
const C = {
  primary: '#6D28D9',
  primaryDark: '#4C1D95',
  ink: '#1F2430',
  slate: '#55607A',
  muted: '#8A93A8',
  border: '#E3E0F0',
  fillAlt: '#F4F1FD',
  danger: '#B91C1C',
  white: '#FFFFFF',
};

const W = 595.28; // A4 width
const H = 841.89; // A4 height
const ML = 46, MR = 46, MT = 44;
const MB_CONTENT = 64;    // content never goes below H - MB_CONTENT
const CW = W - ML - MR;

const fmtDate = (d) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);

const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// ---------------------------------------------------------------- main export
export function blocksToPdf(blocks, { mode = 'internal', meta = {} } = {}) {
  return new Promise((resolve, reject) => {
    // bottom margin is small so page.maxY() (pdfkit's auto-page-break threshold) sits BELOW the
    // footer text zone; content is manually limited to H - MB_CONTENT via ensureSpace().
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MT, left: ML, bottom: 30, right: MR },
      info: {
        Title: `${meta.title || 'Commercial Estimate'} (${mode === 'client' ? 'Client Quotation' : 'Internal'})`,
        Author: 'CalibiAI Pvt. Ltd.',
        Creator: 'CalibiAI Costing Agent',
      },
    });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (SANS) doc.registerFont('Sans', SANS);
    if (SANS_BOLD) doc.registerFont('SansB', SANS_BOLD);
    if (MONO) doc.registerFont('Mono', MONO);
    doc.font(FONT_REGULAR).fontSize(10).fillColor(C.ink);

    // ------------------------------------------------------------ state
    let pageNum = 1;
    const ctx = {
      y: MT,
      ensureSpace(h) {
        if (this.y + h > H - MB_CONTENT) {
          drawFooter(doc, pageNum, mode);
          doc.addPage();
          pageNum += 1;
          this.y = MT;
          // slim continuation header
          doc.font(FONT_REGULAR).fontSize(7.5).fillColor(C.muted);
          doc.text(
            mode === 'internal' ? 'CalibiAI — Internal Commercial Estimate (continued)' : 'CalibiAI — Proposal & Quotation (continued)',
            ML, 24, { width: CW, align: 'right', lineBreak: false }
          );
          this.y = MT + 4;
          return true;
        }
        return false;
      },
    };

    doc.on('pageAdded', () => drawWatermark(doc, mode));

    // ------------------------------------------------------------ cover
    drawCoverHeader(doc, meta, mode, ctx);

    // ------------------------------------------------------------ content
    const content = mode === 'client' ? filterClientBlocks(blocks) : blocks;
    for (const b of content) renderBlock(doc, b, ctx);

    // ------------------------------------------------------------ closing (client mode)
    if (mode === 'client') {
      ctx.ensureSpace(70);
      ctx.y += 8;
      doc.moveTo(ML, ctx.y).lineTo(W - MR, ctx.y).strokeColor(C.border).lineWidth(0.8).stroke();
      ctx.y += 16;
      doc.font(FONT_BOLD).fontSize(10).fillColor(C.primaryDark);
      doc.text('Prepared by CalibiAI Pvt. Ltd. — AI Costing Agent', ML, ctx.y, { lineBreak: false });
      ctx.y += 14;
      doc.font(FONT_REGULAR).fontSize(8.5).fillColor(C.slate);
      doc.text(
        'This quotation is indicative and valid for 30 days from the date above. Third-party and usage-based charges are billed separately at actuals.',
        ML, ctx.y, { width: CW, lineGap: 2, lineBreak: false }
      );
    }

    drawFooter(doc, pageNum, mode);
    doc.end();
  });
}

// ---------------------------------------------------------------- page furniture
function drawCoverHeader(doc, meta, mode, ctx) {
  // brand row
  if (LOGO) {
    doc.image(LOGO, ML, MT - 10, { height: 40 });
  } else {
    doc.font(FONT_BOLD).fontSize(20).fillColor(C.primary);
    doc.text('CalibiAI', ML, MT - 4, { lineBreak: false });
    doc.font(FONT_REGULAR).fontSize(8).fillColor(C.muted);
    doc.text('AI COSTING AGENT', ML, MT + 20, { lineBreak: false });
  }
  ctx.y = MT + 44;

  // title band
  doc.roundedRect(ML, ctx.y, CW, 30, 6).fill(mode === 'client' ? C.primary : C.primaryDark);
  doc.fillColor(C.white).font(FONT_BOLD).fontSize(13);
  doc.text(
    mode === 'client' ? 'PROPOSAL & COMMERCIAL QUOTATION' : 'CALIBIAI COMMERCIAL ESTIMATE',
    ML + 12, ctx.y + 9, { width: CW - 24, lineBreak: false }
  );
  if (mode === 'internal') {
    doc.font(FONT_BOLD).fontSize(8).fillColor('#FCA5A5');
    doc.text('INTERNAL ONLY — CONFIDENTIAL', ML, ctx.y + 11, { width: CW - 24, align: 'right', lineBreak: false });
  }
  ctx.y += 42;

  // meta grid
  const rows = [
    ['Date', fmtDate(new Date())],
    ['Estimate Ref', meta.ref || '—'],
    ['Client', meta.client || 'To be confirmed'],
    ['Prepared By', 'CalibiAI BD Team'],
  ];
  if (mode === 'client') rows.push(['Valid Until', fmtDate(addDays(new Date(), 30))]);
  const colX = [ML, ML + 258];
  let row = 0;
  for (const [label, value] of rows) {
    const x = colX[row % 2];
    const y = ctx.y + Math.floor(row / 2) * 34;
    doc.font(FONT_BOLD).fontSize(7).fillColor(C.muted);
    doc.text(label.toUpperCase(), x, y, { width: 240, lineBreak: false });
    doc.font(FONT_REGULAR).fontSize(9.5).fillColor(C.ink);
    doc.text(String(value), x, y + 10, { width: 240, lineBreak: false });
    row++;
  }
  ctx.y += Math.ceil(rows.length / 2) * 34 + 4;

  doc.moveTo(ML, ctx.y).lineTo(W - MR, ctx.y).strokeColor(C.primary).lineWidth(1.2).stroke();
  ctx.y += 18;
}

function drawWatermark(doc, mode) {
  if (mode !== 'internal') return;
  doc.save();
  doc.translate(W / 2 - 150, H / 2);
  doc.rotate(28);
  doc.font(FONT_BOLD).fontSize(30).fillColor(C.danger).fillOpacity(0.05);
  doc.text('INTERNAL — NOT FOR CLIENT DISTRIBUTION', 0, 0, { lineBreak: false });
  doc.restore();
}

function drawFooter(doc, pageNum, mode) {
  const fy = H - 34;
  doc.moveTo(ML, fy - 12).lineTo(W - MR, fy - 12).strokeColor(C.border).lineWidth(0.7).stroke();
  doc.font(FONT_REGULAR).fontSize(7.5).fillColor(C.muted);
  doc.text(mode === 'internal' ? 'CalibiAI Pvt. Ltd.' : 'CalibiAI Pvt. Ltd. — AI Costing Agent',
    ML, fy - 7, { width: 150, lineBreak: false });
  doc.text(`Page ${pageNum}`, ML, fy - 7, { width: CW, align: 'right', lineBreak: false });
  if (mode === 'internal') {
    doc.font(FONT_BOLD).fontSize(7.5).fillColor(C.danger);
    doc.text('INTERNAL & CONFIDENTIAL — DO NOT SHARE WITH CLIENT', ML, fy - 7, { width: CW, align: 'center', lineBreak: false });
  }
}

// Client-facing PDF keeps only client-safe sections: 1, 2, 11, 12, 18.
// Section headings are rewritten into client-friendly titles and renumbered
// sequentially (1..5), so the client never sees gaps like "11." or "18."
const CLIENT_SECTIONS = new Map([
  [1, 'Project Overview'],
  [2, 'Proposed Solution'],
  [11, 'Delivery Timeline'],
  [12, 'Payment Terms'],
  [18, 'Proposal Summary'],
]);

export function filterClientBlocks(blocks) {
  const out = [];
  let cur = null;
  let n = 0;
  for (const b of blocks) {
    if (b.type === 'h' && b.level === 1) { cur = null; continue; }
    if (b.type === 'h' && b.level === 2) {
      const m = runsToText(b.runs).match(/^\s*(\d+)\./);
      cur = m ? Number(m[1]) : 99;
      if (CLIENT_SECTIONS.has(cur)) {
        n += 1;
        out.push({ type: 'h', level: 2, runs: [{ t: 'text', v: `${n}. ${CLIENT_SECTIONS.get(cur)}` }] });
      }
      continue;
    }
    if (cur !== null && CLIENT_SECTIONS.has(cur)) out.push(b);
  }
  return out;
}

// ---------------------------------------------------------------- wrapping helper
function wrapLines(doc, text, width, fontSize) {
  doc.fontSize(fontSize);
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const trial = cur ? cur + ' ' + word : word;
    if (doc.widthOfString(trial) <= width) { cur = trial; continue; }
    if (cur) { lines.push(cur); cur = ''; }
    let wd = word;
    while (doc.widthOfString(wd) > width) {
      let k = wd.length;
      while (k > 1 && doc.widthOfString(wd.slice(0, k)) > width) k--;
      lines.push(wd.slice(0, k));
      wd = wd.slice(k);
    }
    cur = wd;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [' '];
}

// ---------------------------------------------------------------- block renderers
function renderBlock(doc, b, ctx) {
  switch (b.type) {
    case 'h': return renderHeading(doc, b, ctx);
    case 'hr': {
      ctx.y += 4;
      doc.moveTo(ML, ctx.y).lineTo(W - MR, ctx.y).strokeColor(C.border).lineWidth(0.7).stroke();
      ctx.y += 10;
      return;
    }
    case 'p': return renderPara(doc, b, ctx);
    case 'list': return renderList(doc, b, ctx);
    case 'table': return renderTable(doc, b, ctx);
    default: return;
  }
}

function renderHeading(doc, b, ctx) {
  if (b.level === 1) return; // the cover band already carries the title
  if (b.level === 2) {
    const text = runsToText(b.runs);
    // keep a heading with at least the first couple of lines of its section
    ctx.ensureSpace(78);
    doc.rect(ML, ctx.y + 3, 3, 12).fill(C.primary);
    doc.font(FONT_BOLD).fontSize(12).fillColor(C.primaryDark);
    const lines = wrapLines(doc, text, CW - 12, 12);
    lines.forEach((ln, i) => {
      if (i > 0) ctx.ensureSpace(18);
      doc.text(ln, ML + 11, ctx.y + 1, { lineBreak: false });
      ctx.y += 16;
    });
    ctx.y += 9;
  } else {
    const text = runsToText(b.runs);
    ctx.ensureSpace(62);
    ctx.y += 4;
    doc.font(FONT_BOLD).fontSize(10).fillColor(C.primary);
    const lines = wrapLines(doc, text, CW, 10);
    lines.forEach((ln, i) => {
      if (i > 0) ctx.ensureSpace(15);
      doc.text(ln, ML, ctx.y, { lineBreak: false });
      ctx.y += 13;
    });
    ctx.y += 5;
  }
}

function renderPara(doc, b, ctx) {
  if (!(b.runs || []).some((r) => String(r.v || '').trim())) { ctx.y += 6; return; }
  const lh = 14;
  ctx.ensureSpace(lh);
  drawRuns(doc, b.runs, ctx, { x: ML, width: CW, fontSize: 9.8, lh });
  ctx.y += 6;
}

function renderList(doc, b, ctx) {
  let n = 1;
  for (const item of b.items) {
    const marker = b.ordered ? `${n}.` : '•';
    const markerW = b.ordered ? 16 : 12;
    const bodyX = ML + markerW + 2;
    const bodyW = CW - markerW - 2;
    const fontSize = 9.8;
    const lh = 14;

    ctx.ensureSpace(lh + 2);
    if (b.ordered) {
      doc.font(FONT_BOLD).fontSize(fontSize).fillColor(C.primaryDark);
      doc.text(marker, ML, ctx.y, { lineBreak: false });
    } else {
      doc.font(FONT_BOLD).fontSize(fontSize).fillColor(C.primary);
      doc.text(marker, ML + 2, ctx.y, { lineBreak: false });
    }
    drawRuns(doc, item, ctx, { x: bodyX, width: bodyW, fontSize, lh });
    ctx.y += 3.5;
    n++;
  }
  ctx.y += 3;
}

// Draws inline runs (bold / italic / code) with word wrapping inside a column.
// Advances ctx.y to just below the last line drawn.
function drawRuns(doc, runs, ctx, { x: startX, width, fontSize, lh }) {
  const words = [];
  for (const r of runs || []) {
    const font = r.t === 'bold' ? FONT_BOLD : r.t === 'code' ? FONT_MONO : FONT_REGULAR;
    const col = r.t === 'code' ? '#3B2E6B' : r.t === 'bold' ? C.ink : C.ink;
    for (const w of String(r.v ?? '').split(/\s+/).filter(Boolean)) words.push({ w, font, col });
  }
  if (!words.length) { ctx.y += lh; return; }

  const gap = 2.5;
  let x = startX;
  let lineY = ctx.y;
  for (const word of words) {
    doc.font(word.font).fontSize(fontSize);
    const wW = doc.widthOfString(word.w) + gap;
    if (x + wW > startX + width && x > startX + 1) {
      x = startX;
      lineY += lh;
      if (lineY + lh > H - MB_CONTENT) {
        ctx.y = lineY;
        ctx.ensureSpace(lh);
        lineY = ctx.y;
      }
    }
    doc.fillColor(word.col);
    doc.text(word.w, x, lineY, { lineBreak: false });
    x += wW;
  }
  ctx.y = lineY + lh;
}

function renderTable(doc, b, ctx) {
  const header = b.header.map((h) => runsToText(h.runs));
  const rows = b.rows.map((r) => r.map((c) => runsToText(c.runs)));
  const nCols = header.length;
  const all = [header, ...rows];

  const pad = 6;
  // header cells and (in key/value tables) the first column are drawn bold — measure them
  // with the bold font, otherwise long labels get clipped instead of wrapped.
  const cellFont = (rowIdx, c) => (rowIdx === 0 || (nCols === 2 && c === 0) ? FONT_BOLD : FONT_REGULAR);
  const natural = [];
  for (let c = 0; c < nCols; c++) {
    let w = 20;
    all.forEach((row, ri) => {
      if (c >= row.length) return;
      doc.font(cellFont(ri, c)).fontSize(8.8);
      w = Math.max(w, doc.widthOfString(row[c] || ''));
    });
    natural.push(w + pad * 2);
  }
  doc.font(FONT_REGULAR).fontSize(8.8);
  const total = natural.reduce((a, v) => a + v, 0);
  let widths;
  if (nCols === 2) {
    // key/value tables (Commercial Summary, Payment Terms...) read best with a
    // narrow, fixed label column and the rest of the width given to the value.
    const label = Math.min(Math.max(natural[0], CW * 0.26), CW * 0.36);
    widths = [label, CW - label];
  } else if (total <= CW) {
    const extra = (CW - total) / nCols;
    widths = natural.map((w) => w + extra);
  } else {
    const s = CW / total;
    widths = natural.map((w) => Math.max(28, w * s));
  }

  const cellLines = all.map((row, ri) => row.map((cell, c) => {
    doc.font(cellFont(ri, c));
    return wrapLines(doc, cell, widths[c] - pad * 2, 8.8);
  }));
  const lh = 10.6;
  const vpad = 5;
  const rowH = (linesArr) => Math.max(...linesArr.map((l) => l.length)) * lh + vpad * 2;

  const drawRowCells = (linesArr, isHeader, rowIndex) => {
    const h = rowH(linesArr);
    ctx.ensureSpace(h + 6);
    let x = ML;
    for (let c = 0; c < nCols; c++) {
      if (isHeader) {
        doc.rect(x, ctx.y, widths[c], h).fill(C.primary);
        doc.fillColor(C.white).font(FONT_BOLD).fontSize(8.8);
      } else {
        doc.rect(x, ctx.y, widths[c], h).fill(rowIndex % 2 === 0 ? C.fillAlt : C.white);
        const labelCol = nCols === 2 && c === 0;
        doc.fillColor(labelCol ? C.primaryDark : C.ink)
          .font(labelCol ? FONT_BOLD : FONT_REGULAR)
          .fontSize(8.8);
      }
      const lines = linesArr[c] || [' '];
      lines.forEach((ln, li) => {
        doc.text(ln, x + pad - 1, ctx.y + vpad + li * lh, { lineBreak: false });
      });
      doc.rect(x, ctx.y, widths[c], h).stroke(C.border);
      x += widths[c];
    }
    ctx.y += h;
  };

  drawRowCells(cellLines[0], true, 0);
  for (let ri = 0; ri < rows.length; ri++) {
    const h = rowH(cellLines[ri + 1]);
    const newPage = ctx.ensureSpace(h + 6);
    if (newPage) drawRowCells(cellLines[0], true, 0);
    drawRowCells(cellLines[ri + 1], false, ri);
  }
  ctx.y += 8;
}
