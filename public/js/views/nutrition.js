// Ernährung: Tagesübersicht, schnelles Eintragen, gespeicherte Mahlzeiten, Lebensmittel, Verlauf.
import { app, A, I, registerView, commit, save, openSheet, closeSheet, toast } from '../core.js';
import { dkey, addDays, sumMacros, macrosFor, kcalFromMacros, validate, LIMITS, num, r0, r1, searchFoods } from '../logic.js';
import { $, esc, fmt, icon, bar, mtxt, relDay, formVals, markInvalid, plural } from '../ui.js';
import { entries, slotName } from '../domain.js';
import { slotsFor, planMacros, timeline, validTime } from '../schedule.js';
import { statusPill, isFlash } from '../routine.js';
import { planTab, shopTab } from './mealplan.js';
import { uid } from '../store.js';
import { startScan } from '../scanner.js';

// ---------- Tagesansicht ----------
const FOOD_TABS = [['today', 'Heute'], ['plan', 'Wochenplan'], ['shop', 'Einkauf']];
function view(params) {
  const tab = params.tab || 'today';
  const head = `<div class="topbar"><h1>Ernährung</h1>${tab === 'today' ? `<div class="row"><button type="button" class="icon-btn sm" data-a="dateShift" data-n="-1" aria-label="Vortag">${icon('left', 'sm')}</button><b class="num" style="min-width:86px;text-align:center">${relDay(app.ui.date)}</b><button type="button" class="icon-btn sm" data-a="dateShift" data-n="1" ${app.ui.date >= addDays(dkey(), 6) ? 'disabled' : ''} aria-label="Folgetag">${icon('right', 'sm')}</button></div>` : ''}</div>
  <div class="seg">${FOOD_TABS.map(([k, l]) => `<button type="button" class="${tab === k ? 'on' : ''}" data-a="foodTab" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (tab === 'plan') return head + planTab(params);
  if (tab === 'shop') return head + shopTab(params);
  return head + todayTab();
}
A.foodTab = (el) => { app.ui.params = { tab: el.dataset.v }; commit(); window.scrollTo(0, 0); };

