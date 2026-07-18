import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export interface ActivityFileSummaryModalProps {
  /** Heading text: the document title (falls back to a generic label). */
  title: string;
  /** Formatted date shown under the heading; omitted when unknown. */
  date: string | null;
  /** The API's `activity_file_summary` text for this document. */
  activityFileSummary: string;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Modal showing the AI-generated summary of a single source document.
 * Closes on the X button, Escape, or a backdrop click; focus is moved in on open
 * and restored to whatever was focused before (the Summary button) on close.
 *
 * Portaled to <body>: the mobile sidebar sheet sets `will-change: transform`, which
 * makes it a containing block for `position: fixed`, so an inline modal would be
 * positioned against the sheet and clipped at its bottom edge instead of the viewport.
 */
export function ActivityFileSummaryModal({
  title,
  date,
  activityFileSummary,
  onClose,
}: ActivityFileSummaryModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  // Capture the trigger once, on mount, so every close path restores to it.
  const previouslyFocused = useRef<HTMLElement | null>(
    typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null,
  );

  useEffect(() => {
    closeButtonRef.current?.focus();
    const trigger = previouslyFocused.current;
    return () => {
      // Only restore if the trigger is still in the document.
      if (trigger && document.contains(trigger)) {
        trigger.focus();
      }
    };
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      // Keep focus inside the dialog.
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) {
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="activity-summary-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        // Backdrop only: a mousedown that started inside the panel must not close.
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        className="activity-summary-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="activity-summary-header">
          <div className="activity-summary-heading-group">
            <h2 className="activity-summary-title" id={titleId}>
              {title}
            </h2>
            {date ? <p className="activity-summary-date">{date}</p> : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="activity-summary-close"
            onClick={onClose}
            aria-label="Close summary"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </div>

        <div className="activity-summary-body">
          <p className="activity-summary-text">{activityFileSummary}</p>
        </div>

        <p className="activity-summary-caption">
          AI-generated summary of the source document. It may be incomplete or inaccurate — read the
          original file for the official record.
        </p>
      </div>
    </div>,
    document.body,
  );
}
