import { useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, MessageCircle, Send, Square, Trash2, X } from "lucide-react";
import { agentApi } from "../../../shared/api/agent";
import type { AgentChatTurn, AgentCitation, AgentMode } from "../../../shared/types/agent";

interface DisplayMessage extends AgentChatTurn {
  id: string;
  citations?: AgentCitation[];
  mode?: AgentMode;
  pending?: boolean;
  stopped?: boolean;
}

interface ActiveRequest {
  assistantId: string;
  controller: AbortController;
}

const STORAGE_KEY = "hotel_mis_customer_chat_history";
const WELCOME: DisplayMessage = {
  id: "welcome",
  role: "assistant",
  content: "Xin chào, mình có thể giải thích chính sách khách sạn hoặc tra cứu phòng, dịch vụ và booking của bạn.",
};

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isCitation(value: unknown): value is AgentCitation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.source === "string" && candidate.source.trim().length > 0
    && typeof candidate.title === "string" && candidate.title.trim().length > 0
    && Number.isInteger(candidate.start_line) && Number.isInteger(candidate.end_line)
    && Number(candidate.start_line) > 0 && Number(candidate.end_line) >= Number(candidate.start_line)
  );
}

function restoreMessages(): DisplayMessage[] {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(stored)) return [WELCOME];
    const messages = stored.flatMap((value): DisplayMessage[] => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
      const candidate = value as Record<string, unknown>;
      if ((candidate.role !== "user" && candidate.role !== "assistant") || typeof candidate.content !== "string") return [];
      const citations = Array.isArray(candidate.citations) && candidate.citations.every(isCitation)
        ? candidate.citations as AgentCitation[]
        : undefined;
      return [{
        id: typeof candidate.id === "string" ? candidate.id : createId(),
        role: candidate.role,
        content: candidate.content,
        citations,
        mode: typeof candidate.mode === "string" ? candidate.mode as AgentMode : undefined,
        stopped: candidate.stopped === true,
      }];
    }).slice(-30);
    return messages.length ? messages : [WELCOME];
  } catch {
    return [WELCOME];
  }
}

function persistedMessages(messages: DisplayMessage[]) {
  return messages
    .filter(message => !message.pending)
    .slice(-30)
    .map(message => ({
      id: message.id,
      role: message.role,
      content: message.content,
      ...(message.citations ? { citations: message.citations } : {}),
      ...(message.mode ? { mode: message.mode } : {}),
      ...(message.stopped ? { stopped: true } : {}),
    }));
}

