// Tests für Supplements/Zeitpläne, Einkaufsliste, Gamification und die Migration auf Version 3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, normalize, migrateFromFit, upgradeSupp } from '../public/js/store.js';
import * as SC from '../public/js/schedule.js';
import * as SH from '../public/js/shopping.js';
import * as G from '../public/js/gamify.js';
import { addDays } from '../public/js/logic.js';

const T = '2026-10-15'; // Donnerstag
const tsAt = (date, time) => SC.at(date, time);
function state() {
  const S = defaults();
  S.supps = [upgradeSupp({ id: 'cr', name: 'Kreatin', dose: '5 g' })];
  S.supps[0].schedule = [{ id: 'a', time: '08:00', amount: 5, days: [0, 1, 2, 3, 4, 5, 6] }, { id: 'b', time: '', meal: 'dinner', amount: 5, days: [4] }];
  return S;
}

test('Migration v2 → v3: alte Supplements, Häkchen, Mahlzeiten-Namen, Kraftziele', () => {
  const v2 = defaults();
  v2.v = 2;
  v2.supps = [{ id: 's1', name: 'Vitamin D3', dose: '2000 IE' }, { id: 's2', name: 'Fischöl', dose: 'morgens 2 Stück' }];
  v2.days = { [T]: { water: 500, supps: ['s1', 'weg'] } };
  v2.meals = { [T]: [{ id: 'm', slot: 'Frühstück', name: 'Hafer', kcal: 300 }, { id: 'n', slot: 'Pre-Workout', name: 'Reiswaffel', kcal: 100 }] };
  v2.goals.strength = [{ id: 'g1', key: 'bench', name: 'Bankdrücken', kg: 100, reps: 5, created: 0 }];
  delete v2.mealSlots;
  const s = normalize(JSON.parse(JSON.stringify(v2)));
  assert.equal(s.v, 3);
  assert.deepEqual([s.supps[0].serving, s.supps[0].unit, s.supps[0].category], [2000, 'IE', 'Vitamine']);
  assert.equal(s.supps[1].serving, null, 'unklare Dosis wird nicht erfunden');
  assert.equal(s.supps[1].notes, 'morgens 2 Stück');
  assert.deepEqual(s.supps[0].schedule, [], 'kein automatischer Zeitplan');
  assert.equal(s.intakes[T]['s1:_'].status, 'taken');
  assert.equal(Object.keys(s.intakes[T]).length, 1, 'unbekannte IDs werden ignoriert');
  assert.equal(s.days[T].supps, undefined);
  assert.equal(s.meals[T][0].slot, 'breakfast');
  const pw = s.mealSlots.find((x) => x.name === 'Pre-Workout');
  assert.ok(pw && s.meals[T][1].slot === pw.id, 'unbekannter Mahlzeiten-Name wird eigene Mahlzeit');
  assert.equal(s.goals.strength.length, 0);
  assert.equal(s.goals.custom[0].type, 'pr');
  assert.deepEqual(s.goals.custom[0].params, { key: 'bench', reps: 5 });
  // idempotent
  const again = normalize(JSON.parse(JSON.stringify(s)));
  assert.equal(again.goals.custom.length, 1);
  assert.equal(again.mealSlots.length, s.mealSlots.length);
  assert.ok(defaults().supps.length === 0, 'neue Installation: keine vorgegebenen Supplements');
});

test('FIT-Migration landet ebenfalls im v3-Modell', () => {
  const s = migrateFromFit({ supps: [{ id: 'k', name: 'Kreatin', dose: '5 g' }], days: { [T]: { water: 0, supps: ['k'], cardio: [] } }, meals: { [T]: [{ id: 'x', slot: 'Snacks', name: 'Riegel', kcal: 200 }] } });
  assert.equal(s.intakes[T]['k:_'].status, 'taken');
  assert.equal(s.meals[T][0].slot, 'snacks');
  assert.equal(s.supps[0].category, 'Kreatin');
});

