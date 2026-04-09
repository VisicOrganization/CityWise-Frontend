import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { DistrictOverviewSheet } from "../districts/DistrictOverviewSheet";
import type { GeocodeSearchResult } from "../../shared/map/geocodeSearch";
import { buildSearchMarker, searchAddresses } from "../../shared/map/geocodeSearch";
import type { MapMarker } from "../../shared/map/mapTypes";
import { AppShell } from "../../shared/ui/AppShell";
import { CityMap } from "./CityMap";
import { ProjectDetailsPanel } from "./ProjectDetailsPanel";
import { useMapData } from "./useMapData";
import { useProjectDetail } from "./useProjectDetail";


export function MapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<GeocodeSearchResult[]>([]);
  const [searchMarker, setSearchMarker] = useState<MapMarker | null>(null);
  const [activeMarker, setActiveMarker] = useState<MapMarker | null>(null);
  const [activeDistrictId, setActiveDistrictId] = useState<number | null>(null);
  const districtFocusId = useMemo(() => {
    const districtFocusValue = searchParams.get("districtFocus");
    if (!districtFocusValue) {
      return null;
    }

    const parsed = Number(districtFocusValue);
    return Number.isNaN(parsed) ? null : parsed;
  }, [searchParams]);
  const districtProfileIntent = searchParams.get("showDistrictProfile");
  const shouldShowDistrictProfile = districtFocusId !== null && districtProfileIntent !== "0";
  const { boundaries, projectCards, projectMarkers } = useMapData();
  const {
    activeProject,
    detailsError,
    isDetailsLoading,
    loadProjectForMarker,
    resetProjectDetail,
  } = useProjectDetail();

  useEffect(() => {
    const incomingQuery = searchParams.get("q") ?? "";
    setSearchQuery(incomingQuery);
  }, [searchParams]);

  useEffect(() => {
    if (districtFocusId) {
      setActiveDistrictId(districtFocusId);
    }
  }, [districtFocusId]);

  useEffect(() => {
    let ignore = false;

    if (!searchQuery.trim()) {
      setResults([]);
      setSearchMarker(null);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void searchAddresses(searchQuery)
        .then((nextResults) => {
          if (ignore) {
            return;
          }

          setResults(nextResults);
          setSearchMarker(nextResults[0] ? buildSearchMarker(nextResults[0], searchQuery) : null);
        })
        .catch(() => {
          if (!ignore) {
            setResults([]);
            setSearchMarker(null);
          }
        });
    }, 180);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  async function runSearch(query: string) {
    const nextResults = await searchAddresses(query);
    setResults(nextResults);
    if (nextResults[0]) {
      setSearchMarker(buildSearchMarker(nextResults[0], query));
    } else {
      setSearchMarker(null);
    }
  }

  async function handleSearchSubmit() {
    try {
      await runSearch(searchQuery);
    } catch {
      setResults([]);
    }
  }

  function handleSelectResult(label: string) {
    const selected = results.find((result) => result.label === label);
    if (!selected) {
      return;
    }

    setSearchQuery(label);
    setSearchMarker(buildSearchMarker(selected, label));
  }

  async function handleMarkerSelect(marker: MapMarker) {
    setActiveMarker(marker);
    setActiveDistrictId(marker.districtId);
    await loadProjectForMarker(marker, projectCards);
  }

  function handleMapBackgroundClick() {
    setActiveMarker(null);
    resetProjectDetail();
  }

  function setDistrictFocus(districtId: number | null, shouldOpenProfile = districtId !== null) {
    const nextParams = new URLSearchParams(searchParams);
    if (districtId === null) {
      nextParams.delete("districtFocus");
      nextParams.delete("showDistrictProfile");
    } else {
      nextParams.set("districtFocus", String(districtId));
      nextParams.set("showDistrictProfile", shouldOpenProfile ? "1" : "0");
    }

    setSearchParams(nextParams, { replace: true });
  }

  function openDistrictOverview(districtId: number) {
    setActiveMarker(null);
    resetProjectDetail();
    setDistrictFocus(districtId);
  }

  return (
    <AppShell className="map-demo-shell">
      <section className="map-demo-screen">
        <CityMap
          boundaries={boundaries}
          markers={searchMarker ? [...projectMarkers, searchMarker] : projectMarkers}
          activeMarkerId={activeMarker?.id ?? null}
          activeDistrictId={activeDistrictId}
          searchQuery={searchQuery}
          searchResults={results.map((result) => result.label)}
          onSearchChange={setSearchQuery}
          onSearchSubmit={() => {
            void handleSearchSubmit();
          }}
          onSelectResult={handleSelectResult}
          onMarkerSelect={(marker) => {
            void handleMarkerSelect(marker);
          }}
          onMapBackgroundClick={handleMapBackgroundClick}
          onOpenDistrictOverview={(districtId) => {
            openDistrictOverview(districtId);
          }}
          onDistrictSelect={(districtId) => {
            setActiveDistrictId(districtId);
          }}
        />
        {(activeMarker || isDetailsLoading || detailsError) ? (
          <ProjectDetailsPanel
            marker={activeMarker}
            detail={activeProject}
            isLoading={isDetailsLoading}
            errorMessage={detailsError}
          />
        ) : null}
        {(districtFocusId && shouldShowDistrictProfile) ? (
          <>
            <button
              type="button"
              className="district-sheet-dismiss-layer"
              aria-label="Close district overview"
              onClick={() => setDistrictFocus(districtFocusId, false)}
            />
            <DistrictOverviewSheet districtId={districtFocusId} onOpenMap={() => setDistrictFocus(districtFocusId, false)} />
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
