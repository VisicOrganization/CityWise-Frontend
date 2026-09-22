import { useEffect, useId, useRef, useState } from "react";

import { CloseIcon } from "../../shared/ui/visicIcons";
import { NEIGHBORHOODS } from "./resourceEngine";
import type { useNeighborhoodChat } from "./useNeighborhoodChat";
import "./neighborhood-chat.css";

type Chat = ReturnType<typeof useNeighborhoodChat>;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH_VW = 0.9;

export function NeighborhoodChatPanel({ chat, loading, loadError, picking, onPick, onClose }: {
  chat: Chat; loading: boolean; loadError: boolean; picking: boolean; onPick: () => void; onClose: () => void;
}) {
  const titleId = useId();
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    document.documentElement.style.setProperty("--chat-dock-width", panelWidth == null ? "28rem" : `${panelWidth}px`);
    return () => {
      document.documentElement.style.removeProperty("--chat-dock-width");
    };
  }, [panelWidth]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" }); }, [chat.messages, chat.isSending]);

  const disabled = loading || loadError || chat.isSending || picking;
  const submit = () => { if (!disabled && draft.trim()) { void chat.send(draft); setDraft(""); } };
  const resizeDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const width = event.currentTarget.parentElement?.getBoundingClientRect().width ?? panelWidth ?? 448;
    resizeStateRef.current = { startX: event.clientX, startWidth: width };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.documentElement.setAttribute("data-chat-resizing", "");
  };
  const resizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeStateRef.current) return;
    const { startX, startWidth } = resizeStateRef.current;
    setPanelWidth(Math.min(window.innerWidth * MAX_PANEL_WIDTH_VW, Math.max(MIN_PANEL_WIDTH, startWidth + startX - event.clientX)));
  };
  const resizeUp = (event: React.PointerEvent<HTMLDivElement>) => {
    resizeStateRef.current = null;
    document.documentElement.removeAttribute("data-chat-resizing");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className={`project-chat-root project-chat-root--docked${picking ? " project-chat-root--closing" : ""}`} role="presentation">
      <section className="project-chat-panel" role="complementary" aria-label="CD2 neighborhood chat" aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
        <div className="project-chat-resize-handle" role="separator" aria-orientation="vertical" aria-label="Resize chat panel"
          aria-valuenow={Math.round(panelWidth ?? 448)} aria-valuemin={MIN_PANEL_WIDTH} aria-valuemax={Math.round(window.innerWidth * MAX_PANEL_WIDTH_VW)} tabIndex={0}
          onPointerDown={resizeDown} onPointerMove={resizeMove} onPointerUp={resizeUp} onPointerCancel={resizeUp}
          onKeyDown={(event) => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); const step = event.shiftKey ? 40 : 16; const direction = event.key === "ArrowLeft" ? 1 : -1; setPanelWidth(Math.min(window.innerWidth * MAX_PANEL_WIDTH_VW, Math.max(MIN_PANEL_WIDTH, (panelWidth ?? 448) + direction * step))); }} />
        <header className="project-chat-header">
          <div className="project-chat-header-text">
            <h2 id={titleId} className="project-chat-title">Ask about neighborhood resources</h2>
            <p className="project-chat-subtitle">Council District 2 · {chat.neighborhood ?? "All listed neighborhoods"}</p>
          </div>
          <button type="button" className="project-chat-close" aria-label="Close neighborhood chat" onClick={onClose}><CloseIcon width={16} height={16} /></button>
        </header>
        <div className="project-chat-body">
          {loading ? <div className="project-chat-preparing" aria-live="polite"><p className="project-chat-preparing-title">Loading neighborhood resources…</p></div> : null}
          {loadError ? <div className="project-chat-banner project-chat-banner--error" role="alert"><p>Resources could not be loaded. Reload the page to try again.</p></div> : null}
          {!chat.messages.length && !loading && !loadError ? <div className="project-chat-starters" aria-label="Suggested questions">
            <p className="project-chat-starters-label">Suggested questions</p>
            <div className="project-chat-chip-row">{["Where are the parks?", "Where is the nearest police station?", "Show me libraries"].map((question) => <button key={question} type="button" className="project-chat-chip" disabled={disabled} onClick={() => void chat.send(question)}>{question}</button>)}</div>
          </div> : null}
          <div className="project-chat-thread" aria-live="polite" aria-relevant="additions">
            {chat.messages.map((message, index) => <article key={`${message.role}-${index}`} className={`project-chat-message project-chat-message--${message.role}`}><p className="project-chat-message-role">{message.role === "user" ? "You" : "Assistant"}</p><p className="project-chat-message-content">{message.text}</p></article>)}
            {chat.isSending ? <p className="project-chat-typing">Finding your resources…</p> : null}<div ref={messagesEndRef} />
          </div>
          {chat.pending?.needs === "point" ? <div className="project-chat-followups"><span className="project-chat-followups-label">To find the nearest result</span><div className="project-chat-chip-row"><button type="button" className="project-chat-chip" disabled={disabled} onClick={onPick}>Choose a point on the map</button>{NEIGHBORHOODS.map((name) => <button type="button" className="project-chat-chip" key={name} disabled={disabled} onClick={() => chat.chooseNeighborhood(name)}>{name}</button>)}</div></div> : null}
          {chat.pending?.needs === "resource" ? <div className="project-chat-followups" aria-label="Choose a resource"><span className="project-chat-followups-label">Choose a resource</span><div className="project-chat-chip-row">{chat.pending.items.map((item) => <button key={item.key} type="button" className="project-chat-chip" disabled={disabled} onClick={() => chat.chooseResource(item)}>{item.properties.label} · {item.properties.neighborhood}</button>)}</div></div> : null}
          {chat.result ? <div className="project-chat-followups"><span className="project-chat-followups-label">Map results</span><div className="project-chat-chip-row"><button type="button" className="project-chat-chip" onClick={chat.clearResults}>Clear results</button>{chat.intent?.action === "nearest" ? <button type="button" className="project-chat-chip" disabled={disabled} onClick={onPick}>Change map point</button> : null}</div></div> : null}
          {chat.error ? <div className="project-chat-banner project-chat-banner--error project-chat-send-error" role="alert"><p>{chat.error}</p><button type="button" className="project-chat-retry-btn" disabled={disabled} onClick={() => void chat.send(chat.lastQuestion, true)}>Try again</button></div> : null}
        </div>
        <footer className="project-chat-footer">
          <label className="project-chat-input-label" htmlFor={inputId}>Your question</label>
          <div className="project-chat-input-row"><textarea id={inputId} className="project-chat-input" rows={2} maxLength={1000} placeholder="Type your question…" value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} /><button type="button" className="project-chat-send-btn" disabled={disabled || !draft.trim()} onClick={submit}>Send</button></div>
          <p className="project-chat-footer-hint">Enter to send · Shift + Enter for a new line. Answers use listed neighborhood resource data.</p>
        </footer>
      </section>
    </div>
  );
}
