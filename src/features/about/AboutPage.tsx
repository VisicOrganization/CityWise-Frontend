import { AppShell } from "../../shared/ui/AppShell";


export function AboutPage() {
  return (
    <AppShell className="about-page-shell">
      <main className="about-page">
        <div className="about-joke-machine" aria-hidden="true">
          <div className="about-orbit about-orbit-one" />
          <div className="about-orbit about-orbit-two" />
          <div className="about-orbit about-orbit-three" />
          <div className="about-core">CityWise</div>
        </div>
      </main>
    </AppShell>
  );
}
