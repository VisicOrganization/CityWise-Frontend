type PlanSummaryProps = {
  scrapeMode: string;
  scrapesUsed: number;
  scrapesRemaining: number | null;
  isUnlimited: boolean;
  planSku: string | null;
  maxDistricts: number;
  scrapeQuotaMonthly?: number | null;
};

export function isTrialPlan(planSku: string | null, _scrapeMode?: string): boolean {
  return planSku === "trial_link_only";
}

export function formatQuotaLabel(props: {
  scrapesUsed: number;
  scrapesRemaining: number | null;
  isUnlimited: boolean;
  scrapeQuotaMonthly: number | null;
}): string {
  if (props.isUnlimited || props.scrapeQuotaMonthly == null) {
    return "Unlimited";
  }
  if (props.scrapesRemaining == null) {
    return `${props.scrapesUsed} / ${props.scrapeQuotaMonthly} used`;
  }
  return `${props.scrapesRemaining} remaining (${props.scrapesUsed} / ${props.scrapeQuotaMonthly} used)`;
}

export function PlanSummary({
  scrapeMode,
  scrapesUsed,
  scrapesRemaining,
  isUnlimited,
  planSku,
  maxDistricts,
  scrapeQuotaMonthly = null,
}: PlanSummaryProps) {
  const quota = formatQuotaLabel({
    scrapesUsed,
    scrapesRemaining,
    isUnlimited,
    scrapeQuotaMonthly,
  });
  const trial = isTrialPlan(planSku, scrapeMode);

  return (
    <div className="subscriptions-plan-summary-wrap">
      {trial ? (
        <span className="subscriptions-trial-badge" title="Trial: City Clerk links only, no scrape">
          Trial
        </span>
      ) : null}
      <dl className="subscriptions-plan-summary">
        <div>
          <dt>Plan</dt>
          <dd>{planSku ?? "—"}</dd>
        </div>
        <div>
          <dt>Scrape mode</dt>
          <dd>
            <code>{scrapeMode}</code>
          </dd>
        </div>
        <div>
          <dt>District limit</dt>
          <dd>{maxDistricts}</dd>
        </div>
        <div>
          <dt>Monthly scrape quota</dt>
          <dd>{quota}</dd>
        </div>
      </dl>
    </div>
  );
}
