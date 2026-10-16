// UI-Bausteine ohne App-Zustand: Formatierung, Icons, Balken, Ring, Diagramme.
import { pkey, dkey, addDays } from './logic.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const fmt = (n, d = 0) => (n == null || !Number.isFinite(n) ? '–' : n.toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: 0 }));
export const fmtFixed = (n, d = 1) => (n == null || !Number.isFinite(n) ? '–' : n.toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: d }));
export const signed = (n, d = 1, unit = '') => (n == null ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmtFixed(Math.abs(n), d)}${unit}`);
export const pad = (n) => String(n).padStart(2, '0');
export const fmtSec = (s) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
export const fmtDur = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${pad(m % 60)} min` : `${m} min`; };
export const fmtClock = (ts) => new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
export const shortDate = (k) => pkey(k).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
export const longDate = (k) => pkey(k).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
export const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
export function relDay(k) {
  const t = dkey();
  if (k === t) return 'Heute';
  if (k === addDays(t, -1)) return 'Gestern';
  if (k === addDays(t, 1)) return 'Morgen';
  return pkey(k).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}
export const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;

// ---------- Icons (24er Raster, Linien) ----------
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  dumbbell: 'M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11',
  food: 'M6 3v6a2 2 0 0 0 4 0V3M8 11v10M17 21V3c-2.2 1.4-3 4-3 7.5h3',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12.01V12',
  sliders: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6 6 18',
  right: 'M9 6l6 6-6 6',
  left: 'M15 6l-6 6 6 6',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 1.5M9.5 2h5',
  scale: 'M5 21h14a2 2 0 0 0 2-2V8a5 5 0 0 0-5-5H8a5 5 0 0 0-5 5v11a2 2 0 0 0 2 2zM12 7.5v3M9 7.5h6',
  flame: 'M12 22c3.9 0 7-2.9 7-6.8 0-3.7-2.6-5.7-3.8-9.2-1.8 1.6-2.7 3.6-2.7 5.4-1-.8-1.8-2.2-2-4C8.2 9.4 5 12.4 5 15.2 5 19.1 8.1 22 12 22z',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5.5h3V7a3 3 0 0 1-3 3M7 5.5H4V7a3 3 0 0 0 3 3',
  camera: 'M3 8.5A2.5 2.5 0 0 1 5.5 6H7l2-3h6l2 3h1.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  barcode: 'M4 5v14M7 5v14M10.5 5v14M13 5v14M16.5 5v14M20 5v14',
  play: 'M7 4.5v15l12-7.5z',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  drop: 'M12 3.5s6 6.3 6 10.7a6 6 0 0 1-12 0C6 9.8 12 3.5 12 3.5z',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  pulse: 'M3 12h4l3-7 4 14 3-7h4',
  pill: 'M10.6 3.6a5 5 0 0 1 7.1 7.1l-7 7a5 5 0 0 1-7.1-7.1zM7.1 7.1l9.8 9.8',
  ruler: 'M3 16.5 16.5 3 21 7.5 7.5 21zM7.5 12.5l2 2M10.5 9.5l2 2M13.5 6.5l2 2',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  upload: 'M12 15V3M7 8l5-5 5 5M5 21h14',
  flag: 'M5 21V4M5 4h12l-2.5 4.5L17 13H5',
  book: 'M4 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4zM20 4.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h6z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
};
export const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[name] || ''}"/></svg>`;

// ---------- Fortschritt ----------
export function bar(v, max, { thick = false, over = true } = {}) {
  const pct = max > 0 ? Math.min(100, (v / max) * 100) : 0;
  return `<div class="bar ${thick ? 'thick' : ''} ${over && max > 0 && v > max * 1.05 ? 'over' : ''}"><i style="width:${pct.toFixed(1)}%"></i></div>`;
}
export const mrow = (label, v, max, unit = 'g') => `<div class="mrow"><div class="t"><span>${label}</span><span>${fmt(v)} / ${fmt(max)} ${unit}</span></div>${bar(v, max)}</div>`;
export const corners = () => '<i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i>';

