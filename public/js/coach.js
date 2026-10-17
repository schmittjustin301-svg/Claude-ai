// IRONCORE-Coach: Willkommen, geführte Tour, Tipps, Hilfe-Knopf, Coach-Karte und Reaktionen auf echte Ereignisse.
// Getrennt von der Fachlogik: liest den Zustand, schreibt nur app.S.coach (nie Trainings-, Ernährungs- oder Körperdaten).
import { app, A, C, registerView, go, save, commit, openSheet, closeSheet, toast } from './core.js';
import { dkey, addDays, weekKeys } from './logic.js';
import { esc, icon } from './ui.js';
import { plannedFor, workoutsOn, getDay, weightsSorted } from './domain.js';
import { nextEvent } from './schedule.js';
import { missions } from './gamify.js';
import { mascot, mascotSays } from './mascot.js';
import { TOUR, WELCOME, pageHelp, tipsFor } from './tour.js';

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const coach = () => app.S.coach;

// ---------- Reaktionen ----------
/**
 * Kurze Coach-Meldung zu einem echten Ereignis. key verhindert Wiederholungen (einmal pro Schlüssel).
 * Sind Reaktionen ausgeschaltet, erscheint die bisherige schlichte Meldung.
 */
export function react(state, msg, { key = null, sub = '', plainOff = true } = {}) {
  const c = coach();
  if (key) {
    if (c.shown[key]) return false;
    c.shown[key] = dkey();
    const old = addDays(dkey(), -45);
    for (const [k, d] of Object.entries(c.shown)) if (d < old) delete c.shown[k];
    save();
  }
  if (c.reactions === false) { if (plainOff) toast(sub ? `${msg} · ${sub}` : msg); return true; }
  let el = document.getElementById('coachToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'coachToast';
    el.className = 'coach-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.addEventListener('click', () => el.classList.add('hidden'));
    document.body.appendChild(el);
  }
  el.innerHTML = `${mascot(state, { size: 'xs' })}<div class="grow"><b>${esc(msg)}</b>${sub ? `<div class="muted small">${esc(sub)}</div>` : ''}</div><button type="button" class="icon-btn sm plain" aria-label="Meldung schließen">${icon('x', 'sm')}</button>`;
  el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(react.t);
  react.t = setTimeout(() => el.classList.add('hidden'), 5200);
  return true;
}

// ---------- Coach-Karte (Dashboard) ----------
const CALM = ['Konzentrier dich auf den nächsten machbaren Schritt.', 'Disziplin heute, Ergebnisse morgen.', 'Kleine Fortschritte zählen. Bleib dran.', 'Du musst nicht alles perfekt machen. Dranbleiben reicht.'];