test('Zeitplan: Wochentage, Mahlzeit-Bezug, Tages-Abweichung', () => {
  const S = state();
  let occ = SC.suppOccurrences(S, T);
  assert.deepEqual(occ.map((o) => o.time), ['08:00', '19:00'], 'Donnerstag: 08:00 + mit dem Abendessen');
  assert.equal(SC.suppOccurrences(S, addDays(T, 1)).length, 1, 'Freitag nur 08:00');
  S.mealDays[T] = { dinner: { time: '20:30' } };
  occ = SC.suppOccurrences(S, T);
  assert.equal(occ[1].time, '20:30', 'verschobenes Abendessen verschiebt die Einnahme');
  S.supps[0].schedule[0].since = addDays(T, 1);
  assert.equal(SC.suppOccurrences(S, T).filter((o) => o.sched.id === 'a').length, 0, 'vor dem Anlegen wird nichts gezählt');
  delete S.supps[0].schedule[0].since;
  S.supps[0].archived = true;
  assert.equal(SC.suppOccurrences(S, T).length, 0);
});

test('Status: kommend, fällig, geschlummert, erledigt, übersprungen', () => {
  const now = tsAt(T, '09:00');
  assert.equal(SC.statusOf(null, T, '08:00', now), 'due');
  assert.equal(SC.statusOf(null, T, '10:00', now), 'upcoming');
  assert.equal(SC.statusOf({ status: 'snoozed', until: now + 60000 }, T, '08:00', now), 'snoozed');
  assert.equal(SC.statusOf({ status: 'snoozed', until: now - 1 }, T, '08:00', now), 'due');
  assert.equal(SC.statusOf({ status: 'taken' }, T, '08:00', now), 'done');
  assert.equal(SC.statusOf({ status: 'skipped' }, T, '08:00', now), 'skipped');
  assert.equal(SC.statusOf(null, addDays(T, -1), '08:00', now), 'open');
});

test('Timeline + nächster Termin + Einnahmetreue', () => {
  const S = state();
  const now = tsAt(T, '09:00');
  const tl = SC.timeline(S, T, now);
  assert.deepEqual(tl.map((e) => `${e.time} ${e.kind}`), ['08:00 meal', '08:00 supp', '12:30 meal', '16:00 meal', '19:00 meal', '19:00 supp']);
  const nx = SC.nextEvent(S, now);
  assert.equal(nx.status, 'due');
  assert.equal(nx.overdueMin, 60);
  S.intakes[T] = { 'cr:a': { status: 'taken', at: now, amount: 5 } };
  S.mealDays[T] = { breakfast: { status: 'done', at: now } };
  assert.equal(SC.nextEvent(S, now).time, '12:30');
  const a = SC.dayAdherence(S, T, now);
  assert.deepEqual([a.scheduled, a.taken], [1, 1], 'Abend-Einnahme ist noch nicht fällig und zählt noch nicht');
  const past = SC.dayAdherence(S, addDays(T, -1), now);
  assert.deepEqual([past.scheduled, past.taken], [1, 0]);
});

test('Vorrat: Reichweite und Mindestbestand', () => {
  const S = state();
  S.supps[0].stock = 50; // 5 g täglich + 5 g donnerstags = 40 g/Woche
  assert.equal(SC.stockInfo(S.supps[0]).daysLeft, Math.floor(50 / (40 / 7)));
  assert.equal(SC.stockInfo(S.supps[0]).low, false);
  S.supps[0].minStock = 60;
  assert.equal(SC.stockInfo(S.supps[0]).low, true);
  assert.equal(SC.lowStock(S).length, 1);
});

test('Kalender-Export: Wiederholung, Alarm, stabile IDs', () => {
  const S = state();
  const ics = SC.buildICS(S, { from: T, lead: 5 });
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /UID:supp-cr-a@ironcore/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH,FR,SA/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=TH\r\n/);
  assert.match(ics, /DTSTART:20261015T190000/, 'Mahlzeit-gebundene Einnahme nutzt die Mahlzeit-Uhrzeit');
  assert.match(ics, /TRIGGER:-PT5M/);
  assert.match(ics, /SUMMARY:Supplement: Kreatin \(5 g\)/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2 + S.mealSlots.length);
});

