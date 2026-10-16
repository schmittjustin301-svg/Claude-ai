// Dashboard: alles Wichtige des Tages auf einen Blick, Schnellzugriff auf Gewicht, Essen, Training.
import { app, A, C, registerView, commit, go, openSheet, closeSheet, toast } from '../core.js';
import { dkey, addDays, sumMacros, weightChange, currentWeight, rollingAvg, prEvents, weekKeys, weeklyTraining, workoutVolume, workoutSets, lastPerformance, validate, LIMITS } from '../logic.js';
import { esc, fmt, fmtFixed, icon, mrow, delta, longDate, relDay, fmtDur, WD, formVals, markInvalid, fmtClock, hudRing, sparkline, microBars, corners, signed } from '../ui.js';
import { entries, plannedFor, workoutsOn, lastWorkoutOfDay, exName, daily, getDay, dayW, weightsSorted } from '../domain.js';
import { uid } from '../store.js';
import { monsterCan } from '../can.js';

function view() {
  const S = app.S, k = dkey();
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const hasData = S.workouts.length + S.weights.length + Object.keys(S.meals).length > 3;
  const backupOld = hasData && Date.now() - (S.settings.lastBackup || 0) > 7 * 864e5;
  const notices = [
    app.migrated ? `<div class="card gold-edge"><div class="row between top"><div class="small"><b>Deine FIT-Daten sind übernommen.</b><div class="muted tiny" style="margin-top:4px">Trainings, Plan, Gewicht, Essen, Maße und Fotos sind da. Prüf kurz unter „Ziele“ dein Zielgewicht.</div></div><button type="button" class="icon-btn sm plain" data-a="dismissMigrated" aria-label="Hinweis schließen">${icon('x', 'sm')}</button></div></div>` : '',
    app.recovered ? `<div class="card" style="border-color:var(--danger)"><span class="small">Gespeicherte Daten waren beschädigt und wurden als Kopie gesichert. Lade dein letztes Backup unter Einstellungen → Daten.</span></div>` : '',
    !S.settings.onboarded ? `<div class="card gold-edge"><b>Willkommen bei IRONCORE.</b><p class="muted small" style="margin:6px 0 12px">Zwei Minuten Einrichtung: Kalorien- und Makroziel berechnen, Zielgewicht festlegen.</p><div class="row"><button type="button" class="btn primary sm" data-a="go" data-v="calc">Ziele einrichten</button><button type="button" class="btn ghost sm" data-a="dismissOnboard">Später</button></div></div>` : '',
    !standalone && !S.settings.hideInstall ? `<div class="card"><div class="row between top"><div class="small"><b>Als App installieren</b><div class="muted tiny" style="margin-top:4px">Safari → Teilen → „Zum Home-Bildschirm“. Läuft dann im Vollbild und offline.</div></div><button type="button" class="icon-btn sm plain" data-a="hideInstall" aria-label="Hinweis schließen">${icon('x', 'sm')}</button></div></div>` : '',
    backupOld ? `<div class="card"><div class="row between"><span class="small">Letztes Backup ist über eine Woche her.</span><button type="button" class="btn outline sm" data-a="export">${icon('download', 'sm')} Sichern</button></div></div>` : '',
  ].join('');
  const kw = isoWeek(new Date());
  return `
  <div class="topbar">
    <div class="wordmark">IRONCORE</div>
    <div class="row"><span class="meta">KW ${kw} · ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span><button type="button" class="icon-btn" data-a="go" data-v="settings" aria-label="Einstellungen">${icon('sliders')}</button></div>
  </div>
  <div class="greet"><h1>${greeting()}${S.profile.name ? `, ${esc(S.profile.name)}` : ''}</h1><div class="muted small" style="margin-top:6px">${longDate(k)}</div></div>
  ${notices}
  <div class="dash">
    <div class="span">${cockpit(k)}</div>
    <div class="span quick">
      <button type="button" data-a="logWeight">${icon('scale')}Gewicht</button>
      <button type="button" data-a="quickFood">${icon('food')}Essen</button>
      <button type="button" data-a="go" data-v="progress">${icon('trend')}Verlauf</button>
    </div>
    <div>${nutritionCard(k)}${weekCard(k)}</div>
    <div>${weightCard()}${prCard()}</div>
    <div class="span">${habitsCard(k)}</div>
  </div>`;
}
function greeting() { const h = new Date().getHours(); return h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend'; }
function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7); }

