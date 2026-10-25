# Dai v0.2

Drawing 생태계의 독립형 AI 어시스턴트 **다이(Dai)**.

## 주요 기능

- Next.js App Router + TypeScript
- 데스크톱 / 모바일 반응형 채팅 UI
- 새 대화, 대화 기록 자동 저장 및 삭제
- AI 답변 복사, 대화 기록 JSON 내보내기
- 다크 모드
- 서버 측 OpenAI API 연동 (클라이언트에 API 키 노출하지 않음)
- API 키가 없을 때 명확히 안내하는 **예시 응답**
- 자연스럽고 담백한 기본 말투 (귀여운 말투 / 별도 대화 모드 없음)

## 로컬 실행

Node.js 20.9 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 http://localhost:3000 을 여세요.

### 실제 AI 연결

`.env.local`에서 서버 환경 변수를 설정합니다.

```env
OPENAI_API_KEY=YOUR_KEY
OPENAI_MODEL=gpt-4.1-mini
```

비밀키를 GitHub에 올리거나 프런트엔드 코드에 넣지 마세요. API 호출에는 비용이 발생할 수 있습니다.

API 키가 없으면 **실제 AI가 아닌 정해진 예시 답변**을 보여줍니다.
이 연결 상태 표시는 대화/말투 선택 모드가 아닙니다.

## 계획

Drawing Music의 개인화 음악 추천과 Drawing Verse의 유니버스 가이드 연동은 아직 구현 전입니다.
실제 연동 전에는 서비스 데이터, 음악 재생, 유니버스 검색이나 생성 등을 수행했다고 안내하지 않습니다.

> 공개 운영 전에는 인증, 사용자별 요청 제한, 비용 상한, 개인정보 보호, 서비스 약관이 필요합니다.
