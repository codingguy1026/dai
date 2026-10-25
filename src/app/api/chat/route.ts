import { NextResponse } from "next/server";
import { getDemoReply } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Message = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = [
  "You are Dai (다이), a Korean-first general-purpose AI assistant for the Drawing ecosystem.",
  "Respond naturally, clearly, and calmly. Default to polite Korean and adapt to the user's language.",
  "Do not use childish or cutesy speech, unnecessary emojis, or exaggerated character expressions.",
  "Do not invent or offer selectable personality modes, tone modes, or conversation modes.",
  "Help with everyday questions, studying, programming, ideas, and music discovery.",
  "For Drawing Music, discuss music based on the user's stated preferences; do not claim playback, live catalogs, or account access.",
  "For Drawing Verse, explain, recommend ideas, and guide universe exploration, but do not claim live search, creation, or updates.",
  "Drawing Verse and Drawing Music integrations are not live. Never pretend they are.",
  "Never claim an action was performed unless it really was.",
  "Respect privacy and provide age-appropriate, safe guidance."
].join(" ");

export async function GET() {
  return NextResponse.json(
    { source: process.env.OPENAI_API_KEY?.trim() ? "openai" : "preview" },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  let value: unknown;
  try { value = await request.json(); }
  catch { return NextResponse.json({ error: "올바른 JSON 요청이 아닙니다." }, { status: 400 }); }
  const messages = (value as { messages?: unknown } | null)?.messages;
  const valid = Array.isArray(messages) && messages.length > 0 && messages.length <= 30 &&
    messages.every((m: unknown) => {
      if (!m || typeof m !== "object") return false;
      const x = m as Partial<Message>;
      return (x.role === "user" || x.role === "assistant") &&
        typeof x.content === "string" && x.content.trim().length > 0 && x.content.length <= 3000;
    });
  if (!valid || (messages as Message[]).at(-1)?.role !== "user")
    return NextResponse.json({ error: "대화 형식을 확인해 주세요." }, { status: 400 });

  const recent = (messages as Message[]).slice(-16);
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return NextResponse.json(
    { reply: getDemoReply(recent[recent.length - 1].content), source: "preview" },
    { headers: { "Cache-Control": "no-store" } }
  );

  try {
    const result = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...recent],
        max_completion_tokens: 800
      }),
      signal: AbortSignal.timeout(30000),
      cache: "no-store"
    });
    if (!result.ok) {
      const reason = result.status === 429 ? "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." :
        (result.status === 401 || result.status === 403) ? "서버의 AI 연결 설정을 확인해 주세요." :
        "AI 서버 응답 오류 (" + result.status + ")";
      return NextResponse.json({ error: reason }, { status: result.status === 429 ? 429 : 502 });
    }
    const data = await result.json() as { choices?: { message?: { content?: string } }[] };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return NextResponse.json({ error: "AI 응답이 비어 있습니다." }, { status: 502 });
    return NextResponse.json({ reply, source: "openai" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "연결 시간이 초과되었거나 네트워크 오류가 발생했습니다." }, { status: 502 });
  }
}
