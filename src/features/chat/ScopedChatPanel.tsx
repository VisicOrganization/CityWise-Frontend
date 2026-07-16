import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import type { ChatIndexStatus, ChatScopeType } from "../../shared/api/chatContracts";
import { CloseIcon } from "../../shared/ui/visicIcons";
import { useMobileProjectSidebarLayout } from "../map/useMobileProjectSidebarLayout";
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

function preparingStatusLine(
  index: ChatIndexStatus | null,
  isMetaLoading: boolean,
  pdfProgressLabel: string | null,
): string {
  if (isMetaLoading) {
    return "Loading chat…";
  }
  const message = index?.message?.trim();
  if (message && pdfProgressLabel && !message.includes(pdfProgressLabel)) {
    return `${message} (${pdfProgressLabel})`;
  }
  return message || pdfProgressLabel || "Queued for indexing…";
}

function formatLastIndexed(lastIndexedAt: string | null): string | null {
  if (!lastIndexedAt) {
    return null;
  }
  const date = new Date(lastIndexedAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatSourceLabel(source: string): string {
  try {
    const url = new URL(source);
    const lastSegment = url.pathname.split("/").filter(Boolean).pop();
    return lastSegment ? `${url.hostname} · ${lastSegment}` : url.hostname;
  } catch {
    return source;
  }
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH_VW = 0.9;
const CLOSE_ANIMATION_MS = 200;

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
  const panelRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const lastQuestionRef = useRef<string | null>(null);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  // In modal (mobile) mode, size the panel to the visual viewport so the on-screen
  // keyboard doesn't cover the input + Send. null = use the CSS default (full height).
  const [mobileViewportHeight, setMobileViewportHeight] = useState<number | null>(null);

  // Desktop docks the panel (pushes page content left, non-modal); mobile keeps the
  // full-width modal overlay. Breakpoint matches the shared map/sidebar media query.
  const isMobile = useMobileProjectSidebarLayout();
  const isDocked = !isMobile;

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
  const lastIndexedLabel = index ? formatLastIndexed(index.last_indexed_at) : null;
  const progressPercent =
    index?.progress_percent != null && Number.isFinite(index.progress_percent)
      ? Math.max(0, Math.min(100, index.progress_percent))
      : null;

  useEffect(() => {
    if (!isOpen) {
      setDraft("");
    }
  }, [isOpen, scopeId, scopeType]);

  // Track the visual viewport (which shrinks when the mobile keyboard opens) so the modal
  // panel stays fully on-screen. Docked (desktop) mode is unaffected.
  useEffect(() => {
    if (!isOpen || isDocked) {
      setMobileViewportHeight(null);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) {
      return;
    }
    const update = () => setMobileViewportHeight(vv.height);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [isOpen, isDocked]);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isSending, isMetaLoading, index?.message]);

  useEffect(() => {
    // Only the modal (mobile) variant moves focus into the panel and restores it on
    // close. Docked mode is non-modal — the user keeps working the page, so grabbing
    // and yanking focus would be disruptive.
    if (!isOpen || isDocked) {
      return;
    }
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(focusTimer);
      previouslyFocusedRef.current?.focus?.();
      previouslyFocusedRef.current = null;
    };
  }, [isOpen, isDocked]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }
    if (!shouldRender) {
      return;
    }
    setIsClosing(true);
    const closeTimer = window.setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
    }, CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(closeTimer);
  }, [isOpen, shouldRender]);

  // Publish the docked panel width to the document root so `.map-demo-screen` can inset
  // its content by the same amount (see app.css `--chat-dock-width`). Only applies while
  // the panel is actually visible (`shouldRender`) — the component stays mounted with
  // isOpen=false before the user opens chat, and must not reserve any space then. Cleared
  // when the panel closes/unmounts so the page reclaims the space. Only one chat is ever
  // docked at a time, so a single shared variable is safe.
  useEffect(() => {
    if (!isDocked || !shouldRender) {
      return;
    }
    const root = document.documentElement;
    return () => {
      root.style.removeProperty("--chat-dock-width");
    };
  }, [isDocked, shouldRender]);

  useEffect(() => {
    if (!isDocked || !shouldRender) {
      return;
    }
    // While closing, collapse the inset to 0 so page content slides back as the panel
    // slides out. `panelWidth` null means the CSS default width (28rem) is in effect.
    const width = isClosing ? "0px" : panelWidth != null ? `${panelWidth}px` : "28rem";
    document.documentElement.style.setProperty("--chat-dock-width", width);
  }, [isDocked, shouldRender, isClosing, panelWidth]);

  if (!shouldRender) {
    return null;
  }

  const handleSubmit = () => {
    if (!draft.trim() || !isChatReady || isSending) {
      return;
    }
    const question = draft;
    setDraft("");
    lastQuestionRef.current = question;
    void sendMessage(question);
  };

  const handleRetrySend = () => {
    if (!lastQuestionRef.current || isSending) {
      return;
    }
    void sendMessage(lastQuestionRef.current);
  };

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    // Docked mode is non-modal — let Tab move focus out into the page. Only the modal
    // (mobile) variant traps focus within the panel.
    if (event.key !== "Tab" || !panelRef.current || isDocked) {
      return;
    }
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleResizePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const currentWidth = panelRef.current?.getBoundingClientRect().width ?? panelWidth ?? 448;
    resizeStateRef.current = { startX: event.clientX, startWidth: currentWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
    // Suppress the content push transition during drag so the page tracks the handle 1:1.
    document.documentElement.setAttribute("data-chat-resizing", "");
  };

  const handleResizePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!resizeStateRef.current) {
      return;
    }
    const { startX, startWidth } = resizeStateRef.current;
    const maxWidth = window.innerWidth * MAX_PANEL_WIDTH_VW;
    const nextWidth = Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, startWidth + (startX - event.clientX)));
    setPanelWidth(nextWidth);
  };

  const handleResizePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    resizeStateRef.current = null;
    document.documentElement.removeAttribute("data-chat-resizing");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const panel = (
    <div
      className={`project-chat-root${isDocked ? " project-chat-root--docked" : ""}${isClosing ? " project-chat-root--closing" : ""}`}
      role="presentation"
      style={
        !isDocked && mobileViewportHeight != null
          ? { height: `${mobileViewportHeight}px`, bottom: "auto" }
          : undefined
      }
    >
      {isDocked ? null : (
        <button type="button" className="project-chat-backdrop" aria-label="Close chat" onClick={onClose} />
      )}
      <section
        ref={panelRef}
        className="project-chat-panel"
        role={isDocked ? "complementary" : "dialog"}
        aria-modal={isDocked ? undefined : true}
        aria-labelledby={titleId}
        tabIndex={-1}
        style={panelWidth != null ? { width: `${panelWidth}px` } : undefined}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handlePanelKeyDown}
      >
        <div
          className="project-chat-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat panel"
          aria-valuenow={Math.round(panelWidth ?? 448)}
          aria-valuemin={MIN_PANEL_WIDTH}
          aria-valuemax={Math.round(window.innerWidth * MAX_PANEL_WIDTH_VW)}
          tabIndex={0}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            const step = event.shiftKey ? 40 : 16;
            const direction = event.key === "ArrowLeft" ? 1 : -1;
            const base = panelWidth ?? panelRef.current?.getBoundingClientRect().width ?? 448;
            const maxWidth = window.innerWidth * MAX_PANEL_WIDTH_VW;
            setPanelWidth(Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, base + direction * step)));
          }}
        />
        <header className="project-chat-header">
          <div className="project-chat-header-text">
            <h2 id={titleId} className="project-chat-title">
              {headerTitle}
            </h2>
            <p className="project-chat-subtitle">{subtitle.trim() || scopeLabel}</p>
            {isChatReady && lastIndexedLabel ? (
              <p className="project-chat-updated">Documents last updated {lastIndexedLabel}</p>
            ) : null}
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
                  <p className="project-chat-preparing-message">
                    {preparingStatusLine(index, isMetaLoading, pdfProgressLabel)}
                  </p>
                </>
              )}
            </div>
          ) : null}

          {isChatReady && starters.length > 0 && messages.length === 0 ? (
            <div className="project-chat-starters" aria-label="Suggested questions">
              <p className="project-chat-starters-label">Suggested questions</p>
              <div className="project-chat-chip-row">
                {starters.slice(0, 4).map((starter) => (
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
                    <span className="project-chat-sources-label">Sources</span>
                    <ol className="project-chat-source-list">
                      {message.sources.map((source, sourceIndex) => (
                        <li key={source}>
                          <a href={source} target="_blank" rel="noopener noreferrer" title={source}>
                            <span className="project-chat-source-index">{sourceIndex + 1}</span>
                            <span className="project-chat-source-label">{formatSourceLabel(source)}</span>
                          </a>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                {message.role === "assistant" && message.followups && message.followups.length > 0 ? (
                  <div className="project-chat-followups">
                    <span className="project-chat-followups-label">Follow-ups:</span>
                    <div className="project-chat-chip-row">
                      {message.followups.slice(0, 4).map((followup) => (
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
            <div className="project-chat-banner project-chat-banner--error project-chat-send-error" role="alert">
              <p>{sendError}</p>
              <button type="button" className="project-chat-retry-btn" onClick={handleRetrySend}>
                Try again
              </button>
            </div>
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
          <p className="project-chat-footer-hint">
            Enter to send · Shift + Enter for a new line. Answers are AI-generated — verify against the official
            record.
          </p>
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
