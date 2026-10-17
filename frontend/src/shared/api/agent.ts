import { apiClient } from "./client";
import type {
  AgentChatTurn,
  AgentCitation,
  AgentMode,
  AgentStreamDone,
  AgentStreamHandlers,
  AgentStreamMetadata,
} from "../types/agent";

const agentBaseUrl = (import.meta.env.VITE_AGENT_API_BASE_URL ?? "").replace(/\/$/, "");
const MALFORMED_STREAM = "Phản hồi trợ lý không hợp lệ. Vui lòng thử lại.";
const NETWORK_ERROR = "Không thể kết nối trợ lý. Vui lòng kiểm tra mạng và thử lại.";
const AGENT_MODES: readonly AgentMode[] = ["rag", "live_data", "clarification", "refusal"];

interface SseEvent {
  event: string;
  data: string;
}

function malformedStream(): Error {
  return new Error(MALFORMED_STREAM);
}

function parseEvent(block: string): SseEvent | null {
  if (!block.trim()) return null;

  let event = "message";
  const data: string[] = [];
  let hasEventField = false;
  let hasDataField = false;

  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.replace(/^\uFEFF/, "");
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      hasEventField = true;
      continue;
    }
    if (line.startsWith("data:")) {
      data.push(line.slice(5).replace(/^ /, ""));
      hasDataField = true;
      continue;
    }
    throw malformedStream();
  }

  if (!hasEventField && !hasDataField) return null;
  if (!hasDataField || !event) throw malformedStream();
  return { event, data: data.join("\n") };
}

function parsePayload(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    throw malformedStream();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCitation(value: unknown): value is AgentCitation {
  if (!isRecord(value)) return false;
  return (
    typeof value.source === "string" && value.source.trim().length > 0
    && typeof value.title === "string" && value.title.trim().length > 0
    && Number.isInteger(value.start_line) && Number.isInteger(value.end_line)
    && Number(value.start_line) > 0 && Number(value.end_line) >= Number(value.start_line)
  );
}

function parseMetadata(value: unknown): AgentStreamMetadata {
  if (!isRecord(value) || !AGENT_MODES.includes(value.mode as AgentMode) || !Array.isArray(value.citations)) {
    throw malformedStream();
  }
  if (!value.citations.every(isCitation)) throw malformedStream();
  return {
    mode: value.mode as AgentMode,
    citations: value.citations as AgentCitation[],
  };
}

function parseDone(value: unknown): AgentStreamDone {
  if (!isRecord(value) || Object.keys(value).length > 0) throw malformedStream();
  return {};
}

function parseError(value: unknown): string {
  if (!isRecord(value) || typeof value.message !== "string" || !value.message.trim()) {
    throw malformedStream();
  }
  return value.message.trim();
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { detail?: unknown; message?: unknown };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail.trim();
    if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
  } catch {
    // The status code is still useful even when the backend did not return JSON.
  }
  return `Trợ lý không phản hồi (HTTP ${response.status}). Vui lòng thử lại.`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export const agentApi = {
  async streamChat(
    message: string,
    history: AgentChatTurn[],
    handlers: AgentStreamHandlers,
    signal?: AbortSignal,
  ): Promise<void> {
    const token = apiClient.store.get()?.access_token;
    let response: Response;
    try {
      response = await fetch(`${agentBaseUrl}/agent-api/chat/stream`, {
        method: "POST",
        signal,
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message,
          // Explicitly project turns so credentials or UI-only fields never enter chat history.
          history: history.slice(-20).map(({ role, content }) => ({ role, content })),
        }),
      });
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) throw error;
      throw new Error(NETWORK_ERROR);
    }

    if (!response.ok) throw new Error(await errorMessage(response));
    if (!response.body) throw new Error("Trợ lý không gửi được dữ liệu trực tuyến. Vui lòng thử lại.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let receivedDone = false;

    const consume = (block: string) => {
      const item = parseEvent(block);
      if (!item) return;
      if (receivedDone) throw malformedStream();

      const payload = parsePayload(item.data);
      if (item.event === "metadata") {
        handlers.onMetadata(parseMetadata(payload));
      } else if (item.event === "token") {
        if (!isRecord(payload) || typeof payload.text !== "string") throw malformedStream();
        handlers.onToken(payload.text);
      } else if (item.event === "done") {
        const done = parseDone(payload);
        receivedDone = true;
        handlers.onDone?.(done);
      } else if (item.event === "error") {
        throw new Error(parseError(payload));
      } else {
        throw malformedStream();
      }
    };

    try {
      while (true) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch (error) {
          if (signal?.aborted || isAbortError(error)) throw error;
          throw new Error(NETWORK_ERROR);
        }
        if (chunk.value) buffer += decoder.decode(chunk.value, { stream: !chunk.done });
        if (chunk.done) buffer += decoder.decode();

        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";
        blocks.forEach(consume);
        if (chunk.done) break;
      }
      if (buffer.trim()) consume(buffer);
      if (!receivedDone) throw malformedStream();
    } finally {
      reader.releaseLock();
    }
  },
};
