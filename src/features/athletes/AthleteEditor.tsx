import { useEffect, useRef, useState } from "react";
import { useAthleteStore } from "../../store/athleteStore";
import { Card, GlowButton } from "../../components/ui";
import {
  IMAGE_CATEGORIES,
  IMAGE_CATEGORY_LABEL,
  OLYMPIA_STATUS_LABEL,
  type Athlete,
  type AthleteImageRef,
  type ImageCategory,
  type OlympiaStatus,
} from "../../lib/athletes/types";

const FIELD =
  "w-full min-w-0 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red";

/** Shared empty fallback so the images selector keeps a stable identity. */
const NO_IMAGES: AthleteImageRef[] = [];

export function AthleteEditor({
  athlete,
  onClose,
  onSaved,
}: {
  athlete: Athlete | null;
  onClose: () => void;
  onSaved: (athlete: Athlete) => void;
}) {
  const editAthlete = useAthleteStore((s) => s.editAthlete);
  const saveAthlete = useAthleteStore((s) => s.saveAthlete);
  const addImage = useAthleteStore((s) => s.addImage);
  const removeImage = useAthleteStore((s) => s.removeImage);
  const loadImages = useAthleteStore((s) => s.loadImages);
  // The selector must return a stable reference: defaulting to `[]` *inside*
  // it allocates a fresh array each call, so Zustand sees a changed value every
  // render and loops until React bails with "Maximum update depth exceeded".
  const storedImages = useAthleteStore((s) => (athlete ? s.imagesByAthlete[athlete.id] : undefined));
  const images = storedImages ?? NO_IMAGES;

  const [form, setForm] = useState(() => toForm(athlete));
  const [uploadCategory, setUploadCategory] = useState<ImageCategory>("portrait");
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(toForm(athlete));
    if (athlete) void loadImages(athlete.id);
  }, [athlete, loadImages]);

  const set = <K extends keyof ReturnType<typeof toForm>>(key: K, value: ReturnType<typeof toForm>[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSave() {
    if (!form.full_name.trim()) {
      setStatus("Name ist erforderlich.");
      return;
    }
    const input = {
      full_name: form.full_name.trim(),
      nickname: form.nickname.trim() || undefined,
      division: form.division.trim() || undefined,
      country: form.country.trim() || undefined,
      team: form.team.trim() || undefined,
      coach: form.coach.trim() || undefined,
      olympia_status: form.olympia_status,
      height: form.height.trim() || undefined,
      weight: form.weight.trim() || undefined,
      season: form.season.trim() || undefined,
      notes: form.notes.trim() || undefined,
      sponsors: form.sponsors.split(",").map((s) => s.trim()).filter(Boolean),
      tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
      socials: {
        instagram: form.instagram.trim() || undefined,
        youtube: form.youtube.trim() || undefined,
        tiktok: form.tiktok.trim() || undefined,
        x: form.x.trim() || undefined,
        website: form.website.trim() || undefined,
      },
    };

    if (athlete) {
      await editAthlete(athlete.id, input);
      setStatus("Gespeichert.");
    } else {
      const result = await saveAthlete(input);
      setStatus(result.created ? "Athlet angelegt." : `Mit bestehendem Profil zusammengeführt: ${result.mergedInto}`);
      // Stay open on the saved record — images can only be attached once the
      // profile exists, and closing here would force an immediate reopen.
      onSaved(result.athlete);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !athlete) return;
    for (const file of Array.from(files)) {
      await addImage(athlete.id, file, uploadCategory);
    }
    setStatus(`${files.length} Bild(er) hinzugefügt.`);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div className="font-display text-lg tracking-wide text-ge-white uppercase">
          {athlete ? "Athlet bearbeiten" : "Neuer Athlet"}
        </div>
        <button onClick={onClose} className="font-mono text-xs text-white/40 hover:text-white/70">
          Schließen
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Voller Name *">
          <input className={FIELD} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
        </Field>
        <Field label="Nickname">
          <input className={FIELD} value={form.nickname} onChange={(e) => set("nickname", e.target.value)} />
        </Field>
        <Field label="Division">
          <input className={FIELD} value={form.division} onChange={(e) => set("division", e.target.value)} />
        </Field>
        <Field label="Land">
          <input className={FIELD} value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="USA" />
        </Field>
        <Field label="Team">
          <input className={FIELD} value={form.team} onChange={(e) => set("team", e.target.value)} />
        </Field>
        <Field label="Coach">
          <input className={FIELD} value={form.coach} onChange={(e) => set("coach", e.target.value)} />
        </Field>
        <Field label="Olympia-Status">
          <select
            className={FIELD}
            value={form.olympia_status}
            onChange={(e) => set("olympia_status", e.target.value as OlympiaStatus)}
          >
            {(Object.keys(OLYMPIA_STATUS_LABEL) as OlympiaStatus[]).map((k) => (
              <option key={k} value={k}>
                {OLYMPIA_STATUS_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Season">
          <input className={FIELD} value={form.season} onChange={(e) => set("season", e.target.value)} placeholder="2026" />
        </Field>
        <Field label="Größe">
          <input className={FIELD} value={form.height} onChange={(e) => set("height", e.target.value)} placeholder="168 cm" />
        </Field>
        <Field label="Gewicht">
          <input className={FIELD} value={form.weight} onChange={(e) => set("weight", e.target.value)} placeholder="58 kg" />
        </Field>
        <Field label="Instagram">
          <input className={FIELD} value={form.instagram} onChange={(e) => set("instagram", e.target.value)} />
        </Field>
        <Field label="YouTube">
          <input className={FIELD} value={form.youtube} onChange={(e) => set("youtube", e.target.value)} />
        </Field>
        <Field label="Sponsoren (Komma-getrennt)">
          <input className={FIELD} value={form.sponsors} onChange={(e) => set("sponsors", e.target.value)} />
        </Field>
        <Field label="Tags (Komma-getrennt)">
          <input className={FIELD} value={form.tags} onChange={(e) => set("tags", e.target.value)} />
        </Field>
      </div>

      <div className="mt-2">
        <Field label="Notizen">
          <textarea className={`${FIELD} h-20 resize-none`} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>

      {athlete && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="mb-2 font-mono text-xs tracking-widest text-white/50 uppercase">Bilder</div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              className={`${FIELD} w-auto`}
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as ImageCategory)}
            >
              {IMAGE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {IMAGE_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => void handleFiles(e.target.files)}
              className="text-xs text-white/60 file:mr-2 file:rounded-lg file:border-0 file:bg-ge-red file:px-3 file:py-1.5 file:text-xs file:text-white"
            />
          </div>

          {images.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/15 p-4 text-center text-xs text-white/40">
              Noch keine Bilder.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((img) => (
                <div key={img.id} className="group relative overflow-hidden rounded-lg border border-white/10">
                  <img src={img.url} alt={img.filename} className="h-24 w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-black/75 px-1.5 py-0.5 font-mono text-[9px] text-white/70">
                    {IMAGE_CATEGORY_LABEL[img.category]}
                  </div>
                  <button
                    onClick={() => void removeImage(athlete.id, img.id)}
                    className="absolute top-1 right-1 rounded bg-black/80 px-1.5 text-xs text-ge-red opacity-0 transition group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <GlowButton onClick={() => void handleSave()}>Speichern</GlowButton>
        {status && <span className="font-mono text-xs text-ge-green">{status}</span>}
      </div>
      {!athlete && (
        <p className="mt-2 font-mono text-[11px] text-white/40">
          Bilder lassen sich anhängen, sobald das Profil gespeichert ist.
        </p>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">{label}</span>
      {children}
    </label>
  );
}

function toForm(a: Athlete | null) {
  return {
    full_name: a?.full_name ?? "",
    nickname: a?.nickname ?? "",
    division: a?.division ?? "",
    country: a?.country ?? "",
    team: a?.team ?? "",
    coach: a?.coach ?? "",
    olympia_status: a?.olympia_status ?? ("unknown" as OlympiaStatus),
    height: a?.height ?? "",
    weight: a?.weight ?? "",
    season: a?.season ?? "",
    notes: a?.notes ?? "",
    sponsors: (a?.sponsors ?? []).join(", "),
    tags: (a?.tags ?? []).join(", "),
    instagram: a?.socials.instagram ?? "",
    youtube: a?.socials.youtube ?? "",
    tiktok: a?.socials.tiktok ?? "",
    x: a?.socials.x ?? "",
    website: a?.socials.website ?? "",
  };
}
