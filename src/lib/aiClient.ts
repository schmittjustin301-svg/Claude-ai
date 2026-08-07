// Client for the JARVIS chat assistant. The Anthropic API key must never
// ship in the frontend bundle, so this module only ever talks to a proxy
// endpoint (a Supabase Edge Function, see supabase/functions/chat/index.ts,
// or any small server that forwards to the Anthropic Messages API).

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ProxyResponse {
  content: ContentBlock[];
  stop_reason: string | null;
  /** Set by the deployed proxy when no APP_ACCESS_CODE is configured. */
  unprotected?: boolean;
}

/**
 * Both proxies answer on /api/chat — the Vite middleware during `npm run dev`
 * and the serverless function on the deployed site — so no per-environment
 * branching is needed. VITE_CHAT_PROXY_URL overrides it for a Supabase Edge
 * Function or any other host.
 */
const PROXY_URL: string = import.meta.env.VITE_CHAT_PROXY_URL || "/api/chat";

const ACCESS_CODE_KEY = "grind-empire-access-code";

export function getAccessCode(): string {
  try {
    return localStorage.getItem(ACCESS_CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAccessCode(code: string): void {
  try {
    localStorage.setItem(ACCESS_CODE_KEY, code.trim());
  } catch {
    // Storage unavailable — the code simply will not persist across reloads.
  }
}

export class ProxyNotConfiguredError extends Error {
  constructor() {
    super("Kein Chat-Proxy konfiguriert.");
    this.name = "ProxyNotConfiguredError";
  }
}

/** The deployment requires an access code, and the stored one is missing or wrong. */
export class AccessCodeRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessCodeRequiredError";
  }
}

export async function callAssistant(params: {
  system: string;
  messages: AnthropicMessage[];
  tools: readonly unknown[];
}): Promise<ProxyResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const code = getAccessCode();
  if (code) headers["x-app-code"] = code;

  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  if (res.status === 401) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AccessCodeRequiredError(body.error ?? "Zugangscode erforderlich.");
  }

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
