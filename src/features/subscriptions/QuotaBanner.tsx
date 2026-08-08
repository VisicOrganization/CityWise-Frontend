type QuotaBannerProps = {
  visible: boolean;
};

export function QuotaBanner({ visible }: QuotaBannerProps) {
  if (!visible) {
    return null;
  }

  return (
    <aside className="subscriptions-quota-banner" role="status">
      <div>
        <strong>Monthly scrape quota exhausted</strong>
        <p>You can still open City Clerk links. Upgrade your plan to load more files into CityWise.</p>
      </div>
      <a className="subscriptions-secondary-btn" href="/subscriptions/plans">
        View plans / upgrade
      </a>
    </aside>
  );
}
