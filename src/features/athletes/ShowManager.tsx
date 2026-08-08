import { useRef, useState } from "react";
import { useShowStore } from "../../store/showStore";
import { Card, EmptyState, GlowButton } from "../../components/ui";
import { getShow } from "../../lib/athletes/athleteDb";

const FIELD =
  "w-full min-w-0 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red";

export function ShowManager() {
  const shows = useShowStore((s) => s.shows);
  const createShow = useShowStore((s) => s.createShow);
  const saveShow = useShowStore((s) => s.saveShow);
  const deleteShow = useShowStore((s) => s.deleteShow);
  const setShowLogo = useShowStore((s) => s.setShowLogo);

  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const logoRefs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-2 font-mono text-xs tracking-widest text-white/50 uppercase">Neue Show</div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            void createShow(name.trim());
            setName("");
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Olympia 2026"
            className={FIELD}
          />
          <GlowButton type="submit" disabled={!name.trim()}>
            +
          </GlowButton>
        </form>
      </Card>

      {shows.length === 0 ? (
        <EmptyState>Noch keine Shows. Lege eine an, um Lineup-Posts mit Logo zu bauen.</EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {shows.map((show) => (
            <Card key={show.id}>
              <div className="flex items-center gap-3">
                {show.logo_url ? (
                  <img
                    src={show.logo_url}
                    alt={show.name}
                    className="h-12 w-12 shrink-0 rounded-lg bg-black/40 object-contain p-1"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/5 text-lg">
                    🏆
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-base tracking-wide text-ge-white uppercase">
                    {show.name}
                  </div>
                  <div className="truncate font-mono text-[11px] text-white/45">
                    {[show.year, show.location].filter(Boolean).join(" · ") || "Keine Details"}
                  </div>
                </div>
                <GlowButton variant="ghost" onClick={() => setEditingId(editingId === show.id ? null : show.id)}>
                  {editingId === show.id ? "Zu" : "Edit"}
                </GlowButton>
              </div>

              {editingId === show.id && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">Jahr</span>
                      <input
                        className={FIELD}
                        defaultValue={show.year}
                        onBlur={async (e) => {
                          const full = await getShow(show.id);
                          if (full) void saveShow({ ...full, year: e.target.value });
                        }}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">Ort</span>
                      <input
                        className={FIELD}
                        defaultValue={show.location}
                        onBlur={async (e) => {
                          const full = await getShow(show.id);
                          if (full) void saveShow({ ...full, location: e.target.value });
                        }}
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-col gap-2">
                    <div>
                      <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">
                        Logo (transparentes PNG)
                      </span>
                      <input
                        ref={(el) => {
                          logoRefs.current[show.id] = el;
                        }}
                        type="file"
                        accept="image/png,image/webp,image/svg+xml"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void setShowLogo(show.id, file, false);
                        }}
                        className="mt-1 block text-xs text-white/60 file:mr-2 file:rounded-lg file:border-0 file:bg-ge-red file:px-3 file:py-1.5 file:text-xs file:text-white"
                      />
                    </div>
                    <div>
                      <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">
                        Glow-Variante (optional)
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/webp,image/svg+xml"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void setShowLogo(show.id, file, true);
                        }}
                        className="mt-1 block text-xs text-white/60 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white"
                      />
                    </div>
                  </div>

                  <p className="mt-2 font-mono text-[10px] text-white/35">
                    Das Logo wird im Post mittig über dem Athleten-Grid platziert und relativ zur Canvas-Breite
                    skaliert. Kein 3D-Effekt — die Datei wird unverändert gezeichnet.
                  </p>

                  <div className="mt-3">
                    <GlowButton
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Show "${show.name}" löschen?`)) void deleteShow(show.id);
                      }}
                    >
                      Show löschen
                    </GlowButton>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
