import type { PropsWithChildren, ReactNode } from "react";
import clsx from "clsx";

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={clsx("rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }: PropsWithChildren<{ right?: ReactNode }>) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-xl tracking-wide text-ge-white uppercase">{children}</h2>
      {right}
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  colorClass = "bg-ge-red",
  glowClass = "ge-glow-red",
  label,
}: {
  value: number;
  max: number;
  colorClass?: string;
  glowClass?: string;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={clsx("h-full rounded-full transition-all duration-500 ease-out", colorClass, glowClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {label && <div className="mt-1 font-mono text-xs text-white/60">{label}</div>}
    </div>
  );
}

const TIER_STYLES: Record<string, string> = {
  STARTUP: "text-white/70 border-white/20",
  GROWING: "text-ge-green border-ge-green/50",
  SCALING: "text-ge-gold border-ge-gold/50",
  EMPIRE: "text-ge-red border-ge-red/50",
};

export function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={clsx(
        "rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-widest uppercase",
        TIER_STYLES[tier] ?? TIER_STYLES.STARTUP
      )}
    >
      {tier}
    </span>
  );
}

export function GlowButton({
  children,
  onClick,
  disabled,
  variant = "red",
  type = "button",
  className,
}: PropsWithChildren<{
  onClick?: () => void;
  disabled?: boolean;
  variant?: "red" | "green" | "gold" | "ghost";
  type?: "button" | "submit";
  className?: string;
}>) {
  const variants: Record<string, string> = {
    red: "bg-ge-red text-white ge-glow-red hover:brightness-110",
    green: "bg-ge-green text-black ge-glow-green hover:brightness-110",
    gold: "bg-ge-gold text-black ge-glow-gold hover:brightness-110",
    ghost: "bg-white/5 text-white border border-white/15 hover:bg-white/10",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "rounded-xl px-4 py-2 font-display text-sm tracking-wide uppercase transition disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({ children }: PropsWithChildren) {
  return <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/40">{children}</div>;
}
