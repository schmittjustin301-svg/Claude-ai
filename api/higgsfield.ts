// Serverless proxy for Higgsfield video generation.
//
// Runs on the Node runtime because the official SDK needs Node APIs (Buffer,
// file uploads). The API key and secret are read from the server environment
// and never reach the browser bundle — same rule as the Anthropic proxy.
//
// Two-phase by necessity: a DoP generation takes far longer than a serverless
// function may run, so `submit` starts the job and returns immediately, and the
// browser polls `status` separately. Blocking with withPolling:true would hit
// the platform's execution limit and lose a paid generation.
//
// Generations cost money, so this endpoint sits behind the same access code as
// the chat proxy.

import { HiggsfieldClient } from "@higgsfield/client";
import { createHiggsfieldClient } from "@higgsfield/client/v2";

export const config = { runtime: "nodejs", maxDuration: 60 };

const DOP_ENDPOINT = "/v1/image2video/dop";

type Json = Record<string, unknown>;

function json(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** KEY_ID:KEY_SECRET, as issued by the Higgsfield Cloud dashboard. */
function readCredentials(): { credentials: string; apiKey: string; apiSecret: string } | null {
  const combined = process.env.HIGGSFIELD_CREDENTIALS;
  if (combined?.includes(":")) {
    const [apiKey, ...rest] = combined.split(":");
    return { credentials: combined, apiKey, apiSecret: rest.join(":") };
  }
  const apiKey = process.env.HIGGSFIELD_API_KEY;
  const apiSecret = process.env.HIGGSFIELD_API_SECRET;
  if (apiKey && apiSecret) {
    return { credentials: `${apiKey}:${apiSecret}`, apiKey, apiSecret };
  }
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedCode = process.env.APP_ACCESS_CODE;
  if (expectedCode && req.headers.get("x-app-code") !== expectedCode) {
    return json({ error: "Falscher oder fehlender Zugangscode.", code_required: true }, 401);
  }

  const creds = readCredentials();
  if (!creds) {
    return json(
      {
        error:
          "Higgsfield ist nicht konfiguriert. Setz HIGGSFIELD_CREDENTIALS (Format KEY_ID:KEY_SECRET) in den Projekt-Einstellungen und deploye neu.",
      },
      500
    );
  }

  let body: { action?: string; [k: string]: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "Ungültiger Request-Body." }, 400);
  }

  try {
    switch (body.action) {
      case "motions":
        return await handleMotions(creds);
      case "submit":
        return await handleSubmit(creds, body);
      case "status":
        return await handleStatus(creds, body);
      default:
        return json({ error: `Unbekannte Aktion: ${String(body.action)}` }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler bei Higgsfield.";
    return json({ error: message }, 502);
  }
}

/** Motion presets come from the account, so they are fetched rather than hardcoded. */
async function handleMotions(creds: { apiKey: string; apiSecret: string }): Promise<Response> {
  const v1 = new HiggsfieldClient({ apiKey: creds.apiKey, apiSecret: creds.apiSecret });
  try {
    const motions = await v1.getMotions();
    return json({
      motions: motions.map((m) => ({ id: m.id, name: m.name, description: m.description, preview_url: m.preview_url })),
    });
  } finally {
    v1.close();
  }
}

async function handleSubmit(
  creds: { credentials: string; apiKey: string; apiSecret: string },
  body: Json
): Promise<Response> {
  const imageBase64 = String(body.imageBase64 ?? "");
  const prompt = String(body.prompt ?? "").trim();
  const model = String(body.model ?? "dop-turbo");
  const format = String(body.format ?? "jpeg") as "jpeg" | "png" | "webp";

  if (!imageBase64) return json({ error: "Kein Bild übergeben." }, 400);
  if (!prompt) return json({ error: "Kein Prompt übergeben." }, 400);
  if (!["dop-lite", "dop-turbo", "dop-standard"].includes(model)) {
    return json({ error: `Unbekanntes Modell: ${model}` }, 400);
  }

  // The API takes a hosted URL, and athlete photos live in the browser's
  // IndexedDB with no public address — so upload first, then reference it.
  const v1 = new HiggsfieldClient({ apiKey: creds.apiKey, apiSecret: creds.apiSecret });
  let hostedUrl: string;
  try {
    hostedUrl = await v1.uploadImage(Buffer.from(imageBase64, "base64"), format);
  } finally {
    v1.close();
  }

  const motions = Array.isArray(body.motions)
    ? (body.motions as Array<{ id?: unknown; strength?: unknown }>)
        .filter((m) => typeof m?.id === "string")
        .map((m) => ({ id: String(m.id), strength: Number(m.strength ?? 0.8) }))
    : undefined;

  const v2 = createHiggsfieldClient({ credentials: creds.credentials });
  const response = await v2.subscribe(DOP_ENDPOINT, {
    input: {
      model,
      prompt,
      input_images: [{ type: "image_url", image_url: hostedUrl }],
      ...(motions?.length ? { motions } : {}),
    },
    // Deliberately not polling here — see the file header.
    withPolling: false,
  });

  return json({
    request_id: response.request_id,
    status: response.status,
    status_url: response.status_url,
    source_image_url: hostedUrl,
  });
}

async function handleStatus(creds: { apiKey: string; apiSecret: string }, body: Json): Promise<Response> {
  const statusUrl = String(body.status_url ?? "");
  if (!statusUrl.startsWith("https://")) {
    return json({ error: "Ungültige status_url." }, 400);
  }
  // Only ever follow a Higgsfield-owned URL — this value round-trips through
  // the browser, so it must not be usable to make the server call anywhere.
  if (new URL(statusUrl).hostname !== "platform.higgsfield.ai") {
    return json({ error: "status_url zeigt nicht auf Higgsfield." }, 400);
  }

  const res = await fetch(statusUrl, {
    headers: { Authorization: `Key ${creds.apiKey}:${creds.apiSecret}` },
  });
  if (!res.ok) {
    return json({ error: `Statusabfrage fehlgeschlagen (${res.status}).` }, res.status);
  }

  const data = (await res.json()) as {
    status?: string;
    video?: { url?: string };
    images?: Array<{ url?: string }>;
  };

  return json({
    status: data.status ?? "unknown",
    video_url: data.video?.url ?? null,
    image_url: data.images?.[0]?.url ?? null,
  });
}