function todayTab() {
  const k = app.ui.date, list = entries(k), tot = sumMacros(list), t = app.S.targets;
  const yday = entries(addDays(k, -1));
  const slots = slotsFor(app.S, k);
  const planDay = app.S.mealPlan[k] || {};
  const planned = sumMacros(slots.map((s) => planMacros(app.S, planDay[s.id])));
  const hasPlan = slots.some((s) => (planDay[s.id] || []).length);
  const ev = timeline(app.S, k).filter((e) => e.kind === 'meal');
  return `<div class="card" data-tour="food-summary">
    <div class="row between"><div><div class="label">Gegessen</div><div style="margin-top:6px"><span class="big">${fmt(tot.kcal)}</span> <span class="unit">/ ${fmt(t.kcal)} kcal</span></div></div>
      <div class="right"><div class="label">${tot.kcal > t.kcal ? 'Drüber' : 'Übrig'}</div><div class="mid ${tot.kcal > t.kcal ? 'danger-t' : 'gold'}" style="margin-top:6px">${fmt(Math.abs(t.kcal - tot.kcal))}</div></div></div>
    <div class="mt">${bar(tot.kcal, t.kcal, { thick: true })}</div>
    <div class="grid3 mt">${[['Protein', 'p'], ['Kohlenh.', 'c'], ['Fett', 'f']].map(([l, m]) => `<div><div class="label" style="margin-bottom:5px">${l}</div><div class="num small"><b>${fmt(tot[m])}</b><span class="muted"> / ${fmt(t[m])} g</span></div><div style="margin-top:6px">${bar(tot[m], t[m])}</div><div class="faint tiny" style="margin-top:4px">${tot[m] < t[m] ? `noch ${fmt(t[m] - tot[m])} g` : 'erreicht'}</div></div>`).join('')}</div>
    ${hasPlan ? `<hr class="divider"><div class="plan-cmp"><span class="meta">Geplant</span><span><b>${fmt(planned.kcal)}</b> kcal</span><span>P <b>${fmt(planned.p)}</b></span><span>K <b>${fmt(planned.c)}</b></span><span>F <b>${fmt(planned.f)}</b></span></div>` : ''}
  </div>
  ${slots.map((slot, si) => {
    const items = list.filter((e) => e.slot === slot.id);
    const ys = yday.filter((e) => e.slot === slot.id);
    const plan = planDay[slot.id] || [];
    const pm = planMacros(app.S, plan);
    const e = ev.find((x) => x.id === slot.id);
    const st = sumMacros(items);
    const open = e && (e.status === 'due' || e.status === 'upcoming' || e.status === 'snoozed' || e.status === 'open');
    return `<div class="card meal-card ${e?.status === 'done' ? 'is-done' : ''} ${isFlash('meal:' + slot.id) ? 'flash' : ''}">
      <div class="card-h"><div class="row"><button type="button" class="time-chip ${slot.override ? 'ovr' : ''}" data-a="mealTime" data-slot="${slot.id}" data-date="${k}" aria-label="Uhrzeit ändern"${si === 0 ? ' data-tour="meal-time"' : ''}>${slot.time}</button><b>${esc(slot.name)}</b>${e ? statusPill(e.status) : ''}</div>
        <div class="row">${items.length ? `<span class="muted small num">${fmt(st.kcal)} kcal</span>` : ''}<button type="button" class="icon-btn sm plain" data-a="slotMenu" data-slot="${slot.id}" aria-label="Optionen">${icon('more', 'sm')}</button></div></div>
      ${plan.length ? `<div class="planned"><div class="row between"><span class="meta">Geplant${pm.known ? ` · ${fmt(pm.kcal)} kcal · P ${fmt(pm.p)}` : ''}</span>${pm.known < pm.total ? `<span class="faint tiny">${pm.total - pm.known} ohne Nährwerte</span>` : ''}</div><div class="small" style="margin-top:4px">${plan.map((it) => `${esc(it.name)} <span class="muted">${fmt(Number(it.qty), 2)} ${esc(it.unit)}</span>`).join(' · ')}</div></div>` : ''}
      ${items.length ? `<div class="list">${items.map((x) => `<button type="button" class="item" data-a="editEntry" data-id="${x.id}"><div class="grow"><b>${esc(x.name)}</b>${x.fromPlan ? ' <span class="pill">Plan</span>' : ''}<div>${mtxt(x)}</div></div><div class="r muted small">${x.amount ? fmt(x.amount) + ' g' : ''}</div></button>`).join('')}</div>` : ''}
      <div class="row wrap" style="margin-top:10px">
        ${open ? `<button type="button" class="btn sm ${plan.length && !items.length ? 'primary' : 'outline'}" data-a="mealDone" data-slot="${slot.id}" data-date="${k}">${icon('check', 'sm')} ${plan.length && !items.length ? 'Wie geplant gegessen' : 'Gegessen'}</button>` : e?.status === 'done' ? `<button type="button" class="btn sm ghost" data-a="mealUndo" data-slot="${slot.id}" data-date="${k}">${icon('repeat', 'sm')} Nicht gegessen</button>` : e?.status === 'skipped' ? `<button type="button" class="btn sm ghost" data-a="mealUndo" data-slot="${slot.id}" data-date="${k}">Doch nicht übersprungen</button>` : ''}
        <button type="button" class="btn sm" data-a="addFood" data-slot="${slot.id}"${si === 0 ? ' data-tour="add-food"' : ''}>${icon('plus', 'sm')} Hinzufügen</button>
        ${!items.length && ys.length ? `<button type="button" class="btn sm ghost" data-a="copySlot" data-slot="${slot.id}">${icon('repeat', 'sm')} Wie gestern · ${fmt(sumMacros(ys).kcal)} kcal</button>` : ''}
        ${open && !items.length ? `<button type="button" class="btn sm ghost" data-a="mealSkip" data-slot="${slot.id}" data-date="${k}">Überspringen</button>` : ''}</div>
    </div>`;
  }).join('')}
  <div class="grid2 mb"><button type="button" class="btn" data-a="manageSlots">${icon('clock', 'sm')} Mahlzeiten verwalten</button><button type="button" class="btn" data-a="go" data-v="foods">${icon('book', 'sm')} Lebensmittel</button></div>
  <button type="button" class="btn block mb" data-a="copyDay">${icon('repeat', 'sm')} Ganzen Vortag kopieren</button>
  ${historyCard()}`;
}
registerView('food', view, 'food');

