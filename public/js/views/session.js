// Aktives Training: ablenkungsfreier Fokus-Modus für das Gym.
// Jede Eingabe wird sofort gespeichert – Neuladen oder Schließen verliert nichts.
import { app, A, I, registerView, commit, save, saveNow, go, openSheet, closeSheet, toast, celebrate } from '../core.js';
import { dkey, lastPerformance, bestByExercise, prEvents, validate, LIMITS, workoutVolume, workoutSets, compareWithPrevious, num } from '../logic.js';
import { $, esc, fmt, fmtSec, fmtDur, icon, relDay, plural, signed, corners } from '../ui.js';
import { exById, findDay, findOrCreateExercise } from '../domain.js';
import { uid } from '../store.js';
import { pickExercise } from './training.js';

const curIndex = () => Math.min(app.S.active.cur || 0, Math.max(0, app.S.active.exercises.length - 1));
const exKeyOf = (e) => e.exId || 'name:' + e.name.trim().toLowerCase();

// ---------- Start ----------
function makeSessionEx(exId, { sets = 3, reps = '', kg = null, rest = 90, note = '' } = {}) {
  const lib = exById(exId);
  return { exId, name: lib ? lib.name : 'Übung', target: reps ? `${sets} × ${reps}` : '', kg, rest, note, sets: Array.from({ length: Math.max(1, sets) }, () => ({ w: '', r: '', done: false })) };
}
function startSession(s) {
  if (app.S.active && !confirm(`„${app.S.active.name}“ läuft noch. Verwerfen und neu starten?`)) return;
  app.S.active = { id: uid(), start: Date.now(), note: '', cur: 0, ...s };
  closeSheet();
  unlockAudio(); keepAwake(true);
  saveNow();
  go('session', {}, { push: false });
}
A.startWorkout = (el) => {
  const id = el.dataset.id;
  if (!id) return startSession({ planId: null, dayId: null, name: 'Freies Training', exercises: [] });
  const f = findDay(id);
  if (!f) return toast('Trainingstag nicht gefunden', true);
  startSession({ planId: f.plan.id, dayId: f.day.id, name: f.day.name, exercises: f.day.ex.filter((e) => exById(e.exId)).map((e) => makeSessionEx(e.exId, e)) });
};
A.repeatWorkout = (el) => {
  const w = app.S.workouts.find((x) => x.id === el.dataset.id);
  startSession({
    planId: w.planId || null, dayId: w.dayId || null, name: w.name,
    exercises: w.exercises.map((e) => { const id = e.exId || findOrCreateExercise(e.name).id; const x = makeSessionEx(id, { sets: e.sets.length, kg: e.sets[0]?.w || null }); x.target = `${e.sets.length} Sätze wie am ${relDay(w.date)}`; return x; }),
  });
};