test('Einkaufsliste: zusammenfassen nur bei gleichem Namen und verträglicher Einheit', () => {
  const plan = {
    '2026-10-12': { breakfast: [{ name: 'Haferflocken', qty: 100, unit: 'g' }], lunch: [{ name: 'Reis', qty: 200, unit: 'g' }], dinner: [{ name: 'reis ', qty: 150, unit: 'g' }] },
    '2026-10-13': { lunch: [{ name: 'Reis', qty: 1, unit: 'kg' }, { name: 'Reis', qty: 2, unit: 'Pckg' }, { name: 'Basmatireis', qty: 100, unit: 'g' }, { name: 'Milch', qty: 500, unit: 'ml' }, { name: 'Milch', qty: 1, unit: 'l' }, { name: 'Eier', qty: 6, unit: 'Stk' }, { name: 'Leer', qty: 0, unit: 'g' }] },
    '2026-10-20': { lunch: [{ name: 'Reis', qty: 999, unit: 'g' }] }, // andere Woche
  };
  const ings = SH.collect(plan, SH.weekDates('2026-10-12'));
  const c = SH.consolidate(ings);
  const find = (n, fam) => c.find((x) => x.key === `${n}|${fam}`);
  assert.equal(find('haferflocken', 'mass').base, 100);
  assert.equal(find('reis', 'mass').base, 1350, '200 g + 150 g + 1 kg');
  assert.equal(find('reis', 'pack').base, 2, 'Packungen bleiben getrennt');
  assert.ok(find('basmatireis', 'mass'), 'ähnlicher Name wird nicht zusammengelegt');
  assert.equal(find('milch', 'vol').base, 1500);
  assert.equal(c.length, 6, 'leere Mengen fallen weg');
  assert.deepEqual(SH.display(1350, 'mass'), { qty: 1.35, unit: 'kg' });
  assert.deepEqual(SH.display(350, 'mass'), { qty: 350, unit: 'g' });
  assert.equal(find('reis', 'mass').category, 'Kohlenhydrate & Getreide');
  assert.equal(find('eier', 'count').category, 'Milchprodukte & Eier');
});

test('Einkaufsliste neu erzeugen: Eigenes bleibt, Häkchen bleiben, keine Duplikate', () => {
  let n = 0; const id = () => 'i' + (++n);
  const gen1 = SH.consolidate([{ name: 'Reis', qty: 350, unit: 'g' }, { name: 'Hafer', qty: 100, unit: 'g' }, { name: 'Lachs', qty: 250, unit: 'g' }]);
  let items = SH.mergeList([], gen1, id);
  items.push({ id: id(), key: 'm', source: 'manual', name: 'Spülmittel', qty: 1, unit: 'Stk', category: 'Sonstiges', bought: false, inStock: false });
  items.find((x) => x.name === 'Reis').bought = true;
  const hafer = items.find((x) => x.name === 'Hafer'); hafer.qty = 500; hafer.edited = true;
  items.find((x) => x.name === 'Lachs').inStock = true;
  const gen2 = SH.consolidate([{ name: 'Reis', qty: 500, unit: 'g' }, { name: 'Hafer', qty: 200, unit: 'g' }, { name: 'Lachs', qty: 250, unit: 'g' }]);
  items = SH.mergeList(items, gen2, id);
  const by = (nm) => items.filter((x) => x.name === nm);
  assert.equal(by('Reis').length, 1, 'kein Duplikat');
  assert.equal(by('Reis')[0].qty, 500);
  assert.equal(by('Reis')[0].bought, true);
  assert.equal(by('Hafer')[0].qty, 500, 'eigene Menge bleibt');
  assert.equal(by('Hafer')[0].planQty, 200, 'neue Planmenge als Hinweis');
  assert.equal(by('Lachs')[0].inStock, true);
  assert.equal(by('Spülmittel').length, 1, 'manueller Eintrag bleibt');
  items = SH.mergeList(items, SH.consolidate([{ name: 'Reis', qty: 500, unit: 'g' }]), id);
  assert.deepEqual(items.map((x) => x.name).sort(), ['Reis', 'Spülmittel'], 'nicht mehr geplante Zutaten fallen weg, Manuelles bleibt');
  const st = SH.stats([{ bought: true }, { bought: false }, { inStock: true, bought: false }]);
  assert.deepEqual([st.total, st.bought, st.remaining, st.inStock, st.pct], [2, 1, 1, 1, 0.5]);
  assert.match(SH.toText([{ name: 'Reis', qty: 0.5, unit: 'kg', category: 'Kohlenhydrate & Getreide', bought: false }], 'KW 42'), /☐ Reis – 0,5 kg/);
});

