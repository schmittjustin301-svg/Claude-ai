import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useEmpireStore } from "../../store/empireStore";
import { Card, GlowButton, SectionTitle } from "../../components/ui";
import { callAssistant, ProxyNotConfiguredError, type AnthropicMessage, type ContentBlock } from "../../lib/aiClient";
import { ALL_TOOL_DEFINITIONS, executeTool } from "../../lib/aiTools";
import {
  clearPendingUploads,
  setPendingUploads,
  type PendingUpload,
} from "../../lib/athletes/athleteTools";
import { useAthleteStore } from "../../store/athleteStore";
import { useMemoryStore } from "../../store/memoryStore";
import { MemoryPanel } from "./MemoryPanel";
import { buildSystemPrompt } from "../../lib/systemPrompt";
import { VoiceOrb, type VoiceState } from "./VoiceOrb";
import {
  isRecognitionSupported,
  isSynthesisSupported,
  speak,
  startListening,
  stopSpeaking,
  unlockSynthesis,
} from "../../lib/speech";
import { startMicMeter, type MicMeter } from "../../lib/micLevel";

const MAX_TOOL_TURNS = 6;
/**
 * Number of past chat messages resent to the API. The transcript is a rolling
 * window, not the memory: anything that must survive beyond it belongs in the
 * memory store, which is injected into the system prompt in full.
 */
const MAX_HISTORY_MESSAGES = 24;
const NOT_CONFIGURED_SPOKEN = "JARVIS ist noch nicht verbunden. Trag deinen API-Key ein.";
const NOT_CONFIGURED_TEXT =
  "JARVIS ist noch nicht verbunden. Lege eine .env mit ANTHROPIC_API_KEY an und starte den Dev-Server neu — dann läuft das Gespräch über den lokalen Proxy (siehe README).";