// Hero 1: Cockpit – Woche als Segment-Ring, heutiges Training, START
function cockpit(k) {
  const S = app.S, wk = weekKeys(k);
  const done = S.workouts.filter((w) => wk.includes(w.date)).length;
  const target = S.goals.weeklySessions || 0;
  const ringHtml = hudRing({ seg: { total: Math.max(target, done) || 1, filled: done }, label: `${done} von ${target} Einheiten diese Woche`,
    center: `<span class="hud-v">${done}<span class="unit" style="font-size:15px">/${target || '–'}</span></span><span class="hud-l">Woche</span>` });
  let body;
  if (S.active) {
    const a = S.active, sets = a.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
    const vol = a.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).reduce((m, s) => m + (+s.w || 0) * (+s.r || 0), 0), 0);
    body = { eyebrow: 'Training läuft', title: esc(a.name), tele: [['Dauer', fmtDur(Date.now() - a.start)], ['Sätze', sets], ['Volumen', fmt(vol) + ' kg']], cta: `<button type="button" class="btn primary block launch" data-a="go" data-v="session">${icon('play')} Training fortsetzen</button>` };
  } else {
    const doneToday = workoutsOn(k);
    const plan = plannedFor(k).filter((d) => !doneToday.some((w) => w.dayId === d.id));
    if (doneToday.length && !plan.length) {
      const w = doneToday[doneToday.length - 1];
      body = { eyebrow: 'Training erledigt', title: esc(w.name), tele: [['Dauer', fmtDur(w.end - w.start)], ['Sätze', workoutSets(w)], ['Volumen', fmt(workoutVolume(w)) + ' kg']], cta: `<button type="button" class="btn outline block" data-a="showWorkout" data-id="${w.id}">${icon('list', 'sm')} Zusammenfassung</button>` };
    } else if (plan.length) {
      const d = plan[0], last = lastWorkoutOfDay(d.id);
      body = { eyebrow: 'Heute geplant', title: esc(d.name), sub: esc(d.ex.slice(0, 3).map((e) => exName(e.exId)).join(', ')) + (d.ex.length > 3 ? ` +${d.ex.length - 3}` : ''),
        tele: [['Übungen', d.ex.length], ['Sätze', d.ex.reduce((n, e) => n + e.sets, 0)], ['Zuletzt', last ? fmt(workoutVolume(last)) + ' kg' : '–']],
        cta: `<button type="button" class="btn primary block launch" data-a="startWorkout" data-id="${d.id}">${icon('play')} Start workout</button><button type="button" class="btn ghost block sm" style="margin-top:6px" data-a="previewDay" data-id="${d.id}">Letzte Leistung ansehen</button>` };
    } else {
      body = { eyebrow: 'Ruhetag', title: 'Regeneration', sub: 'Kein Training geplant. Muskeln wachsen in der Pause.', tele: null,
        cta: `<button type="button" class="btn outline block" data-a="startWorkout" data-id="">${icon('plus', 'sm')} Freies Training starten</button>` };
    }
  }
  return `<section class="hero corners" aria-label="Training heute">${corners()}
    <div class="cockpit">${ringHtml}<div style="min-width:0"><div class="label gold">${body.eyebrow}</div><div class="cockpit-title">${body.title}</div>${body.sub ? `<div class="muted small">${body.sub}</div>` : ''}</div></div>
    ${body.tele ? `<div class="telemetry">${body.tele.map(([l, v], i) => `<div><div class="meta">${l}</div><div class="v ${i === 2 ? 'gold' : ''}">${v}</div></div>`).join('')}</div>` : '<div style="height:16px"></div>'}
    ${body.cta}
  </section>`;
}

function weightCard() {
  const S = app.S, d = daily(), cw = currentWeight(d), goal = S.goals.weight;
  if (!cw) return `<div class="card"><div class="card-h"><span class="t">${icon('scale')} Körpergewicht</span></div><div class="empty">Noch kein Gewicht eingetragen. Wiege dich morgens nach dem Aufstehen – ab der ersten Woche siehst du hier deinen Trend.</div><button type="button" class="btn outline sm mt" data-a="logWeight">${icon('plus', 'sm')} Gewicht eintragen</button></div>`;
  const ch7 = weightChange(d, dkey(), 7), ch30 = weightChange(d, dkey(), 30);
  const dir = goal != null && goal > cw.trend ? 'up' : 'down';
  const pts = rollingAvg(d).filter((p) => p.x >= addDays(dkey(), -29));
  return `<div class="card tap" data-a="go" data-v="progress">
    <div class="card-h"><span class="t">${icon('scale')} Körpergewicht</span><span class="meta">Ø 7 Tage</span></div>
    <div class="row between top">
      <div><div class="statline"><span class="big gold">${fmtFixed(cw.trend)}</span><span class="unit">kg</span></div>
        <div class="muted small" style="margin-top:6px">${goal != null ? (Math.abs(cw.trend - goal) < 0.1 ? 'Ziel erreicht' : `Ziel ${fmtFixed(goal)} kg · noch ${fmtFixed(Math.abs(cw.trend - goal))}`) : '<span class="link">Ziel festlegen</span>'}</div></div>
      <div class="right"><div class="row" style="justify-content:flex-end"><span class="meta">7 T</span>${delta(ch7, { goodWhen: dir })}</div><div class="row" style="justify-content:flex-end;margin-top:6px"><span class="meta">30 T</span>${delta(ch30, { goodWhen: dir })}</div></div>
    </div>
    ${pts.length >= 2 ? `<div class="mt">${sparkline(pts)}</div><div class="row between"><span class="meta">${relDay(pts[0].x)}</span><span class="meta">Heute ${fmtFixed(cw.latest)} kg gemessen</span></div>` : `<div class="faint tiny mt">Verlauf und Veränderung erscheinen, sobald genug Messungen da sind.</div>`}
  </div>`;
}

