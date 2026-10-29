import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/** Each app gets a distinct, registered public OAuth client ID. Do not store secrets in browser code. */
function settings() {
  const originText = process.env.DRAWING_SSO_ORIGIN;
  const clientId = process.env.DRAWING_SSO_CLIENT_ID;
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!originText || !clientId || !project || !publishableKey) return null;
  try {
    const origin = new URL(originText);
    const supabase = new URL(project);
    if ((origin.protocol !== "https:" && origin.hostname !== "localhost") ||
      origin.pathname !== "/" || origin.search || origin.hash ||
      supabase.protocol !== "https:" || !supabase.hostname.endsWith(".supabase.co")) return null;
    return {
      origin: origin.origin,
      clientId, project: supabase.origin, publishableKey,
      callback: new URL("/api/drawing-id/callback", origin).toString(),
    };
  } catch { return null; }
}
const cookiePolicy = (secure: boolean) => ({
  httpOnly: true, secure, sameSite: "lax" as const, path: "/api/drawing-id", maxAge: 600,
});
function equalStates(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}
function finish(origin: string, success: boolean) {
  const result = NextResponse.redirect(new URL(success ? "/?drawing_id=connected" : "/?drawing_id=failed", origin));
  result.headers.set("Cache-Control", "private, no-store");
  const expired = { httpOnly: true, sameSite: "lax" as const, path: "/api/drawing-id", maxAge: 0, secure: origin.startsWith("https:") };
  result.cookies.set("drawing_sso_state", "", expired);
  result.cookies.set("drawing_sso_verifier", "", expired);
  return result;
}
export async function startDrawingSSO() {
  const conf = settings();
  if (!conf || process.env.NEXT_PUBLIC_DRAWING_SSO_ENABLED !== "true") {
    return NextResponse.json({ error: "Drawing ID SSO is not configured" }, { status: 503 });
  }
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const endpoint = new URL("/auth/v1/oauth/authorize", conf.project);
  endpoint.search = new URLSearchParams({
    response_type: "code", client_id: conf.clientId, redirect_uri: conf.callback,
    state, code_challenge: challenge, code_challenge_method: "S256", scope: "email profile",
  }).toString();
  const response = NextResponse.redirect(endpoint.toString());
  const policy = cookiePolicy(conf.origin.startsWith("https:"));
  response.cookies.set("drawing_sso_state", state, policy);
  response.cookies.set("drawing_sso_verifier", verifier, policy);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export async function finishDrawingSSO(request: NextRequest) {
  const conf = settings();
  if (!conf || process.env.NEXT_PUBLIC_DRAWING_SSO_ENABLED !== "true") {
    return NextResponse.json({ error: "Drawing ID SSO is not configured" }, { status: 503 });
  }
  const params = request.nextUrl.searchParams;
  const expected = request.cookies.get("drawing_sso_state")?.value || "";
  const verifier = request.cookies.get("drawing_sso_verifier")?.value || "";
  const state = params.get("state") || "";
  const code = params.get("code") || "";
  if (!equalStates(expected, state) || !verifier || params.has("error") || !code) {
    return finish(conf.origin, false);
  }
  try {
    // Keep the verifier and tokens on the server. Never expose them in the redirect URL.
    const tokenResponse = await fetch(new URL("/auth/v1/oauth/token", conf.project), {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code", code, client_id: conf.clientId,
        redirect_uri: conf.callback, code_verifier: verifier,
      }),
    });
    if (!tokenResponse.ok) return finish(conf.origin, false);
    const tokens: unknown = await tokenResponse.json();
    if (typeof tokens !== "object" || !tokens || !("access_token" in tokens) ||
      !("refresh_token" in tokens) || typeof tokens.access_token !== "string" ||
      typeof tokens.refresh_token !== "string") return finish(conf.origin, false);

    const result = finish(conf.origin, true);
    const supabase = createServerClient(conf.project, conf.publishableKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(items) {
          for (const { name, value, options } of items) {
            result.cookies.set(name, value, options);
          }
        },
      },
    });
    const { error } = await supabase.auth.setSession({
      access_token: tokens.access_token, refresh_token: tokens.refresh_token,
    });
    if (error) return finish(conf.origin, false);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return finish(conf.origin, false);
    return result;
  } catch {
    return finish(conf.origin, false);
  }
}
