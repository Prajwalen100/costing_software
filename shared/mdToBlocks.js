// Shared markdown parsing used by BOTH the browser chat UI and the server-side PDF generator,
// so the on-screen estimate and the downloaded PDF are rendered from the exact same content.

export function parseInline(text) {
  const runs = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ t: 'text', v: text.slice(last, m.index) });
    if (m[2] != null || m[3] != null) runs.push({ t: 'bold', v: m[2] ?? m[3] });
    else if (m[4] != null) runs.push({ t: 'italic', v: m[4] });
    else if (m[5] != null) runs.push({ t: 'code', v: m[5] });
    else if (m[6] != null) runs.push({ t: 'link', v: m[6], href: m[7] });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ t: 'text', v: text.slice(last) });
  return runs;
}

const isHeading = (t) => /^#{1,4}\s/.test(t);
const isHr = (t) => /^(-{3,}|\*{3,}|_{3,})\s*$/.test(t);
const isBullet = (t) => /^\s*[-*+]\s+/.test(t);
const isNumbered = (t) => /^\s*\d+[.)]\s+/.test(t);

export function mdToBlocks(md) {
  const src = String(md ?? '').replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i++; continue; }

    if (isHeading(t)) {
      const level = (t.match(/^#+/) || ['#'])[0].length;
      blocks.push({ type: 'h', level, runs: parseInline(t.replace(/^#+\s*/, '')) });
      i++;
      continue;
    }

    if (isHr(t)) { blocks.push({ type: 'hr' }); i++; continue; }

    if (t.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim()); i++; }
      if (rows.length >= 2) {
        const split = (r) => r.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
        const header = split(rows[0]);
        const body = rows.slice(1).filter((r) => !/^[\s|:\-]+$/.test(r)).map(split);
        if (body.length) {
          blocks.push({
            type: 'table',
            header: header.map((h) => ({ runs: parseInline(h) })),
            rows: body.map((r) => r.map((c) => ({ runs: parseInline(c) }))),
          });
        }
      }
      continue;
    }

    if (isBullet(t)) {
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*[-*+]\s+(.*)$/);
        if (!m) break;
        items.push(parseInline(m[1]));
        i++;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    if (isNumbered(t)) {
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*\d+[.)]\s+(.*)$/);
        if (!m) break;
        items.push(parseInline(m[1]));
        i++;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // paragraph: accumulate until a blank line or a special line
    const para = [];
    while (i < lines.length) {
      const t2 = lines[i].trim();
      if (!t2) break;
      if (isHeading(t2) || t2.startsWith('|') || isHr(t2) || isBullet(t2) || isNumbered(t2)) break;
      para.push(lines[i].trimEnd());
      i++;
    }
    if (para.length) blocks.push({ type: 'p', runs: parseInline(para.join(' ')) });
    else i++;
  }

  return blocks;
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function runsToHtml(runs) {
  return (runs || [])
    .map((r) => {
      switch (r.t) {
        case 'bold': return `<strong>${esc(r.v)}</strong>`;
        case 'italic': return `<em>${esc(r.v)}</em>`;
        case 'code': return `<code>${esc(r.v)}</code>`;
        case 'link': {
          const href = /^https?:\/\//i.test(r.href || '') ? r.href : '#';
          return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(r.v)}</a>`;
        }
        default: return esc(r.v);
      }
    })
    .join('');
}

export function blocksToHtml(blocks) {
  return (blocks || [])
    .map((b) => {
      switch (b.type) {
        case 'h': return `<h${b.level}>${runsToHtml(b.runs)}</h${b.level}>`;
        case 'hr': return '<hr>';
        case 'p': return `<p>${runsToHtml(b.runs)}</p>`;
        case 'list': {
          const tag = b.ordered ? 'ol' : 'ul';
          return `<${tag}>${b.items.map((it) => `<li>${runsToHtml(it)}</li>`).join('')}</${tag}>`;
        }
        case 'table': {
          const th = b.header.map((h) => `<th>${runsToHtml(h.runs)}</th>`).join('');
          const trs = b.rows.map((r) => `<tr>${r.map((c) => `<td>${runsToHtml(c.runs)}</td>`).join('')}</tr>`).join('');
          return `<div class="tbl-wrap"><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
        }
        default: return '';
      }
    })
    .join('');
}

export function runsToText(runs) {
  return (runs || []).map((r) => r.v ?? '').join('');
}
