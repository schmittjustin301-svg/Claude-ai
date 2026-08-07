// Client for the JARVIS chat assistant. The Anthropic API key must never
// ship in the frontend bundle, so this module only ever talks to a proxy
// endpoint (a Supabase Edge Function, see supabase/functions/chat/index.ts,
// or any small server that forwards to the Anthropic Messages API).

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ProxyResponse {
  content: ContentBlock[];
  stop_reason: string | null;
}

// In dev, fall back to the local Vite middleware proxy (see
// vite-plugin-chat-dev-proxy.ts) so the assistant is testable with just an
// ANTHROPIC_API_KEY in .env. Production builds must point at a deployed
// proxy such as the Supabase Edge Function.
const PROXY_URL: string | undefined =
  import.meta.env.VITE_CHAT_PROXY_URL || (import.meta.env.DEV ? "/api/chat" : undefined);

export class ProxyNotConfiguredError extends Error {
  constructor() {
    super("Kein Chat-Proxy konfiguriert (VITE_CHAT_PROXY_URL).");
    this.name = "ProxyNotConfiguredError";
  }
}

export async function callAssistant(params: {
  system: string;
  messages: AnthropicMessage[];
  tools: readonly unknown[];
}): Promise<ProxyResponse> {
  if (!PROXY_URL) {
    throw new ProxyNotConfiguredError();
  }

  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let detail = raw;
    try {
      // Both proxies report failures as { error: "..." }.
      const parsed = JSON.parse(raw) as { error?: unknown };
      if (typeof parsed.error === "string") detail = parsed.error;
    } catch {
      // Not JSON — keep the raw body.
    }
    throw new Error(detail || `Proxy-Fehler (${res.status}) ${res.statusText}`);
  }

  return (await res.json()) as ProxyResponse;
}