/** Botschaft aus echten Daten; ohne passende Daten eine ruhige, neutrale Zeile. */
export function coachMessage(now = Date.now()) {
  const S = app.S, c = S.coach, k = dkey(new Date(now));
  if (c.tour === 'active') return { m: 'explaining', text: `Wir waren bei Schritt ${Math.min(c.step + 1, TOUR.length)} von ${TOUR.length}. Machen wir weiter?`, cta: { a: 'tourResume', l: 'Tour fortsetzen' } };
  if (c.tour === 'new' || c.tour === 'later') return { m: 'friendly', text: 'Ich zeige dir in ein paar kurzen Schritten, wie IRONCORE funktioniert.', cta: { a: 'tourStart', l: 'Tour starten' } };
  if (S.active) return { m: 'focused', text: 'Dein Training läuft. Weiter geht’s!', cta: { a: 'go', v: 'session', l: 'Fortsetzen' } };
  const doneToday = workoutsOn(k);
  const plan = plannedFor(k).filter((d) => !doneToday.some((w) => w.dayId === d.id));
  const h = new Date(now).getHours();
  if (plan.length && h >= 5 && h < 22) return { m: 'workout', text: `Bereit für dein nächstes Workout? Heute steht ${plan[0].name} an.`, cta: { a: 'previewDay', id: plan[0].id, l: 'Ansehen' } };
  const ne = nextEvent(S, now);
  if (ne && ne.date === k && (ne.status === 'due' || ne.inMin <= 45)) {
    return ne.kind === 'meal'
      ? { m: 'nutrition', text: `Deine nächste Mahlzeit steht bald an: ${ne.title} um ${ne.time}.`, cta: { a: 'go', v: 'day', l: 'Tagesplan' } }
      : { m: 'supplements', text: `Zeit für deinen geplanten Supplement-Check: ${ne.title} um ${ne.time}.`, cta: { a: 'go', v: 'day', l: 'Tagesplan' } };
  }
  const wk = weekKeys(k), done = S.workouts.filter((w) => wk.includes(w.date)).length, target = S.goals.weeklySessions || 0;
  if (doneToday.length && !plan.length) return { m: 'supportive', text: `${doneToday[doneToday.length - 1].name} ist erledigt. Jetzt zählt die Regeneration.` };
  if (target >= 2 && done === target - 1) return { m: 'motivated', text: 'Dein Wochenziel ist fast erreicht. Noch eine Einheit.' };
  if (target && done >= target) return { m: 'celebrating', text: `Wochenziel erreicht: ${done} von ${target} Einheiten. Stark!` };
  const d = getDay(k), wg = S.profile.waterGoal;
  if (wg > 0 && d.water >= wg * 0.75 && d.water < wg) return { m: 'water', text: `Dein Wasserziel ist in Reichweite, noch ${wg - d.water} ml.` };
  const ms = missions(S, k, now, plannedFor(k));
  if (ms.length && ms.every((x) => x.done)) return { m: 'celebrating', text: 'Alle Missionen für heute erledigt. Gute Arbeit!' };
  const last = weightsSorted().pop();
  if (last && now - last.ts > 7 * 864e5) return { m: 'focused', text: 'Zeit, deine Fortschritte zu überprüfen. Deine letzte Messung ist über eine Woche her.', cta: { a: 'logWeight', l: 'Gewicht eintragen' } };
  const n = Math.floor(new Date(k + 'T12:00').getTime() / 864e5);
  return { m: 'neutral', text: CALM[n % CALM.length] };
}

export function coachCard() {
  const msg = coachMessage();
  const cta = msg.cta ? `<button type="button" class="btn outline sm" data-a="${msg.cta.a}"${msg.cta.v ? ` data-v="${msg.cta.v}"` : ''}${msg.cta.id ? ` data-id="${msg.cta.id}"` : ''}>${esc(msg.cta.l)}</button>` : '';
  return `<section class="card coach-card" data-tour="coach" aria-label="Coach">
    ${mascot(msg.m, { size: 'md' })}
    <div class="grow"><div class="label gold">Dein Coach</div><p class="coach-msg">${esc(msg.text)}</p>
      <div class="row wrap">${cta}<button type="button" class="link small" data-a="coachHelp">Hilfe</button></div></div>
  </section>`;
}

// ---------- Overlay: Tour, Einzelschritt, Tipps ----------
let run = null; // { steps, i, mode: 'tour' | 'single' | 'tips' }
let layer = null;

function ensureLayer() {
  if (layer) return layer;
  layer = document.createElement('div');
  layer.className = 'tour hidden';
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-labelledby', 'tourTitle');
  layer.innerHTML = '<div class="tour-shade"></div><div class="tour-spot"></div><div class="tour-card"></div>';
  document.body.appendChild(layer);
  return layer;
}
const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

function findTarget(id) {
  if (!id) return null;
  const el = document.querySelector(`#app [data-tour="${id}"], #tabs [data-tour="${id}"]`);
  return el && el.getClientRects().length ? el : null;
}

