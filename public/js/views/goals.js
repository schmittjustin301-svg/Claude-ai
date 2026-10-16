// Ziele: Zielgewicht, Kraftziele, Trainings-Wochenziel, Ernährungsziele, eigene Meilensteine.
// Fortschritt wird nur aus echten Einträgen berechnet.
import { app, A, C, registerView, commit, save, openSheet, closeSheet, toast, celebrate, go } from '../core.js';
import { dkey, weightGoalProgress, strengthGoalProgress, nutritionAdherence, weeklyTraining, weeklyRate, currentWeight, weeksToGoal, validate, LIMITS } from '../logic.js';
import { $, esc, fmt, fmtFixed, icon, bar, shortDate, relDay, formVals, markInvalid, plural } from '../ui.js';
import { daily, exName, exById } from '../domain.js';
import { uid } from '../store.js';
import { pickExercise } from './training.js';

function view() {
  return `<div class="topbar"><h1>Ziele</h1></div>
  ${weightGoal()}${trainingGoal()}${nutritionGoal()}${strengthGoals()}${milestones()}`;
}
registerView('goals', view, 'goals');

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

function strengthGoals() {
  const gs = app.S.goals.strength;
  return `<div class="section">Kraftziele<button type="button" class="link act" data-a="addStrength">+ Ziel</button></div>
  ${gs.length ? gs.map((g) => {
    const p = strengthGoalProgress(app.S.workouts, g);
    return `<div class="card ${p.done ? 'gold-edge' : ''}"><div class="row between top"><div><b>${esc(exName(g.key, g.name || 'Übung'))}</b><div class="muted small">${fmt(g.kg, 1)} kg × ${g.reps} ${g.reps === 1 ? 'Wiederholung' : 'Wiederholungen'}</div></div>
      <div class="row">${p.done ? '<span class="pill gold">Erreicht</span>' : `<span class="gold num" style="font-weight:700">${fmt(p.pct * 100)} %</span>`}<button type="button" class="icon-btn sm plain" data-a="delStrength" data-id="${g.id}" aria-label="Ziel löschen">${icon('trash', 'sm')}</button></div></div>
      <div class="mt">${bar(p.pct, 1, { over: false })}</div>
      <div class="faint tiny mt">${p.bestW ? `Bestes Gewicht bei ≥ ${g.reps} Wdh.: ${fmt(p.bestW, 1)} kg (${shortDate(p.bestDate)})` : `Noch kein Satz mit ≥ ${g.reps} Wdh. geloggt`}</div></div>`;
  }).join('') : '<div class="card"><div class="empty">Zum Beispiel „Bankdrücken 100 kg × 5“. Der Fortschritt kommt automatisch aus deinen Trainings.</div></div>'}`;
}
let draft = null;
A.addStrength = () => pickExercise((exId) => { draft = { key: exId }; openSheet(strengthSheet); });
function strengthSheet() {
  const e = exById(draft.key);
  return `<h2>Kraftziel</h2><p class="muted" style="margin-top:-6px">${esc(e?.name || '')}</p><div id="sgForm">
    <div class="grid2"><label class="field"><span>Gewicht (kg)</span><input name="kg" inputmode="decimal" placeholder="z. B. 100"></label><label class="field"><span>Wiederholungen</span><input name="reps" inputmode="numeric" value="1"></label></div></div>
    <button type="button" class="btn primary block xl" data-a="saveStrength">Ziel speichern</button>`;
}
A.saveStrength = () => {
  const root = $('#sgForm'), v = formVals(root);
  const kg = validate(v.kg, { ...LIMITS.liftKg, min: 1 });
  if (!kg.ok) return markInvalid(root, 'kg', kg.error);
  const reps = validate(v.reps, { min: 1, max: 50, label: 'Wiederholungen' });
  if (!reps.ok) return markInvalid(root, 'reps', reps.error);
  app.S.goals.strength.push({ id: uid(), key: draft.key, name: exName(draft.key), kg: kg.value, reps: Math.round(reps.value), created: Date.now() });
  draft = null;
  closeSheet(); commit();
  document.dispatchEvent(new CustomEvent('goals-check'));
};
A.delStrength = (el) => { if (confirm('Kraftziel löschen?')) { app.S.goals.strength = app.S.goals.strength.filter((g) => g.id !== el.dataset.id); commit(); } };

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

// Erreichte Ziele einmalig feiern (nach Training, Gewichtseintrag, Zieländerung)
document.addEventListener('goals-check', () => {
  const S = app.S, seen = S.settings.celebrated;
  const lines = [];
  for (const g of S.goals.strength) {
    const id = 's:' + g.id;
    if (!seen[id] && strengthGoalProgress(S.workouts, g).done) { seen[id] = dkey(); lines.push(`${exName(g.key, g.name)}: ${fmt(g.kg, 1)} kg × ${g.reps}`); }
  }
  const wp = weightGoalProgress(daily(), S.goals.weight);
  const wid = 'w:' + S.goals.weight;
  if (wp && wp.done && Math.abs(wp.start - wp.cur) > 0.3 && !seen[wid]) { seen[wid] = dkey(); lines.push(`Zielgewicht ${fmtFixed(S.goals.weight)} kg erreicht`); }
  if (lines.length) { save(); setTimeout(() => celebrate(lines.length === 1 ? 'Ziel erreicht' : `${lines.length} Ziele erreicht`, lines, 'target'), document.querySelector('.celebrate') ? 2600 : 0); }
});
export { go };
