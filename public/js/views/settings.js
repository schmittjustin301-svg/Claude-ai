// Einstellungen: Makro-Rechner & Ziele, Tageswerte, Supplements, Daten (Backup, CSV, Import, Löschen).
import { app, A, C, registerView, commit, saveNow, go, render, toast } from '../core.js';
import { calcMacros, dkey, validate, LIMITS, currentWeight, sumMacros, workoutVolume, r1 } from '../logic.js';
import { $, esc, fmt, fmtFixed, icon } from '../ui.js';
import { daily, entries } from '../domain.js';
import { photoDB, defaults, normalize, migrateFromFit, KEY, LEGACY_KEY } from '../store.js';
import { forgetPhotoURLs } from './progress.js';
import { mascot } from '../mascot.js';

// ---------- Einstellungen ----------
function view() {
  const S = app.S, p = S.profile;
  return `<div class="topbar"><button type="button" class="back" data-a="back">${icon('left', 'sm')} Zurück</button></div>
  <h1 class="mb">Einstellungen</h1>
  <div class="card"><div class="list">
    <button type="button" class="item" data-a="go" data-v="calc"><div><b>Kalorien &amp; Makros</b><div class="muted small">${fmt(S.targets.kcal)} kcal · P ${S.targets.p} · K ${S.targets.c} · F ${S.targets.f}</div></div>${icon('right', 'chev')}</button>
    <button type="button" class="item" data-a="go" data-v="goals"><div><b>Ziele</b><div class="muted small">Zielgewicht ${S.goals.weight != null ? fmtFixed(S.goals.weight) + ' kg' : 'nicht gesetzt'} · ${S.goals.weeklySessions}× Training pro Woche</div></div>${icon('right', 'chev')}</button>
  </div></div>

  <div class="section">Profil</div>
  <div class="card"><label class="field" style="margin:0"><span>Dein Name</span><input data-c="profName" value="${esc(p.name || '')}" placeholder="für die Begrüßung, optional" maxlength="30" autocomplete="given-name"></label></div>

  <div class="section">Tageswerte</div>
  <div class="card"><div class="grid3">
    <label class="field"><span>Wasser (ml)</span><input type="number" inputmode="numeric" step="250" data-c="prof" data-f="waterGoal" value="${p.waterGoal}"></label>
    <label class="field"><span>Schlaf (h)</span><input type="number" inputmode="decimal" step="0.5" data-c="prof" data-f="sleepGoal" value="${p.sleepGoal}"></label>
    <label class="field"><span>Schritte</span><input type="number" inputmode="numeric" step="500" data-c="prof" data-f="stepGoal" value="${p.stepGoal}"></label>
  </div></div>

  <div class="section">Routine</div>
  <div class="card"><div class="list">
    <button type="button" class="item" data-a="go" data-v="supps"><div><b>Meine Supplements</b><div class="muted small">${S.supps.filter((x) => !x.archived).length} aktiv · eigener Zeitplan, Vorrat</div></div>${icon('right', 'chev')}</button>
    <button type="button" class="item" data-a="go" data-v="reminders"><div><b>Erinnerungen &amp; Kalender</b><div class="muted small">${S.notify.enabled ? 'aktiv' : 'aus'} · Kalender-Export</div></div>${icon('right', 'chev')}</button>
    <button type="button" class="item" data-a="manageSlots"><div><b>Mahlzeiten &amp; Uhrzeiten</b><div class="muted small">${S.mealSlots.slice().sort((a, b) => a.time.localeCompare(b.time)).map((m) => `${esc(m.name)} ${m.time}`).join(' · ')}</div></div>${icon('right', 'chev')}</button>
  </div></div>

  <div class="section">Tutorial &amp; Hilfe</div>
  <div class="card coach-set" data-tour="help"><div class="row top">${mascot('explaining', { size: 'sm', decorative: true })}<div class="grow"><b>Dein Coach</b><div class="muted small" style="margin:4px 0 12px">Geführte Tour durch alle Bereiche, Tipps zu einzelnen Knöpfen und Hilfe zu jeder Seite.</div>
    <div class="row wrap"><button type="button" class="btn primary sm" data-a="tourStart">${app.S.coach.tour === 'done' || app.S.coach.tour === 'skipped' ? 'Tour neu starten' : app.S.coach.tour === 'active' ? 'Tour von vorn' : 'Tour starten'}</button><button type="button" class="btn sm" data-a="go" data-v="help">Tutorial &amp; Hilfe</button></div></div></div></div>

  <div class="section">Daten &amp; Privatsphäre</div>
  <div class="card">
    <div class="row top small mb">${icon('lock', 'sm gold')}<span class="muted">Alles liegt nur auf diesem Gerät: kein Konto, kein Server, kein Tracking. Einzige Ausnahme ist der Barcode-Scanner: Er schickt die Barcode-Nummer an Open Food Facts.</span></div>
    <div class="kv"><span class="muted">Letztes Backup</span><span>${S.settings.lastBackup ? new Date(S.settings.lastBackup).toLocaleDateString('de-DE') : 'noch nie'}</span></div>
    <div class="kv"><span class="muted">Speicher</span><span id="storeInfo">…</span></div>
    <div class="grid2 mt"><button type="button" class="btn primary" data-a="export">${icon('download', 'sm')} Backup</button><label class="btn">${icon('upload', 'sm')} Backup laden<input type="file" accept="application/json,.json" data-c="importFile" hidden></label></div>
    <label class="check mt"><input type="checkbox" id="withPhotos" checked> Fotos ins Backup aufnehmen</label>
    <p class="faint tiny">Backup in „Dateien“ / iCloud Drive speichern. Damit ziehst du auch auf ein neues Handy um. Ohne Backup sind die Daten weg, wenn das Gerät verloren geht oder Safari die Website-Daten löscht.</p>
  </div>
  <div class="card">
    <div class="label" style="margin-bottom:10px">Export als Tabelle (CSV)</div>
    <div class="grid2"><button type="button" class="btn sm" data-a="csv" data-v="weights">Gewicht</button><button type="button" class="btn sm" data-a="csv" data-v="sets">Trainingssätze</button><button type="button" class="btn sm" data-a="csv" data-v="nutrition">Ernährung pro Tag</button><button type="button" class="btn sm" data-a="csv" data-v="measures">Maße</button></div>
  </div>
  <div class="card"><button type="button" class="btn danger block" data-a="resetAll">${icon('trash', 'sm')} Alle Daten löschen</button></div>
  <p class="faint tiny center">IRONCORE · privat · läuft offline</p>`;
}
registerView('settings', view, 'home');
document.addEventListener('rendered', async (e) => {
  const el = e.detail.root.querySelector('#storeInfo');
  if (!el) return;
  try {
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    const pers = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    el.textContent = `${est ? fmt((est.usage || 0) / 1048576, 1) + ' MB' : '–'}${pers ? ' · geschützt' : ''}`;
  } catch { el.textContent = '–'; }
});
C.prof = (el) => {
  const lims = { waterGoal: [0, 10000], sleepGoal: [0, 16], stepGoal: [0, 100000], age: [14, 100], height: [120, 230], weight: [25, 350] }[el.dataset.f] || [0, 1e6];
  const r = validate(el.value, { min: lims[0], max: lims[1] });
  if (!r.ok) { el.classList.add('invalid'); return toast(r.error, true); }
  app.S.profile[el.dataset.f] = r.value;
  commit();
};
C.profName = (el) => { app.S.profile.name = el.value.trim().slice(0, 30); commit(); };

