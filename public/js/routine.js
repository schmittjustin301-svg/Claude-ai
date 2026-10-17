// Tagesroutine: Aktionen für Supplement-Einnahmen und Mahlzeiten + Tagesplan-Ansicht (Timeline).
// Ein Eintrag pro Tag und geplanter Einnahme (Schlüssel suppId:schedId) – doppelte Einnahmen sind ausgeschlossen.
import { app, A, registerView, commit, openSheet, closeSheet, toast } from './core.js';
import { dkey, addDays, macrosFor, validate } from './logic.js';
import { esc, fmt, fmtClock, icon, relDay, longDate } from './ui.js';
import { timeline, nextEvent, slotsFor, planMacros, toGrams, SNOOZE_MIN, validTime, intakeKey } from './schedule.js';
import { uid } from './store.js';

let flashKey = null; // kurzes Gold-Aufblitzen nach dem Abhaken
export const isFlash = (key) => flashKey === key;
function flash(key) { flashKey = key; if (navigator.vibrate) navigator.vibrate(18); commit(); flashKey = null; }

// ---------- Supplements ----------
const rec = (date) => (app.S.intakes[date] = app.S.intakes[date] || {});
function adjustStock(suppId, delta) {
  const s = app.S.supps.find((x) => x.id === suppId);
  if (!s || s.stock == null || !Number.isFinite(delta) || !delta) return;
  s.stock = Math.max(0, Math.round((s.stock + delta) * 100) / 100);
}
export function takeIntake(date, key, amount) {
  const r = rec(date)[key];
  if (r?.status === 'taken') return; // schon erledigt – keine doppelte Einnahme
  const suppId = key.split(':')[0];
  const amt = Number(amount);
  rec(date)[key] = { status: 'taken', at: Date.now(), amount: Number.isFinite(amt) ? amt : null };
  if (Number.isFinite(amt)) adjustStock(suppId, -amt);
  flash(key);
}
A.suppTake = (el) => takeIntake(el.dataset.date || dkey(), el.dataset.key, el.dataset.amt === '' ? null : el.dataset.amt);
A.suppUndo = (el) => {
  const date = el.dataset.date || dkey(), r = rec(date)[el.dataset.key];
  if (!r) return;
  if (r.status === 'taken' && r.amount != null) adjustStock(el.dataset.key.split(':')[0], r.amount);
  delete rec(date)[el.dataset.key];
  commit();
};
A.suppSnooze = (el) => {
  const date = el.dataset.date || dkey(), r = rec(date)[el.dataset.key];
  rec(date)[el.dataset.key] = { status: 'snoozed', until: Date.now() + SNOOZE_MIN * 60000, n: (r?.n || 0) + 1 };
  commit(); toast(`Erinnert in ${SNOOZE_MIN} Minuten`);
};
A.suppSkip = (el) => { rec(el.dataset.date || dkey())[el.dataset.key] = { status: 'skipped', at: Date.now() }; commit(); };
/** Tatsächliche Einnahmezeit korrigieren. */
A.suppTime = (el) => {
  const date = el.dataset.date || dkey(), key = el.dataset.key, r = rec(date)[key];
  if (r?.status !== 'taken') return;
  openSheet(() => `<h2>Einnahmezeit</h2><label class="field"><span>Genommen um</span><input id="tIn" type="time" value="${fmtClock(r.at)}"></label>
    <button type="button" class="btn primary block" data-a="saveSuppTime" data-key="${esc(key)}" data-date="${date}">Speichern</button>
    <button type="button" class="btn ghost block mt" data-a="suppUndo" data-key="${esc(key)}" data-date="${date}">Als nicht genommen markieren</button>`);
};
A.saveSuppTime = (el) => {
  const t = document.querySelector('#tIn').value;
  if (!validTime(t)) return toast('Uhrzeit ungültig', true);
  const [h, m] = t.split(':').map(Number), d = new Date(el.dataset.date + 'T00:00'); d.setHours(h, m, 0, 0);
  rec(el.dataset.date)[el.dataset.key].at = d.getTime();
  closeSheet(); commit();
};

