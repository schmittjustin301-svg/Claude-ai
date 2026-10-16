// Animierte weiße „Ultra“-Dose für den Wasser-Tracker: füllt sich mit dem Trinkziel.
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

export function monsterCan(pct) {
  const from = lastPct == null ? pct : lastPct;
  lastPct = pct;
  const full = pct >= 1;
  const wave = (y) => `M-120 ${y} q15 -5 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 V240 H-120 Z`;
  return `<div class="can ${full ? 'full' : ''}" data-can-from="${levelY(from)}" data-can-to="${levelY(pct)}" role="img" aria-label="Wasser: ${Math.round(pct * 100)} Prozent vom Tagesziel">
  <svg viewBox="0 0 120 232" aria-hidden="true">
    <defs>
      <linearGradient id="canBody" x1="0" x2="1">
        <stop offset="0" stop-color="#bdbdbd"/><stop offset=".18" stop-color="#f4f4f4"/><stop offset=".42" stop-color="#ffffff"/>
        <stop offset=".72" stop-color="#e9e9e9"/><stop offset="1" stop-color="#a9a9a9"/>
      </linearGradient>
      <linearGradient id="canRim" x1="0" x2="1">
        <stop offset="0" stop-color="#8f8f8f"/><stop offset=".35" stop-color="#e6e6e6"/><stop offset=".6" stop-color="#cfcfcf"/><stop offset="1" stop-color="#7d7d7d"/>
      </linearGradient>
      <linearGradient id="canWater" x1="0" x2="1">
        <stop offset="0" stop-color="#7fb8d4"/><stop offset=".3" stop-color="#bfe3f3"/><stop offset=".55" stop-color="#d9f0fa"/><stop offset="1" stop-color="#6aa6c4"/>
      </linearGradient>
      <linearGradient id="clawFill" x1="0" x2="1">
        <stop offset="0" stop-color="#9a9a9a"/><stop offset=".5" stop-color="#f7f7f7"/><stop offset="1" stop-color="#b5b5b5"/>
      </linearGradient>
      <clipPath id="canClip"><rect x="11" y="26" width="98" height="196" rx="11"/></clipPath>
    </defs>
    <!-- Deckel -->
    <path d="M20 10 Q60 3 100 10 L108 26 H12 Z" fill="url(#canRim)"/>
    <rect x="44" y="6" width="32" height="5" rx="2.5" fill="#9c9c9c"/>
    <!-- Körper -->
    <rect x="11" y="26" width="98" height="196" rx="11" fill="url(#canBody)"/>
    <!-- Flüssigkeit -->
    <g clip-path="url(#canClip)">
      <g class="can-level" style="transform:translateY(${levelY(from)}px)">
        <g class="can-wave2"><path d="${wave(2)}" fill="#a9d7ec" opacity=".55"/></g>
        <g class="can-wave"><path d="${wave(0)}" fill="url(#canWater)" opacity=".9"/></g>
        ${pct > 0.03 ? '<circle class="can-bubble b1" cx="34" cy="150" r="2"/><circle class="can-bubble b2" cx="74" cy="170" r="1.6"/><circle class="can-bubble b3" cx="56" cy="190" r="2.3"/>' : ''}
      </g>
    </g>
    <!-- Glanzkante -->
    <rect x="22" y="30" width="7" height="186" rx="3.5" fill="#fff" opacity=".55"/>
    <!-- Beschriftung -->
    <text x="60" y="47" text-anchor="middle" class="can-t1">ZERO ZUCKER</text>
    ${CLAWS.map((d) => `<path d="${d}" fill="url(#clawFill)" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/>`).join('')}
    <text x="60" y="192" text-anchor="middle" class="can-t2">HYDRATION</text>
    <text x="60" y="207" text-anchor="middle" class="can-t3">${Math.min(999, Math.round(pct * 100))} %</text>
    <!-- Boden -->
    <path d="M14 214 Q60 232 106 214 V219 Q60 236 14 219 Z" fill="url(#canRim)" opacity=".9"/>
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
