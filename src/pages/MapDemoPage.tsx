import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AppShell } from "../components/shell/AppShell";
import { CityDemoMap } from "../components/map/CityDemoMap";
import { buildDemoMarkerFromSearch, searchDemoAddresses, type DemoGeocodeResult } from "../lib/mock/demoGeocoding";
import { demoMapMarkers, type DemoMapMarker } from "../lib/mock/mapDemo";


export function MapDemoPage() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<DemoGeocodeResult[]>([]);
  const [markers, setMarkers] = useState<DemoMapMarker[]>(demoMapMarkers);

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

  return (
    <AppShell className="map-demo-shell">
      <section className="map-demo-screen">
        <CityDemoMap
          markers={markers}
          searchQuery={searchQuery}
          searchResults={results.map((result) => result.label)}
          onSearchChange={setSearchQuery}
          onSearchSubmit={() => {
            void handleSearchSubmit();
          }}
          onSelectResult={handleSelectResult}
        />
      </section>
    </AppShell>
  );
}
