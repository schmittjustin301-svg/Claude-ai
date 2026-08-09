import type { ReactNode } from "react";
import { CLICKER_UPGRADES, gymTierFor, shopLevel } from "../../lib/clicker";

/**
 * The gym, drawn from the save file.
 *
 * Every upgrade you own puts a piece of equipment in the room, every Coin-shop
 * item adds a fixture, and every Rebrand moves the whole thing into a bigger
 * place. It is flat vector art on purpose: emoji render differently on every
 * device and photographs would fight the rest of the app for attention.
 */

const WIDTH = 900;
const HEIGHT = 300;
const WALL_BOTTOM = 224;
/** Floor pieces are drawn with their base at y = 0 and grow upwards. */
const FLOOR_Y = 230;

/**
 * Walls and floor are drawn far wider than the viewBox. The scene is scaled to
 * fit the panel height, so on a wide screen it is narrower than its viewport —
 * the overhang keeps the room's surfaces running edge to edge instead of
 * leaving bare strips at the sides.
 */
const BLEED = 600;

const FLOOR_SLOTS = [90, 180, 270, 360, 450, 540, 630, 720, 810];
const WALL_SLOTS = [100, 225, 350, 475, 600, 725, 830];
const WALL_Y = 120;

const DARK = "#23262c";
const MID = "#3a3f48";
const LIGHT = "#565d69";

/** Bigger rooms fit more, so a well-stocked gym looks fuller rather than cramped. */
function growth(level: number): number {
  return 1 + Math.min(0.2, level * 0.008);
}

/* ------------------------------------------------------- equipment shapes */

type Draw = (accent: string) => ReactNode;

const FLOOR_PIECES: Record<string, Draw> = {
  trainer: (a) => (
    <>
      <rect x={-9} y={-14} width={6} height={14} rx={2} fill={DARK} />
      <rect x={3} y={-14} width={6} height={14} rx={2} fill={DARK} />
      <rect x={-8} y={-38} width={16} height={25} rx={6} fill={MID} />
      <circle cx={0} cy={-45} r={8} fill={a} />
      <rect x={-22} y={-36} width={44} height={4} rx={2} fill={LIGHT} />
      <rect x={-27} y={-41} width={6} height={14} rx={2} fill={DARK} />
      <rect x={21} y={-41} width={6} height={14} rx={2} fill={DARK} />
    </>
  ),
  ringlight: (a) => (
    <>
      <path d="M-15 0 L0 -12 L15 0" stroke={MID} strokeWidth={4} fill="none" strokeLinecap="round" />
      <rect x={-2} y={-42} width={4} height={32} fill={MID} />
      <circle cx={0} cy={-54} r={15} fill="none" stroke={a} strokeWidth={5} />
    </>
  ),
  studio: (a) => (
    <>
      <rect x={-24} y={-70} width={7} height={70} rx={2} fill={MID} />
      <rect x={17} y={-70} width={7} height={70} rx={2} fill={MID} />
      <rect x={-26} y={-74} width={52} height={6} rx={2} fill={a} />
      <rect x={-30} y={-48} width={60} height={4} rx={2} fill={LIGHT} />
      <rect x={-34} y={-53} width={6} height={14} rx={2} fill={DARK} />
      <rect x={28} y={-53} width={6} height={14} rx={2} fill={DARK} />
    </>
  ),
  aiteam: (a) => (
    <>
      <rect x={-17} y={-64} width={34} height={64} rx={4} fill={DARK} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={-11} y={-56 + i * 14} width={22} height={6} rx={2} fill={i < 2 ? a : LIGHT} />
      ))}
    </>
  ),
  camera: (a) => (
    <>
      <path d="M-11 0 L0 -44 L11 0" stroke={MID} strokeWidth={4} fill="none" strokeLinecap="round" />
      <rect x={-16} y={-60} width={26} height={17} rx={4} fill={DARK} />
      <circle cx={14} cy={-51} r={6} fill={a} />
    </>
  ),
  supplement: (a) => (
    <>
      <rect x={-25} y={-54} width={50} height={54} rx={4} fill={DARK} />
      <rect x={-25} y={-31} width={50} height={3} fill={LIGHT} />
      {[-18, -5, 8].map((x) => (
        <rect key={x} x={x} y={-48} width={12} height={15} rx={3} fill={a} />
      ))}
      {[-18, -5, 8].map((x) => (
        <rect key={`b${x}`} x={x} y={-25} width={12} height={15} rx={3} fill={MID} />
      ))}
    </>
  ),
  agency: (a) => (
    <>
      <rect x={-22} y={-11} width={5} height={11} fill={DARK} />
      <rect x={17} y={-11} width={5} height={11} fill={DARK} />
      <rect x={-27} y={-17} width={54} height={6} rx={2} fill={MID} />
      <rect x={-15} y={-42} width={30} height={22} rx={3} fill="#0d0f12" stroke={a} strokeWidth={2} />
    </>
  ),
  federation: (a) => (
    <>
      <rect x={-31} y={-18} width={21} height={18} rx={1} fill={DARK} />
      <rect x={-10} y={-32} width={20} height={32} rx={1} fill={MID} />
      <rect x={10} y={-13} width={21} height={13} rx={1} fill={DARK} />
      <circle cx={0} cy={-42} r={7} fill={a} />
    </>
  ),
  olympia: (a) => (
    <>
      <rect x={-22} y={-62} width={9} height={62} rx={1} fill={MID} />
      <rect x={13} y={-62} width={9} height={62} rx={1} fill={MID} />
      <rect x={-28} y={-68} width={56} height={6} rx={2} fill={LIGHT} />
      <path d="M0 -86 q9 9 0 18 q-9 -9 0 -18" fill={a} />
    </>
  ),
};