// ---------- HUD-Ringe ----------
// Fortschritt animiert vom zuletzt gezeigten Wert zum neuen (kein erneutes Hochlaufen bei jedem Neuzeichnen).
const ringMemory = new Map();
const R_C = (r) => 2 * Math.PI * r;
function ticks(n, r1, r2, major = 5) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, big = i % major === 0;
    const ri = big ? r1 - 2 : r1;
    out += `<line class="${big ? 'tk big' : 'tk'}" x1="${(60 + ri * Math.cos(a)).toFixed(2)}" y1="${(60 + ri * Math.sin(a)).toFixed(2)}" x2="${(60 + r2 * Math.cos(a)).toFixed(2)}" y2="${(60 + r2 * Math.sin(a)).toFixed(2)}"/>`;
  }
  return out;
}
function arc(id, r, pct, cls, width) {
  const C = R_C(r), p = Math.max(0, Math.min(1, pct));
  const from = ringMemory.has(id) ? ringMemory.get(id) : 0;
  ringMemory.set(id, p);
  return `<circle class="trk" cx="60" cy="60" r="${r}" stroke-width="${width}"/>
    <circle class="arc ${cls}" cx="60" cy="60" r="${r}" stroke-width="${width}" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - from)).toFixed(2)}" data-off="${(C * (1 - p)).toFixed(2)}"/>`;
}
/** Segmentierter Ring (z. B. Einheiten pro Woche): filled von total Segmenten. */
function segments(r, total, filled, width) {
  if (!total) return `<circle class="trk" cx="60" cy="60" r="${r}" stroke-width="${width}"/>`;
  const C = R_C(r), gap = total > 1 ? 3.2 : 0, len = C / total - gap;
  let out = '';
  for (let i = 0; i < total; i++) out += `<circle class="seg ${i < filled ? 'on' : ''}" cx="60" cy="60" r="${r}" stroke-width="${width}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-(C / total) * i - gap / 2).toFixed(2)}" style="--i:${i}"/>`;
  return out;
}
/**
 * HUD-Ring. rings: [{id, pct, cls}] von außen nach innen, oder seg: {total, filled}.
 * center: HTML in der Mitte.
 */
