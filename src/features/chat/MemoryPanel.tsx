import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useMemoryStore } from "../../store/memoryStore";
import { Card, EmptyState, GlowButton } from "../../components/ui";
import { searchMemories } from "../../lib/memory/memory";
import { MemoryBackendSettings } from "./MemoryBackendSettings";
import { VaultPanel } from "./VaultPanel";
import {
  MEMORY_CATEGORIES,
  MEMORY_CATEGORY_LABEL,
  type MemoryCategory,
  type MemoryImportance,
} from "../../lib/memory/types";

const FIELD =
  "w-full min-w-0 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red";

const IMPORTANCE_STYLE: Record<number, string> = {
  3: "border-ge-red/50 text-ge-red",
  2: "border-ge-gold/50 text-ge-gold",
  1: "border-white/20 text-white/50",
};

export function MemoryPanel() {
  const entries = useMemoryStore((s) => s.entries);
  const loaded = useMemoryStore((s) => s.loaded);
  const load = useMemoryStore((s) => s.load);
  const add = useMemoryStore((s) => s.add);
  const edit = useMemoryStore((s) => s.edit);
  const remove = useMemoryStore((s) => s.remove);
  const exportJson = useMemoryStore((s) => s.exportJson);
  const importJson = useMemoryStore((s) => s.importJson);

  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState<MemoryCategory>("fact");
  const [importance, setImportance] = useState<MemoryImportance>(2);
  const [status, setStatus] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const visible = useMemo(() => {
    if (!query.trim()) {
      return [...entries].sort((a, b) => {
        if (b.importance !== a.importance) return b.importance - a.importance;
        return b.updated_at.localeCompare(a.updated_at);
      });
    }
    return searchMemories(query, entries, 50).map((h) => h.entry);
  }, [entries, query]);

  async function handleAdd() {
    const content = draft.trim();
    if (!content) return;
    await add(content, category, importance, "user");
    setDraft("");
    setStatus("Gespeichert.");
  }

  function handleExport() {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jarvis-gedaechtnis-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    try {
      const result = await importJson(await file.text());
      setStatus(`${result.added} übernommen, ${result.skipped} übersprungen (schon vorhanden).`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Import fehlgeschlagen.");
    }
    if (importRef.current) importRef.current.value = "";
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <MemoryBackendSettings />
      <VaultPanel />

      <Card>
        <div className="mb-2 font-mono text-xs tracking-widest text-white/50 uppercase">Neuer Eintrag</div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="z.B. Justin schneidet Reels am liebsten morgens vor dem Training."
          className={`${FIELD} resize-y`}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value as MemoryCategory)} className={`${FIELD} w-auto`}>
            {MEMORY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {MEMORY_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <select
            value={importance}
            onChange={(e) => setImportance(Number(e.target.value) as MemoryImportance)}
            className={`${FIELD} w-auto`}
          >
            <option value={3}>Zentral</option>
            <option value={2}>Wichtig</option>
            <option value={1}>Detail</option>
          </select>
          <GlowButton onClick={() => void handleAdd()} disabled={!draft.trim()}>
            Merken
          </GlowButton>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Gedächtnis durchsuchen…"
            className={`${FIELD} flex-1`}
          />
          <GlowButton variant="ghost" onClick={handleExport} disabled={entries.length === 0}>
            Export
          </GlowButton>
          <GlowButton variant="ghost" onClick={() => importRef.current?.click()}>
            Import
          </GlowButton>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => void handleImport(e.target.files?.[0])}
          />
        </div>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-white/35">
          Liegt das Gedächtnis auf diesem Gerät, haben PC und Handy je einen eigenen Stand — per Export/Import lässt sich
          einer auf den anderen übertragen. Mit Obsidian als Speicherort landet alles stattdessen in deinem Vault.
        </p>
        {status && <p className="mt-1 font-mono text-[11px] text-ge-green">{status}</p>}
      </Card>

      <div className="flex items-center justify-between px-1">
        <span className="font-mono text-xs text-white/50">
          {visible.length} von {entries.length} Einträgen
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState>
          {entries.length === 0
            ? "Noch nichts gespeichert. JARVIS merkt sich Dinge im Gespräch von selbst — oder trag hier etwas ein."
            : "Keine Treffer."}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2 pb-2">
          {visible.map((entry) => (
            <Card key={entry.id} className="py-3">
              {editingId === entry.id ? (
                <div className="flex flex-col gap-2">
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} className={`${FIELD} resize-y`} />
                  <div className="flex gap-2">
                    <GlowButton
                      onClick={() => {
                        void edit(entry.id, { content: editText.trim() });
                        setEditingId(null);
                      }}
                    >
                      Speichern
                    </GlowButton>
                    <GlowButton variant="ghost" onClick={() => setEditingId(null)}>
                      Abbrechen
                    </GlowButton>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm leading-snug text-white/90">{entry.content}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[10px] text-white/45">
                      {MEMORY_CATEGORY_LABEL[entry.category]}
                    </span>
                    <span
                      className={clsx(
                        "rounded-full border px-2 py-0.5 font-mono text-[10px]",
                        IMPORTANCE_STYLE[entry.importance]
                      )}
                    >
                      {entry.importance === 3 ? "Zentral" : entry.importance === 2 ? "Wichtig" : "Detail"}
                    </span>
                    {entry.source === "jarvis" && (
                      <span className="rounded-full border border-ge-green/30 px-2 py-0.5 font-mono text-[10px] text-ge-green/70">
                        von JARVIS
                      </span>
                    )}
                    <span className="ml-auto flex gap-1.5">
                      <button
                        onClick={() => {
                          setEditingId(entry.id);
                          setEditText(entry.content);
                        }}
                        className="font-mono text-[11px] text-white/40 hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Diesen Eintrag dauerhaft löschen?")) void remove(entry.id);
                        }}
                        className="font-mono text-[11px] text-white/40 hover:text-ge-red"
                      >
                        Löschen
                      </button>
                    </span>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