// ---------- Ansicht ----------
function view() {
  const a = app.S.active;
  if (!a) { setTimeout(() => go('train', {}, { push: false })); return ''; }
  const i = curIndex();
  const e = a.exercises[i];
  const doneSets = a.exercises.reduce((s, x) => s + x.sets.filter((y) => y.done).length, 0);
  const allSets = a.exercises.reduce((s, x) => s + x.sets.length, 0);
  const vol = a.exercises.reduce((n, x) => n + x.sets.filter((y) => y.done).reduce((m, y) => m + (+y.w || 0) * (+y.r || 0), 0), 0);
  return `
  <div class="topbar"><button type="button" class="back" data-a="go" data-v="train">${icon('left', 'sm')} Training</button><span class="meta">Live-Session</span></div>
  <section class="hero corners panel-head" aria-label="Session-Status">${corners()}
    <div class="label gold">Aktives Training</div>
    <div class="cockpit-title">${esc(a.name)}</div>
    <div class="telemetry" style="margin-bottom:12px">
      <div><div class="meta">Dauer</div><div class="v" id="dur">${fmtDur(Date.now() - a.start)}</div></div>
      <div><div class="meta">Volumen</div><div class="v gold">${fmt(vol)}<span class="unit"> kg</span></div></div>
      <div><div class="meta">Sätze</div><div class="v">${doneSets}<span class="unit">/${allSets}</span></div></div>
    </div>
    <div class="bar"><i style="width:${allSets ? (doneSets / allSets) * 100 : 0}%"></i></div>
  </section>
  ${a.exercises.length ? `<div class="ex-strip">${a.exercises.map((x, xi) => { const fin = x.sets.length && x.sets.every((y) => y.done); return `<button type="button" class="${xi === i ? 'on' : ''} ${fin ? 'done' : ''}" data-a="goEx" data-i="${xi}">${fin ? '✓ ' : `${xi + 1} `}${esc(x.name)}</button>`; }).join('')}</div>` : ''}
  ${e ? focusCard(e, i, a.exercises.length) : `<div class="card empty-card">${icon('dumbbell', 'lg')}<div class="empty">Füge deine erste Übung hinzu.</div></div>`}
  <button type="button" class="btn block" data-a="addSessionEx">${icon('plus', 'sm')} Übung hinzufügen</button>
  <div class="card mt"><label class="field" style="margin:0"><span>Notiz zum Training</span><textarea data-i="sessNote" placeholder="Energie, Schlaf, Pump, Schmerzen …">${esc(a.note)}</textarea></label></div>
  <button type="button" class="btn primary block launch" data-a="finishWorkout">${icon('check')} Training beenden</button>
  <button type="button" class="btn ghost block mt" data-a="cancelWorkout">Training verwerfen</button>`;
}
registerView('session', view, 'train');

function focusCard(e, i, total) {
  const a = app.S.active;
  const key = exKeyOf(e);
  const last = lastPerformance(app.S.workouts, key, a.start);
  const best = bestByExercise(app.S.workouts).get(key);
  const lib = exById(e.exId);
  const curSet = e.sets.findIndex((s) => !s.done);
  const allDone = curSet === -1;
  return `<div class="card panel">
    <div class="row between top"><div class="grow">
      <div class="label">${lib ? `${esc(lib.muscle)} · ${esc(lib.equipment)}` : 'Übung'} · ${i + 1}/${total}</div>
      <div class="focus-name">${esc(e.name)}</div>
      <div class="muted small">${e.target ? esc(e.target) : `${e.sets.length} Sätze`}${e.kg ? ` · Ziel ${fmt(e.kg, 1)} kg` : ''} · Pause ${fmtSec(e.rest)}</div></div>
      <div class="row">${lib && (lib.instructions || lib.notes) ? `<button type="button" class="icon-btn sm" data-a="showHow" data-id="${lib.id}" aria-label="Ausführung">${icon('book', 'sm')}</button>` : ''}<button type="button" class="icon-btn sm" data-a="exMenu" data-i="${i}" aria-label="Optionen">${icon('more', 'sm')}</button></div></div>
    ${e.note ? `<div class="small gold" style="margin-top:8px">${esc(e.note)}</div>` : ''}
    ${lib?.notes ? `<div class="faint tiny" style="margin-top:4px">${esc(lib.notes)}</div>` : ''}
    <div class="prev-box">${last ? `<div class="row between"><span class="muted">Letztes Mal · ${relDay(last.date)}</span>${best ? `<span class="faint tiny">Best e1RM ${fmt(best.e1rm, 1)}</span>` : ''}</div><div class="sets" style="margin-top:3px">${last.sets.map((s) => `${fmt(s.w, 1)}×${s.r}`).join('   ')}</div>` : '<span class="muted">Erstes Mal – heute legst du die Basis.</span>'}</div>
    <div class="set head"><span>#</span><span>kg</span><span>Wdh.</span><span></span></div>
    ${e.sets.map((s, si) => {
      const ph = last ? (last.sets[si] || last.sets[last.sets.length - 1]) : null;
      const phW = e.kg != null ? e.kg : ph ? ph.w : null;
      return `<div class="set ${s.done ? 'done' : ''} ${si === curSet ? 'cur' : ''} ${flash === si ? 'flash' : ''}"><span class="n">${si + 1}</span>
        <input type="text" inputmode="decimal" data-i="set" data-s="${si}" data-f="w" value="${esc(s.w)}" placeholder="${phW != null ? fmt(phW, 1) : 'kg'}" aria-label="Gewicht Satz ${si + 1}">
        <input type="text" inputmode="numeric" data-i="set" data-s="${si}" data-f="r" value="${esc(s.r)}" placeholder="${ph ? ph.r : 'Wdh'}" aria-label="Wiederholungen Satz ${si + 1}">
        <button type="button" class="ok" data-a="setDone" data-s="${si}" aria-label="Satz ${si + 1} erledigt">${icon('check')}</button></div>`;
    }).join('')}
    <div class="row"><button type="button" class="btn sm" data-a="addSet">${icon('plus', 'sm')} Satz</button>${e.sets.length > 1 ? `<button type="button" class="btn sm ghost" data-a="delSet">${icon('minus', 'sm')} Satz</button>` : ''}</div>
    <div class="grid2 mt">
      <button type="button" class="btn" data-a="goEx" data-i="${i - 1}" ${i === 0 ? 'disabled' : ''}>${icon('left', 'sm')} Vorherige</button>
      <button type="button" class="btn ${allDone ? 'primary' : ''}" data-a="goEx" data-i="${i + 1}" ${i >= total - 1 ? 'disabled' : ''}>Nächste ${icon('right', 'sm')}</button>
    </div>
  </div>`;
}