// Mahlzeiten verwalten: eigene Mahlzeiten mit Standard-Uhrzeit (Reihenfolge = Uhrzeit)
let slotDraft = null;
function slotsSheet() {
  return `<h2>Mahlzeiten verwalten</h2><p class="muted small" style="margin-top:-6px">Name und Standard-Uhrzeit. Die Reihenfolge ergibt sich aus der Uhrzeit; einzelne Tage verschiebst du direkt an der Mahlzeit.</p>
    <div id="slForm">${slotDraft.map((s, i) => `<div class="row mb"><input type="time" data-sl="${i}" data-f="time" value="${s.time}" style="max-width:120px" aria-label="Uhrzeit"><input class="grow" data-sl="${i}" data-f="name" value="${esc(s.name)}" aria-label="Name" maxlength="40">
      <button type="button" class="icon-btn sm" data-a="dupSlot" data-i="${i}" aria-label="Duplizieren">${icon('copy', 'sm')}</button><button type="button" class="icon-btn sm" data-a="delSlot" data-i="${i}" aria-label="Löschen" ${slotDraft.length <= 1 ? 'disabled' : ''}>${icon('trash', 'sm')}</button></div>`).join('')}</div>
    <button type="button" class="btn sm" data-a="addSlot">${icon('plus', 'sm')} Mahlzeit</button>
    <button type="button" class="btn primary block xl mt" data-a="saveSlots">Speichern</button>`;
}
const syncSlots = () => document.querySelectorAll('#slForm [data-sl]').forEach((el) => { slotDraft[+el.dataset.sl][el.dataset.f] = el.value; });
A.manageSlots = () => { slotDraft = structuredClone(app.S.mealSlots).sort((a, b) => a.time.localeCompare(b.time)); openSheet(slotsSheet); };
A.addSlot = () => { syncSlots(); slotDraft.push({ id: 'slot_' + uid(), name: 'Neue Mahlzeit', time: '15:00' }); openSheet(slotsSheet); };
A.dupSlot = (el) => { syncSlots(); const s = slotDraft[+el.dataset.i]; slotDraft.splice(+el.dataset.i + 1, 0, { id: 'slot_' + uid(), name: s.name + ' 2', time: s.time }); openSheet(slotsSheet); };
A.delSlot = (el) => { syncSlots(); slotDraft.splice(+el.dataset.i, 1); openSheet(slotsSheet); };
A.saveSlots = () => {
  syncSlots();
  for (const s of slotDraft) { if (!s.name.trim()) return toast('Jede Mahlzeit braucht einen Namen', true); if (!validTime(s.time)) return toast(`${s.name}: Uhrzeit ungültig`, true); s.name = s.name.trim(); }
  const keep = new Set(slotDraft.map((s) => s.id));
  const removed = app.S.mealSlots.filter((s) => !keep.has(s.id));
  if (removed.length) {
    const target = slotDraft.slice().sort((a, b) => a.time.localeCompare(b.time))[0];
    const used = removed.filter((r) => Object.values(app.S.meals).some((l) => l.some((e) => e.slot === r.id)) || Object.values(app.S.mealPlan).some((d) => (d[r.id] || []).length));
    if (used.length && !confirm(`${used.map((r) => r.name).join(', ')} enthält Einträge. Diese werden zu „${target.name}“ verschoben. Fortfahren?`)) return;
    for (const r of removed) {
      for (const l of Object.values(app.S.meals)) l.forEach((e) => { if (e.slot === r.id) e.slot = target.id; });
      for (const d of Object.values(app.S.mealPlan)) if (d[r.id]) { d[target.id] = [...(d[target.id] || []), ...d[r.id]]; delete d[r.id]; }
      for (const d of Object.values(app.S.mealDays)) delete d[r.id];
      app.S.supps.forEach((s) => s.schedule.forEach((sc) => { if (sc.meal === r.id) { sc.meal = null; if (!validTime(sc.time)) sc.time = r.time; } }));
    }
  }
  app.S.mealSlots = slotDraft;
  slotDraft = null;
  closeSheet(); commit(); toast('Mahlzeiten gespeichert');
};

