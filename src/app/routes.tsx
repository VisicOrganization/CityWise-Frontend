import { Route, Routes } from "react-router-dom";

import { AboutPage } from "../features/about/AboutPage";
import { DistrictOverviewPage } from "../features/districts/DistrictOverviewPage";
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
    </Routes>
  );
}
