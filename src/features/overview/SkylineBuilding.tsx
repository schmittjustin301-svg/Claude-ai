import clsx from "clsx";
import type { Tier } from "../../lib/types";

const TIER_COLOR: Record<Tier, string> = {
  STARTUP: "bg-white/25",
  GROWING: "bg-ge-green/70 ge-glow-green",
  SCALING: "bg-ge-gold/70 ge-glow-gold",
  EMPIRE: "bg-ge-red/80 ge-glow-red",
};

export function SkylineBuilding({ name, icon, level, tier }: { name: string; icon: string; level: number; tier: Tier }) {
  const height = Math.min(180, 28 + level * 6);
  return (
    <div className="flex flex-1 flex-col items-center justify-end gap-2">
      <div className="font-mono text-[10px] text-white/50">Lvl {level}</div>
      <div className="flex w-full flex-1 items-end justify-center">
        <div
          className={clsx("w-full max-w-[54px] rounded-t-md transition-all duration-700", TIER_COLOR[tier])}
          style={{ height }}
        />
      </div>
      <div className="text-center">
        <div className="text-lg">{icon}</div>
        <div className="max-w-[70px] truncate font-mono text-[10px] text-white/60">{name}</div>
      </div>
    </div>
  );
}
