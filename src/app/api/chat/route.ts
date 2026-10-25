import { NextResponse } from "next/server";
import { getDemoReply } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Message = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = [
  "You are Dai (다이), a kind, playful, Korean-first AI assistant.",
  "Use a cute yet natural tone, with occasional tasteful emojis.",
  "Help with everyday questions, studying, ideas and programming.",
  "Drawing Verse and Drawing Music integrations are not live. Never pretend they are.",
  "Never claim an action was performed unless it really was.",
  "Respect privacy and provide age-appropriate, safe guidance."
].join(" ");

export async function GET() {
  return NextResponse.json(
    { mode: process.env.OPENAI_API_KEY?.trim() ? "ai" : "demo" },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  let value: unknown;
  try { value = await request.json(); }
  catch { return NextResponse.json({ error: "올바른 JSON 요청이 아니야." }, { status: 400 }); }
  const messages = (value as { messages?: unknown } | null)?.messages;
  const valid = Array.isArray(messages) && messages.length > 0 && messages.length <= 30 &&
    messages.every((m: unknown) => {
      if (!m || typeof m !== "object") return false;
      const x = m as Partial<Message>;
      return (x.role === "user" || x.role === "assistant") &&
        typeof x.content === "string" && x.content.trim().length > 0 && x.content.length <= 3000;
    });
  if (!valid || (messages as Message[]).at(-1)?.role !== "user")
    return NextResponse.json({ error: "대화 형식을 확인해줘." }, { status: 400 });

  const recent = (messages as Message[]).slice(-16);
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return NextResponse.json(
    { reply: getDemoReply(recent[recent.length - 1].content), mode: "demo" },
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
      const reason = result.status === 429 ? "요청이 너무 많아. 잠시 후 다시 해줘!" :
        (result.status === 401 || result.status === 403) ? "서버의 AI 연결 설정을 확인해줘." :
        "AI 서버 응답 오류 (" + result.status + ")";
      return NextResponse.json({ error: reason }, { status: result.status === 429 ? 429 : 502 });
    }
    const data = await result.json() as { choices?: { message?: { content?: string } }[] };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return NextResponse.json({ error: "AI 답변이 비어 있어." }, { status: 502 });
    return NextResponse.json({ reply, mode: "ai" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "연결 시간이 초과되었거나 네트워크 오류가 발생했어." }, { status: 502 });
  }
}
