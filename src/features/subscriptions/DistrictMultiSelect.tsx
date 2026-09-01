const ALL_DISTRICTS = Array.from({ length: 15 }, (_, index) => index + 1);

type DistrictMultiSelectProps = {
  selected: number[];
  maxDistricts: number;
  disabled?: boolean;
  /** When true (trial), only District 1 can be selected; 2–15 stay grayed. */
  trialLocked?: boolean;
  onChange: (districtIds: number[]) => void;
};

export function DistrictMultiSelect({
  selected,
  maxDistricts,
  disabled = false,
  trialLocked = false,
  onChange,
}: DistrictMultiSelectProps) {
  const selectedSet = new Set(selected);

  function toggle(districtId: number) {
    if (disabled) {
      return;
    }
    if (trialLocked && districtId !== 1) {
      return;
    }
    if (selectedSet.has(districtId)) {
      if (trialLocked && districtId === 1) {
        return;
      }
      onChange(selected.filter((id) => id !== districtId));
      return;
    }
    if (selected.length >= maxDistricts) {
      return;
    }
    onChange([...selected, districtId].sort((a, b) => a - b));
  }

  return (
    <div className="subscriptions-district-grid" role="group" aria-label="Council districts">
      {ALL_DISTRICTS.map((districtId) => {
        const isSelected = selectedSet.has(districtId);
        const lockedByTrial = trialLocked && districtId !== 1;
        const atLimit = !isSelected && selected.length >= maxDistricts;
        return (
          <button
            key={districtId}
            type="button"
            data-testid={`district-chip-${districtId}`}
            className={`subscriptions-district-chip${isSelected ? " is-selected" : ""}${
              lockedByTrial ? " is-locked" : ""
            }`}
            aria-pressed={isSelected}
            disabled={disabled || lockedByTrial || atLimit}
            onClick={() => toggle(districtId)}
          >
            {districtId}
          </button>
        );
      })}
      <p className="subscriptions-muted">
        {trialLocked
          ? "Trial is locked to District 1. Upgrade to unlock more districts."
          : `Selected ${selected.length} of ${maxDistricts} allowed by your plan.`}
      </p>
    </div>
  );
}
