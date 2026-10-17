// „Meine Supplements“: eigene Produkte, eigener Zeitplan, Vorrat, Einnahmetreue.
// Hinweis: IRONCORE schlägt keine Dosierungen vor – alle Mengen und Zeiten stammen vom Nutzer.
import { app, A, C, registerView, commit, save, openSheet, closeSheet, toast } from '../core.js';
import { dkey, addDays, validate } from '../logic.js';
import { $, esc, fmt, icon, relDay, shortDate, hudRing, microBars, formVals, markInvalid, WD, WD_ORDER } from '../ui.js';
import { suppOccurrences, unscheduledSupps, intakeRecord, statusOf, dayAdherence, adherenceRange, stockInfo, lowStock, SUPP_CATEGORIES, SUPP_UNITS, validTime, intakeKey } from '../schedule.js';
import { eventRow } from '../routine.js';
import { uid, photoDB } from '../store.js';
import { compressImage } from '../photoutil.js';

function view() {
  const S = app.S, k = dkey(), now = Date.now();
  const active = S.supps.filter((x) => !x.archived), archived = S.supps.filter((x) => x.archived);
  const occ = suppOccurrences(S, k);
  const doneToday = occ.filter((o) => intakeRecord(S, k, o.key)?.status === 'taken').length;
  const adh = dayAdherence(S, k, now);
  const week = adherenceRange(S, addDays(k, -6), k, now);
  const nextSupp = (() => { const t = occ.map((o) => ({ o, st: statusOf(intakeRecord(S, k, o.key), k, o.time, now) })).filter((x) => x.st === 'due' || x.st === 'upcoming' || x.st === 'snoozed'); return t[0]; })();
  const low = lowStock(S);
  const uns = unscheduledSupps(S);
  return `<div class="topbar"><button type="button" class="back" data-a="back">${icon('left', 'sm')} Zurück</button><button type="button" class="btn primary sm" data-a="newSupp" data-tour="add-supp">${icon('plus', 'sm')} Supplement</button></div>
  <h1>Meine Supplements</h1><div class="muted small" style="margin:6px 0 16px">Dein Plan, deine Mengen. IRONCORE erinnert nur – es empfiehlt nichts.</div>
  ${active.length ? `
  <section class="hero corners" aria-label="Supplements heute" data-tour="supps"><i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i>
    <div class="cockpit">${hudRing({ rings: [{ id: 'supp-day', pct: occ.length ? doneToday / occ.length : 0 }], label: `${doneToday} von ${occ.length} Einnahmen heute`, center: `<span class="hud-v">${doneToday}<span class="unit" style="font-size:15px">/${occ.length}</span></span><span class="hud-l">Heute</span>` })}
      <div style="min-width:0"><div class="label gold">Als Nächstes</div>
        ${nextSupp ? `<div class="cockpit-title">${esc(nextSupp.o.supp.name)}</div><div class="muted small">${nextSupp.o.time}${nextSupp.o.amount != null ? ` · ${fmt(Number(nextSupp.o.amount), 2)} ${esc(nextSupp.o.supp.unit)}` : ''}${nextSupp.st === 'due' ? ' · fällig' : ''}</div>` : `<div class="cockpit-title">${occ.length ? 'Alles erledigt' : 'Heute nichts geplant'}</div>`}
      </div></div>
    <div class="telemetry"><div><div class="meta">Heute</div><div class="v gold">${adh.pct != null ? fmt(adh.pct * 100) + ' %' : '–'}</div></div><div><div class="meta">7 Tage</div><div class="v">${week.pct != null ? fmt(week.pct * 100) + ' %' : '–'}</div></div><div><div class="meta">Vorrat knapp</div><div class="v">${low.length}</div></div></div>
    <div class="row between"><span class="meta">Einnahmetreue · 7 Tage</span><span class="meta">${week.taken}/${week.scheduled}</span></div>
    <div style="margin-top:6px">${microBars(week.days.map((d) => (d.pct == null ? 0 : d.pct * 100)), { h: 36 })}</div>
    <div class="row between" style="margin-top:4px">${week.days.map((d) => `<span class="meta" style="flex:1;text-align:center">${WD[new Date(d.date + 'T12:00').getDay()]}</span>`).join('')}</div>
  </section>
  ${low.length ? `<div class="card" style="border-color:var(--gold-edge)"><div class="card-h"><span class="t">${icon('bolt')} Vorrat knapp</span></div>${low.map((s) => { const i = stockInfo(s); return `<div class="kv"><span>${esc(s.name)}</span><span>${fmt(i.stock, 2)} ${esc(s.unit)}${i.daysLeft != null ? ` · ~${i.daysLeft} Tage` : ''}</span></div>`; }).join('')}</div>` : ''}
  <div class="section">Heute</div>
  ${occ.length ? `<div class="card tl">${occ.map((o) => { const r = intakeRecord(S, k, o.key); return eventRow({ kind: 'supp', key: o.key, id: o.supp.id, time: o.time, title: o.supp.name, amount: o.amount, unit: o.supp.unit, slot: o.slot, status: statusOf(r, k, o.time, now), takenAt: r?.at }, k); }).join('')}</div>` : '<div class="card"><div class="empty">Für heute ist keine Einnahme geplant.</div></div>'}
  ${uns.length ? `<div class="card"><div class="card-h"><span class="t">${icon('pill')} Ohne feste Uhrzeit</span></div><div class="chips">${uns.map((s) => { const key = intakeKey(s.id, '_'); const on = intakeRecord(S, k, key)?.status === 'taken'; return `<button type="button" class="chip ${on ? 'on' : ''}" data-a="${on ? 'suppUndo' : 'suppTake'}" data-key="${key}" data-amt="${s.serving ?? ''}" data-date="${k}">${on ? '✓ ' : ''}${esc(s.name)}</button>`; }).join('')}</div></div>` : ''}
  <div class="section">Meine Produkte · ${active.length}</div>
  <div class="card"><div class="list">${active.map(suppItem).join('')}</div></div>
  ${archived.length ? `<details class="card"><summary class="row between"><span class="label">Archiviert · ${archived.length}</span>${icon('down', 'sm')}</summary><div class="list mt">${archived.map(suppItem).join('')}</div></details>` : ''}
  <div class="section">Verlauf · 14 Tage</div>
  <div class="card"><div class="list">${adherenceRange(S, addDays(k, -13), k, now).days.reverse().map((d) => `<div class="kv"><span class="muted">${relDay(d.date)}</span><span>${d.scheduled ? `${d.taken}/${d.scheduled}${d.skipped ? ` · ${d.skipped} übersprungen` : ''}` : '<span class="faint">–</span>'}</span></div>`).join('')}</div></div>
  <div class="grid2"><button type="button" class="btn" data-a="go" data-v="day">${icon('list', 'sm')} Tagesplan</button><button type="button" class="btn" data-a="go" data-v="reminders">${icon('clock', 'sm')} Erinnerungen</button></div>`
  : `<div class="card empty-card" data-tour="supps">${icon('pill', 'lg')}<div style="font-weight:600;margin-bottom:4px">Noch keine Supplements</div><div class="empty">Leg jedes Produkt an, das du nimmst – mit deiner eigenen Menge, Uhrzeit und deinen Wochentagen.</div><div class="mt"><button type="button" class="btn primary" data-a="newSupp">${icon('plus', 'sm')} Erstes Supplement</button></div></div>
  ${archived.length ? `<div class="card"><div class="list">${archived.map(suppItem).join('')}</div></div>` : ''}`}`;
}
registerView('supps', view, 'home');

