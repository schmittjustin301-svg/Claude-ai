import { useEffect, useRef, useState } from "react";
import { useEmpireStore } from "../../store/empireStore";
import { Card, GlowButton, SectionTitle } from "../../components/ui";
import { callAssistant, ProxyNotConfiguredError, type AnthropicMessage, type ContentBlock } from "../../lib/aiClient";
import { executeTool, TOOL_DEFINITIONS } from "../../lib/aiTools";
import { buildSystemPrompt } from "../../lib/systemPrompt";
import clsx from "clsx";

const MAX_TOOL_TURNS = 6;

export function ChatScreen() {
  const chatMessages = useEmpireStore((s) => s.chatMessages);
  const addChatMessage = useEmpireStore((s) => s.addChatMessage);
  const clearChat = useEmpireStore((s) => s.clearChat);
  const store = useEmpireStore;

  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, pending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    setNotice(null);
    addChatMessage("user", text);
    setPending(true);

    try {
      const history = store.getState().chatMessages;
      const status = store.getState().getEmpireStatus();
      const system = buildSystemPrompt(status);

      let anthropicMessages: AnthropicMessage[] = history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      let finalText: string | null = null;

      for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
        const response = await callAssistant({ system, messages: anthropicMessages, tools: TOOL_DEFINITIONS });
        const toolUses = response.content.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");
        const textBlocks = response.content.filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text");

        if (toolUses.length === 0) {
          finalText = textBlocks.map((b) => b.text).join("\n").trim();
          break;
        }

        const toolResults: ContentBlock[] = toolUses.map((call) => {
          const result = executeTool(call.name, call.input, store.getState());
          return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) };
        });

        anthropicMessages = [
          ...anthropicMessages,
          { role: "assistant", content: response.content },
          { role: "user", content: toolResults },
        ];
      }

      addChatMessage("assistant", finalText || "Erledigt.");
    } catch (err) {
      if (err instanceof ProxyNotConfiguredError) {
        setNotice(
          "JARVIS ist noch nicht verbunden: setze VITE_CHAT_PROXY_URL in deiner .env auf eine Proxy-Funktion, die die Anthropic API aufruft (siehe supabase/functions/chat und README)."
        );
      } else {
        setNotice(err instanceof Error ? err.message : "Unbekannter Fehler beim Kontaktieren von JARVIS.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
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

      <Card className="flex min-h-0 flex-1 flex-col p-0">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {chatMessages.length === 0 && (
            <div className="pt-8 text-center font-mono text-xs text-white/40">
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
          {pending && <div className="font-mono text-xs text-white/40">JARVIS denkt nach…</div>}
          {notice && (
            <div className="rounded-xl border border-ge-gold/40 bg-ge-gold/10 px-3.5 py-2.5 font-mono text-xs text-ge-gold">
              {notice}
            </div>
          )}
        </div>

        <form
          className="flex gap-2 border-t border-white/10 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Schreib JARVIS eine Nachricht…"
            disabled={pending}
            className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red disabled:opacity-50"
          />
          <GlowButton type="submit" disabled={pending || !input.trim()}>
            Senden
          </GlowButton>
        </form>
      </Card>
    </div>
  );
}
