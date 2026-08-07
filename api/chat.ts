// Serverless chat proxy for the deployed site (Vercel).
//
// Mirrors vite-plugin-chat-dev-proxy.ts, which only runs during `npm run dev`.
// Both answer on /api/chat so the client needs no per-environment branching.
// The Anthropic key is read from the server environment and never reaches the
// browser bundle.
//
// Access code: the deployment is a public URL with a paid API key behind it, so
// without a gate anyone who finds the address could spend the owner's credits.
// When APP_ACCESS_CODE is set, requests must carry it. It is intentionally not
// required when unset, so a fresh deployment works before the variable is
// added — the response then reports back that it is unprotected, and the app
// surfaces a warning.

export const config = { runtime: "edge" };

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(
      {
        error:
          "ANTHROPIC_API_KEY ist nicht gesetzt. Trag ihn in den Projekt-Einstellungen unter Environment Variables ein und deploye neu.",
      },
      500
    );
  }

  const expectedCode = process.env.APP_ACCESS_CODE;
  if (expectedCode) {
    const provided = req.headers.get("x-app-code");
    if (provided !== expectedCode) {
      return json({ error: "Falscher oder fehlender Zugangscode.", code_required: true }, 401);
    }
  }

  let payload: { system?: unknown; messages?: unknown; tools?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Ungültiger Request-Body." }, 400);
  }

  const upstream = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: payload.system,
      messages: payload.messages,
      tools: payload.tools,
    }),
  });

  if (!upstream.ok) {
    return json({ error: await upstream.text() }, upstream.status);
  }

  const data = (await upstream.json()) as { content: unknown; stop_reason: unknown };
  return json({
    content: data.content,
    stop_reason: data.stop_reason,
    // Lets the app warn that the endpoint is reachable without a code.
    unprotected: expectedCode ? undefined : true,
  });
}
