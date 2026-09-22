import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import {
  selectPanelAssets,
  shortNeighborhoodName,
  type AssetCollection,
  type AssetProperties,
  type PanelAsset,
  type PanelSelection,
} from "./cd2Assets";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "./neighborhoodMapLayers";
import { ASSET_PIN_SOURCES, pinImageUrl } from "./assetPinImages";

/**
 * Left-hand slide-in for whatever the user just clicked: one neighbourhood's resources, or the
 * the district-wide items (those the sheet never categorised).
 *
 * One component for both because everything below the header is identical -- the cards, the
 * grouping, the scroll-to-and-flash, the dock, the close. The two differ only in which pins
 * they select and what the header says, so `selection` carries that and nothing forks.
 *
 * Deliberately the same dock geometry and slide as `ProjectDetailsPanel` (`.project-sidebar-host`
 * / `project-sidebar-enter-from-left`) rather than a new placement -- on this map the left edge
 * already means "detail about the thing you just clicked", and a second convention would make
 * the two read as unrelated surfaces.
 *
 * Presentational and fetch-free: every field is already on the GeoJSON feature that the overlay
 * loaded, so opening the panel costs no request.
 */

/** How long a scrolled-to card stays green. */
export const ASSET_FLASH_MS = 1000;

/**
 * A request to scroll to one card and flash it.
 *
 * `nonce` exists so clicking the same pin twice re-runs the effect: `key` alone would be
 * unchanged and React would skip it, leaving the second click with no feedback.
 */
export interface AssetFocus {
  key: string;
  nonce: number;
}