test('XP: abgeleitet, keine Doppelbelohnung, Löschen bleibt konsistent', () => {
  const S = defaults();
  const w = (id, date) => ({ id, date, name: 'Push', start: tsAt(date, '18:00'), end: tsAt(date, '19:00'), exercises: [{ exId: 'b', name: 'Bank', sets: [{ w: 80, r: 8 }] }] });
  S.workouts = [w('w1', T), w('w2', T), w('w3', addDays(T, 1))];
  S.goals.weeklySessions = 0;
  let ev = G.ledger(S, addDays(T, 1));
  assert.equal(ev.filter((e) => e.kind === 'workout').length, 2, 'zwei Trainings am selben Tag = eine Belohnung');
  const keys = ev.map((e) => e.key);
  assert.equal(new Set(keys).size, keys.length, 'jeder Schlüssel nur einmal');
  assert.equal(G.ledger(S, addDays(T, 1)).length, ev.length, 'wiederholtes Berechnen bleibt gleich');
  S.workouts = S.workouts.filter((x) => x.id !== 'w3');
  ev = G.ledger(S, addDays(T, 1));
  assert.equal(ev.filter((e) => e.kind === 'workout').length, 1, 'gelöschtes Training nimmt die XP mit');
  // Wasser & Protein
  S.profile.waterGoal = 2000; S.days[T] = { water: 2000 };
  S.targets.p = 100; S.meals[T] = [{ id: 'x', slot: 'lunch', kcal: S.targets.kcal, p: 100, c: 0, f: 0 }];
  ev = G.ledger(S, T);
  assert.ok(ev.some((e) => e.key === `water:${T}`));
  assert.ok(ev.some((e) => e.key === `protein:${T}`));
  assert.ok(!ev.some((e) => e.key === `kcal:${T}`), 'Kalorien zählen erst nach Tagesende');
  assert.ok(G.ledger(S, addDays(T, 1)).some((e) => e.key === `kcal:${T}`));
});

test('Level-Kurve', () => {
  assert.equal(G.levelInfo(0).level, 1);
  assert.equal(G.levelInfo(99).level, 1);
  assert.equal(G.levelInfo(100).level, 2);
  assert.equal(G.levelInfo(300).level, 3);
  const l = G.levelInfo(150);
  assert.deepEqual([l.from, l.to, l.into, l.need], [100, 300, 50, 150]);
});

test('Serien: heute offen bricht nicht, Lücke beendet die Serie', () => {
  const S = defaults();
  S.profile.waterGoal = 1000;
  for (const i of [5, 4, 3, 1, 0]) S.days[addDays(T, -i)] = { water: i === 0 ? 0 : 1500 };
  const st = G.streak(S, (d) => (S.days[d]?.water || 0) >= 1000, T);
  assert.equal(st.current, 1, 'gestern erfüllt, heute noch offen → Serie 1 läuft weiter');
  assert.equal(st.best, 3);
});

test('Ziel-Fortschritt: Richtung, Begrenzung, fehlende Daten', () => {
  const S = defaults();
  S.weights = [{ id: 'a', ts: tsAt('2026-10-01', '08:00'), kg: 90 }, { id: 'b', ts: tsAt(T, '08:00'), kg: 85 }];
  const down = G.goalProgress(S, { type: 'weight', startDate: '2026-10-01', targetValue: 80 }, T);
  assert.equal(down.start, 90);
  assert.ok(down.pct > 0 && down.pct < 1, 'Abnehmen erhöht den Fortschritt');
  const up = G.goalProgress(S, { type: 'manual', startValue: 10, currentValue: 25, targetValue: 20 }, T);
  assert.equal(up.pct, 1);
  assert.equal(up.exceeded, true);
  const zero = G.goalProgress(S, { type: 'manual', startValue: 5, currentValue: 5, targetValue: 5 }, T);
  assert.equal(zero.pct, 1, 'kein Teilen durch null');
  assert.ok(G.goalProgress(S, { type: 'weight', startDate: '2026-12-01', targetValue: 80 }, T).missing, 'ohne Messung kein erfundener Wert');
  S.workouts = [{ id: 'w', date: T, start: 1, end: 2, exercises: [] }];
  assert.equal(G.goalProgress(S, { type: 'workouts', startDate: '2026-10-01', targetValue: 4 }, T).pct, 0.25);
  assert.ok(G.goalProgress(S, { type: 'manual', currentValue: 1 }, T).missing, 'fehlender Zielwert wird gemeldet');
});