// Ernährung: Kalorien außen, Protein innen – die zwei Zahlen, die in der Diät zählen
function nutritionCard(k) {
  const t = app.S.targets, tot = sumMacros(entries(k));
  const left = t.kcal - tot.kcal;
  return `<div class="card tap" data-a="go" data-v="food">
    <div class="card-h"><span class="t">${icon('flame')} Ernährung heute</span><span class="meta">${fmt(tot.kcal)} / ${fmt(t.kcal)} kcal</span></div>
    <div class="ring-wrap">${hudRing({ rings: [{ id: 'kcal', pct: t.kcal ? tot.kcal / t.kcal : 0, cls: tot.kcal > t.kcal * 1.05 ? 'bad' : '' }, { id: 'prot', pct: t.p ? tot.p / t.p : 0, cls: 'dim' }], label: `${fmt(tot.kcal)} von ${fmt(t.kcal)} kcal, ${fmt(tot.p)} von ${fmt(t.p)} g Protein`,
      center: `<span class="hud-v">${fmt(Math.abs(left))}</span><span class="hud-l">${left < 0 ? 'kcal drüber' : 'kcal übrig'}</span>` })}
      <div class="grow">
        <div class="label">Protein</div><div class="statline" style="margin:4px 0 12px"><span class="mid">${fmt(tot.p)}</span><span class="unit">/ ${fmt(t.p)} g</span></div>
        ${mrow('Kohlenhydrate', tot.c, t.c)}${mrow('Fett', tot.f, t.f)}
      </div></div>
  </div>`;
}

function weekCard(k) {
  const S = app.S, wk = weekKeys(k);
  const days = new Set(S.workouts.filter((w) => wk.includes(w.date)).map((w) => w.date));
  const weeks = weeklyTraining(S.workouts, k, 8);
  const cur = weeks[weeks.length - 1], prev = weeks[weeks.length - 2];
  const dPct = prev.volume ? ((cur.volume - prev.volume) / prev.volume) * 100 : null;
  return `<div class="card tap" data-a="go" data-v="train" data-p="analytics">
    <div class="card-h"><span class="t">${icon('trend')} Trainingsvolumen</span><span class="meta">Diese Woche</span></div>
    <div class="row between" style="align-items:flex-end">
      <div><div class="statline"><span class="big">${fmt(cur.volume)}</span><span class="unit">kg</span></div><div class="muted small" style="margin-top:6px">${cur.sets} Sätze${dPct != null ? ` · ${signed(dPct, 0, ' %')} zur Vorwoche` : ''}</div></div>
      <div style="width:42%">${microBars(weeks.map((w) => w.volume))}<div class="meta right" style="margin-top:4px">8 Wochen</div></div>
    </div>
    <div class="week mt">${wk.map((d) => `<div class="d ${days.has(d) ? 'done' : plannedFor(d).length ? 'plan' : ''} ${d === k ? 'today' : ''}">${WD[new Date(d + 'T12:00').getDay()]}<span class="m"></span></div>`).join('')}</div>
  </div>`;
}

