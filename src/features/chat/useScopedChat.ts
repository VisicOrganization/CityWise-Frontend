import { useCallback, useEffect, useRef, useState } from "react";

import {
  ChatIndexNotReadyError,
  getChatIndexStatus,
  getChatScopeMeta,
  postChatMessage,
  restoreScopedChatHistory,
} from "../../shared/api/chatClient";
import type { ChatIndexStatus, ChatScopeType, ChatThreadMessage } from "../../shared/api/chatContracts";
import { getOrCreateChatClientId } from "../../shared/storage/chatClientId";

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_BACKOFF_MS = 30000;

type ScopeCacheKey = `${ChatScopeType}:${string}`;

type ScopeChatCacheEntry = {
  messages: ChatThreadMessage[];
  sessionId: string | null;
};

const scopeChatCache = new Map<ScopeCacheKey, ScopeChatCacheEntry>();

function scopeCacheKey(scopeType: ChatScopeType, scopeId: string): ScopeCacheKey {
  return `${scopeType}:${scopeId}`;
}

function readScopeCache(scopeType: ChatScopeType, scopeId: string): ScopeChatCacheEntry {
  return scopeChatCache.get(scopeCacheKey(scopeType, scopeId)) ?? { messages: [], sessionId: null };
}

function writeScopeCache(
  scopeType: ChatScopeType,
  scopeId: string,
  patch: Partial<ScopeChatCacheEntry>,
): void {
  const key = scopeCacheKey(scopeType, scopeId);
  const current = readScopeCache(scopeType, scopeId);
  scopeChatCache.set(key, { ...current, ...patch });
}

type UseScopedChatOptions = {
  scopeType: ChatScopeType;
  scopeId: string | null;
  isOpen: boolean;
};

type UseScopedChatState = {
  subtitle: string;
  starters: string[];
  index: ChatIndexStatus | null;
  messages: ChatThreadMessage[];
  isMetaLoading: boolean;
  isSending: boolean;
  sendError: string | null;
  metaError: string | null;
  isPolling: boolean;
  sendMessage: (question: string, options?: { fromStarter?: boolean; starterTopic?: string }) => Promise<void>;
  retryMeta: () => void;
};

function emptyIndex(scopeType: ChatScopeType, scopeId: string): ChatIndexStatus {
  return {
    scope_type: scopeType,
    scope_id: scopeId,
    status: "pending",
    message: "Preparing documents for chat…",
    pdf_count: 0,
    chunk_count: 0,
    last_indexed_at: null,
    error_message: null,
    is_stale: false,
    is_ready: false,
    reason: "missing",
    progress_percent: null,
    pdfs_completed: null,
    pdfs_total: null,
  };
}

function metaLoadErrorMessage(scopeType: ChatScopeType): string {
  return scopeType === "member"
    ? "Could not load chat for this district."
    : "Could not load chat for this council file.";
}

