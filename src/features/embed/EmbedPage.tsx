import { useMemo, type ReactNode } from "react";
import { useParams } from "react-router-dom";

import {
  csaLabelFromSlug,
  getDistrictAssetSource,
  getPanelSourceUrl,
  selectAllAssets,
  selectNeighborhoodAssets,
  shortNeighborhoodName,
  useDistrictAssetsState,
  type PanelAsset,
} from "../map/cd2Assets";
import { EmbedMap } from "./EmbedMap";
import { EmbedResourceList } from "./EmbedResourceList";
import { isKnownDistrict, parseDistrictId } from "./embedRouting";
import { polygonBounds } from "./neighborhoodBounds";
import { useEmbedBoundary } from "./embedBoundary";
import { useEmbedProjects } from "./embedProjects";

/**
 * `/embed/v1/:districtSlug/:neighborhoodSlug?` -- the chromeless map+list page a council office
 * drops into an iframe. No app shell: `App.tsx` renders `<AppRoutes/>` with nothing wrapping it,
 * so as long as this component itself renders no nav/header/footer, the page is bare by
 * construction.
 *
 * Every hook below runs unconditionally (rules of hooks); each one is individually gated with
 * an `enabled` flag so an unknown-district or unknown-neighbourhood render still costs at most
 * the one `cd2-neighborhoods.geojson`/`cd2-civic-assets.geojson` fetch pair needed to tell
 * "unknown" from "still loading", and never fetches the optional boundary/projects files at all.
 */
function formatAsOfDate(iso: string): string | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function EmbedShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-slate-100 p-2 sm:p-3">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {children}
      </div>
    </div>
  );
}

function EmbedMessage({ heading, body }: { heading: string; body: string }) {
  return (
    <EmbedShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center">
        <h1 className="text-base font-semibold text-slate-800">{heading}</h1>
        <p className="max-w-sm text-sm text-slate-500">{body}</p>
      </div>
    </EmbedShell>
  );
}

export function EmbedPage() {
  const { districtSlug, neighborhoodSlug } = useParams<{
    districtSlug: string;
    neighborhoodSlug?: string;
  }>();

  const districtId = useMemo(() => parseDistrictId(districtSlug), [districtSlug]);
  const districtKnown = isKnownDistrict(districtId);
  const source = districtKnown && districtId !== null ? getDistrictAssetSource(districtId) : null;

  const assetsState = useDistrictAssetsState(districtId ?? -1, districtKnown);
  const loaded = assetsState.status === "ready" ? assetsState.loaded : null;

  const csaLabel = useMemo(() => {
    if (!neighborhoodSlug || !loaded) {
      return null;
    }
    return csaLabelFromSlug(neighborhoodSlug, loaded.neighborhoods);
  }, [neighborhoodSlug, loaded]);

  const isDistrictView = !neighborhoodSlug;
  const neighborhoodUnresolved = Boolean(neighborhoodSlug) && loaded !== null && csaLabel === null;

  // Only the district-wide view shows project pins, per spec -- gated so a neighbourhood embed
  // never fetches the snapshot at all.
  const projectsPayload = useEmbedProjects(districtKnown && isDistrictView);
  const boundary = useEmbedBoundary(districtId ?? -1, districtKnown);

  if (!districtKnown || districtId === null || !source) {
    return (
      <EmbedMessage
        heading="Map not available"
        body="This map isn't set up for the requested council district yet."
      />
    );
  }

  // A failed fetch must not read as a slow one. This renders unattended inside a government
  // page; a spinner that never resolves is the one failure nobody would ever be told about.
  if (assetsState.status === "error") {
    return (
      <EmbedMessage
        heading="Resources unavailable"
        body="We couldn't load this neighborhood's resources just now. Please reload the page."
      />
    );
  }

  if (!loaded) {
    return (
      <EmbedShell>
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-slate-500">Loading neighborhood resources…</p>
        </div>
      </EmbedShell>
    );
  }

  if (neighborhoodUnresolved) {
    return (
      <EmbedMessage
        heading="Neighborhood not found"
        body={`We couldn't find that neighborhood in Council District ${districtId}. Check the link and try again.`}
      />
    );
  }

  const selection = csaLabel
    ? ({ kind: "neighborhood", csaLabel } as const)
    : ({ kind: "district" } as const);

  const panelAssets: PanelAsset[] = csaLabel
    ? selectNeighborhoodAssets(loaded.assets, csaLabel)
    : selectAllAssets(loaded.assets);

  const bounds = csaLabel
    ? (() => {
        const feature = loaded.neighborhoods.features.find(
          (item) => item.properties?.CSA_Label === csaLabel,
        );
        return (feature ? polygonBounds(feature) : null) ?? source.bounds;
      })()
    : source.bounds;

  const title = csaLabel ? shortNeighborhoodName(csaLabel) : `Council District ${districtId}`;
  const heading = `${title} resources`;
  const sourceUrl = getPanelSourceUrl(loaded.neighborhoods, selection);
  const asOf = projectsPayload ? formatAsOfDate(projectsPayload.generatedAt) : null;
  // Force a remount (and a fresh `initialViewState.bounds` fit) whenever the resolved target
  // changes, rather than trying to imperatively re-fit an existing map instance.
  const mapKey = csaLabel ?? `district-${districtId}`;

  return (
    <EmbedShell>
      <h1 className="sr-only">{heading}</h1>
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* `order` rather than DOM order: the list reads first on desktop (left column), while on
            a narrow screen the map still comes first, so a phone user sees the map before
            scrolling a long list. */}
        <div className="flex h-64 flex-none flex-col border-b border-slate-200 md:order-2 md:h-auto md:w-[60%] md:flex-none md:border-b-0 md:border-l md:border-t-0">
          <div className="min-h-0 flex-1">
            <EmbedMap
              key={mapKey}
              assets={loaded.assets}
              neighborhoods={loaded.neighborhoods}
              districtBoundary={boundary}
              districtId={districtId}
              bounds={bounds}
              ariaLabel={`Map of ${heading}`}
              projects={isDistrictView ? (projectsPayload?.projects ?? null) : null}
            />
          </div>
          {asOf ? (
            <p className="flex-none border-t border-slate-100 px-3 py-1 text-xs text-slate-400">
              Project locations as of {asOf}.
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto md:order-1">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {csaLabel ? "Neighborhood" : `Council District ${districtId}`}
            </p>
            <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          </div>
          <EmbedResourceList
            assets={panelAssets}
            emptyMessage={`No resources are listed for ${title} yet.`}
          />
        </div>
      </main>

      <footer className="flex-none border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
        Source:{" "}
        {sourceUrl ? (
          <a className="underline" href={sourceUrl} target="_blank" rel="noreferrer noopener">
            Council District {districtId}
          </a>
        ) : (
          <span>Council District {districtId} (source page not provided)</span>
        )}
      </footer>
    </EmbedShell>
  );
}
