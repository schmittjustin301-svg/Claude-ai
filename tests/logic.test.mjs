import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../public/js/logic.js';
import { migrateFromFit, loadState, defaults, KEY, LEGACY_KEY } from '../public/js/store.js';

const ts = (k, h = 8) => { const d = L.pkey(k); d.setHours(h); return d.getTime(); };
const W = (date, name, sets, extra = {}) => ({ id: date + name, date, start: ts(date, 10), end: ts(date, 11), name: extra.wname || 'Push', dayId: extra.dayId || 'd1', exercises: [{ exId: extra.exId || 'bench', name, sets }] });

test('Datumshilfen', () => {
  assert.equal(L.addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(L.addDays('2026-03-29', 1), '2026-03-30'); // Sommerzeit-Umstellung
  assert.equal(L.daysBetween('2026-03-28', '2026-03-30'), 2);
  assert.deepEqual(L.weekKeys('2026-10-15').map((k) => L.weekdayOf(k)), [1, 2, 3, 4, 5, 6, 0]);
  assert.equal(L.mondayOf('2026-10-18'), '2026-10-12');
});

test('Validierung', () => {
  assert.equal(L.validate('82,5', L.LIMITS.bodyKg).value, 82.5);
  assert.equal(L.validate('', L.LIMITS.bodyKg).ok, false);
  assert.equal(L.validate('abc', L.LIMITS.bodyKg).ok, false);
  assert.equal(L.validate('900', L.LIMITS.bodyKg).ok, false);
  assert.deepEqual(L.validate('', { required: false }), { ok: true, value: null });
});

test('Makro-Rechner (Mifflin-St Jeor)', () => {
  const m = L.calcMacros({ sex: 'm', age: 30, height: 180, weight: 90, activity: 1.55, deficit: 500, proteinPerKg: 2, fatPerKg: 0.8 });
  assert.equal(m.bmr, 1880); // 900 + 1125 - 150 + 5
  assert.equal(m.tdee, 2914);
  assert.equal(m.kcal, 2414);
  assert.equal(m.p, 180);
  assert.equal(m.f, 72);
  assert.equal(m.c, Math.round((2414 - 720 - 648) / 4));
});

test('Gewicht: Tageswerte, Trend, Veränderung', () => {
  const entries = [];
  for (let i = 0; i < 40; i++) entries.push({ ts: ts(L.addDays('2026-09-01', i)), kg: 90 - i * 0.1 });
  entries.push({ ts: ts('2026-10-10', 20), kg: 87.5 }); // zweite Messung am selben Tag
  const daily = L.dailyWeights(entries);
  assert.equal(daily.length, 40);
  const oct10 = daily.find((d) => d.x === '2026-10-10');
  assert.ok(Math.abs(oct10.y - (90 - 39 * 0.1 + 87.5) / 2) < 1e-9);
  const ch7 = L.weightChange(daily, '2026-10-10', 7);
  assert.ok(ch7 < 0 && ch7 > -1.2);
  assert.equal(L.weightChange(daily.slice(0, 3), '2026-09-03', 30), null, 'zu wenig Daten → null');
  const rate = L.weeklyRate(daily.slice(0, 39));
  assert.ok(Math.abs(rate - -0.7) < 0.01);
  assert.equal(L.weeklyRate(daily.slice(0, 3)), null);
});

test('Gewichtsziel und Prognose', () => {
  const daily = [{ x: '2026-01-01', y: 90 }, { x: '2026-01-08', y: 88 }];
  const g = L.weightGoalProgress(daily, 80);
  assert.equal(g.start, 90);
  assert.ok(g.pct > 0 && g.pct < 1);
  assert.equal(L.weightGoalProgress([{ x: '2026-01-01', y: 70 }, { x: '2026-01-08', y: 72 }], 75).done, false); // Zunehmen
  assert.equal(L.weeksToGoal(88, 80, -0.5), 16);
  assert.equal(L.weeksToGoal(88, 80, 0.3), null, 'falsche Richtung → keine Prognose');
});

test('Training: e1RM, Rekorde, letzte Leistung', () => {
  assert.equal(L.e1rm(100, 1), 100);
  assert.equal(L.e1rm(100, 0), 0);
  const ws = [
    W('2026-10-01', 'Bankdrücken', [{ w: 80, r: 8 }, { w: 80, r: 7 }]),
    W('2026-10-04', 'Bankdrücken', [{ w: 80, r: 8 }]),
    W('2026-10-08', 'Bankdrücken', [{ w: 85, r: 8 }]),
  ];
  const prs = L.prEvents(ws);
  assert.equal(prs.length, 1, 'erste Einheit ist Basis, gleiche Leistung ist kein Rekord');
  assert.equal(prs[0].date, '2026-10-08');
  const last = L.lastPerformance(ws, 'bench', ws[2].start);
  assert.equal(last.date, '2026-10-04');
  assert.equal(L.bestByExercise(ws).get('bench').w, 85);
  assert.equal(L.workoutVolume(ws[0]), 80 * 8 + 80 * 7);
  assert.equal(L.exerciseProgress(ws, 'bench').length, 3);
});

test('Training: Wochen, Muskelsätze, Vergleich', () => {
  const ws = [
    W('2026-10-05', 'Bankdrücken', [{ w: 80, r: 8 }, { w: 80, r: 8 }]),
    W('2026-10-12', 'Bankdrücken', [{ w: 82.5, r: 8 }, { w: 82.5, r: 8 }, { w: 80, r: 8 }]),
  ];
  const weeks = L.weeklyTraining(ws, '2026-10-14', 3);
  assert.deepEqual(weeks.map((w) => w.sessions), [0, 1, 1]);
  const m = L.setsPerMuscle(ws, '2026-10-08', '2026-10-14', () => 'Brust');
  assert.deepEqual(m, [{ muscle: 'Brust', sets: 3 }]);
  const cmp = L.compareWithPrevious(ws, ws[1]);
  assert.equal(cmp.prev.id, ws[0].id);
  assert.ok(cmp.deltaPct > 50);
});

test('Kraftziel', () => {
  const ws = [W('2026-10-01', 'Bankdrücken', [{ w: 95, r: 3 }, { w: 90, r: 5 }])];
  const g = L.strengthGoalProgress(ws, { key: 'bench', kg: 100, reps: 5 });
  assert.equal(g.bestW, 90);
  assert.equal(g.done, false);
  assert.equal(L.strengthGoalProgress(ws, { key: 'bench', kg: 95, reps: 3 }).done, true);
});

test('Ernährung: Zielerreichung', () => {
  const meals = { '2026-10-14': [{ kcal: 2000, p: 180, c: 200, f: 60 }], '2026-10-15': [{ kcal: 2600, p: 120, c: 300, f: 90 }] };
  const a = L.nutritionAdherence(meals, { kcal: 2050, p: 190, c: 200, f: 60 }, '2026-10-15', 7);
  assert.equal(a.logged, 2);
  assert.equal(a.kcalOk, 1);
  assert.equal(a.proteinOk, 1);
});

test('Migration aus FIT übernimmt alle Daten', () => {
  const fit = {
    profile: { sex: 'm', age: 31, height: 182, weight: 92, targetWeight: 82 },
    targets: { kcal: 2400, p: 200, c: 220, f: 75 },
    plan: { days: [{ id: 'p1', name: 'Push', wd: [1, 4], ex: [{ name: 'Bankdrücken', sets: 4, reps: '6-8', rest: 150 }, { name: 'Meine Spezialübung', sets: 3, reps: '10', rest: 60 }, { name: '', sets: 3 }] }] },
    workouts: [{ id: 'w1', dayId: 'p1', name: 'Push', date: '2026-10-15', start: 1, end: 2, note: 'gut', exercises: [{ name: 'Bankdrücken', sets: [{ w: 80, r: 8 }] }] }],
    active: { id: 'a1', name: 'Push', start: 3, note: '', exercises: [{ name: 'Bankdrücken', target: '4 × 6-8', rest: 150, sets: [{ w: '80', r: '8', done: true }] }] },
    foods: [{ id: 'f1', name: 'Quark', kcal: 67, p: 12, c: 4, f: 0.3, portion: 250, fav: true, barcode: '123' }],
    meals: { '2026-10-15': [{ id: 'm1', slot: 'Frühstück', name: 'Quark', kcal: 167 }] },
    days: { '2026-10-15': { water: 750, sleep: 7.5, steps: null, weight: 91.4, cardio: [], supps: [] }, '2026-10-14': { water: 0, weight: 91.8, cardio: [], supps: [] } },
    measures: [{ id: 'x', date: '2026-10-15', waist: 94, arm: 38 }],
    photos: [{ id: 'ph1', date: '2026-10-15' }],
    supps: [{ id: 's1', name: 'Kreatin', dose: '5 g' }],
    onboarded: true, lastBackup: 5,
  };
  const s = migrateFromFit(fit);
  assert.equal(s.goals.weight, 82);
  assert.equal(s.profile.age, 31);
  assert.equal(s.targets.kcal, 2400);
  assert.equal(s.plans.length, 1);
  assert.equal(s.plans[0].days[0].ex.length, 2, 'leere Übung fällt weg');
  const bench = s.exercises.find((e) => e.name === 'Bankdrücken');
  assert.equal(s.plans[0].days[0].ex[0].exId, bench.id);
  const custom = s.exercises.find((e) => e.name === 'Meine Spezialübung');
  assert.ok(custom && custom.custom);
  assert.equal(s.workouts[0].exercises[0].exId, bench.id);
  assert.equal(s.active.exercises[0].sets[0].done, true);
  assert.equal(s.weights.length, 2);
  assert.deepEqual(s.weights.map((w) => w.kg), [91.8, 91.4]);
  assert.equal(s.days['2026-10-15'].water, 750);
  assert.equal(s.days['2026-10-15'].weight, undefined);
  assert.equal(s.days['2026-10-14'], undefined, 'Tag nur mit Gewicht braucht keinen Tageseintrag');
  assert.deepEqual(s.measures[0].values, { waist: 94, arms: 38 });
  assert.equal(s.foods[0].barcode, '123');
  assert.equal(s.photos[0].id, 'ph1');
  assert.equal(s.settings.onboarded, true);
});

test('loadState: neuer Schlüssel vor Altdaten, sonst Migration, sonst Standard', () => {
  const mem = (obj) => ({ getItem: (k) => obj[k] ?? null });
  assert.equal(loadState(mem({})).migrated, false);
  assert.equal(loadState(mem({ [LEGACY_KEY]: JSON.stringify({ workouts: [] }) })).migrated, true);
  const own = defaults(); own.goals.weight = 77;
  const r = loadState(mem({ [KEY]: JSON.stringify(own), [LEGACY_KEY]: '{}' }));
  assert.equal(r.migrated, false);
  assert.equal(r.state.goals.weight, 77);
  assert.equal(loadState(mem({ [KEY]: '{kaputt' })).state.v, 3, 'kaputte Daten → Standard statt Absturz');
});
