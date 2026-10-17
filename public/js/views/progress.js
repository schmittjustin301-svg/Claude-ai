// Fortschritt: Körpergewicht (Messungen vs. Trend), Maße, private Fortschrittsfotos.
import { app, A, C, registerView, commit, save, openSheet, closeSheet, toast } from '../core.js';
import { dkey, addDays, rollingAvg, weightChange, weeklyRate, currentWeight, weeksToGoal, validate, LIMITS } from '../logic.js';
import { $, esc, fmt, fmtFixed, icon, delta, relDay, shortDate, fmtClock, lineChart, emptyCard, formVals, markInvalid, signed } from '../ui.js';
import { daily, weightsSorted } from '../domain.js';
import { uid, photoDB } from '../store.js';
import { compressImage } from '../photoutil.js';

const TABS = [['weight', 'Gewicht'], ['measure', 'Maße'], ['photos', 'Fotos']];
const RANGES = [[7, 'Woche'], [30, 'Monat'], [365, 'Jahr'], [0, 'Alles']];
let range = 30;
let showAll = false;

function view(params) {
  const tab = params.tab || 'weight';
  return `<div class="topbar"><h1>Fortschritt</h1>${tab === 'weight' ? `<button type="button" class="btn primary sm" data-a="logWeight">${icon('plus', 'sm')} Gewicht</button>` : tab === 'measure' ? `<button type="button" class="btn primary sm" data-a="addMeasure">${icon('plus', 'sm')} Messen</button>` : `<label class="btn primary sm">${icon('camera', 'sm')} Foto<input type="file" accept="image/*" data-c="photo" hidden></label>`}</div>
  <div class="seg" data-tour="progress">${TABS.map(([k, l]) => `<button type="button" class="${tab === k ? 'on' : ''}" data-a="progTab" data-v="${k}">${l}</button>`).join('')}</div>
  ${tab === 'weight' ? weightTab() : tab === 'measure' ? measureTab() : photosTab()}`;
}
registerView('progress', view, 'progress');
A.progTab = (el) => { app.ui.params = { tab: el.dataset.v }; commit(); };

