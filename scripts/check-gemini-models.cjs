#!/usr/bin/env node
"use strict";

// Check the model list using the SAME .env.local configuration as next dev.
// This script prints only model names and sanitized status codes, NEVER the API key.
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd(), true);

const key = process.env.GEMINI_API_KEY?.trim();
const configuredModel = (process.env.GEMINI_MODEL || "gemini-3.5-flash-lite")
  .trim().replace(/^models\//, "");

async function main() {
  console.log("현재 GEMINI_MODEL:", configuredModel);
  console.log("Gemini 활성화 설정:", process.env.DAI_ENABLE_GEMINI_API === "true" ? "켜짐" : "꺼짐");
  if (!key) {
    console.error("GEMINI_API_KEY가 .env.local에 없습니다. 키를 화면이나 채팅에 공유하지 마세요.");
    process.exitCode = 1;
    return;
  }

  let pageToken = "";
  const models = [];
  for (let page = 0; page < 10; page++) {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(15000),
      cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Avoid printing raw upstream errors: some can contain private request data.
      const status = typeof body.error?.status === "string" ? body.error.status : "UNKNOWN";
      console.error("Gemini models.list 오류: HTTP", response.status,
        /^[A-Z_]{3,40}$/.test(status) ? status : "UNKNOWN");
      process.exitCode = 1;
      return;
    }
    models.push(...(Array.isArray(body.models) ? body.models : []));
    pageToken = typeof body.nextPageToken === "string" ? body.nextPageToken : "";
    if (!pageToken) break;
  }

  const list = models.filter(m =>
    typeof m.name === "string" &&
    m.name.startsWith("models/gemini-") &&
    Array.isArray(m.supportedGenerationMethods) &&
    m.supportedGenerationMethods.includes("generateContent")
  ).map(m => m.name.replace(/^models\//, "")).sort();

  console.log("\n현재 키로 목록에 표시되는 generateContent 모델:");
  if (!list.length) console.log("(없음)");
  else list.forEach(m => console.log(" -", m));

  console.log("\n설정 모델 목록 검사:", list.includes(configuredModel) ? "✅ 표시됨" : "❌ 표시되지 않음");
  if (!list.includes(configuredModel)) {
    console.log("위 목록의 사용 가능한 텍스트 모델을 GEMINI_MODEL에 넣고 서버를 재시작하세요.");
  } else {
    console.log("모델이 목록에 있어도 실제 요청의 권한이나 형식에 따라 실패할 수 있습니다.");
    console.log("이 경우 터미널에 출력된 'Gemini upstream failure'의 HTTP 코드만 확인하세요.");
  }
}

main().catch(error => {
  console.error("모델 목록 검사 중 네트워크 오류:", error?.name || "Error");
  process.exitCode = 1;
});
