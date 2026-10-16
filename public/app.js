'use strict';
/* FIT – privater Fitness-Tracker. Alles lokal: Daten in localStorage, Fotos in IndexedDB. */

// ---------- Helpers ----------
const KEY = 'fit-state-v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pkey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = pkey(k); d.setDate(d.getDate() + n); return dkey(d); };
const num = (v, def = 0) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : def; };
const r0 = (n) => Math.round(n);
const r1 = (n) => Math.round(n * 10) / 10;
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '–');
const fmtSec = (s) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
const fmtDur = (ms) => { const m = Math.floor(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SLOTS = ['Frühstück', 'Mittagessen', 'Abendessen', 'Snacks'];
const MEAS = [['waist', 'Bauch'], ['hip', 'Hüfte'], ['chest', 'Brust'], ['arm', 'Arm'], ['thigh', 'Oberschenkel']];
const CARDIO = ['Gehen', 'Laufen', 'Radfahren', 'Crosstrainer', 'Stepper', 'Rudern', 'Schwimmen', 'Sonstiges'];

function fmtDay(k) {
  const t = dkey();
  if (k === t) return 'Heute';
  if (k === addDays(t, -1)) return 'Gestern';
  if (k === addDays(t, 1)) return 'Morgen';
  return pkey(k).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}
const shortDate = (k) => pkey(k).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

// ---------- Defaults ----------
const ex = (name, sets, reps, rest = 90) => ({ id: uid(), name, sets, reps, rest });

function presetPlan(kind) {
  if (kind === 'empty') return { days: [] };
  if (kind === 'ul') {
    return { days: [
      { id: uid(), name: 'Oberkörper A', wd: [1], ex: [ex('Bankdrücken', 4, '6-8', 150), ex('Langhantelrudern', 4, '6-8', 150), ex('Schulterdrücken (KH)', 3, '8-10', 120), ex('Latzug', 3, '10-12'), ex('Seitheben', 3, '12-15', 60), ex('Trizepsdrücken am Kabel', 3, '10-12', 60)] },
      { id: uid(), name: 'Unterkörper A', wd: [2], ex: [ex('Kniebeugen', 4, '6-8', 180), ex('Rumänisches Kreuzheben', 3, '8-10', 150), ex('Beinpresse', 3, '10-12', 120), ex('Beinbeuger', 3, '10-12'), ex('Wadenheben', 4, '12-15', 60)] },
      { id: uid(), name: 'Oberkörper B', wd: [4], ex: [ex('Schrägbankdrücken (KH)', 4, '8-10', 120), ex('Klimmzüge', 4, '6-10', 150), ex('Kabelrudern', 3, '10-12'), ex('Dips', 3, '8-12'), ex('Langhantel-Curls', 3, '10-12', 60), ex('Face Pulls', 3, '15', 60)] },
      { id: uid(), name: 'Unterkörper B', wd: [5], ex: [ex('Kreuzheben', 3, '5', 180), ex('Bulgarische Split Squats', 3, '8-10', 120), ex('Beinstrecker', 3, '12-15'), ex('Beinbeuger sitzend', 3, '12-15'), ex('Wadenheben sitzend', 4, '15', 60)] },
    ] };
  }
  return { days: [
    { id: uid(), name: 'Push', wd: [1, 4], ex: [ex('Bankdrücken', 4, '6-8', 150), ex('Schrägbankdrücken (KH)', 3, '8-10', 120), ex('Schulterdrücken (KH)', 3, '8-10', 120), ex('Seitheben', 3, '12-15', 60), ex('Dips', 3, '8-12'), ex('Trizepsdrücken am Kabel', 3, '10-12', 60)] },
    { id: uid(), name: 'Pull', wd: [2, 5], ex: [ex('Klimmzüge', 4, '6-10', 150), ex('Langhantelrudern', 3, '8-10', 120), ex('Latzug', 3, '10-12'), ex('Face Pulls', 3, '15', 60), ex('Langhantel-Curls', 3, '10-12', 60), ex('Hammer Curls', 3, '10-12', 60)] },
    { id: uid(), name: 'Beine', wd: [3, 6], ex: [ex('Kniebeugen', 4, '6-8', 180), ex('Rumänisches Kreuzheben', 3, '8-10', 150), ex('Beinpresse', 3, '10-12', 120), ex('Beinbeuger', 3, '10-12'), ex('Ausfallschritte', 3, '10', 90), ex('Wadenheben', 4, '12-15', 60)] },
  ] };
}

// Nährwerte je 100 g (Richtwerte, in der App anpassbar). portion = Standardmenge in g.
const DEFAULT_FOODS = [
  ['Haferflocken', 370, 13.5, 58.7, 7, 60],
  ['Magerquark', 67, 12, 4, 0.3, 250],
  ['Skyr natur', 63, 11, 4, 0.2, 150],
  ['Körniger Frischkäse', 98, 12.3, 2.6, 4.3, 200],
  ['Hähnchenbrust (roh)', 110, 23.5, 0, 1.5, 200],
  ['Putenbrust (roh)', 105, 24, 0, 1, 200],
  ['Rinderhack 5 % (roh)', 125, 21, 0, 5, 125],
  ['Lachs (roh)', 200, 20, 0, 13, 125],
  ['Thunfisch (Dose, Wasser)', 110, 25, 0, 1, 130],
  ['Ei (Größe M ≈ 60 g)', 140, 12.5, 0.7, 10, 60],
  ['Eiklar', 50, 11, 0.7, 0.2, 100],
  ['Whey Protein', 380, 75, 8, 6, 30],
  ['Milch 1,5 %', 47, 3.4, 4.8, 1.5, 250],
  ['Mozzarella light', 165, 20, 1, 9, 125],
  ['Reis (roh)', 350, 7, 78, 0.6, 80],
  ['Nudeln (roh)', 355, 12.5, 70, 1.5, 100],
  ['Kartoffeln', 77, 2, 17, 0.1, 300],
  ['Vollkornbrot', 220, 7.5, 40, 1.5, 50],
  ['Reiswaffeln', 385, 8, 81, 3, 20],
  ['Banane', 93, 1.1, 20, 0.2, 120],
  ['Apfel', 54, 0.3, 12, 0.2, 150],
  ['Beeren (TK)', 45, 1, 8, 0.4, 150],
  ['Brokkoli', 34, 3.8, 2.7, 0.4, 200],
  ['Gemüse gemischt', 30, 1.5, 4.5, 0.3, 200],
  ['Olivenöl', 884, 0, 0, 100, 10],
  ['Erdnussbutter', 600, 25, 15, 50, 15],
  ['Mandeln', 600, 21, 6, 52, 25],
].map(([name, kcal, p, c, f, portion]) => ({ name, kcal, p, c, f, portion }));

function calcMacros(pr) {
  const bmr = 10 * pr.weight + 6.25 * pr.height - 5 * pr.age + (pr.sex === 'f' ? -161 : 5);
  const tdee = bmr * pr.activity;
  const raw = tdee - pr.deficit;
  const kcal = Math.max(1200, raw);
  const p = pr.proteinPerKg * pr.weight;
  const f = pr.fatPerKg * pr.weight;
  const c = Math.max(0, (kcal - p * 4 - f * 9) / 4);
  return { bmr: r0(bmr), tdee: r0(tdee), kcal: r0(kcal), p: r0(p), c: r0(c), f: r0(f), floored: raw < 1200 };
}

function defaults() {
  const profile = { sex: 'm', age: 28, height: 180, weight: 85, activity: 1.55, deficit: 500, proteinPerKg: 2.2, fatPerKg: 0.8, targetWeight: 78, waterGoal: 3000, sleepGoal: 8, stepGoal: 10000 };
  const m = calcMacros(profile);
  return {
    v: 1,
    profile,
    targets: { kcal: m.kcal, p: m.p, c: m.c, f: m.f },
    plan: presetPlan('ppl'),
    workouts: [],
    active: null,
    foods: DEFAULT_FOODS.map((f) => ({ id: uid(), ...f, fav: false, used: 0 })),
    meals: {},
    days: {},
    measures: [],
    photos: [],
    supps: [
      { id: uid(), name: 'Kreatin', dose: '5 g' },
      { id: uid(), name: 'Vitamin D3', dose: '2000 IE' },
      { id: uid(), name: 'Omega-3', dose: '2 Kapseln' },
      { id: uid(), name: 'Magnesium', dose: 'abends' },
    ],
    onboarded: false,
    hideInstall: false,
    lastBackup: 0,
  };
}

function migrate(s) {
  const d = defaults();
  for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
  s.profile = { ...d.profile, ...s.profile };
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.warn('Laden fehlgeschlagen', e); }
  return defaults();
}

let S = load();
const ui = { view: S.active ? 'session' : 'today', date: dkey(), rest: null, sheet: null, pick: null, bodyRange: 90, prog: null };

let saveTimer;
function saveNow() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Speichern fehlgeschlagen: ' + e.message); }
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 300); }
function commit() { save(); render(); renderSheet(); }
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

// ---------- Photo storage (IndexedDB) ----------
const idb = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('fit-photos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('photos', mode);
      const req = fn(t.objectStore('photos'));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    get: (k) => run('readonly', (s) => s.get(k)),
    set: (k, v) => run('readwrite', (s) => s.put(v, k)),
    del: (k) => run('readwrite', (s) => s.delete(k)),
    clear: () => run('readwrite', (s) => s.clear()),
  };
})();
const photoUrls = new Map();
async function photoURL(id) {
  if (photoUrls.has(id)) return photoUrls.get(id);
  const b = await idb.get(id);
  if (!b) return '';
  const u = URL.createObjectURL(b);
  photoUrls.set(id, u);
  return u;
}
function hydratePhotos(root = document) {
  root.querySelectorAll('img[data-photo]').forEach(async (img) => {
    try { img.src = await photoURL(img.dataset.photo); } catch { /* Foto fehlt */ }
  });
}
async function compressImage(file, max = 1400) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * sc);
    c.height = Math.round(img.naturalHeight * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
  } finally { URL.revokeObjectURL(url); }
}
const blobToDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
const dataURLToBlob = async (u) => (await fetch(u)).blob();

