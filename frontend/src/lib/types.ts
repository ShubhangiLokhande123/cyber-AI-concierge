export interface ChatMessage {
  id: string;
  role: "agent" | "user";
  content: string;
  timestamp: Date;
}

export type AgentStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error"
  | "ended";

export interface ConversationData {
  conversation_id: string;
  conversation_url: string;
  status: string;
}

export interface TavusRoomState {
  status: AgentStatus;
  messages: ChatMessage[];
  conversationId: string | null;
  videoEl: HTMLVideoElement | null;
  audioAnalyser: AnalyserNode | null;
  error: string | null;
}
