// App-Kern: Zustand, Speichern, Navigation, Aktionen, Sheets, Toasts, Feier.
import { loadState, KEY } from './store.js';
import { dkey } from './logic.js';
import { $, esc, icon, resetCharts } from './ui.js';
import { mascot } from './mascot.js';

const boot = loadState();
export const app = {
  S: boot.state,
  migrated: boot.migrated,
  recovered: !!boot.recovered,
  ui: { view: boot.state.active ? 'session' : 'home', date: dkey(), sheet: null, rest: null, params: {}, history: [] },
};

// Aktions-Registrys: data-a (Klick), data-c (change), data-i (input)
export const A = {};
export const C = {};
export const I = {};
const views = {};
const tabOf = {};
export function registerView(name, fn, tab) { views[name] = fn; tabOf[name] = tab; }

// ---------- Speichern ----------
let saveTimer;
let saveFailed = false;
export function saveNow() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(KEY, JSON.stringify(app.S));
    if (saveFailed) { saveFailed = false; toast('Speichern klappt wieder ✓'); }
  } catch (e) {
    saveFailed = true;
    toast('Speichern fehlgeschlagen – Speicher voll? Backup erstellen! (' + e.message + ')', true);
  }
}
export function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 250); }
/** Änderung übernehmen: speichern und neu zeichnen. */
export function commit() { save(); render(); renderSheet(); }
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

// ---------- Navigation ----------
export function go(view, params = {}, { push = true } = {}) {
  if (push && app.ui.view !== view) app.ui.history.push({ view: app.ui.view, params: app.ui.params });
  if (app.ui.history.length > 20) app.ui.history.shift();
  app.ui.view = view;
  app.ui.params = params;
  render();
  window.scrollTo(0, 0);
}
export function back(fallback = 'home') {
  const prev = app.ui.history.pop();
  if (prev) { app.ui.view = prev.view; app.ui.params = prev.params; render(); window.scrollTo(0, 0); }
  else go(fallback, {}, { push: false });
}
let lastRendered = null;
export function render() {
  const name = views[app.ui.view] ? app.ui.view : 'home';
  resetCharts();
  const main = $('#app');
  main.innerHTML = views[name](app.ui.params || {});
  // Sanfter Übergang nur beim Bildschirmwechsel, nicht bei jedem Neuzeichnen
  if (lastRendered !== name) { main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter'); }
  lastRendered = name;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === tabOf[name]));
  document.dispatchEvent(new CustomEvent('rendered', { detail: { view: name, root: $('#app') } }));
}

// ---------- Sheets ----------
let onSheetClose = null;
export function openSheet(fn, { onClose = null } = {}) {
  if (onSheetClose && app.ui.sheet !== fn) { const f = onSheetClose; onSheetClose = null; f(); }
  app.ui.sheet = fn;
  onSheetClose = onClose;
  $('#sheet').classList.remove('hidden');
  renderSheet(true);
  $('.sheet-panel').scrollTop = 0;
}
export function closeSheet() {
  if (onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); }
  app.ui.sheet = null;
  $('#sheet').classList.add('hidden');
  $('#sheetBody').innerHTML = '';
  document.dispatchEvent(new CustomEvent('sheet-closed'));
}
/** Sheet neu zeichnen. Sheets mit Live-Inhalt (Kamera) setzen fn.keepAlive. */
export function renderSheet(force = false) {
  const fn = app.ui.sheet;
  if (!fn) return;
  if (fn.keepAlive && !force) return;
  const body = $('#sheetBody');
  body.innerHTML = fn();
  document.dispatchEvent(new CustomEvent('rendered', { detail: { view: 'sheet', root: body } }));
}

// ---------- Rückmeldungen ----------
export function toast(msg, isErr = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', isErr);
  t.classList.remove('hidden');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.add('hidden'), isErr ? 4500 : 2400);
}
/** Zurückhaltende Gold-Feier für Rekorde und erreichte Ziele – mit dem Löwen, solange Coach-Reaktionen an sind. */
export function celebrate(title, lines = [], ic = 'trophy', art = 'celebrating') {
  const el = document.createElement('div');
  el.className = 'celebrate';
  const withLion = art && app.S.coach?.reactions !== false;
  el.innerHTML = `<div class="box">${withLion ? `<div class="celebrate-lion">${mascot(art, { size: 'md' })}<span class="medal mini">${icon(ic)}</span></div>` : `<div class="medal">${icon(ic)}</div>`}<h2>${esc(title)}</h2>${lines.map((l) => `<p class="muted small" style="margin:4px 0">${esc(l)}</p>`).join('')}<button type="button" class="btn primary block mt">Weiter</button></div>`;
  const close = () => el.remove();
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('button')) close(); });
  document.body.appendChild(el);
  if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
}
export function confirmBox(msg) { return window.confirm(msg); }
