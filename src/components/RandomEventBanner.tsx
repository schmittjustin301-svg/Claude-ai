import { useEmpireStore } from "../store/empireStore";

export function RandomEventBanner() {
  const event = useEmpireStore((s) => s.appState.daily_event);
  if (!event) return null;

  return (
    <div className="ge-glow-gold flex items-center gap-3 rounded-xl border border-ge-gold/40 bg-ge-gold/10 px-4 py-2.5">
      <span className="text-lg">⚡</span>
      <div className="min-w-0">
        <div className="font-display text-sm tracking-wide text-ge-gold uppercase">{event.title}</div>
        <div className="truncate font-mono text-[11px] text-white/60">{event.description}</div>
      </div>
    </div>
  );
}