export function useScopedChat({ scopeType, scopeId, isOpen }: UseScopedChatOptions): UseScopedChatState {
  const [subtitle, setSubtitle] = useState("");
  const [starters, setStarters] = useState<string[]>([]);
  const [index, setIndex] = useState<ChatIndexStatus | null>(null);
  const [messages, setMessages] = useState<ChatThreadMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isMetaLoading, setIsMetaLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [metaReloadToken, setMetaReloadToken] = useState(0);

  const sessionIdRef = useRef<string | null>(null);
  const pollBackoffMsRef = useRef(POLL_INTERVAL_MS);
  const pollTimerRef = useRef<number | null>(null);
  const activeScopeRef = useRef<{ scopeType: ChatScopeType; scopeId: string } | null>(null);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const retryMeta = useCallback(() => {
    setMetaError(null);
    setMetaReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    if (!scopeId) {
      activeScopeRef.current = null;
      return;
    }

    const scopeChanged =
      activeScopeRef.current?.scopeType !== scopeType || activeScopeRef.current?.scopeId !== scopeId;

    if (scopeChanged) {
      activeScopeRef.current = { scopeType, scopeId };
      const cached = readScopeCache(scopeType, scopeId);
      setMessages(cached.messages);
      setSessionId(cached.sessionId);
      setSendError(null);
      setMetaError(null);
      setStarters([]);
      setSubtitle("");
      setIndex(emptyIndex(scopeType, scopeId));
    }
  }, [scopeId, scopeType]);

  useEffect(() => {
    if (!isOpen || !scopeId) {
      return;
    }

    let cancelled = false;
    setIsMetaLoading(true);
    setMetaError(null);

    void (async () => {
      const cached = readScopeCache(scopeType, scopeId);
      let restoredMessages = cached.messages;
      let restoredSessionId = cached.sessionId;

      if (restoredMessages.length === 0) {
        const restored = await restoreScopedChatHistory(scopeType, scopeId);
        if (restored && !cancelled) {
          restoredMessages = restored.messages;
          restoredSessionId = restored.sessionId;
          writeScopeCache(scopeType, scopeId, {
            messages: restoredMessages,
            sessionId: restoredSessionId,
          });
          setMessages(restoredMessages);
          setSessionId(restoredSessionId);
        }
      }

      try {
        const meta = await getChatScopeMeta(scopeType, scopeId);
        if (cancelled) {
          return;
        }
        setSubtitle(meta.subtitle);
        setStarters(meta.starters);
        setIndex(meta.index);
      } catch {
        if (!cancelled) {
          setMetaError(metaLoadErrorMessage(scopeType));
        }
      } finally {
        if (!cancelled) {
          setIsMetaLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, scopeId, scopeType, metaReloadToken]);

  useEffect(() => {
    if (!scopeId) {
      return;
    }
    writeScopeCache(scopeType, scopeId, { messages, sessionId });
  }, [messages, scopeId, scopeType, sessionId]);

  useEffect(() => {
    if (!isOpen || !scopeId || index?.is_ready) {
      clearPollTimer();
      setIsPolling(false);
      pollBackoffMsRef.current = POLL_INTERVAL_MS;
      return;
    }

    let cancelled = false;
    let readyHandled = false;

    const schedulePoll = (delayMs: number) => {
      clearPollTimer();
      pollTimerRef.current = window.setTimeout(() => {
        void pollOnce();
      }, delayMs);
    };

    const handleReady = async (readyStatus: ChatIndexStatus) => {
      if (readyHandled || cancelled) {
        return;
      }
      readyHandled = true;
      setIsPolling(false);
      clearPollTimer();
      // Fetch the post-index meta (which carries the suggested-question starters)
      // BEFORE committing the ready index. Committing `is_ready: true` first would
      // flip this effect's `index?.is_ready` dependency and tear it down, flipping
      // `cancelled` to true — which would then discard the starters we just fetched.
      // Fetching first keeps the effect alive until we commit everything atomically.
      try {
        const meta = await getChatScopeMeta(scopeType, scopeId);
        if (!cancelled) {
          setSubtitle(meta.subtitle);
          setStarters(meta.starters);
          setIndex(meta.index);
        }
      } catch {
        // Keep chat enabled even if the meta refresh fails.
        if (!cancelled) {
          setIndex(readyStatus);
        }
      }
    };

    const pollOnce = async () => {
      if (cancelled) {
        return;
      }

      setIsPolling(true);
      try {
        const status = await getChatIndexStatus(scopeType, scopeId);
        if (cancelled) {
          return;
        }

        pollBackoffMsRef.current = POLL_INTERVAL_MS;

        if (status.is_ready) {
          // Let handleReady commit the index alongside the refreshed starters so
          // `is_ready` and `starters` land in the same render (see comment there).
          await handleReady(status);
          return;
        }

        setIndex(status);
        schedulePoll(POLL_INTERVAL_MS);
      } catch {
        if (cancelled) {
          return;
        }
        const nextDelay = Math.min(pollBackoffMsRef.current * 2, MAX_POLL_BACKOFF_MS);
        pollBackoffMsRef.current = nextDelay;
        schedulePoll(nextDelay);
      }
    };

    schedulePoll(POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearPollTimer();
      setIsPolling(false);
    };
  }, [clearPollTimer, index?.is_ready, isOpen, scopeId, scopeType]);

  const sendMessage = useCallback(
    async (question: string, options?: { fromStarter?: boolean; starterTopic?: string }) => {
      const trimmed = question.trim();
      if (!scopeId || !trimmed || isSending) {
        return;
      }

      if (!index?.is_ready) {
        return;
      }

      setSendError(null);
      setIsSending(true);
      setMessages((current) => [...current, { role: "user", content: trimmed }]);

      try {
        const response = await postChatMessage({
          question: trimmed,
          scope_type: scopeType,
          scope_id: scopeId,
          session_id: sessionIdRef.current ?? undefined,
          client_id: getOrCreateChatClientId(),
          from_starter: options?.fromStarter ?? false,
          starter_topic: options?.starterTopic ?? null,
        });

        if (response.session_id) {
          setSessionId(response.session_id);
        }

        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: response.answer,
            sources: response.sources,
            followups: response.followups,
          },
        ]);
      } catch (error) {
        setMessages((current) => current.slice(0, -1));

        if (error instanceof ChatIndexNotReadyError) {
          setIndex(error.index);
          setSendError(null);
          return;
        }

        setSendError("Couldn't get an answer, try again.");
      } finally {
        setIsSending(false);
      }
    },
    [index?.is_ready, isSending, scopeId, scopeType],
  );

  return {
    subtitle,
    starters,
    index,
    messages,
    isMetaLoading,
    isSending,
    sendError,
    metaError,
    isPolling,
    sendMessage,
    retryMeta,
  };
}

/** @deprecated Use useScopedChat */
export const useProjectChat = useScopedChat;