function persistMessages(messages: DisplayMessage[]) {
  const stored = persistedMessages(messages);
  try {
    if (stored.length === 1 && stored[0].id === WELCOME.id) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Chat history is optional; a full or unavailable session store must not break chat.
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Không thể kết nối trợ lý. Vui lòng thử lại.";
}

export function CustomerChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>(restoreMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeRef = useRef<ActiveRequest | null>(null);

  useEffect(() => {
    persistMessages(messages);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => () => {
    activeRef.current?.controller.abort();
  }, []);

  const clearHistory = () => {
    activeRef.current?.controller.abort();
    activeRef.current = null;
    setMessages([WELCOME]);
    setDraft("");
    setError(null);
    setSending(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Chat history is optional; an unavailable session store must not break clearing.
    }
  };

  const stop = () => {
    const active = activeRef.current;
    if (!active) return;
    active.controller.abort();
    activeRef.current = null;
    setMessages(previous => previous.flatMap(message => {
      if (message.id !== active.assistantId) return [message];
      return message.content
        ? [{ ...message, pending: false, stopped: true }]
        : [];
    }));
    setSending(false);
    setError(null);
  };

  const startStream = async (content: string, baseMessages: DisplayMessage[]) => {
    const userMessage: DisplayMessage = { id: createId(), role: "user", content };
    const assistantId = createId();
    const priorHistory: AgentChatTurn[] = baseMessages
      .filter(message => message.id !== WELCOME.id)
      .map(({ role, content: text }) => ({ role, content: text }));
    const controller = new AbortController();
    const active: ActiveRequest = { assistantId, controller };

    activeRef.current = active;
    setDraft("");
    setError(null);
    setSending(true);
    setMessages([...baseMessages, userMessage, { id: assistantId, role: "assistant", content: "", pending: true }]);

    const isCurrent = () => activeRef.current === active && !controller.signal.aborted;
    try {
      await agentApi.streamChat(content, priorHistory, {
        onMetadata: metadata => {
          if (!isCurrent()) return;
          setMessages(previous => previous.map(message => message.id === assistantId
            ? { ...message, mode: metadata.mode, citations: metadata.citations }
            : message));
        },
        onToken: token => {
          if (!isCurrent()) return;
          setMessages(previous => previous.map(message => message.id === assistantId
            ? { ...message, content: message.content + token }
            : message));
        },
      }, controller.signal);
      if (!isCurrent()) return;
      setMessages(previous => previous.map(message => message.id === assistantId
        ? { ...message, pending: false }
        : message));
    } catch (requestError) {
      if (controller.signal.aborted || activeRef.current !== active) return;
      setMessages(previous => previous.filter(message => message.id !== assistantId));
      setError(errorText(requestError));
    } finally {
      if (activeRef.current === active) {
        activeRef.current = null;
        setSending(false);
      }
    }
  };

  const send = () => {
    const content = draft.trim();
    if (!content || sending || activeRef.current) return;
    void startStream(content, messages);
  };

  const retryLast = () => {
    if (sending || activeRef.current) return;
    let lastUserIndex = -1;
    messages.forEach((message, index) => {
      if (message.role === "user") lastUserIndex = index;
    });
    if (lastUserIndex < 0) return;
    const content = messages[lastUserIndex].content.trim();
    if (!content) return;
    void startStream(content, messages.slice(0, lastUserIndex));
  };

  return (
    <div className="fixed bottom-4 right-4 z-[70] sm:bottom-6 sm:right-6">
      {open && (
        <section
          aria-label="Trợ lý MaM Hotel"
          className="mb-3 flex h-[min(680px,calc(100dvh-7rem))] w-[min(390px,calc(100vw-2rem))] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#D8D0C2] bg-[#FAF8F5] shadow-[0_24px_70px_rgba(13,17,23,0.24)]"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#101722] px-4 py-3.5 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D4AF6E]/40 bg-[#D4AF6E]/10 text-[#D4AF6E]">
                <Bot size={19} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg leading-tight">Trợ lý MaM Hotel</h2>
                <p className="text-[11px] text-white/55">Chính sách và thông tin lưu trú</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={clearHistory} aria-label="Xóa lịch sử chat" className="rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white">
                <Trash2 size={16} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng trợ lý" className="rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div ref={scrollRef} aria-live="polite" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {messages.map(message => (
              <article key={message.id} className={message.role === "user" ? "ml-10 min-w-0" : "mr-6 min-w-0"}>
                <div className={message.role === "user"
                  ? "break-words rounded-2xl rounded-br-md bg-[#8C6D37] px-4 py-3 text-sm leading-6 text-white"
                  : "break-words rounded-2xl rounded-bl-md border border-[#E2DDD4] bg-white px-4 py-3 text-sm leading-6 text-[#292524] shadow-sm"}
                >
                  {message.pending && !message.content ? (
                    <span className="flex items-center gap-2 text-[#78716C]"><LoaderCircle className="animate-spin" size={15} aria-hidden="true" /> Đang tìm thông tin…</span>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                  {message.pending && message.content && <span className="mt-1 block text-[11px] text-[#78716C]">Đang trả lời…</span>}
                  {message.stopped && <span className="mt-1 block text-[11px] text-[#78716C]">Đã dừng trả lời.</span>}
                </div>
              </article>
            ))}
          </div>

          <div className="shrink-0 border-t border-[#E2DDD4] bg-white p-3">
            {error && (
              <p role="alert" className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                <span className="min-w-0 flex-1">{error}</span>
                <button type="button" onClick={retryLast} disabled={sending} className="shrink-0 font-semibold underline underline-offset-2 hover:text-red-900 disabled:opacity-50">Thử lại câu hỏi</button>
              </p>
            )}
            {sending && <p role="status" className="mb-2 px-1 text-xs text-[#8C6D37]">Đang tìm thông tin và trả lời…</p>}
            <div className="flex items-end gap-2 rounded-xl border border-[#D8D0C2] bg-[#FAF8F5] p-2 focus-within:border-[#B8944A] focus-within:ring-2 focus-within:ring-[#B8944A]/15">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                rows={1}
                maxLength={4000}
                disabled={sending}
                placeholder="Hỏi về chính sách, phòng hoặc booking…"
                aria-label="Nội dung câu hỏi"
                className="max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[#1C1917] outline-none placeholder:text-[#A8A29E] disabled:opacity-60"
              />
              {sending ? (
                <button type="button" onClick={stop} aria-label="Dừng trả lời" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#8C6D37] text-white hover:bg-[#6F552C]">
                  <Square size={15} fill="currentColor" aria-hidden="true" />
                </button>
              ) : (
                <button type="button" onClick={send} disabled={!draft.trim()} aria-label="Gửi câu hỏi" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1C1917] text-white hover:bg-[#8C6D37] disabled:cursor-not-allowed disabled:bg-[#D6D3D1]">
                  <Send size={17} aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="mt-2 text-center text-[10px] leading-4 text-[#A8A29E]">AI có thể nhầm. Thông tin chưa có nguồn cần được lễ tân xác nhận.</p>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen(previous => !previous)}
        aria-label={open ? "Đóng trợ lý MaM Hotel" : "Mở trợ lý MaM Hotel"}
        aria-expanded={open}
        className="ml-auto flex h-14 items-center gap-2 rounded-full border border-[#D4AF6E]/40 bg-[#101722] px-4 text-white shadow-[0_12px_35px_rgba(13,17,23,0.28)] hover:-translate-y-0.5 hover:bg-[#182131]"
      >
        <MessageCircle size={21} className="text-[#D4AF6E]" aria-hidden="true" />
        <span className="text-xs font-semibold tracking-wide">Hỏi MaM</span>
      </button>
    </div>
  );
}