function prCard() {
  const ev = prEvents(app.S.workouts).slice(-3).reverse();
  return `<div class="card">
    <div class="card-h"><span class="t">${icon('trophy')} Letzte Rekorde</span>${ev.length ? '<button type="button" class="link small" data-a="go" data-v="train" data-p="analytics">Alle</button>' : ''}</div>
    ${ev.length ? ev.map((e) => `<div class="pr"><div class="medal">${icon('trophy', 'sm')}</div><div class="grow"><b>${esc(e.name)}</b><div class="muted small">${fmt(e.w, 1)} kg × ${e.r} · ${relDay(e.date)}</div></div><div class="right"><div class="pv">${fmt(e.e1rm, 1)}</div><div class="meta">e1RM kg</div></div></div>`).join('')
      : '<div class="empty">Ein Rekord zählt, sobald du eine frühere Leistung übertriffst. Die erste Einheit einer Übung ist deine Basis.</div>'}
  </div>`;
}

function habitsCard(k) {
  const S = app.S, d = getDay(k), p = S.profile;
  return `<div class="card">
    <div class="card-h"><span class="t">${icon('drop')} Tageswerte</span><span class="meta">${relDay(k)}</span></div>
    <div class="water">
      ${monsterCan(p.waterGoal > 0 ? d.water / p.waterGoal : 0)}
      <div class="grow">
        <div class="label">${icon('drop', 'sm')} Wasser</div>
        <div style="margin-top:8px"><span class="big">${fmtFixed(d.water / 1000, 2)}</span> <span class="unit">/ ${fmtFixed(p.waterGoal / 1000, 1)} l</span></div>
        <div class="small ${d.water >= p.waterGoal ? 'gold' : 'muted'}" style="margin:4px 0 12px">${d.water >= p.waterGoal ? 'Ziel erreicht – stark!' : `noch ${fmt(p.waterGoal - d.water)} ml · ${fmt(Math.ceil((p.waterGoal - d.water) / 500))} ${Math.ceil((p.waterGoal - d.water) / 500) === 1 ? 'Dose' : 'Dosen'} à 0,5 l`}</div>
        <div class="grid2"><button type="button" class="btn sm" data-a="water" data-v="250">+250 ml</button><button type="button" class="btn sm primary" data-a="water" data-v="500">+500 ml</button></div>
        <button type="button" class="btn sm ghost block" style="margin-top:6px" data-a="water" data-v="-250" ${d.water <= 0 ? 'disabled' : ''}>${icon('minus', 'sm')} 250 ml</button>
      </div>
    </div>
    <hr class="divider">
    <div class="grid2">
      <label class="field" style="margin:0"><span>${icon('moon', 'sm')} Schlaf (h)</span><input type="number" inputmode="decimal" step="0.25" min="0" max="24" data-c="dayField" data-f="sleep" value="${d.sleep ?? ''}" placeholder="–"></label>
      <label class="field" style="margin:0"><span>${icon('pulse', 'sm')} Schritte</span><input type="number" inputmode="numeric" min="0" max="100000" data-c="dayField" data-f="steps" value="${d.steps ?? ''}" placeholder="–"></label>
    </div>
    ${S.supps.length ? `<div class="label" style="margin:16px 0 8px">Supplements</div><div class="chips">${S.supps.map((s) => `<button type="button" class="chip ${d.supps.includes(s.id) ? 'on' : ''}" data-a="supp" data-id="${s.id}">${d.supps.includes(s.id) ? '✓ ' : ''}${esc(s.name)}</button>`).join('')}</div>` : ''}
  </div>`;
}

registerView('home', view, 'home');

// ---------- Gewicht eintragen (auch von „Fortschritt“ genutzt) ----------
export function weightSheet(id = null) {
  return () => {
    const e = id ? app.S.weights.find((x) => x.id === id) : null;
    const t = e ? new Date(e.ts) : new Date();
    const last = weightsSorted().pop();
    return `<h2>${e ? 'Messung bearbeiten' : 'Gewicht eintragen'}</h2><div id="wForm">
      <label class="field"><span>Gewicht (kg)</span><input name="kg" type="text" inputmode="decimal" value="${e ? e.kg : ''}" placeholder="${last ? fmtFixed(last.kg) : 'z. B. 84,6'}" autocomplete="off"></label>
      <div class="grid2"><label class="field"><span>Datum</span><input name="date" type="date" value="${dkey(t)}" max="${dkey()}"></label><label class="field"><span>Uhrzeit</span><input name="time" type="time" value="${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}"></label></div></div>
      <button type="button" class="btn primary block xl" data-a="saveWeight" data-id="${id || ''}">Speichern</button>
      ${e ? `<button type="button" class="btn danger block mt" data-a="delWeight" data-id="${id}">${icon('trash', 'sm')} Löschen</button>` : '<p class="faint tiny center mt">Tipp: morgens nüchtern wiegen – der 7-Tage-Schnitt glättet Wasserschwankungen.</p>'}`;
  };
}
A.logWeight = () => { openSheet(weightSheet()); setTimeout(() => document.querySelector('#wForm [name=kg]')?.focus(), 80); };
A.editWeight = (el) => openSheet(weightSheet(el.dataset.id));
A.saveWeight = (el) => {
  const root = document.querySelector('#wForm');
  const v = formVals(root);
  const r = validate(v.kg, LIMITS.bodyKg);
  if (!r.ok) return markInvalid(root, 'kg', r.error);
  if (!v.date) return markInvalid(root, 'date', 'Datum fehlt');
  const [y, m, d] = v.date.split('-').map(Number);
  const [hh, mm] = (v.time || '08:00').split(':').map(Number);
  const ts = new Date(y, m - 1, d, hh || 0, mm || 0).getTime();
  if (ts > Date.now() + 60000) return markInvalid(root, 'date', 'Datum liegt in der Zukunft');
  const id = el.dataset.id;
  if (id) Object.assign(app.S.weights.find((x) => x.id === id), { kg: r.value, ts });
  else app.S.weights.push({ id: uid(), ts, kg: r.value });
  app.S.weights.sort((a, b) => a.ts - b.ts);
  closeSheet(); commit();
  toast(`${fmtFixed(r.value)} kg gespeichert · ${fmtClock(ts)}`);
  document.dispatchEvent(new CustomEvent('goals-check'));
};
A.delWeight = (el) => { if (!confirm('Messung löschen?')) return; app.S.weights = app.S.weights.filter((x) => x.id !== el.dataset.id); closeSheet(); commit(); };