function historyCard() {
  const t = app.S.targets, today = dkey();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i)).map((k) => ({ k, ...sumMacros(entries(k)), n: entries(k).length }));
  const logged = days.filter((d) => d.n);
  if (!logged.length) return '';
  const avg = sumMacros(logged.map((d) => d));
  const n = logged.length;
  return `<div class="section">Verlauf · 14 Tage</div><div class="card">
    <div class="grid2 mb"><div class="stat"><div class="label">Ø Kalorien</div><div class="v">${fmt(avg.kcal / n)}</div><div class="s">an ${plural(n, 'Tag', 'Tagen')} mit Einträgen</div></div><div class="stat"><div class="label">Ø Protein</div><div class="v">${fmt(avg.p / n)} g</div><div class="s">Ziel ${fmt(t.p)} g</div></div></div>
    <div class="list">${days.map((d) => `<button type="button" class="item" data-a="openDay" data-k="${d.k}" style="padding:9px 0"><span class="small" style="width:76px">${relDay(d.k)}</span><div class="grow">${d.n ? bar(d.kcal, t.kcal) : '<span class="faint tiny">keine Einträge</span>'}</div><span class="r small num" style="width:92px">${d.n ? `${fmt(d.kcal)} · P ${fmt(d.p)}` : ''}</span></button>`).join('')}</div></div>`;
}
A.dateShift = (el) => { const n = addDays(app.ui.date, +el.dataset.n); if (n <= addDays(dkey(), 6)) { app.ui.date = n; commit(); } };
A.openDay = (el) => { app.ui.date = el.dataset.k; commit(); window.scrollTo(0, 0); };

// ---------- Eintragen ----------
let pick = null; // { slot, q, food, amount, mode }
const addEntry = (slot, e) => { (app.S.meals[app.ui.date] = app.S.meals[app.ui.date] || []).push({ ...e, id: uid(), slot }); };
export function currentPick() { return pick; }
// Auswahl endet erst, wenn das Sheet ganz geschlossen wird (nicht beim Wechsel zu Scanner/Neu)
document.addEventListener('sheet-closed', () => { pick = null; });

