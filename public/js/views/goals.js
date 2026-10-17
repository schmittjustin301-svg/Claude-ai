// Ziele & Gamification: Level/XP, Tagesmissionen, eigene Ziele, Gewohnheiten, Serien, Erfolge, Meilensteine.
// Fortschritt wird nur aus echten Einträgen berechnet.
import { app, A, C, registerView, commit, save, openSheet, closeSheet, toast, celebrate, render } from '../core.js';
import { dkey, addDays, weightGoalProgress, nutritionAdherence, weeklyTraining, weeklyRate, currentWeight, weeksToGoal, validate, LIMITS } from '../logic.js';
import { $, esc, fmt, fmtFixed, icon, bar, shortDate, relDay, formVals, markInvalid, plural, hudRing, corners } from '../ui.js';
import { daily, exName, plannedFor } from '../domain.js';
import { uid } from '../store.js';
import { pickExercise } from './training.js';
import { ledger, totalXP, levelInfo, missions, goalProgress, GOAL_TYPES, ACHIEVEMENTS, newAchievements, streaks } from '../gamify.js';
import { react } from '../coach.js';

function view() {
  const S = app.S, today = dkey();
  const ev = ledger(S, today), xp = totalXP(ev), lv = levelInfo(xp);
  const weekXP = ev.filter((e) => e.date >= addDays(today, -6)).reduce((a, e) => a + e.xp, 0);
  return `<div class="topbar"><h1>Ziele</h1><span class="pill gold">Level ${lv.level}</span></div>
  <section class="hero corners" aria-label="Level und XP" data-tour="level">${corners()}
    <div class="cockpit">${hudRing({ rings: [{ id: 'level', pct: lv.pct }], label: `Level ${lv.level}, ${Math.round(lv.pct * 100)} Prozent zum nächsten Level`, center: `<span class="hud-l">Level</span><span class="hud-v">${lv.level}</span>` })}
      <div style="min-width:0"><div class="label gold">Performance-Level</div><div class="cockpit-title">${fmt(xp)} XP</div><div class="muted small">noch ${fmt(lv.need)} XP bis Level ${lv.level + 1}</div></div></div>
    <div class="telemetry"><div><div class="meta">7 Tage</div><div class="v gold">+${fmt(weekXP)}</div></div><div><div class="meta">Erfolge</div><div class="v">${Object.keys(S.achievements).length}<span class="unit">/${ACHIEVEMENTS.length}</span></div></div><div><div class="meta">Ziele aktiv</div><div class="v">${S.goals.custom.filter((g) => g.status === 'active').length}</div></div></div>
    ${ev.length ? `<div class="label" style="margin-bottom:6px">Zuletzt verdient</div>${ev.slice(0, 4).map((e) => `<div class="xp-row"><span>${esc(e.label)}</span><span class="meta">${relDay(e.date)}</span><b class="gold">+${e.xp}</b></div>`).join('')}` : '<div class="faint small">XP gibt es für Trainings, erreichte Tagesziele, eingehaltene Pläne und Rekorde – nie für Menge.</div>'}
  </section>
  <div class="section">Heutige Missionen</div>
  ${missionsCard(today)}
  ${weightGoal()}${trainingGoal()}${nutritionGoal()}
  ${customGoals(today)}
  ${habitsCard(today)}
  ${streaksCard(today)}
  ${achievementsCard()}
  ${milestones()}
  <button type="button" class="btn ghost block mt" data-a="xpSettings">${icon('sliders', 'sm')} XP-Werte anpassen</button>`;
}
registerView('goals', view, 'goals');

