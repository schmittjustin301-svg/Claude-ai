// Gamification: XP, Level, Erfolge, Serien, Tagesmissionen, eigene Ziele. Reine Logik ohne DOM.
//
// Grundprinzip: Das XP-Konto wird bei jedem Aufruf AUS DEN DATEN abgeleitet (kein Hochzählen).
// Jede Belohnung hat einen eindeutigen Schlüssel – doppelte Belohnungen sind damit unmöglich, und
// bearbeitete oder gelöschte Einträge halten das Konto automatisch stimmig.
// Belohnt wird Beständigkeit, nicht Menge: max. eine Trainings-Belohnung pro Tag, Supplements nur für
// „Plan eingehalten“, nie für zusätzliche Einnahmen.
import { dkey, addDays, mondayOf, sumMacros, prEvents, dailyWeights, rollingAvg, strengthGoalProgress, clamp, workoutVolume } from './logic.js';
import { dayAdherence, suppOccurrences } from './schedule.js';

/** Geplante Einnahmen eines Tages und wie viele davon genommen wurden (unabhängig von der Uhrzeit). */
export function suppDay(S, date) {
  const occ = suppOccurrences(S, date);
  const taken = occ.filter((o) => S.intakes[date]?.[o.key]?.status === 'taken').length;
  return { total: occ.length, taken };
}

// ---------- Tagesfakten ----------
export function dayFacts(S, date) {
  const list = S.meals[date] || [];
  const t = sumMacros(list), T = S.targets;
  const day = S.days[date] || {};
  const water = day.water || 0;
  const sup = suppDay(S, date);
  const workouts = S.workouts.filter((w) => w.date === date);
  const habits = S.habitLog[date] || [];
  return {
    date, logged: list.length > 0, kcal: t.kcal, p: t.p, water,
    proteinHit: list.length > 0 && T.p > 0 && t.p >= T.p * 0.95,
    kcalHit: list.length > 0 && T.kcal > 0 && Math.abs(t.kcal - T.kcal) <= T.kcal * 0.1,
    waterHit: S.profile.waterGoal > 0 && water >= S.profile.waterGoal,
    suppsAll: sup.total > 0 && sup.taken === sup.total,
    workouts: workouts.length,
    tracked: list.length > 0 || water > 0 || workouts.length > 0 || S.weights.some((w) => dkey(new Date(w.ts)) === date) || habits.length > 0 || Object.keys(S.intakes[date] || {}).length > 0,
    habits,
  };
}
/** Alle Tage mit irgendeiner Aktivität bis heute. */
function activeDates(S, today) {
  const set = new Set([...Object.keys(S.meals), ...Object.keys(S.days), ...Object.keys(S.intakes), ...Object.keys(S.habitLog), ...S.workouts.map((w) => w.date), ...S.weights.map((w) => dkey(new Date(w.ts)))]);
  return [...set].filter((d) => d <= today).sort();
}

