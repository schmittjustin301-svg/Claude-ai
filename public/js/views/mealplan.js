// Wochenplan (was & wann) und automatische Einkaufsliste.
import { app, A, C, commit, save, openSheet, closeSheet, toast } from '../core.js';
import { dkey, addDays, mondayOf, validate, sumMacros } from '../logic.js';
import { $, esc, fmt, icon, bar, shortDate, relDay, formVals, markInvalid, WD } from '../ui.js';
import { slotsFor, planMacros } from '../schedule.js';
import { ING_UNITS, SHOP_CATEGORIES, weekDates, collect, consolidate, mergeList, stats, toText, guessCategory, normName } from '../shopping.js';
import { slotName } from '../domain.js';
import { uid } from '../store.js';

let week = null; // Montag der gewählten Woche
const curWeek = () => (week = week || mondayOf(dkey()));
function isoWeek(k) { const d = new Date(k + 'T12:00'); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7); }
const weekLabel = (m) => `KW ${isoWeek(m)} · ${shortDate(m)}–${shortDate(addDays(m, 6))}`;
const weekNav = () => { const m = curWeek(); return `<div class="row between mb"><button type="button" class="icon-btn sm" data-a="weekShift" data-n="-7" aria-label="Vorwoche">${icon('left', 'sm')}</button><b class="num">${weekLabel(m)}${m === mondayOf(dkey()) ? ' <span class="pill gold">Diese Woche</span>' : ''}</b><button type="button" class="icon-btn sm" data-a="weekShift" data-n="7" aria-label="Nächste Woche">${icon('right', 'sm')}</button></div>`; };
A.weekShift = (el) => { week = addDays(curWeek(), +el.dataset.n); commit(); };
const planOf = (date) => (app.S.mealPlan[date] = app.S.mealPlan[date] || {});
/** Bestehende Einkaufslisten der betroffenen Wochen an den geänderten Plan anpassen (Eigenes und Haken bleiben). */
function syncLists(dates) {
  for (const m of new Set(dates.map(mondayOf))) {
    const l = app.S.shopping[m];
    if (!l) continue;
    l.items = mergeList(l.items, consolidate(collect(app.S.mealPlan, weekDates(m))), uid);
    l.generatedAt = Date.now();
  }
}
const cleanPlan = (date) => { const d = app.S.mealPlan[date]; if (!d) return; for (const k of Object.keys(d)) if (!d[k].length) delete d[k]; if (!Object.keys(d).length) delete app.S.mealPlan[date]; };

