// Ernährung: Tagesübersicht, schnelles Eintragen, gespeicherte Mahlzeiten, Lebensmittel, Verlauf.
import { app, A, I, registerView, commit, save, openSheet, closeSheet, toast } from '../core.js';
import { dkey, addDays, sumMacros, macrosFor, kcalFromMacros, validate, LIMITS, num, r0, r1 } from '../logic.js';
import { $, esc, fmt, icon, bar, mtxt, relDay, formVals, markInvalid, plural } from '../ui.js';
import { entries, SLOTS } from '../domain.js';
import { uid } from '../store.js';
import { startScan } from '../scanner.js';

// ---------- Tagesansicht ----------
function view() {
  const k = app.ui.date, list = entries(k), tot = sumMacros(list), t = app.S.targets;
  const yday = entries(addDays(k, -1));
  return `<div class="topbar"><h1>Ernährung</h1>
    <div class="row"><button type="button" class="icon-btn sm" data-a="dateShift" data-n="-1" aria-label="Vortag">${icon('left', 'sm')}</button><b class="num" style="min-width:86px;text-align:center">${relDay(k)}</b><button type="button" class="icon-btn sm" data-a="dateShift" data-n="1" ${k >= dkey() ? 'disabled' : ''} aria-label="Folgetag">${icon('right', 'sm')}</button></div></div>
  <div class="card">
    <div class="row between"><div><div class="label">Gegessen</div><div style="margin-top:6px"><span class="big">${fmt(tot.kcal)}</span> <span class="unit">/ ${fmt(t.kcal)} kcal</span></div></div>
      <div class="right"><div class="label">${tot.kcal > t.kcal ? 'Drüber' : 'Übrig'}</div><div class="mid ${tot.kcal > t.kcal ? 'danger-t' : 'gold'}" style="margin-top:6px">${fmt(Math.abs(t.kcal - tot.kcal))}</div></div></div>
    <div class="mt">${bar(tot.kcal, t.kcal, { thick: true })}</div>
    <div class="grid3 mt">${[['Protein', 'p'], ['Kohlenh.', 'c'], ['Fett', 'f']].map(([l, m]) => `<div><div class="label" style="margin-bottom:5px">${l}</div><div class="num small"><b>${fmt(tot[m])}</b><span class="muted"> / ${fmt(t[m])} g</span></div><div style="margin-top:6px">${bar(tot[m], t[m])}</div><div class="faint tiny" style="margin-top:4px">${tot[m] < t[m] ? `noch ${fmt(t[m] - tot[m])} g` : 'erreicht'}</div></div>`).join('')}</div>
  </div>
  ${SLOTS.map((slot) => {
    const items = list.filter((e) => e.slot === slot);
    const ys = yday.filter((e) => e.slot === slot);
    const st = sumMacros(items);
    return `<div class="card">
      <div class="card-h"><span class="t">${slot}</span><div class="row">${items.length ? `<span class="muted small num">${fmt(st.kcal)} kcal</span><button type="button" class="icon-btn sm plain" data-a="slotMenu" data-slot="${slot}" aria-label="Optionen">${icon('more', 'sm')}</button>` : ''}</div></div>
      ${items.length ? `<div class="list">${items.map((e) => `<button type="button" class="item" data-a="editEntry" data-id="${e.id}"><div class="grow"><b>${esc(e.name)}</b><div>${mtxt(e)}</div></div><div class="r muted small">${e.amount ? fmt(e.amount) + ' g' : ''}</div></button>`).join('')}</div>` : ''}
      <div class="row wrap" style="margin-top:${items.length ? 10 : 0}px"><button type="button" class="btn sm" data-a="addFood" data-slot="${slot}">${icon('plus', 'sm')} Hinzufügen</button>
        ${!items.length && ys.length ? `<button type="button" class="btn sm outline" data-a="copySlot" data-slot="${slot}">${icon('repeat', 'sm')} Wie gestern · ${fmt(sumMacros(ys).kcal)} kcal</button>` : ''}</div>
    </div>`;
  }).join('')}
  <div class="grid2 mb"><button type="button" class="btn" data-a="copyDay">${icon('repeat', 'sm')} Ganzen Vortag kopieren</button><button type="button" class="btn" data-a="go" data-v="foods">${icon('book', 'sm')} Lebensmittel</button></div>
  ${historyCard()}`;
}
registerView('food', view, 'food');

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
A.dateShift = (el) => { const n = addDays(app.ui.date, +el.dataset.n); if (n <= dkey()) { app.ui.date = n; commit(); } };
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
  return `<h2>${esc(pick.slot)}</h2>
    <input id="pickQ" data-i="pickQ" placeholder="Lebensmittel suchen …" value="${esc(pick.q)}" autocomplete="off">
    <div class="grid3" style="margin:10px 0 4px"><button type="button" class="btn sm" data-a="scan">${icon('barcode', 'sm')} Scannen</button><button type="button" class="btn sm" data-a="quickMode">${icon('bolt', 'sm')} Makros</button><button type="button" class="btn sm" data-a="newFood">${icon('plus', 'sm')} Neu</button></div>
    ${meals.length ? `<div class="label" style="margin:14px 0 4px">Gespeicherte Mahlzeiten</div><div class="list">${meals.map((m) => `<button type="button" class="item" data-a="addSavedMeal" data-id="${m.id}"><div class="grow"><b>${esc(m.name)}</b><div>${mtxt(sumMacros(m.items))}</div></div><span class="muted tiny">${m.items.length} Teile</span>${icon('plus', 'chev')}</button>`).join('')}</div>` : ''}
    <div class="label" style="margin:14px 0 4px">Favoriten &amp; zuletzt genutzt</div>
    <div class="list" id="pickList">${pickList()}</div>`;
}
function pickList() {
  const q = pick.q.trim().toLowerCase();
  const list = app.S.foods.filter((f) => !q || f.name.toLowerCase().includes(q))
    .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (b.used || 0) - (a.used || 0) || a.name.localeCompare(b.name, 'de'));
  if (!list.length) return `<div class="empty">Nichts gefunden. <button type="button" class="link" data-a="newFood">„${esc(pick.q)}“ anlegen</button></div>`;
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
    <button type="button" class="btn primary block xl" data-a="pickAdd">Zu ${esc(pick.slot)} hinzufügen</button>
    <button type="button" class="btn ghost block mt" data-a="pickBack">${icon('left', 'sm')} Zurück</button>`;
}
function quickSheet() {
  return `<h2>Schnell eintragen · ${esc(pick.slot)}</h2><div id="quickForm">
    <label class="field"><span>Bezeichnung</span><input name="name" placeholder="z. B. Restaurant, Döner …"></label>
    <div class="grid2"><label class="field"><span>Kalorien</span><input name="kcal" inputmode="decimal" placeholder="leer = aus Makros"></label><label class="field"><span>Protein g</span><input name="p" inputmode="decimal"></label><label class="field"><span>Kohlenhydrate g</span><input name="c" inputmode="decimal"></label><label class="field"><span>Fett g</span><input name="f" inputmode="decimal"></label></div></div>
    <button type="button" class="btn primary block xl" data-a="quickAdd">Hinzufügen</button>
    <button type="button" class="btn ghost block mt" data-a="pickBack">${icon('left', 'sm')} Zurück</button>`;
}
export function openPicker(slot) { pick = { slot, q: '', food: null, amount: '', mode: 'list' }; openSheet(pickerSheet); }
export function showPickerWithFood(foodId) { if (!pick) return false; const f = app.S.foods.find((x) => x.id === foodId); pick.food = foodId; pick.mode = 'list'; pick.amount = String(f?.portion || 100); openSheet(pickerSheet); return true; }
A.addFood = (el) => openPicker(el.dataset.slot);
I.pickQ = (el) => { pick.q = el.value; $('#pickList').innerHTML = pickList(); };
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
  toast(`${f.name} · ${fmt(r.value)} g → ${slot}`);
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
  toast(`${m.name} → ${slot}`);
};

// Einträge bearbeiten
function entrySheet(id) {
  return () => {
    const e = entries(app.ui.date).find((x) => x.id === id);
    if (!e) return '<div class="empty">Eintrag nicht gefunden.</div>';
    return `<h2>${esc(e.name)}</h2><div id="entryForm">
      ${e.per ? `<label class="field"><span>Menge in Gramm</span><input name="amount" inputmode="decimal" value="${e.amount}"></label>`
      : `<div class="grid2"><label class="field"><span>Kalorien</span><input name="kcal" inputmode="decimal" value="${r0(e.kcal)}"></label><label class="field"><span>Protein g</span><input name="p" inputmode="decimal" value="${r1(e.p || 0)}"></label><label class="field"><span>Kohlenhydrate g</span><input name="c" inputmode="decimal" value="${r1(e.c || 0)}"></label><label class="field"><span>Fett g</span><input name="f" inputmode="decimal" value="${r1(e.f || 0)}"></label></div>`}
      <label class="field"><span>Mahlzeit</span><select name="slot">${SLOTS.map((s) => `<option ${s === e.slot ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
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
  commit(); toast(`${slot} wie gestern übernommen`);
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
  openSheet(() => `<h2>${esc(slot)}</h2>
    <div id="smForm"><label class="field"><span>Als Mahlzeit speichern</span><input name="name" placeholder="z. B. Mein Frühstück" value="${esc(slot === 'Frühstück' ? 'Mein Frühstück' : '')}"></label></div>
    <button type="button" class="btn primary block" data-a="saveMeal" data-slot="${slot}">${icon('star', 'sm')} Speichern</button>
    <p class="faint tiny">Gespeicherte Mahlzeiten trägst du später mit einem Tipp in jede Mahlzeit ein.</p>
    <button type="button" class="btn danger block mt" data-a="clearSlot" data-slot="${slot}">${icon('trash', 'sm')} ${esc(slot)} leeren</button>`);
};
A.saveMeal = (el) => {
  const root = $('#smForm'), name = formVals(root).name.trim();
  if (!name) return markInvalid(root, 'name', 'Name fehlt');
  const items = entries(app.ui.date).filter((e) => e.slot === el.dataset.slot).map((e) => { const c = structuredClone(e); delete c.id; delete c.slot; return c; });
  app.S.savedMeals.push({ id: uid(), name, items, used: Date.now() });
  closeSheet(); commit(); toast(`„${name}“ gespeichert`);
};
A.clearSlot = (el) => { if (!confirm(`Alle Einträge in ${el.dataset.slot} löschen?`)) return; app.S.meals[app.ui.date] = entries(app.ui.date).filter((e) => e.slot !== el.dataset.slot); closeSheet(); commit(); };

// ---------- Lebensmittel & Mahlzeiten verwalten ----------
function foodsView() {
  const foods = app.S.foods.slice().sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.name.localeCompare(b.name, 'de'));
  return `<div class="topbar"><button type="button" class="back" data-a="back">${icon('left', 'sm')} Ernährung</button><div class="row"><button type="button" class="btn sm" data-a="scan">${icon('barcode', 'sm')} Scannen</button><button type="button" class="btn primary sm" data-a="newFood">${icon('plus', 'sm')} Neu</button></div></div>
  <h1 class="mb">Lebensmittel</h1>
  ${app.S.savedMeals.length ? `<div class="section">Gespeicherte Mahlzeiten</div><div class="card"><div class="list">${app.S.savedMeals.map((m) => `<div class="item"><div class="grow"><b>${esc(m.name)}</b><div>${mtxt(sumMacros(m.items))}</div><div class="faint tiny">${esc(m.items.map((i) => i.name).join(', '))}</div></div><button type="button" class="icon-btn sm" data-a="delMeal" data-id="${m.id}" aria-label="Löschen">${icon('trash', 'sm')}</button></div>`).join('')}</div></div>` : ''}
  <div class="section">Meine Lebensmittel · ${foods.length}</div>
  <div class="card"><div class="list">${foods.map((f) => `<button type="button" class="item" data-a="editFood" data-id="${f.id}"><div class="grow"><b>${f.fav ? '<span class="gold">★</span> ' : ''}${esc(f.name)}</b><div>${mtxt(f)} <span class="faint tiny">/100 g</span></div></div>${icon('right', 'chev')}</button>`).join('') || '<div class="empty">Leer.</div>'}</div></div>
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
