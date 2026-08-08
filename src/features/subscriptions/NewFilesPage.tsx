import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  getSubscriptionDashboard,
  postManualScrape,
  SubscriptionApiError,
} from "../../shared/api/subscriptionClient";
import type { DashboardItem, SubscriptionEntitlements } from "../../shared/api/subscriptionContracts";
import { useAppAuth } from "../../shared/auth/AuthProvider";
import { AppShell } from "../../shared/ui/AppShell";
import { DistrictSidePanel } from "./DistrictSidePanel";
import { PlanSummary } from "./PlanSummary";
import { QuotaBanner } from "./QuotaBanner";
import { SubscriptionsNav } from "./SubscriptionsNav";
import { useDashboard } from "./useDashboard";
import { useSubscriptionMe } from "./useSubscriptionMe";

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 40;

function cityClerkUrl(item: DashboardItem): string | null {
  if (item.source_url?.trim()) {
    return item.source_url.trim();
  }
  return `https://cityclerk.lacity.org/lacityclerkconnect/index.cfm?fa=ccfi.viewrecord&cfnumber=${encodeURIComponent(item.cf_id)}`;
}

function cityWiseProjectHref(item: DashboardItem): string {
  const params = new URLSearchParams();
  params.set("openProject", item.cf_id);
  if (item.district_id != null) {
    params.set("districtFocus", String(item.district_id));
    params.set("showDistrictProfile", "0");
  }
  return `/map?${params.toString()}`;
}