// ---------- Gewicht ----------
function weightTab() {
  const d = daily(), cw = currentWeight(d), goal = app.S.goals.weight, today = dkey();
  if (!cw) return emptyCard('scale', 'Noch keine Messung', 'Trag dein Gewicht ein – am besten morgens, gleiche Bedingungen. Ab etwa einer Woche siehst du hier deinen Trend.', `<button type="button" class="btn primary" data-a="logWeight">${icon('plus', 'sm')} Erste Messung</button>`);
  const avg = rollingAvg(d);
  const from = range ? addDays(today, -(range - 1)) : '0000';
  const pts = d.filter((p) => p.x >= from), apts = avg.filter((p) => p.x >= from);
  const rate = weeklyRate(d);
  const ch7 = weightChange(d, today, 7), ch30 = weightChange(d, today, 30);
  const dir = goal != null && goal > cw.trend ? 'up' : 'down';
  const wks = weeksToGoal(cw.trend, goal, rate);
  const chart = lineChart([{ pts, cls: 'raw', dots: true }, { pts: apts, cls: 'main', tip: true }], {
    goal, goalLabel: 'Ziel',
    tip: (p) => { const raw = d.find((q) => q.x === p.x); return `<b>${fmtFixed(p.y)} kg</b> Ø 7 T<br><span class="muted">${shortDate(p.x)}${raw ? ` · gemessen ${fmtFixed(raw.y)}` : ''}</span>`; },
  });
  const list = weightsSorted().reverse();
  return `
  <div class="card">
    <div class="chips mb">${RANGES.map(([v, l]) => `<button type="button" class="chip ${range === v ? 'on' : ''}" data-a="wRange" data-v="${v}">${l}</button>`).join('')}</div>
    ${chart || `<div class="empty">Im gewählten Zeitraum ${pts.length === 1 ? 'nur eine Messung' : 'keine Messung'}. Wähle einen längeren Zeitraum.</div>`}
    ${chart ? '<div class="legend"><span><i style="background:var(--gold)"></i>Trend (Ø 7 Tage)</span><span><i style="background:var(--gold-lo)"></i>Messung</span>' + (goal != null ? '<span><i style="background:var(--text2)"></i>Ziel</span>' : '') + '</div>' : ''}
  </div>
  <div class="grid2 mb">
    <div class="card stat"><div class="label">Trend · Ø 7 T</div><div class="v gold">${fmtFixed(cw.trend)} <span class="unit">kg</span></div><div class="s">aus ${cw.trendN} ${cw.trendN === 1 ? 'Tag' : 'Tagen'} · zuletzt ${fmtFixed(cw.latest)}</div></div>
    <div class="card stat"><div class="label">Ziel</div><div class="v">${goal != null ? fmtFixed(goal) + ' <span class="unit">kg</span>' : '–'}</div><div class="s">${goal != null ? (Math.abs(cw.trend - goal) < 0.1 ? 'erreicht' : `noch ${fmtFixed(Math.abs(cw.trend - goal))} kg`) : '<button type="button" class="link" data-a="go" data-v="goals">Ziel festlegen</button>'}</div></div>
    <div class="card stat"><div class="label">7 Tage</div><div style="margin:4px 0 2px">${delta(ch7, { goodWhen: dir })}</div><div class="s">${ch7 == null ? 'braucht Messungen von vor 7 Tagen' : 'Veränderung des Trends'}</div></div>
    <div class="card stat"><div class="label">30 Tage</div><div style="margin:4px 0 2px">${delta(ch30, { goodWhen: dir })}</div><div class="s">${ch30 == null ? 'braucht Messungen von vor 30 Tagen' : 'Veränderung des Trends'}</div></div>
    <div class="card stat"><div class="label">Tempo</div><div class="v">${rate != null ? signed(rate, 2) : '–'}</div><div class="s">${rate != null ? 'kg pro Woche (letzte 4 Wo.)' : 'braucht ≥ 4 Messungen über 7 Tage'}</div></div>
    <div class="card stat"><div class="label">Prognose</div><div class="v">${wks != null ? (wks === 0 ? '✓' : `~${fmt(Math.ceil(wks))} Wo.`) : '–'}</div><div class="s">${wks != null ? 'bis Ziel bei aktuellem Tempo' : goal == null ? 'ohne Ziel keine Prognose' : 'Tempo zeigt nicht Richtung Ziel'}</div></div>
  </div>
  ${rate != null ? hint(rate, cw.trend, dir) : ''}
  <div class="section">Messungen · ${list.length}</div>
  <div class="card"><div class="list">${list.slice(0, showAll ? 400 : 10).map((w) => `<button type="button" class="item" data-a="editWeight" data-id="${w.id}"><span>${relDay(dkey(new Date(w.ts)))} <span class="faint small">${fmtClock(w.ts)}</span></span><span class="r num"><b>${fmtFixed(w.kg)}</b> <span class="muted small">kg</span></span>${icon('edit', 'sm chev')}</button>`).join('')}</div>
    ${list.length > 10 && !showAll ? `<button type="button" class="btn sm block mt" data-a="showAllWeights">Alle ${list.length} Messungen anzeigen</button>` : ''}</div>`;
}
function hint(rate, cur, dir) {
  const pct = (Math.abs(rate) / cur) * 100;
  let msg;
  if (dir === 'down') {
    if (rate > 0.05) msg = 'Der Trend steigt. Prüf, ob du dein Kalorienziel wirklich triffst – Öl, Soßen und Getränke zählen mit.';
    else if (pct < 0.25) msg = 'Kaum Bewegung. Bleibt das 2–3 Wochen so: 100–200 kcal weniger oder mehr Alltagsbewegung.';
    else if (pct > 1) msg = 'Sehr schnell (über 1 % pro Woche). Für Muskelerhalt eher 0,5–1 % – eventuell etwas mehr essen.';
    else msg = `${fmt(pct, 2)} % Körpergewicht pro Woche – im empfohlenen Bereich von 0,5–1 %. Weiter so.`;
  } else {
    msg = rate > 0 ? `+${fmt(pct, 2)} % pro Woche. Für sauberen Aufbau sind etwa 0,25–0,5 % pro Woche ein guter Richtwert.` : 'Der Trend fällt, obwohl dein Ziel höher liegt – mehr essen.';
  }
  return `<div class="card"><div class="row top small">${icon('bolt', 'sm gold')}<span>${msg}</span></div></div>`;
}
A.wRange = (el) => { range = +el.dataset.v; commit(); };
A.showAllWeights = () => { showAll = true; commit(); };

