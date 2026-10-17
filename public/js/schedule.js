// Zeitpläne: Supplements und Mahlzeiten, Tages-Timeline, Einnahmetreue, Vorrat, Kalender-Export.
// Reine Logik ohne DOM. Uhrzeiten sind lokale Wanduhrzeiten ('HH:MM') – sie folgen der Zeitzone des Geräts.
import { dkey, pkey, addDays, weekdayOf, sumMacros, macrosFor } from './logic.js';

export const SUPP_CATEGORIES = ['Vitamine', 'Mineralstoffe', 'Protein', 'Kreatin', 'Elektrolyte', 'Pre-Workout', 'Sonstiges'];
export const SUPP_UNITS = ['Kapseln', 'Tabletten', 'g', 'mg', 'µg', 'IE', 'ml', 'Messlöffel', 'Tropfen', 'Portion'];
export const SNOOZE_MIN = 10;
export const DUE_WINDOW_MIN = 0; // ab der geplanten Minute gilt ein Eintrag als fällig

export const validTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''));
export const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
export const fromMin = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
/** Zeitpunkt (ms) einer lokalen Uhrzeit an einem Datum. */
export const at = (date, time) => { const d = pkey(date); const [h, m] = time.split(':').map(Number); d.setHours(h, m, 0, 0); return d.getTime(); };
export const intakeKey = (suppId, schedId) => `${suppId}:${schedId}`;

// ---------- Mahlzeiten ----------
export function slotsFor(S, date) {
  return S.mealSlots.map((x) => ({ ...x, time: S.mealDays[date]?.[x.id]?.time || x.time, override: !!S.mealDays[date]?.[x.id]?.time }))
    .sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name, 'de'));
}
export const mealState = (S, date, slotId) => S.mealDays[date]?.[slotId] || {};

/** Nährwerte eines geplanten Gerichts (nur Zutaten mit Lebensmittel-Bezug und g/ml-Mengen sind berechenbar). */
export function planMacros(S, items) {
  let known = 0;
  const parts = [];
  for (const it of items || []) {
    const f = it.foodId ? S.foods.find((x) => x.id === it.foodId) : null;
    const g = toGrams(it.qty, it.unit, f);
    if (f && g != null) { parts.push(macrosFor(f, g)); known++; }
  }
  return { ...sumMacros(parts), known, total: (items || []).length };
}
/** Menge in g/ml, falls sinnvoll umrechenbar (Stück nur, wenn das Lebensmittel eine Portionsgröße hat). */
export function toGrams(qty, unit, food) {
  const q = Number(qty);
  if (!Number.isFinite(q) || q <= 0) return null;
  if (unit === 'g' || unit === 'ml') return q;
  if (unit === 'kg' || unit === 'l') return q * 1000;
  if (unit === 'Stk' && food && food.portion) return q * food.portion;
  return null;
}