const schedText = (s) => (s.schedule || []).map((sc) => {
  const days = (sc.days || []).length === 7 ? 'täglich' : WD_ORDER.filter((d) => sc.days.includes(d)).map((d) => WD[d]).join(' ');
  const when = validTime(sc.time) ? sc.time : sc.meal ? `mit ${app.S.mealSlots.find((x) => x.id === sc.meal)?.name || 'Mahlzeit'}` : '';
  const amt = sc.amount ?? s.serving;
  return `${when}${amt != null ? ` · ${fmt(Number(amt), 2)} ${s.unit}` : ''} · ${days}`;
}).join('<br>');
function suppItem(s) {
  const st = stockInfo(s);
  return `<button type="button" class="item" data-a="editSupp" data-id="${s.id}">
    ${s.image ? `<img data-photo="${s.image}" alt="" class="supp-img">` : `<span class="supp-img ph">${icon('pill', 'sm')}</span>`}
    <div class="grow"><b>${esc(s.name)}</b>${s.brand ? ` <span class="faint small">${esc(s.brand)}</span>` : ''}<div class="muted tiny">${esc(s.category)}${s.schedule.length ? '' : ' · ohne festen Zeitplan'}</div>${s.schedule.length ? `<div class="faint tiny" style="margin-top:2px">${schedText(s)}</div>` : ''}</div>
    <div class="r">${st ? `<span class="small ${st.low ? 'gold' : 'muted'}">${fmt(st.stock, 2)} ${esc(s.unit)}</span>${st.daysLeft != null ? `<div class="faint tiny">~${st.daysLeft} Tage</div>` : ''}` : ''}</div>${icon('right', 'chev')}</button>`;
}

