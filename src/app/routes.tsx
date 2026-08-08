import { Route, Routes } from "react-router-dom";

import { AboutPage } from "../features/about/AboutPage";
import { DistrictOverviewPage } from "../features/districts/DistrictOverviewPage";
import { LandingPage } from "../features/landing/LandingPage";
import { MapPage } from "../features/map/MapPage";
import { NewFilesPage } from "../features/subscriptions/NewFilesPage";
import { PlanCatalogPage } from "../features/subscriptions/PlanCatalogPage";
import { SubscriptionSettingsPage } from "../features/subscriptions/SubscriptionSettingsPage";
import { RequireAuth } from "../shared/auth/RequireAuth";


export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/districts/:districtId" element={<DistrictOverviewPage />} />
      <Route
        path="/new-files"
        element={
          <RequireAuth>
            <NewFilesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/subscriptions/settings"
        element={
          <RequireAuth>
            <SubscriptionSettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/subscriptions/plans"
        element={
          <RequireAuth>
            <PlanCatalogPage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