// ---------- Supplements ----------
/** Geplante Einnahmen eines Tages, nach Uhrzeit. Archivierte Supplements tauchen nicht auf. */
export function suppOccurrences(S, date) {
  const wd = weekdayOf(date);
  const slots = slotsFor(S, date);
  const out = [];
  for (const supp of S.supps) {
    if (supp.archived) continue;
    for (const sc of supp.schedule || []) {
      if (!(sc.days || []).includes(wd)) continue;
      if (sc.since && date < sc.since) continue; // erst ab dem Tag zählen, an dem die Einnahme angelegt wurde
      const slot = sc.meal ? slots.find((x) => x.id === sc.meal) : null;
      const time = validTime(sc.time) ? sc.time : slot ? slot.time : null;
      if (!time) continue;
      out.push({ key: intakeKey(supp.id, sc.id), supp, sched: sc, time, amount: sc.amount ?? supp.serving, slot });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.supp.name.localeCompare(b.supp.name, 'de'));
}
/** Supplements ohne festen Zeitplan (einfach „heute genommen“ abhaken). */
export const unscheduledSupps = (S) => S.supps.filter((x) => !x.archived && !(x.schedule || []).length);
export const intakeRecord = (S, date, key) => S.intakes[date]?.[key] || null;

/** Status: done | skipped | snoozed | due | upcoming | open (vergangener Tag, nicht erledigt). */
export function statusOf(record, date, time, now = Date.now()) {
  if (record?.status === 'taken' || record?.status === 'done') return 'done';
  if (record?.status === 'skipped') return 'skipped';
  const today = dkey(new Date(now));
  if (date < today) return 'open';
  if (date > today) return 'upcoming';
  if (record?.status === 'snoozed' && record.until > now) return 'snoozed';
  return at(date, time) <= now + DUE_WINDOW_MIN * 60000 ? 'due' : 'upcoming';
}
/** Fälligkeit (ms) – bei Schlummern der Schlummer-Zeitpunkt. */
export const dueAt = (record, date, time) => (record?.status === 'snoozed' && record.until ? record.until : at(date, time));

// ---------- Timeline ----------
/** Alle Termine eines Tages (Mahlzeiten + Supplements) chronologisch. */
export function timeline(S, date, now = Date.now()) {
  const ev = [];
  for (const slot of slotsFor(S, date)) {
    const st = mealState(S, date, slot.id);
    const logged = (S.meals[date] || []).filter((e) => e.slot === slot.id);
    const planned = S.mealPlan[date]?.[slot.id] || [];
    const time = slot.time;
    const status = st.status === 'done' ? 'done' : statusOf(st.status === 'skipped' ? { status: 'skipped' } : st.status === 'snoozed' ? { status: 'snoozed', until: st.until } : null, date, time, now);
    const kcal = logged.length ? sumMacros(logged).kcal : planMacros(S, planned).kcal;
    ev.push({ kind: 'meal', key: `meal:${slot.id}`, id: slot.id, time, title: slot.name, status, logged: logged.length, planned: planned.length, kcal, eatenAt: st.at || null, due: dueAt(st.status === 'snoozed' ? { status: 'snoozed', until: st.until } : null, date, time) });
  }
  for (const o of suppOccurrences(S, date)) {
    const rec = intakeRecord(S, date, o.key);
    ev.push({ kind: 'supp', key: o.key, id: o.supp.id, schedId: o.sched.id, time: o.time, title: o.supp.name, amount: o.amount, unit: o.supp.unit, slot: o.slot, status: statusOf(rec, date, o.time, now), takenAt: rec?.at || null, due: dueAt(rec, date, o.time) });
  }
  return ev.sort((a, b) => a.time.localeCompare(b.time) || (a.kind === 'meal' ? -1 : 1));
}
const OPEN = new Set(['due', 'snoozed', 'upcoming']);
/** Nächster Termin: zuerst Fälliges (das älteste), sonst das nächste Kommende; heute oder morgen. */
export function nextEvent(S, now = Date.now()) {
  const today = dkey(new Date(now));
  const ev = timeline(S, today, now).filter((e) => OPEN.has(e.status));
  const due = ev.filter((e) => e.status === 'due').sort((a, b) => a.due - b.due)[0];
  if (due) return { ...due, date: today, overdueMin: Math.max(0, Math.round((now - due.due) / 60000)) };
  const up = ev.filter((e) => e.status !== 'due').sort((a, b) => a.due - b.due)[0];
  if (up) return { ...up, date: today, inMin: Math.round((up.due - now) / 60000) };
  const tom = addDays(today, 1);
  const t = timeline(S, tom, now)[0];
  return t ? { ...t, date: tom, inMin: Math.round((at(tom, t.time) - now) / 60000) } : null;
}

// ---------- Einnahmetreue & Vorrat ----------
/** Tagesbilanz: zählt geplante Einnahmen, die schon fällig sind oder erledigt wurden. */
export function dayAdherence(S, date, now = Date.now()) {
  const today = dkey(new Date(now));
  let scheduled = 0, taken = 0, skipped = 0;
  for (const o of suppOccurrences(S, date)) {
    const rec = intakeRecord(S, date, o.key);
    const st = statusOf(rec, date, o.time, now);
    const counts = date < today || st === 'done' || st === 'skipped' || st === 'due' || st === 'snoozed';
    if (!counts) continue;
    scheduled++;
    if (st === 'done') taken++;
    if (st === 'skipped') skipped++;
  }
  return { scheduled, taken, skipped, pct: scheduled ? taken / scheduled : null, total: suppOccurrences(S, date).length };
}
export function adherenceRange(S, from, to, now = Date.now()) {
  const days = [];
  for (let k = from; k <= to; k = addDays(k, 1)) days.push({ date: k, ...dayAdherence(S, k, now) });
  const scheduled = days.reduce((a, d) => a + d.scheduled, 0), taken = days.reduce((a, d) => a + d.taken, 0);
  return { days, scheduled, taken, pct: scheduled ? taken / scheduled : null };
}
/** Geplante Menge pro Woche (in der Supplement-Einheit). */
export const weeklyAmount = (supp) => (supp.schedule || []).reduce((a, sc) => a + (Number(sc.amount ?? supp.serving) || 0) * (sc.days || []).length, 0);
export function stockInfo(supp) {
  if (supp.stock == null) return null;
  const perDay = weeklyAmount(supp) / 7;
  const daysLeft = perDay > 0 ? Math.floor(supp.stock / perDay) : null;
  const low = supp.minStock != null ? supp.stock <= supp.minStock : daysLeft != null && daysLeft <= 7;
  return { stock: supp.stock, daysLeft, low };
}
export const lowStock = (S) => S.supps.filter((x) => !x.archived && stockInfo(x)?.low);

// ---------- Kalender-Export (.ics) ----------
// Zuverlässige Erinnerungen auch bei geschlossener App: der Kalender des Handys übernimmt den Alarm.
const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
const icsDate = (date, time) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
export function buildICS(S, { supps = true, meals = true, lead = 0, from = dkey() } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IRONCORE//Tagesplan//DE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:IRONCORE'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const ev = (uid, title, desc, time, days) => {
    if (!days.length || !validTime(time)) return;
    // Erster Termin: nächster passender Wochentag ab heute
    let start = from;
    for (let i = 0; i < 7 && !days.includes(weekdayOf(start)); i++) start = addDays(start, 1);
    lines.push('BEGIN:VEVENT', `UID:${uid}@ironcore`, `DTSTAMP:${stamp}`, `DTSTART:${icsDate(start, time)}`, `DTEND:${icsDate(start, fromMin(Math.min(toMin(time) + 10, 1439)))}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => ICS_DAYS[d]).join(',')}`, `SUMMARY:${icsText(title)}`);
    if (desc) lines.push(`DESCRIPTION:${icsText(desc)}`);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(title)}`, `TRIGGER:-PT${Math.max(0, lead)}M`, 'END:VALARM', 'END:VEVENT');
  };
  if (supps) for (const s of S.supps) {
    if (s.archived) continue;
    for (const sc of s.schedule || []) {
      const slot = sc.meal ? S.mealSlots.find((x) => x.id === sc.meal) : null;
      const time = validTime(sc.time) ? sc.time : slot?.time;
      const amount = sc.amount ?? s.serving;
      ev(`supp-${s.id}-${sc.id}`, `Supplement: ${s.name}${amount ? ` (${String(amount).replace('.', ',')} ${s.unit})` : ''}`, 'Erinnerung aus IRONCORE – dein eigener Plan, keine Empfehlung.', time, sc.days || []);
    }
  }
  if (meals) for (const m of S.mealSlots) ev(`meal-${m.id}`, `Mahlzeit: ${m.name}`, 'Erinnerung aus IRONCORE.', m.time, [0, 1, 2, 3, 4, 5, 6]);
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
