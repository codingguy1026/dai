# Dai v0.3

Drawing 생태계의 AI 어시스턴트 **다이(Dai)**.

## 주요 기능
- Next.js App Router + TypeScript, 반응형 채팅 UI, 다크 모드
- 채팅 자동 저장/삭제, 복사, 대화 JSON 내보내기
- Gemini API 서버 연동 (키를 브라우저에 절대 전달하지 않음)
- HTTP 503 오류 자동 재시도 1회, 선택적 예비 모델, 오류 복구 카드
- 운영 환경 Drawing ID 인증과 데이터베이스 기반 일일 호출 한도
- API 연결 비활성 시 명확한 예시 응답 모드

## 개발용 테스트

Node.js 20.9 이상에서:

```bash
npm install
cp -n .env.example .env.local
npm run dev
```

`.env.local`에서 아래 설정을 적용합니다. **Gemini API 키를 GitHub, 채팅, 브라우저 코드에 넣지 마세요.** 다른 사용자에게 API 키를 전달하지 마세요.

```env
GEMINI_API_KEY=본인의_비공개_Gemini_API_키
GEMINI_MODEL=gemini-2.5-flash
DAI_ENABLE_GEMINI_API=true
# 선택: 503 오류가 2번 반복될 때만 시도하는 예비 모델
GEMINI_FALLBACK_MODEL=
```

개발 환경에서는 서버 프로세스당 AI API 호출을 3회로 제한합니다. **재시도/예비 모델 호출도 각각 1회로 계산**되며 서버 재시작 시 초기화됩니다. 따라서 이 제한은 비용 상한이 아닙니다.

## 공개 배포에서 예시 응답 끄기

서버 측 비밀 환경 변수에 `GEMINI_API_KEY`, `DAI_ENABLE_GEMINI_API=true`, `DAI_ENABLE_GEMINI_PRODUCTION=true`를 지정합니다. **키가 있다고 자동 활성화되지 않으며**, 아래 보안 설정도 필요합니다.

1. Drawing ID 프로젝트의 `NEXT_PUBLIC_SUPABASE_URL` 및 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 사용합니다.
2. Supabase DB migration `dai_gemini_authenticated_daily_quota`로 `public.consume_dai_api_quota()` RPC를 준비합니다.
3. 서버는 로그인 세션을 `supabase.auth.getUser()`로 확인합니다.
4. 모든 실제 Gemini 호출 직전에 해당 RPC가 허용해야 합니다. 로그인/DB 오류 시 요청은 차단됩니다.

운영 한도는 **UTC 하루 계정당 10회, 전체 서비스 40회**입니다. 자동 재시도도 포함됩니다. DB에 원자적으로 기록하므로 서버 재시작이나 여러 서버 인스턴스 사이에서도 공유됩니다. 단, 이 한도가 API 비용 상한을 보장하지 않습니다. 모델마다 청구 조건이 다르므로 Gemini 제공업체 사용량, 무료 할당량, 결제 설정을 확인한 후 활성화해야 합니다. 비용이 발생하는 공개 운영은 보호자와 상의하세요.

이전 Hugging Face 시험 연동은 제거되었습니다. 사용하지 않는 `HF_TOKEN` 등의 설정은 삭제해도 됩니다.

- Gemini API 문서: https://ai.google.dev/api/generate-content
- 모델과 요금: https://ai.google.dev/gemini-api/docs/pricing
- API 키 보안: https://ai.google.dev/gemini-api/docs/api-key
- 호출 한도: https://ai.google.dev/gemini-api/docs/rate-limits

Drawing Music 및 Drawing Verse 연동은 아직 계획 단계입니다. 데이터 검색, 계정 접근이나 음악 재생이 완료된 것처럼 안내하지 않습니다.
