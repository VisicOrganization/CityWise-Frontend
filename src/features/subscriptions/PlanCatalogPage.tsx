import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getSubscriptionPlans, postAssignPlan } from "../../shared/api/subscriptionClient";
import type { SubscriptionPlan } from "../../shared/api/subscriptionContracts";
import { useAppAuth } from "../../shared/auth/AuthProvider";
import { AppShell } from "../../shared/ui/AppShell";
import { SubscriptionsNav } from "./SubscriptionsNav";
import { useSubscriptionMe } from "./useSubscriptionMe";

function formatQuota(value: number | null): string {
  return value == null ? "Unlimited" : String(value);
}

export function PlanCatalogPage() {
  const { getAccessToken } = useAppAuth();
  const { me, setMe, refresh } = useSubscriptionMe();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignOk, setAssignOk] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assigningSku, setAssigningSku] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void getSubscriptionPlans()
      .then((next) => {
        if (!cancelled) {
          setPlans(next);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load plans.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAssign(sku: string) {
    setAssigningSku(sku);
    setAssignError(null);
    setAssignOk(null);
    try {
      const token = await getAccessToken();
      const next = await postAssignPlan(token, { sku });
      setMe(next);
      setAssignOk(`Assigned ${sku}.`);
      await refresh();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Could not assign plan.");
    } finally {
      setAssigningSku(null);
    }
  }

  return (
    <AppShell className="subscriptions-shell">
      <div className="subscriptions-page">
        <SubscriptionsNav />
        <header className="subscriptions-header">
          <div>
            <h1>Plans</h1>
            <p className="subscriptions-lede">
              Catalog from the API. Stripe Checkout comes later — for trial/dev you can assign a mock
              SKU.
            </p>
          </div>
          <div className="subscriptions-actions-row">
            <a className="subscriptions-secondary-btn" href="#upgrade-placeholder">
              Upgrade (coming soon)
            </a>
            <Link className="subscriptions-secondary-btn" to="/new-files">
              New files
            </Link>
          </div>
        </header>

        {me ? (
          <p className="subscriptions-muted">
            Current plan: <code>{me.entitlements.plan_sku ?? "—"}</code> · mode{" "}
            <code>{me.entitlements.scrape_mode}</code>
          </p>
        ) : null}

        {isLoading ? <p className="subscriptions-status">Loading plans…</p> : null}
        {error ? (
          <p className="subscriptions-status subscriptions-status--error" role="alert">
            {error}
          </p>
        ) : null}
        {assignError ? (
          <p className="subscriptions-status subscriptions-status--error" role="alert">
            {assignError}
          </p>
        ) : null}
        {assignOk ? (
          <p className="subscriptions-status subscriptions-status--ok" role="status">
            {assignOk}
          </p>
        ) : null}

        <div className="subscriptions-plan-grid">
          {plans.map((plan) => (
            <article key={plan.sku} className="subscriptions-card subscriptions-plan-card">
              <h2>{plan.name}</h2>
              <p className="subscriptions-muted">{plan.description}</p>
              <ul className="subscriptions-plan-facts">
                <li>
                  SKU: <code>{plan.sku}</code>
                </li>
                <li>Max districts: {plan.max_districts}</li>
                <li>
                  Mode: <code>{plan.scrape_mode}</code>
                </li>
                <li>Quota: {formatQuota(plan.scrape_quota_monthly)}</li>
              </ul>
              <button
                type="button"
                className="subscriptions-primary-btn"
                disabled={assigningSku === plan.sku || me?.entitlements.plan_sku === plan.sku}
                onClick={() => void handleAssign(plan.sku)}
              >
                {me?.entitlements.plan_sku === plan.sku
                  ? "Current plan"
                  : assigningSku === plan.sku
                    ? "Assigning…"
                    : "Assign (dev)"}
              </button>
            </article>
          ))}
        </div>

        <aside id="upgrade-placeholder" className="subscriptions-card">
          <h2>Upgrade</h2>
          <p>
            Stripe Checkout is out of scope for this release. Use <strong>Assign (dev)</strong> with{" "}
            <code>POST /subscriptions/me/plan</code> until billing is wired.
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