// ---------- XP-Konto ----------
export function ledger(S, today = dkey(), now = Date.now()) {
  const X = S.xpConfig, ev = [];
  const add = (key, date, xp, label, kind) => { if (xp > 0) ev.push({ key, date, xp, label, kind }); };
  // Training: eine Belohnung pro Tag, egal wie viele Einheiten
  const byDay = new Map();
  for (const w of S.workouts.slice().sort((a, b) => a.start - b.start)) if (!byDay.has(w.date)) byDay.set(w.date, w);
  for (const [d, w] of byDay) add(`workout:${d}`, d, X.workout, `Training: ${w.name}`, 'workout');
  for (const p of prEvents(S.workouts)) add(`pr:${p.workoutId}:${p.key}`, p.date, X.pr, `Rekord: ${p.name}`, 'pr');
  for (const d of activeDates(S, today)) {
    const f = dayFacts(S, d, now);
    if (f.proteinHit) add(`protein:${d}`, d, X.protein, 'Proteinziel erreicht', 'protein');
    if (f.kcalHit && d < today) add(`kcal:${d}`, d, X.kcal, 'Kalorien im Zielbereich', 'kcal'); // erst nach Tagesende endgültig
    if (f.waterHit) add(`water:${d}`, d, X.water, 'Trinkziel erreicht', 'water');
    if (f.suppsAll) add(`supps:${d}`, d, X.supps, 'Supplement-Plan eingehalten', 'supps');
    for (const h of f.habits) { const hb = S.habits.find((x) => x.id === h); if (hb) add(`habit:${h}:${d}`, d, X.habit, `Gewohnheit: ${hb.name}`, 'habit'); }
  }
  // Wochenziel Training (Wochen ab Montag)
  const target = S.goals.weeklySessions || 0;
  if (target) {
    const weeks = new Map();
    for (const w of S.workouts) { const m = mondayOf(w.date); weeks.set(m, (weeks.get(m) || 0) + 1); }
    for (const [m, n] of weeks) if (n >= target) add(`week:${m}`, addDays(m, 6) < today ? addDays(m, 6) : today, X.weekGoal, 'Wochenziel Training erreicht', 'week');
  }
  for (const g of S.goals.custom) if (g.status === 'done' && g.doneAt) add(`goal:${g.id}`, g.doneAt, X.goal, `Ziel erreicht: ${g.name}`, 'goal');
  for (const [id, d] of Object.entries(S.achievements)) { const a = ACHIEVEMENTS.find((x) => x.id === id); if (a) add(`ach:${id}`, d, X.achievement, `Erfolg: ${a.name}`, 'achievement'); }
  return ev.sort((a, b) => b.date.localeCompare(a.date));
}
export const totalXP = (ev) => ev.reduce((a, e) => a + e.xp, 0);
/** Level-Kurve: Level L beginnt bei 50·L·(L−1) XP (100, 300, 600, 1000 …). */
export const levelStart = (L) => 50 * L * (L - 1);
export function levelInfo(xp) {
  let L = 1;
  while (levelStart(L + 1) <= xp) L++;
  const from = levelStart(L), to = levelStart(L + 1);
  return { level: L, xp, from, to, into: xp - from, need: to - xp, pct: (xp - from) / (to - from) };
}

// ---------- Serien ----------
/** Aktuelle und beste Serie für eine Tages-Bedingung. Heute zählt, sobald erfüllt; offen heißt nicht „gerissen“. */
export function streak(S, test, today = dkey(), maxDays = 730) {
  let best = 0, run = 0, first = null;
  const dates = activeDates(S, today);
  if (!dates.length) return { current: 0, best: 0 };
  first = dates[0] < addDays(today, -maxDays) ? addDays(today, -maxDays) : dates[0];
  for (let d = first; d <= today; d = addDays(d, 1)) {
    if (test(d)) { run++; best = Math.max(best, run); } else if (d !== today) run = 0;
  }
  // „current“: endet heute (falls erfüllt) oder gestern
  let current = 0;
  for (let d = test(today) ? today : addDays(today, -1); test(d); d = addDays(d, -1)) current++;
  return { current, best };
}
export function streaks(S, today = dkey(), now = Date.now()) {
  const memo = new Map();
  const f = (d) => { if (!memo.has(d)) memo.set(d, dayFacts(S, d, now)); return memo.get(d); };
  const out = [
    { id: 'tracking', name: 'Tracking', desc: 'Tage mit Einträgen', ...streak(S, (d) => f(d).tracked, today) },
    { id: 'water', name: 'Trinkziel', desc: 'Tage mit erreichtem Trinkziel', ...streak(S, (d) => f(d).waterHit, today) },
    { id: 'protein', name: 'Protein', desc: 'Tage mit erreichtem Proteinziel', ...streak(S, (d) => f(d).proteinHit, today) },
  ];
  if (S.supps.some((x) => !x.archived && (x.schedule || []).length)) out.push({ id: 'supps', name: 'Supplement-Plan', desc: 'Tage mit allen geplanten Einnahmen', ...streak(S, (d) => f(d).suppsAll, today) });
  for (const h of S.habits) out.push({ id: 'habit:' + h.id, name: h.name, desc: 'Gewohnheit', ...streak(S, (d) => f(d).habits.includes(h.id), today) });
  return out;
}