function pickerSheet() {
  if (pick.mode === 'quick') return quickSheet();
  if (pick.food) return amountSheet();
  const meals = app.S.savedMeals;
  return `<div class="pick-head" data-tall><h2>${esc(slotName(pick.slot))}</h2>
    <input id="pickQ" type="search" data-i="pickQ" placeholder="${app.S.foods.length} Lebensmittel durchsuchen …" value="${esc(pick.q)}" autocomplete="off" enterkeyhint="search">
    <div class="grid3" style="margin:10px 0 4px"><button type="button" class="btn sm" data-a="scan">${icon('barcode', 'sm')} Scannen</button><button type="button" class="btn sm" data-a="quickMode">${icon('bolt', 'sm')} Makros</button><button type="button" class="btn sm" data-a="newFood">${icon('plus', 'sm')} Neu</button></div></div>
    ${meals.length ? `<div class="label" style="margin:14px 0 4px">Gespeicherte Mahlzeiten</div><div class="list">${meals.map((m) => `<button type="button" class="item" data-a="addSavedMeal" data-id="${m.id}"><div class="grow"><b>${esc(m.name)}</b><div>${mtxt(sumMacros(m.items))}</div></div><span class="muted tiny">${m.items.length} Teile</span>${icon('plus', 'chev')}</button>`).join('')}</div>` : ''}
    <div class="label" id="pickLbl" style="margin:14px 0 4px">${pick.q.trim() ? 'Suchergebnisse' : 'Favoriten &amp; zuletzt genutzt'}</div>
    <div class="list" id="pickList">${pickList()}</div>`;
}
function pickList() {
  const list = searchFoods(app.S.foods, pick.q);
  if (!list.length) return `<div class="empty-pick"><div class="muted small">Nichts gefunden für „${esc(pick.q.trim())}“.</div>
    <div class="grid2" style="margin-top:10px"><button type="button" class="btn sm primary" data-a="newFood">${icon('plus', 'sm')} Anlegen</button><button type="button" class="btn sm" data-a="quickMode">${icon('bolt', 'sm')} Nur Makros</button></div></div>`;
  return list.slice(0, 60).map((f) => `<button type="button" class="item" data-a="pickFood" data-id="${f.id}"><div class="grow"><b>${f.fav ? '<span class="gold">★</span> ' : ''}${esc(f.name)}</b><div>${mtxt(f)} <span class="faint tiny">/100 g</span></div></div>${icon('right', 'chev')}</button>`).join('');
}
function amountSheet() {
  const f = app.S.foods.find((x) => x.id === pick.food);
  if (!f) { pick.food = null; return pickerSheet(); }
  const m = macrosFor(f, num(pick.amount));
  const amounts = [...new Set([f.portion, 50, 100, 150, 200, 250].filter((x) => x > 0))].sort((a, b) => a - b);
  return `<h2>${esc(f.name)}</h2><p class="muted small" style="margin-top:-6px">${mtxt(f)} je 100 g</p>
    <label class="field"><span>Menge in Gramm</span><input id="pickAmt" type="text" inputmode="decimal" data-i="pickAmt" value="${esc(pick.amount)}" autocomplete="off"></label>
    <div class="chips mb">${amounts.map((a) => `<button type="button" class="chip ${num(pick.amount) === a ? 'on' : ''}" data-a="pickAmount" data-v="${a}">${a} g${a === f.portion ? ' · Portion' : ''}</button>`).join('')}</div>
    <div class="card elev" id="pickPrev">${mtxt(m)}</div>
    <button type="button" class="btn primary block xl" data-a="pickAdd">Zu ${esc(slotName(pick.slot))} hinzufügen</button>
    <button type="button" class="btn ghost block mt" data-a="pickBack">${icon('left', 'sm')} Zurück</button>`;
}
function quickSheet() {
  return `<h2>Schnell eintragen · ${esc(slotName(pick.slot))}</h2><div id="quickForm">
    <label class="field"><span>Bezeichnung</span><input name="name" placeholder="z. B. Restaurant, Döner …"></label>
    <div class="grid2"><label class="field"><span>Kalorien</span><input name="kcal" inputmode="decimal" placeholder="leer = aus Makros"></label><label class="field"><span>Protein g</span><input name="p" inputmode="decimal"></label><label class="field"><span>Kohlenhydrate g</span><input name="c" inputmode="decimal"></label><label class="field"><span>Fett g</span><input name="f" inputmode="decimal"></label></div></div>
    <button type="button" class="btn primary block xl" data-a="quickAdd">Hinzufügen</button>
    <button type="button" class="btn ghost block mt" data-a="pickBack">${icon('left', 'sm')} Zurück</button>`;
}
export function openPicker(slot) { pick = { slot, q: '', food: null, amount: '', mode: 'list' }; openSheet(pickerSheet); }
export function showPickerWithFood(foodId) { if (!pick) return false; const f = app.S.foods.find((x) => x.id === foodId); pick.food = foodId; pick.mode = 'list'; pick.amount = String(f?.portion || 100); openSheet(pickerSheet); return true; }
A.addFood = (el) => openPicker(el.dataset.slot);
I.pickQ = (el) => { pick.q = el.value; $('#pickList').innerHTML = pickList(); $('#pickLbl').innerHTML = pick.q.trim() ? 'Suchergebnisse' : 'Favoriten &amp; zuletzt genutzt'; };
A.pickFood = (el) => { const f = app.S.foods.find((x) => x.id === el.dataset.id); pick.food = f.id; pick.amount = String(f.portion || 100); openSheet(pickerSheet); };
A.pickAmount = (el) => { pick.amount = el.dataset.v; openSheet(pickerSheet); };
I.pickAmt = (el) => { pick.amount = el.value; const f = app.S.foods.find((x) => x.id === pick.food); $('#pickPrev').innerHTML = mtxt(macrosFor(f, num(el.value))); };
A.pickBack = () => { if (!pick) return closeSheet(); pick.food = null; pick.mode = 'list'; openSheet(pickerSheet); };
A.quickMode = () => { pick.mode = 'quick'; openSheet(pickerSheet); };
A.pickAdd = () => {
  const f = app.S.foods.find((x) => x.id === pick.food);
  const r = validate(pick.amount, { ...LIMITS.grams, min: 1 });
  if (!r.ok) { document.querySelector('#pickAmt')?.classList.add('invalid'); return toast(r.error, true); }
  const per = { kcal: f.kcal, p: f.p, c: f.c, f: f.f };
  addEntry(pick.slot, { name: f.name, foodId: f.id, amount: r.value, per, ...macrosFor(per, r.value) });
  f.used = Date.now();
  const slot = pick.slot;
  closeSheet(); commit();
  toast(`${f.name} · ${fmt(r.value)} g → ${slotName(slot)}`);
};
A.quickAdd = () => {
  const root = $('#quickForm'), v = formVals(root);
  const vals = {};
  for (const k of ['p', 'c', 'f']) { const r = validate(v[k], { ...LIMITS.macro, required: false }); if (!r.ok) return markInvalid(root, k, r.error); vals[k] = r.value || 0; }
  const kr = validate(v.kcal, { ...LIMITS.kcal, required: false });
  if (!kr.ok) return markInvalid(root, 'kcal', kr.error);
  const kcal = kr.value ?? kcalFromMacros(vals.p, vals.c, vals.f);
  if (!kcal) return markInvalid(root, 'kcal', 'Kalorien oder Makros eintragen');
  addEntry(pick.slot, { name: v.name.trim() || 'Schnelleintrag', amount: null, per: null, kcal, ...vals });
  closeSheet(); commit();
};
A.addSavedMeal = (el) => {
  const m = app.S.savedMeals.find((x) => x.id === el.dataset.id);
  m.items.forEach((it) => addEntry(pick.slot, structuredClone({ ...it, id: undefined })));
  m.used = Date.now();
  const slot = pick.slot;
  closeSheet(); commit();
  toast(`${m.name} → ${slotName(slot)}`);
};

