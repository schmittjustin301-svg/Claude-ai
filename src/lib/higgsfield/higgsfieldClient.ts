// Browser-side client for the Higgsfield proxy (api/higgsfield.ts).
// Credentials stay on the server; this module only ever talks to our own
// endpoint, exactly like aiClient.ts does for the chat.

import { AccessCodeRequiredError, getAccessCode } from "../aiClient";

const PROXY_URL = "/api/higgsfield";

/** Verified against the SDK's own types, not the marketing docs. */
export const DOP_MODELS = [
  { id: "dop-lite", label: "Lite", hint: "Schnell und günstig — gut für Vorschauen" },
  { id: "dop-turbo", label: "Turbo", hint: "Ausgewogen — der Standard" },
  { id: "dop-standard", label: "Standard", hint: "Beste Qualität, dauert am längsten" },
] as const;

export type DoPModel = (typeof DOP_MODELS)[number]["id"];

export type GenerationStatus = "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "unknown";

export interface MotionPreset {
  id: string;
  name: string;
  description?: string;
  preview_url?: string;
}

export interface SubmitResult {
  request_id: string;
  status: GenerationStatus;
  status_url: string;
  source_image_url: string;
}

export interface StatusResult {
  status: GenerationStatus;
  video_url: string | null;
  image_url: string | null;
}

export class HiggsfieldNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HiggsfieldNotConfiguredError";
  }
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const code = getAccessCode();
  if (code) headers["x-app-code"] = code;

  const res = await fetch(PROXY_URL, { method: "POST", headers, body: JSON.stringify(body) });

  if (res.status === 401) {
    const parsed = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AccessCodeRequiredError(parsed.error ?? "Zugangscode erforderlich.");
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let detail = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: unknown };
      if (typeof parsed.error === "string") detail = parsed.error;
    } catch {
      // Not JSON — keep the raw body.
    }
    if (res.status === 500 && detail.includes("HIGGSFIELD_CREDENTIALS")) {
      throw new HiggsfieldNotConfiguredError(detail);
    }
    throw new Error(detail || `Higgsfield-Fehler (${res.status})`);
  }

  return (await res.json()) as T;
}

export async function fetchMotions(): Promise<MotionPreset[]> {
  const { motions } = await post<{ motions: MotionPreset[] }>({ action: "motions" });
  return motions ?? [];
}

export async function submitGeneration(params: {
  imageBase64: string;
  format: "jpeg" | "png" | "webp";
  prompt: string;
  model: DoPModel;
  motions?: Array<{ id: string; strength: number }>;
}): Promise<SubmitResult> {
  return post<SubmitResult>({ action: "submit", ...params });
}

export async function fetchStatus(statusUrl: string): Promise<StatusResult> {
  return post<StatusResult>({ action: "status", status_url: statusUrl });
}

export const TERMINAL_STATUSES: GenerationStatus[] = ["completed", "failed", "nsfw"];

/**
 * Polls until the job reaches a terminal state. Interval widens over time so a
 * slow generation does not hammer the endpoint, and an abort signal stops it
 * when the user navigates away.
 */
export async function pollUntilDone(
  statusUrl: string,
  onUpdate: (status: GenerationStatus) => void,
  signal?: AbortSignal
): Promise<StatusResult> {
  let delay = 3000;
  const started = Date.now();
  const timeoutMs = 10 * 60 * 1000;

  for (;;) {
    if (signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
    if (Date.now() - started > timeoutMs) {
      throw new Error("Zeitüberschreitung — die Generierung läuft bei Higgsfield ggf. weiter.");
    }

    const result = await fetchStatus(statusUrl);
    onUpdate(result.status);
    if (TERMINAL_STATUSES.includes(result.status)) return result;

    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.4, 15000);
  }
}

/** Strips the data-URL prefix — the proxy expects raw base64. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function formatFromMime(mime: string): "jpeg" | "png" | "webp" {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpeg";
}
