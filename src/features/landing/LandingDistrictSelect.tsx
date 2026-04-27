import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePostHog } from "@posthog/react";

import { loadCouncilMemberBiosMapOnce } from "../districts/useCouncilMemberBios";
import { navigateToMapForDistrictFocus } from "../../shared/map/mapNavigateFromAddressSearch";
import { sortedCouncilRowsFromBios, type CouncilDistrictRow } from "./councilDistrictSearch";

const LANDING_DISTRICT_LISTBOX_ID = "landing-council-district-suggestions";
const SUGGESTIONS_VIEWPORT_BOTTOM_GUTTER = 16;

type PanelLayout = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export function LandingDistrictSelect() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const [rows, setRows] = useState<CouncilDistrictRow[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelLayout, setPanelLayout] = useState<PanelLayout | null>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ignore = false;
    void loadCouncilMemberBiosMapOnce()
      .then((map) => {
        if (!ignore) {
          setRows(sortedCouncilRowsFromBios(map));
          setLoadError(false);
          setIsReady(true);
        }
      })
      .catch(() => {
        if (!ignore) {
          setLoadError(true);
          setIsReady(true);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (!panelOpen) {
      setPanelLayout(null);
      return undefined;
    }

    const updateLayout = () => {
      const el = blockRef.current;
      if (!el) {
        return;
      }
      const r = el.getBoundingClientRect();
      const top = r.bottom + 6;
      const maxHeight = Math.max(
        120,
        window.innerHeight - top - SUGGESTIONS_VIEWPORT_BOTTOM_GUTTER,
      );
      setPanelLayout({
        top,
        left: r.left,
        width: r.width,
        maxHeight,
      });
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", updateLayout);
    vv?.addEventListener("scroll", updateLayout);
    return () => {
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
      vv?.removeEventListener("resize", updateLayout);
      vv?.removeEventListener("scroll", updateLayout);
    };
  }, [panelOpen, rows.length]);

  useEffect(() => {
    if (!panelOpen) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanelOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      const t = event.target;
      if (!(t instanceof Node)) {
        return;
      }
      if (blockRef.current?.contains(t) || listRef.current?.contains(t)) {
        return;
      }
      setPanelOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown, true);
    };
  }, [panelOpen]);

  const triggerDisabled = !isReady || loadError || rows.length === 0;

  function goToRow(row: CouncilDistrictRow) {
    posthog?.capture("landing_district_selected", { district_id: row.districtId, label: row.focusLabel });
    setPanelOpen(false);
    void navigateToMapForDistrictFocus(navigate, { districtId: row.districtId, focusLabel: row.focusLabel });
  }

  return (
    <div ref={blockRef} className="landing-district-pick">
      <div className="landing-district-pick-trigger-wrap">
        <button
          ref={triggerRef}
          type="button"
          className="landing-district-pick-trigger"
          aria-expanded={panelOpen}
          aria-controls={panelOpen ? LANDING_DISTRICT_LISTBOX_ID : undefined}
          aria-haspopup="listbox"
          disabled={triggerDisabled}
          onClick={() => {
            if (!triggerDisabled) {
              setPanelOpen((open) => !open);
            }
          }}
        >
          Search by Council District
        </button>
      </div>
      {loadError ? (
        <p className="landing-district-pick-error" role="alert">
          Council directory is unavailable. Please try again later.
        </p>
      ) : null}
      {panelOpen && panelLayout && !loadError
        ? createPortal(
            <div
              ref={listRef}
              id={LANDING_DISTRICT_LISTBOX_ID}
              className="landing-district-pick-list landing-search-results landing-search-results--overlay"
              role="listbox"
              aria-label="Council districts"
              style={{
                position: "fixed",
                top: panelLayout.top,
                left: panelLayout.left,
                width: panelLayout.width,
                maxHeight: panelLayout.maxHeight,
              }}
            >
              {rows.map((row) => (
                <button
                  key={row.districtId}
                  type="button"
                  role="option"
                  className="landing-search-result-hit landing-district-pick-option"
                  aria-label={`${row.nameLine}, ${row.districtLine}`}
                  onClick={() => {
                    goToRow(row);
                  }}
                >
                  <span className="landing-search-result-line1 landing-district-pick-line-primary">
                    {row.nameLine}
                  </span>
                  <span className="landing-search-result-line2">{row.districtLine}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