// ---------- Maße ----------
function measureTab() {
  const fields = app.S.measureFields;
  const ms = app.S.measures.slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!ms.length) return emptyCard('ruler', 'Noch keine Maße', 'Miss alle 1–2 Wochen. Maße zeigen Fortschritt, auch wenn die Waage stagniert.', `<button type="button" class="btn primary" data-a="addMeasure">${icon('plus', 'sm')} Erste Messung</button>`) + fieldsCard();
  const first = ms[0], last = ms[ms.length - 1];
  return `<div class="card"><div class="card-h"><span class="t">${icon('ruler')} Aktuell</span><span class="muted tiny">Stand ${shortDate(last.date)}${ms.length > 1 ? ` · Δ seit ${shortDate(first.date)}` : ''}</span></div>
    ${fields.map((f) => {
      const lastV = [...ms].reverse().find((m) => m.values[f.key] != null);
      const firstV = ms.find((m) => m.values[f.key] != null);
      if (!lastV) return `<div class="kv"><span class="muted">${esc(f.label)}</span><span class="faint">–</span></div>`;
      const dlt = firstV !== lastV ? lastV.values[f.key] - firstV.values[f.key] : null;
      return `<button type="button" class="item" data-a="measureChart" data-k="${f.key}"><span>${esc(f.label)}</span><span class="row"><b class="num">${fmtFixed(lastV.values[f.key])} cm</b>${dlt != null ? delta(dlt, { unit: '', goodWhen: f.key === 'waist' || f.key === 'hips' ? 'down' : f.key === 'arms' || f.key === 'chest' ? 'up' : 'none' }) : ''}${icon('right', 'sm chev')}</span></button>`;
    }).join('')}
  </div>
  <div class="section">Alle Messungen</div>
  <div class="card"><div class="list">${ms.slice().reverse().map((m) => `<button type="button" class="item" data-a="editMeasure" data-id="${m.id}"><div class="grow"><b>${relDay(m.date)}</b><div class="muted tiny">${fields.filter((f) => m.values[f.key] != null).map((f) => `${esc(f.label)} ${fmtFixed(m.values[f.key])}`).join(' · ')}</div></div>${icon('edit', 'sm chev')}</button>`).join('')}</div></div>
  ${fieldsCard()}`;
}
function fieldsCard() {
  return `<div class="section">Messfelder</div><div class="card">
    <div class="chips">${app.S.measureFields.map((f, i) => `<span class="chip on">${esc(f.label)}${i >= 5 ? ` <button type="button" class="link" style="margin-left:4px" data-a="delField" data-k="${f.key}" aria-label="Feld entfernen">×</button>` : ''}</span>`).join('')}</div>
    <div class="row mt"><input id="newField" class="grow" placeholder="Eigenes Feld, z. B. Wade, Nacken" maxlength="30"><button type="button" class="btn" data-a="addField">${icon('plus', 'sm')}</button></div></div>`;
}
function measureSheet(id) {
  return () => {
    const m = id ? app.S.measures.find((x) => x.id === id) : null;
    const prev = app.S.measures.slice().sort((a, b) => a.date.localeCompare(b.date)).pop();
    return `<h2>${m ? 'Messung bearbeiten' : 'Maße eintragen'}</h2><div id="mForm">
      <label class="field"><span>Datum</span><input name="date" type="date" value="${m ? m.date : dkey()}" max="${dkey()}"></label>
      <div class="grid2">${app.S.measureFields.map((f) => `<label class="field"><span>${esc(f.label)} (cm)</span><input name="f_${f.key}" inputmode="decimal" value="${m && m.values[f.key] != null ? m.values[f.key] : ''}" placeholder="${prev && prev.values[f.key] != null ? fmtFixed(prev.values[f.key]) : ''}"></label>`).join('')}</div>
      <p class="faint tiny">Taille auf Nabelhöhe, morgens, entspannt ausatmen. Arme angespannt an der dicksten Stelle.</p></div>
      <button type="button" class="btn primary block xl" data-a="saveMeasure" data-id="${id || ''}">Speichern</button>
      ${m ? `<button type="button" class="btn danger block mt" data-a="delMeasure" data-id="${id}">${icon('trash', 'sm')} Löschen</button>` : ''}`;
  };
}
A.addMeasure = () => openSheet(measureSheet(null));
A.editMeasure = (el) => openSheet(measureSheet(el.dataset.id));
A.saveMeasure = (el) => {
  const root = $('#mForm'), v = formVals(root);
  if (!v.date) return markInvalid(root, 'date', 'Datum fehlt');
  const values = {};
  for (const f of app.S.measureFields) {
    const r = validate(v['f_' + f.key], { ...LIMITS.cm, required: false, label: f.label });
    if (!r.ok) return markInvalid(root, 'f_' + f.key, r.error);
    if (r.value != null) values[f.key] = r.value;
  }
  if (!Object.keys(values).length) return toast('Mindestens einen Wert eintragen', true);
  const m = app.S.measures.find((x) => x.id === el.dataset.id);
  if (m) Object.assign(m, { date: v.date, values }); else app.S.measures.push({ id: uid(), date: v.date, values });
  closeSheet(); commit(); toast('Maße gespeichert');
};
A.delMeasure = (el) => { if (confirm('Messung löschen?')) { app.S.measures = app.S.measures.filter((m) => m.id !== el.dataset.id); closeSheet(); commit(); } };
A.measureChart = (el) => {
  const f = app.S.measureFields.find((x) => x.key === el.dataset.k);
  openSheet(() => {
    const pts = app.S.measures.filter((m) => m.values[f.key] != null).sort((a, b) => a.date.localeCompare(b.date)).map((m) => ({ x: m.date, y: m.values[f.key] }));
    return `<h2>${esc(f.label)}</h2>${lineChart([{ pts, cls: 'main', dots: true, tip: true }], { tip: (p) => `<b>${fmtFixed(p.y)} cm</b> · ${shortDate(p.x)}` }) || '<div class="empty">Ab zwei Messungen erscheint hier der Verlauf.</div>'}
      <div class="list mt">${pts.slice().reverse().map((p) => `<div class="kv"><span class="muted">${relDay(p.x)}</span><span>${fmtFixed(p.y)} cm</span></div>`).join('')}</div>`;
  });
};
A.addField = () => {
  const label = ($('#newField').value || '').trim();
  if (!label) return toast('Namen eingeben', true);
  if (app.S.measureFields.some((f) => f.label.toLowerCase() === label.toLowerCase())) return toast('Feld gibt es schon', true);
  app.S.measureFields.push({ key: 'c_' + uid(), label });
  commit();
};
A.delField = (el) => {
  const f = app.S.measureFields.find((x) => x.key === el.dataset.k);
  const used = app.S.measures.some((m) => m.values[f.key] != null);
  if (!confirm(`Feld „${f.label}“ entfernen?${used ? ' Gespeicherte Werte dieses Felds werden gelöscht.' : ''}`)) return;
  app.S.measureFields = app.S.measureFields.filter((x) => x.key !== f.key);
  app.S.measures.forEach((m) => { delete m.values[f.key]; });
  app.S.measures = app.S.measures.filter((m) => Object.keys(m.values).length);
  commit();
};