// ---------- Missionen ----------
export function missionsCard(today = dkey(), { compact = false } = {}) {
  const ms = missions(app.S, today, Date.now(), plannedFor(today));
  if (!ms.length) return '<div class="card" data-tour="missions"><div class="empty">Keine Missionen für heute.</div></div>';
  const done = ms.filter((m) => m.done).length;
  return `<div class="card missions" data-tour="missions">
    ${compact ? `<div class="card-h"><span class="t">${icon('target')} Heutige Missionen</span><span class="meta">${done}/${ms.length} erledigt</span></div>` : ''}
    ${ms.map((m) => `<div class="mission ${m.done ? 'done' : ''}">
      ${hudRing({ rings: [{ id: 'mis-' + m.id, pct: m.progress }], size: 'xs', label: `${m.title} ${Math.round(m.progress * 100)} Prozent`, center: m.done ? icon('check', 'sm') : `<span class="hud-xs">${Math.round(m.progress * 100)}</span>` })}
      <div class="grow"><b>${esc(m.title)}</b><div class="muted small">${esc(m.label)}</div></div>
      <span class="xp-badge ${m.done ? 'on' : ''}">+${m.xp} XP</span>
      ${!m.done && m.action === 'habit' ? `<button type="button" class="tk-btn" data-a="habitToggle" data-id="${m.habitId}" aria-label="${esc(m.title)} erledigt">${icon('check')}</button>` : ''}
      ${!m.done && m.action === 'water' ? `<button type="button" class="btn sm" data-a="water" data-v="250">+250</button>` : ''}
      ${!m.done && m.action === 'supps' ? `<button type="button" class="icon-btn sm" data-a="go" data-v="supps" aria-label="Zu den Supplements">${icon('right', 'sm')}</button>` : ''}
      ${!m.done && m.action === 'food' ? `<button type="button" class="icon-btn sm" data-a="go" data-v="food" aria-label="Zur Ernährung">${icon('right', 'sm')}</button>` : ''}
      ${!m.done && m.action === 'session' ? `<button type="button" class="icon-btn sm" data-a="go" data-v="session" aria-label="Zum Training">${icon('play', 'sm')}</button>` : ''}
      ${!m.done && m.action === 'start' ? `<button type="button" class="icon-btn sm" data-a="go" data-v="train" aria-label="Zum Training">${icon('play', 'sm')}</button>` : ''}
    </div>`).join('')}
  </div>`;
}

