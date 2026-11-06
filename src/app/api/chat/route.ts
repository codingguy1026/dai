import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDemoReply } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Message = { role: "user" | "assistant"; content: string };
type Attempt = { status: number; reply?: string; networkError?: boolean; providerStatus?: string };
type Reserve = () => Promise<boolean>;
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

// Never activate paid network calls from an API key alone.
const DEV_CAP = 3;
let devCalls = 0;
function enabled(): boolean {
  if (process.env.DAI_ENABLE_GEMINI_API !== "true" || !process.env.GEMINI_API_KEY?.trim()) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.DAI_ENABLE_GEMINI_PRODUCTION === "true" &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
function modelId(value: string | undefined): string | null {
  const id = (value?.trim() || "gemini-3.5-flash-lite").replace(/^models\//, "");
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,99}$/.test(id) ? id : null;
}
function fail(error: string, status: number, code = "provider_error") {
  return NextResponse.json({ error, code }, {
    status, headers: { "Cache-Control": "private, no-store" }
  });
}
async function productionReserve(): Promise<Reserve | NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return fail("Drawing ID 서버 설정이 필요해요.", 503, "configuration");
  try {
    const jar = await cookies();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() { return jar.getAll(); },
        setAll(items) { items.forEach(({ name, value, options }) => jar.set(name, value, options)); }
      }
    });
    // Server-side user verification, never trust cookie content alone.
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user || user.is_anonymous)
      return fail("실제 AI를 이용하려면 Drawing ID에 로그인해 주세요.", 401, "login_required");
    return async () => {
      try {
        const { data, error } = await supabase.rpc("consume_dai_api_quota");
        return !error && data === true;
      } catch { return false; }
    };
  } catch {
    return fail("Drawing ID 인증 서버에 연결하지 못했어요.", 503, "authentication");
  }
}
function localReserve(): Reserve {
  return async () => {
    if (devCalls >= DEV_CAP) return false;
    devCalls += 1;
    return true;
  };
}
function geminiTurns(messages: Message[]) {
  const turns: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : "user";
    const last = turns.at(-1);
    if (last?.role === role) last.parts[0].text += "\n" + m.content;
    else turns.push({ role, parts: [{ text: m.content }] });
  }
  return turns;
}
async function askGemini(model: string, messages: Message[]): Promise<Attempt> {
  try {
    const generationConfig: {
      maxOutputTokens: number; temperature: number; thinkingConfig?: { thinkingBudget: number };
    } = { maxOutputTokens: 900, temperature: 0.7 };
    if (model.startsWith("gemini-2.5-flash")) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(model) + ":generateContent", {
        method: "POST",
        headers: {
          "x-goog-api-key": process.env.GEMINI_API_KEY!.trim(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: geminiTurns(messages),
          generationConfig
        }),
        signal: AbortSignal.timeout(30000),
        cache: "no-store"
      }
    );
    if (!response.ok) {
      // Provider errors can contain request details. Return/log only the safe
      // HTTP code and canonical status; never expose the raw body or API key.
      let providerStatus: string | undefined;
      try {
        const body = await response.json() as { error?: { status?: unknown } };
        const raw = body.error?.status;
        if (typeof raw === "string" && /^[A-Z_]{3,40}$/.test(raw))
          providerStatus = raw;
      } catch { /* An upstream error may not have JSON body. */ }
      console.warn("Gemini upstream failure", { model, httpStatus: response.status, providerStatus });
      return { status: response.status, providerStatus };
    }
    const data = await response.json() as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]
    };
    // Never display internal thought parts.
    const reply = data.candidates?.[0]?.content?.parts
      ?.filter(part => !part.thought).map(part => part.text || "").join("").trim();
    return reply ? { status: 200, reply } : { status: 502 };
  } catch { return { status: 504, networkError: true }; }
}
export async function GET() {
  return NextResponse.json({ source: enabled() ? "gemini" : "preview" },
    { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: Request) {
  let value: unknown;
  try { value = await request.json(); }
  catch { return fail("올바른 JSON 요청이 아닙니다.", 400, "invalid_request"); }
  const messages = (value as { messages?: unknown } | null)?.messages;
  const valid = Array.isArray(messages) && messages.length > 0 && messages.length <= 30 &&
    messages.every((m: unknown) => {
      if (!m || typeof m !== "object") return false;
      const x = m as Partial<Message>;
      return (x.role === "user" || x.role === "assistant") &&
        typeof x.content === "string" && x.content.trim().length > 0 && x.content.length <= 3000;
    });
  if (!valid || (messages as Message[]).at(-1)?.role !== "user")
    return fail("대화 형식을 확인해 주세요.", 400, "invalid_request");
  const recent = (messages as Message[]).slice(-16);
  if (!enabled()) return NextResponse.json(
    { reply: getDemoReply(recent.at(-1)!.content), source: "preview" },
    { headers: { "Cache-Control": "private, no-store" } }
  );

  const primary = modelId(process.env.GEMINI_MODEL);
  const rawFallback = process.env.GEMINI_FALLBACK_MODEL?.trim();
  const fallback = rawFallback ? modelId(rawFallback) : null;
  if (!primary || (rawFallback && !fallback))
    return fail("Gemini 모델 설정이 올바르지 않아요.", 500, "configuration");

  const reserve: Reserve | NextResponse = process.env.NODE_ENV === "production"
    ? await productionReserve() : localReserve();
  if (reserve instanceof NextResponse) return reserve;
  const reserveCall: Reserve = reserve;
  async function attempt(model: string): Promise<Attempt> {
    return await reserveCall() ? askGemini(model, recent) : { status: 429 };
  }
  let result = await attempt(primary!);
  let fallbackUsed = false;
  if (result.status === 503) {
    await new Promise<void>(resolve => setTimeout(resolve, 700));
    result = await attempt(primary!);
  }
  if (result.status === 503 && fallback && fallback !== primary) {
    fallbackUsed = true;
    result = await attempt(fallback);
  }
  if (result.reply) return NextResponse.json(
    { reply: result.reply, source: "gemini", fallbackUsed },
    { headers: { "Cache-Control": "private, no-store" } }
  );
  if (result.status === 429)
    return fail("다이의 사용 가능 횟수 또는 Gemini 요청 한도에 도달했어요. 이용 한도를 확인해 주세요.", 429, "rate_limit");
  if (result.status === 503)
    return fail("으아아악! 지금 사람들이 너무 많이 말을 걸고 있어요! 🤯 잠시 후 다시 이야기해 주세요.", 503, "high_demand");
  if (result.status === 400) {
    const reason = result.providerStatus === "FAILED_PRECONDITION"
      ? "Gemini 프로젝트의 무료 티어 또는 사용 조건을 확인해 주세요."
      : "요청 형식이나 생성 옵션이 해당 모델과 호환되지 않을 수 있어요.";
    return fail("Gemini 요청 오류 (400). " + reason +
      " 서버 로그에 기록된 Gemini 오류 상태를 확인해 주세요.", 502, "gemini_invalid_request");
  }
  if (result.status === 404)
    return fail("Gemini 모델 접근 오류 (404). 현재 프로젝트에서 이용 가능한 모델인지 확인해 주세요. 신규 프로젝트라면 GEMINI_MODEL=gemini-3.5-flash-lite를 권장해요.",
      502, "gemini_model_unavailable");
  if (result.status === 401 || result.status === 403)
    return fail("Gemini API 키 또는 프로젝트 권한을 확인해 주세요.", 502);
  return fail(result.networkError
    ? "Gemini 연결 시간이 초과됐어요. 잠시 후 다시 시도해 주세요."
    : "Gemini가 답변을 생성하지 못했어요. 잠시 후 다시 시도해 주세요.", 502);
}
