import { Navigate, useParams } from "react-router-dom";

export function DistrictOverviewPage() {
  const params = useParams<{ districtId: string }>();
  const districtId = params.districtId;
  return <Navigate to={districtId ? `/map?districtFocus=${districtId}` : "/map"} replace />;
}
