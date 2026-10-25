"use client";

import { useEffect, useRef, useState } from "react";

type Message = { id: string; role: "user" | "assistant"; text: string; at: number };
type Chat = { id: string; title: string; updated: number; messages: Message[] };
type Connection = "online" | "preview" | "offline";
const KEY = "dai.chat.v1";
const ACTIVE = "dai.active.v1";
const THEME = "dai.theme.v1";
const suggestions = [
  { emoji: "🎧", title: "음악 추천", detail: "취향에 맞는 음악 탐색", prompt: "집중할 때 듣기 좋은 음악 5곡을 추천하고 이유도 알려줘." },
  { emoji: "🪐", title: "유니버스 가이드", detail: "Drawing Verse 탐색", prompt: "Drawing Verse에서 관심사에 맞는 유니버스를 찾는 방법을 알려줘." },
  { emoji: "📚", title: "학습 도우미", detail: "개념과 예제 정리", prompt: "영어 공부를 위한 간단한 학습 계획을 세워줘." },
  { emoji: "💻", title: "개발 도우미", detail: "코드와 문제 해결", prompt: "Next.js와 TypeScript로 만들 작은 프로젝트 아이디어를 제안해줘." }
];
const makeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);

function DaiFace({ small = false }: { small?: boolean }) {
  return (
    <div className={small ? "dai-face mini" : "dai-face"} aria-label="다이 캐릭터" role="img">
      <span className="bow">🎀</span>
      <span className="face-eyes"><i/><i/></span>
      <span className="face-mouth"/>
      <span className="cheek left"/><span className="cheek right"/>
    </div>
  );
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [connection, setConnection] = useState<Connection>("offline");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sidebar, setSidebar] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const active = chats.find(c => c.id === activeId);

  useEffect(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (Array.isArray(value)) {
        const safe = value.filter((c): c is Chat => c && typeof c.id === "string" &&
          typeof c.title === "string" && Array.isArray(c.messages) &&
          c.messages.every((m: Message) => m && typeof m.text === "string" &&
            (m.role === "user" || m.role === "assistant"))).slice(0, 40);
        setChats(safe);
        const savedId = localStorage.getItem(ACTIVE);
        setActiveId(safe.some(c => c.id === savedId) ? savedId : null);
      }
      setTheme(localStorage.getItem(THEME) === "dark" ? "dark" : "light");
    } catch { /* Corrupted local storage: start fresh */ }
    setLoaded(true);
    fetch("/api/chat", { cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error("status check failed"); return r.json(); })
      .then((data: { source?: string }) =>
        setConnection(data.source === "openai" ? "online" : "preview"))
      .catch(() => setConnection("offline"));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(chats.slice(0, 40)));
      if (activeId) localStorage.setItem(ACTIVE, activeId);
      else localStorage.removeItem(ACTIVE);
      localStorage.setItem(THEME, theme);
    } catch { /* Storage may be unavailable */ }
    document.documentElement.setAttribute("data-theme", theme);
  }, [chats, activeId, theme, loaded]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); },
    [activeId, active?.messages.length, busy]);

  function newChat() {
    setActiveId(null); setInput(""); setError(""); setCopiedId(null); setSidebar(false);
    composer.current?.focus();
  }

  function selectChat(id: string) {
    setActiveId(id); setError(""); setCopiedId(null); setSidebar(false);
  }

  function deleteChat(id: string) {
    setChats(old => old.filter(c => c.id !== id));
    if (activeId === id) setActiveId(null);
    setError("");
  }

  function exportChats() {
    const blob = new Blob([JSON.stringify(chats, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "dai-chats.json"; a.click();
    URL.revokeObjectURL(url);
  }

  async function copyMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
    } catch {
      setError("답변을 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.");
    }
  }

  async function send(preset?: string, retry = false) {
    if (busy) return;
    const text = retry ? active?.messages[active.messages.length - 1]?.text?.trim() :
      (preset ?? input).trim();
    if (!text || text.length > 2000) return;
    const chatId = activeId || makeId();
    const now = Date.now();
    const userMessage: Message = { id: makeId(), role: "user", text, at: now };
    const before = active?.messages || [];
    const next = retry ? before : [...before, userMessage];

    if (!retry) {
      setChats(old => {
        const found = old.some(c => c.id === chatId);
        const update = (c: Chat): Chat => c.id === chatId
          ? { ...c, updated: now, messages: next } : c;
        const updated = found ? old.map(update) :
          [{ id: chatId, title: text.slice(0, 30), updated: now, messages: next }, ...old];
        return updated.sort((a,b) => b.updated - a.updated).slice(0, 40);
      });
      setActiveId(chatId); setInput("");
    }
    setError(""); setCopiedId(null); setBusy(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-16).map(m => ({ role: m.role, content: m.text }))
        })
      });
      const data = await response.json() as { reply?: string; error?: string; source?: "openai" | "preview" };
      if (!response.ok || !data.reply) throw new Error(data.error || "답변을 받지 못했습니다.");
      const reply: Message = { id: makeId(), role: "assistant", text: data.reply, at: Date.now() };
      setChats(old => old.map(c => c.id === chatId
        ? { ...c, updated: Date.now(), messages: [...c.messages, reply] } : c));
      if (data.source === "openai" || data.source === "preview")
        setConnection(data.source === "openai" ? "online" : "preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "연결에 문제가 발생했습니다.");
    } finally { setBusy(false); }
  }

  return (
    <div className="app-shell">
      {sidebar && <button className="overlay" onClick={() => setSidebar(false)} aria-label="메뉴 닫기"/>}
      <aside className={sidebar ? "sidebar open" : "sidebar"}>
        <div className="brand"><DaiFace small/><div><b>Dai</b><small>Drawing AI</small></div></div>
        <button className="new-chat" onClick={newChat}><span>＋</span> 새 대화 시작</button>
        <div className="side-caption">대화 기록 <span>{chats.length}</span></div>
        <div className="chat-list">
          {chats.length === 0 && <p className="empty-history">대화 기록이 없습니다.<br/>새 대화를 시작해 보세요.</p>}
          {chats.map(c => (
            <div key={c.id} className={activeId === c.id ? "history active" : "history"}>
              <button onClick={() => selectChat(c.id)} title={c.title}>
                <span>💬</span><span className="history-title">{c.title}</span>
              </button>
              <button className="remove" title="대화 삭제" aria-label={c.title + " 삭제"}
                onClick={() => deleteChat(c.id)}>×</button>
            </div>
          ))}
        </div>
        <div className="side-bottom">
          <div className="coming">🪐 Drawing Verse <span>준비 중</span></div>
          <div className="coming">🎵 Drawing Music <span>준비 중</span></div>
          <button onClick={exportChats} disabled={!chats.length}>↧ 대화 기록 내보내기</button>
          <button onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>
            {theme === "light" ? "☾ 다크 모드" : "☀ 라이트 모드"}
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="top-left">
            <button className="menu" onClick={() => setSidebar(true)} aria-label="메뉴 열기">☰</button>
            <span className="top-name">Dai <span className="version">v0.2</span></span>
          </div>
          <div className={"status " + connection}>
            <span className="status-dot"/>
            {connection === "online" ? "AI 설정됨" : connection === "preview" ? "예시 응답" : "연결 확인 필요"}
          </div>
        </header>

        <div className="main-body">
          {!active?.messages.length ? (
            <section className="welcome">
              <div className="sparkle s1">✦</div><div className="sparkle s2">✧</div>
              <DaiFace/>
              <div className="welcome-tag">DRAWING AI</div>
              <h1>안녕하세요, <em>다이</em>입니다.</h1>
              <p>공부, 개발, 음악 추천부터 일상적인 질문까지<br/>필요한 내용을 편하게 물어보세요.</p>
              <div className="suggestions">
                {suggestions.map(s => <button key={s.title} className="suggest"
                  onClick={() => send(s.prompt)} disabled={busy}>
                  <span className="suggest-emoji">{s.emoji}</span>
                  <b>{s.title}</b><small>{s.detail}</small>
                </button>)}
              </div>
            </section>
          ) : (
            <section className="messages" aria-live="polite">
              {active.messages.map(m => (
                <div className={"message-row " + m.role} key={m.id}>
                  {m.role === "assistant" && <DaiFace small/>}
                  <div className="message-column">
                    <div className="bubble">{m.text}</div>
                    {m.role === "assistant" && <button type="button" className="copy-reply"
                      onClick={() => copyMessage(m)}>
                      {copiedId === m.id ? "복사됨" : "답변 복사"}
                    </button>}
                  </div>
                </div>
              ))}
              {busy && <div className="message-row assistant"><DaiFace small/>
                <div className="bubble thinking"><span/><span/><span/></div></div>}
              {error && <div className="error-box">⚠ {error}
                <button disabled={busy} onClick={() => send(undefined, true)}>다시 시도</button>
              </div>}
              <div ref={end}/>
            </section>
          )}
        </div>

        <div className="composer-wrap">
          {connection === "preview" && <div className="demo-notice">
            현재 AI API가 연결되지 않아 정해진 예시 답변을 보여줍니다.
          </div>}
          <form className="composer" onSubmit={e => { e.preventDefault(); send(); }}>
            <textarea ref={composer} value={input} maxLength={2000}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1} placeholder="다이에게 메시지 보내기" aria-label="메시지 입력"/>
            <button className="send" type="submit" aria-label="메시지 보내기"
              disabled={busy || !input.trim()}>{busy ? "···" : "↑"}</button>
          </form>
          <small className="footer-note">AI 답변에는 오류가 있을 수 있습니다. 중요한 정보는 다시 확인해 주세요.</small>
        </div>
      </main>
    </div>
  );
}
