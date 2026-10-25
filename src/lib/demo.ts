const greetings = [
  "안녕안녕! 나는 다이야! (๑˃ᴗ˂)ﻭ 🎀 오늘은 무슨 이야기를 해볼까?",
  "여기 있어! 다이 출동~ ✨ 아이디어든 고민이든 편하게 말해줘!",
];
export function getDemoReply(message: string): string {
  const m = message.toLowerCase();
  if (/음악|노래|플레이리스트|music|song/.test(m)) {
    return "음악 이야기다! ♫ 오늘 기분을 알려줘. 신나는 분위기라면 밝은 팝이나 게임 OST부터 찾아보는 건 어때? 🎧 참고로 드뮤직 계정과 재생 기능은 아직 연결 전이야!";
  }
  if (/드버스|유니버스|drawing verse/.test(m)) {
    return "우주 이야기 좋아! 🪐 Drawing Verse에서는 관심사별 유니버스를 탐색하고 추천하는 AI 가이드가 되는 게 내 목표야. 실제 드버스 데이터 연동은 아직 준비 중이야!";
  }
  if (/코딩|개발|next|typescript|버그|오류/.test(m)) {
    return "개발 이야기라니 반가워! 💻 오류 메시지와 기대했던 동작을 알려주면 해결 과정을 같이 정리해볼게. 지금은 체험 모드라 구체적 코드 분석은 제한적이야!";
  }
  if (/공부|영어|수학|역사|시험/.test(m)) {
    return "같이 공부하자! 📚 오늘 배울 주제 하나를 골라서 개념 → 예시 → 확인 문제 순서로 연습하면 좋겠어. 어떤 과목이야?";
  }
  if (/안녕|하이|hello|hi/.test(m)) {
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  return "우와, 흥미로운 이야기다! (｡•̀ᴗ-)✧ 🎀 지금은 **체험 모드**라 정해진 예시 응답을 보여주고 있어. 실제 AI 대화를 하려면 서버에 API 키를 연결해줘!";
}