// ---------- Mahlzeiten ----------
const mday = (date) => (app.S.mealDays[date] = app.S.mealDays[date] || {});
/**
 * Mahlzeit als gegessen markieren. Steht sie im Wochenplan und ist noch nichts eingetragen, werden die geplanten
 * Zutaten (mit Nährwerten) als Einträge übernommen – genau einmal, damit nichts doppelt zählt.
 */
export function markMealDone(date, slotId) {
  const st = mday(date)[slotId] || {};
  const list = (app.S.meals[date] = app.S.meals[date] || []);
  const planned = app.S.mealPlan[date]?.[slotId] || [];
  let added = 0, skipped = 0;
  if (planned.length && !list.some((e) => e.slot === slotId)) {
    for (const it of planned) {
      const f = it.foodId ? app.S.foods.find((x) => x.id === it.foodId) : null;
      const g = toGrams(it.qty, it.unit, f);
      if (!f || g == null) { skipped++; continue; }
      const per = { kcal: f.kcal, p: f.p, c: f.c, f: f.f };
      list.push({ id: uid(), slot: slotId, name: f.name, foodId: f.id, amount: Math.round(g), per, ...macrosFor(per, g), fromPlan: true });
      added++;
    }
  }
  mday(date)[slotId] = { ...st, status: 'done', at: Date.now(), until: undefined };
  flash('meal:' + slotId);
  if (added || skipped) toast(`${added ? `${added} geplante Zutat${added === 1 ? '' : 'en'} eingetragen` : ''}${added && skipped ? ' · ' : ''}${skipped ? `${skipped} ohne Nährwerte nicht gezählt` : ''}`);
}
A.mealDone = (el) => markMealDone(el.dataset.date || dkey(), el.dataset.slot);
A.mealUndo = (el) => {
  const date = el.dataset.date || dkey(), slot = el.dataset.slot;
  const st = mday(date)[slot] || {};
  delete st.status; delete st.at; delete st.until;
  // automatisch aus dem Plan übernommene Einträge wieder entfernen, eigene Einträge bleiben
  if (app.S.meals[date]) app.S.meals[date] = app.S.meals[date].filter((e) => !(e.slot === slot && e.fromPlan));
  mday(date)[slot] = st;
  commit();
};
A.mealSkip = (el) => { const date = el.dataset.date || dkey(); mday(date)[el.dataset.slot] = { ...mday(date)[el.dataset.slot], status: 'skipped', at: Date.now() }; commit(); };
A.mealSnooze = (el) => { const date = el.dataset.date || dkey(); mday(date)[el.dataset.slot] = { ...mday(date)[el.dataset.slot], status: 'snoozed', until: Date.now() + SNOOZE_MIN * 60000 }; commit(); toast(`Erinnert in ${SNOOZE_MIN} Minuten`); };
/** Uhrzeit nur für diesen Tag verschieben oder Essenszeit korrigieren. */
A.mealTime = (el) => {
  const date = el.dataset.date || dkey(), slot = el.dataset.slot;
  const s = slotsFor(app.S, date).find((x) => x.id === slot), st = mday(date)[slot] || {};
  openSheet(() => `<h2>${esc(s.name)} · ${relDay(date)}</h2>
    <label class="field"><span>Geplante Uhrzeit nur für diesen Tag</span><input id="mtIn" type="time" value="${s.time}"></label>
    ${st.status === 'done' ? `<label class="field"><span>Tatsächlich gegessen um</span><input id="meIn" type="time" value="${fmtClock(st.at)}"></label>` : ''}
    <button type="button" class="btn primary block" data-a="saveMealTime" data-slot="${slot}" data-date="${date}">Speichern</button>
    ${s.override ? `<button type="button" class="btn ghost block mt" data-a="resetMealTime" data-slot="${slot}" data-date="${date}">Auf Standardzeit zurücksetzen</button>` : ''}
    <p class="faint tiny">Die Standardzeiten aller Tage änderst du unter Ernährung → Mahlzeiten verwalten.</p>`);
};
A.saveMealTime = (el) => {
  const date = el.dataset.date, slot = el.dataset.slot, t = document.querySelector('#mtIn').value;
  if (!validTime(t)) return toast('Uhrzeit ungültig', true);
  const base = app.S.mealSlots.find((x) => x.id === slot);
  const st = { ...mday(date)[slot] };
  if (t === base.time) delete st.time; else st.time = t;
  const e = document.querySelector('#meIn');
  if (e && validTime(e.value)) { const [h, m] = e.value.split(':').map(Number), d = new Date(date + 'T00:00'); d.setHours(h, m, 0, 0); st.at = d.getTime(); }
  if (st.status === 'snoozed') { delete st.status; delete st.until; }
  mday(date)[slot] = st;
  closeSheet(); commit(); toast('Zeit gespeichert');
};
A.resetMealTime = (el) => { const st = mday(el.dataset.date)[el.dataset.slot]; if (st) delete st.time; closeSheet(); commit(); };