// Einträge bearbeiten
function entrySheet(id) {
  return () => {
    const e = entries(app.ui.date).find((x) => x.id === id);
    if (!e) return '<div class="empty">Eintrag nicht gefunden.</div>';
    return `<h2>${esc(e.name)}</h2><div id="entryForm">
      ${e.per ? `<label class="field"><span>Menge in Gramm</span><input name="amount" inputmode="decimal" value="${e.amount}"></label>`
      : `<div class="grid2"><label class="field"><span>Kalorien</span><input name="kcal" inputmode="decimal" value="${r0(e.kcal)}"></label><label class="field"><span>Protein g</span><input name="p" inputmode="decimal" value="${r1(e.p || 0)}"></label><label class="field"><span>Kohlenhydrate g</span><input name="c" inputmode="decimal" value="${r1(e.c || 0)}"></label><label class="field"><span>Fett g</span><input name="f" inputmode="decimal" value="${r1(e.f || 0)}"></label></div>`}
      <label class="field"><span>Mahlzeit</span><select name="slot">${slotsFor(app.S, app.ui.date).map((s) => `<option value="${s.id}" ${s.id === e.slot ? 'selected' : ''}>${esc(s.name)} (${s.time})</option>`).join('')}</select></label></div>
      <p>${mtxt(e)}</p>
      <button type="button" class="btn primary block xl" data-a="saveEntry" data-id="${id}">Speichern</button>
      <div class="grid2 mt"><button type="button" class="btn" data-a="dupEntry" data-id="${id}">${icon('copy', 'sm')} Duplizieren</button><button type="button" class="btn danger" data-a="delEntry" data-id="${id}">${icon('trash', 'sm')} Löschen</button></div>`;
  };
}
A.editEntry = (el) => openSheet(entrySheet(el.dataset.id));
A.saveEntry = (el) => {
  const e = entries(app.ui.date).find((x) => x.id === el.dataset.id);
  const root = $('#entryForm'), v = formVals(root);
  if (e.per) {
    const r = validate(v.amount, { ...LIMITS.grams, min: 1 });
    if (!r.ok) return markInvalid(root, 'amount', r.error);
    e.amount = r.value; Object.assign(e, macrosFor(e.per, r.value));
  } else {
    const out = {};
    for (const [k, lim] of [['kcal', LIMITS.kcal], ['p', LIMITS.macro], ['c', LIMITS.macro], ['f', LIMITS.macro]]) { const r = validate(v[k], lim); if (!r.ok) return markInvalid(root, k, r.error); out[k] = r.value; }
    Object.assign(e, out);
  }
  e.slot = v.slot;
  closeSheet(); commit();
};
A.dupEntry = (el) => { const e = entries(app.ui.date).find((x) => x.id === el.dataset.id); app.S.meals[app.ui.date].push({ ...structuredClone(e), id: uid() }); closeSheet(); commit(); toast('Dupliziert'); };
A.delEntry = (el) => { app.S.meals[app.ui.date] = entries(app.ui.date).filter((x) => x.id !== el.dataset.id); closeSheet(); commit(); };
A.copySlot = (el) => {
  const slot = el.dataset.slot;
  entries(addDays(app.ui.date, -1)).filter((e) => e.slot === slot).forEach((e) => addEntry(slot, { ...structuredClone(e), id: undefined, slot: undefined }));
  commit(); toast(`${slotName(slot)} wie gestern übernommen`);
};
A.copyDay = () => {
  const y = entries(addDays(app.ui.date, -1));
  if (!y.length) return toast('Am Vortag ist nichts eingetragen');
  if (!confirm(`${plural(y.length, 'Eintrag', 'Einträge')} vom Vortag übernehmen?`)) return;
  y.forEach((e) => addEntry(e.slot, { ...structuredClone(e), id: undefined, slot: undefined }));
  commit();
};
// Mahlzeit speichern / verschieben / leeren
A.slotMenu = (el) => {
  const slot = el.dataset.slot;
  openSheet(() => `<h2>${esc(slotName(slot))}</h2>
    <div id="smForm"><label class="field"><span>Als Mahlzeit speichern</span><input name="name" placeholder="z. B. Mein Frühstück" value="${esc('Mein ' + slotName(slot))}"></label></div>
    <button type="button" class="btn primary block" data-a="saveMeal" data-slot="${slot}">${icon('star', 'sm')} Speichern</button>
    <p class="faint tiny">Gespeicherte Mahlzeiten trägst du später mit einem Tipp in jede Mahlzeit ein.</p>
    <button type="button" class="btn block mt" data-a="mealTime" data-slot="${slot}" data-date="${app.ui.date}">${icon('clock', 'sm')} Uhrzeit für diesen Tag</button>
    <button type="button" class="btn danger block mt" data-a="clearSlot" data-slot="${slot}">${icon('trash', 'sm')} ${esc(slotName(slot))} leeren</button>`);
};
A.saveMeal = (el) => {
  const root = $('#smForm'), name = formVals(root).name.trim();
  if (!name) return markInvalid(root, 'name', 'Name fehlt');
  const items = entries(app.ui.date).filter((e) => e.slot === el.dataset.slot).map((e) => { const c = structuredClone(e); delete c.id; delete c.slot; delete c.fromPlan; return c; });
  app.S.savedMeals.push({ id: uid(), name, items, used: Date.now() });
  closeSheet(); commit(); toast(`„${name}“ gespeichert`);
};
A.clearSlot = (el) => { if (!confirm(`Alle Einträge in ${slotName(el.dataset.slot)} löschen?`)) return; app.S.meals[app.ui.date] = entries(app.ui.date).filter((e) => e.slot !== el.dataset.slot); closeSheet(); commit(); };

