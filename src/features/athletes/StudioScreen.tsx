import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useAthleteStore } from "../../store/athleteStore";
import { useShowStore } from "../../store/showStore";
import { Card, EmptyState, GlowButton } from "../../components/ui";
import { resolveNames } from "../../lib/athletes/search";
import { planLayout } from "../../lib/athletes/layout";
import { EXPORT_FORMATS, getFormat } from "../../lib/athletes/exportFormats";
import { canvasToBlob, downloadBlob, renderGraphic, type RenderCard } from "../../lib/athletes/render";
import { pickPrimaryImage } from "../../lib/athletes/athleteDb";
import { emptyPost, POST_TYPE_LABEL, type Post, type PostType } from "../../lib/athletes/postTypes";
import type { Athlete } from "../../lib/athletes/types";

export function StudioScreen() {
  const athletes = useAthleteStore((s) => s.athletes);
  const templates = useAthleteStore((s) => s.templates);
  const imagesByAthlete = useAthleteStore((s) => s.imagesByAthlete);
  const loadImages = useAthleteStore((s) => s.loadImages);

  const shows = useShowStore((s) => s.shows);
  const posts = useShowStore((s) => s.posts);
  const savePost = useShowStore((s) => s.savePost);
  const deletePost = useShowStore((s) => s.deletePost);
  const loadShows = useShowStore((s) => s.load);

  const [draft, setDraft] = useState<Post>(() => emptyPost());
  const [names, setNames] = useState("");
  const [saveState, setSaveState] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    void loadShows();
  }, [loadShows]);

  const resolved = useMemo(() => resolveNames(names, athletes), [names, athletes]);
  const selected = useMemo(
    () => resolved.map((r) => r.match).filter((a): a is Athlete => a !== null),
    [resolved]
  );
  const plan = useMemo(() => planLayout(selected.length), [selected.length]);
  const template = templates.find((t) => t.id === draft.template_id) ?? templates[0];
  const format = getFormat(draft.format_id);
  const show = draft.show_id ? shows.find((s) => s.id === draft.show_id) : undefined;

  useEffect(() => {
    selected.forEach((a) => {
      if (!imagesByAthlete[a.id]) void loadImages(a.id);
    });
  }, [selected, imagesByAthlete, loadImages]);

  const set = <K extends keyof Post>(key: K, value: Post[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !template) return;
    const cards: RenderCard[] = selected.map((athlete) => ({
      athlete,
      imageUrl: pickPrimaryImage(imagesByAthlete[athlete.id] ?? [])?.url ?? null,
    }));
    await renderGraphic(canvas, {
      cards,
      template,
      format,
      showCoach: draft.show_coach,
      showStatus: draft.show_status,
      headline: draft.headline,
      subtitle: draft.subtitle,
      // Only lineup posts carry the show mark.
      showLogoUrl: draft.type === "show_lineup" ? (show?.logo_glow_url ?? show?.logo_url ?? null) : null,
    });
  }, [selected, imagesByAthlete, template, format, draft, show]);

  useEffect(() => {
    void draw();
  }, [draw]);

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || selected.length === 0) return;
    await draw();
    const image = await canvasToBlob(canvas);
    await savePost({ ...draft, athlete_ids: selected.map((a) => a.id), image });
    setSaveState("Post gespeichert.");
    setTimeout(() => setSaveState(null), 2500);
  }

  function loadPost(post: Post) {
    setDraft(post);
    const byId = new Map(athletes.map((a) => [a.id, a.full_name]));
    setNames(post.athlete_ids.map((id) => byId.get(id) ?? "").filter(Boolean).join("\n"));
  }

  async function handleExport() {
    const canvas = canvasRef.current;
    if (!canvas || selected.length === 0) return;
    setExporting(true);
    try {
      await draw();
      const blob = await canvasToBlob(canvas);
      const slug = (draft.headline || selected.map((a) => a.full_name).join("_"))
        .replace(/\s+/g, "-")
        .toLowerCase()
        .slice(0, 60);
      downloadBlob(blob, `${slug || "post"}_${format.id}.png`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-xs tracking-widest text-white/50 uppercase">Post-Typ</span>
          {draft.id && posts.some((p) => p.id === draft.id) && (
            <button
              onClick={() => {
                setDraft(emptyPost());
                setNames("");
              }}
              className="font-mono text-[11px] text-white/40 hover:text-white"
            >
              Neuer Post
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          {(Object.keys(POST_TYPE_LABEL) as PostType[]).map((t) => (
            <button
              key={t}
              onClick={() => set("type", t)}
              className={clsx(
                "rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase transition",
                draft.type === t ? "ge-glow-red bg-ge-red/15 text-ge-red" : "bg-white/5 text-white/50 hover:text-white"
              )}
            >
              {POST_TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        {draft.type === "show_lineup" && (
          <label className="mt-3 flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">Show</span>
            <select
              value={draft.show_id ?? ""}
              onChange={(e) => set("show_id", e.target.value || null)}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
            >
              <option value="">— Show wählen —</option>
              {shows.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {draft.show_id && !show?.logo_url && (
              <span className="font-mono text-[10px] text-ge-gold">
                Für diese Show ist kein Logo hinterlegt — im Shows-Tab hochladen.
              </span>
            )}
          </label>
        )}
      </Card>

      <Card>
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">Headline (Anton)</span>
            <input
              value={draft.headline}
              onChange={(e) => set("headline", e.target.value)}
              placeholder={template?.title ?? "Überschrift"}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">Subtitel (Inter)</span>
            <textarea
              value={draft.subtitle}
              onChange={(e) => set("subtitle", e.target.value)}
              rows={2}
              placeholder="Freitext — erscheint unten im Bild"
              className="w-full resize-y rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
            />
          </label>
        </div>
      </Card>

      <Card>
        <div className="mb-2 font-mono text-xs tracking-widest text-white/50 uppercase">Athleten (ein Name pro Zeile)</div>
        <textarea
          value={names}
          onChange={(e) => setNames(e.target.value)}
          rows={4}
          placeholder={"Missy Truscott\nNatalia Soltero\nLili Dong"}
          className="w-full resize-y rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
        />
        {resolved.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {resolved.map((r, i) => (
              <span
                key={`${r.query}-${i}`}
                className={clsx(
                  "rounded-full border px-2.5 py-1 font-mono text-[11px]",
                  r.match
                    ? r.score > 0.95
                      ? "border-ge-green/40 text-ge-green"
                      : "border-ge-gold/40 text-ge-gold"
                    : "border-ge-red/40 text-ge-red"
                )}
              >
                {r.match ? r.match.full_name : `${r.query} — nicht gefunden`}
                {r.match && r.score <= 0.95 && ` (${Math.round(r.score * 100)}%)`}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">Template</span>
            <select
              value={draft.template_id}
              onChange={(e) => set("template_id", e.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">Format</span>
            <select
              value={draft.format_id}
              onChange={(e) => set("format_id", e.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
            >
              {EXPORT_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label} · {f.width}×{f.height}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Check checked={draft.show_coach} onChange={(v) => set("show_coach", v)}>
            Coach anzeigen
          </Check>
          <Check checked={draft.show_status} onChange={(v) => set("show_status", v)}>
            Status anzeigen
          </Check>
          <span className="ml-auto rounded-full border border-white/15 px-2.5 py-0.5 font-mono text-[11px] text-white/50">
            {plan.label}
          </span>
        </div>
      </Card>

      <Card>
        <div className="mb-2 font-mono text-xs tracking-widest text-white/50 uppercase">Vorschau</div>
        {selected.length === 0 ? (
          <EmptyState>Tippe oben Athletennamen ein, um eine Grafik zu erzeugen.</EmptyState>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/10">
            <canvas ref={canvasRef} className="block h-auto w-full" />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <GlowButton onClick={() => void handleExport()} disabled={selected.length === 0 || exporting}>
            {exporting ? "Exportiert…" : `Export ${format.label}`}
          </GlowButton>
          <GlowButton variant="green" onClick={() => void handleSave()} disabled={selected.length === 0}>
            Post speichern
          </GlowButton>
          {saveState && <span className="font-mono text-xs text-ge-green">{saveState}</span>}
        </div>
      </Card>

      {posts.length > 0 && (
        <Card>
          <div className="mb-2 font-mono text-xs tracking-widest text-white/50 uppercase">
            Gespeicherte Posts ({posts.length})
          </div>
          <div className="flex flex-col gap-2">
            {[...posts]
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
              .map((post) => (
                <div key={post.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-white">{post.headline || "(ohne Headline)"}</div>
                    <div className="truncate font-mono text-[10px] text-white/40">
                      {POST_TYPE_LABEL[post.type]} · {post.athlete_ids.length} Athleten
                      {post.subtitle ? ` · ${post.subtitle.slice(0, 40)}` : ""}
                    </div>
                  </div>
                  <GlowButton variant="ghost" onClick={() => loadPost(post)}>
                    Öffnen
                  </GlowButton>
                  <GlowButton
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Post löschen?")) void deletePost(post.id);
                    }}
                  >
                    ✕
                  </GlowButton>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 font-mono text-[11px] text-white/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-[#ff1432]"
      />
      {children}
    </label>
  );
}