// ---------- Erfolge ----------
const runOf = (S, pred, today, n) => streak(S, pred, today).best >= n;
export const ACHIEVEMENTS = [
  { id: 'first_workout', name: 'Erstes Training', desc: 'Ein Training abgeschlossen', icon: 'dumbbell', test: (S) => S.workouts.length >= 1 },
  { id: 'workouts_10', name: '10 Trainings', desc: '10 Trainings abgeschlossen', icon: 'dumbbell', test: (S) => S.workouts.length >= 10 },
  { id: 'workouts_50', name: '50 Trainings', desc: '50 Trainings abgeschlossen', icon: 'dumbbell', test: (S) => S.workouts.length >= 50 },
  { id: 'workouts_100', name: '100 Trainings', desc: '100 Trainings abgeschlossen', icon: 'trophy', test: (S) => S.workouts.length >= 100 },
  { id: 'first_pr', name: 'Erster Rekord', desc: 'Eine frühere Bestleistung übertroffen', icon: 'trophy', test: (S) => prEvents(S.workouts).length >= 1 },
  { id: 'pr_10', name: '10 Rekorde', desc: '10 Bestleistungen übertroffen', icon: 'trophy', test: (S) => prEvents(S.workouts).length >= 10 },
  { id: 'volume_10t', name: '10 Tonnen', desc: '10.000 kg Volumen in einer Woche', icon: 'bolt', test: (S) => { const m = new Map(); S.workouts.forEach((w) => { const k = mondayOf(w.date); m.set(k, (m.get(k) || 0) + workoutVolume(w)); }); return [...m.values()].some((v) => v >= 10000); } },
  { id: 'streak_7', name: '7-Tage-Serie', desc: '7 Tage am Stück etwas getrackt', icon: 'flame', test: (S, c) => runOf(S, (d) => c.f(d).tracked, c.today, 7) },
  { id: 'streak_30', name: '30-Tage-Serie', desc: '30 Tage am Stück etwas getrackt', icon: 'flame', test: (S, c) => runOf(S, (d) => c.f(d).tracked, c.today, 30) },
  { id: 'nutrition', name: 'Ernährung im Griff', desc: 'An 5 Tagen einer Woche im Kalorienziel', icon: 'food', test: (S, c) => { for (let i = 0; i < 60; i++) { const end = addDays(c.today, -i); let n = 0; for (let j = 0; j < 7; j++) if (c.f(addDays(end, -j)).kcalHit && addDays(end, -j) < c.today) n++; if (n >= 5) return true; } return false; } },
  { id: 'protein_7', name: 'Protein-Woche', desc: '7 Tage am Stück Proteinziel erreicht', icon: 'flame', test: (S, c) => runOf(S, (d) => c.f(d).proteinHit, c.today, 7) },
  { id: 'hydration_7', name: 'Hydriert', desc: '7 Tage am Stück Trinkziel erreicht', icon: 'drop', test: (S, c) => runOf(S, (d) => c.f(d).waterHit, c.today, 7) },
  { id: 'supps_7', name: 'Plan eingehalten', desc: '7 Tage am Stück alle geplanten Supplements genommen', icon: 'pill', test: (S, c) => runOf(S, (d) => c.f(d).suppsAll, c.today, 7) },
  { id: 'week_goal', name: 'Wochenziel', desc: 'Trainings-Wochenziel erreicht', icon: 'calendar', test: (S) => { const t = S.goals.weeklySessions; if (!t) return false; const m = new Map(); S.workouts.forEach((w) => { const k = mondayOf(w.date); m.set(k, (m.get(k) || 0) + 1); }); return [...m.values()].some((n) => n >= t); } },
  { id: 'goal_done', name: 'Ziel erreicht', desc: 'Ein eigenes Ziel abgeschlossen', icon: 'target', test: (S) => S.goals.custom.some((g) => g.status === 'done') },
  { id: 'shopping', name: 'Alles im Korb', desc: 'Eine Einkaufsliste komplett abgehakt', icon: 'check', test: (S) => Object.values(S.shopping).some((l) => { const need = (l.items || []).filter((x) => !x.inStock); return need.length > 0 && need.every((x) => x.bought); }) },
  { id: 'level_5', name: 'Level 5', desc: 'Level 5 erreicht', icon: 'star', test: (S, c) => c.level >= 5 },
  { id: 'level_10', name: 'Level 10', desc: 'Level 10 erreicht', icon: 'star', test: (S, c) => c.level >= 10 },
];
/** Neu freigeschaltete Erfolge (noch nicht in S.achievements). Freigeschaltete bleiben dauerhaft erhalten. */
export function newAchievements(S, today = dkey(), now = Date.now()) {
  const memo = new Map();
  const f = (d) => { if (!memo.has(d)) memo.set(d, dayFacts(S, d, now)); return memo.get(d); };
  const level = levelInfo(totalXP(ledger(S, today, now))).level;
  const ctx = { today, f, level };
  return ACHIEVEMENTS.filter((a) => !S.achievements[a.id] && a.test(S, ctx));
}

