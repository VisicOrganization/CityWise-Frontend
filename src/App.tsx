import { Route, Routes } from "react-router-dom";

import { DistrictOverviewPage } from "./pages/DistrictOverviewPage";
import { LandingPage } from "./pages/LandingPage";
import { MapDemoPage } from "./pages/MapDemoPage";
import { AboutPage } from "./pages/AboutPage";


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/map" element={<MapDemoPage />} />
      <Route path="/districts/:districtId" element={<DistrictOverviewPage />} />
    </Routes>
  );
}
