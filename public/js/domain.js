// Abfragen auf dem App-Zustand (Übungen, Plan, Tage, Gewicht …).
import { app } from './core.js';
import { dkey, weekdayOf, dailyWeights, exKey } from './logic.js';
import { uid } from './store.js';

export const S = () => app.S;

// Übungen
export const exById = (id) => app.S.exercises.find((e) => e.id === id) || null;
export const exName = (id, fallback = 'Übung') => exById(id)?.name || fallback;
export function muscleOf(e) { const x = e.exId ? exById(e.exId) : app.S.exercises.find((y) => y.name.toLowerCase() === String(e.name).toLowerCase()); return x ? x.muscle : 'Sonstiges'; }
export function findOrCreateExercise(name) {
  const n = name.trim();
  let e = app.S.exercises.find((x) => x.name.toLowerCase() === n.toLowerCase());
  if (!e) { e = { id: uid(), name: n, muscle: 'Sonstiges', equipment: 'Sonstiges', instructions: '', notes: '', custom: true }; app.S.exercises.push(e); }
  return e;
}
export const keyOfEx = (exId) => exId; // Trainings speichern exId → Schlüssel für Verlauf
export { exKey };

// Plan
export const activePlan = () => app.S.plans.find((p) => p.id === app.S.activePlanId) || app.S.plans[0];
export const plannedFor = (k) => (activePlan()?.days || []).filter((d) => d.wd.includes(weekdayOf(k)));
export function findDay(dayId) {
  for (const p of app.S.plans) { const d = p.days.find((x) => x.id === dayId); if (d) return { plan: p, day: d }; }
  return null;
}
export const workoutsOn = (k) => app.S.workouts.filter((w) => w.date === k);
export const lastWorkoutOfDay = (dayId) => app.S.workouts.filter((w) => w.dayId === dayId).sort((a, b) => b.start - a.start)[0] || null;

// Tageswerte (Wasser, Schlaf, Schritte, Cardio, Supplements)
const blankDay = () => ({ water: 0, sleep: null, steps: null, cardio: [], waterLog: [] });
export const getDay = (k) => app.S.days[k] || blankDay();
export function dayW(k) { if (!app.S.days[k]) app.S.days[k] = blankDay(); return app.S.days[k]; }

// Ernährung
export const entries = (k) => app.S.meals[k] || [];
export const slotName = (id) => app.S.mealSlots.find((x) => x.id === id)?.name || 'Mahlzeit';

// Gewicht
export const weightsSorted = () => app.S.weights.slice().sort((a, b) => a.ts - b.ts);
export const daily = () => dailyWeights(app.S.weights);
export const today = () => dkey();
