// Reine Rechenlogik ohne DOM – wird in der App und in den Tests (node --test) genutzt.
// Grundsatz: Kennzahlen nur aus echten Einträgen. Reichen die Daten nicht, kommt null zurück.

// ---------- Datum ----------
const pad = (n) => String(n).padStart(2, '0');
export const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const pkey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (k, n) => { const d = pkey(k); d.setDate(d.getDate() + n); return dkey(d); };
export const daysBetween = (a, b) => Math.round((pkey(b) - pkey(a)) / 864e5);
export const weekdayOf = (k) => pkey(k).getDay();
export function weekKeys(k) {
  const monday = addDays(k, -((weekdayOf(k) + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
export const mondayOf = (k) => weekKeys(k)[0];

// ---------- Zahlen & Validierung ----------
export const num = (v, def = 0) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : def;
  const s = String(v ?? '').trim().replace(',', '.');
  if (s === '') return def;
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
};
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const r0 = (n) => Math.round(n);
export const r1 = (n) => Math.round(n * 10) / 10;

/** Prüft eine Zahl gegen Grenzen. Liefert {ok, value, error}. */
export function validate(raw, { min = -Infinity, max = Infinity, required = true, label = 'Wert' } = {}) {
  const s = String(raw ?? '').trim();
  if (s === '') return required ? { ok: false, value: null, error: `${label} fehlt` } : { ok: true, value: null };
  const n = num(s, NaN);
  if (!Number.isFinite(n)) return { ok: false, value: null, error: `${label}: keine gültige Zahl` };
  if (n < min || n > max) return { ok: false, value: null, error: `${label} muss zwischen ${min} und ${max} liegen` };
  return { ok: true, value: n };
}
export const LIMITS = {
  bodyKg: { min: 25, max: 350, label: 'Gewicht' },
  liftKg: { min: 0, max: 1000, label: 'Gewicht' },
  reps: { min: 0, max: 200, label: 'Wiederholungen' },
  grams: { min: 0, max: 5000, label: 'Menge' },
  kcal: { min: 0, max: 10000, label: 'Kalorien' },
  macro: { min: 0, max: 1000, label: 'Makro' },
  cm: { min: 10, max: 300, label: 'Maß' },
};

// ---------- Makro-Rechner ----------
export function calcMacros(p) {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5);
  const tdee = bmr * p.activity;
  const raw = tdee - p.deficit;
  const kcal = Math.max(1200, raw);
  const prot = p.proteinPerKg * p.weight;
  const fat = p.fatPerKg * p.weight;
  const carbs = Math.max(0, (kcal - prot * 4 - fat * 9) / 4);
  return { bmr: r0(bmr), tdee: r0(tdee), kcal: r0(kcal), p: r0(prot), c: r0(carbs), f: r0(fat), floored: raw < 1200 };
}

// ---------- Ernährung ----------
export const macrosFor = (per, g) => ({ kcal: (per.kcal * g) / 100, p: (per.p * g) / 100, c: (per.c * g) / 100, f: (per.f * g) / 100 });
export const sumMacros = (list) => list.reduce((a, e) => ({ kcal: a.kcal + (e.kcal || 0), p: a.p + (e.p || 0), c: a.c + (e.c || 0), f: a.f + (e.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
export const kcalFromMacros = (p, c, f) => p * 4 + c * 4 + f * 9;

/** Tage der letzten n Tage (bis inkl. today), an denen etwas gegessen wurde, mit Zielerreichung. */
export function nutritionAdherence(meals, targets, today, n = 7) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = addDays(today, -i);
    const list = meals[k] || [];
    if (!list.length) continue;
    const t = sumMacros(list);
    days.push({ date: k, ...t, kcalOk: Math.abs(t.kcal - targets.kcal) <= targets.kcal * 0.1, proteinOk: t.p >= targets.p * 0.9 });
  }
  return { logged: days.length, kcalOk: days.filter((d) => d.kcalOk).length, proteinOk: days.filter((d) => d.proteinOk).length, days };
}

// ---------- Körpergewicht ----------
/** Ein Wert pro Tag (Durchschnitt aller Messungen des Tages), sortiert. */
export function dailyWeights(entries) {
  const byDay = new Map();
  for (const e of entries) {
    const k = dkey(new Date(e.ts));
    const cur = byDay.get(k) || [];
    cur.push(e.kg);
    byDay.set(k, cur);
  }
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([x, arr]) => ({ x, y: arr.reduce((s, v) => s + v, 0) / arr.length }));
}
/** Gleitender 7-Tage-Schnitt (über Kalendertage, nicht Einträge). */
export function rollingAvg(daily, windowDays = 7) {
  return daily.map((p) => {
    const from = addDays(p.x, -(windowDays - 1));
    const win = daily.filter((q) => q.x >= from && q.x <= p.x);
    return { x: p.x, y: win.reduce((a, q) => a + q.y, 0) / win.length, n: win.length };
  });
}
/** Schnittwert zu einem Stichtag: Schnitt der Tageswerte im 7-Tage-Fenster bis zum Stichtag. */
function avgAt(daily, k) {
  const from = addDays(k, -6);
  const win = daily.filter((q) => q.x >= from && q.x <= k);
  return win.length ? win.reduce((a, q) => a + q.y, 0) / win.length : null;
}
/**
 * Veränderung über `days` Tage auf Basis geglätteter Werte.
 * Braucht Daten im aktuellen Fenster und im Fenster `days` Tage davor, sonst null.
 */
export function weightChange(daily, today, days) {
  if (!daily.length) return null;
  const last = daily[daily.length - 1].x;
  const ref = last > today ? today : last;
  const now = avgAt(daily, ref);
  const before = avgAt(daily, addDays(ref, -days));
  if (now == null || before == null) return null;
  return now - before;
}
/** Wochen-Tempo aus den letzten bis zu 28 Tagen (lineare Regression über Tageswerte). Mind. 7 Tage Spanne und 4 Werte. */
export function weeklyRate(daily) {
  if (daily.length < 4) return null;
  const end = daily[daily.length - 1].x;
  const pts = daily.filter((p) => p.x >= addDays(end, -27));
  if (pts.length < 4) return null;
  const xs = pts.map((p) => daysBetween(pts[0].x, p.x));
  if (xs[xs.length - 1] < 7) return null;
  const mx = xs.reduce((a, v) => a + v, 0) / xs.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  let sxy = 0, sxx = 0;
  pts.forEach((p, i) => { sxy += (xs[i] - mx) * (p.y - my); sxx += (xs[i] - mx) ** 2; });
  return sxx ? (sxy / sxx) * 7 : null;
}
export function currentWeight(daily) {
  if (!daily.length) return null;
  const avg = rollingAvg(daily);
  return { latest: daily[daily.length - 1].y, latestDate: daily[daily.length - 1].x, trend: avg[avg.length - 1].y, trendN: avg[avg.length - 1].n };
}

// ---------- Training ----------
export const e1rm = (w, r) => (r <= 0 || w <= 0 ? 0 : r === 1 ? w : w * (1 + r / 30));
export const setVolume = (s) => (s.w > 0 && s.r > 0 ? s.w * s.r : 0);
export const workoutVolume = (w) => w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + setVolume(s), 0), 0);
export const workoutSets = (w) => w.exercises.reduce((a, e) => a + e.sets.length, 0);
const exKey = (e) => e.exId || 'name:' + e.name.trim().toLowerCase();
export { exKey };

/** Letzte Sätze einer Übung vor einem Zeitpunkt (für „Letztes Mal“). */
export function lastPerformance(workouts, key, beforeTs = Infinity) {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const w = workouts[i];
    if (w.start >= beforeTs) continue;
    const e = w.exercises.find((x) => exKey(x) === key);
    if (e && e.sets.length) return { date: w.date, workoutId: w.id, sets: e.sets };
  }
  return null;
}

