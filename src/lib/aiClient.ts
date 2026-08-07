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

const PROXY_URL: string | undefined = import.meta.env.VITE_CHAT_PROXY_URL;

export class ProxyNotConfiguredError extends Error {
  constructor() {
    super("VITE_CHAT_PROXY_URL ist nicht gesetzt.");
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
    const detail = await res.text().catch(() => "");
    throw new Error(`Proxy-Fehler (${res.status}): ${detail || res.statusText}`);
  }

  return (await res.json()) as ProxyResponse;
}
