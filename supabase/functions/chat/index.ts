// Supabase Edge Function — proxies chat requests from the app to the
// Anthropic Messages API so the API key never reaches the browser bundle.
//
// Deploy:
//   supabase functions deploy chat
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// The app calls this endpoint via VITE_CHAT_PROXY_URL (see src/lib/aiClient.ts).
// Request body: { system: string, messages: AnthropicMessage[], tools: Tool[] }
// Response body: the Anthropic Messages API response (content blocks + stop_reason).

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-sonnet-5";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { system, messages, tools } = await req.json();

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages,
      tools,
    }),
  });

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text();
    return new Response(detail, { status: anthropicRes.status });
  }

  const data = await anthropicRes.json();
  return new Response(JSON.stringify({ content: data.content, stop_reason: data.stop_reason }), {
    headers: { "Content-Type": "application/json" },
  });
});