/** Bestwerte pro Übung (über e1RM) aus allen Trainings. */
export function bestByExercise(workouts) {
  const m = new Map();
  for (const w of workouts) for (const e of w.exercises) for (const s of e.sets) {
    const v = e1rm(s.w, s.r);
    if (!v) continue;
    const k = exKey(e);
    const cur = m.get(k);
    if (!cur || v > cur.e1rm) m.set(k, { key: k, name: e.name, e1rm: v, w: s.w, r: s.r, date: w.date, maxW: Math.max(cur ? cur.maxW : 0, s.w) });
    else if (s.w > cur.maxW) cur.maxW = s.w;
  }
  return m;
}

/**
 * Rekord-Ereignisse in zeitlicher Reihenfolge. Das erste Training einer Übung ist die Basis,
 * ein Rekord zählt nur, wenn ein früherer Bestwert übertroffen wurde.
 */
export function prEvents(workouts) {
  const best = new Map();
  const events = [];
  const sorted = workouts.slice().sort((a, b) => a.start - b.start);
  for (const w of sorted) for (const e of w.exercises) {
    let top = null;
    for (const s of e.sets) { const v = e1rm(s.w, s.r); if (v && (!top || v > top.v)) top = { v, w: s.w, r: s.r }; }
    if (!top) continue;
    const k = exKey(e);
    const prev = best.get(k);
    if (prev != null && top.v > prev + 1e-9) events.push({ key: k, name: e.name, date: w.date, workoutId: w.id, e1rm: top.v, prev, w: top.w, r: top.r });
    if (prev == null || top.v > prev) best.set(k, top.v);
  }
  return events;
}

