import { useState } from "react";
import clsx from "clsx";
import { useEmpireStore } from "../../store/empireStore";
import { Card, GlowButton, SectionTitle } from "../../components/ui";
import type { RoadmapStatus } from "../../lib/types";

const STATUS_STYLES: Record<RoadmapStatus, string> = {
  LOCKED: "border-white/15 text-white/40",
  ACTIVE: "border-ge-gold/50 text-ge-gold ge-glow-gold",
  DONE: "border-ge-green/50 text-ge-green ge-glow-green",
};

const NEXT_STATUS: Record<RoadmapStatus, RoadmapStatus> = {
  LOCKED: "ACTIVE",
  ACTIVE: "DONE",
  DONE: "LOCKED",
};

export function RoadmapScreen() {
  const items = useEmpireStore((s) => s.roadmapItems);
  const addRoadmapItem = useEmpireStore((s) => s.addRoadmapItem);
  const updateRoadmapStatus = useEmpireStore((s) => s.updateRoadmapStatus);
  const [title, setTitle] = useState("");

  const sorted = [...items].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Roadmap</SectionTitle>

      <Card>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            addRoadmapItem(title.trim());
            setTitle("");
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Neuer Meilenstein"
            className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
          />
          <GlowButton type="submit">+</GlowButton>
        </form>
      </Card>

      <div className="relative flex flex-col gap-3 pl-4">
        <div className="absolute top-1 bottom-1 left-[7px] w-px bg-white/15" />
        {sorted.map((item) => (
          <div key={item.id} className="relative">
            <span
              className={clsx(
                "absolute top-4 -left-4 h-3 w-3 rounded-full border-2 bg-black",
                STATUS_STYLES[item.status]
              )}
            />
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-white">{item.title}</div>
                <button
                  onClick={() => updateRoadmapStatus(item.id, NEXT_STATUS[item.status])}
                  className={clsx(
                    "shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-widest uppercase",
                    STATUS_STYLES[item.status]
                  )}
                >
                  {item.status}
                </button>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
