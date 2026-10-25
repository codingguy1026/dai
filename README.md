# 🎀 Dai v0.1

독립형 Drawing AI **다이(Dai)** 채팅 웹사이트.

- Next.js App Router + TypeScript
- 모바일 반응형 채팅 UI
- 새 대화 / 대화 기록 자동 저장 / 삭제
- 다크 모드
- 서버 측 OpenAI API 연결
- 키가 없을 때는 명확히 표시되는 체험 모드

## 시작하기

Node.js 20.9+ 필요.

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 http://localhost:3000 을 열어주세요.

### 실제 AI 연결

`.env.local`에 서버 API 키를 설정합니다:

```env
OPENAI_API_KEY=YOUR_KEY
OPENAI_MODEL=gpt-4.1-mini
```

비밀키를 GitHub에 올리지 마세요. API 요청에는 비용이 발생할 수 있습니다. 키 없이 시작하면 **체험 모드**이며 실제 AI 응답이 아닙니다.

Drawing Verse와 Drawing Music 연동은 향후 추가할 예정입니다.

> 공개 운영 전 인증, 요청 제한, 이용약관, 비용 제한 및 개인정보 보호 설계가 필요합니다.