function startRun(steps, mode, i = 0) {
  if (!steps.length) return;
  if (app.ui.sheet) closeSheet();
  document.getElementById('coachToast')?.classList.add('hidden');
  run = { steps, i: Math.max(0, Math.min(i, steps.length - 1)), mode };
  document.body.classList.add('touring');
  showStep();
}

async function showStep() {
  const st = run.steps[run.i];
  if (run.mode === 'tour') { coach().tour = 'active'; coach().step = run.i; save(); }
  if (st.view) {
    const want = st.params || {};
    const same = app.ui.view === st.view && Object.entries(want).every(([k, v]) => (app.ui.params || {})[k] === v);
    if (!same) { if (st.view === 'food') app.ui.date = dkey(); app.ui.history = []; go(st.view, { ...want }, { push: false }); }
  }
  await frame();
  if (!run) return;
  const el = findTarget(st.target);
  const L = ensureLayer();
  L.classList.remove('hidden');
  L.querySelector('.tour-card').innerHTML = cardHtml(st);
  run.el = el;
  if (el) {
    const safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;
    window.scrollTo({ top: Math.max(0, window.scrollY + el.getBoundingClientRect().top - safeTop - 16), behavior: 'instant' });
  } else if (st.view) window.scrollTo({ top: 0, behavior: 'instant' });
  place();
  setTimeout(place, 380); // nach dem Seitenübergang erneut ausrichten
  L.querySelector('.tour-card [data-primary]')?.focus({ preventScroll: true });
}

function cardHtml(st) {
  const n = run.steps.length, i = run.i, last = i === n - 1;
  const counter = run.mode === 'single' ? 'Hilfe' : run.mode === 'tips' ? `Tipp ${i + 1} von ${n}` : `${i + 1} von ${n}`;
  let btns;
  if (run.mode === 'tour' && st.id === 'done') {
    btns = `<button type="button" class="btn primary block launch" data-a="tourFinish" data-primary>${icon('home', 'sm')} Zum Dashboard</button>
      <button type="button" class="btn ghost block sm" data-a="tourLaterEnd">Tutorial später nochmal ansehen</button>`;
  } else if (run.mode === 'single') {
    btns = `<div class="tour-btns"><button type="button" class="btn ghost" data-a="tourFull">Komplette Tour</button><button type="button" class="btn primary" data-a="tourClose" data-primary>Verstanden</button></div>`;
  } else {
    btns = `<div class="tour-btns">${i > 0 ? '<button type="button" class="btn ghost" data-a="tourPrev">Zurück</button>' : '<span></span>'}<button type="button" class="btn primary" data-a="tourNext" data-primary>${last ? 'Verstanden' : 'Weiter'}</button></div>`;
  }
  return `<button type="button" class="icon-btn sm plain tour-x" data-a="tourClose" aria-label="${run.mode === 'tour' ? 'Tour pausieren' : 'Schließen'}">${icon('x', 'sm')}</button>
    <div class="tour-head">${mascot(st.mascot, { size: st.id === 'done' ? 'md' : 'sm' })}<div><div class="meta gold">${counter}</div><h3 id="tourTitle">${esc(st.title)}</h3></div></div>
    <p class="tour-text">${esc(st.text)}</p>
    ${run.mode !== 'single' ? `<div class="tour-prog" aria-hidden="true"><i style="width:${(((i + 1) / n) * 100).toFixed(1)}%"></i></div>` : ''}
    ${btns}
    ${run.mode === 'tour' && st.id !== 'done' ? '<button type="button" class="link small tour-skip" data-a="tourSkip">Tour überspringen</button>' : ''}`;
}

