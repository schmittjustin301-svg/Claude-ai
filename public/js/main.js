// Einstieg: Module laden, Ereignisse verdrahten, App starten.
import { app, A, C, I, render, go, back, closeSheet, commit, saveNow } from './core.js';
import { dkey } from './logic.js';
import { bindCharts } from './ui.js';
import './views/home.js';
import './views/training.js';
import './views/session.js';
import './views/nutrition.js';
import './views/progress.js';
import './views/goals.js';
import './views/settings.js';
import './scanner.js';
import './routine.js';
import './views/supps.js';
import { startReminderLoop } from './notify.js';

A.go = (el) => go(el.dataset.v, { id: el.dataset.id, tab: el.dataset.p });
A.tab = (el) => { app.ui.history = []; if (el.dataset.v === 'food') app.ui.date = app.ui.date || dkey(); go(el.dataset.v, {}, { push: false }); };
A.back = () => back(app.ui.view === 'plan' ? 'train' : app.ui.view === 'foods' ? 'food' : 'home');
A.closeSheet = closeSheet;

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  // Eingabefelder in klickbaren Karten nicht abfangen
  const ctl = e.target.closest('input, select, textarea, label');
  if (ctl && ctl !== el && el.contains(ctl)) return;
  const fn = A[el.dataset.a];
  if (fn) fn(el, e);
});
document.addEventListener('change', (e) => { const el = e.target.closest('[data-c]'); if (el && C[el.dataset.c]) C[el.dataset.c](el, e); });
document.addEventListener('input', (e) => { const el = e.target.closest('[data-i]'); if (el && I[el.dataset.i]) I[el.dataset.i](el, e); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && app.ui.sheet) closeSheet();
  // Enter im Satz-Feld: weiter zum nächsten Feld statt Formular-Verhalten
  if (e.key === 'Enter' && e.target.matches('.set input')) {
    e.preventDefault();
    const inputs = [...document.querySelectorAll('.set input')];
    const i = inputs.indexOf(e.target);
    if (inputs[i + 1]) inputs[i + 1].focus(); else e.target.blur();
  }
});
bindCharts();

// Tageswechsel, während die App offen bleibt
let lastDay = dkey();
setInterval(() => { const t = dkey(); if (t !== lastDay) { if (app.ui.date === lastDay) app.ui.date = t; lastDay = t; render(); } }, 60000);

// Aufruf aus einer Benachrichtigung (?v=day) öffnet direkt die passende Ansicht
const qv = new URLSearchParams(location.search).get('v');
if (qv === 'day' || qv === 'supps') { app.ui.view = qv; history.replaceState(null, '', '/'); }
render();
startReminderLoop();
if (app.migrated) saveNow(); // übernommene FIT-Daten sofort im neuen Format sichern
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => console.warn('SW', e)));
}
export { commit };
