// Animierte Dose für den Wasser-Tracker: füllt sich mit dem Trinkziel, Farbe frei wählbar.
// Reines SVG + CSS. Der Füllstand gleitet vom letzten Stand zum neuen, die Oberfläche wellt sich.

let lastPct = null;

const H_TOP = 34, H_BOT = 226; // Innenbereich der Dose (y), in dem die Flüssigkeit steigt
const levelY = (pct) => H_TOP + (1 - Math.max(0, Math.min(1, pct))) * (H_BOT - H_TOP);

// Drei Krallenspuren (stilisiert)
const CLAWS = [
  'M31 74 L44 67 L46 76 L42 85 L45 96 L41 108 L44 121 L40 134 L42 146 L37 160 L35 144 L32 130 L34 116 L30 102 L33 89 Z',
  'M51 78 L64 71 L66 81 L62 93 L65 106 L61 120 L64 134 L60 148 L62 162 L56 174 L54 156 L51 141 L54 126 L50 112 L53 98 L49 88 Z',
  'M72 71 L88 63 L90 73 L85 84 L88 96 L84 109 L86 123 L81 137 L83 147 L78 154 L76 139 L74 124 L77 110 L73 97 L76 85 Z',
];

// Dosenfarben. Neue Farbe = ein Eintrag hier (Körper-Verlauf, Krallen-Verlauf, Kontur, Schrift, Akzent).
export const CAN_COLORS = {
  white: { name: 'Weiß', body: ['#bdbdbd', '#f4f4f4', '#ffffff', '#e9e9e9', '#a9a9a9'], claw: ['#9a9a9a', '#f7f7f7', '#b5b5b5'], stroke: '#111', text: '#111', accent: '#3aa6d8', shine: 0.55 },
  green: { name: 'Grün', body: ['#0a3510', '#1c7f28', '#33b043', '#1a7025', '#082c0d'], claw: ['#a9d9a0', '#f2fff0', '#bfe6b7'], stroke: '#06210a', text: '#effff0', accent: '#c9ffbf', shine: 0.28 },
  blue: { name: 'Blau', body: ['#0a2552', '#1b58b8', '#3d80e6', '#194ea2', '#081f46'], claw: ['#a9c3e6', '#f3f8ff', '#bcd2f0'], stroke: '#06142e', text: '#ffffff', accent: '#a8dcff', shine: 0.3 },
  gold: { name: 'Gold', body: ['#5e4710', '#c39b2e', '#f3d77a', '#c9a43a', '#5a440f'], claw: ['#1c1c1c', '#3a3a3a', '#141414'], stroke: '#0a0a0a', text: '#141414', accent: '#141414', shine: 0.45 },
  purple: { name: 'Lila', body: ['#260b44', '#5e249f', '#8e4fe0', '#6a2bb3', '#220a3d'], claw: ['#cdb8ea', '#fbf7ff', '#dccbf3'], stroke: '#16052a', text: '#ffffff', accent: '#e6d1ff', shine: 0.3 },
  red: { name: 'Rot', body: ['#4d080c', '#ad1720', '#ec3a44', '#c41b26', '#46070b'], claw: ['#e9b3b6', '#fff6f6', '#f2c7c9'], stroke: '#2a0306', text: '#ffffff', accent: '#ffd3d5', shine: 0.3 },
  black: { name: 'Schwarz', body: ['#050505', '#1f1f1f', '#383838', '#262626', '#050505'], claw: ['#3d8f2a', '#8be35f', '#3d8f2a'], stroke: '#000', text: '#e8e8e8', accent: '#8be35f', shine: 0.18 },
};
export const canColor = (id) => CAN_COLORS[id] || CAN_COLORS.white;
let seq = 0;

/**
 * Dose zeichnen. pct = Anteil am Trinkziel. color = Schlüssel aus CAN_COLORS.
 * preview: kleine, ruhige Vorschau (für die Farbauswahl) – ohne Animation und ohne den Füllstand-Speicher zu ändern.
 */