// ---------- Data access ----------
const BLANK_DAY = { water: 0, sleep: null, steps: null, weight: null, cardio: [], supps: [] };
const getDay = (k) => S.days[k] || BLANK_DAY;
function dayW(k) {
  if (!S.days[k]) S.days[k] = { water: 0, sleep: null, steps: null, weight: null, cardio: [], supps: [] };
  return S.days[k];
}
const entries = (k) => S.meals[k] || [];
function sum(list) {
  return list.reduce((a, e) => ({ kcal: a.kcal + (e.kcal || 0), p: a.p + (e.p || 0), c: a.c + (e.c || 0), f: a.f + (e.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
}
const macrosFor = (per, g) => ({ kcal: (per.kcal * g) / 100, p: (per.p * g) / 100, c: (per.c * g) / 100, f: (per.f * g) / 100 });

function weights() {
  return Object.keys(S.days).filter((k) => S.days[k].weight).sort().map((k) => ({ x: k, y: S.days[k].weight }));
}
function avg7(list) {
  return list.map((p) => {
    const from = addDays(p.x, -6);
    const win = list.filter((q) => q.x >= from && q.x <= p.x);
    return { x: p.x, y: win.reduce((a, q) => a + q.y, 0) / win.length };
  });
}
function lastWeight() { const w = weights(); return w.length ? w[w.length - 1].y : null; }

const e1rm = (w, r) => (r <= 1 ? w : w * (1 + r / 30));
function lastSets(name) {
  const n = name.trim().toLowerCase();
  for (let i = S.workouts.length - 1; i >= 0; i--) {
    const e = S.workouts[i].exercises.find((x) => x.name.trim().toLowerCase() === n);
    if (e && e.sets.length) return e.sets;
  }
  return [];
}
function records() {
  const m = new Map();
  for (const w of S.workouts) for (const e of w.exercises) for (const s of e.sets) {
    if (!(s.w > 0 && s.r > 0)) continue;
    const v = e1rm(s.w, s.r);
    const key = e.name.trim();
    const cur = m.get(key.toLowerCase());
    if (!cur || v > cur.v) m.set(key.toLowerCase(), { name: key, v, w: s.w, r: s.r, date: w.date });
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
function knownExercises() {
  const set = new Set();
  S.plan.days.forEach((d) => d.ex.forEach((e) => e.name && set.add(e.name)));
  S.workouts.forEach((w) => w.exercises.forEach((e) => set.add(e.name)));
  return [...set].sort((a, b) => a.localeCompare(b, 'de'));
}
const plannedFor = (k) => S.plan.days.filter((d) => d.wd.includes(pkey(k).getDay()));
const workoutsOn = (k) => S.workouts.filter((w) => w.date === k);
function weekKeys(k = dkey()) {
  const d = pkey(k);
  const monday = addDays(k, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
const volume = (w) => w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.w * s.r, 0), 0);
const setCount = (w) => w.exercises.reduce((a, e) => a + e.sets.length, 0);
const saetze = (n) => `${n} ${n === 1 ? 'Satz' : 'Sätze'}`;

// ---------- UI primitives ----------
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.add('hidden'), 2400);
}
function openSheet(fn) {
  if (fn !== sheetScan) stopScanner();
  ui.sheet = fn;
  $('#sheet').classList.remove('hidden');
  renderSheet();
  $('.sheet-panel').scrollTop = 0;
}
function closeSheet() {
  stopScanner();
  ui.sheet = null;
  ui.pick = null;
  $('#sheet').classList.add('hidden');
  $('#sheetBody').innerHTML = '';
}
function renderSheet() {
  if (!ui.sheet) return;
  if (ui.sheet === sheetScan && $('#reader')) return; // laufendes Kamerabild nicht zerstören
  const body = $('#sheetBody');
  body.innerHTML = ui.sheet();
  hydratePhotos(body);
}
function formVals(root) {
  const o = {};
  root.querySelectorAll('[name]').forEach((el) => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
  return o;
}
const topBar = (left, right = '') => `<div class="top">${left}<div>${right}</div></div>`;
const backBtn = (to, label) => `<button type="button" class="back" data-a="go" data-v="${to}">‹ ${esc(label)}</button>`;
function dateNav() {
  const k = ui.date;
  return `<div class="datenav">
    <button type="button" class="icon sm" data-a="dateShift" data-n="-1">‹</button>
    <span class="d">${fmtDay(k)}</span>
    <button type="button" class="icon sm" data-a="dateShift" data-n="1" ${k >= dkey() ? 'disabled' : ''}>›</button>
  </div>`;
}
function bar(v, max, color, over = true) {
  const pct = max > 0 ? Math.min(100, (v / max) * 100) : 0;
  return `<div class="bar ${over && max > 0 && v > max * 1.05 ? 'over' : ''}"><i style="width:${pct}%;background:${color}"></i></div>`;
}
const mbar = (label, v, max, color) => `<div class="mbar"><div class="t"><span>${label}</span><span>${fmt(v)} / ${fmt(max)} g</span></div>${bar(v, max, color)}</div>`;
const mtxt = (m) => `<span class="mtxt">${fmt(m.kcal)} kcal · <span class="p">P ${fmt(m.p)}</span> · <span class="c">K ${fmt(m.c)}</span> · <span class="f">F ${fmt(m.f)}</span></span>`;

function ring(v, max) {
  const R = 54, C = 2 * Math.PI * R;
  const pct = max > 0 ? Math.min(1, v / max) : 0;
  const over = v > max;
  const rest = max - v;
  return `<div class="ring"><svg viewBox="0 0 132 132">
      <circle cx="66" cy="66" r="${R}" fill="none" stroke="var(--card2)" stroke-width="12"/>
      <circle cx="66" cy="66" r="${R}" fill="none" stroke="${over ? 'var(--danger)' : 'var(--accent)'}" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/>
    </svg><div class="in"><span class="v">${fmt(Math.abs(rest))}</span><span class="l">${over ? 'kcal drüber' : 'kcal übrig'}</span><span class="l">${fmt(v)} / ${fmt(max)}</span></div></div>`;
}

function chart(pts, { avg = null, goal = null, unit = '', h = 170 } = {}) {
  if (pts.length < 2) return `<div class="empty">Ab 2 Einträgen erscheint hier dein Verlauf.</div>`;
  const W = 340, H = h, pl = 36, pr = 8, pt = 10, pb = 22;
  const xs = pts.map((p) => pkey(p.x).getTime());
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const ys = pts.map((p) => p.y).concat(avg ? avg.map((p) => p.y) : []);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y1 - y0 < 1) { y0 -= 0.5; y1 += 0.5; }
  const py = (y1 - y0) * 0.1; y0 -= py; y1 += py;
  const X = (t) => pl + (x1 === x0 ? 0.5 : (t - x0) / (x1 - x0)) * (W - pl - pr);
  const Y = (v) => pt + (1 - (v - y0) / (y1 - y0)) * (H - pt - pb);
  const line = (list) => list.map((p, i) => `${i ? 'L' : 'M'}${X(pkey(p.x).getTime()).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  let g = '';
  for (let i = 0; i <= 3; i++) {
    const v = y0 + ((y1 - y0) * i) / 3;
    g += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${pl - 6}" y="${Y(v) + 3}" text-anchor="end">${fmt(v, 1)}</text>`;
  }
  g += `<text class="axis" x="${pl}" y="${H - 6}">${shortDate(pts[0].x)}</text><text class="axis" x="${W - pr}" y="${H - 6}" text-anchor="end">${shortDate(pts[pts.length - 1].x)}</text>`;
  if (goal != null && goal >= y0 && goal <= y1) g += `<line class="goal" x1="${pl}" x2="${W - pr}" y1="${Y(goal)}" y2="${Y(goal)}"/>`;
  g += `<path class="raw" d="${line(pts)}"/>`;
  if (pts.length <= 120) g += pts.map((p) => `<circle class="dot" cx="${X(pkey(p.x).getTime())}" cy="${Y(p.y)}" r="2.5"/>`).join('');
  if (avg) g += `<path class="avg" d="${line(avg)}"/>`;
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf ${esc(unit)}">${g}</svg></div>`;
}

// ---------- Views ----------
const views = {};

views.today = () => {
  const k = ui.date;
  const d = getDay(k);
  const t = S.targets;
  const tot = sum(entries(k));
  const p = S.profile;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const backupOld = S.workouts.length + Object.keys(S.days).length > 5 && Date.now() - (S.lastBackup || 0) > 7 * 864e5;
  const waterGlasses = Math.ceil(p.waterGoal / 250);
  const filled = Math.floor(d.water / 250);
  const cardioMin = d.cardio.reduce((a, c) => a + c.min, 0);

  return `
  ${topBar(`<h1 style="margin:0">${k === dkey() ? greeting() : 'Tagebuch'}</h1>`, dateNav())}

  ${!S.onboarded ? `<div class="card accent">
    <b>Willkommen bei FIT 👋</b>
    <p class="muted small" style="margin-top:6px">Starte mit dem Makro-Rechner: Er berechnet aus deinen Daten deinen Kalorienbedarf für die Diät und deine Makro-Ziele.</p>
    <div class="row"><button type="button" class="btn primary small" data-a="go" data-v="calc">Makros berechnen</button><button type="button" class="btn ghost small" data-a="dismissOnboard">Später</button></div>
  </div>` : ''}

  ${!standalone && !S.hideInstall ? `<div class="card">
    <div class="row between"><b>📲 Als App installieren</b><button type="button" class="link small" data-a="hideInstall">Ausblenden</button></div>
    <p class="muted small" style="margin:6px 0 0">iPhone: in Safari unten auf <b>Teilen</b> → <b>Zum Home-Bildschirm</b>. Danach startet FIT wie eine normale App, auch offline.</p>
  </div>` : ''}

  ${backupOld ? `<div class="card"><div class="row between"><span class="small">💾 Letztes Backup ist über eine Woche her.</span><button type="button" class="btn small" data-a="export">Sichern</button></div></div>` : ''}

  <div class="card" data-a="tab" data-v="food">
    <div class="ring-wrap">${ring(tot.kcal, t.kcal)}
      <div class="macros">${mbar('Protein', tot.p, t.p, 'var(--p)')}${mbar('Kohlenhydrate', tot.c, t.c, 'var(--c)')}${mbar('Fett', tot.f, t.f, 'var(--f)')}</div>
    </div>
  </div>

  ${workoutCard(k)}

  <div class="card">
    <div class="card-title"><b>💧 Wasser</b><span class="mid">${fmt(d.water / 1000, 2)} <span class="unit">/ ${fmt(p.waterGoal / 1000, 1)} l</span></span></div>
    <div class="drops">${Array.from({ length: waterGlasses }, (_, i) => `<span class="drop ${i < filled ? 'on' : ''}"></span>`).join('')}</div>
    <div class="row"><button type="button" class="btn small" data-a="water" data-v="-250">−</button><button type="button" class="btn small grow" data-a="water" data-v="250">+ 250 ml</button><button type="button" class="btn small grow" data-a="water" data-v="500">+ 500 ml</button></div>
  </div>

  <div class="grid2" style="margin-bottom:12px">
    <div class="card stat">
      <div class="label">😴 Schlaf</div>
      <div class="inline-input"><input type="number" inputmode="decimal" step="0.25" min="0" max="24" data-c="day" data-f="sleep" value="${d.sleep ?? ''}" placeholder="0"><span class="unit">h</span></div>
      <div style="margin-top:8px">${bar(d.sleep || 0, p.sleepGoal, 'var(--sleep)', false)}</div>
      <div class="s" style="margin-top:4px">Ziel ${fmt(p.sleepGoal, 1)} h</div>
    </div>
    <div class="card stat">
      <div class="label">👟 Schritte</div>
      <div class="inline-input"><input type="number" inputmode="numeric" min="0" data-c="day" data-f="steps" value="${d.steps ?? ''}" placeholder="0"></div>
      <div style="margin-top:8px">${bar(d.steps || 0, p.stepGoal, 'var(--ok)', false)}</div>
      <div class="s" style="margin-top:4px">Ziel ${fmt(p.stepGoal)}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-title"><b>⚖️ Gewicht</b>${weightDelta(k)}</div>
    <div class="inline-input"><input type="number" inputmode="decimal" step="0.1" min="20" max="400" data-c="day" data-f="weight" value="${d.weight ?? ''}" placeholder="${lastWeight() ?? 'kg'}"><span class="unit">kg</span></div>
    <p class="muted tiny" style="margin:6px 0 0">Tipp: morgens nach dem Aufstehen wiegen – der 7-Tage-Schnitt zählt, nicht der einzelne Tag.</p>
  </div>

  <div class="card">
    <div class="card-title"><b>🏃 Cardio</b><button type="button" class="btn small" data-a="addCardio">+ Eintragen</button></div>
    ${d.cardio.length ? `<div class="list">${d.cardio.map((c, i) => `<div class="item"><div><b>${esc(c.type)}</b><div class="muted small">${c.min} min${c.km ? ` · ${fmt(c.km, 1)} km` : ''}${c.kcal ? ` · ~${fmt(c.kcal)} kcal` : ''}</div></div><button type="button" class="icon sm" data-a="delCardio" data-i="${i}">✕</button></div>`).join('')}</div>
      <p class="muted tiny" style="margin:6px 0 0">${cardioMin} min heute. Verbrannte kcal werden bewusst nicht zum Essensbudget addiert.</p>` : '<div class="empty">Noch kein Cardio.</div>'}
  </div>

  <div class="card">
    <div class="card-title"><b>💊 Supplements</b><span class="muted small">${d.supps.filter((id) => S.supps.some((s) => s.id === id)).length}/${S.supps.length}</span></div>
    ${S.supps.length ? S.supps.map((s) => { const on = d.supps.includes(s.id); return `<button type="button" class="supp ${on ? 'on' : ''}" data-a="supp" data-id="${s.id}"><span class="box">${on ? '✓' : ''}</span><span class="nm grow">${esc(s.name)}</span><span class="muted small">${esc(s.dose)}</span></button>`; }).join('') : '<div class="empty">Keine Supplements angelegt (unter „Mehr“).</div>'}
  </div>`;
};

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
}

function weightDelta(k) {
  const w = getDay(k).weight;
  if (!w) return '';
  const prev = weights().filter((p) => p.x < k).pop();
  if (!prev) return '';
  const dlt = r1(w - prev.y);
  return `<span class="pill ${dlt <= 0 ? 'acc' : ''}">${dlt > 0 ? '+' : ''}${fmt(dlt, 1)} kg</span>`;
}

function workoutCard(k) {
  if (S.active) {
    return `<div class="card accent" data-a="go" data-v="session"><div class="row between"><div><div class="label">Training läuft</div><b>${esc(S.active.name)}</b> <span class="muted small">· ${fmtDur(Date.now() - S.active.start)}</span></div><button type="button" class="btn primary small">Weiter ›</button></div></div>`;
  }
  const done = workoutsOn(k);
  if (done.length) {
    return `<div class="card">${done.map((w) => `<div class="row between"><div><div class="label">Training erledigt ✓</div><b>${esc(w.name)}</b><div class="muted small">${fmtDur(w.end - w.start)} · ${saetze(setCount(w))} · ${fmt(volume(w))} kg Volumen</div></div><span class="pill acc">💪</span></div>`).join('<hr style="border:0;border-top:1px solid var(--line)">')}</div>`;
  }
  const plan = plannedFor(k);
  const isToday = k === dkey();
  if (plan.length) {
    return `<div class="card"><div class="label">${isToday ? 'Heute geplant' : 'Geplant'}</div>${plan.map((d) => `<div class="row between" style="margin-top:6px"><div><b>${esc(d.name)}</b><div class="muted small">${d.ex.length} Übungen</div></div>${isToday ? `<button type="button" class="btn primary small" data-a="startWorkout" data-id="${d.id}">Starten</button>` : ''}</div>`).join('')}</div>`;
  }
  return `<div class="card"><div class="row between"><div><div class="label">Training</div><b>Ruhetag 💤</b><div class="muted small">Regeneration gehört dazu.</div></div>${isToday ? `<button type="button" class="btn small" data-a="go" data-v="train">Trotzdem trainieren</button>` : ''}</div></div>`;
}

views.train = () => {
  const today = dkey();
  const wk = weekKeys(today);
  const recs = records();
  const hist = S.workouts.slice().reverse();
  const thisWeek = S.workouts.filter((w) => wk.includes(w.date)).length;
  const plannedWeek = wk.filter((k) => plannedFor(k).length).length;
  return `
  <h1>Training</h1>
  ${S.active ? `<div class="card accent" data-a="go" data-v="session"><div class="row between"><div><div class="label">Läuft gerade</div><b>${esc(S.active.name)}</b></div><button type="button" class="btn primary small">Fortsetzen ›</button></div></div>` : ''}

  <div class="card">
    <div class="card-title"><b>Diese Woche</b><span class="muted small">${thisWeek} / ${plannedWeek} Einheiten</span></div>
    <div class="week">${wk.map((k) => {
      const done = workoutsOn(k).length > 0;
      const plan = plannedFor(k).length > 0;
      return `<div class="wd ${done ? 'done' : plan ? 'plan' : ''} ${k === today ? 'today' : ''}">${WD[pkey(k).getDay()]}<div class="tiny">${done ? '✓' : plan ? '•' : ''}</div></div>`;
    }).join('')}</div>
  </div>

  <h3>Mein Plan</h3>
  ${S.plan.days.length ? S.plan.days.map((d) => `<div class="card"><div class="row between">
      <div class="grow"><b>${esc(d.name)}</b><div class="muted small">${d.wd.length ? WD_ORDER.filter((w) => d.wd.includes(w)).map((w) => WD[w]).join(', ') : 'kein fester Tag'} · ${d.ex.length} Übungen</div>
      <div class="muted tiny" style="margin-top:3px">${esc(d.ex.map((e) => e.name).join(' · '))}</div></div>
      <button type="button" class="btn primary small" data-a="startWorkout" data-id="${d.id}">Start</button>
    </div></div>`).join('') : '<div class="card empty">Noch kein Plan. Leg unten einen an.</div>'}
  <div class="row" style="margin-bottom:12px">
    <button type="button" class="btn grow" data-a="go" data-v="plan">✏️ Plan bearbeiten</button>
    <button type="button" class="btn grow" data-a="startWorkout" data-id="">+ Freies Training</button>
  </div>

  <h3>Bestleistungen</h3>
  <div class="card">${recs.length ? `<div class="list">${recs.map((r) => `<button type="button" class="item" data-a="progress" data-n="${esc(r.name)}"><div><b>${esc(r.name)}</b><div class="muted small">${fmt(r.w, 1)} kg × ${r.r} · ${shortDate(r.date)}</div></div><div class="r"><b>${fmt(r.v, 1)}</b><div class="muted tiny">e1RM kg</div></div></button>`).join('')}</div>
    <p class="muted tiny" style="margin:8px 0 0">e1RM = geschätztes 1-Wiederholungs-Maximum. Antippen für den Verlauf. In der Diät gilt: Kraft halten ist ein Erfolg.</p>` : '<div class="empty">Nach deinem ersten Training stehen hier deine Rekorde.</div>'}</div>

  <h3>Verlauf</h3>
  <div class="card">${hist.length ? `<div class="list">${hist.slice(0, 40).map((w) => `<button type="button" class="item" data-a="showWorkout" data-id="${w.id}"><div><b>${esc(w.name)}</b><div class="muted small">${fmtDay(w.date)} · ${fmtDur(w.end - w.start)} · ${saetze(setCount(w))}</div></div><div class="r"><span class="muted small">${fmt(volume(w))} kg</span> <span class="chev">›</span></div></button>`).join('')}</div>` : '<div class="empty">Noch keine Trainings.</div>'}</div>`;
};

views.plan = () => {
  const names = knownExercises();
  return `
  ${topBar(backBtn('train', 'Training'))}
  <h1>Trainingsplan</h1>
  <datalist id="exNames">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
  ${S.plan.days.map((d, di) => `<div class="card">
    <label class="field"><span>Name des Tages</span><input data-c="planDay" data-d="${di}" data-f="name" value="${esc(d.name)}"></label>
    <div class="field"><span>Wochentage</span><div class="chips">${WD_ORDER.map((w) => `<button type="button" class="chip ${d.wd.includes(w) ? 'on' : ''}" data-a="toggleWd" data-d="${di}" data-w="${w}">${WD[w]}</button>`).join('')}</div></div>
    <div class="plan-ex-head"><span>Übung</span><span>Sätze</span><span>Wdh.</span><span>Pause s</span></div>
    ${d.ex.map((e, ei) => `<div class="plan-ex">
        <input list="exNames" data-c="planEx" data-d="${di}" data-e="${ei}" data-f="name" value="${esc(e.name)}" placeholder="Übung">
        <input type="number" inputmode="numeric" min="1" max="20" data-c="planEx" data-d="${di}" data-e="${ei}" data-f="sets" value="${e.sets}">
        <input data-c="planEx" data-d="${di}" data-e="${ei}" data-f="reps" value="${esc(e.reps)}">
        <input type="number" inputmode="numeric" min="0" step="15" data-c="planEx" data-d="${di}" data-e="${ei}" data-f="rest" value="${e.rest}">
        <div class="acts"><button type="button" class="icon sm" data-a="moveEx" data-d="${di}" data-e="${ei}" data-n="-1">↑</button><button type="button" class="icon sm" data-a="moveEx" data-d="${di}" data-e="${ei}" data-n="1">↓</button><button type="button" class="icon sm" data-a="delPlanEx" data-d="${di}" data-e="${ei}">✕</button></div>
      </div>`).join('')}
    <div class="row between"><button type="button" class="btn small" data-a="addPlanEx" data-d="${di}">+ Übung</button><button type="button" class="btn small ghost danger" data-a="delPlanDay" data-d="${di}">Tag löschen</button></div>
  </div>`).join('')}
  <button type="button" class="btn block" data-a="addPlanDay">+ Trainingstag hinzufügen</button>
  <h3>Vorlagen</h3>
  <div class="card"><p class="muted small">Ersetzt deinen aktuellen Plan (dein Trainingsverlauf bleibt erhalten).</p>
    <div class="row wrap"><button type="button" class="btn small" data-a="preset" data-v="ppl">Push / Pull / Beine (6×)</button><button type="button" class="btn small" data-a="preset" data-v="ul">Ober / Unter (4×)</button><button type="button" class="btn small ghost" data-a="preset" data-v="empty">Leer</button></div>
  </div>`;
};

views.session = () => {
  const a = S.active;
  if (!a) { ui.view = 'train'; return views.train(); }
  return `
  ${topBar(backBtn('train', 'Training'), `<span class="pill acc num" id="dur">${fmtDur(Date.now() - a.start)}</span>`)}
  <h1>${esc(a.name)}</h1>
  ${a.exercises.length ? '' : '<div class="card empty">Füge deine erste Übung hinzu.</div>'}
  ${a.exercises.map((e, ei) => exCard(e, ei, a.exercises.length)).join('')}
  <button type="button" class="btn block" data-a="addSessionEx">+ Übung hinzufügen</button>
  <div class="card"><label class="field" style="margin:0"><span>Notiz</span><textarea data-i="note" placeholder="Wie lief's? Energie, Schlaf, Pump …">${esc(a.note)}</textarea></label></div>
  <button type="button" class="btn primary block" data-a="finish">Training beenden ✓</button>
  <button type="button" class="btn ghost block danger" data-a="cancelWorkout">Training verwerfen</button>`;
};

function exCard(e, ei, total) {
  const last = lastSets(e.name);
  return `<div class="card">
    <div class="ex-head"><div class="grow"><b>${esc(e.name)}</b><div class="muted small">${e.target ? esc(e.target) + ' · ' : ''}Pause ${fmtSec(e.rest)}</div></div>
      <div class="acts">${ei > 0 ? `<button type="button" class="icon sm" data-a="moveSessionEx" data-e="${ei}" data-n="-1">↑</button>` : ''}${ei < total - 1 ? `<button type="button" class="icon sm" data-a="moveSessionEx" data-e="${ei}" data-n="1">↓</button>` : ''}<button type="button" class="icon sm" data-a="delSessionEx" data-e="${ei}">✕</button></div></div>
    ${last.length ? `<div class="last small">Letztes Mal: ${last.map((s) => `${fmt(s.w, 1)}×${s.r}`).join(' · ')}</div>` : ''}
    <div class="set head"><span>#</span><span>kg</span><span>Wdh.</span><span></span></div>
    ${e.sets.map((s, si) => {
      const ph = last[si] || last[last.length - 1] || {};
      return `<div class="set ${s.done ? 'done' : ''}"><span class="n">${si + 1}</span>
        <input type="text" inputmode="decimal" data-i="set" data-e="${ei}" data-s="${si}" data-f="w" value="${esc(s.w)}" placeholder="${ph.w != null ? fmt(ph.w, 1) : 'kg'}">
        <input type="text" inputmode="numeric" data-i="set" data-e="${ei}" data-s="${si}" data-f="r" value="${esc(s.r)}" placeholder="${ph.r != null ? ph.r : 'Wdh'}">
        <button type="button" class="check" data-a="setDone" data-e="${ei}" data-s="${si}">✓</button></div>`;
    }).join('')}
    <div class="row"><button type="button" class="btn small" data-a="addSet" data-e="${ei}">+ Satz</button>${e.sets.length > 1 ? `<button type="button" class="btn small ghost" data-a="delSet" data-e="${ei}">− Satz</button>` : ''}</div>
  </div>`;
}

views.food = () => {
  const k = ui.date;
  const list = entries(k);
  const tot = sum(list);
  const t = S.targets;
  return `
  ${topBar('<h1 style="margin:0">Essen</h1>', dateNav())}
  <div class="card">
    <div class="row between" style="margin-bottom:10px"><div><div class="label">Gegessen</div><span class="big">${fmt(tot.kcal)}</span> <span class="unit">/ ${fmt(t.kcal)} kcal</span></div>
      <div class="right"><div class="label">${tot.kcal > t.kcal ? 'Drüber' : 'Übrig'}</div><span class="mid ${tot.kcal > t.kcal ? 'danger-t' : 'ok-t'}">${fmt(Math.abs(t.kcal - tot.kcal))}</span></div></div>
    ${bar(tot.kcal, t.kcal, 'var(--accent)')}
    <div class="grid3" style="margin-top:12px">
      ${[['Protein', 'p', 'var(--p)'], ['Kohlenh.', 'c', 'var(--c)'], ['Fett', 'f', 'var(--f)']].map(([l, m, col]) => `<div><div class="tiny muted" style="font-weight:600">${l}</div><div class="num"><b>${fmt(tot[m])}</b><span class="muted small"> / ${fmt(t[m])} g</span></div>${bar(tot[m], t[m], col)}</div>`).join('')}
    </div>
  </div>
  ${SLOTS.map((slot) => {
    const items = list.filter((e) => e.slot === slot);
    const st = sum(items);
    return `<div class="card">
      <div class="card-title"><b>${slot}</b><span class="muted small num">${items.length ? fmt(st.kcal) + ' kcal' : ''}</span></div>
      ${items.length ? `<div class="list">${items.map((e) => `<button type="button" class="item" data-a="editEntry" data-id="${e.id}"><div class="grow"><b>${esc(e.name)}</b><div>${mtxt(e)}</div></div><div class="r muted small">${e.amount ? fmt(e.amount) + ' g' : ''}</div></button>`).join('')}</div>` : ''}
      <button type="button" class="btn small" style="margin-top:${items.length ? 8 : 0}px" data-a="addFood" data-slot="${slot}">+ Hinzufügen</button>
    </div>`;
  }).join('')}
  <div class="row" style="margin-bottom:12px">
    <button type="button" class="btn grow" data-a="copyDay">↻ Von gestern kopieren</button>
    <button type="button" class="btn grow" data-a="go" data-v="foods">📚 Lebensmittel</button>
  </div>`;
};

views.foods = () => {
  const list = S.foods.slice().sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.name.localeCompare(b.name, 'de'));
  return `
  ${topBar(backBtn('food', 'Essen'), '<div class="row"><button type="button" class="btn small" data-a="scan">📷 Scannen</button><button type="button" class="btn small primary" data-a="newFood">+ Neu</button></div>')}
  <h1>Lebensmittel</h1>
  <p class="muted small">Deine eigene Liste. Werte je 100 g. Häufig Gegessenes mit ★ markieren, dann steht es beim Eintragen oben. Richtwerte bitte mit der Verpackung abgleichen.</p>
  <div class="card"><div class="list">${list.map((f) => `<button type="button" class="item" data-a="editFood" data-id="${f.id}"><div class="grow"><b>${f.fav ? '★ ' : ''}${esc(f.name)}</b><div>${mtxt(f)}</div></div><span class="chev">›</span></button>`).join('') || '<div class="empty">Leer.</div>'}</div></div>`;
};

views.body = () => {
  const all = weights();
  const p = S.profile;
  const range = ui.bodyRange;
  const from = range ? addDays(dkey(), -range) : '0000';
  const pts = all.filter((q) => q.x >= from);
  const av = avg7(all).filter((q) => q.x >= from);
  const cur = av.length ? av[av.length - 1].y : null;
  const start = all.length ? all[0].y : null;
  // Tempo: 7-Tage-Schnitt jetzt vs. vor 14 Tagen
  let rate = null;
  if (all.length >= 2) {
    const fullAvg = avg7(all);
    const last = fullAvg[fullAvg.length - 1];
    const ref = fullAvg.filter((q) => q.x <= addDays(last.x, -14)).pop() || fullAvg[0];
    const days = (pkey(last.x) - pkey(ref.x)) / 864e5;
    if (days >= 6) rate = ((last.y - ref.y) / days) * 7;
  }
  const toGo = cur != null && p.targetWeight ? cur - p.targetWeight : null;
  const weeksLeft = toGo != null && rate != null && rate < -0.05 && toGo > 0 ? toGo / -rate : null;
  const meas = S.measures.slice().sort((a, b) => a.date.localeCompare(b.date));
  const firstM = meas[0], lastM = meas[meas.length - 1];
  const photos = S.photos.slice().sort((a, b) => b.date.localeCompare(a.date));

  return `
  <h1>Körper</h1>
  <div class="card">
    <div class="card-title"><b>⚖️ Gewicht</b><div class="chips">${[[30, '30 T'], [90, '90 T'], [0, 'Alle']].map(([v, l]) => `<button type="button" class="chip ${range === v ? 'on' : ''}" data-a="bodyRange" data-v="${v}">${l}</button>`).join('')}</div></div>
    ${chart(pts, { avg: av, goal: p.targetWeight, unit: 'kg' })}
    ${pts.length >= 2 ? `<div class="legend"><span><i style="background:var(--accent)"></i>7-Tage-Schnitt</span><span><i style="background:color-mix(in srgb,var(--accent) 40%,transparent)"></i>Tageswert</span><span><i style="background:var(--p)"></i>Ziel</span></div>` : ''}
  </div>
  <div class="grid2" style="margin-bottom:12px">
    <div class="card stat"><div class="label">Aktuell (Ø 7 T)</div><div class="v">${cur != null ? fmt(cur, 1) + ' kg' : '–'}</div><div class="s">${start != null && cur != null ? `${cur - start <= 0 ? '' : '+'}${fmt(cur - start, 1)} kg seit Start` : 'Gewicht unter „Heute“ eintragen'}</div></div>
    <div class="card stat"><div class="label">Tempo</div><div class="v">${rate != null ? `${rate > 0 ? '+' : ''}${fmt(rate, 2)} kg` : '–'}</div><div class="s">${rate != null ? 'pro Woche' : 'braucht ~1 Woche Daten'}</div></div>
    <div class="card stat"><div class="label">Zielgewicht</div><div class="v">${fmt(p.targetWeight, 1)} kg</div><div class="s">${toGo != null ? (toGo > 0 ? `noch ${fmt(toGo, 1)} kg` : 'erreicht 🎉') : ''}</div></div>
    <div class="card stat"><div class="label">Prognose</div><div class="v">${weeksLeft != null ? `~${fmt(Math.ceil(weeksLeft))} Wo.` : '–'}</div><div class="s">${weeksLeft != null ? 'bei aktuellem Tempo' : 'bei Abnahme-Trend'}</div></div>
  </div>
  ${rate != null && cur ? rateHint(rate, cur) : ''}

  <div class="card">
    <div class="card-title"><b>📏 Maße</b><button type="button" class="btn small" data-a="addMeasure">+ Messen</button></div>
    ${lastM ? `${MEAS.filter(([key]) => lastM[key]).map(([key, label]) => {
      const dlt = firstM !== lastM && firstM[key] ? lastM[key] - firstM[key] : null;
      return `<div class="kv"><span>${label}</span><span>${fmt(lastM[key], 1)} cm ${dlt != null ? `<span class="pill ${dlt <= 0 ? 'acc' : ''}">${dlt > 0 ? '+' : ''}${fmt(dlt, 1)}</span>` : ''}</span></div>`;
    }).join('')}
      <p class="muted tiny" style="margin:8px 0 6px">Stand ${shortDate(lastM.date)}${firstM !== lastM ? `, Veränderung seit ${shortDate(firstM.date)}` : ''}</p>
      <details><summary class="link small">Alle Messungen (${meas.length})</summary><div class="list" style="margin-top:6px">${meas.slice().reverse().map((m) => `<div class="item"><div><b>${shortDate(m.date)}</b><div class="muted small">${MEAS.filter(([key]) => m[key]).map(([key, l]) => `${l} ${fmt(m[key], 1)}`).join(' · ')}</div></div><button type="button" class="icon sm" data-a="delMeasure" data-id="${m.id}">✕</button></div>`).join('')}</div></details>`
    : '<div class="empty">Miss alle 1–2 Wochen Bauch &amp; Co. – zeigt Fortschritt, auch wenn die Waage stockt.</div>'}
  </div>

  <div class="card">
    <div class="card-title"><b>📸 Fortschrittsfotos</b>
      <label class="btn small">+ Foto<input type="file" accept="image/*" data-c="photo" hidden></label></div>
    ${photos.length >= 2 ? `<button type="button" class="btn small block" data-a="comparePhotos">Vorher / Nachher vergleichen</button>` : ''}
    ${photos.length ? `<div class="photos">${photos.map((ph) => `<button type="button" data-a="showPhoto" data-id="${ph.id}"><img data-photo="${ph.id}" alt=""><span class="dt">${shortDate(ph.date)}</span></button>`).join('')}</div>` : '<div class="empty">Fotos bleiben nur auf diesem Handy. Gleiches Licht, gleiche Pose = beste Vergleichbarkeit.</div>'}
  </div>`;
};

function rateHint(rate, cur) {
  const pct = (-rate / cur) * 100;
  let msg;
  if (rate > 0.1) msg = 'Der Trend geht nach oben. Prüf, ob du dein Kalorienziel wirklich triffst (auch Öl, Soßen, Getränke).';
  else if (pct < 0.25) msg = 'Kaum Bewegung. Wenn das 2–3 Wochen so bleibt: 100–200 kcal weniger oder mehr Schritte.';
  else if (pct > 1.0) msg = 'Sehr schnell. Für Muskelerhalt eher 0,5–1 % pro Woche – evtl. etwas mehr essen.';
  else msg = 'Gutes Tempo – genau im Bereich von 0,25–1 % Körpergewicht pro Woche. Weiter so!';
  return `<div class="card"><span class="small">💡 ${msg}</span></div>`;
}

views.more = () => {
  const p = S.profile;
  return `
  <h1>Mehr</h1>
  <div class="card"><div class="list">
    <button type="button" class="item" data-a="go" data-v="calc"><div><b>🧮 Makro-Rechner &amp; Ziele</b><div class="muted small">${fmt(S.targets.kcal)} kcal · P ${S.targets.p} · K ${S.targets.c} · F ${S.targets.f}</div></div><span class="chev">›</span></button>
    <button type="button" class="item" data-a="go" data-v="foods"><div><b>📚 Lebensmittel</b><div class="muted small">${S.foods.length} Einträge</div></div><span class="chev">›</span></button>
    <button type="button" class="item" data-a="go" data-v="plan"><div><b>🏋️ Trainingsplan</b><div class="muted small">${S.plan.days.length} Trainingstage</div></div><span class="chev">›</span></button>
  </div></div>

  <h3>Tagesziele</h3>
  <div class="card">
    <div class="grid2">
      <label class="field"><span>Wasser (ml)</span><input type="number" inputmode="numeric" step="250" data-c="prof" data-f="waterGoal" value="${p.waterGoal}"></label>
      <label class="field"><span>Schlaf (h)</span><input type="number" inputmode="decimal" step="0.5" data-c="prof" data-f="sleepGoal" value="${p.sleepGoal}"></label>
      <label class="field"><span>Schritte</span><input type="number" inputmode="numeric" step="500" data-c="prof" data-f="stepGoal" value="${p.stepGoal}"></label>
      <label class="field"><span>Zielgewicht (kg)</span><input type="number" inputmode="decimal" step="0.5" data-c="prof" data-f="targetWeight" value="${p.targetWeight}"></label>
    </div>
  </div>

  <h3>Supplements</h3>
  <div class="card">
    ${S.supps.map((s, i) => `<div class="row" style="margin-bottom:6px"><input class="grow" data-c="supp" data-i="${i}" data-f="name" value="${esc(s.name)}"><input style="width:110px" data-c="supp" data-i="${i}" data-f="dose" value="${esc(s.dose)}" placeholder="Dosis"><button type="button" class="icon sm" data-a="delSupp" data-i="${i}">✕</button></div>`).join('')}
    <button type="button" class="btn small" data-a="addSupp">+ Supplement</button>
  </div>

  <h3>Deine Daten</h3>
  <div class="card">
    <p class="small muted">Alles liegt nur auf diesem Gerät – kein Konto, kein Server. Mach ab und zu ein Backup (z. B. in iCloud Drive / „Dateien“ speichern), dann ist nichts verloren, auch bei neuem Handy.</p>
    <p class="small">Letztes Backup: <b>${S.lastBackup ? new Date(S.lastBackup).toLocaleDateString('de-DE') : 'noch nie'}</b><span id="persist" class="muted"></span></p>
    <div class="row wrap">
      <button type="button" class="btn small primary" data-a="export">💾 Backup erstellen</button>
      <label class="btn small">📂 Backup laden<input type="file" accept="application/json,.json" data-c="import" hidden></label>
    </div>
    <label class="check-row small" style="margin-top:10px"><input type="checkbox" id="withPhotos" checked> Fotos ins Backup aufnehmen</label>
  </div>
  <div class="card">
    <button type="button" class="btn small ghost danger" data-a="reset">Alle Daten löschen</button>
  </div>
  <p class="muted tiny center">FIT · Version 1 · läuft offline</p>`;
};

views.calc = () => {
  const p = S.profile;
  const m = calcMacros(p);
  const t = S.targets;
  const weekly = (p.deficit * 7) / 7700;
  const lw = lastWeight();
  const toGo = (lw ?? p.weight) - p.targetWeight;
  const weeks = weekly > 0 && toGo > 0 ? toGo / weekly : null;
  const sel = (f, opts) => `<select data-c="prof" data-f="${f}">${opts.map(([v, l]) => `<option value="${v}" ${String(p[f]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return `
  ${topBar(backBtn('more', 'Mehr'))}
  <h1>Makro-Rechner</h1>
  <div class="card">
    <div class="field"><span>Geschlecht</span><div class="chips"><button type="button" class="chip ${p.sex === 'm' ? 'on' : ''}" data-a="sex" data-v="m">Männlich</button><button type="button" class="chip ${p.sex === 'f' ? 'on' : ''}" data-a="sex" data-v="f">Weiblich</button></div></div>
    <div class="grid3">
      <label class="field"><span>Alter</span><input type="number" inputmode="numeric" data-c="prof" data-f="age" value="${p.age}"></label>
      <label class="field"><span>Größe cm</span><input type="number" inputmode="numeric" data-c="prof" data-f="height" value="${p.height}"></label>
      <label class="field"><span>Gewicht kg</span><input type="number" inputmode="decimal" step="0.1" data-c="prof" data-f="weight" value="${p.weight}"></label>
    </div>
    ${lw && Math.abs(lw - p.weight) >= 0.1 ? `<button type="button" class="link small" style="margin:-4px 0 10px" data-a="useLastWeight">Letztes gewogenes Gewicht übernehmen (${fmt(lw, 1)} kg)</button>` : ''}
    <label class="field"><span>Aktivität im Alltag (inkl. Training)</span>${sel('activity', [[1.2, 'Kaum aktiv – Bürojob, kein Sport'], [1.375, 'Leicht – 1–3× Training/Woche'], [1.55, 'Mittel – 3–5× Training/Woche'], [1.725, 'Hoch – 6–7× Training oder körperl. Job'], [1.9, 'Sehr hoch – Training + körperl. Job']])}</label>
    <label class="field"><span>Defizit</span>${sel('deficit', [[0, 'Kein Defizit (halten)'], [250, '−250 kcal · sanft (~0,23 kg/Woche)'], [400, '−400 kcal · moderat (~0,36 kg/Woche)'], [500, '−500 kcal · Standard (~0,45 kg/Woche)'], [750, '−750 kcal · aggressiv (~0,7 kg/Woche)']])}</label>
    <div class="grid2">
      <label class="field"><span>Protein g / kg</span>${sel('proteinPerKg', [[1.6, '1,6'], [1.8, '1,8'], [2, '2,0'], [2.2, '2,2 (Diät-Empfehlung)'], [2.5, '2,5']])}</label>
      <label class="field"><span>Fett g / kg</span>${sel('fatPerKg', [[0.6, '0,6'], [0.7, '0,7'], [0.8, '0,8'], [1, '1,0']])}</label>
    </div>
  </div>

  <div class="card accent">
    <div class="kv"><span>Grundumsatz</span><span>${fmt(m.bmr)} kcal</span></div>
    <div class="kv"><span>Gesamtbedarf (Erhalt)</span><span>${fmt(m.tdee)} kcal</span></div>
    <div class="kv"><span><b>Dein Diät-Ziel</b></span><span class="ok-t">${fmt(m.kcal)} kcal</span></div>
    <div class="kv"><span style="color:var(--p)">Protein</span><span>${m.p} g</span></div>
    <div class="kv"><span style="color:var(--c)">Kohlenhydrate</span><span>${m.c} g</span></div>
    <div class="kv"><span style="color:var(--f)">Fett</span><span>${m.f} g</span></div>
    <p class="muted small" style="margin:10px 0">≈ ${fmt(weekly, 2)} kg Fett pro Woche${weeks ? ` · Zielgewicht ${fmt(p.targetWeight, 1)} kg in ca. ${fmt(Math.ceil(weeks))} Wochen` : ''}.${m.floored ? ' <span class="danger-t">Untergrenze 1200 kcal greift – Defizit lieber verkleinern.</span>' : ''}</p>
    <button type="button" class="btn primary block" style="margin:0" data-a="applyCalc">Als Tagesziel übernehmen</button>
  </div>

  <h3>Aktuelles Tagesziel (manuell anpassbar)</h3>
  <div class="card">
    <div class="grid2">
      <label class="field"><span>Kalorien</span><input type="number" inputmode="numeric" data-c="target" data-f="kcal" value="${t.kcal}"></label>
      <label class="field"><span>Protein g</span><input type="number" inputmode="numeric" data-c="target" data-f="p" value="${t.p}"></label>
      <label class="field"><span>Kohlenhydrate g</span><input type="number" inputmode="numeric" data-c="target" data-f="c" value="${t.c}"></label>
      <label class="field"><span>Fett g</span><input type="number" inputmode="numeric" data-c="target" data-f="f" value="${t.f}"></label>
    </div>
    <p class="muted tiny" style="margin:0">Makros ergeben ${fmt(t.p * 4 + t.c * 4 + t.f * 9)} kcal. Formel: Mifflin-St Jeor. Nach 2–3 Wochen am echten Gewichtstrend unter „Körper“ nachjustieren.</p>
  </div>`;
};

// ---------- Sheets ----------
function sheetFoodPicker() {
  const pk = ui.pick;
  if (pk.mode === 'quick') {
    return `<h2>Schnell eintragen · ${esc(pk.slot)}</h2><div id="quickForm">
      <label class="field"><span>Bezeichnung</span><input name="name" placeholder="z. B. Döner, Restaurant …"></label>
      <div class="grid2">
        <label class="field"><span>Kalorien</span><input name="kcal" type="number" inputmode="decimal"></label>
        <label class="field"><span>Protein g</span><input name="p" type="number" inputmode="decimal"></label>
        <label class="field"><span>Kohlenhydrate g</span><input name="c" type="number" inputmode="decimal"></label>
        <label class="field"><span>Fett g</span><input name="f" type="number" inputmode="decimal"></label>
      </div></div>
      <button type="button" class="btn primary block" data-a="quickAdd">Hinzufügen</button>
      <button type="button" class="btn ghost block" data-a="pickBack">‹ Zurück zur Liste</button>`;
  }
  if (pk.food) {
    const f = S.foods.find((x) => x.id === pk.food);
    if (!f) { pk.food = null; return sheetFoodPicker(); }
    const m = macrosFor(f, num(pk.amount));
    const amounts = [...new Set([f.portion, 50, 100, 150, 200, 250].filter(Boolean))].sort((a, b) => a - b);
    return `<h2>${esc(f.name)}</h2>
      <p class="muted small">${mtxt(f)} je 100 g</p>
      <label class="field"><span>Menge in g</span><input id="pickAmt" type="number" inputmode="decimal" data-i="pickAmt" value="${esc(pk.amount)}"></label>
      <div class="chips" style="margin-bottom:12px">${amounts.map((a) => `<button type="button" class="chip ${num(pk.amount) === a ? 'on' : ''}" data-a="pickAmount" data-v="${a}">${a} g${a === f.portion ? ' ★' : ''}</button>`).join('')}</div>
      <div class="card" style="background:var(--card2)" id="pickPrev">${mtxt(m)}</div>
      <button type="button" class="btn primary block" data-a="pickAdd">Zu ${esc(pk.slot)} hinzufügen</button>
      <button type="button" class="btn ghost block" data-a="pickBack">‹ Zurück</button>`;
  }
  return `<h2>${esc(pk.slot)}</h2>
    <input id="pickQ" data-i="pickQ" placeholder="🔍 Lebensmittel suchen" value="${esc(pk.q)}" autocomplete="off">
    <div class="row" style="margin:10px 0"><button type="button" class="btn small grow" data-a="scan">📷 Scannen</button><button type="button" class="btn small grow" data-a="quickMode">⚡ Nur Makros</button><button type="button" class="btn small grow" data-a="newFood">+ Neu</button></div>
    <div class="list" id="pickList">${pickList(pk.q)}</div>`;
}
function pickList(q) {
  const ql = q.trim().toLowerCase();
  const list = S.foods.filter((f) => !ql || f.name.toLowerCase().includes(ql))
    .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (b.used || 0) - (a.used || 0) || a.name.localeCompare(b.name, 'de'));
  if (!list.length) return `<div class="empty">Nichts gefunden. <button type="button" class="link" data-a="newFood">„${esc(q)}“ anlegen</button></div>`;
  return list.map((f) => `<button type="button" class="item" data-a="pickFood" data-id="${f.id}"><div class="grow"><b>${f.fav ? '★ ' : ''}${esc(f.name)}</b><div>${mtxt(f)} <span class="muted tiny">/100 g</span></div></div><span class="chev">›</span></button>`).join('');
}

function sheetFoodEdit(id, preset = {}, note = '') {
  return () => {
    const f = S.foods.find((x) => x.id === id) || { name: '', kcal: '', p: '', c: '', f: '', portion: 100, fav: false, barcode: '', ...preset };
    return `<h2>${id ? 'Lebensmittel bearbeiten' : 'Neues Lebensmittel'}</h2>
      ${note ? `<div class="card" style="background:var(--card2)"><span class="small">${note}</span></div>` : ''}<div id="foodForm">
      <label class="field"><span>Name</span><input name="name" value="${esc(f.name)}"></label>
      <p class="muted small" style="margin:-2px 0 8px">Nährwerte je 100 g (steht auf der Verpackung).</p>
      <div class="grid2">
        <label class="field"><span>Kalorien</span><input name="kcal" type="number" inputmode="decimal" value="${f.kcal}" placeholder="leer = aus Makros"></label>
        <label class="field"><span>Protein g</span><input name="p" type="number" inputmode="decimal" value="${f.p}"></label>
        <label class="field"><span>Kohlenhydrate g</span><input name="c" type="number" inputmode="decimal" value="${f.c}"></label>
        <label class="field"><span>Fett g</span><input name="f" type="number" inputmode="decimal" value="${f.f}"></label>
      </div>
      <label class="field"><span>Standard-Portion (g)</span><input name="portion" type="number" inputmode="decimal" value="${f.portion}"></label>
      <label class="field"><span>Barcode (optional)</span><input name="barcode" inputmode="numeric" value="${esc(f.barcode || '')}" placeholder="wird beim Scannen ausgefüllt"></label>
      <label class="check-row field"><input type="checkbox" name="fav" ${f.fav ? 'checked' : ''}> ★ Favorit</label></div>
      <button type="button" class="btn primary block" data-a="saveFood" data-id="${id || ''}">Speichern</button>
      ${id ? `<button type="button" class="btn ghost block danger" data-a="delFood" data-id="${id}">Löschen</button>` : ''}
      <button type="button" class="btn ghost block" data-a="${ui.pick ? 'pickBack' : 'closeSheet'}">Abbrechen</button>`;
  };
}

function sheetEntry(id) {
  return () => {
    const e = entries(ui.date).find((x) => x.id === id);
    if (!e) return '<div class="empty">Eintrag nicht gefunden.</div>';
    return `<h2>${esc(e.name)}</h2><div id="entryForm">
      ${e.per ? `<label class="field"><span>Menge in g</span><input name="amount" type="number" inputmode="decimal" value="${e.amount}"></label>`
      : `<div class="grid2"><label class="field"><span>Kalorien</span><input name="kcal" type="number" inputmode="decimal" value="${r0(e.kcal)}"></label><label class="field"><span>Protein g</span><input name="p" type="number" inputmode="decimal" value="${r1(e.p)}"></label><label class="field"><span>Kohlenhydrate g</span><input name="c" type="number" inputmode="decimal" value="${r1(e.c)}"></label><label class="field"><span>Fett g</span><input name="f" type="number" inputmode="decimal" value="${r1(e.f)}"></label></div>`}
      <label class="field"><span>Mahlzeit</span><select name="slot">${SLOTS.map((s) => `<option ${s === e.slot ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
      <p>${mtxt(e)}</p>
      <button type="button" class="btn primary block" data-a="saveEntry" data-id="${id}">Speichern</button>
      <button type="button" class="btn ghost block danger" data-a="delEntry" data-id="${id}">Löschen</button>`;
  };
}

function sheetCardio() {
  return `<h2>Cardio eintragen</h2><div id="cardioForm">
    <label class="field"><span>Art</span><select name="type">${CARDIO.map((c) => `<option>${c}</option>`).join('')}</select></label>
    <div class="grid3">
      <label class="field"><span>Minuten</span><input name="min" type="number" inputmode="numeric"></label>
      <label class="field"><span>km (opt.)</span><input name="km" type="number" inputmode="decimal"></label>
      <label class="field"><span>kcal (opt.)</span><input name="kcal" type="number" inputmode="numeric"></label>
    </div></div>
    <button type="button" class="btn primary block" data-a="saveCardio">Speichern</button>`;
}

function sheetMeasure() {
  const last = S.measures.slice().sort((a, b) => a.date.localeCompare(b.date)).pop() || {};
  return `<h2>Maße eintragen</h2><div id="measForm">
    <label class="field"><span>Datum</span><input name="date" type="date" value="${dkey()}"></label>
    <div class="grid2">${MEAS.map(([k, l]) => `<label class="field"><span>${l} (cm)</span><input name="${k}" type="number" inputmode="decimal" step="0.1" placeholder="${last[k] ?? ''}"></label>`).join('')}</div>
    <p class="muted tiny">Bauch: auf Nabelhöhe, morgens, entspannt ausatmen.</p></div>
    <button type="button" class="btn primary block" data-a="saveMeasure">Speichern</button>`;
}

function sheetWorkout(id) {
  return () => {
    const w = S.workouts.find((x) => x.id === id);
    if (!w) return '<div class="empty">Nicht gefunden.</div>';
    return `<h2>${esc(w.name)}</h2>
      <p class="muted small">${pkey(w.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })} · ${fmtDur(w.end - w.start)} · ${fmt(volume(w))} kg Volumen</p>
      ${w.exercises.map((e) => `<div class="card" style="background:var(--card2)"><b>${esc(e.name)}</b><div class="small muted" style="margin-top:4px">${e.sets.map((s) => `${fmt(s.w, 1)} kg × ${s.r}`).join(' · ')}</div></div>`).join('')}
      ${w.note ? `<p class="small">📝 ${esc(w.note)}</p>` : ''}
      <button type="button" class="btn ghost block danger" data-a="delWorkout" data-id="${id}">Training löschen</button>`;
  };
}

function sheetProgress(name) {
  return () => {
    const n = name.toLowerCase();
    const byDay = new Map();
    for (const w of S.workouts) for (const e of w.exercises) {
      if (e.name.trim().toLowerCase() !== n) continue;
      for (const s of e.sets) if (s.w > 0 && s.r > 0) byDay.set(w.date, Math.max(byDay.get(w.date) || 0, e1rm(s.w, s.r)));
    }
    const pts = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([x, y]) => ({ x, y: r1(y) }));
    return `<h2>${esc(name)}</h2><p class="muted small">Bestes geschätztes 1RM pro Training (kg)</p>${chart(pts, { unit: 'kg' })}
      <div class="list" style="margin-top:8px">${pts.slice().reverse().slice(0, 12).map((q) => `<div class="kv"><span>${fmtDay(q.x)}</span><span>${fmt(q.y, 1)} kg</span></div>`).join('')}</div>`;
  };
}

function sheetAddSessionEx() {
  const names = knownExercises();
  return `<h2>Übung hinzufügen</h2>
    <div class="row"><input id="newEx" class="grow" placeholder="Name der Übung" list="exNames2"><button type="button" class="btn primary" data-a="addSessionExGo">OK</button></div>
    <datalist id="exNames2">${names.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
    ${names.length ? `<h3>Bekannte Übungen</h3><div class="chips">${names.map((x) => `<button type="button" class="chip" data-a="addSessionExGo" data-n="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}`;
}

// ---------- Rest timer & audio ----------
let actx = null;
function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch { /* kein Audio */ }
}
function beep() {
  if (!actx) return;
  [0, 0.3].forEach((t) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(actx.destination);
    g.gain.setValueAtTime(0.0001, actx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.3, actx.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + t + 0.22);
    o.start(actx.currentTime + t); o.stop(actx.currentTime + t + 0.25);
  });
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}
function startRest(sec) {
  if (!sec) return;
  ui.rest = { end: Date.now() + sec * 1000, total: sec, beeped: false };
  tick();
}
function tick() {
  const dur = $('#dur');
  if (dur && S.active) dur.textContent = fmtDur(Date.now() - S.active.start);
  const rb = $('#restbar');
  if (!ui.rest) { rb.classList.add('hidden'); return; }
  const left = Math.max(0, (ui.rest.end - Date.now()) / 1000);
  if (left <= 0 && !ui.rest.beeped) { ui.rest.beeped = true; beep(); }
  if (left <= 0 && Date.now() - ui.rest.end > 15000) { ui.rest = null; rb.classList.add('hidden'); return; }
  if (!rb.firstChild) {
    rb.innerHTML = `<span class="t"></span><div class="bar"><i style="background:var(--accent)"></i></div>
      <button type="button" class="btn small" data-a="restAdd">+15 s</button><button type="button" class="btn small ghost" data-a="restSkip">✕</button>`;
  }
  rb.classList.remove('hidden');
  rb.classList.toggle('end', left <= 0);
  rb.querySelector('.t').textContent = left > 0 ? fmtSec(Math.ceil(left)) : 'Los!';
  rb.querySelector('.bar i').style.width = `${(left / ui.rest.total) * 100}%`;
}
setInterval(tick, 500);

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* nicht unterstützt */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.active) keepAwake(true); });

// ---------- Barcode- / QR-Scanner ----------
// Bibliothek liegt lokal (vendor/), damit Scannen bekannter Produkte auch offline klappt.
// Nährwerte neuer Produkte kommen aus Open Food Facts – dabei wird nur die Barcode-Nummer gesendet.
let scanner = null;
let scanBusy = false;
function sheetScan() {
  return `<h2>Barcode / QR-Code scannen</h2>
    <div id="reader" class="reader"></div>
    <p id="scanMsg" class="muted small center" style="margin:8px 0 12px">Kamera wird gestartet …</p>
    <div class="row" style="margin-bottom:10px"><input id="manualCode" class="grow" inputmode="numeric" placeholder="oder Barcode-Nummer eintippen" autocomplete="off"><button type="button" class="btn" data-a="scanManual">OK</button></div>
    <button type="button" class="btn ghost block" data-a="scanCancel">Abbrechen</button>`;
}
async function loadScanLib() {
  if (window.__Html5QrcodeLibrary__) return window.__Html5QrcodeLibrary__;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = '/vendor/html5-qrcode.min.js';
    s.onload = res;
    s.onerror = () => rej(new Error('Scanner konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
  return window.__Html5QrcodeLibrary__;
}
async function startScanner() {
  const msg = (t) => { const m = $('#scanMsg'); if (m) m.innerHTML = t; };
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Kamera wird hier nicht unterstützt');
    const lib = await loadScanLib();
    if (ui.sheet !== sheetScan || !$('#reader')) return;
    const F = lib.Html5QrcodeSupportedFormats;
    const sc = new lib.Html5Qrcode('reader', {
      verbose: false,
      formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.QR_CODE, F.CODE_128],
      useBarCodeDetectorIfSupported: true,
    });
    scanner = sc;
    await sc.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: (w, h) => ({ width: Math.max(50, Math.floor(w * 0.85)), height: Math.max(50, Math.floor(Math.min(w * 0.55, h * 0.8))) }) },
      (text) => onScan(text),
      () => {},
    );
    if (scanner !== sc) { try { await sc.stop(); sc.clear(); } catch { /* schon weg */ } return; }
    msg('Barcode oder QR-Code in den Rahmen halten');
  } catch (e) {
    scanner = null;
    const denied = /permission|notallowed/i.test(String(e && (e.name || e.message || e)));
    msg(denied
      ? 'Kein Kamerazugriff. iPhone: Einstellungen → Safari → Kamera → „Erlauben“. Oder Nummer unten eintippen.'
      : `Kamera nicht verfügbar (${esc((e && e.message) || e)}). Du kannst die Nummer unten eintippen.`);
  }
}
async function stopScanner() {
  const sc = scanner;
  scanner = null;
  if (!sc) return;
  try { if (sc.isScanning) await sc.stop(); sc.clear(); } catch { /* egal */ }
}
async function onScan(text) {
  if (scanBusy) return;
  scanBusy = true;
  if (navigator.vibrate) navigator.vibrate(60);
  await stopScanner();
  try { await handleCode(text); } finally { scanBusy = false; }
}
// EAN/UPC direkt, oder GS1-Digital-Link-QR (…/01/<GTIN>…)
function extractCode(text) {
  const t = String(text).trim();
  if (/^\d{8,14}$/.test(t)) return t;
  const m = t.match(/\/01\/(\d{14})(?:\/|\?|$)/);
  return m ? m[1] : null;
}
const sameCode = (a, b) => a.replace(/^0+/, '') === b.replace(/^0+/, '');
async function handleCode(text) {
  const code = extractCode(text);
  if (!code) {
    const isUrl = /^https?:\/\//i.test(text);
    openSheet(() => `<h2>QR-Code gelesen</h2>
      <div class="card" style="background:var(--card2);word-break:break-all"><span class="small">${esc(text)}</span></div>
      <p class="muted small">Das ist kein Produkt-Barcode – dazu gibt es keine Nährwerte.</p>
      ${isUrl ? `<a class="btn block" href="${esc(text)}" target="_blank" rel="noopener noreferrer">Link öffnen</a>` : ''}
      <button type="button" class="btn primary block" data-a="scan">Nochmal scannen</button>
      <button type="button" class="btn ghost block" data-a="scanCancel">Zurück</button>`);
    return;
  }
  const local = S.foods.find((f) => f.barcode && sameCode(f.barcode, code));
  if (local) { foundFood(local); return; }
  const loading = () => `<h2>Suche Produkt …</h2><p class="muted small">Barcode ${esc(code)}</p>`;
  openSheet(loading);
  let prod = null, failed = false;
  try { prod = await lookupProduct(code); } catch { failed = true; }
  if (ui.sheet !== loading) return; // inzwischen geschlossen
  const note = prod
    ? '✅ Gefunden in Open Food Facts. Werte kurz mit der Packung vergleichen und speichern – beim nächsten Scan geht es dann sofort, auch offline.'
    : failed
      ? '📡 Datenbank gerade nicht erreichbar (offline?). Trag die Werte von der Packung ein – der Barcode wird gespeichert.'
      : '🤷 Produkt nicht in der Datenbank. Trag die Werte von der Packung ein – der Barcode wird gespeichert.';
  ui.sheet = null;
  openSheet(sheetFoodEdit(null, { barcode: code, ...(prod || {}) }, note));
}
function foundFood(f) {
  f.used = Date.now();
  if (ui.pick) {
    ui.pick.food = f.id;
    ui.pick.amount = String(f.portion || 100);
    ui.pick.mode = 'list';
    ui.sheet = null;
    openSheet(sheetFoodPicker);
  } else {
    openSheet(sheetFoodEdit(f.id));
  }
  toast(`Erkannt: ${f.name}`);
}
async function lookupProduct(code) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const fields = 'product_name,product_name_de,brands,nutriments,serving_quantity';
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`, { signal: ctrl.signal });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j.status !== 1 || !j.product) return null;
    const p = j.product, n = p.nutriments || {};
    const val = (k) => (n[k] != null && n[k] !== '' && Number.isFinite(+n[k]) ? +n[k] : null);
    let kcal = val('energy-kcal_100g');
    if (kcal == null && val('energy_100g') != null) kcal = val('energy_100g') / 4.184; // kJ → kcal
    const brand = p.brands ? String(p.brands).split(',')[0].trim() : '';
    const base = (p.product_name_de || p.product_name || '').trim();
    const name = base ? (brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${base} (${brand})` : base) : `Produkt ${code}`;
    const serving = num(p.serving_quantity);
    return {
      name,
      kcal: kcal != null ? r0(kcal) : '',
      p: val('proteins_100g') != null ? r1(val('proteins_100g')) : '',
      c: val('carbohydrates_100g') != null ? r1(val('carbohydrates_100g')) : '',
      f: val('fat_100g') != null ? r1(val('fat_100g')) : '',
      portion: serving > 0 && serving < 2000 ? r0(serving) : 100,
    };
  } finally { clearTimeout(timer); }
}

