import { Route, Routes } from "react-router-dom";

import { AboutPage } from "../features/about/AboutPage";
import { DistrictOverviewPage } from "../features/districts/DistrictOverviewPage";
import { LandingPage } from "../features/landing/LandingPage";
import { MapDemoPage } from "../features/map-demo/MapDemoPage";


export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/map" element={<MapDemoPage />} />
      <Route path="/districts/:districtId" element={<DistrictOverviewPage />} />
    </Routes>
  );
}
