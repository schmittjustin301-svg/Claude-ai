// Training: Pläne, Plan-Editor, Übungsbibliothek, Analyse, Verlauf.
import { app, A, C, I, registerView, commit, save, go, openSheet, closeSheet, toast } from '../core.js';
import { dkey, addDays, prEvents, bestByExercise, exerciseProgress, weeklyTraining, setsPerMuscle, workoutVolume, workoutSets, validate, LIMITS, num } from '../logic.js';
import { esc, fmt, icon, bar, relDay, shortDate, fmtDur, WD, WD_ORDER, emptyCard, lineChart, barChart, plural, formVals, markInvalid, longDate } from '../ui.js';
import { activePlan, plannedFor, exById, exName, muscleOf } from '../domain.js';
import { uid, planFromTemplate } from '../store.js';
import { MUSCLES, EQUIPMENT, PLAN_TEMPLATES } from '../seed.js';

const TABS = [['plan', 'Plan'], ['analytics', 'Analyse'], ['history', 'Verlauf'], ['library', 'Übungen']];

function view(params) {
  const tab = params.tab || 'plan';
  return `<div class="topbar"><h1>Training</h1>${app.S.active ? `<button type="button" class="btn primary sm" data-a="go" data-v="session">${icon('play', 'sm')} Läuft</button>` : ''}</div>
  <div class="seg">${TABS.map(([k, l]) => `<button type="button" class="${tab === k ? 'on' : ''}" data-a="trainTab" data-v="${k}">${l}</button>`).join('')}</div>
  ${tab === 'plan' ? planTab() : tab === 'analytics' ? analyticsTab() : tab === 'history' ? historyTab() : libraryTab(params)}`;
}
registerView('train', view, 'train');
A.trainTab = (el) => { app.ui.params = { ...app.ui.params, tab: el.dataset.v }; commit(); };

