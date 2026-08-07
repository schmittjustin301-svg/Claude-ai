import { useEffect, useState } from "react";
import clsx from "clsx";
import { useAthleteStore } from "../../store/athleteStore";
import { SectionTitle } from "../../components/ui";
import { AthleteDashboard } from "./AthleteDashboard";
import { StudioScreen } from "./StudioScreen";
import { TemplateEditor } from "./TemplateEditor";

type SubTab = "studio" | "database" | "templates";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "studio", label: "Studio" },
  { key: "database", label: "Datenbank" },
  { key: "templates", label: "Templates" },
];

export function AthletesScreen() {
  const [tab, setTab] = useState<SubTab>("studio");
  const load = useAthleteStore((s) => s.load);
  const count = useAthleteStore((s) => s.athletes.length);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle right={<span className="font-mono text-xs text-white/50">{count} Athleten</span>}>
        Athletes
      </SectionTitle>

      <div className="flex gap-1.5">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "rounded-lg px-3 py-1.5 font-display text-sm tracking-wide uppercase transition",
              tab === t.key ? "ge-glow-red bg-ge-red/15 text-ge-red" : "bg-white/5 text-white/50 hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "studio" && <StudioScreen />}
      {tab === "database" && <AthleteDashboard />}
      {tab === "templates" && <TemplateEditor />}
    </div>
  );
}