/** Spotlight und Karte so legen, dass die Karte das hervorgehobene Element nicht verdeckt. */
function place() {
  if (!run || !layer) return;
  const spot = layer.querySelector('.tour-spot'), card = layer.querySelector('.tour-card');
  const vh = window.innerHeight, gap = 12, el = run.el;
  card.classList.remove('top', 'bottom', 'center');
  if (!el || !el.isConnected) { spot.classList.add('off'); layer.classList.add('dim'); card.classList.add('center'); return; }
  layer.classList.remove('dim'); spot.classList.remove('off');
  const r = el.getBoundingClientRect();
  card.classList.add('bottom');
  const ch = card.offsetHeight, edge = ch + gap * 2;
  // Karte auf die Seite legen, auf der mehr vom Element sichtbar bleibt
  const below = Math.min(r.bottom, vh - edge) - Math.max(r.top, 0), above = Math.min(r.bottom, vh) - Math.max(r.top, edge);
  let top = Math.max(r.top, 0), bottom = Math.min(r.bottom, vh);
  if (above > below) { card.classList.replace('bottom', 'top'); top = Math.max(top, edge); }
  else bottom = Math.min(bottom, vh - edge);
  const pad = 6;
  Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${top - pad}px`, width: `${r.width + pad * 2}px`, height: `${Math.max(24, bottom - top) + pad * 2}px` });
}
window.addEventListener('resize', () => requestAnimationFrame(place));
window.addEventListener('scroll', () => { if (run) requestAnimationFrame(place); }, { passive: true });

function endRun() {
  run = null;
  layer?.classList.add('hidden');
  document.body.classList.remove('touring');
  updateFab();
}

A.tourNext = () => { if (!run) return; if (run.i >= run.steps.length - 1) { if (run.mode === 'tour') return A.tourFinish(); return endRun(); } run.i++; showStep(); };
A.tourPrev = () => { if (!run || run.i === 0) return; run.i--; showStep(); };
/** Schließen: Tour pausiert (lässt sich fortsetzen), Tipps/Einzelschritt enden einfach. */
A.tourClose = () => { if (!run) return; const wasTour = run.mode === 'tour'; endRun(); if (wasTour) { save(); toast('Tour pausiert. Fortsetzen über die Coach-Karte.'); commit(); } };
A.tourSkip = () => { coach().tour = 'skipped'; endRun(); save(); go('home', {}, { push: false }); toast('Tour übersprungen. Du findest sie unter Einstellungen → Tutorial & Hilfe.'); };
A.tourFinish = () => { coach().tour = 'done'; coach().step = 0; endRun(); save(); go('home', {}, { push: false }); };
A.tourLaterEnd = () => { coach().tour = 'later'; coach().step = 0; endRun(); save(); go('home', {}, { push: false }); };
A.tourStart = () => { closeWelcome(); startRun(TOUR, 'tour', 0); };
A.tourResume = () => startRun(TOUR, 'tour', coach().step || 0);
A.tourFull = () => { endRun(); A.tourStart(); };
A.tourOne = (el) => { const st = TOUR.find((s) => s.id === el.dataset.id); if (st) startRun([st], 'single'); };
A.tourTips = () => {
  const tips = tipsFor(app.ui.view, app.ui.params || {}).filter((t) => findTarget(t.target));
  if (!tips.length) return toast('Auf dieser Seite gibt es gerade keine Tipps.');
  startRun(tips, 'tips');
};
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (run) { e.stopImmediatePropagation(); A.tourClose(); } else if (document.querySelector('.welcome')) A.tourLater();
}, true);

// ---------- Willkommen ----------
function showWelcome() {
  if (document.querySelector('.welcome')) return;
  const el = document.createElement('div');
  el.className = 'welcome';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'welcomeTitle');
  el.innerHTML = `<div class="welcome-in">
    <div class="welcome-art">${mascot('welcome', { size: 'lg' })}</div>
    <div class="m-bubble lg"><h2 id="welcomeTitle">${esc(WELCOME.title)}</h2>${WELCOME.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
    <button type="button" class="btn primary block xl launch" data-a="tourStart">${icon('play', 'sm')} Tour starten</button>
    <button type="button" class="btn ghost block" data-a="tourLater">Später</button>
  </div>`;
  document.body.appendChild(el);
  document.body.classList.add('touring');
  el.querySelector('[data-a=tourStart]').focus({ preventScroll: true });
}
function closeWelcome() { document.querySelector('.welcome')?.remove(); document.body.classList.remove('touring'); }
A.tourLater = () => { coach().tour = 'later'; closeWelcome(); save(); commit(); updateFab(); };

// ---------- Hilfe-Knopf & Assistent ----------
let fab = null, cardInView = false;
// Auf dem Dashboard ist die Coach-Karte selbst der Löwe – solange sie sichtbar ist, bleibt der Knopf weg
const cardObs = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { cardInView = es.some((e) => e.isIntersecting); updateFab(); }) : null;
function updateFab() {
  if (!fab) return;
  const hide = !coach().fab || app.ui.view === 'session' || !!run || !!document.querySelector('.welcome') || (app.ui.view === 'home' && cardInView);
  fab.classList.toggle('hidden', hide);
}
function watchCard() {
  if (!cardObs) return;
  cardObs.disconnect(); cardInView = false;
  const card = app.ui.view === 'home' && document.querySelector('#app .coach-card');
  if (card) cardObs.observe(card);
}
function helpPanel() {
  const h = pageHelp(app.ui.view, app.ui.params || {});
  const tips = tipsFor(app.ui.view, app.ui.params || {}).filter((t) => findTarget(t.target)).length;
  const hr = new Date().getHours(), name = app.S.profile.name;
  const greet = `${hr < 11 ? 'Guten Morgen' : hr < 18 ? 'Hey' : 'Guten Abend'}${name ? `, ${name}` : ''}! Das hier ist: ${h.title}.`;
  const c = coach();
  return `<div class="coach-panel">${mascotSays(h.mascot, greet, { size: 'sm' })}
    <p class="muted small" style="margin:12px 0 16px">${esc(h.text)}</p>
    <div class="list">
      ${h.step ? `<button type="button" class="item" data-a="tourOne" data-id="${h.step}"><div><b>Diesen Bereich zeigen</b><div class="muted small">Hervorhebung direkt auf der Seite</div></div>${icon('right', 'chev')}</button>` : ''}
      ${tips ? `<button type="button" class="item" data-a="tourTips"><div><b>Tipps zu dieser Seite</b><div class="muted small">${tips} ${tips === 1 ? 'Bedienelement' : 'Bedienelemente'} erklärt</div></div>${icon('right', 'chev')}</button>` : ''}
      <button type="button" class="item" data-a="${c.tour === 'active' ? 'tourResume' : 'tourStart'}"><div><b>${c.tour === 'active' ? `Tour fortsetzen · ${c.step + 1} von ${TOUR.length}` : 'Komplette Tour'}</b><div class="muted small">${TOUR.length} kurze Schritte durch alle Bereiche</div></div>${icon('right', 'chev')}</button>
      <button type="button" class="item" data-a="coachGo" data-v="help"><div><b>Tutorial &amp; Hilfe</b><div class="muted small">Einzelne Bereiche, Einstellungen</div></div>${icon('right', 'chev')}</button>
    </div>
    <button type="button" class="btn block mt" data-a="closeSheet">Schließen</button>
    <p class="faint tiny center" style="margin-bottom:0">Feste Hilfetexte zu den vorhandenen Funktionen, kein Chat.</p></div>`;
}
A.coachHelp = () => openSheet(helpPanel);
A.coachGo = (el) => { closeSheet(); go(el.dataset.v); };

// ---------- Ansicht „Tutorial & Hilfe“ ----------
const STATUS = { new: 'noch nicht gestartet', later: 'für später gemerkt', active: 'unterbrochen', done: 'abgeschlossen', skipped: 'übersprungen' };
function helpView() {
  const c = coach();
  return `<div class="topbar"><button type="button" class="back" data-a="back">${icon('left', 'sm')} Zurück</button></div>
  <h1 class="mb">Tutorial &amp; Hilfe</h1>
  <section class="hero corners coach-hero" aria-label="Tour">
    <i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i>
    <div class="row top">${mascot(c.tour === 'done' ? 'supportive' : 'explaining', { size: 'md' })}
      <div class="grow"><div class="label gold">Geführte Tour</div><div class="cockpit-title">${TOUR.length} Schritte</div><div class="muted small">Status: ${STATUS[c.tour] || '–'}${c.tour === 'active' ? ` · bei Schritt ${c.step + 1}` : ''}</div></div></div>
    <div class="grid2 mt">${c.tour === 'active' ? '<button type="button" class="btn primary" data-a="tourResume">Fortsetzen</button><button type="button" class="btn" data-a="tourStart">Von vorn</button>' : `<button type="button" class="btn primary span2" data-a="tourStart">${c.tour === 'done' || c.tour === 'skipped' ? 'Tour neu starten' : 'Tour starten'}</button>`}</div>
  </section>
  <div class="section">Einzelne Bereiche</div>
  <div class="card"><div class="list">${TOUR.filter((s) => s.id !== 'done').map((s) => `<button type="button" class="item" data-a="tourOne" data-id="${s.id}"><div class="row">${mascot(s.mascot, { size: 'xs', decorative: true })}<div><b>${esc(s.title)}</b></div></div>${icon('right', 'chev')}</button>`).join('')}</div></div>
  <div class="section">Coach</div>
  <div class="card">
    <label class="check"><input type="checkbox" data-c="coachOpt" data-f="reactions" ${c.reactions !== false ? 'checked' : ''}> Reaktionen auf Rekorde, Ziele, Trinkziel und Erinnerungen</label>
    <label class="check"><input type="checkbox" data-c="coachOpt" data-f="fab" ${c.fab !== false ? 'checked' : ''}> Hilfe-Knopf unten rechts anzeigen</label>
    <p class="faint tiny">Ohne Reaktionen erscheinen die gewohnten kurzen Meldungen. Der Coach meldet sich nie ungefragt mit Vorwürfen und empfiehlt keine Dosierungen.</p>
    <button type="button" class="btn ghost block sm" data-a="coachReset">Tutorial-Status zurücksetzen</button>
    <p class="faint tiny" style="margin-bottom:0">Setzt nur Tour und Coach-Hinweise zurück. Trainings, Ernährung und alle anderen Daten bleiben erhalten.</p>
  </div>`;
}
registerView('help', helpView, 'home');
C.coachOpt = (el) => { coach()[el.dataset.f] = el.checked; commit(); updateFab(); };
A.coachReset = () => {
  if (!confirm('Tour und Coach-Hinweise zurücksetzen? Deine Fitness-Daten bleiben erhalten.')) return;
  Object.assign(coach(), { tour: 'new', step: 0, shown: {}, goalMarks: {} });
  commit();
  showWelcome();
  updateFab();
};

// ---------- Start ----------
export function initCoach() {
  fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'coach-fab hidden';
  fab.dataset.a = 'coachHelp';
  fab.setAttribute('aria-label', 'Hilfe vom IRONCORE-Coach');
  fab.innerHTML = mascot('portrait', { size: 'fab', decorative: true });
  document.body.appendChild(fab);
  document.addEventListener('rendered', (e) => { if (e.detail.view !== 'sheet') { watchCard(); updateFab(); } });
  watchCard();
  updateFab();
  // Erster Start: Willkommen (nicht mitten im Training)
  if (coach().tour === 'new' && app.ui.view !== 'session') setTimeout(() => { if (coach().tour === 'new' && !app.ui.sheet && app.ui.view !== 'session') showWelcome(); updateFab(); }, reduceMotion() ? 0 : 250);
}
