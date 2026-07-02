import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";

import type { ChatIndexStatus, ChatScopeType } from "../../shared/api/chatContracts";
import { CloseIcon } from "../../shared/ui/visicIcons";
import { useScopedChat } from "./useScopedChat";

export type ScopedChatPanelProps = {
  scopeType: ChatScopeType;
  scopeId: string;
  scopeLabel: string;
  headerTitle: string;
  isOpen: boolean;
  onClose: () => void;
};

function formatPdfProgress(index: ChatIndexStatus): string | null {
  if (index.pdfs_completed != null && index.pdfs_total != null && index.pdfs_total > 0) {
    return `${index.pdfs_completed} / ${index.pdfs_total} PDFs`;
  }
  if (index.pdf_count > 0) {
    return `${index.pdf_count} PDF${index.pdf_count === 1 ? "" : "s"}`;
  }
  return null;
}

function preparingTitle(index: ChatIndexStatus | null): string {
  if (index?.is_stale) {
    return "Updating documents…";
  }
  return "Preparing documents for chat…";
}

export function ScopedChatPanel({
  scopeType,
  scopeId,
  scopeLabel,
  headerTitle,
  isOpen,
  onClose,
}: ScopedChatPanelProps) {
  const titleId = useId();
  const inputId = useId();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  const {
    subtitle,
    starters,
    index,
    messages,
    isMetaLoading,
    isSending,
    sendError,
    metaError,
    sendMessage,
    retryMeta,
  } = useScopedChat({
    scopeType,
    scopeId,
    isOpen,
  });

  const isChatReady = Boolean(index?.is_ready);
  const isIndexError = index?.status === "error";
  const pdfProgressLabel = index ? formatPdfProgress(index) : null;
  const progressPercent =
    index?.progress_percent != null && Number.isFinite(index.progress_percent)
      ? Math.max(0, Math.min(100, index.progress_percent))
      : null;

  useEffect(() => {
    if (!isOpen) {
      setDraft("");
    }
  }, [isOpen, scopeId, scopeType]);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isSending, isMetaLoading, index?.message]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = () => {
    if (!draft.trim() || !isChatReady || isSending) {
      return;
    }
    const question = draft;
    setDraft("");
    void sendMessage(question);
  };

  const panel = (
    <div className="project-chat-root" role="presentation">
      <button type="button" className="project-chat-backdrop" aria-label="Close chat" onClick={onClose} />
      <section
        className="project-chat-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="project-chat-header">
          <div className="project-chat-header-text">
            <h2 id={titleId} className="project-chat-title">
              {headerTitle}
            </h2>
            <p className="project-chat-subtitle">{subtitle.trim() || scopeLabel}</p>
          </div>
          <button type="button" className="project-chat-close" aria-label="Close chat" onClick={onClose}>
            <CloseIcon width={16} height={16} />
          </button>
        </header>

        <div className="project-chat-body">
          {metaError ? (
            <div className="project-chat-banner project-chat-banner--error" role="alert">
              <p>{metaError}</p>
              <button type="button" className="project-chat-retry-btn" onClick={retryMeta}>
                Try again
              </button>
            </div>
          ) : null}

          {!metaError && !isChatReady ? (
            <div className="project-chat-preparing" aria-live="polite">
              {isIndexError ? (
                <div className="project-chat-banner project-chat-banner--error" role="alert">
                  <p>{index?.error_message ?? "Indexing failed for this scope."}</p>
                  <button type="button" className="project-chat-retry-btn" onClick={retryMeta}>
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  <p className="project-chat-preparing-title">{preparingTitle(index)}</p>
                  <div
                    className={`project-chat-progress${progressPercent == null ? " project-chat-progress--indeterminate" : ""}`}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressPercent ?? undefined}
                    aria-label="Document indexing progress"
                  >
                    <div
                      className="project-chat-progress-fill"
                      style={progressPercent != null ? { width: `${progressPercent}%` } : undefined}
                    />
                  </div>
                  {pdfProgressLabel ? <p className="project-chat-progress-label">{pdfProgressLabel}</p> : null}
                  <p className="project-chat-preparing-message">
                    {isMetaLoading ? "Loading chat…" : index?.message ?? "Queued for indexing…"}
                  </p>
                </>
              )}
            </div>
          ) : null}

          {isChatReady && starters.length > 0 && messages.length === 0 ? (
            <div className="project-chat-starters" aria-label="Suggested questions">
              <p className="project-chat-starters-label">Suggested questions</p>
              <div className="project-chat-chip-row">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    className="project-chat-chip"
                    disabled={isSending}
                    onClick={() => {
                      void sendMessage(starter, { fromStarter: true, starterTopic: starter });
                    }}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="project-chat-thread" aria-live="polite" aria-relevant="additions">
            {messages.map((message, messageIndex) => (
              <article
                key={`${message.role}-${messageIndex}-${message.content.slice(0, 24)}`}
                className={`project-chat-message project-chat-message--${message.role}`}
              >
                <p className="project-chat-message-role">{message.role === "user" ? "You" : "Assistant"}</p>
                <p className="project-chat-message-content">{message.content}</p>
                {message.role === "assistant" && message.sources && message.sources.length > 0 ? (
                  <div className="project-chat-sources">
                    <span className="project-chat-sources-label">Sources:</span>
                    <ul className="project-chat-source-list">
                      {message.sources.map((source) => (
                        <li key={source}>
                          <a href={source} target="_blank" rel="noopener noreferrer">
                            {source}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {message.role === "assistant" && message.followups && message.followups.length > 0 ? (
                  <div className="project-chat-followups">
                    <span className="project-chat-followups-label">Follow-ups:</span>
                    <div className="project-chat-chip-row">
                      {message.followups.map((followup) => (
                        <button
                          key={followup}
                          type="button"
                          className="project-chat-chip project-chat-chip--followup"
                          disabled={isSending}
                          onClick={() => {
                            void sendMessage(followup);
                          }}
                        >
                          {followup}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
            {isSending ? <p className="project-chat-typing">Getting an answer…</p> : null}
            <div ref={messagesEndRef} />
          </div>

          {sendError ? (
            <p className="project-chat-send-error" role="alert">
              {sendError}
            </p>
          ) : null}
        </div>

        <footer className="project-chat-footer">
          <label className="project-chat-input-label" htmlFor={inputId}>
            Your question
          </label>
          <div className="project-chat-input-row">
            <textarea
              id={inputId}
              className="project-chat-input"
              rows={2}
              placeholder={isChatReady ? "Type your question…" : "Documents are still being prepared…"}
              value={draft}
              disabled={!isChatReady || isSending}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <button
              type="button"
              className="project-chat-send-btn"
              disabled={!isChatReady || isSending || !draft.trim()}
              onClick={handleSubmit}
            >
              Send
            </button>
          </div>
        </footer>
      </section>
    </div>
  );

  return createPortal(panel, document.body);
}

/** @deprecated Use ScopedChatPanel */
export function ProjectChatPanel(props: {
  scopeId: string;
  councilFileLabel: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <ScopedChatPanel
      scopeType="project"
      scopeId={props.scopeId}
      scopeLabel={props.councilFileLabel}
      headerTitle="Ask about this council file"
      isOpen={props.isOpen}
      onClose={props.onClose}
    />
  );
}