// ---------- Weitere Aktionen ----------
A.dismissMigrated = () => { app.migrated = false; commit(); };
A.dismissOnboard = () => { app.S.settings.onboarded = true; commit(); };
A.hideInstall = () => { app.S.settings.hideInstall = true; commit(); };
A.quickFood = () => { app.ui.date = dkey(); go('food'); };
A.quickTrain = () => {
  if (app.S.active) return go('session');
  const plan = plannedFor(dkey()).filter((d) => !workoutsOn(dkey()).some((w) => w.dayId === d.id));
  if (plan.length === 1) return A.previewDay({ dataset: { id: plan[0].id } });
  go('train');
};
A.water = (el) => {
  const d = dayW(dkey()), goal = app.S.profile.waterGoal, before = d.water;
  d.water = Math.max(0, d.water + Number(el.dataset.v));
  commit();
  if (before < goal && d.water >= goal) { if (navigator.vibrate) navigator.vibrate([20, 40, 20]); toast('Trinkziel erreicht – Dose voll!'); }
};
A.supp = (el) => { const d = dayW(dkey()); const i = d.supps.indexOf(el.dataset.id); if (i >= 0) d.supps.splice(i, 1); else d.supps.push(el.dataset.id); commit(); };
C.dayField = (el) => {
  const f = el.dataset.f;
  const r = validate(el.value, f === 'sleep' ? { min: 0, max: 24, required: false, label: 'Schlaf' } : { min: 0, max: 100000, required: false, label: 'Schritte' });
  if (!r.ok) { el.classList.add('invalid'); return toast(r.error, true); }
  dayW(dkey())[f] = r.value;
  commit();
};

// Vorschau vor dem Training: letzte Leistung je Übung (Workflow A)
A.previewDay = (el) => {
  const id = el.dataset.id;
  openSheet(() => {
    const d = (app.S.plans.flatMap((p) => p.days)).find((x) => x.id === id);
    if (!d) return '<div class="empty">Trainingstag nicht gefunden.</div>';
    return `<h2>${esc(d.name)}</h2><p class="muted small" style="margin-top:-6px">Deine letzte Leistung je Übung</p>
      ${d.ex.map((pe) => {
        const last = lastPerformance(app.S.workouts, pe.exId);
        return `<div class="card elev" style="padding:12px 14px"><div class="row between"><b>${esc(exName(pe.exId))}</b><span class="faint tiny">${pe.sets} × ${esc(pe.reps)}${pe.kg ? ` @ ${fmt(pe.kg, 1)} kg` : ''}</span></div>
          <div class="small" style="margin-top:4px">${last ? `<span class="muted">${relDay(last.date)}:</span> <span class="num">${last.sets.map((s) => `${fmt(s.w, 1)}×${s.r}`).join('  ')}</span>` : '<span class="faint">Noch nie gemacht</span>'}</div>
          ${pe.note ? `<div class="faint tiny" style="margin-top:4px">${esc(pe.note)}</div>` : ''}</div>`;
      }).join('')}
      <button type="button" class="btn primary block xl mt" data-a="startWorkout" data-id="${id}">${icon('play')} Training starten</button>`;
  });
};
