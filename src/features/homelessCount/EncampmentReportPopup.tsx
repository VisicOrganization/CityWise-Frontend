import { useState } from "react";

/**
 * Click card for the 311 encampment reports stacked at one map point (see
 * `reportsAtClickedPoint`). Every field was already normalized by
 * `scripts/build_encampment_reports.py`, so this only formats — it never cleans.
 *
 * Location fields (address, council, ZIP, planning area, LAPD area) are read once off the newest
 * report: they describe the point, and every report at one coordinate shares them. The per-report
 * list below carries only what actually varies between reports at the same spot.
 *
 * `readText` is copied from `ShelterDetailPopup` rather than shared, the same call that file makes.
 */
export interface EncampmentReportPopupProps {
  /** Newest first, as returned by `reportsAtClickedPoint`. */
  reports: Record<string, unknown>[];
}

/** Enough to cover the common case at a glance; the 48-report stack gets a "show all" instead. */
const INITIAL_VISIBLE_REPORTS = 5;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * "2026-09-21T21:39:16.000" → "Sep 21, 2026, 9:39 PM".
 *
 * The export's timestamps carry no offset — they are LA wall-clock time. Parsing them with
 * `new Date()` would read them in the *viewer's* timezone and shift them for anyone outside
 * Pacific time, so the parts are read straight off the string instead. Returns "" for anything
 * that isn't that shape.
 */
export function formatReportTimestamp(value: unknown): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(readText(value));
  if (!match) {
    return "";
  }
  const [, year, month, day, hour, minute] = match;
  const hour24 = Number(hour);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const meridiem = hour24 < 12 ? "AM" : "PM";
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}, ${hour12}:${minute} ${meridiem}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  if (!value) {
    return null;
  }
  return (
    <div className="homeless-count-report-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function EncampmentReportPopup({ reports }: EncampmentReportPopupProps) {
  const [showAll, setShowAll] = useState(false);
  const location = reports[0] ?? {};
  const place = readText(location.place);
  const address = readText(location.address);
  const visible = showAll ? reports : reports.slice(0, INITIAL_VISIBLE_REPORTS);

  return (
    <div className="homeless-count-popup">
      <h2 className="homeless-count-popup-title">{place || address || "311 encampment report"}</h2>
      {place && address ? <p className="homeless-count-report-subtitle">{address}</p> : null}
      <p className="homeless-count-report-subtitle">
        {reports.length === 1 ? "1 report at this location" : `${reports.length} reports at this location`}
      </p>

      <dl className="homeless-count-report-location">
        <Stat
          label="Neighborhood council"
          value={readText(location.nc) || "Outside any neighborhood council"}
        />
        <Stat label="ZIP" value={readText(location.zip)} />
        <Stat label="Planning area" value={readText(location.apc)} />
        <Stat label="LAPD area" value={readText(location.lapdArea)} />
      </dl>

      <ol className="homeless-count-report-list">
        {visible.map((report) => {
          const via = readText(report.origin);
          return (
            <li key={readText(report.caseNumber)} className="homeless-count-report">
              <dl>
                <Stat label="Reported" value={formatReportTimestamp(report.created)} />
                {/* Present only where the export's close date differs from its intake time —
                    see the build script; everywhere else it just repeats "Reported". */}
                <Stat label="Closed" value={formatReportTimestamp(report.closed)} />
                <Stat
                  label="Reported via"
                  value={report.anonymous === true ? [via, "anonymous"].filter(Boolean).join(", ") : via}
                />
                <Stat label="Assigned to" value={readText(report.department)} />
                <Stat label="Case #" value={readText(report.caseNumber)} />
              </dl>
            </li>
          );
        })}
      </ol>

      {reports.length > visible.length ? (
        <button type="button" className="homeless-count-report-more" onClick={() => setShowAll(true)}>
          Show all {reports.length} reports
        </button>
      ) : null}

      <p className="homeless-count-popup-footer">MyLA311 encampment reports, 2026. Status: Reported.</p>
    </div>
  );
}
