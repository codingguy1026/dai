/** Fixed preview replies used only when no model API key is configured. */
export function getDemoReply(message: string): string {
  const m = message.toLowerCase();
  if (/음악|노래|플레이리스트|music|song/.test(m)) {
    return "음악을 추천하려면 선호하는 장르와 분위기를 알려주세요. 현재 Drawing Music과 직접 연결되어 있지 않아 재생 목록이나 청취 기록을 조회할 수는 없습니다.";
  }
  if (/드버스|유니버스|drawing verse/.test(m)) {
    return "Drawing Verse에서는 관심사에 맞는 유니버스를 탐색하는 AI 가이드를 준비하고 있습니다. 현재는 서비스 데이터가 연결되지 않아 실제 유니버스를 검색하거나 생성할 수 없습니다.";
  }
  if (/코딩|개발|next|typescript|버그|오류/.test(m)) {
    return "개발 문제를 확인하려면 오류 메시지, 관련 코드, 예상한 동작을 알려주세요. 현재는 예시 응답이며 실제 코드 분석을 수행하지 않습니다.";
  }
  if (/공부|영어|수학|역사|시험/.test(m)) {
    return "공부할 과목과 주제를 알려주세요. 개념 설명, 예제, 확인 문제 순서로 진행할 수 있습니다. 현재는 예시 응답입니다.";
  }
  if (/안녕|하이|hello|hi/.test(m)) {
    return "안녕하세요. 다이입니다. 무엇을 도와드릴까요? 현재는 AI API가 연결되지 않아 예시 응답을 제공하고 있습니다.";
  }
  return "현재는 실제 AI가 아닌 예시 응답을 제공하고 있습니다. 자유로운 대화를 사용하려면 서버에 OpenAI API 키를 설정해야 합니다.";
}
