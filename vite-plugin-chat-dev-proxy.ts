import { loadEnv, type Plugin } from "vite";

const MODEL = "claude-sonnet-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

/**
 * Dev-only proxy for the JARVIS chat, mounted at /api/chat.
 *
 * This exists so the voice assistant can be tested with `npm run dev` before
 * the Supabase Edge Function is deployed. It runs in the Vite dev server
 * (Node), so ANTHROPIC_API_KEY is read server-side and never reaches the
 * browser bundle.
 *
 * `apply: "serve"` keeps it out of production builds entirely — deployed
 * builds must point VITE_CHAT_PROXY_URL at the Supabase function instead.
 */
export function chatDevProxy(): Plugin {
  return {
    name: "grind-empire-chat-dev-proxy",
    apply: "serve",
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), "");
      const apiKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

      server.middlewares.use("/api/chat", (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };

        if (req.method !== "POST") {
          send(405, { error: "Method not allowed" });
          return;
        }

        if (!apiKey) {
          send(500, {
            error:
              "ANTHROPIC_API_KEY fehlt. Lege eine .env im Projektordner an (siehe .env.example) und starte den Dev-Server neu.",
          });
          return;
        }

        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const { system, messages, tools } = JSON.parse(Buffer.concat(chunks).toString("utf8"));

            const upstream = await fetch(ANTHROPIC_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({ model: MODEL, max_tokens: 1024, system, messages, tools }),
            });

            if (!upstream.ok) {
              send(upstream.status, { error: await upstream.text() });
              return;
            }

            const data = (await upstream.json()) as { content: unknown; stop_reason: unknown };
            send(200, { content: data.content, stop_reason: data.stop_reason });
          } catch (err) {
            send(500, { error: err instanceof Error ? err.message : "Proxy-Fehler" });
          }
        });
      });
    },
  };
}
