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

// Trial only. Keep production in preview mode until authentication, persistent
// request limits, and billing safeguards are implemented. A token alone never enables paid calls.
// This best-effort in-memory cap resets on server restart and is NOT a billing cap.
let trialCalls = 0;
const TRIAL_CALL_LIMIT = 3;
function isTrialEnabled(): boolean {
  return process.env.NODE_ENV !== "production" &&
    process.env.DAI_ENABLE_HF_API === "true" &&
    Boolean(process.env.HF_TOKEN?.trim());
}

export async function GET() {
  return NextResponse.json(
    { source: isTrialEnabled() ? "huggingface" : "preview" },
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
  if (!isTrialEnabled()) return NextResponse.json(
    { reply: getDemoReply(recent[recent.length - 1].content), source: "preview" },
    { headers: { "Cache-Control": "no-store" } }
  );

  if (trialCalls >= TRIAL_CALL_LIMIT) return NextResponse.json(
    { error: "시험 모드의 서버 실행당 요청 제한(3회)에 도달했습니다." }, { status: 429 }
  );
  trialCalls += 1;

  try {
    const result = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.HF_TOKEN!.trim(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.HF_MODEL?.trim() || "Qwen/Qwen3-8B:cheapest",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...recent],
        max_tokens: 600
      }),
      signal: AbortSignal.timeout(30000),
      cache: "no-store"
    });
    if (!result.ok) {
      const reason = result.status === 402
        ? "Hugging Face 크레딧이 부족합니다. 유료 결제를 진행하기 전에 잔액을 확인해 주세요."
        : result.status === 429
          ? "Hugging Face 요청 한도에 도달했습니다. 이용 한도를 확인해 주세요."
          : result.status === 401 || result.status === 403
            ? "Hugging Face 토큰과 Inference Providers 권한을 확인해 주세요."
            : result.status === 400 || result.status === 404
              ? "선택한 Hugging Face 모델을 사용할 수 없습니다. HF_MODEL 설정을 확인해 주세요."
              : "Hugging Face AI 서버 응답 오류 (" + result.status + ")";
      return NextResponse.json({ error: reason }, { status: 502 });
    }
    const data = await result.json() as { choices?: { message?: { content?: string } }[] };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return NextResponse.json({ error: "AI 응답이 비어 있습니다." }, { status: 502 });
    return NextResponse.json({ reply, source: "huggingface" },
      { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({
      error: "Hugging Face 연결 시간이 초과되었거나 네트워크 오류가 발생했습니다."
    }, { status: 502 });
  }
}