// ---------- Eingaben ----------
const curEx = () => app.S.active.exercises[curIndex()];
let flash = null; // Index des gerade abgehakten Satzes → kurzes Gold-Aufblitzen
I.set = (el) => { curEx().sets[+el.dataset.s][el.dataset.f] = el.value.replace(',', '.').trim(); save(); };
I.sessNote = (el) => { app.S.active.note = el.value; save(); };
A.goEx = (el) => { const n = +el.dataset.i; if (n < 0 || n >= app.S.active.exercises.length) return; app.S.active.cur = n; commit(); window.scrollTo({ top: 0 }); };
A.setDone = (el) => {
  const e = curEx(), si = +el.dataset.s, s = e.sets[si];
  if (s.done) { s.done = false; return commit(); }
  // Leere Felder mit den angezeigten Vorschlägen füllen (Ziel-kg bzw. letzte Leistung)
  const last = lastPerformance(app.S.workouts, exKeyOf(e), app.S.active.start);
  const ph = last ? (last.sets[si] || last.sets[last.sets.length - 1]) : null;
  if (s.w === '' && (e.kg != null || ph)) s.w = String(e.kg != null ? e.kg : ph.w);
  if (s.r === '' && ph) s.r = String(ph.r);
  const w = validate(s.w, LIMITS.liftKg), r = validate(s.r, { ...LIMITS.reps, min: 1 });
  if (!w.ok || !r.ok) { commit(); return toast((w.ok ? r : w).error, true); }
  s.w = String(w.value); s.r = String(r.value); s.done = true;
  unlockAudio();
  startRest(e.rest);
  flash = si;
  if (navigator.vibrate) navigator.vibrate(18);
  commit();
  flash = null;
};
A.addSet = () => { const e = curEx(); const l = e.sets[e.sets.length - 1]; e.sets.push({ w: l ? l.w : '', r: l ? l.r : '', done: false }); commit(); };
A.delSet = () => { const e = curEx(); if (e.sets.length > 1) { e.sets.pop(); commit(); } };
A.addSessionEx = () => pickExercise((exId) => { const a = app.S.active; a.exercises.push(makeSessionEx(exId, { sets: 3 })); a.cur = a.exercises.length - 1; commit(); });
A.showHow = (el) => { const e = exById(el.dataset.id); openSheet(() => `<h2>${esc(e.name)}</h2>${e.instructions ? `<div class="label" style="margin-bottom:6px">Ausführung</div><p class="small">${esc(e.instructions)}</p>` : ''}${e.notes ? `<div class="label" style="margin:14px 0 6px">Meine Notizen</div><p class="small" style="white-space:pre-wrap">${esc(e.notes)}</p>` : ''}`); };
A.exMenu = (el) => {
  const i = +el.dataset.i;
  openSheet(() => { const e = app.S.active.exercises[i]; return `<h2>${esc(e.name)}</h2>
    <label class="field"><span>Pause in Sekunden</span><input id="restIn" type="number" inputmode="numeric" min="0" max="900" step="15" value="${e.rest}"></label>
    <button type="button" class="btn block" data-a="setRest" data-i="${i}">Pause übernehmen</button>
    <div class="grid2 mt"><button type="button" class="btn" data-a="moveSessEx" data-i="${i}" data-n="-1" ${i === 0 ? 'disabled' : ''}>${icon('up', 'sm')} Nach vorn</button><button type="button" class="btn" data-a="moveSessEx" data-i="${i}" data-n="1" ${i === app.S.active.exercises.length - 1 ? 'disabled' : ''}>${icon('down', 'sm')} Nach hinten</button></div>
    <button type="button" class="btn danger block mt" data-a="delSessEx" data-i="${i}">${icon('trash', 'sm')} Aus diesem Training entfernen</button>`; });
};
A.setRest = (el) => { const v = validate($('#restIn').value, { min: 0, max: 900, label: 'Pause' }); if (!v.ok) return toast(v.error, true); app.S.active.exercises[+el.dataset.i].rest = Math.round(v.value); closeSheet(); commit(); };
A.moveSessEx = (el) => { const a = app.S.active, i = +el.dataset.i, j = i + +el.dataset.n; [a.exercises[i], a.exercises[j]] = [a.exercises[j], a.exercises[i]]; a.cur = j; closeSheet(); commit(); };
A.delSessEx = (el) => { const a = app.S.active; a.exercises.splice(+el.dataset.i, 1); a.cur = Math.max(0, Math.min(a.cur, a.exercises.length - 1)); closeSheet(); commit(); };

