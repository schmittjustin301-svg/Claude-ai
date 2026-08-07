import { useState } from "react";
import clsx from "clsx";
import { Card, GlowButton } from "../../components/ui";
import { useMemoryStore } from "../../store/memoryStore";
import {
  loadObsidianConfig,
  obsidianBackend,
  saveObsidianConfig,
  type ObsidianConfig,
} from "../../lib/memory/obsidianBackend";
import { localMemoryBackend } from "../../lib/memory/backends";

const FIELD =
  "w-full min-w-0 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red";

export function MemoryBackendSettings() {
  const backendId = useMemoryStore((s) => s.backendId);
  const backendError = useMemoryStore((s) => s.backendError);
  const switchBackend = useMemoryStore((s) => s.switchBackend);

  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<ObsidianConfig>(() => loadObsidianConfig());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const set = <K extends keyof ObsidianConfig>(key: K, value: ObsidianConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  function persist(next: ObsidianConfig) {
    saveObsidianConfig(next);
    obsidianBackend.setConfig(next);
  }

  async function handleTest() {
    persist(config);
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await obsidianBackend.check());
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="font-mono text-xs tracking-widest text-white/50 uppercase">Speicherort</span>
        <span className="font-mono text-[11px] text-white/60">
          {backendId === obsidianBackend.id ? "Obsidian" : "Dieses Gerät"} {open ? "▲" : "▼"}
        </span>
      </button>

      {backendError && <p className="mt-2 font-mono text-[11px] text-ge-gold">{backendError}</p>}

      {open && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="flex gap-1.5">
            {[
              { id: localMemoryBackend.id, label: "Dieses Gerät" },
              { id: obsidianBackend.id, label: "Obsidian" },
            ].map((b) => (
              <button
                key={b.id}
                onClick={() => void switchBackend(b.id)}
                className={clsx(
                  "rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase transition",
                  backendId === b.id ? "ge-glow-red bg-ge-red/15 text-ge-red" : "bg-white/5 text-white/50 hover:text-white"
                )}
              >
                {b.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <Field label="Adresse des Plugins">
              <input className={FIELD} value={config.baseUrl} onChange={(e) => set("baseUrl", e.target.value)} />
            </Field>
            <Field label="API-Key aus dem Plugin">
              <input
                type="password"
                className={FIELD}
                value={config.apiKey}
                onChange={(e) => set("apiKey", e.target.value)}
                placeholder="In Obsidian unter Local REST API"
              />
            </Field>
            <Field label="Datei im Vault">
              <input className={FIELD} value={config.notePath} onChange={(e) => set("notePath", e.target.value)} />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <GlowButton variant="ghost" onClick={() => void handleTest()} disabled={testing}>
              {testing ? "Teste…" : "Verbindung testen"}
            </GlowButton>
            <GlowButton
              onClick={() => {
                persist(config);
                setTestResult({ ok: true, message: "Gespeichert." });
              }}
            >
              Speichern
            </GlowButton>
          </div>

          {testResult && (
            <p className={clsx("mt-2 font-mono text-[11px] leading-relaxed", testResult.ok ? "text-ge-green" : "text-ge-red")}>
              {testResult.message}
            </p>
          )}

          <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2.5">
            <p className="font-mono text-[10px] leading-relaxed text-white/40">
              Braucht das Obsidian-Plugin <span className="text-white/70">Local REST API</span> und ein geöffnetes
              Obsidian. Läuft die App über HTTPS, musst du die Plugin-Adresse einmal direkt im Browser aufrufen und das
              selbstsignierte Zertifikat akzeptieren — sonst blockiert der Browser die Verbindung. Am zuverlässigsten
              läuft das auf dem Rechner, auf dem Obsidian offen ist.
            </p>
          </div>
        </div>
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
