import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSubscriptionAuthConfig,
  getSubscriptionDashboard,
  getSubscriptionMe,
  getSubscriptionNewFiles,
  getSubscriptionPlans,
  postAssignPlan,
  postManualScrape,
  putSubscriptionDistricts,
  SubscriptionApiError,
} from "./subscriptionClient";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

describe("subscriptionClient", () => {
  it("loads public Auth0 config from /subscriptions/auth/config", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          provider: "auth0",
          domain: "dev-nznxwbfucj6q2d5f.us.auth0.com",
          audience: "https://api.citywise.app",
          client_id: "laaoTHTfszDfRZhR0TmWpAw7zsva4vdN",
          configured: true,
        }),
      ),
    );

    const config = await getSubscriptionAuthConfig();
    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toBe("/subscriptions/auth/config");
    expect(config.configured).toBe(true);
    expect(config.domain).toContain("auth0.com");
    expect(config.client_id).toBeTruthy();
  });

  it("loads /subscriptions/me with Bearer token", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          email: "alice@dev.citywise.local",
          district_ids: [11],
          entitlements: {
            max_districts: 1,
            scrape_mode: "link_only",
            scrape_quota_monthly: 0,
            scrapes_used: 0,
            scrapes_remaining: 0,
            plan_sku: "trial_link_only",
            is_unlimited: false,
          },
        }),
      ),
    );

    const me = await getSubscriptionMe("dev:alice");
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(new URL(String(url)).pathname).toBe("/subscriptions/me");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer dev:alice");
    expect(me.district_ids).toEqual([11]);
    expect(me.entitlements.scrape_mode).toBe("link_only");
  });

  it("puts districts and lists new files with date query", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 1,
            email: "alice@dev.citywise.local",
            district_ids: [2, 11],
            entitlements: {
              max_districts: 5,
              scrape_mode: "manual",
              scrape_quota_monthly: 25,
              scrapes_used: 1,
              scrapes_remaining: 24,
              plan_sku: "growth_manual_100",
              is_unlimited: false,
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            page: 1,
            page_size: 25,
            total: 1,
            total_pages: 1,
            items: [
              {
                cf_id: "25-9999",
                title: "Test file",
                district_id: 11,
                source_url: "https://example.com",
                scrape_status: "none",
                first_seen_at: "2026-07-01T00:00:00",
                created_at: "2026-07-01T00:00:00",
                notified_at: null,
              },
            ],
          }),
        ),
      );

    await putSubscriptionDistricts("dev:alice", [2, 11]);
    const files = await getSubscriptionNewFiles("dev:alice", {
      from: "2026-07-01T00:00:00",
      page: 1,
      pageSize: 25,
    });

    const putInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(putInit.method).toBe("PUT");
    expect(JSON.parse(String(putInit.body))).toEqual({ district_ids: [2, 11] });

    const listUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(listUrl.pathname).toBe("/subscriptions/me/new-files");
    expect(listUrl.searchParams.get("from")).toBe("2026-07-01T00:00:00");
    expect(files.items[0]?.cf_id).toBe("25-9999");
  });

  it("loads dashboard X/Y/Z for a district", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          district_id: 1,
          subscribed_district_ids: [1],
          existing_in_citywise: 2,
          total_discovered: 5,
          new_unscraped: 3,
          items: [
            {
              cf_id: "25-1001",
              title: "New file",
              district_id: 1,
              source_url: null,
              scrape_status: "none",
              in_citywise: false,
            },
          ],
        }),
      ),
    );

    const dash = await getSubscriptionDashboard("dev:alice", 1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/subscriptions/me/dashboard");
    expect(url.searchParams.get("district_id")).toBe("1");
    expect(dash.new_unscraped).toBe(3);
    expect(dash.items[0]?.cf_id).toBe("25-1001");
  });

  it("posts manual scrape and maps 403 to SubscriptionApiError", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: { ok: false, reason: "quota_exhausted" } }), {
        status: 403,
      }),
    );

    await expect(postManualScrape("dev:alice", "25-9999")).rejects.toBeInstanceOf(SubscriptionApiError);
  });

  it("loads plans without auth and assigns plan with Bearer", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              sku: "trial_link_only",
              name: "Trial",
              max_districts: 1,
              scrape_mode: "link_only",
              scrape_quota_monthly: 0,
              description: "Trial",
            },
          ]),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 1,
            email: "alice@dev.citywise.local",
            district_ids: [],
            entitlements: {
              max_districts: 1,
              scrape_mode: "manual",
              scrape_quota_monthly: null,
              scrapes_used: 0,
              scrapes_remaining: null,
              plan_sku: "starter_manual_unlimited",
              is_unlimited: true,
            },
          }),
        ),
      );

    const plans = await getSubscriptionPlans();
    expect(plans[0]?.sku).toBe("trial_link_only");

    const me = await postAssignPlan("dev:alice", { sku: "starter_manual_unlimited" });
    expect(me.entitlements.plan_sku).toBe("starter_manual_unlimited");
    expect(me.entitlements.is_unlimited).toBe(true);
  });
});