// ---------- Darstellung ----------
const STATUS = { done: ['Erledigt', 'ok'], skipped: ['Übersprungen', 'muted'], snoozed: ['Geschlummert', 'snooze'], due: ['Jetzt', 'due'], upcoming: ['Geplant', 'up'], open: ['Offen', 'muted'] };
export function statusPill(st) { const [l, c] = STATUS[st] || STATUS.upcoming; return `<span class="st st-${c}">${l}</span>`; }
const fmtAmt = (a, u) => (a != null && a !== '' ? `${fmt(Number(a), 2)} ${esc(u || '')}` : '');
/** Eine Zeile im Tagesplan mit passender Schnellaktion. */
export function eventRow(e, date, { compact = false } = {}) {
  const d = `data-date="${date}"`;
  const isSupp = e.kind === 'supp';
  const detail = isSupp ? [fmtAmt(e.amount, e.unit), e.slot ? `mit ${esc(e.slot.name)}` : '', e.status === 'done' && e.takenAt ? `genommen ${fmtClock(e.takenAt)}` : ''].filter(Boolean).join(' · ')
    : [e.logged ? `${e.logged} Einträge` : e.planned ? `${e.planned} geplante Zutaten` : '', e.kcal ? `${fmt(e.kcal)} kcal` : '', e.status === 'done' && e.eatenAt ? `gegessen ${fmtClock(e.eatenAt)}` : ''].filter(Boolean).join(' · ');
  const open = e.status === 'due' || e.status === 'upcoming' || e.status === 'snoozed' || e.status === 'open';
  let actions = '';
  if (isSupp) {
    actions = open ? `<button type="button" class="tk-btn" data-a="suppTake" data-key="${esc(e.key)}" data-amt="${e.amount ?? ''}" ${d} aria-label="${esc(e.title)} genommen">${icon('check')}</button>`
      : e.status === 'done' ? `<button type="button" class="tk-btn on" data-a="suppTime" data-key="${esc(e.key)}" ${d} aria-label="Einnahme bearbeiten">${icon('check')}</button>`
        : `<button type="button" class="icon-btn sm plain" data-a="suppUndo" data-key="${esc(e.key)}" ${d} aria-label="Zurücksetzen">${icon('repeat', 'sm')}</button>`;
  } else {
    actions = open ? `<button type="button" class="tk-btn" data-a="mealDone" data-slot="${e.id}" ${d} aria-label="${esc(e.title)} gegessen">${icon('check')}</button>`
      : e.status === 'done' ? `<button type="button" class="tk-btn on" data-a="mealUndo" data-slot="${e.id}" ${d} aria-label="Als nicht gegessen markieren">${icon('check')}</button>`
        : `<button type="button" class="icon-btn sm plain" data-a="mealUndo" data-slot="${e.id}" ${d} aria-label="Zurücksetzen">${icon('repeat', 'sm')}</button>`;
  }
  const more = !compact && (e.status === 'due' || e.status === 'snoozed')
    ? `<div class="ev-more"><button type="button" class="btn sm ghost" data-a="${isSupp ? 'suppSnooze' : 'mealSnooze'}" ${isSupp ? `data-key="${esc(e.key)}"` : `data-slot="${e.id}"`} ${d}>${icon('clock', 'sm')} ${SNOOZE_MIN} min</button><button type="button" class="btn sm ghost" data-a="${isSupp ? 'suppSkip' : 'mealSkip'}" ${isSupp ? `data-key="${esc(e.key)}"` : `data-slot="${e.id}"`} ${d}>Überspringen</button></div>`
    : '';
  return `<div class="ev ev-${e.kind} st-row-${e.status} ${isFlash(e.key) ? 'flash' : ''}">
    ${!isSupp && !compact ? `<button type="button" class="ev-time link-time" data-a="mealTime" data-slot="${e.id}" ${d} aria-label="${esc(e.title)}: Uhrzeit ändern">${e.time}</button>` : `<div class="ev-time">${e.time}</div>`}
    <div class="ev-ic">${icon(isSupp ? 'pill' : 'food', 'sm')}</div>
    <div class="ev-main"><div class="ev-t">${esc(e.title)} ${statusPill(e.status)}</div>${detail ? `<div class="ev-d">${detail}</div>` : ''}</div>
    <div class="ev-act">${actions}</div>${more}
  </div>`;
}