// ---------- Lebensmittel & Mahlzeiten verwalten ----------
let foodsQ = '';
const foodItems = (list) => list.map((f) => `<button type="button" class="item" data-a="editFood" data-id="${f.id}"><div class="grow"><b>${f.fav ? '<span class="gold">★</span> ' : ''}${esc(f.name)}</b><div>${mtxt(f)} <span class="faint tiny">/100 g</span></div></div>${icon('right', 'chev')}</button>`).join('') || '<div class="empty">Nichts gefunden.</div>';
I.foodsQ = (el) => { foodsQ = el.value; $('#foodsList').innerHTML = foodItems(searchFoods(app.S.foods, foodsQ)); };
function foodsView() {
  const foods = searchFoods(app.S.foods, foodsQ);
  return `<div class="topbar"><button type="button" class="back" data-a="back">${icon('left', 'sm')} Ernährung</button><div class="row"><button type="button" class="btn sm" data-a="scan">${icon('barcode', 'sm')} Scannen</button><button type="button" class="btn primary sm" data-a="newFood">${icon('plus', 'sm')} Neu</button></div></div>
  <h1 class="mb">Lebensmittel</h1>
  ${app.S.savedMeals.length ? `<div class="section">Gespeicherte Mahlzeiten</div><div class="card"><div class="list">${app.S.savedMeals.map((m) => `<div class="item"><div class="grow"><b>${esc(m.name)}</b><div>${mtxt(sumMacros(m.items))}</div><div class="faint tiny">${esc(m.items.map((i) => i.name).join(', '))}</div></div><button type="button" class="icon-btn sm" data-a="delMeal" data-id="${m.id}" aria-label="Löschen">${icon('trash', 'sm')}</button></div>`).join('')}</div></div>` : ''}
  <div class="section">Meine Lebensmittel · ${app.S.foods.length}</div>
  <input type="search" data-i="foodsQ" value="${esc(foodsQ)}" placeholder="Suchen …" autocomplete="off" style="margin-bottom:12px">
  <div class="card"><div class="list" id="foodsList">${foodItems(foods)}</div></div>
  <p class="faint tiny center">Werte je 100 g. Mit ★ markierte stehen beim Eintragen oben. Richtwerte bitte mit der Verpackung abgleichen.</p>`;
}
registerView('foods', foodsView, 'food');
A.delMeal = (el) => { if (confirm('Gespeicherte Mahlzeit löschen?')) { app.S.savedMeals = app.S.savedMeals.filter((m) => m.id !== el.dataset.id); commit(); } };