// ---------- Wochenplan ----------
// Aufgeklappte Tage merken, damit sie nach dem Bearbeiten offen bleiben
const openDays = new Map(); // Datum → true/false (vom Nutzer gesetzt)
const isOpen = (d, m, today) => (openDays.has(d) ? openDays.get(d) : d === today || (d === m && today < m));
document.addEventListener('toggle', (e) => { const el = e.target; if (el.matches && el.matches('details.day-card')) openDays.set(el.dataset.day, el.open); }, true);
export function planTab() {
  const m = curWeek(), dates = weekDates(m), today = dkey();
  const total = sumMacros(dates.map((d) => sumMacros(slotsFor(app.S, d).map((s) => planMacros(app.S, app.S.mealPlan[d]?.[s.id])))));
  const filled = dates.filter((d) => Object.values(app.S.mealPlan[d] || {}).some((l) => l.length)).length;
  return `${weekNav()}
  <div class="card"><div class="row between"><div><div class="label">Geplant</div><div class="mid" style="margin-top:6px">${filled}<span class="unit"> / 7 Tage</span></div></div><div class="right"><div class="label">Ø pro Tag</div><div class="mid" style="margin-top:6px">${filled ? fmt(total.kcal / filled) : '–'}<span class="unit"> kcal</span></div></div></div>
    <div class="grid2 mt"><button type="button" class="btn sm" data-a="copyWeek">${icon('copy', 'sm')} In nächste Woche kopieren</button><button type="button" class="btn sm primary" data-a="foodTab" data-v="shop">${icon('list', 'sm')} Zur Einkaufsliste</button></div>
    <p class="faint tiny" style="margin-bottom:0">Nährwerte zählen für Zutaten, die mit einem Lebensmittel verknüpft sind (Menge in g, ml oder Stück mit Portion).</p></div>
  ${dates.map((d) => {
    const slots = slotsFor(app.S, d), plan = app.S.mealPlan[d] || {};
    const dm = sumMacros(slots.map((s) => planMacros(app.S, plan[s.id])));
    const n = Object.values(plan).reduce((a, l) => a + l.length, 0);
    return `<details class="card day-card" data-day="${d}" ${isOpen(d, m, today) ? 'open' : ''}><summary class="row between"><span><b>${WD[new Date(d + 'T12:00').getDay()]} ${shortDate(d)}</b>${d === today ? ' <span class="pill gold">Heute</span>' : ''}</span><span class="row"><span class="meta">${n ? `${n} Zutaten${dm.kcal ? ` · ${fmt(dm.kcal)} kcal` : ''}` : 'leer'}</span>${icon('down', 'sm')}</span></summary>
      <div class="mt">${slots.map((s) => {
        const items = plan[s.id] || [];
        return `<div class="plan-slot"><div class="row between"><span class="row"><span class="time-chip static">${s.time}</span><b class="small">${esc(s.name)}</b></span><span class="row"><button type="button" class="icon-btn sm plain" data-a="planFromMeal" data-date="${d}" data-slot="${s.id}" aria-label="Aus gespeicherter Mahlzeit">${icon('star', 'sm')}</button><button type="button" class="icon-btn sm" data-a="addIng" data-date="${d}" data-slot="${s.id}" aria-label="Zutat hinzufügen">${icon('plus', 'sm')}</button></span></div>
          ${items.length ? `<div class="ing-list">${items.map((it) => `<button type="button" class="ing" data-a="editIng" data-date="${d}" data-slot="${s.id}" data-id="${it.id}">${esc(it.name)} <span class="muted">${fmt(Number(it.qty), 2)} ${esc(it.unit)}</span>${it.foodId ? '' : ' <span class="faint">·</span>'}</button>`).join('')}</div>` : ''}</div>`;
      }).join('')}
      <div class="row wrap mt"><button type="button" class="btn sm" data-a="copyDayTo" data-date="${d}">${icon('copy', 'sm')} Tag kopieren</button>${d > m ? `<button type="button" class="btn sm ghost" data-a="planLikePrev" data-date="${d}">${icon('repeat', 'sm')} Wie Vortag</button>` : ''}${n ? `<button type="button" class="btn sm ghost" data-a="clearPlanDay" data-date="${d}">${icon('trash', 'sm')} Leeren</button>` : ''}</div></div>
    </details>`;
  }).join('')}`;
}

