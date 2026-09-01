const ALL_DISTRICTS = Array.from({ length: 15 }, (_, index) => index + 1);

type DistrictSidePanelProps = {
  selectedDistrictId: number;
  subscribedDistrictIds: number[];
  onSelect: (districtId: number) => void;
};

export function DistrictSidePanel({
  selectedDistrictId,
  subscribedDistrictIds,
  onSelect,
}: DistrictSidePanelProps) {
  const subscribed = new Set(subscribedDistrictIds);

  return (
    <aside className="subscriptions-district-panel" aria-label="Council districts">
      <h2>Districts</h2>
      <p className="subscriptions-muted">
        Subscribed districts are selectable. Others stay locked until you upgrade.
      </p>
      <ul className="subscriptions-district-list">
        {ALL_DISTRICTS.map((districtId) => {
          const enabled = subscribed.has(districtId);
          const isActive = districtId === selectedDistrictId;
          return (
            <li key={districtId}>
              <button
                type="button"
                className={`subscriptions-district-list-btn${isActive ? " is-active" : ""}${
                  enabled ? "" : " is-disabled"
                }`}
                disabled={!enabled}
                aria-pressed={isActive}
                onClick={() => onSelect(districtId)}
              >
                District {districtId}
                {!enabled ? <span className="subscriptions-muted"> Locked</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