// ---------- Fotos ----------
const urls = new Map();
async function photoURL(id) {
  if (urls.has(id)) return urls.get(id);
  const b = await photoDB.get(id);
  if (!b) return '';
  const u = URL.createObjectURL(b);
  urls.set(id, u);
  return u;
}
export function forgetPhotoURLs() { urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear(); }
document.addEventListener('rendered', (e) => {
  e.detail.root.querySelectorAll('img[data-photo]').forEach(async (img) => { try { img.src = await photoURL(img.dataset.photo); } catch { /* fehlt */ } });
});
function photosTab() {
  const ps = app.S.photos.slice().sort((a, b) => b.date.localeCompare(a.date));
  const priv = `<div class="card"><div class="row top small">${icon('lock', 'sm gold')}<span class="muted">Fotos werden nur auf diesem Gerät gespeichert – nicht in der Cloud, für niemanden abrufbar. Sie sind im Backup enthalten (Einstellungen → Daten). Ohne Backup sind sie bei Gerätewechsel oder gelöschten Website-Daten weg.</span></div></div>`;
  if (!ps.length) return emptyCard('camera', 'Noch keine Fotos', 'Gleiches Licht, gleiche Pose, gleiche Uhrzeit – dann sind Vergleiche aussagekräftig.', `<label class="btn primary">${icon('camera', 'sm')} Erstes Foto<input type="file" accept="image/*" data-c="photo" hidden></label>`) + priv;
  return `${ps.length >= 2 ? `<button type="button" class="btn outline block mb" data-a="comparePhotos">${icon('copy', 'sm')} Vorher / Nachher vergleichen</button>` : ''}
    <div class="photos">${ps.map((p) => `<button type="button" data-a="showPhoto" data-id="${p.id}" aria-label="Foto vom ${shortDate(p.date)}"><img data-photo="${p.id}" alt=""><span class="dt">${shortDate(p.date)}</span></button>`).join('')}</div>
    <div class="mt">${priv}</div>`;
}
C.photo = async (el) => {
  const file = el.files && el.files[0];
  el.value = '';
  if (!file) return;
  try {
    toast('Foto wird gespeichert …');
    const blob = await compressImage(file);
    const id = uid();
    await photoDB.set(id, blob);
    app.S.photos.push({ id, date: dkey(), note: '' });
    app.ui.params = { tab: 'photos' };
    commit();
    toast('Foto gespeichert');
  } catch (e) { toast('Foto fehlgeschlagen: ' + (e.message || e), true); }
};
A.showPhoto = (el) => {
  const id = el.dataset.id;
  openSheet(() => {
    const p = app.S.photos.find((x) => x.id === id);
    if (!p) return '';
    return `<h2>${new Date(p.date + 'T12:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
      <img class="photo-full" data-photo="${id}" alt="Fortschrittsfoto">
      <div id="phForm" class="mt"><div class="grid2"><label class="field"><span>Datum</span><input name="date" type="date" value="${p.date}" max="${dkey()}"></label><label class="field"><span>Notiz</span><input name="note" value="${esc(p.note || '')}" placeholder="z. B. Woche 4, nüchtern"></label></div></div>
      <button type="button" class="btn block" data-a="savePhoto" data-id="${id}">Speichern</button>
      <button type="button" class="btn danger block mt" data-a="delPhoto" data-id="${id}">${icon('trash', 'sm')} Foto löschen</button>`;
  });
};
A.savePhoto = (el) => { const p = app.S.photos.find((x) => x.id === el.dataset.id); const v = formVals($('#phForm')); if (v.date) p.date = v.date; p.note = v.note.trim(); closeSheet(); commit(); toast('Gespeichert'); };
A.delPhoto = async (el) => {
  if (!confirm('Foto endgültig löschen?')) return;
  const id = el.dataset.id;
  app.S.photos = app.S.photos.filter((p) => p.id !== id);
  try { await photoDB.del(id); } catch { /* egal */ }
  if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
  closeSheet(); commit();
};
let cmp = null;
A.comparePhotos = () => {
  const ps = app.S.photos.slice().sort((a, b) => a.date.localeCompare(b.date));
  cmp = { a: ps[0].id, b: ps[ps.length - 1].id };
  openSheet(compareSheet);
};
function compareSheet() {
  const ps = app.S.photos.slice().sort((a, b) => a.date.localeCompare(b.date));
  const sel = (side) => `<select data-c="cmpSel" data-f="${side}">${ps.map((p) => `<option value="${p.id}" ${cmp[side] === p.id ? 'selected' : ''}>${shortDate(p.date)}${p.note ? ' · ' + esc(p.note) : ''}</option>`).join('')}</select>`;
  const da = ps.find((p) => p.id === cmp.a)?.date, db = ps.find((p) => p.id === cmp.b)?.date;
  const days = da && db ? Math.abs(Math.round((new Date(db) - new Date(da)) / 864e5)) : 0;
  return `<h2>Vorher / Nachher</h2><p class="muted small" style="margin-top:-6px">${days} Tage Abstand</p><div class="compare"><figure><img data-photo="${cmp.a}" alt="Vorher">${sel('a')}</figure><figure><img data-photo="${cmp.b}" alt="Nachher">${sel('b')}</figure></div>`;
}
C.cmpSel = (el) => { cmp[el.dataset.f] = el.value; openSheet(compareSheet); };
export { save };
