// 自分の勉強部屋：AI（チャット・AI検索・記述問題の採点）の中継
// Supabase の Edge Functions に「ai」という名前で作成し、このファイルの中身を貼り付けます。
// 必要なシークレット：ANTHROPIC_API_KEY（必須）、AI_MODEL（任意）
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MODEL = Deno.env.get("AI_MODEL") || "claude-haiku-4-5-20251001";
const MAX_CHARS = 400_000;

type Turn = { role: "user" | "assistant"; content: string };

function toTurns(input: unknown): Turn[] | null {
  if (typeof input === "string") return [{ role: "user", content: input }];
  if (!Array.isArray(input)) return null;
  const out: Turn[] = [];
  for (const t of input) {
    if (!t || (t.role !== "user" && t.role !== "assistant") || typeof t.content !== "string") return null;
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.content += "\n\n" + t.content; // 同じ話者が続いたらまとめる
    else out.push({ role: t.role, content: t.content });
  }
  if (!out.length || out[0].role !== "user") return null;
  return out;
}

function parseJson(text: string): unknown {
  const s = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* ignore */ } }
  return undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // 名簿にいる人だけ使える
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: role, error: roleErr } = await sb.rpc("my_role");
  if (roleErr || !role) return json({ error: "not_member" }, 403);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "not_configured" }, 503);

  let body: { input?: unknown };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const turns = toTurns(body.input);
  if (!turns) return json({ error: "bad_request" }, 400);
  if (turns.reduce((n, t) => n + t.content.length, 0) > MAX_CHARS) return json({ error: "too_large" }, 413);

  // 最初の発言（書庫の中身を含む長い指示）はキャッシュして料金を抑える
  const messages = turns.map((t, i) => ({
    role: t.role,
    content: [{ type: "text", text: t.content, ...(i === 0 && t.content.length > 8000 ? { cache_control: { type: "ephemeral" } } : {}) }],
  }));

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: "Reply with exactly one JSON object and nothing else: no prose, no code fences. Write Japanese text inside the JSON values.",
      messages,
    }),
  });
  if (r.status === 429 || r.status === 529) return json({ error: "rate_limited" }, 429);
  if (!r.ok) return json({ error: "upstream", status: r.status }, 502);

  const data = await r.json();
  const text = (data?.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  const result = parseJson(text);
  if (result === undefined) return json({ error: "invalid_json" }, 502);
  return json({ result });
});
