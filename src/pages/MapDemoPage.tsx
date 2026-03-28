import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AppShell } from "../components/shell/AppShell";
import { CityDemoMap } from "../components/map/CityDemoMap";
import { ProjectDetailsPanel } from "../components/panels/ProjectDetailsPanel";
import { getDistrictProjects, getProjectDetail } from "../lib/api";
import type { DistrictProjectCard, ProjectDetail } from "../lib/contracts";
import { loadDistrictBoundaries, type DistrictBoundaryCollection } from "../lib/districtBoundaries";
import { buildProjectMarkers } from "../lib/map/projectMarkers";
import { buildDemoMarkerFromSearch, searchDemoAddresses, type DemoGeocodeResult } from "../lib/mock/demoGeocoding";
import type { DemoMapMarker } from "../lib/mock/mapDemo";


const DISTRICT_IDS = Array.from({ length: 15 }, (_, index) => index + 1);
const DEMO_PROJECT_PAGE_SIZE = 100;

async function loadDistrictProjectCards(districtId: number): Promise<DistrictProjectCard[]> {
  const firstPage = await getDistrictProjects(districtId, 1, DEMO_PROJECT_PAGE_SIZE);
  if (firstPage.total_pages <= 1) {
    return firstPage.items;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.total_pages - 1 }, (_, index) =>
      getDistrictProjects(districtId, index + 2, DEMO_PROJECT_PAGE_SIZE),
    ),
  );

  return [firstPage, ...remainingPages].flatMap((page) => page.items);
}

async function loadAllProjectCards(): Promise<DistrictProjectCard[]> {
  const districtPages = await Promise.all(
    DISTRICT_IDS.map(async (districtId) => {
      try {
        return await loadDistrictProjectCards(districtId);
      } catch {
        return [];
      }
    }),
  );

  return districtPages.flat();
}


export function MapDemoPage() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<DemoGeocodeResult[]>([]);
  const [boundaries, setBoundaries] = useState<DistrictBoundaryCollection | null>(null);
  const [projectCards, setProjectCards] = useState<DistrictProjectCard[]>([]);
  const [projectMarkers, setProjectMarkers] = useState<DemoMapMarker[]>([]);
  const [searchMarker, setSearchMarker] = useState<DemoMapMarker | null>(null);
  const [activeMarker, setActiveMarker] = useState<DemoMapMarker | null>(null);
  const [activeDistrictId, setActiveDistrictId] = useState(12);
  const [activeProject, setActiveProject] = useState<ProjectDetail | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  useEffect(() => {
    let ignore = false;

    Promise.all([loadDistrictBoundaries(), loadAllProjectCards()])
      .then(([loadedBoundaries, loadedProjectCards]) => {
        if (ignore) {
          return;
        }

        setBoundaries(loadedBoundaries);
        setProjectCards(loadedProjectCards);
        setProjectMarkers(buildProjectMarkers(loadedBoundaries, loadedProjectCards));
      })
      .catch(() => {
        if (!ignore) {
          setBoundaries(null);
          setProjectCards([]);
          setProjectMarkers([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

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
    if (marker.districtId) {
      setActiveDistrictId(marker.districtId);
    }
    setActiveProject(null);
    setDetailsError(null);
    setIsDetailsLoading(true);

    try {
      if (marker.kind === "project" && marker.projectId) {
        const detail = await getProjectDetail(marker.projectId);
        setActiveProject(detail);
        return;
      }

      if (projectCards.length === 0) {
        throw new Error("No demo projects were returned by the backend.");
      }

      const randomIndex = Math.floor(Math.random() * projectCards.length);
      const selectedProject = projectCards[randomIndex] ?? projectCards[0];
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