export function NewFilesPage() {
  const { getAccessToken } = useAppAuth();
  const { me, setMe, refresh: refreshMe, isLoading: meLoading } = useSubscriptionMe();
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [skippedCfIds, setSkippedCfIds] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingCfIds, setLoadingCfIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!me || selectedDistrictId != null) {
      return;
    }
    setSelectedDistrictId(me.district_ids[0] ?? 1);
  }, [me, selectedDistrictId]);

  const { data, error, isLoading, refresh } = useDashboard(selectedDistrictId);

  const entitlements: SubscriptionEntitlements | null = me?.entitlements ?? null;
  const quotaExhausted =
    Boolean(entitlements) &&
    !entitlements!.is_unlimited &&
    entitlements!.scrape_quota_monthly != null &&
    (entitlements!.scrapes_remaining ?? 0) <= 0;
  const canManualLoad = entitlements?.scrape_mode === "manual" && !quotaExhausted;

  const visibleItems =
    data?.items.filter((item) => !skippedCfIds.has(item.cf_id) && item.scrape_status !== "queued") ??
    [];
  const queuedItems = data?.items.filter((item) => item.scrape_status === "queued") ?? [];

  async function pollUntilSettled(cfId: string) {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
      const token = await getAccessToken();
      const next = await getSubscriptionDashboard(token, selectedDistrictId ?? undefined);
      const item = next.items.find((row) => row.cf_id === cfId);
      if (!item || item.scrape_status === "ready" || item.scrape_status === "failed") {
        await refresh();
        await refreshMe();
        return;
      }
    }
    await refresh();
  }

  async function handleScrape(cfId: string) {
    setActionError(null);
    setLoadingCfIds((current) => new Set(current).add(cfId));
    try {
      const token = await getAccessToken();
      const result = await postManualScrape(token, cfId);
      if (result.entitlements) {
        setMe((current) =>
          current
            ? {
                ...current,
                entitlements: result.entitlements!,
              }
            : current,
        );
      }
      await refresh();
      if (result.ok) {
        await pollUntilSettled(cfId);
      } else {
        setActionError(result.reason);
      }
    } catch (err) {
      if (err instanceof SubscriptionApiError && err.status === 403) {
        setActionError(err.message || "Scrape not allowed on your plan.");
        await refreshMe();
      } else {
        setActionError(err instanceof Error ? err.message : "Could not start scrape.");
      }
    } finally {
      setLoadingCfIds((current) => {
        const next = new Set(current);
        next.delete(cfId);
        return next;
      });
    }
  }

  const subscribed = data?.subscribed_district_ids ?? me?.district_ids ?? [1];

  return (
    <AppShell className="subscriptions-shell">
      <div className="subscriptions-page">
        <SubscriptionsNav />
        <header className="subscriptions-header">
          <div>
            <h1>District dashboard</h1>
            <p className="subscriptions-lede">
              Existing files in CityWise (X), total discovered (Y), and new files you can scrape (Z = Y −
              X). Trial starts on District 1; biweekly email digests use your signup address.
            </p>
          </div>
          <Link className="subscriptions-secondary-btn" to="/subscriptions/settings">
            Settings
          </Link>
        </header>

        <QuotaBanner visible={quotaExhausted} />

        {me ? (
          <section className="subscriptions-card subscriptions-card--compact">
            <PlanSummary
              planSku={me.entitlements.plan_sku}
              scrapeMode={me.entitlements.scrape_mode}
              maxDistricts={me.entitlements.max_districts}
              scrapesUsed={me.entitlements.scrapes_used}
              scrapesRemaining={me.entitlements.scrapes_remaining}
              isUnlimited={me.entitlements.is_unlimited}
              scrapeQuotaMonthly={me.entitlements.scrape_quota_monthly}
            />
          </section>
        ) : null}

        <div className="subscriptions-dashboard-layout">
          <DistrictSidePanel
            selectedDistrictId={selectedDistrictId ?? 1}
            subscribedDistrictIds={subscribed}
            onSelect={(districtId) => {
              setSelectedDistrictId(districtId);
              setSkippedCfIds(new Set());
            }}
          />

          <section className="subscriptions-card subscriptions-dashboard-main">
            <div className="subscriptions-filters">
              <button type="button" className="subscriptions-secondary-btn" onClick={() => void refresh()}>
                Refresh
              </button>
            </div>

            {meLoading || isLoading ? <p className="subscriptions-status">Loading dashboard…</p> : null}
            {error ? (
              <p className="subscriptions-status subscriptions-status--error" role="alert">
                {error}
              </p>
            ) : null}
            {actionError ? (
              <p className="subscriptions-status subscriptions-status--error" role="alert">
                {actionError}
              </p>
            ) : null}

            {data ? (
              <>
                <div className="subscriptions-stat-grid" aria-label="District file counts">
                  <div className="subscriptions-stat">
                    <span className="subscriptions-stat-label">Existing in CityWise (X)</span>
                    <strong className="subscriptions-stat-value">{data.existing_in_citywise}</strong>
                  </div>
                  <div className="subscriptions-stat">
                    <span className="subscriptions-stat-label">Total discovered (Y)</span>
                    <strong className="subscriptions-stat-value">{data.total_discovered}</strong>
                  </div>
                  <div className="subscriptions-stat subscriptions-stat--accent">
                    <span className="subscriptions-stat-label">New unscraped (Z)</span>
                    <strong className="subscriptions-stat-value">{data.new_unscraped}</strong>
                  </div>
                </div>
                <p className="subscriptions-muted">
                  District {data.district_id}: {data.existing_in_citywise} − {data.total_discovered}{" "}
                  math is shown as X / Y / Z above (Z = Y − X).
                </p>
              </>
            ) : null}

            {queuedItems.length > 0 ? (
              <p className="subscriptions-status">
                {queuedItems.length} scrape{queuedItems.length === 1 ? "" : "s"} queued…
              </p>
            ) : null}

            {data && visibleItems.length === 0 && queuedItems.length === 0 ? (
              <p className="subscriptions-status">
                No new unscraped files for District {data.district_id}.
              </p>
            ) : null}

            {visibleItems.length > 0 ? (
              <div className="subscriptions-table-wrap">
                <table className="subscriptions-table">
                  <thead>
                    <tr>
                      <th scope="col">CF id</th>
                      <th scope="col">Title</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((item) => {
                      const clerk = cityClerkUrl(item);
                      const isLoadingRow = loadingCfIds.has(item.cf_id);
                      return (
                        <tr key={item.cf_id}>
                          <td>
                            <code>{item.cf_id}</code>
                          </td>
                          <td>{item.title?.trim() || "—"}</td>
                          <td>
                            <span className={`subscriptions-status-pill status-${item.scrape_status}`}>
                              {item.scrape_status}
                            </span>
                          </td>
                          <td>
                            <div className="subscriptions-row-actions">
                              {clerk ? (
                                <a href={clerk} target="_blank" rel="noopener noreferrer">
                                  City Clerk
                                </a>
                              ) : null}
                              {item.scrape_status === "ready" ? (
                                <Link to={cityWiseProjectHref(item)}>Open in CityWise</Link>
                              ) : null}
                              {canManualLoad &&
                              (item.scrape_status === "none" ||
                                item.scrape_status === "failed" ||
                                item.scrape_status === "skipped_quota") ? (
                                <button
                                  type="button"
                                  className="subscriptions-text-btn"
                                  disabled={isLoadingRow}
                                  onClick={() => void handleScrape(item.cf_id)}
                                >
                                  {isLoadingRow ? "Scraping…" : "Scrape"}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="subscriptions-text-btn"
                                onClick={() =>
                                  setSkippedCfIds((current) => new Set(current).add(item.cf_id))
                                }
                              >
                                Skip
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