export function hudRing({ rings = [], seg = null, center = '', size = 'md', label = '', over = false }) {
  const radii = [44, 36, 28];
  let g = `<circle class="hud-frame" cx="60" cy="60" r="58"/>${ticks(72, 53, 56, 6)}`;
  if (seg) g += segments(47, seg.total, seg.filled, 5);
  rings.forEach((r, i) => { g += arc(r.id, seg ? radii[i + 1] : radii[i] + 3, r.pct, r.cls || '', i === 0 && !seg ? 6 : 4); });
  return `<div class="hud ${size} ${over ? 'over' : ''}" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 120 120"><g transform="rotate(-90 60 60)">${g}</g></svg><div class="hud-c">${center}</div></div>`;
}
export function ring(v, max) {
  const pct = max > 0 ? v / max : 0;
  return hudRing({ rings: [{ id: 'kcal', pct, cls: v > max * 1.05 ? 'bad' : '' }], label: `${fmt(v)} von ${fmt(max)} kcal`,
    center: `<span class="hud-v">${fmt(Math.abs(max - v))}</span><span class="hud-l">${v > max ? 'kcal drüber' : 'kcal übrig'}</span>` });
}
/** Mini-Verlauf ohne Achsen (z. B. Gewicht der letzten 30 Tage). pts: [{x, y}] */
export function sparkline(pts, { h = 44, w = 140 } = {}) {
  if (pts.length < 2) return '';
  const ys = pts.map((p) => p.y), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const X = (i) => 2 + (i / (pts.length - 1)) * (w - 4), Y = (v) => 4 + (1 - (v - lo) / span) * (h - 8);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="spg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D4AF37" stop-opacity=".28"/><stop offset="1" stop-color="#D4AF37" stop-opacity="0"/></linearGradient></defs>
    <path d="${d}L${X(pts.length - 1).toFixed(1)},${h}L2,${h}Z" fill="url(#spg)"/><path class="sp-l" d="${d}"/><circle class="sp-d" cx="${X(pts.length - 1).toFixed(1)}" cy="${Y(last.y).toFixed(1)}" r="2.6"/></svg>`;
}
/** Mini-Säulen (z. B. Volumen pro Woche). values: Zahlen, letzte = aktuelle Periode. */
export function microBars(values, { h = 44 } = {}) {
  const max = Math.max(1, ...values);
  return `<div class="mbars" style="height:${h}px" aria-hidden="true">${values.map((v, i) => `<i class="${i === values.length - 1 ? 'cur' : ''}" style="height:${Math.max(v ? 8 : 3, (v / max) * 100)}%"></i>`).join('')}</div>`;
}
document.addEventListener('rendered', (e) => {
  const arcs = e.detail.root.querySelectorAll('.arc[data-off]');
  if (!arcs.length) return;
  requestAnimationFrame(() => requestAnimationFrame(() => arcs.forEach((a) => { a.style.strokeDashoffset = a.dataset.off; })));
});
export const mtxt = (m) => `<span class="mtxt"><b>${fmt(m.kcal)}</b> kcal · P ${fmt(m.p)} · K ${fmt(m.c)} · F ${fmt(m.f)}</span>`;
export const emptyCard = (ic, title, text, action = '') => `<div class="card empty-card">${icon(ic, 'lg')}<div style="font-weight:600;margin-bottom:4px">${title}</div><div class="empty">${text}</div>${action ? `<div class="mt">${action}</div>` : ''}</div>`;
export function delta(v, { d = 1, unit = ' kg', goodWhen = 'down' } = {}) {
  if (v == null) return '<span class="delta">–</span>';
  const good = Math.abs(v) < 0.05 ? null : goodWhen === 'down' ? v < 0 : goodWhen === 'up' ? v > 0 : null;
  return `<span class="delta ${good === true ? 'good' : good === false ? 'bad' : ''}">${signed(v, d, unit)}</span>`;
}

// ---------- Formulare ----------
export function formVals(root) {
  const o = {};
  root.querySelectorAll('[name]').forEach((el) => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
  return o;
}
/** Markiert ein Feld als ungültig und zeigt die Meldung. */
export function markInvalid(root, name, msg) {
  root.querySelectorAll('.invalid').forEach((e) => e.classList.remove('invalid'));
  root.querySelectorAll('.err').forEach((e) => e.remove());
  const el = root.querySelector(`[name="${name}"]`);
  if (!el) return;
  el.classList.add('invalid');
  const field = el.closest('.field') || el.parentElement;
  field.insertAdjacentHTML('afterend', `<div class="err">${esc(msg)}</div>`);
  el.focus();
}

// ---------- Diagramme ----------
// Punkte werden registriert, damit Antippen/Hover einen Tooltip mit dem echten Wert zeigt.
const charts = new Map();
let chartSeq = 0;
const W = 340;

/**
 * Liniendiagramm. series: [{pts:[{x:dateKey,y}], cls:'raw'|'main', dots?:bool, area?:bool}]
 * tip(point) → HTML für den Tooltip (Hauptserie = erste mit tip=true).
 */
export function lineChart(series, { h = 180, goal = null, goalLabel = 'Ziel', yFmt = (v) => fmt(v, 1), tip = null, zeroBased = false } = {}) {
  const all = series.flatMap((s) => s.pts);
  if (all.length < 2) return '';
  const id = 'c' + (++chartSeq);
  const pl = 38, pr = 10, pt = 12, pb = 24;
  const xs = all.map((p) => pkey(p.x).getTime());
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...all.map((p) => p.y)), y1 = Math.max(...all.map((p) => p.y));
  if (goal != null && goal >= y0 - (y1 - y0) * 0.6 && goal <= y1 + (y1 - y0) * 0.6) { y0 = Math.min(y0, goal); y1 = Math.max(y1, goal); }
  if (zeroBased) y0 = 0;
  if (y1 - y0 < 1) { y0 -= 0.5; y1 += 0.5; }
  const padY = (y1 - y0) * 0.12; if (!zeroBased) y0 -= padY; y1 += padY;
  const X = (k) => pl + (x1 === x0 ? 0.5 : (pkey(k).getTime() - x0) / (x1 - x0)) * (W - pl - pr);
  const Y = (v) => pt + (1 - (v - y0) / (y1 - y0)) * (h - pt - pb);
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  let g = `<defs><linearGradient id="goldFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D4AF37" stop-opacity=".22"/><stop offset="1" stop-color="#D4AF37" stop-opacity="0"/></linearGradient></defs>`;
  for (let i = 0; i <= 3; i++) {
    const v = y0 + ((y1 - y0) * i) / 3;
    g += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="axis" x="${pl - 7}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${yFmt(v)}</text>`;
  }
  const first = all.reduce((a, p) => (p.x < a ? p.x : a), all[0].x), last = all.reduce((a, p) => (p.x > a ? p.x : a), all[0].x);
  g += `<text class="axis" x="${pl}" y="${h - 6}">${shortDate(first)}</text><text class="axis" x="${W - pr}" y="${h - 6}" text-anchor="end">${shortDate(last)}</text>`;
  if (goal != null && goal >= y0 && goal <= y1) g += `<line class="goal" x1="${pl}" x2="${W - pr}" y1="${Y(goal).toFixed(1)}" y2="${Y(goal).toFixed(1)}"/><text class="goal-l" x="${W - pr}" y="${(Y(goal) - 5).toFixed(1)}" text-anchor="end">${esc(goalLabel)} ${yFmt(goal)}</text>`;
  for (const s of series) {
    if (s.pts.length < 1) continue;
    if (s.area && s.pts.length > 1) g += `<path class="area" d="${path(s.pts)}L${X(s.pts[s.pts.length - 1].x).toFixed(1)},${Y(y0).toFixed(1)}L${X(s.pts[0].x).toFixed(1)},${Y(y0).toFixed(1)}Z"/>`;
    if (s.pts.length > 1) g += `<path class="${s.cls || 'main'}" d="${path(s.pts)}"/>`;
    if (s.dots && s.pts.length <= 150) g += s.pts.map((p) => `<circle class="dot" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.4"/>`).join('');
  }
  const main = series.find((s) => s.tip) || series[0];
  if (main.pts.length) { const lp = main.pts[main.pts.length - 1]; g += `<circle class="endp" cx="${X(lp.x).toFixed(1)}" cy="${Y(lp.y).toFixed(1)}" r="4.5"/><circle class="endc" cx="${X(lp.x).toFixed(1)}" cy="${Y(lp.y).toFixed(1)}" r="9"/>`; }
  g += `<line class="cross hidden" y1="${pt}" y2="${h - pb}"/><circle class="hl hidden" r="5"/>`;
  charts.set(id, { pts: main.pts.map((p) => ({ cx: X(p.x), cy: Y(p.y), html: tip ? tip(p) : `<b>${yFmt(p.y)}</b> · ${shortDate(p.x)}` })), h, pt, pb });
  return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${h}" role="img">${g}</svg><div class="tip hidden"></div></div>`;
}

