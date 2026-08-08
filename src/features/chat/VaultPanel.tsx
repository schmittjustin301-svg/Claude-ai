import { useEffect, useState } from "react";
import clsx from "clsx";
import { useVaultStore } from "../../store/vaultStore";
import { Card, GlowButton } from "../../components/ui";
import { VAULT_ROOT } from "../../lib/vault/vaultNotes";

export function VaultPanel() {
  const enabled = useVaultStore((s) => s.enabled);
  const queue = useVaultStore((s) => s.queue);
  const syncing = useVaultStore((s) => s.syncing);
  const available = useVaultStore((s) => s.available);
  const lastSync = useVaultStore((s) => s.lastSync);
  const setEnabled = useVaultStore((s) => s.setEnabled);
  const flush = useVaultStore((s) => s.flush);
  const check = useVaultStore((s) => s.checkAvailability);
  const clearQueue = useVaultStore((s) => s.clearQueue);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (enabled) void check();
  }, [enabled, check]);

  const failed = queue.filter((t) => t.attempts > 0).length;

  return (
    <Card>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="font-mono text-xs tracking-widest text-white/50 uppercase">Vault-Sync</span>
        <span className="font-mono text-[11px] text-white/60">
          {!enabled ? "Aus" : queue.length > 0 ? `${queue.length} offen` : "Aktuell"} {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <label className="flex items-center gap-2 font-mono text-[11px] text-white/70">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#ff1432]"
            />
            Alles in den Obsidian-Vault schreiben
          </label>

          <p className="mt-2 font-mono text-[10px] leading-relaxed text-white/40">
            Erledigte Contracts, Einnahmen, Athleten, Shows, Posts, Clips, Boss-Siege und Achievements landen als
            Markdown mit YAML-Frontmatter unter <span className="text-white/70">{VAULT_ROOT}/</span>. Geschrieben wird
            immer additiv — Notizen wachsen, nichts wird überschrieben. Nutzt dieselbe Verbindung wie das Gedächtnis.
          </p>

          {enabled && (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={clsx(
                    "rounded-full border px-2.5 py-0.5 font-mono text-[10px]",
                    available === null
                      ? "border-white/20 text-white/50"
                      : available
                        ? "border-ge-green/40 text-ge-green"
                        : "border-ge-red/40 text-ge-red"
                  )}
                >
                  {available === null ? "ungeprüft" : available ? "verbunden" : "nicht erreichbar"}
                </span>
                {syncing && <span className="font-mono text-[10px] text-ge-gold">synchronisiert…</span>}
                {lastSync && !syncing && (
                  <span className="font-mono text-[10px] text-white/30">
                    zuletzt {new Date(lastSync).toLocaleTimeString()}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <GlowButton variant="ghost" onClick={() => void flush()} disabled={syncing || queue.length === 0}>
                  Jetzt synchronisieren
                </GlowButton>
                {queue.length > 0 && (
                  <GlowButton
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`${queue.length} ausstehende Einträge verwerfen?`)) clearQueue();
                    }}
                  >
                    Warteschlange leeren
                  </GlowButton>
                )}
              </div>

              {queue.length > 0 && (
                <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2">
                  {queue.slice(-12).map((task) => (
                    <div key={task.id} className="flex items-center gap-2 py-0.5">
                      <span className={clsx("font-mono text-[10px]", task.attempts > 0 ? "text-ge-gold" : "text-white/40")}>
                        {task.attempts > 0 ? `${task.attempts}×` : "•"}
                      </span>
                      <span className="truncate font-mono text-[10px] text-white/50">{task.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {failed > 0 && (
                <p className="mt-2 font-mono text-[10px] text-ge-gold">
                  {failed} Einträge warten auf eine Verbindung. Sie bleiben erhalten und werden nachgeholt, sobald
                  Obsidian erreichbar ist.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