// ---------- Backup ----------
async function exportData() {
  const withPhotos = $('#withPhotos') ? $('#withPhotos').checked : true;
  const data = { app: 'fit', version: 1, exported: new Date().toISOString(), state: S, photos: {} };
  if (withPhotos) {
    for (const ph of S.photos) {
      try { const b = await idb.get(ph.id); if (b) data.photos[ph.id] = await blobToDataURL(b); } catch { /* übersprungen */ }
    }
  }
  const name = `fit-backup-${dkey()}.json`;
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  let done = false;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'FIT Backup' }); done = true; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  if (!done) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  S.lastBackup = Date.now();
  commit();
  toast('Backup erstellt ✓');
}

async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || data.app !== 'fit' || !data.state) throw new Error('Keine FIT-Backup-Datei');
    if (!confirm('Backup laden? Deine aktuellen Daten auf diesem Gerät werden dabei ersetzt.')) return;
    const photos = data.photos || {};
    if (Object.keys(photos).length) {
      await idb.clear();
      photoUrls.forEach((u) => URL.revokeObjectURL(u));
      photoUrls.clear();
      for (const [id, url] of Object.entries(photos)) await idb.set(id, await dataURLToBlob(url));
    }
    S = migrate(data.state);
    saveNow();
    ui.view = S.active ? 'session' : 'today';
    render();
    toast('Backup geladen ✓');
  } catch (e) { toast('Import fehlgeschlagen: ' + e.message); }
}

