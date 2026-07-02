export type ChatScopeType = "project" | "member";

export interface ChatIndexStatus {
  scope_type: string;
  scope_id: string;
  status: string;
  message?: string | null;
  pdf_count: number;
  chunk_count: number;
  last_indexed_at: string | null;
  error_message: string | null;
  is_stale: boolean;
  is_ready: boolean;
  reason: string;
  progress_percent: number | null;
  pdfs_completed: number | null;
  pdfs_total: number | null;
}

export interface ChatScopeMeta {
  scope_type: string;
  scope_id: string;
  subtitle: string;
  context: string;
  starters: string[];
  indexed: boolean;
  chunk_count: number;
  index: ChatIndexStatus;
}

export interface ChatMessageRequest {
  question: string;
  scope_type: ChatScopeType;
  scope_id: string;
  session_id?: string;
  client_id?: string;
  from_starter?: boolean;
  starter_topic?: string | null;
}

export interface ChatMessageResponse {
  answer: string;
  sources: string[];
  followups: string[];
  session_id: string | null;
}

export interface ChatIndexNotReadyDetail {
  code: "index_not_ready";
  message: string;
  index: ChatIndexStatus;
}

export type ChatThreadMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  followups?: string[];
};

export interface ChatSessionSummary {
  session_id: string;
  title: string | null;
  scope_type: string;
  scope_id: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface ChatSessionHistoryMessage {
  role: string;
  content: string;
  sources?: string[];
  followups?: string[];
}

export interface ChatSessionMessagesResponse {
  messages: ChatSessionHistoryMessage[];
}
