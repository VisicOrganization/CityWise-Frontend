import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { putSubscriptionDistricts } from "../../shared/api/subscriptionClient";
import { useAppAuth } from "../../shared/auth/AuthProvider";
import { AppShell } from "../../shared/ui/AppShell";
import { DistrictMultiSelect } from "./DistrictMultiSelect";
import { PlanSummary } from "./PlanSummary";
import { SubscriptionsNav } from "./SubscriptionsNav";
import { useSubscriptionMe } from "./useSubscriptionMe";

export function SubscriptionSettingsPage() {
  const { getAccessToken, email, mode, logout } = useAppAuth();
  const { me, setMe, error, isLoading, refresh } = useSubscriptionMe();
  const [draftDistricts, setDraftDistricts] = useState<number[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const trialLocked = me?.entitlements.plan_sku === "trial_link_only";

  useEffect(() => {
    if (me) {
      setDraftDistricts(me.district_ids.length > 0 ? me.district_ids : [1]);
    }
  }, [me]);

  async function handleSave() {
    if (!me || trialLocked) {
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const token = await getAccessToken();
      const next = await putSubscriptionDistricts(token, draftDistricts);
      setMe(next);
      setSaveOk(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save districts.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell className="subscriptions-shell">
      <div className="subscriptions-page">
        <SubscriptionsNav />
        <header className="subscriptions-header">
          <div>
            <h1>Subscription settings</h1>
            <p className="subscriptions-lede">
              Trial accounts follow District 1. After you subscribe, choose up to your plan&apos;s
              district limit here. Digests go to your signup email every two weeks.
            </p>
          </div>
          <div className="subscriptions-header-meta">
            <span className="subscriptions-muted">{email ?? "Signed in"}</span>
            {mode === "auth0" ? (
              <button type="button" className="subscriptions-text-btn" onClick={logout}>
                Sign out
              </button>
            ) : (
              <span className="subscriptions-pill">Dev auth</span>
            )}
          </div>
        </header>

        {isLoading ? <p className="subscriptions-status">Loading subscription…</p> : null}
        {error ? (
          <p className="subscriptions-status subscriptions-status--error" role="alert">
            {error}{" "}
            <button type="button" className="subscriptions-text-btn" onClick={() => void refresh()}>
              Retry
            </button>
          </p>
        ) : null}

        {me ? (
          <div className="subscriptions-layout">
            <section className="subscriptions-card">
              <h2>
                Your plan{" "}
                {trialLocked ? <span className="subscriptions-trial-badge">Trial</span> : null}
              </h2>
              <PlanSummary
                planSku={me.entitlements.plan_sku}
                scrapeMode={me.entitlements.scrape_mode}
                maxDistricts={me.entitlements.max_districts}
                scrapesUsed={me.entitlements.scrapes_used}
                scrapesRemaining={me.entitlements.scrapes_remaining}
                isUnlimited={me.entitlements.is_unlimited}
                scrapeQuotaMonthly={me.entitlements.scrape_quota_monthly}
              />
              <p className="subscriptions-muted">
                {trialLocked ? (
                  <>
                    Trial includes District 1, a biweekly email digest, and a small manual scrape quota.{" "}
                    <Link to="/subscriptions/plans">Browse plans</Link> to unlock more districts.
                  </>
                ) : (
                  <>
                    Paid plans can follow more districts.{" "}
                    <Link to="/subscriptions/plans">Change plan</Link>
                  </>
                )}
              </p>
            </section>

            <section className="subscriptions-card">
              <h2>Districts</h2>
              <DistrictMultiSelect
                selected={draftDistricts}
                maxDistricts={me.entitlements.max_districts}
                disabled={isSaving || trialLocked}
                trialLocked={trialLocked}
                onChange={setDraftDistricts}
              />
              <div className="subscriptions-actions-row">
                <button
                  type="button"
                  className="subscriptions-primary-btn"
                  disabled={isSaving || trialLocked}
                  onClick={() => void handleSave()}
                >
                  {trialLocked ? "Locked on trial" : isSaving ? "Saving…" : "Save districts"}
                </button>
                <Link className="subscriptions-secondary-btn" to="/new-files">
                  Open dashboard
                </Link>
              </div>
              {saveError ? (
                <p className="subscriptions-status subscriptions-status--error" role="alert">
                  {saveError}
                </p>
              ) : null}
              {saveOk ? (
                <p className="subscriptions-status subscriptions-status--ok" role="status">
                  Districts updated.
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
