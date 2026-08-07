import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useEmpireStore } from "../../store/empireStore";
import { Card, GlowButton, SectionTitle } from "../../components/ui";
import { callAssistant, ProxyNotConfiguredError, type AnthropicMessage, type ContentBlock } from "../../lib/aiClient";
import { executeTool, TOOL_DEFINITIONS } from "../../lib/aiTools";
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
    async (userText: string): Promise<string> => {
      addChatMessage("user", userText);

      const history = store.getState().chatMessages;
      const system = buildSystemPrompt(store.getState().getEmpireStatus());

      let messages: AnthropicMessage[] = history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
        const response = await callAssistant({ system, messages, tools: TOOL_DEFINITIONS });
        const toolUses = response.content.filter(
          (b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use"
        );
        const textBlocks = response.content.filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text");

        if (toolUses.length === 0) {
          return textBlocks.map((b) => b.text).join("\n").trim() || "Erledigt.";
        }

        const toolResults: ContentBlock[] = toolUses.map((call) => ({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(executeTool(call.name, call.input, store.getState())),
        }));

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

      try {
        const reply = await askAssistant(text);
        if (unmountedRef.current) return;
        addChatMessage("assistant", reply);
        finishTurn(reply, false);
      } catch (err) {
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
    [addChatMessage, askAssistant, sttSupported, ttsSupported]
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
    if (!text || busy) return;
    setInput("");
    void handleUtterance(text);
  }, [busy, handleUtterance, input]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <SectionTitle
        right={
          chatMessages.length > 0 && (
            <button onClick={clearChat} className="font-mono text-xs text-white/40 hover:text-white/70">
              Verlauf löschen
            </button>
          )
        }
      >
        JARVIS
      </SectionTitle>

      <div className="flex shrink-0 flex-col items-center">
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

      <Card className="flex min-h-0 flex-1 flex-col p-0">
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

        <form
          className="flex gap-2 border-t border-white/10 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitText();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="…oder tippen"
            disabled={busy}
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red disabled:opacity-50"
          />
          <GlowButton type="submit" disabled={busy || !input.trim()}>
            Senden
          </GlowButton>
        </form>
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