// ---------- Eigene Ziele ----------
export const GOAL_TYPES = {
  weight: { name: 'Körpergewicht', unit: 'kg', cat: 'Körper', auto: true, hint: 'Startwert = erste Messung ab Startdatum (oder eigener Wert), aktuell = 7-Tage-Trend.' },
  workouts: { name: 'Anzahl Trainings', unit: 'Trainings', cat: 'Training', auto: true, hint: 'Zählt abgeschlossene Trainings ab dem Startdatum.' },
  protein_days: { name: 'Tage mit Proteinziel', unit: 'Tage', cat: 'Ernährung', auto: true, hint: 'Zählt Tage ab Start, an denen mind. 95 % des Proteinziels erreicht wurden.' },
  kcal_days: { name: 'Tage im Kalorienziel', unit: 'Tage', cat: 'Ernährung', auto: true, hint: 'Zählt abgeschlossene Tage ab Start mit Kalorien ±10 % vom Ziel.' },
  water_days: { name: 'Tage mit Trinkziel', unit: 'Tage', cat: 'Gewohnheiten', auto: true, hint: 'Zählt Tage ab Start mit erreichtem Trinkziel.' },
  supps_pct: { name: 'Supplement-Treue', unit: '%', cat: 'Gewohnheiten', auto: true, hint: 'Anteil genommener an geplanten Einnahmen in den letzten 7 Tagen.' },
  routine_weeks: { name: 'Wochen mit Wochenziel', unit: 'Wochen', cat: 'Training', auto: true, hint: 'Zählt Wochen ab Start, in denen das Trainings-Wochenziel erreicht wurde.' },
  pr: { name: 'Kraftziel / Rekord', unit: 'kg', cat: 'Kraft', auto: true, hint: 'Bestes Gewicht bei mindestens der Ziel-Wiederholungszahl.' },
  habit_streak: { name: 'Gewohnheit halten', unit: 'Tage', cat: 'Gewohnheiten', auto: true, hint: 'Längste Serie der gewählten Gewohnheit ab Start.' },
  manual: { name: 'Eigener Wert', unit: '', cat: 'Sonstiges', auto: false, hint: 'Aktuellen Wert trägst du selbst ein.' },
};
/** Fortschritt eines Ziels. pct ist immer 0..1; ein Übertreffen wird separat gemeldet. */
export function goalProgress(S, g, today = dkey(), now = Date.now()) {
  const from = g.startDate || '0000-00-00';
  const memo = new Map();
  const f = (d) => { if (!memo.has(d)) memo.set(d, dayFacts(S, d, now)); return memo.get(d); };
  const countDays = (pred) => { let n = 0; for (let d = from < addDays(today, -730) ? addDays(today, -730) : from; d <= today; d = addDays(d, 1)) if (pred(d)) n++; return n; };
  let start = Number(g.startValue) || 0, current = 0, target = Number(g.targetValue), missing = null;
  switch (g.type) {
    case 'weight': {
      const daily = dailyWeights(S.weights);
      const since = daily.filter((p) => p.x >= from);
      if (!since.length) { missing = 'Noch keine Gewichtsmessung seit dem Startdatum.'; break; }
      start = g.startValue != null && g.startValue !== '' ? Number(g.startValue) : since[0].y;
      const avg = rollingAvg(daily);
      current = avg[avg.length - 1].y;
      break;
    }
    case 'workouts': start = 0; current = S.workouts.filter((w) => w.date >= from).length; break;
    case 'protein_days': start = 0; current = countDays((d) => f(d).proteinHit); break;
    case 'kcal_days': start = 0; current = countDays((d) => d < today && f(d).kcalHit); break;
    case 'water_days': start = 0; current = countDays((d) => f(d).waterHit); break;
    case 'supps_pct': {
      start = 0;
      let sch = 0, tk = 0;
      for (let i = 0; i < 7; i++) { const a = dayAdherence(S, addDays(today, -i), now); sch += a.scheduled; tk += a.taken; }
      if (!sch) { missing = 'Keine geplanten Einnahmen in den letzten 7 Tagen.'; break; }
      current = Math.round((tk / sch) * 100);
      break;
    }
    case 'routine_weeks': {
      start = 0;
      const t = S.goals.weeklySessions || 0;
      if (!t) { missing = 'Kein Trainings-Wochenziel festgelegt.'; break; }
      const m = new Map();
      S.workouts.filter((w) => w.date >= from).forEach((w) => { const k = mondayOf(w.date); m.set(k, (m.get(k) || 0) + 1); });
      current = [...m.values()].filter((n) => n >= t).length;
      break;
    }
    case 'pr': {
      start = 0;
      const p = strengthGoalProgress(S.workouts.filter((w) => w.date >= from || !g.startDate), { key: g.params?.key, kg: target, reps: g.params?.reps || 1 });
      current = p.bestW;
      break;
    }
    case 'habit_streak': {
      start = 0;
      const id = g.params?.habitId;
      if (!S.habits.some((h) => h.id === id)) { missing = 'Gewohnheit nicht gefunden.'; break; }
      let run = 0, best = 0;
      for (let d = from < addDays(today, -730) ? addDays(today, -730) : from; d <= today; d = addDays(d, 1)) { if ((S.habitLog[d] || []).includes(id)) { run++; best = Math.max(best, run); } else if (d !== today) run = 0; }
      current = best;
      break;
    }
    default: current = Number(g.currentValue) || 0;
  }
  if (!Number.isFinite(target)) return { start, current, target: null, pct: 0, exceeded: false, done: false, missing: 'Zielwert fehlt.' };
  if (missing) return { start, current: null, target, pct: 0, exceeded: false, done: false, missing };
  const span = target - start;
  let pct, done, exceeded;
  if (Math.abs(span) < 1e-9) { pct = 1; done = true; exceeded = false; }
  else {
    const raw = (current - start) / span; // funktioniert für steigende und fallende Ziele
    pct = clamp(raw, 0, 1);
    done = raw >= 1 - 1e-9;
    exceeded = raw > 1 + 1e-9;
  }
  return { start, current, target, pct, done, exceeded, missing: null };
}

