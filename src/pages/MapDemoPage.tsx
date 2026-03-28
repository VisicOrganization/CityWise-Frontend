import { AppShell } from "../components/shell/AppShell";
import { CityDemoMap } from "../components/map/CityDemoMap";


export function MapDemoPage() {
  return (
    <AppShell className="map-demo-shell">
      <section className="map-demo-screen">
        <CityDemoMap />
      </section>
    </AppShell>
  );
}
