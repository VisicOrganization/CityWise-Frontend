import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { DistrictOverviewSheet } from "../districts/DistrictOverviewSheet";
import type { MapMarker } from "../../shared/map/mapTypes";
import { AppShell } from "../../shared/ui/AppShell";
import { CityMap } from "./CityMap";
import { ProjectDetailsPanel } from "./ProjectDetailsPanel";
import { useMapData } from "./useMapData";
import { useProjectDetail } from "./useProjectDetail";


export function MapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeMarker, setActiveMarker] = useState<MapMarker | null>(null);
  const [activeDistrictId, setActiveDistrictId] = useState<number | null>(null);
  const [isProjectSidebarOpen, setIsProjectSidebarOpen] = useState(true);
  const districtFocusId = useMemo(() => {
    const districtFocusValue = searchParams.get("districtFocus");
    if (!districtFocusValue) {
      return null;
    }

    const parsed = Number(districtFocusValue);
    return Number.isNaN(parsed) ? null : parsed;
  }, [searchParams]);
  const districtProfileIntent = searchParams.get("showDistrictProfile");
  const shouldShowDistrictProfile = districtFocusId !== null && districtProfileIntent !== "0";
  const addressFocusPoint = useMemo(() => {
    const latRaw = searchParams.get("focusLat");
    const lngRaw = searchParams.get("focusLng");
    if (!latRaw || !lngRaw) {
      return null;
    }

    const latitude = Number(latRaw);
    const longitude = Number(lngRaw);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return null;
    }

    return { latitude, longitude };
  }, [searchParams]);
  const districtSheetFocusLabel = searchParams.get("focusLabel")?.trim() || null;
  const { boundaries, projectCards, projectMarkers } = useMapData();

  useEffect(() => {
    if (activeMarker) {
      setIsProjectSidebarOpen(true);
    }
  }, [activeMarker?.id]);
  const {
    activeProject,
    detailsError,
    isDetailsLoading,
    loadProjectForMarker,
    resetProjectDetail,
  } = useProjectDetail();

  useLayoutEffect(() => {
    if (districtFocusId) {
      setActiveDistrictId(districtFocusId);
    }
  }, [districtFocusId]);

  async function handleMarkerSelect(marker: MapMarker) {
    setActiveMarker(marker);
    setActiveDistrictId(marker.districtId);
    setIsProjectSidebarOpen(true);
    await loadProjectForMarker(marker, projectCards);
  }

  function handleMapBackgroundClick() {
    setActiveMarker(null);
    resetProjectDetail();
  }

  function setDistrictFocus(districtId: number | null, shouldOpenProfile = districtId !== null) {
    const nextParams = new URLSearchParams(searchParams);
    if (districtId === null) {
      nextParams.delete("districtFocus");
      nextParams.delete("showDistrictProfile");
    } else {
      nextParams.set("districtFocus", String(districtId));
      nextParams.set("showDistrictProfile", shouldOpenProfile ? "1" : "0");
    }

    setSearchParams(nextParams, { replace: true });
  }

  function openDistrictOverview(districtId: number) {
    setActiveMarker(null);
    resetProjectDetail();
    setDistrictFocus(districtId);
  }

  function handleSelectProjectFromDistrictOverview(projectId: string) {
    const marker = projectMarkers.find((m) => m.kind === "project" && m.projectId === projectId) ?? null;
    if (!marker) {
      return;
    }
    if (districtFocusId !== null) {
      setDistrictFocus(districtFocusId, false);
    }
    void handleMarkerSelect(marker);
  }

  return (
    <AppShell className="map-demo-shell">
      <section className="map-demo-screen">
        <CityMap
          boundaries={boundaries}
          markers={projectMarkers}
          activeMarkerId={activeMarker?.id ?? null}
          activeDistrictId={activeDistrictId}
          addressFocusPoint={addressFocusPoint}
          addressFocusLabel={districtSheetFocusLabel}
          districtOverviewOpen={Boolean(districtFocusId && shouldShowDistrictProfile)}
          onMarkerSelect={(marker) => {
            void handleMarkerSelect(marker);
          }}
          onMapBackgroundClick={handleMapBackgroundClick}
          onOpenDistrictOverview={(districtId) => {
            openDistrictOverview(districtId);
          }}
          onDistrictSelect={(districtId) => {
            setActiveDistrictId(districtId);
          }}
        />
        {(activeMarker || isDetailsLoading || detailsError) && isProjectSidebarOpen ? (
          <ProjectDetailsPanel
            marker={activeMarker}
            detail={activeProject}
            isLoading={isDetailsLoading}
            errorMessage={detailsError}
            onExploreMap={() => setIsProjectSidebarOpen(false)}
          />
        ) : null}
        {(districtFocusId && shouldShowDistrictProfile) ? (
          <>
            <button
              type="button"
              className="district-sheet-dismiss-layer"
              aria-label="Close district overview"
              onClick={() => setDistrictFocus(districtFocusId, false)}
            />
            <DistrictOverviewSheet
              districtId={districtFocusId}
              focusLabel={districtSheetFocusLabel}
              onOpenMap={() => setDistrictFocus(districtFocusId, false)}
              onSelectProjectOnMap={handleSelectProjectFromDistrictOverview}
            />
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
