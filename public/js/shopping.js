// Wochenplan → Einkaufsliste. Reine Logik ohne DOM.
// Zusammengefasst wird nur, was eindeutig dasselbe ist: gleicher Name (Groß-/Kleinschreibung und Leerzeichen egal)
// UND verträgliche Einheiten (g/kg, ml/l). Alles andere bleibt getrennt – es wird nicht geraten.
import { addDays } from './logic.js';

export const ING_UNITS = ['g', 'kg', 'ml', 'l', 'Stk', 'Pckg'];
export const SHOP_CATEGORIES = ['Fleisch & Fisch', 'Milchprodukte & Eier', 'Gemüse', 'Obst', 'Kohlenhydrate & Getreide', 'Tiefkühl', 'Vorrat', 'Supplements', 'Sonstiges'];
const FAMILY = { g: 'mass', kg: 'mass', ml: 'vol', l: 'vol', Stk: 'count', Pckg: 'pack' };
const FACTOR = { g: 1, kg: 1000, ml: 1, l: 1000, Stk: 1, Pckg: 1 };

export const normName = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
export const familyOf = (unit) => FAMILY[unit] || 'other:' + unit;
export const itemKey = (name, unit) => `${normName(name)}|${familyOf(unit)}`;
export const weekDates = (monday) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** Basis-Menge (g, ml, Stück, Packung) → Anzeige mit passender Einheit. */
export function display(base, family) {
  const r = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
  if (family === 'mass') return base >= 1000 ? { qty: r(base / 1000, 2), unit: 'kg' } : { qty: r(base, 0), unit: 'g' };
  if (family === 'vol') return base >= 1000 ? { qty: r(base / 1000, 2), unit: 'l' } : { qty: r(base, 0), unit: 'ml' };
  if (family === 'count') return { qty: r(base, 2), unit: 'Stk' };
  if (family === 'pack') return { qty: r(base, 2), unit: 'Pckg' };
  return { qty: r(base, 2), unit: family.replace(/^other:/, '') };
}
export const toBase = (qty, unit) => Number(qty) * (FACTOR[unit] || 1);

const RULES = [
  ['Fleisch & Fisch', /hähnchen|huhn|pute|rind|schwein|hack|lachs|thunfisch|fisch|garnele|steak|schinken/],
  ['Milchprodukte & Eier', /quark|skyr|joghurt|milch|käse|mozzarella|frischkäse|\bei\b|eier|eiklar|butter|sahne/],
  ['Supplements', /whey|protein ?pulver|kreatin|casein/],
  ['Tiefkühl', /\btk\b|tiefkühl|gefroren/],
  ['Obst', /banane|apfel|beere|orange|kiwi|mango|traube|obst|zitrone/],
  ['Kohlenhydrate & Getreide', /reis|nudel|pasta|hafer|brot|kartoffel|reiswaffel|wrap|tortilla|couscous|quinoa|müsli/],
  ['Gemüse', /brokkoli|gemüse|salat|tomate|gurke|paprika|zwiebel|zucchini|spinat|karotte|möhre|pilz|bohne/],
  ['Vorrat', /öl|erdnussbutter|mandel|nuss|gewürz|salz|pfeffer|honig|soße|sauce|essig|senf/],
];
export function guessCategory(name) {
  const n = normName(name);
  for (const [cat, re] of RULES) if (re.test(n)) return cat;
  return 'Sonstiges';
}

/** Alle Zutaten der Woche einsammeln. mealPlan: { [date]: { [slotId]: [zutat] } } */
export function collect(mealPlan, dates) {
  const out = [];
  for (const d of dates) for (const items of Object.values(mealPlan[d] || {})) for (const it of items || []) {
    if (!it || !normName(it.name) || !(Number(it.qty) > 0)) continue;
    out.push(it);
  }
  return out;
}
/** Gleiche Zutaten mit verträglicher Einheit addieren. Ergebnis: [{key, name, base, family, category, note}] */
export function consolidate(ingredients) {
  const map = new Map();
  for (const it of ingredients) {
    const key = itemKey(it.name, it.unit);
    const cur = map.get(key);
    if (cur) {
      cur.base += toBase(it.qty, it.unit);
      if (it.note && !cur.notes.includes(it.note)) cur.notes.push(it.note);
      if (cur.category === 'Sonstiges' && it.category) cur.category = it.category;
    } else {
      map.set(key, { key, name: String(it.name).trim().replace(/\s+/g, ' '), base: toBase(it.qty, it.unit), family: familyOf(it.unit), category: it.category || guessCategory(it.name), notes: it.note ? [it.note] : [] });
    }
  }
  return [...map.values()].map((x) => ({ ...x, note: x.notes.join(' · ') }));
}

/**
 * Liste neu erzeugen, ohne Eigenes zu verlieren:
 * - manuelle Einträge bleiben unverändert
 * - automatische Einträge werden aktualisiert (Häkchen „gekauft“/„schon da“ bleiben erhalten)
 * - hat der Nutzer eine Menge geändert, bleibt seine Menge; die neue Planmenge wird als Hinweis gezeigt
 * - Zutaten, die nicht mehr im Plan stehen, fallen weg
 */
export function mergeList(existing, generated, newId) {
  const items = existing.filter((x) => x.source === 'manual');
  const old = new Map(existing.filter((x) => x.source === 'auto').map((x) => [x.key, x]));
  for (const g of generated) {
    const d = display(g.base, g.family);
    const prev = old.get(g.key);
    if (prev) {
      items.push({ ...prev, name: g.name, category: prev.categoryEdited ? prev.category : g.category, planQty: d.qty, planUnit: d.unit, ...(prev.edited ? {} : { qty: d.qty, unit: d.unit }), autoNote: g.note });
    } else {
      items.push({ id: newId(), key: g.key, source: 'auto', name: g.name, qty: d.qty, unit: d.unit, planQty: d.qty, planUnit: d.unit, category: g.category, note: '', autoNote: g.note, bought: false, inStock: false, edited: false });
    }
  }
  return items;
}
export function stats(items) {
  const live = items.filter((x) => !x.cleared);
  const need = live.filter((x) => !x.inStock);
  const bought = need.filter((x) => x.bought).length;
  return { total: need.length, bought, remaining: need.length - bought, inStock: live.length - need.length, pct: need.length ? bought / need.length : 0 };
}
const fmtQ = (q) => String(q).replace('.', ',');
/** Lesbarer Text zum Kopieren/Teilen, nach Kategorien gruppiert. */
export function toText(items, title) {
  const lines = [title, ''];
  for (const cat of SHOP_CATEGORIES) {
    const list = items.filter((x) => (SHOP_CATEGORIES.includes(x.category) ? x.category : 'Sonstiges') === cat && !x.inStock && !x.cleared);
    if (!list.length) continue;
    lines.push(cat.toUpperCase());
    for (const x of list) lines.push(`${x.bought ? '☑' : '☐'} ${x.name}${x.qty ? ` – ${fmtQ(x.qty)} ${x.unit}` : ''}${x.note ? ` (${x.note})` : ''}`);
    lines.push('');
  }
  const stock = items.filter((x) => x.inStock && !x.cleared);
  if (stock.length) lines.push(`Schon da: ${stock.map((x) => x.name).join(', ')}`);
  return lines.join('\n').trim() + '\n';
}
