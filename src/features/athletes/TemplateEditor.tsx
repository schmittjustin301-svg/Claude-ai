import { useState } from "react";
import { useAthleteStore } from "../../store/athleteStore";
import { Card, GlowButton } from "../../components/ui";
import { cloneTemplate, DEFAULT_TEMPLATES, type CardTemplate, type LogoPlacement } from "../../lib/athletes/templates";

export function TemplateEditor() {
  const templates = useAthleteStore((s) => s.templates);
  const saveTemplate = useAthleteStore((s) => s.saveTemplate);
  const deleteTemplate = useAthleteStore((s) => s.deleteTemplate);

  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const template = templates.find((t) => t.id === selectedId) ?? templates[0];

  if (!template) return null;
  const isBuiltIn = DEFAULT_TEMPLATES.some((d) => d.id === template.id);

  const update = <K extends keyof CardTemplate>(key: K, value: CardTemplate[K]) => {
    void saveTemplate({ ...template, [key]: value });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <GlowButton
            variant="ghost"
            onClick={() => {
              const name = prompt("Name des neuen Templates:", `${template.name} Kopie`);
              if (!name) return;
              const copy = cloneTemplate(template, name);
              void saveTemplate(copy).then(() => setSelectedId(copy.id));
            }}
          >
            Duplizieren
          </GlowButton>
          {!isBuiltIn && (
            <GlowButton
              variant="ghost"
              onClick={() => {
                if (!confirm(`Template "${template.name}" löschen?`)) return;
                void deleteTemplate(template.id).then(() => setSelectedId(DEFAULT_TEMPLATES[0].id));
              }}
            >
              ✕
            </GlowButton>
          )}
        </div>
        {isBuiltIn && (
          <p className="mt-2 font-mono text-[10px] text-white/35">
            Änderungen an mitgelieferten Templates werden lokal gespeichert. Für eine eigene Marke lieber duplizieren.
          </p>
        )}
      </Card>

      <Card>
        <Section>Allgemein</Section>
        <Row label="Name">
          <input className={FIELD} value={template.name} onChange={(e) => update("name", e.target.value)} />
        </Row>
        <Row label="Titel anzeigen">
          <input type="checkbox" checked={template.showTitle} onChange={(e) => update("showTitle", e.target.checked)} className="h-4 w-4 accent-[#ff1432]" />
        </Row>
        <Row label="Titel">
          <input className={FIELD} value={template.title} onChange={(e) => update("title", e.target.value)} />
        </Row>

        <Section>Hintergrund</Section>
        <ColorRow label="Hintergrund" value={template.background} onChange={(v) => update("background", v)} />
        <ColorRow label="Verlauf (unten)" value={template.backgroundGradient ?? "#000000"} onChange={(v) => update("backgroundGradient", v)} />
        <Row label="Grid-Overlay">
          <input type="checkbox" checked={template.gridOverlay} onChange={(e) => update("gridOverlay", e.target.checked)} className="h-4 w-4 accent-[#ff1432]" />
        </Row>

        <Section>Karte</Section>
        <ColorRow label="Kartenfläche" value={template.cardBackground} onChange={(v) => update("cardBackground", v)} />
        <ColorRow label="Rahmenfarbe" value={template.borderColor} onChange={(v) => update("borderColor", v)} />
        <NumRow label="Rahmenbreite" value={template.borderWidth} min={0} max={12} onChange={(v) => update("borderWidth", v)} />
        <NumRow label="Eckenradius" value={template.cornerRadius} min={0} max={64} onChange={(v) => update("cornerRadius", v)} />
        <NumRow label="Schatten" value={template.shadowBlur} min={0} max={100} onChange={(v) => update("shadowBlur", v)} />
        <NumRow label="Bildanteil %" value={Math.round(template.imageRatio * 100)} min={40} max={90} onChange={(v) => update("imageRatio", v / 100)} />

        <Section>Typografie & Farben</Section>
        <Row label="Headline-Font">
          <input className={FIELD} value={template.headingFont} onChange={(e) => update("headingFont", e.target.value)} />
        </Row>
        <Row label="Body-Font">
          <input className={FIELD} value={template.bodyFont} onChange={(e) => update("bodyFont", e.target.value)} />
        </Row>
        <ColorRow label="Name" value={template.nameColor} onChange={(v) => update("nameColor", v)} />
        <ColorRow label="Division / Akzent" value={template.divisionColor} onChange={(v) => update("divisionColor", v)} />
        <ColorRow label="Akzentbalken" value={template.accentColor} onChange={(v) => update("accentColor", v)} />
        <NumRow label="Namensgröße %" value={Math.round(template.nameSize * 100)} min={5} max={20} onChange={(v) => update("nameSize", v / 100)} />
        <Row label="Namen in Großbuchstaben">
          <input type="checkbox" checked={template.uppercaseNames} onChange={(e) => update("uppercaseNames", e.target.checked)} className="h-4 w-4 accent-[#ff1432]" />
        </Row>

        <Section>Abstände</Section>
        <NumRow label="Außenabstand" value={template.padding} min={0} max={160} onChange={(v) => update("padding", v)} />
        <NumRow label="Kartenabstand" value={template.spacing} min={0} max={80} onChange={(v) => update("spacing", v)} />

        <Section>Branding</Section>
        <Row label="Logo-Position">
          <select
            className={FIELD}
            value={template.logoPlacement}
            onChange={(e) => update("logoPlacement", e.target.value as LogoPlacement)}
          >
            {(["none", "top_left", "top_right", "bottom_left", "bottom_right"] as LogoPlacement[]).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Logo-Text">
          <input className={FIELD} value={template.logoText} onChange={(e) => update("logoText", e.target.value)} />
        </Row>

        <div className="mt-3 flex items-center gap-3">
          <GlowButton onClick={() => setStatus("Templates werden automatisch gespeichert.")}>OK</GlowButton>
          {status && <span className="font-mono text-xs text-ge-green">{status}</span>}
        </div>
      </Card>
    </div>
  );
}

const FIELD =
  "w-full min-w-0 rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-ge-red";

function Section({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 mb-2 font-mono text-[10px] tracking-widest text-ge-red uppercase">{children}</div>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-1.5">
      <span className="font-mono text-[11px] text-white/50">{label}</span>
      <div className="w-1/2 max-w-[220px]">{children}</div>
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-10 rounded border border-white/15 bg-transparent" />
        <input className={FIELD} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Row>
  );
}

function NumRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[#ff1432]" />
        <span className="w-9 text-right font-mono text-[11px] text-white/50">{value}</span>
      </div>
    </Row>
  );
}
