// Datenhaltung: Zustand, Standardwerte, Migration aus FIT, Speichern, Fotos.
// Alles bleibt auf dem Gerät: Zustand in localStorage, Fotos (Blobs) in IndexedDB.
import { SEED_EXERCISES, SEED_FOODS, PLAN_TEMPLATES, DEFAULT_MEASURE_FIELDS } from './seed.js';
import { calcMacros, dkey, pkey } from './logic.js';

export const KEY = 'ironcore-v2';
export const LEGACY_KEY = 'fit-state-v1';
export const VERSION = 2;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const norm = (s) => String(s || '').trim().toLowerCase();

export function planFromTemplate(kind, exercises) {
  const t = PLAN_TEMPLATES[kind];
  const byName = new Map(exercises.map((e) => [norm(e.name), e]));
  return {
    id: uid(),
    name: t.name,
    days: t.days.map(([name, wd, list]) => ({
      id: uid(), name, wd: [...wd],
      ex: list.map(([exName, sets, reps, rest]) => ({ id: uid(), exId: byName.get(norm(exName))?.id ?? null, sets, reps, kg: null, rest, note: '' })),
    })),
  };
}

export function defaults() {
  const profile = { sex: 'm', age: 28, height: 180, weight: 85, activity: 1.55, deficit: 500, proteinPerKg: 2.2, fatPerKg: 0.8, waterGoal: 3000, sleepGoal: 8, stepGoal: 10000 };
  const m = calcMacros(profile);
  const exercises = SEED_EXERCISES.map((e) => ({ id: uid(), ...e, custom: false }));
  const plan = planFromTemplate('ppl', exercises);
  return {
    v: VERSION,
    profile,
    targets: { kcal: m.kcal, p: m.p, c: m.c, f: m.f },
    goals: { weight: null, weeklySessions: 4, strength: [], milestones: [] },
    exercises,
    plans: [plan],
    activePlanId: plan.id,
    workouts: [],
    active: null,
    foods: SEED_FOODS.map((f) => ({ id: uid(), ...f, fav: false, used: 0, barcode: '' })),
    meals: {},
    savedMeals: [],
    weights: [],
    measureFields: DEFAULT_MEASURE_FIELDS.map((f) => ({ ...f })),
    measures: [],
    photos: [],
    days: {},
    supps: [
      { id: uid(), name: 'Kreatin', dose: '5 g' },
      { id: uid(), name: 'Vitamin D3', dose: '2000 IE' },
      { id: uid(), name: 'Omega-3', dose: '2 Kapseln' },
    ],
    settings: { onboarded: false, hideInstall: false, lastBackup: 0, celebrated: {} },
  };
}

/** Stellt sicher, dass alle Felder existieren (für ältere Backups / Teil-Daten). */
export function normalize(s) {
  const d = defaults();
  for (const k of Object.keys(d)) if (s[k] === undefined || s[k] === null && k !== 'active') s[k] = d[k];
  s.profile = { ...d.profile, ...s.profile };
  s.goals = { ...d.goals, ...s.goals };
  s.settings = { ...d.settings, ...s.settings };
  if (!s.plans.length) { const p = planFromTemplate('ppl', s.exercises); s.plans.push(p); }
  if (!s.plans.some((p) => p.id === s.activePlanId)) s.activePlanId = s.plans[0].id;
  s.v = VERSION;
  return s;
}

/**
 * Migration aus der FIT-App (Version 1): Plan, Trainings, Gewicht, Maße, Essen, Fotos, Tageswerte.
 * Übungen werden über den Namen der Bibliothek zugeordnet; unbekannte werden als eigene Übung angelegt.
 */
