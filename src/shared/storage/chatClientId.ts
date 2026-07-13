const CHAT_CLIENT_ID_KEY = "citywise:chat-client-id";

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

export function getOrCreateChatClientId(): string {
  const storage = getStorage();
  if (!storage) {
    return "anonymous-client";
  }

  const existing = storage.getItem(CHAT_CLIENT_ID_KEY);
  if (existing) {
    return existing;
  }

  const created =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  storage.setItem(CHAT_CLIENT_ID_KEY, created);
  return created;
}