export function ChatScreen() {
  const chatMessages = useEmpireStore((s) => s.chatMessages);
  const addChatMessage = useEmpireStore((s) => s.addChatMessage);
  const clearChat = useEmpireStore((s) => s.clearChat);
  const store = useEmpireStore;

  const [input, setInput] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [micLevel, setMicLevel] = useState(0);
  const [interim, setInterim] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [handsFree, setHandsFree] = useState(true);
  const [voiceOut, setVoiceOut] = useState(true);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [view, setView] = useState<"chat" | "memory">("chat");
  const attachRef = useRef<HTMLInputElement>(null);
  const refreshAthletes = useAthleteStore((s) => s.refreshAthletes);
  const loadMemory = useMemoryStore((s) => s.load);
  const memoryCount = useMemoryStore((s) => s.entries.length);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const micMeterRef = useRef<MicMeter | null>(null);
  const gotFinalRef = useRef(false);
  const handsFreeRef = useRef(handsFree);
  const voiceOutRef = useRef(voiceOut);
  const unmountedRef = useRef(false);

  handsFreeRef.current = handsFree;
  voiceOutRef.current = voiceOut;

  const sttSupported = isRecognitionSupported();
  const ttsSupported = isSynthesisSupported();
  const busy = voiceState === "thinking";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, interim, voiceState]);

  const teardownMic = useCallback(() => {
    stopListeningRef.current?.();
    stopListeningRef.current = null;
    micMeterRef.current?.stop();
    micMeterRef.current = null;
    setMicLevel(0);
    setInterim("");
  }, []);

  useEffect(() => {
    // Loaded up front, not only when the panel opens: the memory block goes
    // into the system prompt on every turn, including the very first one.
    void loadMemory();
  }, [loadMemory]);

  useEffect(() => {
    // Must be reset on mount, not only set on unmount: StrictMode mounts,
    // unmounts and remounts in dev, which would otherwise leave this stuck
    // at true and make every completion callback bail out forever.
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      teardownMic();
      stopSpeaking();
    };
  }, [teardownMic]);

  /** One round-trip to the assistant, running the tool-use loop to completion. */
  const askAssistant = useCallback(
    async (userText: string, uploads: PendingUpload[]): Promise<string> => {
      const noteSuffix = uploads.length > 0 ? `\n[${uploads.length} Bild(er) angehängt]` : "";
      addChatMessage("user", userText + noteSuffix);

      const history = store.getState().chatMessages;
      const memories = useMemoryStore.getState().entries;
      const system = buildSystemPrompt(store.getState().getEmpireStatus(), memories);

      let messages: AnthropicMessage[] = history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-MAX_HISTORY_MESSAGES)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      // Attach the images to the latest user turn so the model can see them.
      if (uploads.length > 0) {
        const imageBlocks: ContentBlock[] = await Promise.all(
          uploads.map(async (u) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: u.file.type || "image/jpeg", data: await fileToBase64(u.file) },
          }))
        );
        messages = [
          ...messages.slice(0, -1),
          { role: "user", content: [...imageBlocks, { type: "text", text: userText || "Bild(er) hochgeladen." }] },
        ];
      }

      for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
        const response = await callAssistant({ system, messages, tools: ALL_TOOL_DEFINITIONS });
        const toolUses = response.content.filter(
          (b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use"
        );
        const textBlocks = response.content.filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text");

        if (toolUses.length === 0) {
          return textBlocks.map((b) => b.text).join("\n").trim() || "Erledigt.";
        }

        const toolResults: ContentBlock[] = await Promise.all(
          toolUses.map(async (call) => ({
            type: "tool_result" as const,
            tool_use_id: call.id,
            content: JSON.stringify(await executeTool(call.name, call.input, store.getState())),
          }))
        );

        messages = [...messages, { role: "assistant", content: response.content }, { role: "user", content: toolResults }];
      }

      return "Das hat zu viele Schritte gebraucht — frag nochmal konkreter.";
    },
    [addChatMessage, store]
  );

  // Forward declaration so the speak-then-listen loop can restart a turn.
  const startVoiceTurnRef = useRef<() => void>(() => {});

  /** Handles a finished user utterance: think, reply, optionally speak, optionally listen again. */
  const handleUtterance = useCallback(
    async (text: string) => {
      /** Speaks the reply (if enabled) and always lands back on a usable state. */
      const finishTurn = (toSpeak: string, wasError: boolean) => {
        if (unmountedRef.current) return;
        if (!voiceOutRef.current || !ttsSupported) {
          setVoiceState("idle");
          return;
        }
        setVoiceState("speaking");
        speak(toSpeak, () => {
          if (unmountedRef.current) return;
          // Only chain another listening turn once the voice has finished,
          // otherwise the mic would transcribe JARVIS talking to itself.
          if (handsFreeRef.current && !wasError && sttSupported) {
            startVoiceTurnRef.current();
          } else {
            setVoiceState("idle");
          }
        });
      };

      setNotice(null);
      setVoiceState("thinking");

      // Hand the attachments to the tool layer, which pulls the bytes out of
      // this buffer when the model decides where they belong.
      const attached = uploads;
      setPendingUploads(attached);

      try {
        const reply = await askAssistant(text, attached);
        if (unmountedRef.current) return;
        addChatMessage("assistant", reply);
        attached.forEach((u) => URL.revokeObjectURL(u.previewUrl));
        setUploads([]);
        clearPendingUploads();
        void refreshAthletes();
        // JARVIS may have written memories during the tool loop.
        void loadMemory();
        finishTurn(reply, false);
      } catch (err) {
        clearPendingUploads();
        const isUnconfigured = err instanceof ProxyNotConfiguredError;
        const reply = isUnconfigured
          ? NOT_CONFIGURED_TEXT
          : err instanceof Error
            ? err.message
            : "Unbekannter Fehler beim Kontaktieren von JARVIS.";
        setNotice(reply);
        // Keep the spoken form short — the on-screen notice carries the detail.
        finishTurn(isUnconfigured ? NOT_CONFIGURED_SPOKEN : "Da ist etwas schiefgelaufen.", true);
      }
    },
    [addChatMessage, askAssistant, loadMemory, refreshAthletes, sttSupported, ttsSupported, uploads]
  );

  const startVoiceTurn = useCallback(() => {
    if (unmountedRef.current) return;
    teardownMic();
    stopSpeaking();
    setNotice(null);
    gotFinalRef.current = false;
    setVoiceState("listening");

    void startMicMeter(setMicLevel).then((meter) => {
      if (unmountedRef.current || !meter) return;
      micMeterRef.current = meter;
    });

    stopListeningRef.current = startListening({
      onInterim: setInterim,
      onFinal: (text) => {
        gotFinalRef.current = true;
        void handleUtterance(text);
      },
      onError: (message) => {
        if (message) setNotice(message);
      },
      onEnd: () => {
        micMeterRef.current?.stop();
        micMeterRef.current = null;
        setMicLevel(0);
        setInterim("");
        stopListeningRef.current = null;
        // No speech captured — drop back to idle instead of hanging.
        if (!gotFinalRef.current) setVoiceState("idle");
      },
    });
  }, [handleUtterance, teardownMic]);

  startVoiceTurnRef.current = startVoiceTurn;

  const onMicPress = useCallback(() => {
    if (voiceState === "listening") {
      // Stop early; whatever was captured still gets submitted by onEnd.
      stopListeningRef.current?.();
      return;
    }
    if (voiceState === "speaking") {
      stopSpeaking();
      setVoiceState("idle");
      return;
    }
    if (busy) return;
    unlockSynthesis(); // must happen inside the click gesture for iOS
    startVoiceTurn();
  }, [busy, startVoiceTurn, voiceState]);

  const onSubmitText = useCallback(() => {
    const text = input.trim();
    // Images alone are a valid message — JARVIS files them into the database.
    if ((!text && uploads.length === 0) || busy) return;
    setInput("");
    void handleUtterance(text || "Bitte im Athleten-Verzeichnis ablegen.");
  }, [busy, handleUtterance, input, uploads.length]);

  const onAttach = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const added: PendingUpload[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }));
    setUploads((prev) => [...prev, ...added]);
    if (attachRef.current) attachRef.current.value = "";
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <SectionTitle
        right={
          view === "chat" &&
          chatMessages.length > 0 && (
            <button onClick={clearChat} className="font-mono text-xs text-white/40 hover:text-white/70">
              Verlauf löschen
            </button>
          )
        }
      >
        JARVIS
      </SectionTitle>

      <div className="flex shrink-0 gap-1.5">
        {(["chat", "memory"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={clsx(
              "rounded-lg px-3 py-1.5 font-display text-sm tracking-wide uppercase transition",
              view === v ? "ge-glow-red bg-ge-red/15 text-ge-red" : "bg-white/5 text-white/50 hover:text-white"
            )}
          >
            {v === "chat" ? "Chat" : `Gedächtnis${memoryCount > 0 ? ` (${memoryCount})` : ""}`}
          </button>
        ))}
      </div>

      {view === "memory" && <MemoryPanel />}

      <div className={clsx("flex shrink-0 flex-col items-center", view !== "chat" && "hidden")}>
        <button onClick={onMicPress} disabled={busy} className="disabled:cursor-not-allowed" aria-label="Mikrofon">
          <VoiceOrb state={voiceState} level={micLevel} />
        </button>

        <div className="mt-2 h-10 px-4 text-center">
          {interim ? (
            <p className="font-mono text-sm text-ge-green">{interim}</p>
          ) : (
            <p className="font-mono text-[11px] text-white/40">
              {voiceState === "idle" ? "Tippe den Kern an und sprich" : " "}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Toggle active={handsFree} onClick={() => setHandsFree((v) => !v)} disabled={!sttSupported}>
            Hands-free
          </Toggle>
          <Toggle active={voiceOut} onClick={() => setVoiceOut((v) => !v)} disabled={!ttsSupported}>
            Sprachausgabe
          </Toggle>
        </div>
      </div>

      <Card className={clsx("flex min-h-0 flex-1 flex-col p-0", view !== "chat" && "hidden")}>
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {chatMessages.length === 0 && (
            <div className="pt-4 text-center font-mono text-xs text-white/40">
              „Was soll ich heute machen?“ · „Ich hab 3 Reels für Justingymlife geschnitten“ · „Wie läuft's diesen Monat?“
            </div>
          )}
          {chatMessages
            .filter((m) => m.role !== "tool")
            .map((m) => (
              <div
                key={m.id}
                className={clsx(
                  "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap",
                  m.role === "user" ? "ml-auto bg-ge-red/20 text-ge-white" : "border border-white/10 bg-white/5 text-white/90"
                )}
              >
                {m.content}
              </div>
            ))}
          {busy && <div className="font-mono text-xs text-white/40">JARVIS denkt nach…</div>}
          {notice && (
            <div className="rounded-xl border border-ge-gold/40 bg-ge-gold/10 px-3.5 py-2.5 font-mono text-xs text-ge-gold">
              {notice}
            </div>
          )}
          {!sttSupported && (
            <div className="rounded-xl border border-white/15 px-3.5 py-2.5 font-mono text-[11px] text-white/50">
              Dieser Browser kann kein Mikrofon-Diktat. Nutze Chrome oder Safari — Tippen funktioniert überall.
            </div>
          )}
        </div>

        <div className={clsx("border-t border-white/10 p-3", view !== "chat" && "hidden")}>
          {uploads.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {uploads.map((u) => (
                <div key={u.id} className="relative">
                  <img src={u.previewUrl} alt="" className="h-14 w-14 rounded-lg border border-white/15 object-cover" />
                  <button
                    onClick={() => {
                      URL.revokeObjectURL(u.previewUrl);
                      setUploads((prev) => prev.filter((p) => p.id !== u.id));
                    }}
                    className="absolute -top-1.5 -right-1.5 rounded-full bg-black px-1.5 text-xs text-ge-red"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmitText();
            }}
          >
            <input
              ref={attachRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => onAttach(e.target.files)}
              className="hidden"
            />
            <GlowButton variant="ghost" onClick={() => attachRef.current?.click()} disabled={busy}>
              📎
            </GlowButton>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="…oder tippen"
              disabled={busy}
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red disabled:opacity-50"
            />
            <GlowButton type="submit" disabled={busy || (!input.trim() && uploads.length === 0)}>
              Senden
            </GlowButton>
          </form>
        </div>
      </Card>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "rounded-full border px-3 py-1 font-mono text-[11px] tracking-wide uppercase transition disabled:opacity-30",
        active && !disabled ? "border-ge-green/50 bg-ge-green/10 text-ge-green" : "border-white/15 text-white/40"
      )}
    >
      {children}
    </button>
  );
}

/** Strips the data-URL prefix — the API wants raw base64. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}
