import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ChatIndexNotReadyError,
  getChatIndexStatus,
  getChatScopeMeta,
  listChatSessions,
  postChatMessage,
  restoreScopedChatHistory,
} from "./chatClient";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

describe("chat client", () => {
  it("loads scope meta for a project", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          scope_type: "project",
          scope_id: "25-0859",
          subtitle: "Housing motion",
          context: "",
          starters: ["What is this about?"],
          indexed: false,
          chunk_count: 0,
          index: {
            scope_type: "project",
            scope_id: "25-0859",
            status: "pending",
            message: "Queued for indexing...",
            pdf_count: 5,
            chunk_count: 0,
            last_indexed_at: null,
            error_message: null,
            is_stale: false,
            is_ready: false,
            reason: "missing",
            progress_percent: 0,
            pdfs_completed: null,
            pdfs_total: 5,
          },
        }),
      ),
    );

    const meta = await getChatScopeMeta("project", "25-0859");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toBe("/chat/scopes/project/25-0859/meta");
    expect(meta.index.is_ready).toBe(false);
    expect(meta.starters).toEqual(["What is this about?"]);
  });

  it("polls index status", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
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
        }),
      ),
    );

    const status = await getChatIndexStatus("project", "25-0859");

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toBe("/chat/index/project/25-0859/status");
    expect(status.progress_percent).toBe(40);
  });

  it("throws ChatIndexNotReadyError on 409 index_not_ready", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: {
            code: "index_not_ready",
            message: "Documents are still being prepared for chat.",
            index: {
              scope_type: "project",
              scope_id: "25-0859",
              status: "indexing",
              message: "Indexing 1/5 PDFs...",
              pdf_count: 5,
              chunk_count: 0,
              last_indexed_at: null,
              error_message: null,
              is_stale: false,
              is_ready: false,
              reason: "missing",
              progress_percent: 20,
              pdfs_completed: 1,
              pdfs_total: 5,
            },
          },
        }),
        { status: 409 },
      ),
    );

    await expect(
      postChatMessage({
        question: "What is this about?",
        scope_type: "project",
        scope_id: "25-0859",
      }),
    ).rejects.toBeInstanceOf(ChatIndexNotReadyError);
  });

  it("posts chat messages when ready", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          answer: "This is a housing motion.",
          sources: ["https://cityclerk.lacity.org/example.pdf"],
          followups: ["Who moved it?"],
          session_id: "session-1",
        }),
      ),
    );

    const response = await postChatMessage({
      question: "What is this about?",
      scope_type: "project",
      scope_id: "25-0859",
      client_id: "client-1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({
      question: "What is this about?",
      scope_type: "project",
      scope_id: "25-0859",
      client_id: "client-1",
    });
    expect(response.answer).toContain("housing motion");
    expect(response.session_id).toBe("session-1");
  });

  it("lists chat sessions for a client", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            session_id: "session-1",
            title: "District chat",
            scope_type: "member",
            scope_id: "7",
            created_at: null,
            updated_at: null,
          },
        ]),
      ),
    );

    const sessions = await listChatSessions("client-1");

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toBe("/chat/sessions");
    expect(requestUrl.searchParams.get("client_id")).toBe("client-1");
    expect(sessions[0]?.scope_type).toBe("member");
  });

  it("restores scoped chat history from session APIs", async () => {
    vi.stubGlobal(
      "localStorage",
      {
        getItem: () => "client-1",
        setItem: vi.fn(),
      } as unknown as Storage,
    );

    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/chat/sessions?")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                session_id: "session-9",
                title: "Project chat",
                scope_type: "project",
                scope_id: "25-0859",
                created_at: null,
                updated_at: null,
              },
            ]),
          ),
        );
      }
      if (url.includes("/chat/sessions/session-9/messages")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              messages: [
                { role: "user", content: "Hello" },
                { role: "assistant", content: "Hi there", sources: ["https://example.com/a.pdf"], followups: [] },
              ],
            }),
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const restored = await restoreScopedChatHistory("project", "25-0859");

    expect(restored?.sessionId).toBe("session-9");
    expect(restored?.messages).toHaveLength(2);
    expect(restored?.messages[1]?.sources).toEqual(["https://example.com/a.pdf"]);
  });
});