// ---------- Plan ----------
function planTab() {
  const S = app.S, plan = activePlan(), k = dkey();
  const today = plannedFor(k).map((d) => d.id);
  return `
  <div class="card" data-tour="train-plan">
    <div class="row between"><div><div class="label">Aktiver Plan</div><div class="mid" style="margin-top:6px">${esc(plan.name)}</div></div>
      <button type="button" class="btn outline sm" data-a="go" data-v="plan" data-id="${plan.id}">${icon('edit', 'sm')} Bearbeiten</button></div>
    ${S.plans.length > 1 ? `<div class="chips mt">${S.plans.map((p) => `<button type="button" class="chip ${p.id === plan.id ? 'on' : ''}" data-a="activatePlan" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div>` : ''}
    <div class="row mt"><button type="button" class="btn sm grow" data-a="dupPlan" data-id="${plan.id}">${icon('copy', 'sm')} Duplizieren</button><button type="button" class="btn sm grow" data-a="newPlan">${icon('plus', 'sm')} Neuer Plan</button></div>
  </div>
  ${plan.days.length ? plan.days.map((d, di) => `<div class="card ${today.includes(d.id) ? 'gold-edge' : ''}">
      <div class="row between top"><div class="grow"><div class="row"><b style="font-size:16px">${esc(d.name)}</b>${today.includes(d.id) ? '<span class="pill gold">Heute</span>' : ''}</div>
        <div class="muted small" style="margin-top:3px">${d.wd.length ? WD_ORDER.filter((w) => d.wd.includes(w)).map((w) => WD[w]).join(' · ') : 'kein fester Tag'} · ${plural(d.ex.length, 'Übung', 'Übungen')}</div>
        <div class="faint tiny" style="margin-top:4px">${esc(d.ex.map((e) => exName(e.exId)).join(' · '))}</div></div></div>
      <div class="row mt"><button type="button" class="btn sm grow" data-a="previewDay" data-id="${d.id}">${icon('list', 'sm')} Letzte Leistung</button><button type="button" class="btn primary sm grow" data-a="startWorkout" data-id="${d.id}"${di === 0 ? ' data-tour="start-workout"' : ''}>${icon('play', 'sm')} Starten</button></div>
    </div>`).join('') : emptyCard('dumbbell', 'Noch keine Trainingstage', 'Leg im Plan-Editor deine Trainingstage an.', `<button type="button" class="btn primary sm" data-a="go" data-v="plan" data-id="${plan.id}">Plan bearbeiten</button>`)}
  <button type="button" class="btn block" data-a="startWorkout" data-id="">${icon('plus', 'sm')} Freies Training starten</button>`;
}
A.activatePlan = (el) => { app.S.activePlanId = el.dataset.id; commit(); toast('Plan aktiviert'); };
A.dupPlan = (el) => {
  const p = app.S.plans.find((x) => x.id === el.dataset.id);
  const copy = { ...structuredClone(p), id: uid(), name: p.name + ' (Kopie)' };
  copy.days.forEach((d) => { d.id = uid(); d.ex.forEach((e) => { e.id = uid(); }); });
  app.S.plans.push(copy);
  app.S.activePlanId = copy.id;
  save();
  go('plan', { id: copy.id });
  toast('Plan dupliziert – Kopie ist jetzt aktiv');
};
A.newPlan = () => openSheet(() => `<h2>Neuer Plan</h2>
  <div class="list">${Object.entries(PLAN_TEMPLATES).map(([k, t]) => `<button type="button" class="item" data-a="createPlan" data-v="${k}"><div><b>${esc(t.name)}</b><div class="muted small">${t.days.length} Trainingstage · Vorlage</div></div>${icon('right', 'chev')}</button>`).join('')}
  <button type="button" class="item" data-a="createPlan" data-v=""><div><b>Leerer Plan</b><div class="muted small">Selbst aufbauen</div></div>${icon('right', 'chev')}</button></div>`);
A.createPlan = (el) => {
  const p = el.dataset.v ? planFromTemplate(el.dataset.v, app.S.exercises) : { id: uid(), name: 'Neuer Plan', days: [] };
  app.S.plans.push(p);
  app.S.activePlanId = p.id;
  closeSheet(); save();
  go('plan', { id: p.id });
};

// ---------- Plan-Editor ----------
function planEditor(params) {
  const p = app.S.plans.find((x) => x.id === params.id) || activePlan();
  return `<div class="topbar"><button type="button" class="back" data-a="back">${icon('left', 'sm')} Training</button>${p.id !== app.S.activePlanId ? `<button type="button" class="btn sm" data-a="activatePlan" data-id="${p.id}">Aktivieren</button>` : '<span class="pill gold">Aktiv</span>'}</div>
  <label class="field"><span>Name des Plans</span><input data-c="planName" data-id="${p.id}" value="${esc(p.name)}"></label>
  ${p.days.map((d, di) => `<div class="card">
    <div class="row"><input class="grow" style="font-weight:600" data-c="dayName" data-p="${p.id}" data-d="${di}" value="${esc(d.name)}" aria-label="Name des Tages">
      <button type="button" class="icon-btn sm" data-a="dupDay" data-p="${p.id}" data-d="${di}" aria-label="Tag duplizieren">${icon('copy', 'sm')}</button>
      <button type="button" class="icon-btn sm" data-a="delDay" data-p="${p.id}" data-d="${di}" aria-label="Tag löschen">${icon('trash', 'sm')}</button></div>
    <div class="chips" style="margin:10px 0 14px">${WD_ORDER.map((w) => `<button type="button" class="chip ${d.wd.includes(w) ? 'on' : ''}" data-a="toggleWd" data-p="${p.id}" data-d="${di}" data-w="${w}">${WD[w]}</button>`).join('')}</div>
    ${d.ex.map((e, ei) => `<div class="plan-ex">
      <div class="row"><button type="button" class="link grow" style="text-align:left;color:var(--text)" data-a="swapEx" data-p="${p.id}" data-d="${di}" data-e="${ei}"><b>${esc(exName(e.exId, 'Übung wählen'))}</b> <span class="faint tiny">${esc(exById(e.exId)?.muscle || '')}</span></button>
        <button type="button" class="icon-btn sm plain" data-a="moveEx" data-p="${p.id}" data-d="${di}" data-e="${ei}" data-n="-1" ${ei === 0 ? 'disabled' : ''} aria-label="nach oben">${icon('up', 'sm')}</button>
        <button type="button" class="icon-btn sm plain" data-a="moveEx" data-p="${p.id}" data-d="${di}" data-e="${ei}" data-n="1" ${ei === d.ex.length - 1 ? 'disabled' : ''} aria-label="nach unten">${icon('down', 'sm')}</button>
        <button type="button" class="icon-btn sm plain" data-a="delPlanEx" data-p="${p.id}" data-d="${di}" data-e="${ei}" aria-label="entfernen">${icon('x', 'sm')}</button></div>
      <div class="g">
        <label><span>Sätze</span><input type="number" inputmode="numeric" min="1" max="20" data-c="planEx" data-p="${p.id}" data-d="${di}" data-e="${ei}" data-f="sets" value="${e.sets}"></label>
        <label><span>Wdh.</span><input data-c="planEx" data-p="${p.id}" data-d="${di}" data-e="${ei}" data-f="reps" value="${esc(e.reps)}"></label>
        <label><span>Ziel kg</span><input inputmode="decimal" data-c="planEx" data-p="${p.id}" data-d="${di}" data-e="${ei}" data-f="kg" value="${e.kg ?? ''}" placeholder="–"></label>
        <label><span>Pause s</span><input type="number" inputmode="numeric" min="0" max="900" step="15" data-c="planEx" data-p="${p.id}" data-d="${di}" data-e="${ei}" data-f="rest" value="${e.rest}"></label>
      </div>
      <input class="mt" style="min-height:38px;font-size:14px;padding:8px 10px" data-c="planEx" data-p="${p.id}" data-d="${di}" data-e="${ei}" data-f="note" value="${esc(e.note || '')}" placeholder="Notiz zur Übung (z. B. Sitzhöhe 4, enger Griff)">
    </div>`).join('')}
    <button type="button" class="btn sm" data-a="addPlanEx" data-p="${p.id}" data-d="${di}">${icon('plus', 'sm')} Übung</button>
  </div>`).join('')}
  <button type="button" class="btn block" data-a="addDay" data-p="${p.id}">${icon('plus', 'sm')} Trainingstag hinzufügen</button>
  ${app.S.plans.length > 1 ? `<button type="button" class="btn danger block mt" data-a="delPlan" data-id="${p.id}">${icon('trash', 'sm')} Plan löschen</button>` : ''}
  <p class="faint tiny center mt">Änderungen werden sofort gespeichert. Dein Trainingsverlauf bleibt unberührt.</p>`;
}
registerView('plan', planEditor, 'train');
const planOf = (el) => app.S.plans.find((p) => p.id === el.dataset.p);
const dayOf = (el) => planOf(el).days[+el.dataset.d];
function moveIn(arr, i, n) { const j = i + n; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
C.planName = (el) => { app.S.plans.find((p) => p.id === el.dataset.id).name = el.value.trim() || 'Plan'; save(); };
C.dayName = (el) => { dayOf(el).name = el.value.trim() || 'Tag'; save(); };
C.planEx = (el) => {
  const e = dayOf(el).ex[+el.dataset.e], f = el.dataset.f;
  if (f === 'sets') e.sets = Math.round(Math.min(20, Math.max(1, num(el.value, 3))));
  else if (f === 'rest') e.rest = Math.round(Math.min(900, Math.max(0, num(el.value, 90))));
  else if (f === 'kg') { const r = validate(el.value, { ...LIMITS.liftKg, required: false }); if (!r.ok) { el.classList.add('invalid'); return toast(r.error, true); } el.classList.remove('invalid'); e.kg = r.value; }
  else e[f] = el.value.trim();
  save();
};
A.toggleWd = (el) => { const d = dayOf(el), w = +el.dataset.w; d.wd = d.wd.includes(w) ? d.wd.filter((x) => x !== w) : [...d.wd, w]; commit(); };
A.moveEx = (el) => { moveIn(dayOf(el).ex, +el.dataset.e, +el.dataset.n); commit(); };
A.delPlanEx = (el) => { dayOf(el).ex.splice(+el.dataset.e, 1); commit(); };
A.addDay = (el) => { const p = planOf(el); p.days.push({ id: uid(), name: `Tag ${p.days.length + 1}`, wd: [], ex: [] }); commit(); };
A.dupDay = (el) => { const p = planOf(el), d = dayOf(el); const c = structuredClone(d); c.id = uid(); c.name = d.name + ' (Kopie)'; c.wd = []; c.ex.forEach((e) => { e.id = uid(); }); p.days.splice(+el.dataset.d + 1, 0, c); commit(); toast('Tag dupliziert'); };
A.delDay = (el) => { const d = dayOf(el); if (confirm(`„${d.name}“ löschen?`)) { planOf(el).days.splice(+el.dataset.d, 1); commit(); } };
A.delPlan = (el) => {
  const p = app.S.plans.find((x) => x.id === el.dataset.id);
  if (!confirm(`Plan „${p.name}“ löschen? Dein Trainingsverlauf bleibt erhalten.`)) return;
  app.S.plans = app.S.plans.filter((x) => x.id !== p.id);
  if (app.S.activePlanId === p.id) app.S.activePlanId = app.S.plans[0].id;
  save(); go('train', { tab: 'plan' }, { push: false });
};
A.addPlanEx = (el) => { const { p, d } = el.dataset; pickExercise((exId) => { const day = app.S.plans.find((x) => x.id === p).days[+d]; day.ex.push({ id: uid(), exId, sets: 3, reps: '8-12', kg: null, rest: 90, note: '' }); commit(); }); };
A.swapEx = (el) => { const { p, d, e } = el.dataset; pickExercise((exId) => { app.S.plans.find((x) => x.id === p).days[+d].ex[+e].exId = exId; commit(); }); };

// ---------- Übungsauswahl (Plan & Training) ----------
let pickerCb = null;
let pickerState = { q: '', muscle: '' };
export function pickExercise(cb) {
  pickerCb = cb;
  pickerState = { q: '', muscle: '' };
  openSheet(pickerSheet);
}
function pickerList() {
  const q = pickerState.q.trim().toLowerCase();
  const list = app.S.exercises.filter((e) => (!q || e.name.toLowerCase().includes(q)) && (!pickerState.muscle || e.muscle === pickerState.muscle))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return list.map((e) => `<button type="button" class="item" data-a="pickEx" data-id="${e.id}"><div><b>${esc(e.name)}</b><div class="muted tiny">${esc(e.muscle)} · ${esc(e.equipment)}</div></div>${icon('plus', 'chev')}</button>`).join('')
    + `<button type="button" class="item" data-a="newExFromPicker"><div><b class="gold">+ Neue Übung${q ? ` „${esc(pickerState.q.trim())}“` : ''}</b><div class="muted tiny">eigene Übung anlegen</div></div></button>`;
}
function pickerSheet() {
  return `<h2>Übung wählen</h2>
    <input id="exQ" data-i="exQ" placeholder="Suchen …" value="${esc(pickerState.q)}" autocomplete="off">
    <div class="chips" style="margin:10px 0">${['', ...MUSCLES].map((m) => `<button type="button" class="chip ${pickerState.muscle === m ? 'on' : ''}" data-a="exMuscle" data-v="${m}">${m || 'Alle'}</button>`).join('')}</div>
    <div class="list" id="exList">${pickerList()}</div>`;
}
I.exQ = (el) => { pickerState.q = el.value; document.querySelector('#exList').innerHTML = pickerList(); };
A.exMuscle = (el) => { pickerState.muscle = el.dataset.v; const q = document.querySelector('#exQ')?.value || ''; pickerState.q = q; app.ui.sheet = pickerSheet; openSheet(pickerSheet); };
A.pickEx = (el) => { const cb = pickerCb; pickerCb = null; closeSheet(); if (cb) cb(el.dataset.id); };
A.newExFromPicker = () => openSheet(exerciseEditSheet(null, pickerState.q.trim(), true));

// ---------- Übungsbibliothek ----------
let libState = { q: '', muscle: '' };
function libraryTab() {
  const best = bestByExercise(app.S.workouts);
  const q = libState.q.trim().toLowerCase();
  const list = app.S.exercises.filter((e) => (!q || e.name.toLowerCase().includes(q)) && (!libState.muscle || e.muscle === libState.muscle)).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return `<div class="row mb"><input class="grow" data-c="libQ" placeholder="Übung suchen …" value="${esc(libState.q)}"><button type="button" class="btn primary" data-a="newExercise">${icon('plus', 'sm')}</button></div>
  <div class="chips mb">${['', ...MUSCLES].map((m) => `<button type="button" class="chip ${libState.muscle === m ? 'on' : ''}" data-a="libMuscle" data-v="${m}">${m || 'Alle'}</button>`).join('')}</div>
  <div class="card">${list.length ? `<div class="list">${list.map((e) => { const b = best.get(e.id); return `<button type="button" class="item" data-a="showExercise" data-id="${e.id}"><div class="grow"><b>${esc(e.name)}</b>${e.custom ? ' <span class="pill">eigene</span>' : ''}<div class="muted tiny">${esc(e.muscle)} · ${esc(e.equipment)}</div></div><div class="r">${b ? `<span class="gold num" style="font-weight:700">${fmt(b.e1rm, 1)}</span><div class="faint tiny">e1RM</div>` : ''}</div>${icon('right', 'chev')}</button>`; }).join('')}</div>` : '<div class="empty">Keine Übung gefunden.</div>'}</div>
  <p class="faint tiny center">${app.S.exercises.length} Übungen · e1RM = geschätztes 1-Wiederholungs-Maximum aus deinem besten Satz</p>`;
}
C.libQ = (el) => { libState.q = el.value; commit(); };
A.libMuscle = (el) => { libState.muscle = el.dataset.v; commit(); };
A.newExercise = () => openSheet(exerciseEditSheet(null, libState.q.trim()));
A.showExercise = (el) => openSheet(exerciseSheet(el.dataset.id));

export function exerciseSheet(id) {
  return () => {
    const e = exById(id);
    if (!e) return '<div class="empty">Übung nicht gefunden.</div>';
    const best = bestByExercise(app.S.workouts).get(id);
    const prog = exerciseProgress(app.S.workouts, id);
    const sessions = app.S.workouts.filter((w) => w.exercises.some((x) => x.exId === id)).sort((a, b) => b.start - a.start);
    return `<div class="row between top"><div><h2 style="margin-bottom:4px">${esc(e.name)}</h2><div class="muted small">${esc(e.muscle)} · ${esc(e.equipment)}</div></div><button type="button" class="icon-btn" data-a="editExercise" data-id="${id}" aria-label="Bearbeiten">${icon('edit', 'sm')}</button></div>
      ${best ? `<div class="grid3 mt"><div class="card elev stat"><div class="label">e1RM</div><div class="v gold">${fmt(best.e1rm, 1)}</div><div class="s">kg</div></div><div class="card elev stat"><div class="label">Bester Satz</div><div class="v">${fmt(best.w, 1)}×${best.r}</div><div class="s">${shortDate(best.date)}</div></div><div class="card elev stat"><div class="label">Einheiten</div><div class="v">${sessions.length}</div><div class="s">gesamt</div></div></div>` : '<div class="empty mt">Noch keine Sätze geloggt.</div>'}
      ${prog.length >= 2 ? `<div class="label mt" style="margin-bottom:8px">Verlauf e1RM</div>${lineChart([{ pts: prog, cls: 'main', dots: true, area: true, tip: true }], { h: 160, tip: (p) => `<b>${fmt(p.y, 1)} kg</b> · ${shortDate(p.x)}` })}` : ''}
      ${e.instructions ? `<div class="label mt" style="margin-bottom:6px">Ausführung</div><p class="small muted" style="margin:0">${esc(e.instructions)}</p>` : ''}
      ${e.notes ? `<div class="label mt" style="margin-bottom:6px">Meine Notizen</div><p class="small" style="margin:0;white-space:pre-wrap">${esc(e.notes)}</p>` : ''}
      ${sessions.length ? `<div class="label mt" style="margin-bottom:6px">Letzte Einheiten</div><div class="list">${sessions.slice(0, 8).map((w) => { const x = w.exercises.find((y) => y.exId === id); return `<div class="kv"><span class="muted">${relDay(w.date)}</span><span class="num">${x.sets.map((s) => `${fmt(s.w, 1)}×${s.r}`).join('  ')}</span></div>`; }).join('')}</div>` : ''}`;
  };
}
function exerciseEditSheet(id, presetName = '', fromPicker = false) {
  return () => {
    const e = id ? exById(id) : { name: presetName, muscle: MUSCLES[0], equipment: EQUIPMENT[0], instructions: '', notes: '' };
    return `<h2>${id ? 'Übung bearbeiten' : 'Neue Übung'}</h2><div id="exForm">
      <label class="field"><span>Name</span><input name="name" value="${esc(e.name)}" autocomplete="off"></label>
      <div class="grid2"><label class="field"><span>Muskelgruppe</span><select name="muscle">${MUSCLES.map((m) => `<option ${m === e.muscle ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      <label class="field"><span>Gerät</span><select name="equipment">${EQUIPMENT.map((m) => `<option ${m === e.equipment ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>
      <label class="field"><span>Ausführung</span><textarea name="instructions" placeholder="Technik-Hinweise">${esc(e.instructions)}</textarea></label>
      <label class="field"><span>Meine Notizen</span><textarea name="notes" placeholder="z. B. Sitzhöhe, Griff, Schmerzen vermeiden …">${esc(e.notes)}</textarea></label></div>
      <button type="button" class="btn primary block xl" data-a="saveExercise" data-id="${id || ''}" data-picker="${fromPicker ? 1 : ''}">Speichern</button>
      ${id ? `<button type="button" class="btn danger block mt" data-a="delExercise" data-id="${id}">${icon('trash', 'sm')} Übung löschen</button>` : ''}`;
  };
}
A.editExercise = (el) => openSheet(exerciseEditSheet(el.dataset.id));
A.saveExercise = (el) => {
  const root = document.querySelector('#exForm');
  const v = formVals(root);
  const name = v.name.trim();
  if (!name) return markInvalid(root, 'name', 'Name fehlt');
  const dup = app.S.exercises.find((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== el.dataset.id);
  if (dup) return markInvalid(root, 'name', 'Diese Übung gibt es schon');
  let e = el.dataset.id ? exById(el.dataset.id) : null;
  const data = { name, muscle: v.muscle, equipment: v.equipment, instructions: v.instructions.trim(), notes: v.notes.trim() };
  if (e) {
    Object.assign(e, data);
    // Name in gespeicherten Trainings mitziehen, damit Verlauf & Anzeige konsistent bleiben
    app.S.workouts.forEach((w) => w.exercises.forEach((x) => { if (x.exId === e.id) x.name = name; }));
    if (app.S.active) app.S.active.exercises.forEach((x) => { if (x.exId === e.id) x.name = name; });
  } else { e = { id: uid(), ...data, custom: true }; app.S.exercises.push(e); }
  if (el.dataset.picker && pickerCb) { const cb = pickerCb; pickerCb = null; closeSheet(); cb(e.id); return; }
  save(); openSheet(exerciseSheet(e.id)); commit();
};
A.delExercise = (el) => {
  const e = exById(el.dataset.id);
  const used = app.S.plans.some((p) => p.days.some((d) => d.ex.some((x) => x.exId === e.id)));
  if (!confirm(`„${e.name}“ löschen?${used ? ' Sie wird auch aus deinen Plänen entfernt.' : ''} Bisherige Trainings behalten ihre Einträge.`)) return;
  app.S.exercises = app.S.exercises.filter((x) => x.id !== e.id);
  app.S.plans.forEach((p) => p.days.forEach((d) => { d.ex = d.ex.filter((x) => x.exId !== e.id); }));
  closeSheet(); commit();
};

// ---------- Analyse ----------
let anaMetric = 'volume';
function analyticsTab() {
  const S = app.S, k = dkey();
  if (!S.workouts.length) return emptyCard('trend', 'Noch keine Daten', 'Nach deinem ersten abgeschlossenen Training erscheinen hier Volumen, Frequenz, Sätze pro Muskelgruppe und Rekorde.');
  const weeks = weeklyTraining(S.workouts, k, 8);
  const cur = weeks[weeks.length - 1], prev = weeks[weeks.length - 2];
  const done8 = weeks.slice(0, -1).filter((w) => w.sessions).length ? weeks.slice(0, -1).reduce((a, w) => a + w.sessions, 0) / 7 : null;
  const muscles = setsPerMuscle(S.workouts, addDays(k, -6), k, muscleOf);
  const maxM = Math.max(1, ...muscles.map((m) => m.sets));
  const best = [...bestByExercise(S.workouts).values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const prs = prEvents(S.workouts).slice(-10).reverse();
  const metricLabel = { volume: 'Volumen (kg)', sessions: 'Einheiten', sets: 'Sätze' }[anaMetric];
  return `
  <div class="grid2 mb">
    <div class="card stat"><div class="label">Volumen diese Woche</div><div class="v gold">${fmt(cur.volume)}</div><div class="s">kg${prev.volume ? ` · Vorwoche ${fmt(prev.volume)}` : ''}</div></div>
    <div class="card stat"><div class="label">Einheiten diese Woche</div><div class="v">${cur.sessions}<span class="unit"> / ${S.goals.weeklySessions || '–'}</span></div><div class="s">${cur.sets} Sätze</div></div>
    <div class="card stat"><div class="label">Ø pro Woche</div><div class="v">${done8 != null ? fmt(done8, 1) : '–'}</div><div class="s">letzte 7 Wochen</div></div>
    <div class="card stat"><div class="label">Trainings gesamt</div><div class="v">${S.workouts.length}</div><div class="s">seit ${shortDate(S.workouts.reduce((a, w) => (w.date < a ? w.date : a), S.workouts[0].date))}</div></div>
  </div>
  <div class="card">
    <div class="card-h"><span class="t">${icon('trend')} Pro Woche</span></div>
    <div class="chips mb">${[['volume', 'Volumen'], ['sessions', 'Einheiten'], ['sets', 'Sätze']].map(([m, l]) => `<button type="button" class="chip ${anaMetric === m ? 'on' : ''}" data-a="anaMetric" data-v="${m}">${l}</button>`).join('')}</div>
    ${barChart(weeks.map((w, i) => ({ label: shortDate(w.week).slice(0, 5), value: w[anaMetric], dim: i === weeks.length - 1, tip: `<b>${fmt(w[anaMetric])}</b> ${metricLabel.replace(/ \(kg\)/, ' kg')}<br><span class="muted">Woche ab ${shortDate(w.week)}${i === weeks.length - 1 ? ' (läuft)' : ''}</span>` })), { yFmt: (v) => (anaMetric === 'volume' && v >= 1000 ? fmt(v / 1000, 0) + 'k' : fmt(v)) }) || '<div class="empty">Keine Daten in den letzten 8 Wochen.</div>'}
    <div class="faint tiny">Wochen ab Montag · helle Säule = laufende Woche</div>
  </div>
  <div class="card">
    <div class="card-h"><span class="t">${icon('dumbbell')} Sätze pro Muskelgruppe</span><span class="muted tiny">letzte 7 Tage</span></div>
    ${muscles.length ? muscles.map((m) => `<div class="hbar"><span>${esc(m.muscle)}</span>${bar(m.sets, maxM, { over: false })}<span class="n">${m.sets}</span></div>`).join('') : '<div class="empty">In den letzten 7 Tagen kein Training.</div>'}
  </div>
  <div class="card">
    <div class="card-h"><span class="t">${icon('trophy')} Neueste Rekorde</span></div>
    ${prs.length ? prs.map((e) => `<div class="pr"><div class="medal">${icon('trophy', 'sm')}</div><div class="grow"><b>${esc(e.name)}</b><div class="muted small">${fmt(e.w, 1)} kg × ${e.r} · ${relDay(e.date)}</div></div><div class="right num"><b class="gold">${fmt(e.e1rm, 1)}</b><div class="faint tiny">vorher ${fmt(e.prev, 1)}</div></div></div>`).join('') : '<div class="empty">Noch kein Rekord – die erste Einheit pro Übung ist die Basis.</div>'}
  </div>
  <div class="card">
    <div class="card-h"><span class="t">${icon('star')} Bestwerte pro Übung</span></div>
    <div class="list">${best.map((b) => `<button type="button" class="item" data-a="showExercise" data-id="${b.key.startsWith('name:') ? '' : b.key}"><div><b>${esc(b.name)}</b><div class="muted tiny">${fmt(b.w, 1)} kg × ${b.r} · ${shortDate(b.date)}</div></div><div class="r"><b class="gold">${fmt(b.e1rm, 1)}</b><div class="faint tiny">e1RM kg</div></div></button>`).join('')}</div>
  </div>`;
}
A.anaMetric = (el) => { anaMetric = el.dataset.v; commit(); };

// ---------- Verlauf ----------
function historyTab() {
  const ws = app.S.workouts.slice().sort((a, b) => b.start - a.start);
  if (!ws.length) return emptyCard('clock', 'Noch keine Trainings', 'Abgeschlossene Einheiten erscheinen hier – mit Bearbeiten, Wiederholen und Löschen.');
  let month = '';
  return ws.map((w) => {
    const m = new Date(w.start).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    const head = m !== month ? `<div class="section">${m}</div>` : '';
    month = m;
    return `${head}<button type="button" class="card tap item" style="border-top:1px solid var(--line);padding:14px 16px" data-a="showWorkout" data-id="${w.id}"><div class="grow"><b>${esc(w.name)}</b><div class="muted small">${relDay(w.date)} · ${fmtDur(w.end - w.start)} · ${plural(workoutSets(w), 'Satz', 'Sätze')}</div></div><div class="r"><span class="num">${fmt(workoutVolume(w))}</span><div class="faint tiny">kg</div></div>${icon('right', 'chev')}</button>`;
  }).join('');
}

export function workoutSheet(id) {
  return () => {
    const w = app.S.workouts.find((x) => x.id === id);
    if (!w) return '<div class="empty">Nicht gefunden.</div>';
    return `<h2>${esc(w.name)}</h2>
      <p class="muted small" style="margin-top:-6px">${longDate(w.date)} · ${fmtDur(w.end - w.start)} · ${fmt(workoutVolume(w))} kg Volumen</p>
      ${w.exercises.map((e) => `<div class="card elev" style="padding:12px 14px"><b>${esc(e.name)}</b><div class="small num" style="margin-top:4px">${e.sets.map((s) => `${fmt(s.w, 1)} kg × ${s.r}`).join(' · ')}</div></div>`).join('')}
      ${w.note ? `<p class="small muted">${esc(w.note)}</p>` : ''}
      <div class="grid2 mt"><button type="button" class="btn" data-a="editWorkout" data-id="${id}">${icon('edit', 'sm')} Bearbeiten</button><button type="button" class="btn outline" data-a="repeatWorkout" data-id="${id}">${icon('repeat', 'sm')} Wiederholen</button></div>
      <button type="button" class="btn danger block mt" data-a="delWorkout" data-id="${id}">${icon('trash', 'sm')} Training löschen</button>`;
  };
}
A.showWorkout = (el) => openSheet(workoutSheet(el.dataset.id));
A.delWorkout = (el) => { if (confirm('Dieses Training löschen?')) { app.S.workouts = app.S.workouts.filter((w) => w.id !== el.dataset.id); closeSheet(); commit(); } };

// Bearbeiten eines abgeschlossenen Trainings
let editDraft = null;
function editWorkoutSheet() {
  const w = editDraft;
  return `<h2>Training bearbeiten</h2><div id="ewForm">
    <div class="grid2"><label class="field"><span>Name</span><input name="name" value="${esc(w.name)}"></label><label class="field"><span>Datum</span><input name="date" type="date" value="${w.date}" max="${dkey()}"></label></div>
    ${w.exercises.map((e, ei) => `<div class="card elev" style="padding:12px"><div class="row between"><b>${esc(e.name)}</b><button type="button" class="icon-btn sm plain" data-a="ewDelEx" data-e="${ei}" aria-label="Übung entfernen">${icon('trash', 'sm')}</button></div>
      <div class="set head" style="margin-top:8px"><span>#</span><span>kg</span><span>Wdh.</span><span></span></div>
      ${e.sets.map((s, si) => `<div class="set"><span class="n">${si + 1}</span><input inputmode="decimal" data-i="ewSet" data-e="${ei}" data-s="${si}" data-f="w" value="${s.w}"><input inputmode="numeric" data-i="ewSet" data-e="${ei}" data-s="${si}" data-f="r" value="${s.r}"><button type="button" class="ok" data-a="ewDelSet" data-e="${ei}" data-s="${si}" aria-label="Satz löschen">${icon('x', 'sm')}</button></div>`).join('')}
      <button type="button" class="btn sm" data-a="ewAddSet" data-e="${ei}">${icon('plus', 'sm')} Satz</button></div>`).join('')}
    <label class="field"><span>Notiz</span><textarea name="note">${esc(w.note || '')}</textarea></label></div>
    <button type="button" class="btn primary block xl" data-a="ewSave">Speichern</button>
    <button type="button" class="btn ghost block mt" data-a="showWorkout" data-id="${w.id}">Abbrechen</button>`;
}
A.editWorkout = (el) => { editDraft = structuredClone(app.S.workouts.find((x) => x.id === el.dataset.id)); openSheet(editWorkoutSheet); };
I.ewSet = (el) => { editDraft.exercises[+el.dataset.e].sets[+el.dataset.s][el.dataset.f] = el.value; };
const syncEw = () => { const v = formVals(document.querySelector('#ewForm')); editDraft.name = v.name; editDraft.date = v.date; editDraft.note = v.note; };
A.ewAddSet = (el) => { syncEw(); const e = editDraft.exercises[+el.dataset.e]; const l = e.sets[e.sets.length - 1]; e.sets.push({ w: l ? l.w : 0, r: l ? l.r : 0 }); openSheet(editWorkoutSheet); };
A.ewDelSet = (el) => { syncEw(); editDraft.exercises[+el.dataset.e].sets.splice(+el.dataset.s, 1); openSheet(editWorkoutSheet); };
A.ewDelEx = (el) => { syncEw(); editDraft.exercises.splice(+el.dataset.e, 1); openSheet(editWorkoutSheet); };
A.ewSave = () => {
  syncEw();
  const root = document.querySelector('#ewForm');
  for (const e of editDraft.exercises) for (const s of e.sets) {
    const w = validate(s.w, LIMITS.liftKg), r = validate(s.r, LIMITS.reps);
    if (!w.ok || !r.ok) return toast(`${e.name}: ${(w.ok ? r : w).error}`, true);
    s.w = w.value; s.r = r.value;
  }
  if (!editDraft.date) return markInvalid(root, 'date', 'Datum fehlt');
  editDraft.exercises = editDraft.exercises.filter((e) => e.sets.length);
  if (!editDraft.exercises.length) return toast('Mindestens ein Satz nötig – sonst Training löschen', true);
  // Datum geändert → Start/Ende auf den neuen Tag verschieben (Uhrzeit bleibt)
  const old = app.S.workouts.find((x) => x.id === editDraft.id);
  if (old.date !== editDraft.date) {
    const shift = new Date(editDraft.date + 'T12:00').getTime() - new Date(old.date + 'T12:00').getTime();
    editDraft.start += shift; editDraft.end += shift;
  }
  editDraft.name = editDraft.name.trim() || old.name;
  Object.assign(old, editDraft);
  editDraft = null;
  openSheet(workoutSheet(old.id)); commit();
  toast('Training aktualisiert');
};