const WALL_PIECES: Record<string, Draw> = {
  shake: (a) => (
    <>
      <rect x={-27} y={8} width={54} height={4} rx={2} fill={MID} />
      {[-21, -6, 9].map((x) => (
        <rect key={x} x={x} y={-12} width={11} height={20} rx={4} fill={a} />
      ))}
    </>
  ),
  bands: (a) => (
    <>
      <rect x={-25} y={-16} width={50} height={4} rx={2} fill={MID} />
      {[-14, 0, 14].map((x) => (
        <path key={x} d={`M${x} -12 q7 14 0 24`} stroke={a} strokeWidth={3} fill="none" strokeLinecap="round" />
      ))}
    </>
  ),
  editor: (a) => (
    <>
      <rect x={-28} y={-19} width={56} height={38} rx={4} fill="#0d0f12" stroke={MID} strokeWidth={2} />
      <path d="M-7 -8 L9 0 L-7 8 z" fill={a} />
    </>
  ),
  sponsor: (a) => (
    <>
      <rect x={-34} y={-15} width={68} height={30} rx={4} fill={a} opacity={0.85} />
      <rect x={-24} y={-4} width={48} height={5} rx={2} fill="#0a0a0b" opacity={0.45} />
    </>
  ),
  gymchain: (a) => (
    <>
      <rect x={-29} y={-8} width={17} height={26} rx={1} fill={DARK} />
      <rect x={-8} y={-19} width={17} height={37} rx={1} fill={MID} />
      <rect x={13} y={-2} width={17} height={20} rx={1} fill={DARK} />
      {[-24, -3, 18].map((x) => (
        <rect key={x} x={x} y={0} width={5} height={5} fill={a} />
      ))}
    </>
  ),
  network: (a) => (
    <>
      <path d="M-17 12 a19 19 0 0 1 34 -11" fill="none" stroke={MID} strokeWidth={5} strokeLinecap="round" />
      <rect x={-2} y={4} width={4} height={14} fill={MID} />
      <circle cx={0} cy={-2} r={4} fill={a} />
    </>
  ),
  empire: (a) => <path d="M-19 12 L-23 -11 L-9 0 L0 -15 L9 0 L23 -11 L19 12 z" fill={a} />,
};

/* ------------------------------------------------------------- the scene */

