# Dai v0.2

Drawing 생태계의 독립형 AI 어시스턴트 **다이(Dai)**.

## 주요 기능

- Next.js App Router + TypeScript
- 데스크톱 / 모바일 반응형 채팅 UI
- 새 대화, 대화 기록 자동 저장 및 삭제
- AI 답변 복사, 대화 기록 JSON 내보내기
- 다크 모드
- **Hugging Face Inference Providers 시험 연동**, 서버 측 토큰 보관
- API 연결을 활성화하지 않은 상태에서는 명확히 안내하는 **예시 응답**
- 자연스럽고 담백한 기본 말투 (귀여운 말투 / 별도 대화 모드 없음)

## 로컬 실행

Node.js 20.9 이상이 필요합니다.

```bash
npm install
cp -n .env.example .env.local
npm run dev
```

브라우저에서 http://localhost:3000 을 여세요.

### Hugging Face 시험 연결

**중요: Hugging Face Inference Providers는 무료 계정에 기본 월간 API 크레딧을 제공하지 않습니다.**
무료 계정에서 실제 API를 사용하려면 크레딧 구매 또는 유료 플랜이 필요할 수 있습니다.
외부 제공업체의 정책, 요금, 사용 가능 모델도 달라질 수 있습니다.
비용이 필요한 설정은 보호자와 상의하고, 사용 전에 공식 요금표를 확인하세요.

1. 모델과 제공업체의 최신 사용 가능 여부 및 이용 조건을 확인합니다.
2. Hugging Face 계정에서 **Inference Providers** 권한이 있는 사용자 액세스 토큰을 만듭니다.
3. 개발 환경의 `.env.local`에 다음 값을 설정합니다. **실제로 테스트하기로 결정한 경우에만** `DAI_ENABLE_HF_API=true`로 변경합니다.

```env
HF_TOKEN=여기에_Hugging_Face_토큰
HF_MODEL=Qwen/Qwen3.5-9B:cheapest
DAI_ENABLE_HF_API=true
```

4. 개발 서버를 재시작하고 채팅 화면에서 소량의 요청만 테스트합니다.

**비용 안전장치:** 기본값은 `DAI_ENABLE_HF_API=false`입니다. 토큰만 입력해도 호출하지 않으며, 개발 서버에서만 시험할 수 있습니다. 한 서버 프로세스에서 API 요청을 **최대 3회** 시도하고, 이후에는 오류를 표시합니다. 다만 프로세스가 재시작되면 횟수가 초기화됩니다. **이 제한은 공식 지출 한도가 아니며, 완전한 과금 방지 수단도 아닙니다.**

운영 환경(`NODE_ENV=production`)에서는 자동으로 예시 응답만 사용합니다. 정식 서비스 공개 전에 Drawing ID 인증, 사용자별 서버 측 요청 제한, 지출 상한, 개인정보 보호, 서비스 약관, 제공업체 이용 조건 확인이 필요합니다.

API 호출 엔드포인트는 `https://router.huggingface.co/v1/chat/completions`입니다. 모델의 제공 가능 여부는 시기에 따라 바뀔 수 있습니다. `HF_MODEL`을 현재 지원되는 모델 ID로 바꿀 수 있습니다.

**비밀 토큰을 GitHub, 채팅, 프런트엔드 코드에 절대 붙여넣지 마세요.** `.env.local`은 `.gitignore`에 포함되어 있습니다. 이미 보관된 이전 `OPENAI_API_KEY`는 더 이상 Dai에서 사용하지 않습니다. 필요하지 않다면 환경 설정에서 삭제하고, 사용하지 않는 키는 공급업체에서 폐기하세요.

참고 자료:
- https://huggingface.co/docs/inference-providers/pricing
- https://huggingface.co/docs/inference-providers/tasks/chat-completion
- https://huggingface.co/terms-of-service

## 계획

Drawing Music의 개인화 음악 추천과 Drawing Verse의 유니버스 가이드 연동은 아직 구현 전입니다.
실제 연동 전에는 서비스 데이터, 음악 재생, 유니버스 검색이나 생성 등을 수행했다고 안내하지 않습니다.