// Zutat anlegen/bearbeiten
let ingCtx = null;
function ingSheet() {
  const { date, slot, id } = ingCtx;
  const it = id ? (app.S.mealPlan[date]?.[slot] || []).find((x) => x.id === id) : { name: '', qty: '', unit: 'g', category: '', note: '' };
  const names = [...new Set([...app.S.foods.map((f) => f.name), ...Object.values(app.S.mealPlan).flatMap((d) => Object.values(d).flat().map((x) => x.name))])].sort((a, b) => a.localeCompare(b, 'de'));
  return `<h2>${id ? 'Zutat bearbeiten' : 'Zutat hinzufügen'}</h2><p class="muted small" style="margin-top:-6px">${WD[new Date(date + 'T12:00').getDay()]} ${shortDate(date)} · ${esc(slotName(slot))}</p><div id="ingForm">
    <label class="field"><span>Zutat</span><input name="name" list="ingNames" value="${esc(it.name)}" placeholder="z. B. Reis" autocomplete="off"><datalist id="ingNames">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist></label>
    <div class="grid2"><label class="field"><span>Menge</span><input name="qty" inputmode="decimal" value="${it.qty}"></label><label class="field"><span>Einheit</span><select name="unit">${ING_UNITS.map((u) => `<option ${u === it.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
    <label class="field"><span>Kategorie</span><select name="category"><option value="">Automatisch</option>${SHOP_CATEGORIES.map((c) => `<option ${c === it.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <label class="field"><span>Notiz (optional)</span><input name="note" value="${esc(it.note || '')}" placeholder="z. B. Bio, Vollkorn"></label>
    <p class="faint tiny">Heißt die Zutat genau wie eines deiner Lebensmittel, werden die Nährwerte automatisch verknüpft.</p></div>
    <button type="button" class="btn primary block xl" data-a="saveIng">${id ? 'Speichern' : 'Hinzufügen'}</button>
    ${id ? `<button type="button" class="btn danger block mt" data-a="delIng">${icon('trash', 'sm')} Entfernen</button>` : ''}`;
}
A.addIng = (el) => { ingCtx = { date: el.dataset.date, slot: el.dataset.slot, id: null }; openSheet(ingSheet); };
A.editIng = (el) => { ingCtx = { date: el.dataset.date, slot: el.dataset.slot, id: el.dataset.id }; openSheet(ingSheet); };
A.saveIng = () => {
  const root = $('#ingForm'), v = formVals(root);
  const name = v.name.trim().replace(/\s+/g, ' ');
  if (!name) return markInvalid(root, 'name', 'Name fehlt');
  const q = validate(v.qty, { min: 0.01, max: 100000, label: 'Menge' });
  if (!q.ok) return markInvalid(root, 'qty', q.error);
  const food = app.S.foods.find((f) => normName(f.name) === normName(name));
  const data = { name, qty: q.value, unit: v.unit, category: v.category || '', note: v.note.trim(), foodId: food ? food.id : null };
  const list = (planOf(ingCtx.date)[ingCtx.slot] = planOf(ingCtx.date)[ingCtx.slot] || []);
  if (ingCtx.id) Object.assign(list.find((x) => x.id === ingCtx.id), data); else list.push({ id: uid(), ...data });
  syncLists([ingCtx.date]);
  closeSheet(); commit();
};
A.delIng = () => { const l = planOf(ingCtx.date)[ingCtx.slot] || []; planOf(ingCtx.date)[ingCtx.slot] = l.filter((x) => x.id !== ingCtx.id); cleanPlan(ingCtx.date); syncLists([ingCtx.date]); closeSheet(); commit(); };
// Gespeicherte Mahlzeit als Zutaten übernehmen
A.planFromMeal = (el) => {
  const { date, slot } = el.dataset;
  if (!app.S.savedMeals.length) return toast('Noch keine gespeicherten Mahlzeiten – unter „Heute“ über ⋯ an einer Mahlzeit speichern');
  openSheet(() => `<h2>Gespeicherte Mahlzeit</h2><div class="list">${app.S.savedMeals.map((m) => `<button type="button" class="item" data-a="planUseMeal" data-id="${m.id}" data-date="${date}" data-slot="${slot}"><div class="grow"><b>${esc(m.name)}</b><div class="muted tiny">${esc(m.items.map((i) => i.name).join(', '))}</div></div>${icon('plus', 'chev')}</button>`).join('')}</div>`);
};
A.planUseMeal = (el) => {
  const m = app.S.savedMeals.find((x) => x.id === el.dataset.id);
  const list = (planOf(el.dataset.date)[el.dataset.slot] = planOf(el.dataset.date)[el.dataset.slot] || []);
  for (const it of m.items) list.push({ id: uid(), name: it.name, qty: it.amount || 1, unit: it.amount ? 'g' : 'Stk', category: '', note: '', foodId: it.foodId || null });
  syncLists([el.dataset.date]);
  closeSheet(); commit(); toast(`${m.name} eingeplant`);
};
const cloneDay = (from, to) => { const src = app.S.mealPlan[from] || {}; app.S.mealPlan[to] = Object.fromEntries(Object.entries(src).map(([k, l]) => [k, l.map((x) => ({ ...x, id: uid() }))])); cleanPlan(to); };
A.planLikePrev = (el) => { const d = el.dataset.date; if (Object.keys(app.S.mealPlan[d] || {}).length && !confirm('Diesen Tag durch den Vortag ersetzen?')) return; cloneDay(addDays(d, -1), d); syncLists([d]); commit(); };
A.clearPlanDay = (el) => { if (confirm('Plan für diesen Tag leeren?')) { delete app.S.mealPlan[el.dataset.date]; syncLists([el.dataset.date]); commit(); } };
A.copyDayTo = (el) => {
  const from = el.dataset.date, m = curWeek();
  const targets = [...weekDates(m), ...weekDates(addDays(m, 7))].filter((d) => d !== from);
  openSheet(() => `<h2>Tag kopieren</h2><p class="muted small" style="margin-top:-6px">${WD[new Date(from + 'T12:00').getDay()]} ${shortDate(from)} übernehmen nach:</p>
    <div id="cpForm" class="chips">${targets.map((d) => `<label class="chip"><input type="checkbox" value="${d}" hidden onchange="this.parentElement.classList.toggle('on', this.checked)">${WD[new Date(d + 'T12:00').getDay()]} ${shortDate(d)}</label>`).join('')}</div>
    <p class="faint tiny">Vorhandene Pläne der Zieltage werden ersetzt.</p>
    <button type="button" class="btn primary block xl" data-a="doCopyDay" data-date="${from}">Kopieren</button>`);
};
A.doCopyDay = (el) => {
  const ds = [...document.querySelectorAll('#cpForm input:checked')].map((x) => x.value);
  if (!ds.length) return toast('Mindestens einen Tag wählen', true);
  ds.forEach((d) => cloneDay(el.dataset.date, d));
  syncLists(ds);
  closeSheet(); commit(); toast(`Auf ${ds.length} ${ds.length === 1 ? 'Tag' : 'Tage'} kopiert`);
};
A.copyWeek = () => {
  const m = curWeek(), next = addDays(m, 7);
  if (!weekDates(m).some((d) => app.S.mealPlan[d])) return toast('Diese Woche ist noch leer');
  if (weekDates(next).some((d) => app.S.mealPlan[d]) && !confirm('Die nächste Woche hat schon Einträge. Ersetzen?')) return;
  weekDates(m).forEach((d, i) => cloneDay(d, addDays(next, i)));
  syncLists([next]);
  week = next; commit(); toast('Woche kopiert');
};

// ---------- Einkaufsliste ----------
const listOf = (m) => app.S.shopping[m];
export function shopTab() {
  const m = curWeek(), list = listOf(m);
  const planned = collect(app.S.mealPlan, weekDates(m)).length;
  const items = (list?.items || []).filter((x) => !x.cleared);
  const st = stats(items);
  const others = Object.keys(app.S.shopping).filter((k) => k !== m).sort().reverse();
  return `${weekNav()}
  <section class="hero corners" aria-label="Einkaufsliste"><i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i>
    <div class="row between"><div><div class="label gold">Wocheneinkauf</div><div class="cockpit-title">${list ? `${st.bought} / ${st.total} im Korb` : 'Noch keine Liste'}</div><div class="muted small">${list ? `erstellt ${relDay(dkey(new Date(list.generatedAt)))} ${new Date(list.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · ${planned} geplante Zutaten` : planned ? `${planned} geplante Zutaten im Wochenplan` : 'Der Wochenplan ist noch leer.'}</div></div>
      ${list ? `<div class="hud-v gold" style="font-size:30px">${fmt(st.pct * 100)}<span class="unit">%</span></div>` : ''}</div>
    ${list ? `<div class="mt">${bar(st.bought, st.total || 1, { thick: true, over: false })}</div><div class="telemetry" style="margin:12px 0 14px"><div><div class="meta">Gesamt</div><div class="v">${st.total}</div></div><div><div class="meta">Gekauft</div><div class="v gold">${st.bought}</div></div><div><div class="meta">Offen</div><div class="v">${st.remaining}</div></div></div>` : '<div style="height:14px"></div>'}
    <button type="button" class="btn primary block launch" data-a="genList" ${planned || list ? '' : 'disabled'}>${icon('repeat')} ${list ? 'Liste aktualisieren' : 'Einkaufsliste erstellen'}</button>
    ${!planned && !list ? '<button type="button" class="btn ghost block sm" style="margin-top:6px" data-a="foodTab" data-v="plan">Erst Mahlzeiten im Wochenplan anlegen</button>' : ''}
  </section>
  ${list ? `
  <div class="row wrap mb"><button type="button" class="btn sm" data-a="addShopItem">${icon('plus', 'sm')} Eigener Artikel</button><button type="button" class="btn sm" data-a="shareList">${icon('upload', 'sm')} Teilen / kopieren</button>${st.bought ? `<button type="button" class="btn sm ghost" data-a="clearBought">Erledigte ausblenden</button><button type="button" class="btn sm ghost" data-a="uncheckAll">Haken zurücksetzen</button>` : ''}</div>
  ${SHOP_CATEGORIES.map((cat) => {
    const its = items.filter((x) => !x.inStock && (SHOP_CATEGORIES.includes(x.category) ? x.category : 'Sonstiges') === cat).sort((a, b) => (a.bought ? 1 : 0) - (b.bought ? 1 : 0) || a.name.localeCompare(b.name, 'de'));
    if (!its.length) return '';
    return `<div class="section">${cat}</div><div class="card shop">${its.map(shopRow).join('')}</div>`;
  }).join('')}
  ${items.some((x) => x.inStock) ? `<div class="section">Schon da</div><div class="card shop">${items.filter((x) => x.inStock).map(shopRow).join('')}</div>` : ''}
  ${!items.length ? '<div class="card"><div class="empty">Die Liste ist leer. Plane Mahlzeiten oder füge eigene Artikel hinzu.</div></div>' : ''}` : ''}
  ${others.length ? `<div class="section">Frühere Listen</div><div class="card"><div class="list">${others.map((k) => { const s = stats(app.S.shopping[k].items || []); return `<button type="button" class="item" data-a="openWeek" data-w="${k}"><span>${weekLabel(k)}</span><span class="r small muted">${s.bought}/${s.total}</span>${icon('right', 'chev')}</button>`; }).join('')}</div></div>` : ''}`;
}
function shopRow(x) {
  const hint = x.source === 'auto' && x.edited && (x.planQty !== x.qty || x.planUnit !== x.unit) ? `<div class="faint tiny">Plan: ${fmt(x.planQty, 2)} ${esc(x.planUnit)}</div>` : '';
  return `<div class="shop-row ${x.bought ? 'bought' : ''} ${x.inStock ? 'stock' : ''}">
    <button type="button" class="tk-btn ${x.bought ? 'on' : ''}" data-a="toggleBought" data-id="${x.id}" aria-label="${esc(x.name)} ${x.bought ? 'nicht gekauft' : 'gekauft'}" ${x.inStock ? 'disabled' : ''}>${icon('check')}</button>
    <button type="button" class="grow shop-main" data-a="editShopItem" data-id="${x.id}"><b>${esc(x.name)}</b>${x.source === 'manual' ? ' <span class="pill">eigen</span>' : ''}<div class="muted small">${x.qty ? `${fmt(x.qty, 2)} ${esc(x.unit)}` : ''}${x.note ? ` · ${esc(x.note)}` : ''}${x.autoNote ? ` · ${esc(x.autoNote)}` : ''}</div>${hint}</button>
    <button type="button" class="btn sm ghost" data-a="toggleStock" data-id="${x.id}">${x.inStock ? 'Doch kaufen' : 'Schon da'}</button>
  </div>`;
}
A.genList = () => {
  const m = curWeek();
  const gen = consolidate(collect(app.S.mealPlan, weekDates(m)));
  const prev = app.S.shopping[m];
  app.S.shopping[m] = { generatedAt: Date.now(), items: mergeList(prev?.items || [], gen, uid) };
  commit();
  const n = app.S.shopping[m].items.filter((x) => x.source === 'auto').length;
  toast(prev ? `Liste aktualisiert · ${n} Zutaten aus dem Plan` : `Liste erstellt · ${n} Zutaten`);
};
A.openWeek = (el) => { week = el.dataset.w; commit(); window.scrollTo(0, 0); };
const itemOf = (id) => listOf(curWeek()).items.find((x) => x.id === id);
A.toggleBought = (el) => { const x = itemOf(el.dataset.id); x.bought = !x.bought; commit(); document.dispatchEvent(new CustomEvent('goals-check')); };
A.toggleStock = (el) => { const x = itemOf(el.dataset.id); x.inStock = !x.inStock; if (x.inStock) x.bought = false; commit(); };
A.clearBought = () => {
  const l = listOf(curWeek());
  l.items = l.items.filter((x) => !(x.source === 'manual' && x.bought && !x.inStock));
  l.items.forEach((x) => { if (x.bought && !x.inStock) x.cleared = true; }); // bleibt beim Aktualisieren ausgeblendet
  commit();
};
A.uncheckAll = () => { listOf(curWeek()).items.forEach((x) => { x.bought = false; x.cleared = false; }); commit(); };
A.shareList = async () => {
  const text = toText(listOf(curWeek()).items, `Einkaufsliste ${weekLabel(curWeek())}`);
  try { if (navigator.share) { await navigator.share({ title: 'Einkaufsliste', text }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('In die Zwischenablage kopiert'); } catch { openSheet(() => `<h2>Einkaufsliste</h2><textarea style="min-height:320px" readonly>${esc(text)}</textarea>`); }
};
function shopItemSheet(id) {
  const x = id ? itemOf(id) : { name: '', qty: '', unit: 'Stk', category: 'Sonstiges', note: '' };
  return `<h2>${id ? 'Artikel bearbeiten' : 'Eigener Artikel'}</h2><div id="shForm">
    <label class="field"><span>Name</span><input name="name" value="${esc(x.name)}" ${x.source === 'auto' ? 'readonly' : ''}></label>
    <div class="grid2"><label class="field"><span>Menge</span><input name="qty" inputmode="decimal" value="${x.qty ?? ''}" placeholder="optional"></label><label class="field"><span>Einheit</span><select name="unit">${ING_UNITS.map((u) => `<option ${u === x.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
    <label class="field"><span>Kategorie</span><select name="category">${SHOP_CATEGORIES.map((c) => `<option ${c === x.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <label class="field"><span>Notiz</span><input name="note" value="${esc(x.note || '')}"></label>
    ${x.source === 'auto' ? `<p class="faint tiny">Aus dem Wochenplan: ${fmt(x.planQty, 2)} ${esc(x.planUnit)}. Eine eigene Menge bleibt beim Aktualisieren erhalten.</p>` : ''}</div>
    <button type="button" class="btn primary block xl" data-a="saveShopItem" data-id="${id || ''}">Speichern</button>
    ${x.source === 'auto' && x.edited ? `<button type="button" class="btn block mt" data-a="resetShopQty" data-id="${id}">Planmenge übernehmen</button>` : ''}
    ${id && x.source === 'manual' ? `<button type="button" class="btn danger block mt" data-a="delShopItem" data-id="${id}">${icon('trash', 'sm')} Entfernen</button>` : ''}`;
}
A.addShopItem = () => openSheet(() => shopItemSheet(null));
A.editShopItem = (el) => openSheet(() => shopItemSheet(el.dataset.id));
A.saveShopItem = (el) => {
  const root = $('#shForm'), v = formVals(root), l = listOf(curWeek());
  if (!v.name.trim()) return markInvalid(root, 'name', 'Name fehlt');
  const q = validate(v.qty, { min: 0, max: 100000, required: false, label: 'Menge' });
  if (!q.ok) return markInvalid(root, 'qty', q.error);
  const x = el.dataset.id ? itemOf(el.dataset.id) : null;
  if (x) {
    if (x.source === 'auto' && (q.value !== x.qty || v.unit !== x.unit)) x.edited = true;
    if (x.category !== v.category) x.categoryEdited = true;
    Object.assign(x, { name: x.source === 'auto' ? x.name : v.name.trim(), qty: q.value, unit: v.unit, category: v.category, note: v.note.trim() });
  } else {
    l.items.push({ id: uid(), key: 'manual:' + uid(), source: 'manual', name: v.name.trim(), qty: q.value, unit: v.unit, category: v.category || guessCategory(v.name), note: v.note.trim(), bought: false, inStock: false });
  }
  closeSheet(); commit();
};
A.resetShopQty = (el) => { const x = itemOf(el.dataset.id); Object.assign(x, { qty: x.planQty, unit: x.planUnit, edited: false }); closeSheet(); commit(); };
A.delShopItem = (el) => { const l = listOf(curWeek()); l.items = l.items.filter((x) => x.id !== el.dataset.id); closeSheet(); commit(); };
export { C, save, ING_UNITS };