export function GymView({
  owned,
  shop,
  prestigeCount,
}: {
  owned: Record<string, number>;
  shop: Record<string, number>;
  prestigeCount: number;
}) {
  const tier = gymTierFor(prestigeCount);
  const accent = tier.accent;

  // Pieces take the next free slot in upgrade order, so an early gym is
  // sparse but evenly spread instead of everything huddling on the left.
  const floorItems: { id: string; level: number; x: number }[] = [];
  const wallItems: { id: string; level: number; x: number }[] = [];
  for (const u of CLICKER_UPGRADES) {
    const level = owned[u.id] ?? 0;
    if (level <= 0) continue;
    if (u.place === "floor" && floorItems.length < FLOOR_SLOTS.length) {
      floorItems.push({ id: u.id, level, x: FLOOR_SLOTS[floorItems.length] });
    } else if (u.place === "wall" && wallItems.length < WALL_SLOTS.length) {
      wallItems.push({ id: u.id, level, x: WALL_SLOTS[wallItems.length] });
    }
  }

  const mirror = shopLevel(shop, "mirror");
  const music = shopLevel(shop, "music");
  const bench = shopLevel(shop, "bench");
  const bar = shopLevel(shop, "bar");
  const empty = floorItems.length === 0 && wallItems.length === 0;

  return (
    <div className="relative">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-display text-lg leading-tight tracking-wide text-ge-white">{tier.name}</div>
          <div className="truncate text-[12px] text-white/45">{tier.tagline}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px] text-white/40">Gym-Stufe</div>
          <div className="font-display text-lg leading-tight" style={{ color: accent }}>
            {tier.index + 1}
            <span className="text-white/30"> / {9}</span>
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="block max-h-[280px] w-full rounded-xl"
        style={{ background: tier.wall }}
        role="img"
        aria-label={`Dein Gym: ${tier.name}, ${floorItems.length + wallItems.length} Geräte`}
      >
        {/* Windows — the room gets more daylight the further up you move. */}
        {Array.from({ length: tier.windows }).map((_, i) => {
          const gap = WIDTH / (tier.windows + 1);
          const x = gap * (i + 1) - 26;
          return (
            <g key={i}>
              <rect x={x} y={26} width={52} height={52} rx={4} fill="#0c0e12" />
              <rect x={x} y={26} width={52} height={52} rx={4} fill={accent} opacity={0.1} />
              <rect x={x + 24} y={26} width={4} height={52} fill={tier.wall} opacity={0.9} />
              <rect x={x} y={50} width={52} height={4} fill={tier.wall} opacity={0.9} />
            </g>
          );
        })}

        {/* Mirror wall — a Coin-shop fixture. */}
        {mirror > 0 && (
          <g>
            <rect x={14} y={84} width={36} height={134} rx={4} fill="#0e1116" stroke={accent} strokeWidth={1.5} opacity={0.9} />
            <path d="M20 210 L44 96" stroke="#ffffff" strokeWidth={3} opacity={0.08} />
          </g>
        )}

        {/* Speakers — likewise. */}
        {music > 0 && (
          <g>
            <rect x={852} y={84} width={34} height={54} rx={4} fill={DARK} />
            <circle cx={869} cy={100} r={7} fill={accent} opacity={0.8} />
            <circle cx={869} cy={122} r={10} fill={MID} />
          </g>
        )}

        {wallItems.map((it) => {
          const draw = WALL_PIECES[it.id];
          if (!draw) return null;
          return (
            <g key={it.id} transform={`translate(${it.x},${WALL_Y}) scale(${growth(it.level)})`}>
              {draw(accent)}
            </g>
          );
        })}

        {/* Floor: baseboard, surface, and a lighter strip for a hint of depth. */}
        <rect x={-BLEED} y={WALL_BOTTOM - 6} width={WIDTH + BLEED * 2} height={6} fill={tier.trim} />
        <rect x={-BLEED} y={WALL_BOTTOM} width={WIDTH + BLEED * 2} height={HEIGHT - WALL_BOTTOM} fill={tier.floor} />
        <rect x={-BLEED} y={WALL_BOTTOM} width={WIDTH + BLEED * 2} height={2} fill="#ffffff" opacity={0.05} />

        {floorItems.map((it) => {
          const draw = FLOOR_PIECES[it.id];
          if (!draw) return null;
          return (
            <g key={it.id} transform={`translate(${it.x},${FLOOR_Y}) scale(${growth(it.level)})`}>
              {draw(accent)}
            </g>
          );
        })}

        {/* Front row — fixtures sit closer to the viewer than the equipment. */}
        {bench > 0 && (
          <g transform="translate(210,292)">
            <rect x={-34} y={-16} width={68} height={9} rx={4} fill={MID} />
            <rect x={-26} y={-7} width={7} height={7} fill={DARK} />
            <rect x={19} y={-7} width={7} height={7} fill={DARK} />
            <rect x={-40} y={-22} width={14} height={7} rx={3} fill={accent} />
          </g>
        )}
        {bar > 0 && (
          <g transform="translate(680,292)">
            <rect x={-40} y={-30} width={80} height={30} rx={4} fill={DARK} />
            <rect x={-40} y={-34} width={80} height={6} rx={3} fill={accent} opacity={0.8} />
            {[-26, -8, 10].map((x) => (
              <rect key={x} x={x} y={-46} width={10} height={12} rx={2} fill={MID} />
            ))}
          </g>
        )}
      </svg>

      {empty && (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 text-center text-[12px] text-white/35">
          Noch leer — kauf dein erstes Upgrade und es steht hier.
        </div>
      )}
    </div>
  );
}
