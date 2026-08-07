import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useAthleteStore } from "../../store/athleteStore";
import { Card, EmptyState, GlowButton } from "../../components/ui";
import { getImagesForAthlete } from "../../lib/athletes/athleteDb";
import { IMAGE_CATEGORY_LABEL, type AthleteImageRef } from "../../lib/athletes/types";
import { searchAthletes } from "../../lib/athletes/search";
import {
  blobToBase64,
  DOP_MODELS,
  fetchMotions,
  formatFromMime,
  HiggsfieldNotConfiguredError,
  pollUntilDone,
  submitGeneration,
  type DoPModel,
  type GenerationStatus,
  type MotionPreset,
} from "../../lib/higgsfield/higgsfieldClient";
import { AccessCodeRequiredError } from "../../lib/aiClient";

const STATUS_LABEL: Record<GenerationStatus, string> = {
  queued: "In der Warteschlange…",
  in_progress: "Wird generiert…",
  completed: "Fertig",
  failed: "Fehlgeschlagen",
  nsfw: "Von Higgsfield abgelehnt (NSFW-Filter)",
  unknown: "Status unbekannt",
};

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
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  useEffect(() => () => abortRef.current?.abort(), []);

  const generate = useCallback(async () => {
    if (!athleteId || !selectedImage || !prompt.trim()) return;
    setBusy(true);
    setError(null);
    setVideoUrl(null);
    setStatus("queued");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // The stored blob has no public URL, so the bytes go to the proxy, which
      // uploads them to Higgsfield and hands back a hosted address.
      const stored = (await getImagesForAthlete(athleteId)).find((i) => i.id === selectedImage.id);
      if (!stored) throw new Error("Bild nicht gefunden.");

      const submitted = await submitGeneration({
        imageBase64: await blobToBase64(stored.blob),
        format: formatFromMime(stored.blob.type),
        prompt: prompt.trim(),
        model,
        motions: motionId ? [{ id: motionId, strength: 0.8 }] : undefined,
      });

      const result = await pollUntilDone(submitted.status_url, setStatus, controller.signal);
      if (result.status === "completed" && result.video_url) {
        setVideoUrl(result.video_url);
      } else if (result.status !== "completed") {
        setError(STATUS_LABEL[result.status]);
      } else {
        setError("Higgsfield meldet fertig, liefert aber kein Video.");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof AccessCodeRequiredError) {
        setError(`${err.message} Trag ihn im JARVIS-Tab ein.`);
      } else {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [athleteId, model, motionId, prompt, selectedImage]);

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
                setVideoUrl(null);
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
            {busy ? "Läuft…" : "Video generieren"}
          </GlowButton>
          {busy && (
            <GlowButton variant="ghost" onClick={() => abortRef.current?.abort()}>
              Abbrechen
            </GlowButton>
          )}
          {status && busy && <span className="font-mono text-[11px] text-white/60">{STATUS_LABEL[status]}</span>}
        </div>

        <p className="mt-2 font-mono text-[10px] text-white/35">
          Jede Generierung kostet Guthaben bei Higgsfield und dauert typischerweise ein bis mehrere Minuten.
        </p>
      </Card>

      {error && (
        <Card className="border-ge-red/40">
          <p className="font-mono text-xs leading-relaxed text-ge-red">{error}</p>
        </Card>
      )}

      {videoUrl && (
        <Card>
          <div className="mb-2 font-mono text-xs tracking-widest text-white/50 uppercase">Ergebnis</div>
          <video src={videoUrl} controls playsInline className="w-full rounded-lg border border-white/10" />
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={videoUrl} download target="_blank" rel="noreferrer">
              <GlowButton variant="green">Herunterladen</GlowButton>
            </a>
          </div>
          <p className="mt-2 font-mono text-[10px] text-white/35">
            Der Link kommt von Higgsfield und kann irgendwann ablaufen — lade dir den Clip herunter, wenn du ihn behalten
            willst.
          </p>
        </Card>
      )}
    </div>
  );
}
