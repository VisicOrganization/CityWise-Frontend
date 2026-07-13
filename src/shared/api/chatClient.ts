import type {
  ChatIndexNotReadyDetail,
  ChatIndexStatus,
  ChatMessageRequest,
  ChatMessageResponse,
  ChatScopeMeta,
  ChatScopeType,
  ChatSessionMessagesResponse,
  ChatSessionSummary,
  ChatThreadMessage,
} from "./chatContracts";
import { getOrCreateChatClientId } from "../storage/chatClientId";

function getApiBaseUrl(): string {
  const isVitest = typeof process !== "undefined" && Boolean(process.env.VITEST);
  const fromProcess =
    typeof process !== "undefined" ? (process.env.VITE_API_BASE_URL as string | undefined) : undefined;
  const fromImportMeta = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const raw = (isVitest ? fromProcess : fromProcess ?? fromImportMeta) ?? "";
  const trimmed = raw.trim();
  return trimmed || "http://localhost:18100";
}

export class ChatIndexNotReadyError extends Error {
  readonly index: ChatIndexStatus;

  constructor(detail: ChatIndexNotReadyDetail) {
    super(detail.message);
    this.name = "ChatIndexNotReadyError";
    this.index = detail.index;
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function getChatScopeMeta(scopeType: ChatScopeType, scopeId: string): Promise<ChatScopeMeta> {
  const url = new URL(`/chat/scopes/${scopeType}/${encodeURIComponent(scopeId)}/meta`, getApiBaseUrl());
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load chat meta for ${scopeType}/${scopeId}`);
  }
  return parseJsonResponse<ChatScopeMeta>(response);
}

export async function getChatIndexStatus(scopeType: ChatScopeType, scopeId: string): Promise<ChatIndexStatus> {
  const url = new URL(`/chat/index/${scopeType}/${encodeURIComponent(scopeId)}/status`, getApiBaseUrl());
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load chat index status for ${scopeType}/${scopeId}`);
  }
  return parseJsonResponse<ChatIndexStatus>(response);
}

export async function postChatMessage(payload: ChatMessageRequest): Promise<ChatMessageResponse> {
  const url = new URL("/chat", getApiBaseUrl());
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (response.status === 409) {
    const body = await parseJsonResponse<{ detail?: ChatIndexNotReadyDetail | string }>(response);
    const detail = body.detail;
    if (detail && typeof detail === "object" && detail.code === "index_not_ready") {
      throw new ChatIndexNotReadyError(detail);
    }
  }

  if (!response.ok) {
    throw new Error(`Chat request failed (${response.status})`);
  }

  return parseJsonResponse<ChatMessageResponse>(response);
}

export async function listChatSessions(clientId: string): Promise<ChatSessionSummary[]> {
  const url = new URL("/chat/sessions", getApiBaseUrl());
  url.searchParams.set("client_id", clientId);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to load chat sessions");
  }
  const data = await parseJsonResponse<ChatSessionSummary[] | { items?: ChatSessionSummary[] }>(response);
  if (Array.isArray(data)) {
    return data;
  }
  return data.items ?? [];
}

export async function getChatSessionMessages(sessionId: string): Promise<ChatSessionMessagesResponse> {
  const url = new URL(`/chat/sessions/${encodeURIComponent(sessionId)}/messages`, getApiBaseUrl());
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load chat session ${sessionId}`);
  }
  return parseJsonResponse<ChatSessionMessagesResponse>(response);
}

export function mapSessionHistoryToThread(messages: ChatSessionMessagesResponse["messages"]): ChatThreadMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
      sources: message.sources,
      followups: message.followups,
    }));
}

export async function restoreScopedChatHistory(
  scopeType: ChatScopeType,
  scopeId: string,
): Promise<{ sessionId: string; messages: ChatThreadMessage[] } | null> {
  try {
    const sessions = await listChatSessions(getOrCreateChatClientId());
    const match = sessions.find(
      (session) => session.scope_type === scopeType && session.scope_id === scopeId,
    );
    if (!match) {
      return null;
    }
    const history = await getChatSessionMessages(match.session_id);
    return {
      sessionId: match.session_id,
      messages: mapSessionHistoryToThread(history.messages),
    };
  } catch {
    return null;
  }
}