/** Kompakte „Als Nächstes“-Leiste fürs Dashboard. */
export function nextCard() {
  const n = nextEvent(app.S);
  if (!n) return '';
  const when = n.status === 'due' ? (n.overdueMin > 15 ? `seit ${n.overdueMin >= 60 ? `${Math.floor(n.overdueMin / 60)} h ${n.overdueMin % 60} min` : `${n.overdueMin} min`}` : 'jetzt fällig') : n.date !== dkey() ? `morgen ${n.time}` : n.inMin <= 90 ? `in ${n.inMin} min` : `um ${n.time}`;
  return `<div class="card next ${n.status === 'due' ? 'is-due' : ''}" data-a="go" data-v="day">
    <div class="row between"><span class="label ${n.status === 'due' ? 'gold' : ''}">Als Nächstes · ${when}</span><span class="meta">Tagesplan ${icon('right', 'sm')}</span></div>
    <div class="row" style="margin-top:10px">${eventRow(n, n.date, { compact: true }).replace('class="ev ', 'class="ev bare ')}</div>
  </div>`;
}

function dayView(params) {
  const date = params.date || dkey();
  const ev = timeline(app.S, date);
  const done = ev.filter((e) => e.status === 'done').length;
  return `<div class="topbar"><button type="button" class="back" data-a="back">${icon('left', 'sm')} Zurück</button>
    <div class="row"><button type="button" class="icon-btn sm" data-a="dayShift" data-n="-1" data-date="${date}" aria-label="Vortag">${icon('left', 'sm')}</button><b class="num" style="min-width:80px;text-align:center">${relDay(date)}</b><button type="button" class="icon-btn sm" data-a="dayShift" data-n="1" data-date="${date}" aria-label="Folgetag">${icon('right', 'sm')}</button></div></div>
  <h1>Tagesplan</h1><div class="muted small" style="margin:6px 0 16px">${longDate(date)} · ${done} von ${ev.length} erledigt</div>
  ${ev.length ? `<div class="card tl">${ev.map((e) => eventRow(e, date)).join('')}</div>` : '<div class="card empty-card"><div class="empty">Noch nichts geplant. Lege Mahlzeiten-Zeiten unter Ernährung fest und Supplement-Zeiten unter Supplements.</div></div>'}
  <div class="grid2"><button type="button" class="btn" data-a="go" data-v="supps">${icon('pill', 'sm')} Supplements</button><button type="button" class="btn" data-a="go" data-v="food">${icon('food', 'sm')} Ernährung</button></div>
  <p class="faint tiny center mt">Erinnerungen sind deine eigenen Einstellungen – keine medizinische Empfehlung.</p>`;
}
registerView('day', dayView, 'home');
A.dayShift = (el) => { app.ui.params = { date: addDays(el.dataset.date, +el.dataset.n) }; commit(); };

export { intakeKey, planMacros, validate };