/** Säulendiagramm. items: [{label, value, tip, dim?}] */
export function barChart(items, { h = 150, yFmt = (v) => fmt(v) } = {}) {
  if (!items.length || items.every((i) => !i.value)) return '';
  const id = 'c' + (++chartSeq);
  const pl = 38, pr = 6, pt = 12, pb = 22;
  const max = Math.max(...items.map((i) => i.value)) * 1.12;
  const bw = (W - pl - pr) / items.length;
  const Y = (v) => pt + (1 - v / max) * (h - pt - pb);
  let g = '';
  for (let i = 0; i <= 2; i++) { const v = (max * i) / 2; g += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="axis" x="${pl - 7}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${yFmt(v)}</text>`; }
  const pts = [];
  items.forEach((it, i) => {
    const x = pl + i * bw + bw * 0.18, w = bw * 0.64, y = Y(it.value), hh = Math.max(0, h - pb - y);
    if (hh > 0) g += `<path class="barm ${it.dim ? 'dim' : ''}" d="M${x.toFixed(1)},${(h - pb).toFixed(1)}V${(y + Math.min(4, hh)).toFixed(1)}q0,-4 4,-4h${(w - 8).toFixed(1)}q4,0 4,4V${(h - pb).toFixed(1)}Z"/>`;
    g += `<text class="axis" x="${(x + w / 2).toFixed(1)}" y="${h - 6}" text-anchor="middle">${esc(it.label)}</text>`;
    pts.push({ cx: x + w / 2, cy: y, html: it.tip });
  });
  g += `<line class="cross hidden" y1="${pt}" y2="${h - pb}"/><circle class="hl hidden" r="0"/>`;
  charts.set(id, { pts, h, pt, pb });
  return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${h}" role="img">${g}</svg><div class="tip hidden"></div></div>`;
}

export function resetCharts() { charts.clear(); }

function chartPointer(e) {
  const el = e.target.closest('.chart');
  if (!el) return;
  const c = charts.get(el.dataset.chart);
  if (!c || !c.pts.length) return;
  const svg = el.querySelector('svg');
  const r = svg.getBoundingClientRect();
  const vx = ((e.clientX - r.left) / r.width) * W;
  let best = c.pts[0];
  for (const p of c.pts) if (Math.abs(p.cx - vx) < Math.abs(best.cx - vx)) best = p;
  const cross = svg.querySelector('.cross'), hl = svg.querySelector('.hl'), tipEl = el.querySelector('.tip');
  cross.setAttribute('x1', best.cx); cross.setAttribute('x2', best.cx); cross.classList.remove('hidden');
  hl.setAttribute('cx', best.cx); hl.setAttribute('cy', best.cy); hl.classList.remove('hidden');
  tipEl.innerHTML = best.html;
  tipEl.classList.remove('hidden');
  const px = (best.cx / W) * r.width;
  const half = tipEl.offsetWidth / 2;
  tipEl.style.left = `${Math.min(r.width - half, Math.max(half, px))}px`;
  tipEl.style.top = `${Math.max(-8, (best.cy / c.h) * r.height - tipEl.offsetHeight - 12)}px`;
}
function chartLeave(e) {
  const el = e.target.closest && e.target.closest('.chart');
  if (!el) return;
  el.querySelector('.tip')?.classList.add('hidden');
  el.querySelector('.cross')?.classList.add('hidden');
  el.querySelector('.hl')?.classList.add('hidden');
}
export function bindCharts() {
  document.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') chartPointer(e); });
  document.addEventListener('pointerdown', chartPointer);
  document.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse' && !e.relatedTarget?.closest?.('.chart')) chartLeave(e); });
}