// ---------- Actions ----------
const A = {};
const go = (v) => { ui.view = v; render(); window.scrollTo(0, 0); };
A.tab = (el) => go(el.dataset.v);
A.go = (el) => go(el.dataset.v);
A.closeSheet = closeSheet;
A.dateShift = (el) => { const n = addDays(ui.date, +el.dataset.n); if (n <= dkey()) { ui.date = n; render(); } };
A.dismissOnboard = () => { S.onboarded = true; commit(); };
A.hideInstall = () => { S.hideInstall = true; commit(); };

A.water = (el) => { const d = dayW(ui.date); d.water = Math.max(0, d.water + +el.dataset.v); commit(); };
A.supp = (el) => { const d = dayW(ui.date); const i = d.supps.indexOf(el.dataset.id); if (i >= 0) d.supps.splice(i, 1); else d.supps.push(el.dataset.id); commit(); };
A.addCardio = () => openSheet(sheetCardio);
A.saveCardio = () => {
  const v = formVals($('#cardioForm'));
  const min = num(v.min);
  if (!min) return toast('Minuten eintragen');
  dayW(ui.date).cardio.push({ type: v.type, min, km: num(v.km, null), kcal: num(v.kcal, null) });
  closeSheet(); commit();
};
A.delCardio = (el) => { dayW(ui.date).cardio.splice(+el.dataset.i, 1); commit(); };