// ---------- Beenden ----------
A.finishWorkout = () => {
  const a = app.S.active;
  const exs = a.exercises.map((e) => ({ exId: e.exId, name: e.name, sets: e.sets.filter((s) => s.done).map((s) => ({ w: num(s.w), r: num(s.r) })) })).filter((e) => e.sets.length);
  const open = a.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done && (s.w !== '' || s.r !== '')).length, 0);
  if (!exs.length) {
    if (!confirm('Kein Satz abgehakt. Training ohne Speichern beenden?')) return;
    endSession(); go('train', {}, { push: false }); return;
  }
  if (open && !confirm(`${plural(open, 'ausgefüllter Satz ist', 'ausgefüllte Sätze sind')} nicht abgehakt und wird nicht gespeichert. Trotzdem beenden?`)) return;
  const prsBefore = prEvents(app.S.workouts).length;
  const w = { id: a.id, planId: a.planId || null, dayId: a.dayId || null, name: a.name, date: dkey(new Date(a.start)), start: a.start, end: Date.now(), note: a.note.trim(), exercises: exs };
  app.S.workouts.push(w);
  const newPrs = prEvents(app.S.workouts).slice(prsBefore).filter((p) => p.workoutId === w.id);
  const cmp = compareWithPrevious(app.S.workouts, w);
  endSession();
  saveNow();
  go('train', { tab: 'history' }, { push: false });
  openSheet(() => summarySheet(w, newPrs, cmp));
  if (newPrs.length) celebrate(newPrs.length === 1 ? 'Neuer Rekord' : `${newPrs.length} neue Rekorde`, newPrs.map((p) => `${p.name}: ${fmt(p.w, 1)} kg × ${p.r} (e1RM ${fmt(p.e1rm, 1)} kg)`));
  document.dispatchEvent(new CustomEvent('goals-check'));
};
function summarySheet(w, prs, cmp) {
  return `<div class="label gold">Training gespeichert</div><h2 style="margin-top:6px">${esc(w.name)}</h2>
    <div class="grid3"><div class="card elev stat"><div class="label">Dauer</div><div class="v">${fmtDur(w.end - w.start)}</div></div><div class="card elev stat"><div class="label">Sätze</div><div class="v">${workoutSets(w)}</div></div><div class="card elev stat"><div class="label">Volumen</div><div class="v gold">${fmt(workoutVolume(w))}</div><div class="s">kg</div></div></div>
    ${cmp ? `<div class="card elev mt"><div class="small">Im Vergleich zur letzten Einheit (${relDay(cmp.prev.date)}): <b class="${cmp.deltaPct >= 0 ? 'gold' : ''}">${cmp.deltaPct != null ? signed(cmp.deltaPct, 0, ' %') : '–'}</b> Volumen · ${cmp.sets} statt ${cmp.prevSets} Sätze</div></div>` : '<p class="muted small">Erste Einheit dieser Art – ab der nächsten siehst du den Vergleich.</p>'}
    ${prs.length ? `<div class="label mt" style="margin-bottom:8px">Rekorde</div>${prs.map((p) => `<div class="pr"><div class="medal">${icon('trophy', 'sm')}</div><div class="grow"><b>${esc(p.name)}</b><div class="muted small">${fmt(p.w, 1)} kg × ${p.r}</div></div><div class="right num"><b class="gold">${fmt(p.e1rm, 1)}</b><div class="faint tiny">vorher ${fmt(p.prev, 1)}</div></div></div>`).join('')}` : ''}
    <button type="button" class="btn primary block xl mt" data-a="closeSheet">Fertig</button>`;
}
A.cancelWorkout = () => { if (confirm('Training wirklich verwerfen? Nichts wird gespeichert.')) { endSession(); saveNow(); go('train', {}, { push: false }); } };
function endSession() { app.S.active = null; app.ui.rest = null; keepAwake(false); tick(); }