/** Verlauf des besten e1RM pro Trainingstag für eine Übung. */
export function exerciseProgress(workouts, key) {
  const byDay = new Map();
  for (const w of workouts) for (const e of w.exercises) {
    if (exKey(e) !== key) continue;
    for (const s of e.sets) { const v = e1rm(s.w, s.r); if (v) byDay.set(w.date, Math.max(byDay.get(w.date) || 0, v)); }
  }
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([x, y]) => ({ x, y }));
}

/** Volumen und Einheiten pro Kalenderwoche der letzten n Wochen (inkl. aktueller). */
export function weeklyTraining(workouts, today, n = 8) {
  const thisMonday = mondayOf(today);
  const weeks = Array.from({ length: n }, (_, i) => ({ week: addDays(thisMonday, -7 * (n - 1 - i)), volume: 0, sessions: 0, sets: 0 }));
  for (const w of workouts) {
    const wk = weeks.find((x) => w.date >= x.week && w.date <= addDays(x.week, 6));
    if (!wk) continue;
    wk.volume += workoutVolume(w);
    wk.sessions += 1;
    wk.sets += workoutSets(w);
  }
  return weeks;
}

/** Arbeitssätze pro Muskelgruppe im Zeitraum [from, to]. muscleOf(key) liefert die Muskelgruppe. */
export function setsPerMuscle(workouts, from, to, muscleOf) {
  const m = new Map();
  for (const w of workouts) {
    if (w.date < from || w.date > to) continue;
    for (const e of w.exercises) {
      const mu = muscleOf(e) || 'Sonstiges';
      m.set(mu, (m.get(mu) || 0) + e.sets.length);
    }
  }
  return [...m.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}

/** Vergleich mit der vorherigen Einheit desselben Trainingstags (oder gleichen Namens). */
export function compareWithPrevious(workouts, w) {
  const prev = workouts.filter((x) => x.id !== w.id && x.start < w.start && ((w.dayId && x.dayId === w.dayId) || x.name === w.name)).sort((a, b) => b.start - a.start)[0];
  if (!prev) return null;
  const v = workoutVolume(w), pv = workoutVolume(prev);
  return { prev, volume: v, prevVolume: pv, deltaPct: pv ? ((v - pv) / pv) * 100 : null, sets: workoutSets(w), prevSets: workoutSets(prev) };
}

// ---------- Ziele ----------
/** Kraftziel: kg × reps. Fortschritt = bestes Gewicht bei mind. `reps` Wdh. / Ziel-kg. */
export function strengthGoalProgress(workouts, goal) {
  let bestW = 0, bestDate = null;
  for (const w of workouts) for (const e of w.exercises) {
    if (exKey(e) !== goal.key) continue;
    for (const s of e.sets) if (s.r >= goal.reps && s.w > bestW) { bestW = s.w; bestDate = w.date; }
  }
  return { bestW, bestDate, pct: goal.kg > 0 ? Math.min(1, bestW / goal.kg) : 0, done: bestW >= goal.kg && goal.kg > 0 };
}
/** Gewichtsziel: Fortschritt vom ersten Eintrag zum Ziel (funktioniert für Ab- und Zunehmen). */
export function weightGoalProgress(daily, target) {
  if (!daily.length || target == null) return null;
  const start = daily[0].y;
  const avg = rollingAvg(daily);
  const cur = avg[avg.length - 1].y;
  const total = start - target;
  if (Math.abs(total) < 0.05) return { start, cur, target, pct: 1, done: true, left: cur - target };
  const pct = clamp((start - cur) / total, 0, 1);
  const done = total > 0 ? cur <= target : cur >= target;
  return { start, cur, target, pct, done, left: cur - target };
}
export function weeksToGoal(cur, target, ratePerWeek) {
  if (cur == null || target == null || ratePerWeek == null) return null;
  const left = target - cur;
  if (Math.abs(left) < 0.05) return 0;
  if (Math.sign(left) !== Math.sign(ratePerWeek) || Math.abs(ratePerWeek) < 0.05) return null;
  return left / ratePerWeek;
}
