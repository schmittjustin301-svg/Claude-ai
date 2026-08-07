import clsx from "clsx";

export type TabKey =
  | "overview"
  | "today"
  | "boss"
  | "earnings"
  | "athletes"
  | "roadmap"
  | "skills"
  | "achievements"
  | "chat";

export const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "overview", label: "Empire", icon: "🏙️" },
  { key: "today", label: "Today", icon: "☑️" },
  { key: "boss", label: "Boss", icon: "⚔️" },
  { key: "earnings", label: "Earnings", icon: "💰" },
  { key: "athletes", label: "Athletes", icon: "🏋️" },
  { key: "roadmap", label: "Roadmap", icon: "🗺️" },
  { key: "skills", label: "Skills", icon: "🌳" },
  { key: "achievements", label: "Awards", icon: "🏆" },
  { key: "chat", label: "JARVIS", icon: "🤖" },
];

export function Nav({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <>
      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-white/10 bg-black/95 backdrop-blur md:hidden">
        {TABS.map((t) => (
          <NavItem key={t.key} tab={t} active={active === t.key} onClick={() => onChange(t.key)} />
        ))}
      </nav>

      {/* Desktop sidebar */}
      <nav className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-white/10 bg-black/95 p-4 md:flex">
        <div className="mb-6 px-2">
          <div className="font-display text-2xl tracking-wide text-ge-white">
            GRIND<span className="text-ge-red">.</span>
          </div>
          <div className="font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase">Empire OS</div>
        </div>
        <div className="flex flex-col gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left font-display text-sm tracking-wide uppercase transition",
                active === t.key ? "bg-ge-red/15 text-ge-red ge-glow-red" : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              <span className="text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

function NavItem({ tab, active, onClick }: { tab: (typeof TABS)[number]; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex min-w-[76px] flex-1 flex-col items-center gap-0.5 py-2.5 transition",
        active ? "text-ge-red" : "text-white/40"
      )}
    >
      <span className="text-lg">{tab.icon}</span>
      <span className="font-mono text-[10px] tracking-wide uppercase">{tab.label}</span>
      {active && <span className="ge-glow-red mt-0.5 h-0.5 w-6 rounded-full bg-ge-red" />}
    </button>
  );
}
