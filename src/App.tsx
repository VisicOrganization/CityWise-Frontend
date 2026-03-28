import { Navigate, Route, Routes } from "react-router-dom";

import { DistrictOverviewPage } from "./pages/DistrictOverviewPage";


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/districts/11" replace />} />
      <Route path="/districts/:districtId" element={<DistrictOverviewPage />} />
    </Routes>
  );
}