// ---------- Pausen-Timer ----------
let actx = null;
function unlockAudio() {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch { /* kein Audio */ }
}
function beep() {
  if (actx) {
    [0, 0.28].forEach((t) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(actx.destination);
      const at = actx.currentTime + t;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.25, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      o.start(at); o.stop(at + 0.22);
    });
  }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}
function startRest(sec) { if (!sec) return; app.ui.rest = { end: Date.now() + sec * 1000, total: sec, beeped: false }; tick(); }
const RC = 2 * Math.PI * 19;
export function tick() {
  const dur = $('#dur');
  if (dur && app.S.active) dur.textContent = fmtDur(Date.now() - app.S.active.start);
  const rb = $('#restbar');
  const r = app.ui.rest;
  document.body.classList.toggle('resting', !!r);
  if (!r) { rb.classList.add('hidden'); return; }
  const left = Math.max(0, (r.end - Date.now()) / 1000);
  if (left <= 0 && !r.beeped) { r.beeped = true; beep(); }
  if (left <= 0 && Date.now() - r.end > 20000) { app.ui.rest = null; rb.classList.add('hidden'); document.body.classList.remove('resting'); return; }
  if (!rb.firstChild) rb.innerHTML = `<svg class="rr" viewBox="0 0 46 46" aria-hidden="true"><circle class="rt" cx="23" cy="23" r="19"/><circle class="ra" cx="23" cy="23" r="19" stroke-dasharray="${RC.toFixed(2)}" transform="rotate(-90 23 23)"/></svg><div class="grow"><div class="lbl">Pause</div><span class="t"></span></div><button type="button" class="btn sm" data-a="restAdd">+15 s</button><button type="button" class="icon-btn sm" data-a="restSkip" aria-label="Pause beenden">${icon('x', 'sm')}</button>`;
  rb.classList.remove('hidden');
  rb.classList.toggle('end', left <= 0);
  rb.querySelector('.t').textContent = left > 0 ? fmtSec(Math.ceil(left)) : 'Los!';
  rb.querySelector('.lbl').textContent = left > 0 ? 'Pause' : 'Nächster Satz';
  rb.querySelector('.ra').style.strokeDashoffset = (RC * (1 - left / r.total)).toFixed(2);
}
A.restAdd = () => { const r = app.ui.rest; if (r) { r.end = Math.max(r.end, Date.now()) + 15000; r.total += 15; r.beeped = false; tick(); } };
A.restSkip = () => { app.ui.rest = null; tick(); };
setInterval(tick, 500);

// Display während des Trainings anlassen
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* nicht unterstützt */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && app.S.active) keepAwake(true); });
if (app.S.active) keepAwake(true);
