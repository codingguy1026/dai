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

type ModelAttempt = { status: number; reply?: string; networkError?: boolean };

/** One upstream request consumes one of the three trial calls, including retries. */
async function askHuggingFace(model: string, recent: Message[]): Promise<ModelAttempt> {
  if (trialCalls >= TRIAL_CALL_LIMIT) return { status: 429 };
  trialCalls += 1;
  try {
    const result = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.HF_TOKEN!.trim(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...recent],
        max_tokens: 600
      }),
      signal: AbortSignal.timeout(30000),
      cache: "no-store"
    });
    if (!result.ok) return { status: result.status };
    const data = await result.json() as { choices?: { message?: { content?: string } }[] };
    const reply = data.choices?.[0]?.message?.content?.trim();
    return reply ? { status: 200, reply } : { status: 502 };
  } catch {
    return { status: 502, networkError: true };
  }
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

  const primary = process.env.HF_MODEL?.trim() || "Qwen/Qwen3-8B:cheapest";
  const fallback = process.env.HF_FALLBACK_MODEL?.trim();
  let usedFallback = false;
  let attempt = await askHuggingFace(primary, recent);

  // A transient 503 gets one quiet retry; neither a quota error nor a bad token does.
  // Every attempt, including the optional fallback, counts toward TRIAL_CALL_LIMIT.
  if (attempt.status === 503 && trialCalls < TRIAL_CALL_LIMIT) {
    await new Promise<void>(resolve => setTimeout(resolve, 700));
    attempt = await askHuggingFace(primary, recent);
  }
  if (attempt.status === 503 && fallback && fallback !== primary &&
      trialCalls < TRIAL_CALL_LIMIT) {
    usedFallback = true;
    attempt = await askHuggingFace(fallback, recent);
  }

  if (attempt.reply) return NextResponse.json(
    { reply: attempt.reply, source: "huggingface", fallbackUsed: usedFallback },
    { headers: { "Cache-Control": "no-store" } }
  );

  const reason = attempt.status === 503
    ? "지금 다이에게 요청이 몰려 AI 서버가 바빠요. 잠시 후 다시 시도해 주세요."
    : attempt.status === 402
      ? "Hugging Face 크레딧이 부족합니다. 유료 결제를 진행하기 전에 잔액을 확인해 주세요."
      : attempt.status === 429
        ? "Hugging Face 요청 한도에 도달했습니다. 이용 한도를 확인해 주세요."
        : attempt.status === 401 || attempt.status === 403
          ? "Hugging Face 토큰과 Inference Providers 권한을 확인해 주세요."
          : attempt.status === 400 || attempt.status === 404
            ? "선택한 Hugging Face 모델을 사용할 수 없습니다. HF_MODEL 설정을 확인해 주세요."
            : attempt.networkError
              ? "Hugging Face 연결 시간이 초과되었거나 네트워크 오류가 발생했습니다."
              : "Hugging Face AI 서버 응답 오류 (" + attempt.status + ")";
  return NextResponse.json({
    error: reason, code: attempt.status === 503 ? "high_demand" : "provider_error"
  }, {
    status: attempt.status === 503 ? 503 : attempt.status === 429 ? 429 : 502,
    headers: { "Cache-Control": "no-store" }
  });
}