export function foodEditSheet(id, preset = {}, note = '') {
  return () => {
    const f = app.S.foods.find((x) => x.id === id) || { name: '', kcal: '', p: '', c: '', f: '', portion: 100, fav: false, barcode: '', ...preset };
    return `<h2>${id ? 'Lebensmittel bearbeiten' : 'Neues Lebensmittel'}</h2>
      ${note ? `<div class="card elev small">${note}</div>` : ''}<div id="foodForm">
      <label class="field"><span>Name</span><input name="name" value="${esc(f.name)}" autocomplete="off"></label>
      <div class="label" style="margin-bottom:8px">Nährwerte je 100 g</div>
      <div class="grid2"><label class="field"><span>Kalorien</span><input name="kcal" inputmode="decimal" value="${f.kcal}" placeholder="leer = aus Makros"></label><label class="field"><span>Protein g</span><input name="p" inputmode="decimal" value="${f.p}"></label><label class="field"><span>Kohlenhydrate g</span><input name="c" inputmode="decimal" value="${f.c}"></label><label class="field"><span>Fett g</span><input name="f" inputmode="decimal" value="${f.f}"></label></div>
      <div class="grid2"><label class="field"><span>Portion (g)</span><input name="portion" inputmode="decimal" value="${f.portion}"></label><label class="field"><span>Barcode</span><input name="barcode" inputmode="numeric" value="${esc(f.barcode || '')}" placeholder="optional"></label></div>
      <label class="check field"><input type="checkbox" name="fav" ${f.fav ? 'checked' : ''}> <span class="gold">★</span> Favorit</label></div>
      <button type="button" class="btn primary block xl" data-a="saveFood" data-id="${id || ''}">Speichern</button>
      ${id ? `<button type="button" class="btn danger block mt" data-a="delFood" data-id="${id}">${icon('trash', 'sm')} Löschen</button>` : ''}
      ${pick ? `<button type="button" class="btn ghost block mt" data-a="pickBack">Abbrechen</button>` : ''}`;
  };
}
A.newFood = () => openSheet(foodEditSheet(null, { name: pick ? pick.q : '' }));
A.editFood = (el) => openSheet(foodEditSheet(el.dataset.id));
A.saveFood = (el) => {
  const root = $('#foodForm'), v = formVals(root);
  if (!v.name.trim()) return markInvalid(root, 'name', 'Name fehlt');
  const d = {};
  for (const [k, lim] of [['p', LIMITS.macro], ['c', LIMITS.macro], ['f', LIMITS.macro]]) { const r = validate(v[k], { ...lim, max: 100, required: false }); if (!r.ok) return markInvalid(root, k, r.error + ' (je 100 g)'); d[k] = r.value || 0; }
  if (d.p + d.c + d.f > 100.5) return markInvalid(root, 'p', 'Protein + Kohlenhydrate + Fett können zusammen nicht über 100 g je 100 g liegen');
  const kr = validate(v.kcal, { min: 0, max: 900, required: false, label: 'Kalorien je 100 g' });
  if (!kr.ok) return markInvalid(root, 'kcal', kr.error);
  const pr = validate(v.portion, { min: 1, max: 5000, required: false, label: 'Portion' });
  if (!pr.ok) return markInvalid(root, 'portion', pr.error);
  const data = { name: v.name.trim(), ...d, kcal: kr.value ?? r0(kcalFromMacros(d.p, d.c, d.f)), portion: pr.value || 100, fav: v.fav, barcode: (v.barcode || '').replace(/\D/g, '') };
  let f = app.S.foods.find((x) => x.id === el.dataset.id);
  if (f) Object.assign(f, data); else { f = { id: uid(), used: 0, ...data }; app.S.foods.push(f); }
  save();
  if (pick) { showPickerWithFood(f.id); render(); return; }
  closeSheet(); commit(); toast('Gespeichert');
};
const render = () => commit();
A.delFood = (el) => { if (confirm('Lebensmittel löschen? Bereits eingetragene Mahlzeiten bleiben erhalten.')) { app.S.foods = app.S.foods.filter((x) => x.id !== el.dataset.id); closeSheet(); commit(); } };
A.scan = () => startScan();
