import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePostHog } from "@posthog/react";

import { DistrictOverviewSheet } from "../districts/DistrictOverviewSheet";
import { getProjectDetail } from "../../shared/api/client";
import type { MapMarker } from "../../shared/map/mapTypes";
import { MAP_QUERY_DISTRICT_PIN_FILTER } from "../../shared/map/mapNavigateFromAddressSearch";
import { AppShell } from "../../shared/ui/AppShell";
import { CityMap } from "./CityMap";
import { ProjectDetailsPanel } from "./ProjectDetailsPanel";
import { useMapData } from "./useMapData";
import { useProjectDetail } from "./useProjectDetail";

const DISTRICT_SHEET_ANIMATION_MS = 620;


export function MapPage() {
  const posthog = usePostHog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeMarker, setActiveMarker] = useState<MapMarker | null>(null);
  const [focusMarker, setFocusMarker] = useState<MapMarker | null>(null);
  const [activeDistrictId, setActiveDistrictId] = useState<number | null>(null);
  const [isProjectSidebarOpen, setIsProjectSidebarOpen] = useState(true);
  const [isProjectSidebarExpanded, setIsProjectSidebarExpanded] = useState(false);
  const [districtRefocusSignal, setDistrictRefocusSignal] = useState(0);
  const [isDistrictOverviewClosing, setIsDistrictOverviewClosing] = useState(false);
  const districtOverviewCloseTimeoutRef = useRef<number | null>(null);
  const lastSyncedDistrictFocusFromUrlRef = useRef<number | null | undefined>(undefined);
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
  const shouldRenderDistrictOverview = districtFocusId !== null && (shouldShowDistrictProfile || isDistrictOverviewClosing);
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
  const districtPinFilterIntent = searchParams.get(MAP_QUERY_DISTRICT_PIN_FILTER);
  /** Geocoded address (with `districtFocus`) or landing district pick (`districtPinFilter=1`); narrow pins to that district. */
  const addressDrivenDistrictPinsId = useMemo((): number | null => {
    if (districtFocusId === null) {
      return null;
    }
    if (addressFocusPoint !== null) {
      return districtFocusId;
    }
    if (districtPinFilterIntent === "1") {
      return districtFocusId;
    }
    return null;
  }, [addressFocusPoint, districtFocusId, districtPinFilterIntent]);
  const { boundaries, projectCards, projectMarkers } = useMapData();
  // Markers rendered on the map: the preloaded set, plus any one-off "View on Map" target that
  // wasn't in the preloaded set (projects load capped per district).
  const markersForMap = useMemo(() => {
    if (!focusMarker || projectMarkers.some((m) => m.id === focusMarker.id)) {
      return projectMarkers;
    }
    return [...projectMarkers, focusMarker];
  }, [projectMarkers, focusMarker]);

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
    if (districtFocusId === lastSyncedDistrictFocusFromUrlRef.current) {
      return;
    }
    lastSyncedDistrictFocusFromUrlRef.current = districtFocusId;
    if (districtFocusId != null) {
      setActiveDistrictId(districtFocusId);
    }
  }, [districtFocusId]);

  useEffect(() => {
    if (shouldShowDistrictProfile) {
      setIsDistrictOverviewClosing(false);
      if (districtOverviewCloseTimeoutRef.current !== null) {
        window.clearTimeout(districtOverviewCloseTimeoutRef.current);
        districtOverviewCloseTimeoutRef.current = null;
      }
    }
  }, [shouldShowDistrictProfile]);

  useEffect(() => {
    return () => {
      if (districtOverviewCloseTimeoutRef.current !== null) {
        window.clearTimeout(districtOverviewCloseTimeoutRef.current);
      }
    };
  }, []);

  async function handleMarkerSelect(marker: MapMarker) {
    posthog?.capture("project_marker_clicked", {
      project_id: marker.kind === "project" ? marker.projectId : undefined,
      marker_id: marker.id,
      district_id: marker.districtId,
      category: marker.category,
      label: marker.label,
    });
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
      nextParams.delete(MAP_QUERY_DISTRICT_PIN_FILTER);
    } else {
      nextParams.set("districtFocus", String(districtId));
      nextParams.set("showDistrictProfile", shouldOpenProfile ? "1" : "0");
    }

    setSearchParams(nextParams, { replace: true });
  }

  function openDistrictOverview(districtId: number) {
    posthog?.capture("district_overview_opened", { district_id: districtId });
    setActiveMarker(null);
    resetProjectDetail();
    setDistrictFocus(districtId);
  }

  function closeDistrictOverview() {
    if (districtFocusId === null || isDistrictOverviewClosing) {
      return;
    }

    setIsDistrictOverviewClosing(true);
    districtOverviewCloseTimeoutRef.current = window.setTimeout(() => {
      setDistrictFocus(districtFocusId, false);
      setIsDistrictOverviewClosing(false);
      districtOverviewCloseTimeoutRef.current = null;
    }, DISTRICT_SHEET_ANIMATION_MS);
  }

  async function handleSelectProjectFromDistrictOverview(projectId: string) {
    let marker = projectMarkers.find((m) => m.kind === "project" && m.projectId === projectId) ?? null;
    if (!marker) {
      // Not in the preloaded markers (e.g. beyond the per-district cap); build one from detail.
      try {
        const detail = await getProjectDetail(projectId);
        const geocode = detail.address_info?.geocode;
        if (!geocode) {
          return;
        }
        marker = {
          id: `project-${projectId}`,
          projectId,
          districtId: detail.project.district_id,
          kind: "project",
          category: "housing",
          label: detail.project.title,
          summary: detail.project.summary ?? "",
          primaryAddress: detail.address_info?.primary_address ?? null,
          affiliations: detail.affiliations ?? [],
          longitude: geocode.longitude,
          latitude: geocode.latitude,
        };
        setFocusMarker(marker);
      } catch {
        return;
      }
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
          markers={markersForMap}
          activeMarkerId={activeMarker?.id ?? null}
          activeDistrictId={activeDistrictId}
          districtRefocusSignal={districtRefocusSignal}
          addressFocusPoint={addressFocusPoint}
          addressDrivenDistrictPinsId={addressDrivenDistrictPinsId}
          districtOverviewOpen={Boolean(districtFocusId && shouldShowDistrictProfile)}
          hideMapChrome={isProjectSidebarExpanded}
          onMarkerSelect={(marker) => {
            void handleMarkerSelect(marker);
          }}
          onMapBackgroundClick={handleMapBackgroundClick}
          onOpenDistrictOverview={(districtId) => {
            openDistrictOverview(districtId);
          }}
          onDistrictSelect={(districtId) => {
            setActiveDistrictId(districtId);
            if (districtId == null) {
              return;
            }
            const nextParams = new URLSearchParams(searchParams);
            nextParams.set("districtFocus", String(districtId));
            nextParams.set("showDistrictProfile", "0");
            nextParams.delete("focusLat");
            nextParams.delete("focusLng");
            nextParams.delete("focusLabel");
            nextParams.delete(MAP_QUERY_DISTRICT_PIN_FILTER);
            setSearchParams(nextParams, { replace: true });
          }}
        />
        {(activeMarker || isDetailsLoading || detailsError) && isProjectSidebarOpen ? (
          <ProjectDetailsPanel
            marker={activeMarker}
            detail={activeProject}
            isLoading={isDetailsLoading}
            errorMessage={detailsError}
            onExploreMap={() => setIsProjectSidebarOpen(false)}
            onExpandedChange={setIsProjectSidebarExpanded}
          />
        ) : null}
        {districtFocusId !== null && shouldRenderDistrictOverview ? (
          <>
            <button
              type="button"
              className="district-sheet-dismiss-layer"
              aria-label="Close district overview"
              onClick={closeDistrictOverview}
            />
            <DistrictOverviewSheet
              districtId={districtFocusId}
              isClosing={isDistrictOverviewClosing}
              focusLabel={districtSheetFocusLabel}
              onOpenMap={() => {
                setDistrictRefocusSignal((current) => current + 1);
                closeDistrictOverview();
              }}
              onSelectProjectOnMap={handleSelectProjectFromDistrictOverview}
            />
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
