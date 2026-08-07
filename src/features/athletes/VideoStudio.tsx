import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useAthleteStore } from "../../store/athleteStore";
import { Card, EmptyState, GlowButton } from "../../components/ui";
import { IMAGE_CATEGORY_LABEL, type AthleteImageRef } from "../../lib/athletes/types";
import { searchAthletes } from "../../lib/athletes/search";
import {
  DOP_MODELS,
  fetchMotions,
  HiggsfieldNotConfiguredError,
  type DoPModel,
  type MotionPreset,
} from "../../lib/higgsfield/higgsfieldClient";
import { AccessCodeRequiredError } from "../../lib/aiClient";
import { useVideoJobStore } from "../../store/videoJobStore";
import { VideoJobList } from "./VideoJobList";

export function VideoStudio() {
  const athletes = useAthleteStore((s) => s.athletes);
  const imagesByAthlete = useAthleteStore((s) => s.imagesByAthlete);
  const loadImages = useAthleteStore((s) => s.loadImages);

  const [query, setQuery] = useState("");
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("Cinematic slow push-in, dramatic stage lighting");
  const [model, setModel] = useState<DoPModel>("dop-turbo");
  const [motions, setMotions] = useState<MotionPreset[]>([]);
  const [motionId, setMotionId] = useState<string>("");
  const [motionsError, setMotionsError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startJob = useVideoJobStore((s) => s.start);

  const matches = useMemo(() => {
    if (!query.trim()) return [...athletes].sort((a, b) => a.full_name.localeCompare(b.full_name)).slice(0, 8);
    return searchAthletes(query, athletes, 8, 0.3).map((m) => m.athlete);
  }, [athletes, query]);

  const athlete = athletes.find((a) => a.id === athleteId) ?? null;
  const images: AthleteImageRef[] = athleteId ? (imagesByAthlete[athleteId] ?? []) : [];
  const selectedImage = images.find((i) => i.id === imageId) ?? images[0] ?? null;

  useEffect(() => {
    if (athleteId && !imagesByAthlete[athleteId]) void loadImages(athleteId);
  }, [athleteId, imagesByAthlete, loadImages]);

  // Motion presets are account-specific, so they come from the API rather than
  // a hardcoded list. Failing to load them is not fatal — a prompt alone works.
  useEffect(() => {
    let cancelled = false;
    void fetchMotions()
      .then((list) => {
        if (!cancelled) setMotions(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setMotionsError(
          err instanceof HiggsfieldNotConfiguredError
            ? err.message
            : "Motion-Presets konnten nicht geladen werden — Prompt allein funktioniert trotzdem."
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const generate = useCallback(async () => {
    if (!athlete || !selectedImage || !prompt.trim()) return;
    setBusy(true);
    setError(null);

    try {
      // Goes through the same job store as JARVIS-triggered generations, so a
      // clip started here also survives a reload and shows up in the list.
      await startJob({
        athleteId: athlete.id,
        athleteName: athlete.full_name,
        imageId: selectedImage.id,
        prompt: prompt.trim(),
        model,
        motionId: motionId || null,
        source: "ui",
      });
    } catch (err) {
      if (err instanceof AccessCodeRequiredError) {
        setError(`${err.message} Trag ihn im JARVIS-Tab ein.`);
      } else {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
      }
    } finally {
      setBusy(false);
    }
  }, [athlete, model, motionId, prompt, selectedImage, startJob]);

  if (athletes.length === 0) {
    return <EmptyState>Erst Athleten mit Bildern anlegen — daraus entstehen die Clips.</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-2 font-mono text-xs tracking-widest text-white/50 uppercase">Athlet</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Athlet suchen…"
          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {matches.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setAthleteId(a.id);
                setImageId(null);
                setError(null);
              }}
              className={clsx(
                "rounded-full border px-3 py-1 font-mono text-[11px] transition",
                athleteId === a.id ? "border-ge-red/60 bg-ge-red/15 text-ge-red" : "border-white/15 text-white/60"
              )}
            >
              {a.full_name}
            </button>
          ))}
        </div>
      </Card>

      {athlete && (
        <Card>
          <div className="mb-2 font-mono text-xs tracking-widest text-white/50 uppercase">Bild wählen</div>
          {images.length === 0 ? (
            <EmptyState>Für {athlete.full_name} ist kein Bild gespeichert.</EmptyState>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((img) => (
                <button
                  key={img.id}
                  onClick={() => setImageId(img.id)}
                  className={clsx(
                    "relative overflow-hidden rounded-lg border-2 transition",
                    selectedImage?.id === img.id ? "border-ge-red" : "border-white/10"
                  )}
                >
                  <img src={img.url} alt={img.filename} className="h-24 w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-black/75 px-1 py-0.5 font-mono text-[9px] text-white/70">
                    {IMAGE_CATEGORY_LABEL[img.category]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="mb-2 font-mono text-xs tracking-widest text-white/50 uppercase">Bewegung</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          placeholder="z.B. Cinematic slow push-in, dramatic stage lighting"
          className="w-full resize-y rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
        />

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">Modell</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as DoPModel)}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
            >
              {DOP_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.hint}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">Kamerafahrt (optional)</span>
            <select
              value={motionId}
              onChange={(e) => setMotionId(e.target.value)}
              disabled={motions.length === 0}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red disabled:opacity-40"
            >
              <option value="">Keine</option>
              {motions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {motionsError && <p className="mt-2 font-mono text-[11px] text-ge-gold">{motionsError}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <GlowButton onClick={() => void generate()} disabled={busy || !selectedImage || !prompt.trim()}>
            {busy ? "Wird gestartet…" : "Video generieren"}
          </GlowButton>
        </div>

        <p className="mt-2 font-mono text-[10px] leading-relaxed text-white/35">
          Jede Generierung kostet Guthaben bei Higgsfield und dauert ein bis mehrere Minuten. Sie läuft im Hintergrund
          weiter — du kannst den Tab wechseln oder die App neu laden. Der fertige Clip erscheint unten.
        </p>
      </Card>

      {error && (
        <Card className="border-ge-red/40">
          <p className="font-mono text-xs leading-relaxed text-ge-red">{error}</p>
        </Card>
      )}

      <VideoJobList />

      <p className="px-1 font-mono text-[10px] text-white/30">
        Video-Links kommen von Higgsfield und können ablaufen — lade dir Clips herunter, die du behalten willst.
      </p>
    </div>
  );
}