// ---------- Eigene Ziele ----------
function customGoals(today) {
  const gs = app.S.goals.custom.filter((g) => g.status !== 'archived');
  return `<div class="section">Eigene Ziele<button type="button" class="link act" data-a="newGoal" data-tour="new-goal">+ Ziel</button></div>
  ${gs.length ? gs.map((g) => {
    const p = goalProgress(app.S, g, today), T = GOAL_TYPES[g.type] || GOAL_TYPES.manual;
    const unit = g.unit || T.unit;
    return `<div class="card tap goal-card ${g.status === 'done' ? 'gold-edge' : ''}" data-a="editGoal" data-id="${g.id}">
      <div class="row top">${hudRing({ rings: [{ id: 'goal-' + g.id, pct: p.pct }], size: 'sm', label: `${g.name} ${Math.round(p.pct * 100)} Prozent`, center: `<span class="hud-v" style="font-size:20px">${Math.round(p.pct * 100)}<span class="unit" style="font-size:11px">%</span></span>` })}
        <div class="grow" style="min-width:0"><div class="row"><b>${esc(g.name)}</b>${g.status === 'done' ? '<span class="pill gold">Erreicht</span>' : ''}${p.exceeded ? '<span class="pill gold">Übertroffen</span>' : ''}</div>
          <div class="muted small">${esc(g.category || T.cat)} · ${esc(T.name)}</div>
          ${p.missing ? `<div class="faint small" style="margin-top:6px">${esc(p.missing)}</div>` : `<div class="statline" style="margin-top:6px"><span class="mid">${fmt(p.current, 1)}</span><span class="unit">/ ${fmt(p.target, 1)} ${esc(unit)}</span></div>`}
          <div class="faint tiny" style="margin-top:4px">seit ${shortDate(g.startDate)}${g.targetDate ? ` · bis ${shortDate(g.targetDate)}` : ''}${g.description ? ` · ${esc(g.description)}` : ''}</div></div></div>
    </div>`;
  }).join('') : '<div class="card"><div class="empty">Zum Beispiel „20 Trainings bis Weihnachten“, „Bankdrücken 100 kg × 5“ oder „30 Tage Trinkziel“. Der Fortschritt kommt automatisch aus deinen Daten.</div></div>'}
  ${app.S.goals.custom.some((g) => g.status === 'archived') ? `<details class="card"><summary class="label">Archivierte Ziele</summary><div class="list mt">${app.S.goals.custom.filter((g) => g.status === 'archived').map((g) => `<button type="button" class="item" data-a="editGoal" data-id="${g.id}"><span>${esc(g.name)}</span>${icon('right', 'chev')}</button>`).join('')}</div></details>` : ''}`;
}
let gDraft = null;
function goalSheet() {
  const g = gDraft, T = GOAL_TYPES[g.type];
  const p = g.id && !g.isNew ? goalProgress(app.S, g, dkey()) : null;
  return `<h2>${g.isNew ? 'Neues Ziel' : 'Ziel bearbeiten'}</h2><div id="goForm">
    <label class="field"><span>Art</span><select name="type" data-c="goalType">${Object.entries(GOAL_TYPES).map(([k, t]) => `<option value="${k}" ${k === g.type ? 'selected' : ''}>${t.name}</option>`).join('')}</select></label>
    <p class="faint tiny" style="margin:-6px 0 10px">${esc(T.hint)}</p>
    <label class="field"><span>Name</span><input name="name" value="${esc(g.name)}" placeholder="z. B. 20 Trainings bis Weihnachten" maxlength="60"></label>
    <label class="field"><span>Beschreibung (optional)</span><input name="description" value="${esc(g.description || '')}" maxlength="120"></label>
    ${g.type === 'pr' ? `<div class="field"><span>Übung</span><button type="button" class="btn block" data-a="goalPickEx">${g.params?.key ? esc(exName(g.params.key)) : 'Übung wählen'}</button></div>` : ''}
    ${g.type === 'habit_streak' ? `<label class="field"><span>Gewohnheit</span><select name="habitId">${app.S.habits.map((h) => `<option value="${h.id}" ${g.params?.habitId === h.id ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}<option value="__new" ${!app.S.habits.length ? 'selected' : ''}>+ Neue Gewohnheit …</option></select></label><label class="field"><span>Name der neuen Gewohnheit</span><input name="habitName" placeholder="z. B. 10 Min. Dehnen"></label>` : ''}
    <div class="grid2"><label class="field"><span>Start</span><input name="startDate" type="date" value="${g.startDate}"></label><label class="field"><span>Zieldatum (optional)</span><input name="targetDate" type="date" value="${g.targetDate || ''}"></label></div>
    <div class="grid3">
      ${g.type === 'weight' || g.type === 'manual' ? `<label class="field"><span>Startwert</span><input name="startValue" inputmode="decimal" value="${g.startValue ?? ''}" placeholder="${g.type === 'weight' ? 'auto' : '0'}"></label>` : ''}
      <label class="field"><span>Zielwert</span><input name="targetValue" inputmode="decimal" value="${g.targetValue ?? ''}"></label>
      ${g.type === 'pr' ? `<label class="field"><span>Wdh.</span><input name="reps" inputmode="numeric" value="${g.params?.reps ?? 1}"></label>` : ''}
      ${g.type === 'manual' ? `<label class="field"><span>Aktuell</span><input name="currentValue" inputmode="decimal" value="${g.currentValue ?? ''}"></label><label class="field"><span>Einheit</span><input name="unit" value="${esc(g.unit || '')}" maxlength="12"></label>` : ''}
    </div>
    <label class="field"><span>Kategorie</span><input name="category" value="${esc(g.category || T.cat)}" maxlength="24"></label>
    ${p && !p.missing ? `<div class="card elev small">Aktuell ${fmt(p.current, 1)} von ${fmt(p.target, 1)} · ${fmt(p.pct * 100)} %${p.exceeded ? ' · übertroffen' : ''}</div>` : ''}</div>
    <button type="button" class="btn primary block xl" data-a="saveGoal">Speichern</button>
    ${g.isNew ? '' : `<div class="grid2 mt"><button type="button" class="btn" data-a="archiveGoal">${g.status === 'archived' ? 'Reaktivieren' : 'Archivieren'}</button><button type="button" class="btn danger" data-a="delGoal">${icon('trash', 'sm')} Löschen</button></div>`}`;
}
const syncGoal = () => { const v = formVals($('#goForm')); Object.assign(gDraft, v); };
A.newGoal = () => { gDraft = { isNew: true, id: uid(), type: 'workouts', name: '', description: '', category: '', startDate: dkey(), targetDate: '', startValue: '', targetValue: '', unit: '', params: {}, status: 'active' }; openSheet(goalSheet); };
A.editGoal = (el) => { gDraft = structuredClone(app.S.goals.custom.find((x) => x.id === el.dataset.id)); openSheet(goalSheet); };
C.goalType = (el) => { syncGoal(); gDraft.type = el.value; gDraft.category = GOAL_TYPES[el.value].cat; openSheet(goalSheet); };
A.goalPickEx = () => { syncGoal(); const keep = gDraft; pickExercise((exId) => { gDraft = keep; gDraft.params = { ...gDraft.params, key: exId }; openSheet(goalSheet); }); };
A.saveGoal = () => {
  syncGoal();
  const root = $('#goForm'), g = gDraft, T = GOAL_TYPES[g.type];
  if (!g.name.trim()) return markInvalid(root, 'name', 'Name fehlt');
  if (!g.startDate) return markInvalid(root, 'startDate', 'Startdatum fehlt');
  if (g.targetDate && g.targetDate < g.startDate) return markInvalid(root, 'targetDate', 'Zieldatum liegt vor dem Start');
  const tv = validate(g.targetValue, { min: g.type === 'manual' || g.type === 'weight' ? -1e6 : 0.01, max: 1e6, label: 'Zielwert' });
  if (!tv.ok) return markInvalid(root, 'targetValue', tv.error);
  if (g.type === 'supps_pct' && tv.value > 100) return markInvalid(root, 'targetValue', 'Höchstens 100 %');
  const sv = validate(g.startValue, { min: -1e6, max: 1e6, required: false, label: 'Startwert' });
  if (!sv.ok) return markInvalid(root, 'startValue', sv.error);
  const cv = validate(g.currentValue, { min: -1e6, max: 1e6, required: false, label: 'Aktueller Wert' });
  if (!cv.ok) return markInvalid(root, 'currentValue', cv.error);
  const params = { ...g.params };
  if (g.type === 'pr') { if (!params.key) return toast('Bitte eine Übung wählen', true); const r = validate(g.reps, { min: 1, max: 50, label: 'Wiederholungen' }); if (!r.ok) return markInvalid(root, 'reps', r.error); params.reps = Math.round(r.value); }
  if (g.type === 'habit_streak') {
    let hid = g.habitId;
    if (!hid || hid === '__new') { const nm = (g.habitName || '').trim(); if (!nm) return markInvalid(root, 'habitName', 'Name der Gewohnheit fehlt'); hid = uid(); app.S.habits.push({ id: hid, name: nm }); }
    params.habitId = hid;
  }
  const data = { id: g.id, type: g.type, name: g.name.trim(), description: (g.description || '').trim(), category: (g.category || T.cat).trim(), startDate: g.startDate, targetDate: g.targetDate || null,
    startValue: sv.value, targetValue: tv.value, currentValue: cv.value, unit: g.type === 'manual' ? (g.unit || '').trim() : T.unit, params, status: g.status === 'archived' ? 'archived' : 'active', doneAt: null };
  const i = app.S.goals.custom.findIndex((x) => x.id === data.id);
  if (i >= 0) app.S.goals.custom[i] = data; else app.S.goals.custom.push(data);
  gDraft = null;
  closeSheet(); commit(); checkProgress();
};
A.archiveGoal = () => { const g = app.S.goals.custom.find((x) => x.id === gDraft.id); g.status = g.status === 'archived' ? 'active' : 'archived'; closeSheet(); commit(); };
A.delGoal = () => { if (!confirm('Ziel löschen?')) return; app.S.goals.custom = app.S.goals.custom.filter((x) => x.id !== gDraft.id); closeSheet(); commit(); };

// ---------- Gewohnheiten ----------
function habitsCard(today) {
  const H = app.S.habits, log = app.S.habitLog[today] || [];
  return `<div class="section">Gewohnheiten</div><div class="card">
    ${H.length ? H.map((h) => { const on = log.includes(h.id); return `<div class="mission ${on ? 'done' : ''}"><button type="button" class="tk-btn ${on ? 'on' : ''}" data-a="habitToggle" data-id="${h.id}" aria-label="${esc(h.name)} ${on ? 'nicht erledigt' : 'erledigt'}">${icon('check')}</button><div class="grow"><b>${esc(h.name)}</b><div class="muted small">${on ? 'heute erledigt' : 'heute offen'}</div></div><button type="button" class="icon-btn sm plain" data-a="delHabit" data-id="${h.id}" aria-label="Gewohnheit löschen">${icon('x', 'sm')}</button></div>`; }).join('') : '<div class="empty">Tägliche Gewohnheiten, die du abhaken willst – z. B. Dehnen, 8 h Schlaf, kein Handy im Bett.</div>'}
    <div class="row mt"><input id="newHabit" class="grow" placeholder="Neue Gewohnheit" maxlength="40"><button type="button" class="btn" data-a="addHabit">${icon('plus', 'sm')}</button></div></div>`;
}
A.habitToggle = (el) => {
  const k = dkey(), list = (app.S.habitLog[k] = app.S.habitLog[k] || []), i = list.indexOf(el.dataset.id);
  if (i >= 0) list.splice(i, 1); else list.push(el.dataset.id);
  if (!list.length) delete app.S.habitLog[k];
  commit(); checkProgress();
};
A.addHabit = () => { const v = ($('#newHabit').value || '').trim(); if (!v) return toast('Namen eingeben', true); app.S.habits.push({ id: uid(), name: v }); commit(); };
A.delHabit = (el) => {
  const h = app.S.habits.find((x) => x.id === el.dataset.id);
  if (!confirm(`Gewohnheit „${h.name}“ löschen? Die zugehörige Serie verschwindet, andere Fortschritte bleiben.`)) return;
  app.S.habits = app.S.habits.filter((x) => x.id !== h.id);
  for (const k of Object.keys(app.S.habitLog)) { app.S.habitLog[k] = app.S.habitLog[k].filter((x) => x !== h.id); if (!app.S.habitLog[k].length) delete app.S.habitLog[k]; }
  commit();
};

// ---------- Serien & Erfolge ----------
function streaksCard(today) {
  const st = streaks(app.S, today);
  return `<div class="section">Serien</div><div class="card"><div class="streaks">${st.map((s) => `<div class="streak ${s.current ? 'on' : ''}"><div class="streak-v">${s.current}</div><div class="streak-n">${esc(s.name)}</div><div class="faint tiny">Rekord ${s.best}</div></div>`).join('')}</div>
    <p class="faint tiny" style="margin:10px 0 0">Ein offener Tag beendet keine Serie – erst ein verpasster Tag. Andere Serien und Erfolge bleiben davon unberührt.</p></div>`;
}
function achievementsCard() {
  const A2 = app.S.achievements;
  return `<div class="section">Erfolge · ${Object.keys(A2).length}/${ACHIEVEMENTS.length}</div><div class="badges">${ACHIEVEMENTS.map((a) => `<div class="badge ${A2[a.id] ? 'on' : ''}" title="${esc(a.desc)}"><div class="badge-ic">${icon(A2[a.id] ? a.icon : 'lock', 'sm')}</div><div class="badge-n">${esc(a.name)}</div><div class="badge-d">${A2[a.id] ? shortDate(A2[a.id]) : esc(a.desc)}</div></div>`).join('')}</div>`;
}
A.xpSettings = () => {
  const X = app.S.xpConfig;
  const labels = { workout: 'Training (max. 1×/Tag)', pr: 'Rekord', protein: 'Proteinziel', kcal: 'Kalorien im Ziel', water: 'Trinkziel', supps: 'Supplement-Plan eingehalten', habit: 'Gewohnheit', weekGoal: 'Wochenziel Training', goal: 'Eigenes Ziel erreicht', achievement: 'Erfolg' };
  openSheet(() => `<h2>XP-Werte</h2><div id="xpForm" class="grid2">${Object.entries(labels).map(([k, l]) => `<label class="field"><span>${l}</span><input name="${k}" inputmode="numeric" value="${X[k]}"></label>`).join('')}</div>
    <p class="faint tiny">Änderungen gelten rückwirkend – das XP-Konto wird immer aus deinen Daten berechnet.</p><button type="button" class="btn primary block" data-a="saveXP">Speichern</button>`);
};
A.saveXP = () => {
  const v = formVals($('#xpForm')), out = {};
  for (const [k, raw] of Object.entries(v)) { const r = validate(raw, { min: 0, max: 1000, label: 'XP' }); if (!r.ok) return markInvalid($('#xpForm'), k, r.error); out[k] = Math.round(r.value); }
  app.S.xpConfig = { ...app.S.xpConfig, ...out };
  closeSheet(); commit();
};

// ---------- Fortschritt prüfen: Ziele, Erfolge, Level ----------
// Einmalige, dezente Feier. Erreichte Erfolge bleiben dauerhaft erhalten.
let checkTimer;
export function checkProgress() { clearTimeout(checkTimer); checkTimer = setTimeout(runCheck, 400); }
function runCheck() {
  const S = app.S, today = dkey(), lines = [];
  let changed = false;
  for (const g of S.goals.custom) {
    if (g.status !== 'active') continue;
    if (goalProgress(S, g, today).done) { g.status = 'done'; g.doneAt = today; changed = true; lines.push({ t: 'Ziel erreicht', l: g.name, ic: 'target' }); }
  }
  const wp = weightGoalProgress(daily(), S.goals.weight), wid = 'w:' + S.goals.weight;
  if (wp && wp.done && Math.abs(wp.start - wp.cur) > 0.3 && !S.settings.celebrated[wid]) { S.settings.celebrated[wid] = today; changed = true; lines.push({ t: 'Ziel erreicht', l: `Zielgewicht ${fmtFixed(S.goals.weight)} kg`, ic: 'target' }); }
  // Erfolge können über ihre XP weitere (Level-)Erfolge freischalten – bis zum stabilen Stand durchrechnen
  for (let pass = 0; pass < 6; pass++) {
    const fresh = newAchievements(S, today);
    if (!fresh.length) break;
    for (const a of fresh) { S.achievements[a.id] = today; changed = true; lines.push({ t: 'Erfolg freigeschaltet', l: a.name, ic: a.icon }); }
  }
  const lv = levelInfo(totalXP(ledger(S, today))).level;
  const last = S.settings.lastLevel || 0;
  if (last && lv > last) lines.push({ t: `Level ${lv}`, l: 'Neues Level erreicht', ic: 'star' });
  if (lv !== last) { S.settings.lastLevel = lv; changed = true; }
  const nearer = goalMarks(S, today, wp);
  if (!changed) { if (nearer && S.settings.gamifyInit) react('motivated', 'Du bist deinem Ziel nähergekommen. Bleib dran!', { sub: nearer, plainOff: false }); return; }
  save();
  // Erster Lauf nach dem Update: Erfolge aus dem bisherigen Verlauf still freischalten statt alles auf einmal zu feiern
  if (!S.settings.gamifyInit) { S.settings.gamifyInit = today; save(); if (lines.length) toast(`${lines.length} Erfolge und Ziele aus deinem bisherigen Verlauf freigeschaltet`); render(); return; }
  if (lines.length && !document.querySelector('.celebrate')) celebrate(lines.length === 1 ? (lines[0].t === 'Ziel erreicht' ? 'Ziel erreicht! Gute Arbeit.' : lines[0].t) : `${lines.length} Fortschritte`, lines.map((x) => (lines.length === 1 ? x.l : `${x.t}: ${x.l}`)), lines[0].ic);
  else if (nearer) react('motivated', 'Du bist deinem Ziel nähergekommen. Bleib dran!', { sub: nearer, plainOff: false });
  render();
}
/** Zwischenstände 25/50/75 % je aktivem Ziel merken; liefert eine Zeile, wenn eine neue Marke erreicht ist. Erste Messung still. */
function goalMarks(S, today, wp) {
  const marks = S.coach.goalMarks, out = [];
  const check = (key, pct, name) => {
    if (pct == null || !Number.isFinite(pct)) return;
    const m = Math.min(0.75, Math.floor(pct * 4) / 4);
    if (marks[key] === undefined) { marks[key] = m; return; }
    if (m > marks[key]) { marks[key] = m; out.push(`${name}: ${Math.round(pct * 100)} %`); }
    else if (m < marks[key]) marks[key] = m;
  };
  for (const g of S.goals.custom) if (g.status === 'active') check('g:' + g.id, goalProgress(S, g, today).pct, g.name);
  if (wp && !wp.done) check('w:' + S.goals.weight, wp.pct, 'Zielgewicht');
  if (out.length) save();
  return out[0] || '';
}
document.addEventListener('goals-check', checkProgress);
// Nach Änderungen (gedrosselt) prüfen – Daten können aus jedem Bereich kommen
document.addEventListener('rendered', (e) => { if (e.detail.view !== 'sheet') checkProgress(); });

function weightGoal() {
  const g = app.S.goals.weight, d = daily(), p = weightGoalProgress(d, g);
  const cw = currentWeight(d), rate = weeklyRate(d), wks = cw && g != null ? weeksToGoal(cw.trend, g, rate) : null;
  return `<div class="card ${p?.done ? 'gold-edge' : ''}">
    <div class="card-h"><span class="t">${icon('scale')} Zielgewicht</span>${p?.done ? '<span class="pill gold">Erreicht</span>' : ''}</div>
    <div class="row"><input class="grow" inputmode="decimal" data-c="goalWeight" value="${g ?? ''}" placeholder="z. B. 80" aria-label="Zielgewicht in kg"><span class="unit">kg</span></div>
    ${p ? `<div class="mt">${bar(p.pct, 1, { thick: true, over: false })}</div>
      <div class="row between small mt"><span class="muted">Start ${fmtFixed(p.start)} kg</span><span class="gold num"><b>${fmt(p.pct * 100)} %</b></span><span class="muted">jetzt ${fmtFixed(p.cur)} kg</span></div>
      <div class="faint tiny mt">${p.done ? 'Ziel erreicht – Zeit für ein neues?' : `Noch ${fmtFixed(Math.abs(p.left))} kg${wks ? ` · bei aktuellem Tempo ca. ${fmt(Math.ceil(wks))} Wochen` : ''}`}. Basis: erste Messung und 7-Tage-Trend.</div>`
    : `<div class="faint tiny mt">${g == null ? 'Lege dein Zielgewicht fest.' : 'Fortschritt erscheint nach deiner ersten Gewichtsmessung.'}</div>`}
  </div>`;
}
C.goalWeight = (el) => {
  const r = validate(el.value, { ...LIMITS.bodyKg, required: false });
  if (!r.ok) { el.classList.add('invalid'); return toast(r.error, true); }
  app.S.goals.weight = r.value;
  commit();
  document.dispatchEvent(new CustomEvent('goals-check'));
};

function trainingGoal() {
  const S = app.S, target = S.goals.weeklySessions || 0, k = dkey();
  const weeks = weeklyTraining(S.workouts, k, 9);
  const cur = weeks[weeks.length - 1];
  const hit = target ? weeks.slice(0, -1).filter((w) => w.sessions >= target).length : 0;
  return `<div class="card">
    <div class="card-h"><span class="t">${icon('calendar')} Trainings pro Woche</span><span class="small num"><b class="gold">${cur.sessions}</b><span class="muted"> / ${target || '–'}</span></span></div>
    <div class="chips">${[2, 3, 4, 5, 6].map((n) => `<button type="button" class="chip ${target === n ? 'on' : ''}" data-a="setWeekly" data-v="${n}">${n}×</button>`).join('')}</div>
    ${target ? `<div class="mt">${bar(cur.sessions, target, { thick: true, over: false })}</div>
      <div class="faint tiny mt">${S.workouts.length ? `Ziel in ${hit} der letzten 8 Wochen erreicht.` : 'Noch keine Trainings geloggt.'}</div>` : ''}
  </div>`;
}
A.setWeekly = (el) => { app.S.goals.weeklySessions = +el.dataset.v; commit(); };

function nutritionGoal() {
  const t = app.S.targets, a = nutritionAdherence(app.S.meals, t, dkey(), 7);
  return `<div class="card">
    <div class="card-h"><span class="t">${icon('flame')} Ernährungsziele</span><button type="button" class="link small" data-a="go" data-v="calc">Ändern</button></div>
    <div class="grid4"><div class="stat"><div class="label">kcal</div><div class="v" style="font-size:18px">${fmt(t.kcal)}</div></div><div class="stat"><div class="label">Protein</div><div class="v" style="font-size:18px">${fmt(t.p)}</div></div><div class="stat"><div class="label">KH</div><div class="v" style="font-size:18px">${fmt(t.c)}</div></div><div class="stat"><div class="label">Fett</div><div class="v" style="font-size:18px">${fmt(t.f)}</div></div></div>
    <hr class="divider">
    ${a.logged ? `<div class="label" style="margin-bottom:10px">Letzte 7 Tage · ${plural(a.logged, 'Tag', 'Tage')} erfasst</div>
      <div class="hbar" style="grid-template-columns:120px 1fr 40px"><span class="small">Kalorien ±10 %</span>${bar(a.kcalOk, a.logged, { over: false })}<span class="n">${a.kcalOk}/${a.logged}</span></div>
      <div class="hbar" style="grid-template-columns:120px 1fr 40px"><span class="small">Protein ≥ 90 %</span>${bar(a.proteinOk, a.logged, { over: false })}<span class="n">${a.proteinOk}/${a.logged}</span></div>`
    : '<div class="empty">Sobald du Mahlzeiten einträgst, siehst du hier, an wie vielen Tagen du deine Ziele triffst.</div>'}
  </div>`;
}

function milestones() {
  const ms = app.S.goals.milestones.slice().sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.due || '9').localeCompare(b.due || '9'));
  return `<div class="section">Meilensteine</div>
  <div class="card">
    ${ms.length ? `<div class="list">${ms.map((m) => `<div class="item" style="cursor:default"><button type="button" class="icon-btn sm ${m.done ? '' : 'plain'}" style="${m.done ? 'background:var(--gold);border-color:var(--gold);color:var(--gold-ink)' : 'border-color:var(--line)'}" data-a="toggleMilestone" data-id="${m.id}" aria-label="${m.done ? 'Als offen markieren' : 'Erledigt'}">${m.done ? icon('check', 'sm') : ''}</button>
      <div class="grow"><span style="${m.done ? 'color:var(--text2);text-decoration:line-through' : ''}">${esc(m.text)}</span><div class="faint tiny">${m.done ? `erledigt ${relDay(m.doneAt)}` : m.due ? `bis ${shortDate(m.due)}` : ''}</div></div>
      <button type="button" class="icon-btn sm plain" data-a="delMilestone" data-id="${m.id}" aria-label="Löschen">${icon('x', 'sm')}</button></div>`).join('')}</div>` : '<div class="empty">Eigene Etappen, z. B. „Erster Klimmzug ohne Hilfe“ oder „12 Wochen ohne Trainingsausfall“.</div>'}
    <div id="msForm" class="mt"><input name="text" placeholder="Neuer Meilenstein" maxlength="80"><div class="row mt"><input name="due" type="date" class="grow" aria-label="Zieldatum (optional)"><button type="button" class="btn primary" data-a="addMilestone">${icon('plus', 'sm')} Hinzufügen</button></div></div>
  </div>`;
}
A.addMilestone = () => {
  const root = $('#msForm'), v = formVals(root);
  if (!v.text.trim()) return markInvalid(root, 'text', 'Text fehlt');
  app.S.goals.milestones.push({ id: uid(), text: v.text.trim(), due: v.due || null, done: false, doneAt: null });
  commit();
};
A.toggleMilestone = (el) => {
  const m = app.S.goals.milestones.find((x) => x.id === el.dataset.id);
  m.done = !m.done; m.doneAt = m.done ? dkey() : null;
  commit();
  if (m.done) celebrate('Meilenstein erreicht', [m.text], 'flag');
};
A.delMilestone = (el) => { if (confirm('Meilenstein löschen?')) { app.S.goals.milestones = app.S.goals.milestones.filter((m) => m.id !== el.dataset.id); commit(); } };

