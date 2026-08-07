import { useEffect, useMemo, useRef, useState } from "react";
import { useAthleteStore } from "../../store/athleteStore";
import { Card, EmptyState, GlowButton } from "../../components/ui";
import { searchAthletes } from "../../lib/athletes/search";
import { flagEmoji } from "../../lib/athletes/countries";
import { AthleteEditor } from "./AthleteEditor";
import type { Athlete } from "../../lib/athletes/types";
import { estimateUsage } from "../../lib/athletes/athleteDb";

export function AthleteDashboard() {
  const athletes = useAthleteStore((s) => s.athletes);
  const deleteAthlete = useAthleteStore((s) => s.deleteAthlete);
  const saveAthlete = useAthleteStore((s) => s.saveAthlete);
  const addImage = useAthleteStore((s) => s.addImage);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Athlete | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const bulkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void estimateUsage().then((u) => {
      if (u) setUsage(`${u.usedMb.toFixed(1)} MB von ~${u.quotaMb.toFixed(0)} MB belegt`);
    });
  }, [athletes]);

  const visible = useMemo(() => {
    if (!query.trim()) return [...athletes].sort((a, b) => a.full_name.localeCompare(b.full_name));
    return searchAthletes(query, athletes, 50, 0.3).map((m) => m.athlete);
  }, [athletes, query]);

  /**
   * Bulk image upload: filenames become athlete names, so dropping a folder of
   * "Missy Truscott.jpg" creates or updates every profile in one pass.
   */
  async function handleBulkImages(files: FileList | null) {
    if (!files?.length) return;
    let created = 0;
    let merged = 0;
    for (const file of Array.from(files)) {
      const name = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
      if (!name) continue;
      const result = await saveAthlete({ full_name: name });
      if (result.created) created++;
      else merged++;
      await addImage(result.athlete.id, file, "portrait");
    }
    setBulkStatus(`${created} neu angelegt, ${merged} bestehenden Profilen zugeordnet.`);
    if (bulkRef.current) bulkRef.current.value = "";
  }

  if (creating || editing) {
    return (
      <AthleteEditor
        athlete={editing}
        onSaved={(saved) => {
          setCreating(false);
          setEditing(saved);
        }}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Athlet suchen (tippfehlertolerant)…"
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
          />
          <GlowButton onClick={() => setCreating(true)}>+ Athlet</GlowButton>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="font-mono text-[10px] tracking-widest text-white/40 uppercase">Bulk-Bildupload</label>
          <input
            ref={bulkRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => void handleBulkImages(e.target.files)}
            className="text-xs text-white/60 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white"
          />
        </div>
        <p className="mt-1 font-mono text-[10px] text-white/35">
          Dateiname = Athletenname. Bestehende Profile werden ergänzt, keine Duplikate.
        </p>
        {bulkStatus && <p className="mt-1 font-mono text-[11px] text-ge-green">{bulkStatus}</p>}
      </Card>

      <div className="flex items-center justify-between px-1">
        <span className="font-mono text-xs text-white/50">
          {visible.length} von {athletes.length} Athleten
        </span>
        {usage && <span className="font-mono text-[10px] text-white/30">{usage}</span>}
      </div>

      {visible.length === 0 ? (
        <EmptyState>
          {athletes.length === 0
            ? "Noch keine Athleten. Lege einen an oder lade Bilder per JARVIS hoch."
            : "Keine Treffer."}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((a) => (
            <AthleteRow key={a.id} athlete={a} onEdit={() => setEditing(a)} onDelete={() => void deleteAthlete(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AthleteRow({ athlete, onEdit, onDelete }: { athlete: Athlete; onEdit: () => void; onDelete: () => void }) {
  const images = useAthleteStore((s) => s.imagesByAthlete[athlete.id]);
  const loadImages = useAthleteStore((s) => s.loadImages);

  useEffect(() => {
    if (!images) void loadImages(athlete.id);
  }, [athlete.id, images, loadImages]);

  const thumb = images?.[0]?.url;

  return (
    <Card className="flex items-center gap-3 py-3">
      {thumb ? (
        <img src={thumb} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/5 text-lg">🏋️</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-base tracking-wide text-ge-white uppercase">{athlete.full_name}</div>
        <div className="truncate font-mono text-[11px] text-white/45">
          {[flagEmoji(athlete.country), athlete.division, athlete.coach && `Coach: ${athlete.coach}`]
            .filter(Boolean)
            .join("  ·  ") || "Keine Details"}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="font-mono text-[10px] text-white/30">{images?.length ?? 0} 🖼</span>
        <GlowButton variant="ghost" onClick={onEdit}>
          Edit
        </GlowButton>
        <GlowButton
          variant="ghost"
          onClick={() => {
            if (confirm(`${athlete.full_name} und alle Bilder löschen?`)) onDelete();
          }}
        >
          ✕
        </GlowButton>
      </div>
    </Card>
  );
}
