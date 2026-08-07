import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useAthleteStore } from "../../store/athleteStore";
import { Card, EmptyState, GlowButton } from "../../components/ui";
import { resolveNames } from "../../lib/athletes/search";
import { planLayout } from "../../lib/athletes/layout";
import { EXPORT_FORMATS, getFormat } from "../../lib/athletes/exportFormats";
import { canvasToBlob, downloadBlob, renderGraphic, type RenderCard } from "../../lib/athletes/render";
import { pickPrimaryImage } from "../../lib/athletes/athleteDb";
import type { Athlete } from "../../lib/athletes/types";

export function StudioScreen() {
  const athletes = useAthleteStore((s) => s.athletes);
  const templates = useAthleteStore((s) => s.templates);
  const imagesByAthlete = useAthleteStore((s) => s.imagesByAthlete);
  const loadImages = useAthleteStore((s) => s.loadImages);

  const [names, setNames] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [formatId, setFormatId] = useState("instagram-feed");
  const [showCoach, setShowCoach] = useState(true);
  const [showStatus, setShowStatus] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resolved = useMemo(() => resolveNames(names, athletes), [names, athletes]);
  const selected = useMemo(
    () => resolved.map((r) => r.match).filter((a): a is Athlete => a !== null),
    [resolved]
  );
  const plan = useMemo(() => planLayout(selected.length), [selected.length]);
  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const format = getFormat(formatId);

  // Make sure every selected athlete's images are loaded before rendering.
  useEffect(() => {
    selected.forEach((a) => {
      if (!imagesByAthlete[a.id]) void loadImages(a.id);
    });
  }, [selected, imagesByAthlete, loadImages]);

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !template) return;
    const cards: RenderCard[] = selected.map((athlete) => ({
      athlete,
      imageUrl: pickPrimaryImage(imagesByAthlete[athlete.id] ?? [])?.url ?? null,
    }));
    await renderGraphic(canvas, { cards, template, format, showCoach, showStatus });
  }, [selected, imagesByAthlete, template, format, showCoach, showStatus]);

  useEffect(() => {
    void draw();
  }, [draw]);

  async function handleExport() {
    const canvas = canvasRef.current;
    if (!canvas || selected.length === 0) return;
    setExporting(true);
    try {
      await draw();
      const blob = await canvasToBlob(canvas);
      const slug = selected.map((a) => a.full_name.replace(/\s+/g, "-").toLowerCase()).join("_").slice(0, 60);
      downloadBlob(blob, `${slug || "athletes"}_${format.id}.png`);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportAll() {
    const canvas = canvasRef.current;
    if (!canvas || selected.length === 0 || !template) return;
    setExporting(true);
    try {
      const cards: RenderCard[] = selected.map((athlete) => ({
        athlete,
        imageUrl: pickPrimaryImage(imagesByAthlete[athlete.id] ?? [])?.url ?? null,
      }));
      const slug = selected.map((a) => a.full_name.replace(/\s+/g, "-").toLowerCase()).join("_").slice(0, 50);
      for (const f of EXPORT_FORMATS) {
        await renderGraphic(canvas, { cards, template, format: f, showCoach, showStatus });
        const blob = await canvasToBlob(canvas);
        downloadBlob(blob, `${slug || "athletes"}_${f.id}.png`);
        // Browsers throttle rapid successive downloads.
        await new Promise((r) => setTimeout(r, 350));
      }
      await draw();
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
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
                title={r.match ? `Treffer: ${Math.round(r.score * 100)}%` : "Kein Treffer"}
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
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
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
              value={formatId}
              onChange={(e) => setFormatId(e.target.value)}
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
          <Check checked={showCoach} onChange={setShowCoach}>
            Coach anzeigen
          </Check>
          <Check checked={showStatus} onChange={setShowStatus}>
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
        <div className="mt-3 flex flex-wrap gap-2">
          <GlowButton onClick={() => void handleExport()} disabled={selected.length === 0 || exporting}>
            {exporting ? "Exportiert…" : `Export ${format.label}`}
          </GlowButton>
          <GlowButton variant="ghost" onClick={() => void handleExportAll()} disabled={selected.length === 0 || exporting}>
            Alle Formate
          </GlowButton>
        </div>
      </Card>
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
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-[#ff1432]" />
      {children}
    </label>
  );
}