// ---------- Editor ----------
let draft = null;
const blankSched = () => ({ id: uid(), time: '08:00', amount: null, days: [0, 1, 2, 3, 4, 5, 6], meal: null, remind: true, since: dkey() });
function editor() {
  const d = draft, slots = app.S.mealSlots;
  return `<h2>${d.isNew ? 'Neues Supplement' : 'Supplement bearbeiten'}</h2><div id="suForm">
    <div class="row top" style="gap:12px">
      <label class="supp-pic">${d.image ? `<img data-photo="${d.image}" alt="Produktbild">` : `${icon('camera')}<span class="tiny">Foto</span>`}<input type="file" accept="image/*" data-c="suppImg" hidden></label>
      <div class="grow"><label class="field"><span>Name</span><input name="name" value="${esc(d.name)}" placeholder="z. B. Kreatin Monohydrat" autocomplete="off"></label>
        <label class="field"><span>Marke (optional)</span><input name="brand" value="${esc(d.brand)}" autocomplete="off"></label></div>
    </div>
    <div class="grid2"><label class="field"><span>Kategorie</span><select name="category">${SUPP_CATEGORIES.map((c) => `<option ${c === d.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label class="field"><span>Einheit</span><select name="unit">${SUPP_UNITS.map((u) => `<option ${u === d.unit ? 'selected' : ''}>${u}</option>`).join('')}${SUPP_UNITS.includes(d.unit) ? '' : `<option selected>${esc(d.unit)}</option>`}</select></label></div>
    <div class="grid3"><label class="field"><span>Portion</span><input name="serving" inputmode="decimal" value="${d.serving ?? ''}" placeholder="z. B. 5"></label>
      <label class="field"><span>Vorrat</span><input name="stock" inputmode="decimal" value="${d.stock ?? ''}" placeholder="optional"></label>
      <label class="field"><span>Mindestens</span><input name="minStock" inputmode="decimal" value="${d.minStock ?? ''}" placeholder="optional"></label></div>
    <label class="field"><span>Notizen</span><textarea name="notes" placeholder="z. B. mit viel Wasser">${esc(d.notes)}</textarea></label>
    <div class="label" style="margin:6px 0 10px">Zeitplan</div>
    ${d.schedule.map((sc, i) => `<div class="plan-ex">
      <div class="row"><input type="time" data-sch="${i}" data-f="time" value="${validTime(sc.time) ? sc.time : ''}" style="max-width:130px" aria-label="Uhrzeit">
        <input inputmode="decimal" data-sch="${i}" data-f="amount" value="${sc.amount ?? ''}" placeholder="Menge" style="max-width:110px" aria-label="Menge"><span class="unit">${esc(d.unit)}</span>
        <button type="button" class="icon-btn sm plain" style="margin-left:auto" data-a="delSched" data-i="${i}" aria-label="Einnahme entfernen">${icon('x', 'sm')}</button></div>
      <div class="chips" style="margin-top:8px">${WD_ORDER.map((w) => `<button type="button" class="chip ${sc.days.includes(w) ? 'on' : ''}" data-a="schedDay" data-i="${i}" data-w="${w}">${WD[w]}</button>`).join('')}</div>
      <div class="row mt"><select data-sch="${i}" data-f="meal" aria-label="Mit Mahlzeit"><option value="">Ohne Mahlzeit</option>${slots.map((m) => `<option value="${m.id}" ${sc.meal === m.id ? 'selected' : ''}>mit ${esc(m.name)} (${m.time})</option>`).join('')}</select>
        <label class="check" style="white-space:nowrap"><input type="checkbox" data-sch="${i}" data-f="remind" ${sc.remind !== false ? 'checked' : ''}> Erinnern</label></div>
      <div class="faint tiny" style="margin-top:6px">Ohne Uhrzeit, aber mit Mahlzeit: folgt der Uhrzeit der Mahlzeit.</div>
    </div>`).join('')}
    <button type="button" class="btn sm" data-a="addSched">${icon('plus', 'sm')} Einnahme-Zeit</button>
    <p class="faint tiny">Mengen und Zeiten legst nur du fest – das ist eine Erinnerung, keine Empfehlung. Bei Fragen zur Dosierung: Arzt oder Apotheke.</p></div>
    <button type="button" class="btn primary block xl" data-a="saveSupp">Speichern</button>
    ${d.isNew ? '' : `<div class="grid2 mt"><button type="button" class="btn" data-a="archiveSupp">${icon('download', 'sm')} ${d.archived ? 'Reaktivieren' : 'Archivieren'}</button><button type="button" class="btn danger" data-a="delSupp">${icon('trash', 'sm')} Löschen</button></div>`}`;
}
const syncDraft = () => {
  const root = $('#suForm'); if (!root) return;
  Object.assign(draft, formVals(root));
  root.querySelectorAll('[data-sch]').forEach((el) => { const sc = draft.schedule[+el.dataset.sch]; const f = el.dataset.f; sc[f] = el.type === 'checkbox' ? el.checked : f === 'meal' ? el.value || null : el.value; });
};
A.newSupp = () => { draft = { isNew: true, id: uid(), name: '', brand: '', category: 'Sonstiges', unit: 'Kapseln', serving: '', notes: '', image: null, stock: '', minStock: '', archived: false, schedule: [] }; openSheet(editor); };
A.editSupp = (el) => { draft = structuredClone(app.S.supps.find((x) => x.id === el.dataset.id)); openSheet(editor); };
A.addSched = () => { syncDraft(); const sc = blankSched(); sc.amount = draft.serving === '' ? null : draft.serving; draft.schedule.push(sc); openSheet(editor); };
A.delSched = (el) => { syncDraft(); draft.schedule.splice(+el.dataset.i, 1); openSheet(editor); };
A.schedDay = (el) => { syncDraft(); const sc = draft.schedule[+el.dataset.i], w = +el.dataset.w; sc.days = sc.days.includes(w) ? sc.days.filter((x) => x !== w) : [...sc.days, w]; openSheet(editor); };
C.suppImg = async (el) => {
  const file = el.files?.[0]; el.value = '';
  if (!file) return;
  syncDraft();
  try {
    const blob = await compressImage(file, 600);
    const id = 'supp-' + uid();
    await photoDB.set(id, blob);
    if (draft.image) photoDB.del(draft.image).catch(() => {});
    draft.image = id;
    openSheet(editor);
  } catch (e) { toast('Bild fehlgeschlagen: ' + e.message, true); }
};
A.saveSupp = () => {
  syncDraft();
  const root = $('#suForm');
  if (!draft.name.trim()) return markInvalid(root, 'name', 'Name fehlt');
  const num = (v, label, min = 0) => { const r = validate(v, { min, max: 100000, required: false, label }); return r; };
  const out = {};
  for (const [f, label] of [['serving', 'Portion'], ['stock', 'Vorrat'], ['minStock', 'Mindestbestand']]) { const r = num(draft[f], label); if (!r.ok) return markInvalid(root, f, r.error); out[f] = r.value; }
  const schedule = [];
  for (const [i, sc] of draft.schedule.entries()) {
    if (!sc.days.length) return toast(`Einnahme ${i + 1}: mindestens einen Wochentag wählen`, true);
    if (!validTime(sc.time) && !sc.meal) return toast(`Einnahme ${i + 1}: Uhrzeit oder Mahlzeit wählen`, true);
    const a = num(sc.amount, 'Menge');
    if (!a.ok) return toast(`Einnahme ${i + 1}: ${a.error}`, true);
    schedule.push({ id: sc.id, time: validTime(sc.time) ? sc.time : '', amount: a.value, days: sc.days.slice().sort(), meal: sc.meal || null, remind: sc.remind !== false, since: sc.since || dkey() });
  }
  const data = { id: draft.id, name: draft.name.trim(), brand: (draft.brand || '').trim(), category: draft.category, unit: draft.unit, serving: out.serving, notes: (draft.notes || '').trim(), image: draft.image || null, stock: out.stock, minStock: out.minStock, archived: !!draft.archived, schedule };
  const i = app.S.supps.findIndex((x) => x.id === data.id);
  if (i >= 0) app.S.supps[i] = data; else app.S.supps.push(data);
  draft = null;
  closeSheet(); commit(); toast('Gespeichert');
};
A.archiveSupp = () => { const s = app.S.supps.find((x) => x.id === draft.id); s.archived = !s.archived; closeSheet(); commit(); toast(s.archived ? 'Archiviert – Verlauf bleibt erhalten' : 'Reaktiviert'); };
A.delSupp = () => {
  const s = app.S.supps.find((x) => x.id === draft.id);
  if (!confirm(`„${s.name}“ endgültig löschen? Tipp: „Archivieren“ behält den Verlauf.`)) return;
  app.S.supps = app.S.supps.filter((x) => x.id !== s.id);
  for (const day of Object.values(app.S.intakes)) for (const k of Object.keys(day)) if (k.startsWith(s.id + ':')) delete day[k];
  if (s.image) photoDB.del(s.image).catch(() => {});
  closeSheet(); commit();
};
export { shortDate, save };