// ---------- Tagesmissionen ----------
export function missions(S, today = dkey(), now = Date.now(), plannedToday = []) {
  const X = S.xpConfig, f = dayFacts(S, today, now), T = S.targets, out = [];
  const doneW = S.workouts.some((w) => w.date === today);
  if (plannedToday.length || doneW || S.active) out.push({ id: 'workout', title: plannedToday[0] ? `Training: ${plannedToday[0].name}` : 'Training', progress: doneW ? 1 : S.active ? 0.5 : 0, label: doneW ? 'erledigt' : S.active ? 'läuft' : 'geplant', xp: X.workout, done: doneW, action: doneW ? null : S.active ? 'session' : 'start' });
  if (T.p > 0) out.push({ id: 'protein', title: 'Proteinziel', progress: clamp(f.p / (T.p * 0.95), 0, 1), label: `${Math.round(f.p)} / ${T.p} g`, xp: X.protein, done: f.proteinHit, action: 'food' });
  if (S.profile.waterGoal > 0) out.push({ id: 'water', title: 'Trinkziel', progress: clamp(f.water / S.profile.waterGoal, 0, 1), label: `${(f.water / 1000).toFixed(2).replace('.', ',')} / ${(S.profile.waterGoal / 1000).toFixed(1).replace('.', ',')} l`, xp: X.water, done: f.waterHit, action: 'water' });
  const sup = suppDay(S, today);
  if (sup.total) out.push({ id: 'supps', title: 'Supplement-Plan', progress: sup.taken / sup.total, label: `${sup.taken} / ${sup.total}`, xp: X.supps, done: f.suppsAll, action: 'supps' });
  for (const h of S.habits) { const d = f.habits.includes(h.id); out.push({ id: 'habit:' + h.id, habitId: h.id, title: h.name, progress: d ? 1 : 0, label: d ? 'erledigt' : 'offen', xp: X.habit, done: d, action: 'habit' }); }
  return out;
}
