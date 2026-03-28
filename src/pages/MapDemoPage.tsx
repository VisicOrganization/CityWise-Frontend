import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AppShell } from "../components/shell/AppShell";
import { CityDemoMap } from "../components/map/CityDemoMap";
import { ProjectDetailsPanel } from "../components/panels/ProjectDetailsPanel";
import { getDistrictProjects, getProjectDetail } from "../lib/api";
import type { ProjectDetail } from "../lib/contracts";
import { buildDemoMarkerFromSearch, searchDemoAddresses, type DemoGeocodeResult } from "../lib/mock/demoGeocoding";
import { demoMapMarkers, type DemoMapMarker } from "../lib/mock/mapDemo";


const DEMO_PROJECT_SOURCE_DISTRICT_ID = 11;
const DEMO_PROJECT_SOURCE_PAGE_SIZE = 12;


export function MapDemoPage() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<DemoGeocodeResult[]>([]);
  const [markers, setMarkers] = useState<DemoMapMarker[]>(demoMapMarkers);
  const [activeMarker, setActiveMarker] = useState<DemoMapMarker | null>(null);
  const [activeProject, setActiveProject] = useState<ProjectDetail | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  useEffect(() => {
    const incomingQuery = searchParams.get("q") ?? "";
    setSearchQuery(incomingQuery);
    if (incomingQuery) {
      void runSearch(incomingQuery);
    }
  }, [searchParams]);

  async function runSearch(query: string) {
    const nextResults = await searchDemoAddresses(query);
    setResults(nextResults);
    if (nextResults[0]) {
      setMarkers([...demoMapMarkers, buildDemoMarkerFromSearch(nextResults[0], query)]);
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
    setMarkers([...demoMapMarkers, buildDemoMarkerFromSearch(selected, label)]);
  }

  async function handleMarkerSelect(marker: DemoMapMarker) {
    setActiveMarker(marker);
    setActiveProject(null);
    setDetailsError(null);
    setIsDetailsLoading(true);

    try {
      const listing = await getDistrictProjects(DEMO_PROJECT_SOURCE_DISTRICT_ID, 1, DEMO_PROJECT_SOURCE_PAGE_SIZE);
      if (listing.items.length === 0) {
        throw new Error("No demo projects were returned by the backend.");
      }

      const randomIndex = Math.floor(Math.random() * listing.items.length);
      const selectedProject = listing.items[randomIndex] ?? listing.items[0];
      const detail = await getProjectDetail(selectedProject.id);
      setActiveProject(detail);
    } catch {
      setDetailsError("Could not load a live backend project for this marker.");
    } finally {
      setIsDetailsLoading(false);
    }
  }

  return (
    <AppShell className="map-demo-shell">
      <section className="map-demo-screen">
        <CityDemoMap
          markers={markers}
          activeMarkerId={activeMarker?.id ?? null}
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
        />
        {(activeMarker || isDetailsLoading || detailsError) ? (
          <ProjectDetailsPanel
            marker={activeMarker}
            detail={activeProject}
            isLoading={isDetailsLoading}
            errorMessage={detailsError}
            onClose={() => {
              setActiveMarker(null);
              setActiveProject(null);
              setDetailsError(null);
              setIsDetailsLoading(false);
            }}
          />
        ) : null}
      </section>
    </AppShell>
  );
}
