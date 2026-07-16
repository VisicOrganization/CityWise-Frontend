import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScopedChatPanel } from "./ScopedChatPanel";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function indexStatus(overrides: Record<string, unknown> = {}) {
  return {
    scope_type: "project",
    scope_id: "25-0859",
    status: "indexing",
    message: "Indexing 2/5 PDFs...",
    pdf_count: 5,
    chunk_count: 0,
    last_indexed_at: null,
    error_message: null,
    is_stale: false,
    is_ready: false,
    reason: "missing",
    progress_percent: 40,
    pdfs_completed: 2,
    pdfs_total: 5,
    ...overrides,
  };
}

function scopeMeta(overrides: Record<string, unknown> = {}) {
  return {
    scope_type: "project",
    scope_id: "25-0859",
    subtitle: "Housing motion",
    context: "",
    starters: [],
    indexed: false,
    chunk_count: 0,
    index: indexStatus(),
    ...overrides,
  };
}

const baseProps = {
  scopeType: "project" as const,
  scopeId: "25-0859",
  scopeLabel: "Council File 25-0859",
  headerTitle: "Ask about this council file",
  onClose: () => undefined,
};

function mockReadyFetch() {
  fetchMock.mockImplementation((input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/chat/sessions")) {
      return Promise.resolve(new Response(JSON.stringify([])));
    }
    if (url.includes("/meta")) {
      return Promise.resolve(
        new Response(
          JSON.stringify(
            scopeMeta({
              indexed: true,
              index: indexStatus({ status: "ready", is_ready: true, progress_percent: 100 }),
            }),
          ),
        ),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({})));
  });
}

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  document.documentElement.style.removeProperty("--chat-dock-width");
  document.documentElement.removeAttribute("data-chat-resizing");
  window.matchMedia = originalMatchMedia;
  fetchMock.mockReset();
  vi.useRealTimers();
});