export function monsterCan(pct, { color = 'white', preview = false } = {}) {
  const C = canColor(color), id = 'cn' + (++seq);
  const from = preview ? pct : lastPct == null ? pct : lastPct;
  if (!preview) lastPct = pct;
  const full = pct >= 1;
  const wave = (y) => `M-120 ${y} q15 -5 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 V240 H-120 Z`;
  const stops = (arr, offs) => arr.map((c, i) => `<stop offset="${offs[i]}" stop-color="${c}"/>`).join('');
  return `<div class="can ${full && !preview ? 'full' : ''} ${preview ? 'preview' : ''}" ${preview ? '' : `data-can-from="${levelY(from)}" data-can-to="${levelY(pct)}"`} role="img" aria-label="${preview ? `Dose ${C.name}` : `Wasser: ${Math.round(pct * 100)} Prozent vom Tagesziel`}">
  <svg viewBox="0 0 120 232" aria-hidden="true">
    <defs>
      <linearGradient id="${id}b" x1="0" x2="1">${stops(C.body, [0, 0.18, 0.42, 0.72, 1])}</linearGradient>
      <linearGradient id="${id}r" x1="0" x2="1"><stop offset="0" stop-color="#8f8f8f"/><stop offset=".35" stop-color="#e6e6e6"/><stop offset=".6" stop-color="#cfcfcf"/><stop offset="1" stop-color="#7d7d7d"/></linearGradient>
      <linearGradient id="${id}w" x1="0" x2="1"><stop offset="0" stop-color="#7fb8d4"/><stop offset=".3" stop-color="#bfe3f3"/><stop offset=".55" stop-color="#d9f0fa"/><stop offset="1" stop-color="#6aa6c4"/></linearGradient>
      <linearGradient id="${id}c" x1="0" x2="1">${stops(C.claw, [0, 0.5, 1])}</linearGradient>
      <clipPath id="${id}k"><rect x="11" y="26" width="98" height="196" rx="11"/></clipPath>
    </defs>
    <path d="M20 10 Q60 3 100 10 L108 26 H12 Z" fill="url(#${id}r)"/>
    <rect x="44" y="6" width="32" height="5" rx="2.5" fill="#9c9c9c"/>
    <rect x="11" y="26" width="98" height="196" rx="11" fill="url(#${id}b)"/>
    <g clip-path="url(#${id}k)">
      <g class="can-level" style="transform:translateY(${levelY(from)}px)">
        <g class="${preview ? '' : 'can-wave2'}"><path d="${wave(2)}" fill="#a9d7ec" opacity=".55"/></g>
        <g class="${preview ? '' : 'can-wave'}"><path d="${wave(0)}" fill="url(#${id}w)" opacity=".88"/></g>
        ${!preview && pct > 0.03 ? '<circle class="can-bubble b1" cx="34" cy="150" r="2"/><circle class="can-bubble b2" cx="74" cy="170" r="1.6"/><circle class="can-bubble b3" cx="56" cy="190" r="2.3"/>' : ''}
      </g>
    </g>
    <rect x="22" y="30" width="7" height="186" rx="3.5" fill="#fff" opacity="${C.shine}"/>
    <rect x="96" y="34" width="3" height="178" rx="1.5" fill="#fff" opacity="${C.shine * 0.45}"/>
    <text x="60" y="47" text-anchor="middle" class="can-t1" style="fill:${C.text}">ZERO ZUCKER</text>
    ${CLAWS.map((d) => `<path d="${d}" fill="url(#${id}c)" stroke="${C.stroke}" stroke-width="2.2" stroke-linejoin="round"/>`).join('')}
    ${preview ? '' : `<text x="60" y="192" text-anchor="middle" class="can-t2" style="fill:${C.accent}">HYDRATION</text>
    <text x="60" y="207" text-anchor="middle" class="can-t3" style="fill:${C.text}">${Math.min(999, Math.round(pct * 100))} %</text>`}
    <path d="M14 214 Q60 232 106 214 V219 Q60 236 14 219 Z" fill="url(#${id}r)" opacity=".9"/>
  </svg>
</div>`;
}

// Nach dem Zeichnen vom alten zum neuen Füllstand gleiten lassen
document.addEventListener('rendered', (e) => {
  e.detail.root.querySelectorAll('.can[data-can-to]').forEach((el) => {
    const g = el.querySelector('.can-level');
    if (!g || el.dataset.canFrom === el.dataset.canTo) return;
    requestAnimationFrame(() => requestAnimationFrame(() => { g.style.transform = `translateY(${el.dataset.canTo}px)`; }));
  });
});