// ---------- Makro-Rechner ----------
function calcView() {
  const S = app.S, p = S.profile, m = calcMacros(p), t = S.targets;
  const cw = currentWeight(daily());
  const sel = (f, opts) => `<select data-c="profSel" data-f="${f}">${opts.map(([v, l]) => `<option value="${v}" ${String(p[f]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return `<div class="topbar"><button type="button" class="back" data-a="back">${icon('left', 'sm')} Zurück</button></div>
  <h1 class="mb">Kalorien &amp; Makros</h1>
  <div class="card">
    <div class="field"><span>Geschlecht</span><div class="chips"><button type="button" class="chip ${p.sex === 'm' ? 'on' : ''}" data-a="sex" data-v="m">Männlich</button><button type="button" class="chip ${p.sex === 'f' ? 'on' : ''}" data-a="sex" data-v="f">Weiblich</button></div></div>
    <div class="grid3"><label class="field"><span>Alter</span><input type="number" inputmode="numeric" data-c="prof" data-f="age" value="${p.age}"></label><label class="field"><span>Größe cm</span><input type="number" inputmode="numeric" data-c="prof" data-f="height" value="${p.height}"></label><label class="field"><span>Gewicht kg</span><input inputmode="decimal" data-c="prof" data-f="weight" value="${p.weight}"></label></div>
    ${cw && Math.abs(cw.trend - p.weight) >= 0.1 ? `<button type="button" class="link small mb" data-a="useTrend">Aktuellen Trend übernehmen (${fmtFixed(cw.trend)} kg)</button>` : ''}
    <label class="field"><span>Aktivität (inkl. Training)</span>${sel('activity', [[1.2, 'Kaum aktiv – Bürojob, kein Sport'], [1.375, 'Leicht – 1–3× Training/Woche'], [1.55, 'Mittel – 3–5× Training/Woche'], [1.725, 'Hoch – 6–7× Training oder körperlicher Job'], [1.9, 'Sehr hoch – Training + körperlicher Job']])}</label>
    <label class="field"><span>Kalorienbilanz</span>${sel('deficit', [[0, 'Halten'], [250, '−250 kcal · sanft'], [400, '−400 kcal · moderat'], [500, '−500 kcal · Standard-Diät'], [750, '−750 kcal · aggressiv'], [-250, '+250 kcal · sauberer Aufbau'], [-400, '+400 kcal · Aufbau']])}</label>
    <div class="grid2"><label class="field"><span>Protein g / kg</span>${sel('proteinPerKg', [[1.6, '1,6'], [1.8, '1,8'], [2, '2,0'], [2.2, '2,2 (Diät)'], [2.5, '2,5']])}</label><label class="field"><span>Fett g / kg</span>${sel('fatPerKg', [[0.6, '0,6'], [0.7, '0,7'], [0.8, '0,8'], [1, '1,0']])}</label></div>
  </div>
  <div class="card gold-edge">
    <div class="kv"><span>Grundumsatz</span><span>${fmt(m.bmr)} kcal</span></div>
    <div class="kv"><span>Erhaltungsbedarf</span><span>${fmt(m.tdee)} kcal</span></div>
    <div class="kv"><span><b>Empfohlenes Tagesziel</b></span><span class="gold">${fmt(m.kcal)} kcal</span></div>
    <div class="kv"><span>Protein · Kohlenhydrate · Fett</span><span>${m.p} · ${m.c} · ${m.f} g</span></div>
    ${m.floored ? '<p class="danger-t small">Untergrenze 1200 kcal greift – Defizit verkleinern.</p>' : ''}
    <button type="button" class="btn primary block mt" data-a="applyCalc">Als Tagesziel übernehmen</button>
    <p class="faint tiny" style="margin-bottom:0">Mifflin-St-Jeor-Formel – ein Startwert. Nach 2–3 Wochen am echten Gewichtstrend nachjustieren.</p>
  </div>
  <div class="section">Tagesziel manuell</div>
  <div class="card"><div class="grid2">
    <label class="field"><span>Kalorien</span><input inputmode="numeric" data-c="target" data-f="kcal" value="${t.kcal}"></label>
    <label class="field"><span>Protein g</span><input inputmode="numeric" data-c="target" data-f="p" value="${t.p}"></label>
    <label class="field"><span>Kohlenhydrate g</span><input inputmode="numeric" data-c="target" data-f="c" value="${t.c}"></label>
    <label class="field"><span>Fett g</span><input inputmode="numeric" data-c="target" data-f="f" value="${t.f}"></label></div>
    <p class="faint tiny" style="margin:0">Makros ergeben ${fmt(t.p * 4 + t.c * 4 + t.f * 9)} kcal${Math.abs(t.p * 4 + t.c * 4 + t.f * 9 - t.kcal) > 50 ? ` – <span class="danger-t">weicht vom Kalorienziel ab</span>` : ''}.</p></div>`;
}
registerView('calc', calcView, 'home');
C.profSel = (el) => { app.S.profile[el.dataset.f] = Number(el.value); commit(); };
A.sex = (el) => { app.S.profile.sex = el.dataset.v; commit(); };
A.useTrend = () => { app.S.profile.weight = r1(currentWeight(daily()).trend); commit(); };
A.applyCalc = () => { const m = calcMacros(app.S.profile); app.S.targets = { kcal: m.kcal, p: m.p, c: m.c, f: m.f }; app.S.settings.onboarded = true; commit(); toast(`Tagesziel: ${fmt(m.kcal)} kcal`); };
C.target = (el) => {
  const r = validate(el.value, el.dataset.f === 'kcal' ? { ...LIMITS.kcal, min: 800 } : LIMITS.macro);
  if (!r.ok) { el.classList.add('invalid'); return toast(r.error, true); }
  app.S.targets[el.dataset.f] = Math.round(r.value);
  app.S.settings.onboarded = true;
  commit();
};

// ---------- Backup ----------
const blobToDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
async function deliver(blob, name, mime) {
  const file = new File([blob], name, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
A.export = async () => {
  const withPhotos = $('#withPhotos') ? $('#withPhotos').checked : true;
  saveNow();
  const data = { app: 'ironcore', version: 2, exported: new Date().toISOString(), state: app.S, photos: {} };
  if (withPhotos) for (const ph of app.S.photos) { try { const b = await photoDB.get(ph.id); if (b) data.photos[ph.id] = await blobToDataURL(b); } catch { /* übersprungen */ } }
  const ok = await deliver(new Blob([JSON.stringify(data)], { type: 'application/json' }), `ironcore-backup-${dkey()}.json`, 'application/json');
  if (!ok) return;
  app.S.settings.lastBackup = Date.now();
  commit();
  toast('Backup erstellt');
};
C.importFile = async (el) => {
  const file = el.files && el.files[0];
  el.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !data.state || !['ironcore', 'fit'].includes(data.app)) throw new Error('Keine IRONCORE- oder FIT-Backup-Datei');
    if (!confirm('Backup laden? Die aktuellen Daten auf diesem Gerät werden ersetzt.')) return;
    const next = data.app === 'fit' ? migrateFromFit(data.state) : normalize(data.state);
    const photos = data.photos || {};
    if (Object.keys(photos).length) {
      await photoDB.clear();
      forgetPhotoURLs();
      for (const [id, url] of Object.entries(photos)) await photoDB.set(id, await (await fetch(url)).blob());
    }
    app.S = next;
    app.ui.history = [];
    saveNow();
    go(app.S.active ? 'session' : 'home', {}, { push: false });
    toast('Backup geladen');
  } catch (e) { toast('Import fehlgeschlagen: ' + e.message, true); }
};

// ---------- CSV ----------
const csvCell = (v) => { const s = v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (rows) => '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n'); // Semikolon + BOM für deutsches Excel/Numbers
A.csv = async (el) => {
  const S = app.S, kind = el.dataset.v;
  let rows;
  if (kind === 'weights') rows = [['Datum', 'Uhrzeit', 'Gewicht kg'], ...S.weights.slice().sort((a, b) => a.ts - b.ts).map((w) => { const d = new Date(w.ts); return [dkey(d), d.toTimeString().slice(0, 5), w.kg]; })];
  else if (kind === 'sets') rows = [['Datum', 'Training', 'Übung', 'Satz', 'Gewicht kg', 'Wdh.', 'Volumen kg'], ...S.workouts.slice().sort((a, b) => a.start - b.start).flatMap((w) => w.exercises.flatMap((e) => e.sets.map((s, i) => [w.date, w.name, e.name, i + 1, s.w, s.r, s.w * s.r])))];
  else if (kind === 'nutrition') rows = [['Datum', 'kcal', 'Protein g', 'Kohlenhydrate g', 'Fett g', 'Einträge'], ...Object.keys(S.meals).filter((k) => entries(k).length).sort().map((k) => { const t = sumMacros(entries(k)); return [k, Math.round(t.kcal), r1(t.p), r1(t.c), r1(t.f), entries(k).length]; })];
  else rows = [['Datum', ...S.measureFields.map((f) => f.label + ' cm')], ...S.measures.slice().sort((a, b) => a.date.localeCompare(b.date)).map((m) => [m.date, ...S.measureFields.map((f) => m.values[f.key] ?? '')])];
  if (rows.length < 2) return toast('Noch keine Daten für diesen Export');
  await deliver(new Blob([csv(rows)], { type: 'text/csv' }), `ironcore-${kind}-${dkey()}.csv`, 'text/csv');
};

A.resetAll = async () => {
  if (!confirm('Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.')) return;
  if (!confirm('Letzte Chance: Hast du ein Backup? Jetzt alles löschen?')) return;
  try { await photoDB.clear(); } catch { /* egal */ }
  forgetPhotoURLs();
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY_KEY);
  app.S = defaults();
  app.migrated = false;
  app.ui.history = [];
  saveNow();
  go('home', {}, { push: false });
  toast('Alle Daten gelöscht');
};
export { render, workoutVolume };