describe("ScopedChatPanel", () => {
  it("shows preparing UI and polls until chat is ready", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let metaCalls = 0;
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/chat/sessions")) {
        return Promise.resolve(new Response(JSON.stringify([])));
      }
      if (url.includes("/chat/scopes/project/25-0859/meta")) {
        metaCalls += 1;
        if (metaCalls > 1) {
          return Promise.resolve(
            new Response(
              JSON.stringify(
                scopeMeta({
                  indexed: true,
                  starters: ["What is this council file about?"],
                  index: indexStatus({
                    status: "ready",
                    is_ready: true,
                    message: "Ready",
                    progress_percent: 100,
                    pdfs_completed: 5,
                  }),
                }),
              ),
            ),
          );
        }
        return Promise.resolve(new Response(JSON.stringify(scopeMeta())));
      }
      if (url.includes("/chat/index/project/25-0859/status")) {
        return Promise.resolve(
          new Response(
            JSON.stringify(
              indexStatus({
                status: "ready",
                is_ready: true,
                message: "Ready",
                progress_percent: 100,
                pdfs_completed: 5,
              }),
            ),
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    render(
      <ScopedChatPanel
        scopeType="project"
        scopeId="25-0859"
        scopeLabel="Council File 25-0859"
        headerTitle="Ask about this council file"
        isOpen
        onClose={() => undefined}
      />,
    );

    expect(await screen.findByText("Preparing documents for chat…")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByLabelText("Your question")).toBeDisabled();

    await vi.advanceTimersByTimeAsync(2600);

    await waitFor(() => {
      expect(screen.getByLabelText("Your question")).not.toBeDisabled();
    });
  });

  it("shows suggested questions as soon as indexing finishes, without reopening", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // The post-index meta refresh (the one carrying the starters) resolves through a
    // gate we release manually. This reproduces production timing where the network
    // fetch outlasts React's re-render: the ready index status is applied and the poll
    // effect tears down *before* this meta resolves. The fix must survive that ordering.
    let releaseMeta: (() => void) | null = null;
    const postIndexMeta = scopeMeta({
      indexed: true,
      starters: ["What is this council file about?"],
      index: indexStatus({ status: "ready", is_ready: true, progress_percent: 100 }),
    });

    let metaCalls = 0;
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/chat/sessions")) {
        return Promise.resolve(new Response(JSON.stringify([])));
      }
      if (url.includes("/chat/scopes/project/25-0859/meta")) {
        metaCalls += 1;
        // First meta (pre-index) has no starters yet; the gated refresh does.
        if (metaCalls > 1) {
          return new Promise<Response>((resolve) => {
            releaseMeta = () => resolve(new Response(JSON.stringify(postIndexMeta)));
          });
        }
        return Promise.resolve(new Response(JSON.stringify(scopeMeta())));
      }
      if (url.includes("/chat/index/project/25-0859/status")) {
        return Promise.resolve(
          new Response(
            JSON.stringify(indexStatus({ status: "ready", is_ready: true, progress_percent: 100 })),
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    render(
      <ScopedChatPanel
        scopeType="project"
        scopeId="25-0859"
        scopeLabel="Council File 25-0859"
        headerTitle="Ask about this council file"
        isOpen
        onClose={() => undefined}
      />,
    );

    // Starts in the preparing state with no starters.
    expect(await screen.findByText("Preparing documents for chat…")).toBeInTheDocument();
    expect(screen.queryByText("What is this council file about?")).not.toBeInTheDocument();

    // Poll fires → status ready. React flushes the ready index and the poll effect
    // tears down while the meta refresh is still gated.
    await vi.advanceTimersByTimeAsync(2600);
    await waitFor(() => expect(releaseMeta).not.toBeNull());

    // Now let the meta refresh resolve. The starters must still be applied.
    releaseMeta!();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "What is this council file about?" }),
      ).toBeInTheDocument();
    });
  });

  it("restores prior messages when reopening chat", async () => {
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/chat/sessions?") && !url.includes("/messages")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                session_id: "session-abc",
                title: "Prior chat",
                scope_type: "project",
                scope_id: "25-0859",
                created_at: "2026-01-01T00:00:00",
                updated_at: "2026-01-02T00:00:00",
              },
            ]),
          ),
        );
      }
      if (url.includes("/chat/sessions/session-abc/messages")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              messages: [
                { role: "user", content: "What is this file about?" },
                { role: "assistant", content: "It is a housing motion.", sources: [], followups: [] },
              ],
            }),
          ),
        );
      }
      if (url.includes("/chat/scopes/project/25-0859/meta")) {
        return Promise.resolve(
          new Response(
            JSON.stringify(
              scopeMeta({
                indexed: true,
                index: indexStatus({ status: "ready", is_ready: true, progress_percent: 100 }),
              }),
            ),
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const view = render(
      <ScopedChatPanel
        scopeType="project"
        scopeId="25-0859"
        scopeLabel="Council File 25-0859"
        headerTitle="Ask about this council file"
        isOpen
        onClose={() => undefined}
      />,
    );

    expect(await screen.findByText("What is this file about?")).toBeInTheDocument();
    expect(screen.getByText("It is a housing motion.")).toBeInTheDocument();

    view.rerender(
      <ScopedChatPanel
        scopeType="project"
        scopeId="25-0859"
        scopeLabel="Council File 25-0859"
        headerTitle="Ask about this council file"
        isOpen={false}
        onClose={() => undefined}
      />,
    );

    view.rerender(
      <ScopedChatPanel
        scopeType="project"
        scopeId="25-0859"
        scopeLabel="Council File 25-0859"
        headerTitle="Ask about this council file"
        isOpen
        onClose={() => undefined}
      />,
    );

    expect(await screen.findByText("It is a housing motion.")).toBeInTheDocument();
  });

  it("keeps preparing state when send returns index_not_ready", async () => {
    const user = userEvent.setup();

    fetchMock.mockImplementation((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/chat/sessions")) {
        return Promise.resolve(new Response(JSON.stringify([])));
      }
      if (url.includes("/chat/scopes/project/25-0859/meta")) {
        return Promise.resolve(
          new Response(
            JSON.stringify(
              scopeMeta({
                indexed: true,
                starters: [],
                index: indexStatus({ status: "ready", is_ready: true, progress_percent: 100 }),
              }),
            ),
          ),
        );
      }
      if (init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              detail: {
                code: "index_not_ready",
                message: "Documents are still being prepared for chat.",
                index: indexStatus({ status: "indexing", is_ready: false, progress_percent: 60 }),
              },
            }),
            { status: 409 },
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    render(
      <ScopedChatPanel
        scopeType="project"
        scopeId="25-0859"
        scopeLabel="Council File 25-0859"
        headerTitle="Ask about this council file"
        isOpen
        onClose={() => undefined}
      />,
    );

    const input = await screen.findByLabelText("Your question");
    await user.type(input, "What changed recently?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Preparing documents for chat…")).toBeInTheDocument();
    expect(screen.getByLabelText("Your question")).toBeDisabled();
    expect(screen.queryByText("Couldn't get an answer, try again.")).not.toBeInTheDocument();
  });

  it("docks as a non-modal panel and publishes the content-push width on desktop", async () => {
    mockMatchMedia(false); // not mobile → docked
    mockReadyFetch();

    const view = render(<ScopedChatPanel {...baseProps} isOpen />);

    await screen.findByRole("complementary");
    // Docked: no backdrop, non-modal complementary region.
    expect(document.querySelector(".project-chat-root--docked")).not.toBeNull();
    expect(document.querySelector(".project-chat-backdrop")).toBeNull();
    expect(screen.getByRole("complementary")).not.toHaveAttribute("aria-modal");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Publishes the width the page content is inset by.
    expect(document.documentElement.style.getPropertyValue("--chat-dock-width")).toBe("28rem");

    view.unmount();
    // Space is reclaimed on unmount.
    expect(document.documentElement.style.getPropertyValue("--chat-dock-width")).toBe("");
  });

  it("reserves no space while mounted but closed, and pushes only once opened", async () => {
    mockMatchMedia(false); // not mobile → docked
    mockReadyFetch();

    // ProjectDetailsPanel keeps ScopedChatPanel mounted with isOpen=false until the
    // user hits the chat button — it must not reserve the docked rail before then.
    const view = render(<ScopedChatPanel {...baseProps} isOpen={false} />);

    expect(document.querySelector(".project-chat-panel")).toBeNull();
    expect(document.documentElement.style.getPropertyValue("--chat-dock-width")).toBe("");

    view.rerender(<ScopedChatPanel {...baseProps} isOpen />);

    await screen.findByRole("complementary");
    expect(document.documentElement.style.getPropertyValue("--chat-dock-width")).toBe("28rem");
  });

  it("stays a modal overlay and does not push content on mobile", async () => {
    mockMatchMedia(true); // mobile → modal
    mockReadyFetch();

    render(<ScopedChatPanel {...baseProps} isOpen />);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(document.querySelector(".project-chat-backdrop")).not.toBeNull();
    expect(document.querySelector(".project-chat-root--docked")).toBeNull();
    // No content push in modal mode.
    expect(document.documentElement.style.getPropertyValue("--chat-dock-width")).toBe("");
  });
});
