// IRONCORE-Löwe: zentrale Zuordnung Ausdruck → Bild und wiederverwendbare Bausteine.
// Die Bilder sind unveränderte Ausschnitte aus dem offiziellen Konzeptbild (scripts/mascot-crop.py).
// Bewusst ohne Abhängigkeiten (auch in Node-Tests ladbar)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const DIR = '/images/mascot/';
/** Vorhandene Motive mit Originalgröße (px) und Beschreibung. */
export const MASCOT_FILES = {
  welcome: { w: 252, h: 397, alt: 'zeigt auf dich' },
  portrait: { w: 330, h: 342, alt: 'Porträt' },
  neutral: { w: 142, h: 154, alt: 'ruhig und selbstbewusst' },
  friendly: { w: 142, h: 154, alt: 'freundlich' },
  motivated: { w: 142, h: 154, alt: 'motiviert' },
  focused: { w: 136, h: 154, alt: 'fokussiert' },
  happy: { w: 138, h: 154, alt: 'glücklich' },
  thinking: { w: 136, h: 154, alt: 'denkt nach' },
  determined: { w: 138, h: 154, alt: 'entschlossen' },
  supportive: { w: 136, h: 154, alt: 'Daumen hoch' },
  celebrating: { w: 172, h: 154, alt: 'feiert' },
  explaining: { w: 128, h: 160, alt: 'erklärt' },
  workout: { w: 210, h: 180, alt: 'mit Hantel' },
  nutrition: { w: 186, h: 180, alt: 'mit einer Mahlzeit' },
  supplements: { w: 188, h: 180, alt: 'mit Shaker und Kapsel' },
  water: { w: 192, h: 180, alt: 'beim Trinken' },
  goals: { w: 218, h: 180, alt: 'zeigt auf den Fortschritt' },
  shopping: { w: 210, h: 180, alt: 'mit Einkaufsliste' },
};
// Fehlt ein Ausdruck, wird das nächstliegende vorhandene Motiv verwendet
const FALLBACK = { explain: 'explaining', celebrate: 'celebrating', support: 'supportive', water: 'water', hydration: 'water', training: 'workout', food: 'nutrition', meal: 'nutrition', supps: 'supplements', shop: 'shopping', progress: 'focused', calm: 'neutral' };

export function mascotFile(state) {
  const s = MASCOT_FILES[state] ? state : FALLBACK[state] || 'neutral';
  return { id: s, src: DIR + s + '.webp', ...MASCOT_FILES[s] };
}

/** Bild des Löwen. size: xs | sm | md | lg */
export function mascot(state = 'neutral', { size = 'md', cls = '', decorative = false } = {}) {
  const f = mascotFile(state);
  return `<img class="mascot m-${size} ${cls}" src="${f.src}" width="${f.w}" height="${f.h}" alt="${decorative ? '' : `IRONCORE-Löwe ${esc(f.alt)}`}" decoding="async" draggable="false" data-mascot="${f.id}">`;
}

/** Löwe mit Sprechblase. */
export function mascotSays(state, message, { size = 'sm', title = '' } = {}) {
  return `<div class="m-say">${mascot(state, { size })}<div class="m-bubble">${title ? `<b>${esc(title)}</b>` : ''}<p>${esc(message)}</p></div></div>`;
}
