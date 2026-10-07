export type AgentMode = "rag" | "live_data" | "clarification" | "refusal";

export interface AgentCitation {
  source: string;
  title: string;
  start_line: number;
  end_line: number;
}

export interface AgentChatResponse {
  answer: string;
  mode: AgentMode;
  citations: AgentCitation[];
}

export type AgentStreamMetadata = Omit<AgentChatResponse, "answer">;

export type AgentStreamDone = Record<string, never>;

export interface AgentChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AgentStreamHandlers {
  onMetadata: (metadata: AgentStreamMetadata) => void;
  onToken: (text: string) => void;
  onDone?: (done: AgentStreamDone) => void;
}