// Training
A.startWorkout = (el) => {
  if (S.active && !confirm(`„${S.active.name}“ läuft noch. Verwerfen und neu starten?`)) return;
  const day = S.plan.days.find((d) => d.id === el.dataset.id);
  S.active = {
    id: uid(), dayId: day ? day.id : null, name: day ? day.name : 'Freies Training', start: Date.now(), note: '',
    exercises: (day ? day.ex : []).filter((e) => e.name.trim()).map((e) => ({
      name: e.name.trim(), target: `${e.sets} × ${e.reps}`, rest: e.rest || 90,
      sets: Array.from({ length: Math.max(1, e.sets | 0) }, () => ({ w: '', r: '', done: false })),
    })),
  };
  unlockAudio();
  keepAwake(true);
  ui.view = 'session';
  commit();
  window.scrollTo(0, 0);
};
A.setDone = (el) => {
  const e = S.active.exercises[+el.dataset.e];
  const s = e.sets[+el.dataset.s];
  s.done = !s.done;
  if (s.done) {
    const last = lastSets(e.name);
    const ph = last[+el.dataset.s] || last[last.length - 1];
    if (s.w === '' && ph) s.w = String(ph.w);
    if (s.r === '' && ph) s.r = String(ph.r);
    if (s.w === '' || s.r === '') { s.done = false; return toast('Gewicht und Wdh. eintragen'); }
    unlockAudio();
    startRest(e.rest);
  }
  commit();
};
A.addSet = (el) => { const e = S.active.exercises[+el.dataset.e]; const l = e.sets[e.sets.length - 1]; e.sets.push({ w: l ? l.w : '', r: l ? l.r : '', done: false }); commit(); };
A.delSet = (el) => { S.active.exercises[+el.dataset.e].sets.pop(); commit(); };
A.delSessionEx = (el) => { if (confirm('Übung aus diesem Training entfernen?')) { S.active.exercises.splice(+el.dataset.e, 1); commit(); } };
A.moveSessionEx = (el) => { move(S.active.exercises, +el.dataset.e, +el.dataset.n); commit(); };
A.addSessionEx = () => openSheet(sheetAddSessionEx);
A.addSessionExGo = (el) => {
  const name = (el.dataset.n || $('#newEx').value).trim();
  if (!name) return toast('Name eingeben');
  const last = lastSets(name);
  S.active.exercises.push({ name, target: '', rest: 90, sets: Array.from({ length: Math.max(3, last.length) }, () => ({ w: '', r: '', done: false })) });
  closeSheet(); commit();
  window.scrollTo(0, document.body.scrollHeight);
};
A.restAdd = () => { if (ui.rest) { ui.rest.end = Math.max(ui.rest.end, Date.now()) + 15000; ui.rest.total += 15; ui.rest.beeped = false; tick(); } };
A.restSkip = () => { ui.rest = null; tick(); };
A.finish = () => {
  const a = S.active;
  const exs = a.exercises.map((e) => ({ name: e.name, sets: e.sets.filter((s) => s.done).map((s) => ({ w: num(s.w), r: num(s.r) })) })).filter((e) => e.sets.length);
  if (!exs.length) {
    if (!confirm('Kein Satz abgehakt (✓). Training ohne Speichern beenden?')) return;
    S.active = null; ui.rest = null; keepAwake(false); go('train'); save(); return;
  }
  const before = new Map(records().map((r) => [r.name.toLowerCase(), r.v]));
  const w = { id: a.id, dayId: a.dayId, name: a.name, date: dkey(new Date(a.start)), start: a.start, end: Date.now(), note: a.note.trim(), exercises: exs };
  S.workouts.push(w);
  const prs = exs.filter((e) => { const best = Math.max(...e.sets.map((s) => (s.w > 0 && s.r > 0 ? e1rm(s.w, s.r) : 0))); const old = before.get(e.name.toLowerCase()); return old != null && best > old + 0.01; }).map((e) => e.name);
  S.active = null; ui.rest = null; keepAwake(false);
  ui.view = 'train';
  commit();
  window.scrollTo(0, 0);
  toast(prs.length ? `🏆 Neuer Rekord: ${prs.join(', ')}` : `Stark! ${saetze(setCount(w))} in ${fmtDur(w.end - w.start)} 💪`);
};
A.cancelWorkout = () => { if (confirm('Training wirklich verwerfen? Nichts wird gespeichert.')) { S.active = null; ui.rest = null; keepAwake(false); ui.view = 'train'; commit(); } };
A.showWorkout = (el) => openSheet(sheetWorkout(el.dataset.id));
A.delWorkout = (el) => { if (confirm('Dieses Training löschen?')) { S.workouts = S.workouts.filter((w) => w.id !== el.dataset.id); closeSheet(); commit(); } };
A.progress = (el) => openSheet(sheetProgress(el.dataset.n));

