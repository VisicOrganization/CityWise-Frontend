import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { DemoGeocodeResult } from "../../shared/mock/demoGeocoding";
import { buildDemoMarkerFromSearch, searchDemoAddresses } from "../../shared/mock/demoGeocoding";
import type { DemoMapMarker } from "../../shared/mock/mapDemo";
import { AppShell } from "../../shared/ui/AppShell";
import { CityDemoMap } from "./CityDemoMap";
import { ProjectDetailsPanel } from "./ProjectDetailsPanel";
import { useMapDemoData } from "./useMapDemoData";
import { useProjectDetail } from "./useProjectDetail";


export function MapDemoPage() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<DemoGeocodeResult[]>([]);
  const [searchMarker, setSearchMarker] = useState<DemoMapMarker | null>(null);
  const [activeMarker, setActiveMarker] = useState<DemoMapMarker | null>(null);
  const [activeDistrictId, setActiveDistrictId] = useState<number | null>(null);
  const { boundaries, projectCards, projectMarkers } = useMapDemoData();
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
    let ignore = false;

    if (!searchQuery.trim()) {
      setResults([]);
      setSearchMarker(null);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void searchDemoAddresses(searchQuery)
        .then((nextResults) => {
          if (ignore) {
            return;
          }

          setResults(nextResults);
          setSearchMarker(nextResults[0] ? buildDemoMarkerFromSearch(nextResults[0], searchQuery) : null);
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
    const nextResults = await searchDemoAddresses(query);
    setResults(nextResults);
    if (nextResults[0]) {
      setSearchMarker(buildDemoMarkerFromSearch(nextResults[0], query));
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
    setSearchMarker(buildDemoMarkerFromSearch(selected, label));
  }

  async function handleMarkerSelect(marker: DemoMapMarker) {
    setActiveMarker(marker);
    setActiveDistrictId(marker.districtId);
    await loadProjectForMarker(marker, projectCards);
  }

  function handleMapBackgroundClick() {
    setActiveMarker(null);
    resetProjectDetail();
  }

  return (
    <AppShell className="map-demo-shell">
      <section className="map-demo-screen">
        <CityDemoMap
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
      </section>
    </AppShell>
  );
}
