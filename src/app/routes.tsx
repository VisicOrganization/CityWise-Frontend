import { Route, Routes } from "react-router-dom";

import { AboutPage } from "../features/about/AboutPage";
import { DistrictOverviewPage } from "../features/districts/DistrictOverviewPage";
import { EmbedBuilderPage } from "../features/embed/EmbedBuilderPage";
import { EmbedPage } from "../features/embed/EmbedPage";
import { HomelessCountPage } from "../features/homelessCount/HomelessCountPage";
import { LandingPage } from "../features/landing/LandingPage";
import { MapPage } from "../features/map/MapPage";


export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/homeless-count" element={<HomelessCountPage />} />
      <Route path="/districts/:districtId" element={<DistrictOverviewPage />} />
      {/* Literal "builder" must be declared before the ":districtSlug" embed route below, or
          react-router would match "builder" as a district slug instead. */}
      <Route path="/embed/v1/builder" element={<EmbedBuilderPage />} />
      <Route path="/embed/v1/:districtSlug/:neighborhoodSlug?" element={<EmbedPage />} />
    </Routes>
  );
}