export function migrateFromFit(old) {
  const s = defaults();
  const lib = s.exercises;
  const byName = new Map(lib.map((e) => [norm(e.name), e]));
  // FIT-Namen, die in der Bibliothek leicht anders heißen
  const alias = { 'beinbeuger': 'beinbeuger liegend', 'wadenheben': 'wadenheben stehend' };
  const exIdFor = (name) => {
    const n = norm(name);
    if (!n) return null;
    let e = byName.get(n) || byName.get(alias[n]);
    if (!e) { e = { id: uid(), name: String(name).trim(), muscle: 'Sonstiges', equipment: 'Sonstiges', instructions: '', notes: '', custom: true }; lib.push(e); byName.set(n, e); }
    return e.id;
  };

  if (old.profile) {
    const { targetWeight, ...rest } = old.profile;
    s.profile = { ...s.profile, ...rest };
    if (targetWeight) s.goals.weight = targetWeight;
  }
  if (old.targets) s.targets = { ...old.targets };
  if (old.plan && Array.isArray(old.plan.days)) {
    const plan = {
      id: uid(), name: 'Mein Plan',
      days: old.plan.days.map((d) => ({
        id: d.id || uid(), name: d.name || 'Tag', wd: Array.isArray(d.wd) ? d.wd : [],
        ex: (d.ex || []).filter((e) => norm(e.name)).map((e) => ({ id: uid(), exId: exIdFor(e.name), sets: e.sets || 3, reps: e.reps || '8-12', kg: null, rest: e.rest ?? 90, note: '' })),
      })),
    };
    s.plans = [plan];
    s.activePlanId = plan.id;
  }
  const mapEx = (e) => ({ exId: exIdFor(e.name), name: String(e.name).trim(), sets: (e.sets || []).map((x) => ({ w: +x.w || 0, r: +x.r || 0 })) });
  s.workouts = (old.workouts || []).map((w) => ({ id: w.id || uid(), planId: s.activePlanId, dayId: w.dayId || null, name: w.name, date: w.date, start: w.start, end: w.end, note: w.note || '', exercises: (w.exercises || []).map(mapEx) }));
  if (old.active) {
    const a = old.active;
    s.active = {
      id: a.id || uid(), planId: s.activePlanId, dayId: a.dayId || null, name: a.name, start: a.start, note: a.note || '', cur: 0,
      exercises: (a.exercises || []).map((e) => ({ exId: exIdFor(e.name), name: e.name, target: e.target || '', kg: null, rest: e.rest || 90, note: '', sets: (e.sets || []).map((x) => ({ w: x.w ?? '', r: x.r ?? '', done: !!x.done })) })),
    };
  }
  if (Array.isArray(old.foods) && old.foods.length) s.foods = old.foods.map((f) => ({ barcode: '', fav: false, used: 0, ...f }));
  if (old.meals) s.meals = old.meals;
  // Gewicht stand in FIT pro Tag – als Messung um 08:00 übernehmen
  s.weights = [];
  s.days = {};
  for (const [k, d] of Object.entries(old.days || {})) {
    if (d.weight) { const t = pkey(k); t.setHours(8, 0, 0, 0); s.weights.push({ id: uid(), ts: t.getTime(), kg: d.weight }); }
    const rest = { ...d };
    delete rest.weight;
    if (rest.water || rest.sleep || rest.steps || (rest.cardio && rest.cardio.length) || (rest.supps && rest.supps.length)) s.days[k] = { water: 0, sleep: null, steps: null, cardio: [], supps: [], ...rest };
  }
  s.weights.sort((a, b) => a.ts - b.ts);
  const mapM = { waist: 'waist', hip: 'hips', chest: 'chest', arm: 'arms', thigh: 'thighs' };
  s.measures = (old.measures || []).map((m) => {
    const values = {};
    for (const [o, n] of Object.entries(mapM)) if (m[o]) values[n] = m[o];
    return { id: m.id || uid(), date: m.date || dkey(), values };
  });
  if (old.photos) s.photos = old.photos.map((p) => ({ note: '', ...p }));
  if (Array.isArray(old.supps)) s.supps = old.supps;
  s.settings.onboarded = !!old.onboarded;
  s.settings.hideInstall = !!old.hideInstall;
  s.settings.lastBackup = old.lastBackup || 0;
  return normalize(s);
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(KEY);
    if (raw) return { state: normalize(JSON.parse(raw)), migrated: false };
    const legacy = storage.getItem(LEGACY_KEY);
    if (legacy) return { state: migrateFromFit(JSON.parse(legacy)), migrated: true };
  } catch (e) {
    console.warn('Laden fehlgeschlagen', e);
    // Beschädigte Daten nicht überschreiben, sondern zur Rettung aufheben
    try { const raw = storage.getItem(KEY) || storage.getItem(LEGACY_KEY); if (raw && storage.setItem) storage.setItem(`${KEY}-defekt-${Date.now()}`, raw); } catch { /* egal */ }
    return { state: defaults(), migrated: false, recovered: true };
  }
  return { state: defaults(), migrated: false };
}

// ---------- Fotos (IndexedDB) ----------
export const photoDB = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    // Gleiche Datenbank wie FIT, damit vorhandene Fotos erhalten bleiben
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