// Plan
function move(arr, i, n) { const j = i + n; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
A.toggleWd = (el) => { const d = S.plan.days[+el.dataset.d]; const w = +el.dataset.w; d.wd = d.wd.includes(w) ? d.wd.filter((x) => x !== w) : [...d.wd, w]; commit(); };
A.addPlanEx = (el) => { S.plan.days[+el.dataset.d].ex.push(ex('', 3, '8-12')); commit(); };
A.delPlanEx = (el) => { S.plan.days[+el.dataset.d].ex.splice(+el.dataset.e, 1); commit(); };
A.moveEx = (el) => { move(S.plan.days[+el.dataset.d].ex, +el.dataset.e, +el.dataset.n); commit(); };
A.addPlanDay = () => { S.plan.days.push({ id: uid(), name: `Tag ${S.plan.days.length + 1}`, wd: [], ex: [ex('', 3, '8-12')] }); commit(); };
A.delPlanDay = (el) => { const d = S.plan.days[+el.dataset.d]; if (confirm(`„${d.name}“ löschen?`)) { S.plan.days.splice(+el.dataset.d, 1); commit(); } };
A.preset = (el) => { if (confirm('Aktuellen Plan durch die Vorlage ersetzen?')) { S.plan = presetPlan(el.dataset.v); commit(); toast('Plan übernommen'); } };

// Essen
A.addFood = (el) => { ui.pick = { slot: el.dataset.slot, q: '', food: null, amount: '', mode: 'list' }; openSheet(sheetFoodPicker); setTimeout(() => { const q = $('#pickQ'); if (q && matchMedia('(hover: hover)').matches) q.focus(); }, 50); };
A.pickFood = (el) => { const f = S.foods.find((x) => x.id === el.dataset.id); ui.pick.food = f.id; ui.pick.amount = String(f.portion || 100); renderSheet(); };
A.pickAmount = (el) => { ui.pick.amount = el.dataset.v; renderSheet(); };
A.pickBack = () => { if (!ui.pick) return closeSheet(); ui.pick.food = null; ui.pick.mode = 'list'; ui.sheet = sheetFoodPicker; renderSheet(); };
A.quickMode = () => { ui.pick.mode = 'quick'; renderSheet(); };
A.pickAdd = () => {
  const f = S.foods.find((x) => x.id === ui.pick.food);
  const g = num(ui.pick.amount);
  if (!g) return toast('Menge eintragen');
  const per = { kcal: f.kcal, p: f.p, c: f.c, f: f.f };
  (S.meals[ui.date] = S.meals[ui.date] || []).push({ id: uid(), slot: ui.pick.slot, name: f.name, foodId: f.id, amount: g, per, ...macrosFor(per, g) });
  f.used = Date.now();
  const slot = ui.pick.slot;
  closeSheet(); commit();
  toast(`${f.name} → ${slot}`);
};
A.quickAdd = () => {
  const v = formVals($('#quickForm'));
  const m = { kcal: num(v.kcal), p: num(v.p), c: num(v.c), f: num(v.f) };
  if (!m.kcal) m.kcal = m.p * 4 + m.c * 4 + m.f * 9;
  if (!m.kcal) return toast('Kalorien oder Makros eintragen');
  (S.meals[ui.date] = S.meals[ui.date] || []).push({ id: uid(), slot: ui.pick.slot, name: v.name.trim() || 'Schnelleintrag', amount: null, per: null, ...m });
  closeSheet(); commit();
};
A.editEntry = (el) => openSheet(sheetEntry(el.dataset.id));
A.saveEntry = (el) => {
  const e = entries(ui.date).find((x) => x.id === el.dataset.id);
  const v = formVals($('#entryForm'));
  if (e.per) { e.amount = num(v.amount); Object.assign(e, macrosFor(e.per, e.amount)); }
  else Object.assign(e, { kcal: num(v.kcal), p: num(v.p), c: num(v.c), f: num(v.f) });
  e.slot = v.slot;
  closeSheet(); commit();
};
A.delEntry = (el) => { S.meals[ui.date] = entries(ui.date).filter((x) => x.id !== el.dataset.id); closeSheet(); commit(); };
A.copyDay = () => {
  const y = entries(addDays(ui.date, -1));
  if (!y.length) return toast('Gestern ist nichts eingetragen');
  if (!confirm(`${y.length} Einträge von gestern übernehmen?`)) return;
  S.meals[ui.date] = entries(ui.date).concat(y.map((e) => ({ ...e, id: uid() })));
  commit();
};
A.scan = () => { ui.sheet = null; openSheet(sheetScan); startScanner(); };
A.scanManual = () => {
  const v = ($('#manualCode').value || '').replace(/\D/g, '');
  if (v.length < 8) return toast('Barcode hat 8–14 Ziffern');
  stopScanner();
  handleCode(v);
};
A.scanCancel = () => { if (ui.pick) { stopScanner(); A.pickBack(); } else closeSheet(); };
A.newFood = () => { const q = ui.pick ? ui.pick.q : ''; ui.sheet = null; openSheet(sheetFoodEdit(null, { name: q })); };
A.editFood = (el) => openSheet(sheetFoodEdit(el.dataset.id));
A.saveFood = (el) => {
  const v = formVals($('#foodForm'));
  if (!v.name.trim()) return toast('Name fehlt');
  const data = { name: v.name.trim(), p: num(v.p), c: num(v.c), f: num(v.f), portion: num(v.portion, 100) || 100, fav: v.fav, barcode: (v.barcode || '').replace(/\D/g, '') };
  data.kcal = v.kcal === '' ? r0(data.p * 4 + data.c * 4 + data.f * 9) : num(v.kcal);
  let f = S.foods.find((x) => x.id === el.dataset.id);
  if (f) Object.assign(f, data);
  else { f = { id: uid(), used: 0, ...data }; S.foods.push(f); }
  if (ui.pick) { ui.pick.food = f.id; ui.pick.amount = String(f.portion); ui.pick.mode = 'list'; ui.sheet = sheetFoodPicker; save(); render(); renderSheet(); return; }
  closeSheet(); commit(); toast('Gespeichert');
};
A.delFood = (el) => { if (confirm('Lebensmittel löschen? Bereits eingetragene Mahlzeiten bleiben erhalten.')) { S.foods = S.foods.filter((x) => x.id !== el.dataset.id); closeSheet(); commit(); } };

// Körper
A.bodyRange = (el) => { ui.bodyRange = +el.dataset.v; render(); };
A.addMeasure = () => openSheet(sheetMeasure);
A.saveMeasure = () => {
  const v = formVals($('#measForm'));
  const m = { id: uid(), date: v.date || dkey() };
  let any = false;
  for (const [k] of MEAS) { const n = num(v[k], null); if (n) { m[k] = n; any = true; } }
  if (!any) return toast('Mindestens einen Wert eintragen');
  S.measures.push(m);
  closeSheet(); commit();
};
A.delMeasure = (el) => { if (confirm('Messung löschen?')) { S.measures = S.measures.filter((m) => m.id !== el.dataset.id); commit(); } };
A.showPhoto = (el) => {
  const id = el.dataset.id;
  openSheet(() => { const ph = S.photos.find((x) => x.id === id); return ph ? `<h2>${pkey(ph.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</h2><img class="photo-full" data-photo="${id}" alt=""><button type="button" class="btn ghost block danger" style="margin-top:12px" data-a="delPhoto" data-id="${id}">Foto löschen</button>` : ''; });
};
A.delPhoto = async (el) => {
  if (!confirm('Foto löschen?')) return;
  const id = el.dataset.id;
  S.photos = S.photos.filter((p) => p.id !== id);
  try { await idb.del(id); } catch { /* egal */ }
  if (photoUrls.has(id)) { URL.revokeObjectURL(photoUrls.get(id)); photoUrls.delete(id); }
  closeSheet(); commit();
};
A.comparePhotos = () => {
  const ps = S.photos.slice().sort((a, b) => a.date.localeCompare(b.date));
  ui.cmp = { a: ps[0].id, b: ps[ps.length - 1].id };
  openSheet(() => {
    const all = S.photos.slice().sort((a, b) => a.date.localeCompare(b.date));
    const sel = (side) => `<select data-c="cmp" data-f="${side}">${all.map((p) => `<option value="${p.id}" ${ui.cmp[side] === p.id ? 'selected' : ''}>${shortDate(p.date)}</option>`).join('')}</select>`;
    return `<h2>Vorher / Nachher</h2><div class="compare">
      <figure><img data-photo="${ui.cmp.a}" alt="">${sel('a')}</figure>
      <figure><img data-photo="${ui.cmp.b}" alt="">${sel('b')}</figure></div>`;
  });
};

// Mehr / Rechner
A.sex = (el) => { S.profile.sex = el.dataset.v; commit(); };
A.useLastWeight = () => { S.profile.weight = r1(lastWeight()); commit(); };
A.applyCalc = () => {
  const m = calcMacros(S.profile);
  S.targets = { kcal: m.kcal, p: m.p, c: m.c, f: m.f };
  S.onboarded = true;
  commit();
  toast(`Ziel gesetzt: ${fmt(m.kcal)} kcal`);
};
A.addSupp = () => { S.supps.push({ id: uid(), name: 'Neues Supplement', dose: '' }); commit(); };
A.delSupp = (el) => { S.supps.splice(+el.dataset.i, 1); commit(); };
A.export = () => exportData();
A.reset = async () => {
  if (!confirm('Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.')) return;
  if (!confirm('Letzte Chance: Hast du ein Backup? Jetzt alles löschen?')) return;
  try { await idb.clear(); } catch { /* egal */ }
  localStorage.removeItem(KEY);
  S = defaults();
  ui.view = 'today';
  commit();
  toast('Alles zurückgesetzt');
};

// ---------- Change / input handlers ----------
const C = {};
C.day = (el) => { const d = dayW(ui.date); d[el.dataset.f] = el.value === '' ? null : num(el.value); commit(); };
C.prof = (el) => { S.profile[el.dataset.f] = num(el.value); commit(); };
C.target = (el) => { S.targets[el.dataset.f] = r0(num(el.value)); commit(); };
C.supp = (el) => { S.supps[+el.dataset.i][el.dataset.f] = el.value; save(); };
C.planDay = (el) => { S.plan.days[+el.dataset.d][el.dataset.f] = el.value; save(); };
C.planEx = (el) => {
  const e = S.plan.days[+el.dataset.d].ex[+el.dataset.e];
  const f = el.dataset.f;
  e[f] = f === 'sets' || f === 'rest' ? Math.max(f === 'sets' ? 1 : 0, r0(num(el.value))) : el.value;
  save();
};
C.cmp = (el) => { ui.cmp[el.dataset.f] = el.value; renderSheet(); };
C.photo = async (el) => {
  const file = el.files && el.files[0];
  if (!file) return;
  try {
    toast('Foto wird gespeichert …');
    const blob = await compressImage(file);
    const id = uid();
    await idb.set(id, blob);
    S.photos.push({ id, date: dkey() });
    commit();
    toast('Foto gespeichert ✓');
  } catch (e) { toast('Foto fehlgeschlagen: ' + (e.message || e)); }
  el.value = '';
};
C.import = (el) => { const f = el.files && el.files[0]; if (f) importData(f); el.value = ''; };

const I = {};
I.set = (el) => { S.active.exercises[+el.dataset.e].sets[+el.dataset.s][el.dataset.f] = el.value.replace(',', '.'); save(); };
I.note = (el) => { S.active.note = el.value; save(); };
I.pickQ = (el) => { ui.pick.q = el.value; $('#pickList').innerHTML = pickList(el.value); };
I.pickAmt = (el) => {
  ui.pick.amount = el.value;
  const f = S.foods.find((x) => x.id === ui.pick.food);
  $('#pickPrev').innerHTML = mtxt(macrosFor(f, num(el.value)));
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  // Klick auf ein Eingabefeld innerhalb einer klickbaren Karte nicht abfangen
  if (e.target !== el && e.target.closest('input, select, textarea, label')) return;
  const fn = A[el.dataset.a];
  if (fn) fn(el, e);
});
document.addEventListener('change', (e) => { const el = e.target.closest('[data-c]'); if (el && C[el.dataset.c]) C[el.dataset.c](el, e); });
document.addEventListener('input', (e) => { const el = e.target.closest('[data-i]'); if (el && I[el.dataset.i]) I[el.dataset.i](el, e); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'newEx') A.addSessionExGo(e.target);
  if (e.key === 'Enter' && e.target.id === 'manualCode') A.scanManual();
  if (e.key === 'Escape' && ui.sheet) closeSheet();
});

// ---------- Render ----------
const TAB_OF = { today: 'today', train: 'train', plan: 'train', session: 'train', food: 'food', foods: 'food', body: 'body', more: 'more', calc: 'more' };
function render() {
  const v = views[ui.view] ? ui.view : 'today';
  $('#app').innerHTML = views[v]();
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === TAB_OF[v]));
  hydratePhotos($('#app'));
  if (v === 'more') persistInfo();
}
async function persistInfo() {
  const el = $('#persist');
  if (!el || !navigator.storage || !navigator.storage.persisted) return;
  try { const p = await navigator.storage.persisted(); el.textContent = p ? ' · Speicher dauerhaft geschützt ✓' : ''; } catch { /* egal */ }
}

// Tageswechsel (App bleibt über Nacht offen)
let lastToday = dkey();
setInterval(() => { const t = dkey(); if (t !== lastToday) { if (ui.date === lastToday) ui.date = t; lastToday = t; render(); } }, 60000);

render();
if (S.active) keepAwake(true);
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => console.warn('SW', e)));
}