export interface ResourceDetailPanelProps {
  selection: PanelSelection;
  assets: AssetCollection;
  /** Set when the panel was opened by a pin click rather than a neighbourhood click. */
  focus?: AssetFocus | null;
  /** The CD2 page this panel's rows came from, from the sheet's `source_url` column. */
  sourceUrl?: string | null;
  districtId: number;
  /** Move the map to this card's pin and select it. */
  onSelectAsset?: (asset: PanelAsset) => void;
  onClose: () => void;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Strips the scheme so a long URL reads as a domain rather than wrapping over three lines. */
function linkText(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function prefersReducedMotion(): boolean {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

export function ResourceDetailPanel({
  selection,
  assets,
  focus = null,
  sourceUrl = null,
  districtId,
  onSelectAsset,
  onClose,
}: ResourceDetailPanelProps) {
  const isDistrict = selection.kind === "district";
  /**
   * NOT "District Overview": that name already belongs to `DistrictOverviewSheet`, the council
   * district profile this same map opens from its district pill (`CityMap.tsx`, "District
   * Overview" button). Two different surfaces under one name on one page is a bug in the words.
   */
  const title = isDistrict ? "District-wide resources" : shortNeighborhoodName(selection.csaLabel);
  // The heading already says "resources" in the district case; appending it again would make the
  // accessible name "District-wide resources resources".
  const accessibleName = isDistrict ? title : `${title} resources`;
  const eyebrow = isDistrict ? `Council District ${districtId}` : "Neighborhood";

  // Grouped in the legend's fixed category order so the panel's sections and the map's colour
  // key are always in the same sequence. Empty categories are dropped, not rendered blank.
  const groups = useMemo(() => {
    const selected = selectPanelAssets(assets, selection);
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: selected.filter((item) => item.properties.category === category),
    })).filter((group) => group.items.length > 0);
  }, [assets, selection]);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLLIElement>());
  const [flashKey, setFlashKey] = useState<string | null>(null);

  // Runs on the render after the panel has switched to the clicked pin's selection, so the card
  // is mounted and its ref registered by the time this fires.
  useEffect(() => {
    if (!focus) {
      setFlashKey(null);
      return;
    }
    const node = cardRefs.current.get(focus.key);
    if (!node) {
      return;
    }
    // Guarded because jsdom does not implement it -- the same check ScopedChatPanel makes.
    if (typeof node.scrollIntoView === "function") {
      node.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "center",
      });
    }
    setFlashKey(focus.key);
    const timer = window.setTimeout(() => setFlashKey(null), ASSET_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [focus?.key, focus?.nonce, groups]);

  return (
    <div className="neighborhood-detail-host">
      <aside className="neighborhood-detail-panel" aria-label={accessibleName}>
        <header className="neighborhood-detail-header">
          <div className="neighborhood-detail-header-row">
            <div>
              <p className="neighborhood-detail-eyebrow">{eyebrow}</p>
              <h2 className="neighborhood-detail-title">{title}</h2>
            </div>
            <button
              type="button"
              className="neighborhood-detail-close"
              aria-label={`Close ${title} panel`}
              onClick={onClose}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <p className="neighborhood-detail-count">
            {total} {total === 1 ? "resource" : "resources"}
            {isDistrict ? " across the district" : " serving this neighborhood"}
          </p>

          {/* The page every row in this panel was transcribed from, so a reader can check the
              card against the city's own listing. Falls back to a labelled blank rather than
              disappearing, so a missing `source_url` is visible instead of silent. */}
          <p className="neighborhood-detail-page-link">
            <span className="neighborhood-detail-page-link-label">
              {isDistrict ? "District page" : "Neighborhood page"}
            </span>
            {sourceUrl ? (
              <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
                {linkText(sourceUrl)}
              </a>
            ) : (
              <span className="neighborhood-detail-page-link-empty">Not provided</span>
            )}
          </p>

          {isDistrict ? (
            // Says out loud what the category actually is, because the name does not: these are
            // the rows whose `category` cell was blank, not a bucket the city defined.
            <p className="neighborhood-detail-note">
              District-level items that are not tied to a single neighborhood.
            </p>
          ) : null}
        </header>

        <div className="neighborhood-detail-scroll" ref={scrollRef}>
          {groups.length === 0 ? (
            <p className="neighborhood-detail-empty">
              No resources are listed for this {isDistrict ? "district" : "neighborhood"} yet.
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.category} className="neighborhood-detail-group">
                {/* A single-group panel (the district-wide one always is) would otherwise
                    carry a heading that just repeats its own title. */}
                {groups.length > 1 ? (
                  <h3 className="neighborhood-detail-group-title">
                    {/* The same pin the map draws, so a heading and its pins are one mark. */}
                    <img
                      className="neighborhood-detail-group-icon"
                      src={pinImageUrl(ASSET_PIN_SOURCES[group.category])}
                      alt=""
                      width={16}
                      height={16}
                    />
                    {CATEGORY_LABELS[group.category] ?? group.category}
                    <span className="neighborhood-detail-group-count">{group.items.length}</span>
                  </h3>
                ) : null}
                <ul className="neighborhood-detail-cards">
                  {group.items.map((item) => (
                    <ResourceCard
                      key={item.key}
                      item={item}
                      isFlashing={flashKey === item.key}
                      onSelect={onSelectAsset}
                      registerRef={(node) => {
                        if (node) {
                          cardRefs.current.set(item.key, node);
                        } else {
                          cardRefs.current.delete(item.key);
                        }
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

/**
 * One resource card. Fields render only when present, the same rule the click popup follows:
 * across the 81 source rows `email` is filled on 11 and `meeting_information` on 14, so a fixed
 * layout would be mostly empty labels.
 */
export function ResourceCard({
  item,
  isFlashing,
  onSelect,
  registerRef,
}: {
  item: PanelAsset;
  isFlashing: boolean;
  onSelect?: (asset: PanelAsset) => void;
  registerRef: (node: HTMLLIElement | null) => void;
}) {
  const properties: Partial<AssetProperties> = item.properties;
  const label = readText(properties.label) || "Unnamed location";
  const address = readText(properties.address);
  const phone = readText(properties.phone);
  const email = readText(properties.email);
  const meeting = readText(properties.meeting_information);
  const website = readText(properties.website);

  // Mouse affordance on the whole card, keyboard affordance on the title button below.
  // The <li> is not itself interactive markup, which is what keeps the phone/email/website
  // links legal -- a <button> wrapping them would be nested interactive content.
  function handleCardClick(event: MouseEvent<HTMLLIElement>) {
    if (!onSelect) {
      return;
    }
    // A click that was really aimed at tel:/mailto:/the website must not also move the map.
    if ((event.target as HTMLElement).closest("a")) {
      return;
    }
    onSelect(item);
  }

  return (
    <li
      ref={registerRef}
      data-asset-key={item.key}
      className={`neighborhood-detail-card${isFlashing ? " is-flashing" : ""}${
        onSelect ? " is-selectable" : ""
      }`}
      onClick={handleCardClick}
    >
      <h4 className="neighborhood-detail-card-title">
        {onSelect ? (
          // No onClick of its own: pressing Enter or Space on a <button> dispatches a click
          // that bubbles to the card's handler, so one handler serves both paths. Giving the
          // button its own would fire the action twice for every click on the title.
          <button
            type="button"
            className="neighborhood-detail-card-title-btn"
            aria-label={`Show ${label} on the map`}
          >
            {label}
          </button>
        ) : (
          label
        )}
      </h4>
      {address ? <p className="neighborhood-detail-card-address">{address}</p> : null}

      <dl className="neighborhood-detail-card-fields">
        {phone ? (
          <div>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>
            </dd>
          </div>
        ) : null}
        {email ? (
          <div>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${email}`}>{email}</a>
            </dd>
          </div>
        ) : null}
        {meeting ? (
          <div>
            <dt>Meetings</dt>
            <dd>{meeting}</dd>
          </div>
        ) : null}
        {website ? (
          <div>
            <dt>Website</dt>
            <dd>
              <a href={website} target="_blank" rel="noreferrer noopener">
                {linkText(website)}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
    </li>
  );
}