test('Erfolge: nur bei erfüllter Bedingung, bereits freigeschaltete nicht erneut', () => {
  const S = defaults();
  assert.ok(!G.newAchievements(S, T).some((a) => a.id === 'first_workout'));
  S.workouts = [{ id: 'w', date: T, name: 'P', start: 1, end: 2, exercises: [] }];
  assert.ok(G.newAchievements(S, T).some((a) => a.id === 'first_workout'));
  S.achievements.first_workout = T;
  assert.ok(!G.newAchievements(S, T).some((a) => a.id === 'first_workout'));
  assert.ok(G.ledger(S, T).some((e) => e.key === 'ach:first_workout'));
});

test('Tagesmissionen spiegeln echte Werte', () => {
  const S = state();
  S.profile.waterGoal = 3000; S.days[T] = { water: 1500 };
  S.intakes[T] = { 'cr:a': { status: 'taken' } };
  const m = G.missions(S, T, tsAt(T, '12:00'), []);
  const water = m.find((x) => x.id === 'water');
  assert.equal(water.progress, 0.5);
  const sup = m.find((x) => x.id === 'supps');
  assert.equal(sup.label, '1 / 2');
  assert.ok(!m.some((x) => x.id === 'workout'), 'ohne geplantes Training keine Trainingsmission');
});

test('Lebensmittel: Suche ignoriert Umlaute und Groß-/Kleinschreibung, alle Wörter müssen passen', async () => {
  const { searchFoods } = await import('../public/js/logic.js');
  const foods = [{ name: 'Hähnchenbrust (roh)' }, { name: 'Hähnchenbrust (gegart)', fav: true }, { name: 'Rinderhack 5 % (roh)' }, { name: 'Weißbrot' }];
  assert.deepEqual(searchFoods(foods, 'hahnchen roh').map((f) => f.name), ['Hähnchenbrust (roh)']);
  assert.equal(searchFoods(foods, 'HÄHNCHEN').length, 2);
  assert.equal(searchFoods(foods, 'weiss')[0].name, 'Weißbrot');
  assert.equal(searchFoods(foods, 'xyz').length, 0);
  assert.equal(searchFoods(foods, '').length, 4);
});

test('Lebensmittel: neue Grund-Lebensmittel werden einmalig ergänzt, eigene bleiben unverändert', async () => {
  const { normalize, defaults } = await import('../public/js/store.js');
  const { SEED_FOODS } = await import('../public/js/seed.js');
  assert.ok(SEED_FOODS.length >= 200);
  const fresh = defaults();
  assert.equal(fresh.foods.length, SEED_FOODS.length);
  // älterer Stand ohne foodSeed, mit eigener Variante eines Grund-Lebensmittels
  const old = defaults();
  old.foods = [{ id: 'x', name: 'Banane', kcal: 999, p: 0, c: 0, f: 0, portion: 1, fav: true, used: 7, barcode: '' }];
  delete old.settings.foodSeed;
  const s = normalize(old);
  assert.equal(s.foods.filter((f) => f.name === 'Banane').length, 1);
  assert.equal(s.foods.find((f) => f.name === 'Banane').kcal, 999);
  assert.equal(s.foods.length, SEED_FOODS.length);
  // gelöschte kommen nicht zurück
  s.foods = s.foods.filter((f) => f.name !== 'Kokosöl');
  assert.ok(!normalize(s).foods.some((f) => f.name === 'Kokosöl'));
});
