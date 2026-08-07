import { useMemo } from "react";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

// Kept on the GRIND EMPIRE palette rather than the usual cyan HUD look, so
// JARVIS reads as part of the same app: red at rest, green while it listens,
// gold while it thinks.
const STATE_COLOR: Record<VoiceState, string> = {
  idle: "#FF1432",
  listening: "#39FF88",
  thinking: "#FFD24A",
  speaking: "#FF1432",
};

const STATE_LABEL: Record<VoiceState, string> = {
  idle: "Bereit",
  listening: "Hört zu",
  thinking: "Denkt nach",
  speaking: "Spricht",
};

/** Radial tick marks around the outer ring. */
function Ticks({ color, count = 60, inner = 76, outer = 86 }: { color: string; count?: number; inner?: number; outer?: number }) {
  const ticks = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const long = i % 5 === 0;
      const r1 = long ? inner - 4 : inner;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        x1: 100 + cos * r1,
        y1: 100 + sin * r1,
        x2: 100 + cos * outer,
        y2: 100 + sin * outer,
        opacity: long ? 0.9 : 0.35,
      };
    });
  }, [count, inner, outer]);

  return (
    <g>
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={color} strokeWidth={1.5} opacity={t.opacity} />
      ))}
    </g>
  );
}

export function VoiceOrb({ state, level }: { state: VoiceState; level: number }) {
  const color = STATE_COLOR[state];
  const active = state !== "idle";

  // Mic loudness drives the core; other states get a steady gentle presence.
  const amplitude = state === "listening" ? level : state === "speaking" ? 0.45 : state === "thinking" ? 0.25 : 0.1;
  const coreScale = 1 + amplitude * 0.35;
  const haloScale = 1 + amplitude * 0.6;

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      <svg viewBox="0 0 200 200" className="h-56 w-56 sm:h-64 sm:w-64" style={{ filter: `drop-shadow(0 0 14px ${color}55)` }}>
        <defs>
          <radialGradient id="ge-core-gradient">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="55%" stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer dashed ring */}
        <g className="ge-ring" style={{ animationName: "ge-spin", animationDuration: active ? "18s" : "45s" }}>
          <circle cx="100" cy="100" r="94" fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 9" opacity="0.5" />
        </g>

        {/* Tick ring, counter-rotating */}
        <g className="ge-ring" style={{ animationName: "ge-spin-reverse", animationDuration: active ? "12s" : "30s" }}>
          <Ticks color={color} />
        </g>

        {/* Segmented arc ring */}
        <g className="ge-ring" style={{ animationName: "ge-spin", animationDuration: active ? "7s" : "20s" }}>
          <circle
            cx="100"
            cy="100"
            r="66"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="46 28"
            opacity="0.85"
          />
        </g>

        {/* Fine inner ring */}
        <g className="ge-ring" style={{ animationName: "ge-spin-reverse", animationDuration: active ? "5s" : "14s" }}>
          <circle cx="100" cy="100" r="52" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="2 5" opacity="0.7" />
        </g>

        <circle cx="100" cy="100" r="40" fill="none" stroke={color} strokeWidth="1" opacity="0.35" />

        {/* Core — scales with live amplitude */}
        <g style={{ transformOrigin: "100px 100px", transform: `scale(${haloScale})`, transition: "transform 90ms linear" }}>
          <circle cx="100" cy="100" r="34" fill="url(#ge-core-gradient)" opacity="0.75" />
        </g>
        <g style={{ transformOrigin: "100px 100px", transform: `scale(${coreScale})`, transition: "transform 90ms linear" }}>
          <circle cx="100" cy="100" r="16" fill={color} opacity="0.95" />
          <circle cx="100" cy="100" r="8" fill="#F5F5F5" opacity="0.9" />
        </g>
      </svg>

      <div className="mt-1 flex flex-col items-center gap-1">
        <div className="font-display text-lg tracking-[0.2em] uppercase" style={{ color }}>
          {STATE_LABEL[state]}
        </div>
      </div>
    </div>
  );
}
