import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePostHog } from "@posthog/react";
import Map, {
  Layer,
  Marker,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
  type ViewState,
} from "react-map-gl/maplibre";
import type { FilterSpecification } from "maplibre-gl";

import { MapAddressSearch } from "./MapAddressSearch";
import { useCouncilMemberBios } from "../districts/useCouncilMemberBios";
import { useDistrictProfile } from "../districts/useDistrictProfile";
import { formatPersonNameForDisplay } from "../../shared/formatPersonName";
import { formatProjectTitleForDisplay } from "../../shared/formatProjectTitleForDisplay";
import { LIGHT_BASE_MAP_STYLE } from "../../shared/map/lightBaseMapStyle";
import {
  assetKey,
  getDistrictAssetSource,
  getPanelSourceUrl,
  hasNeighborhoodMap,
  NEIGHBORHOOD_DISTRICT_ID,
  resolvePanelSelection,
  useDistrictAssetsState,
  type AssetProperties,
  type PanelAsset,
  type PanelSelection,
} from "./cd2Assets";
import { NeighborhoodChatPanel } from "../neighborhood-chat/NeighborhoodChatPanel";
import { NeighborhoodResults } from "../neighborhood-chat/NeighborhoodResults";
import { useNeighborhoodChat, type Origin } from "../neighborhood-chat/useNeighborhoodChat";
import { ResourceDetailPanel, type AssetFocus } from "./ResourceDetailPanel";
import { NeighborhoodOverlay } from "./NeighborhoodOverlay";
import {
  ASSET_POINTS_LAYER_ID,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  NEIGHBORHOOD_FILL_LAYER_ID,
} from "./neighborhoodMapLayers";
import { ASSET_PIN_SOURCES, pinImageUrl, useAssetPinImages } from "./assetPinImages";
import type { HoveredAsset, HoveredNeighborhood } from "./NeighborhoodOverlay";
import { findDistrictFeature, findDistrictIdForPoint, getFeatureBounds, type DistrictBoundaryCollection } from "../../shared/map/districtBoundaries";
import {
  districtFillLayer,
  districtFillOpacityExpression,
  districtHighlightLayer,
  districtLabelsLayer,
  districtOutlineLayer,
} from "../../shared/map/districtLayers";
import { categoryDescription } from "../../shared/data/categoryDescriptions";
import { CATEGORY_COLOR, MARKER_CATEGORIES, type MapMarker, type MarkerCategory } from "../../shared/map/mapTypes";
import { ProjectAffiliationChips, AFFILIATION_CATEGORY_ORDER } from "./projectDetails/ProjectAffiliations";
import { CategoryPillStatic } from "../../shared/ui/CategoryPill";
import { LocationPinIcon } from "../../shared/ui/visicIcons";
import { PROJECT_PIN_SRC as PIN_SRC } from "../../shared/map/projectPinSources";

/** Style-guide forest green (Figma Visic UI primary, `--ps-forest`) for the searched-address pin. */
const ADDRESS_PIN_COLOR = "#1d865e";



const DEFAULT_VIEW_STATE: ViewState = {
  longitude: -118.4118,
  latitude: 34.021,
  zoom: 8.8,
  bearing: 0,
  pitch: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
};

const DEFAULT_DISTRICT_IDS = Array.from({ length: 15 }, (_, index) => index + 1);

/** Close enough to read the street the pin sits on, without leaving its neighbours off-screen. */
const ASSET_FOCUS_ZOOM = 15;
/** Mirrors `.neighborhood-detail-host`'s 23rem cap in app.css. Change one, change the other. */
const PANEL_WIDTH_PX = 368;
/** The dock's own full-width breakpoint (max-width: 640px), above which the offset is useful. */
const PANEL_OFFSET_MIN_WIDTH = 641;

const MAP_GUIDANCE_ICON_ITEMS = MARKER_CATEGORIES.map((category) => ({
  label: category,
  src: PIN_SRC[category],
}));

function buildHighlightLayer(activeDistrictId: number) {
  return {
    ...districtHighlightLayer,
    filter: ["==", ["get", "District"], activeDistrictId] as ["==", ["get", string], number],
  } satisfies typeof districtHighlightLayer;
}

function buildDistrictFillLayer(selectedDistrictIds: number[]) {
  const selectedDistrictFilter: FilterSpecification =
    selectedDistrictIds.length > 0
      ? (["match", ["get", "District"], selectedDistrictIds, true, false] as FilterSpecification)
      : false;

  return {
    ...districtFillLayer,
    id: "district-fill-selected",
    filter: selectedDistrictFilter,
  } satisfies typeof districtFillLayer;
}

/**
 * Grey wash over every council district except the one in focus, for neighbourhood mode.
 *
 * Rendered inside the district `<Source>` — above the district fills but below everything the
 * neighbourhood overlay draws. That ordering is what makes it correct rather than merely dim:
 * the CSA polygons extend past CD2 (the Van Nuys CSA is almost entirely CD6), so a scrim drawn
 * *over* the overlay would grey out part of the very neighbourhoods being focused. Underneath,
 * it washes out only what the overlay does not cover.
 *
 * A light neutral rather than a dark one: the CARTO basemap is already pale, so lifting the
 * surroundings toward flat grey reads as out-of-focus, where darkening would read as selected.
 */
function buildDistrictScrimLayer(focusDistrictId: number) {
  return {
    ...districtFillLayer,
    id: "district-fill-scrim",
    filter: ["!=", ["get", "District"], focusDistrictId] as FilterSpecification,
    paint: {
      "fill-color": "#dfe3e8",
      "fill-opacity": 0.62,
    },
  } satisfies typeof districtFillLayer;
}

/** District numbers for the focused district only; the rest would fight the scrim. */
function buildFocusedDistrictLabelsLayer(focusDistrictId: number) {
  return {
    ...districtLabelsLayer,
    filter: ["==", ["get", "District"], focusDistrictId] as FilterSpecification,
  } satisfies typeof districtLabelsLayer;
}

function buildDistrictFillDimLayer() {
  return {
    ...districtFillLayer,
    id: "district-fill-dim",
    paint: {
      ...districtFillLayer.paint,
      "fill-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        7,
        0.42 * 0.35,
        9.5,
        0.28 * 0.35,
        12,
        0.16 * 0.35,
        14.5,
        0.08 * 0.35,
      ],
    },
  } satisfies typeof districtFillLayer;
}

/** Checkbox that can render the indeterminate (partial) state, which has no React prop. */
function TristateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} />;
}

interface CityMapProps {
  boundaries: DistrictBoundaryCollection | null;
  markers: MapMarker[];
  activeMarkerId?: string | null;
  activeDistrictId: number | null;
  /** Geocoded address from landing; used to zoom before district GeoJSON is ready, and as fallback. */
  addressFocusPoint?: { latitude: number; longitude: number } | null;
  /** Human-readable label for the searched address; shown on the location pin's hover card. */
  addressFocusLabel?: string | null;
  /** When set (geocoded address or landing `districtPinFilter=1` + `districtFocus`), project pin filters default to this district only. */
  addressDrivenDistrictPinsId?: number | null;
  /** Increments when map should re-center on current district. */
  districtRefocusSignal?: number;
  /** Hide map chrome (search + control stack + feedback) while another sheet is open. */
  hideMapChrome?: boolean;
  /** Hides the floating district pill (e.g. while the district overview sheet is open — avoids a second “divot”). */
  districtOverviewOpen?: boolean;
  onMarkerSelect: (marker: MapMarker) => void;
  onMapBackgroundClick: () => void;
  onOpenDistrictOverview: (districtId: number) => void;
  onDistrictSelect: (districtId: number | null) => void;
}

export function CityMap({
  boundaries,
  markers,
  activeMarkerId,
  activeDistrictId,
  addressFocusPoint = null,
  addressFocusLabel = null,
  addressDrivenDistrictPinsId = null,
  districtRefocusSignal = 0,
  hideMapChrome = false,
  districtOverviewOpen = false,
  onMarkerSelect,
  onMapBackgroundClick,
  onOpenDistrictOverview,
  onDistrictSelect,
}: CityMapProps) {
  const posthog = usePostHog();
  const DISTRICT_PILL_SWAP_MS = 140;
  const mapRef = useRef<MapRef>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const lastDistrictFocusRef = useRef<string | null>(null);
  const prevDistrictOverviewOpenRef = useRef<boolean | undefined>(undefined);
  const lastHandledRefocusSignalRef = useRef(0);
  const lastPillDistrictIdRef = useRef<number | null>(null);
  const pillSwapTimeoutRef = useRef<number | null>(null);
  const [lastVisibleDistrictId, setLastVisibleDistrictId] = useState<number | null>(null);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [explainedCategory, setExplainedCategory] = useState<MarkerCategory | null>(null);
  const [searchDismissSignal, setSearchDismissSignal] = useState(0);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  // Touch has no hover, so the address pin's label card is tap-toggled open on touch.
  const [isAddressCardOpen, setIsAddressCardOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isDistrictFilterOpen, setIsDistrictFilterOpen] = useState(false);
  /** Neighbourhood resources overlay: off by default so council-file pins stay the headline. */
  const [isNeighborhoodsOn, setIsNeighborhoodsOn] = useState(false);
  const [isNeighborhoodPanelOpen, setIsNeighborhoodPanelOpen] = useState(false);
  const [neighborhoodCategories, setNeighborhoodCategories] = useState<readonly string[]>(CATEGORY_ORDER);
  const [selectedAsset, setSelectedAsset] = useState<{
    longitude: number;
    latitude: number;
    properties: Partial<AssetProperties>;
  } | null>(null);
  /**
   * Which resource panel is open. Replaces a bare `selectedNeighborhood` because a clicked pin
   * can now route to the District Overview instead of a neighbourhood; the map's selection fill
   * still only ever highlights a CSA polygon, so that stays derived below.
   */
  const [panelSelection, setPanelSelection] = useState<PanelSelection | null>(null);
  /** Set only by a pin click: which card the open panel should scroll to and flash. */
  const [assetFocus, setAssetFocus] = useState<AssetFocus | null>(null);
  const focusNonceRef = useRef(0);
  const selectedNeighborhood =
    panelSelection?.kind === "neighborhood" ? panelSelection.csaLabel : null;
  /** Desktop-only by nature: onMouseMove never fires from touch input. */
  const [hoveredNeighborhood, setHoveredNeighborhood] = useState<HoveredNeighborhood | null>(null);
  const [hoveredAsset, setHoveredAsset] = useState<HoveredAsset | null>(null);
  /**
   * Council-file pins while the overlay is on. Turned off with the overlay so the neighbourhood
   * layer is legible on its own; the flyout's checkbox brings them back.
   */
  const [showLegislation, setShowLegislation] = useState(true);
  const [pillPortraitFailed, setPillPortraitFailed] = useState(false);
  const [isDistrictPillVisible, setIsDistrictPillVisible] = useState(true);
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<Set<number>>(
    () => new Set(DEFAULT_DISTRICT_IDS),
  );
  const [lastTouchedDistrictId, setLastTouchedDistrictId] = useState<number | null>(null);
  const [selectedBodies, setSelectedBodies] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<MarkerCategory>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const hasInitializedCategoryFilterRef = useRef(false);
  const hasInitializedMarkerCategoryFilterRef = useRef(false);
  const hasInitializedDistrictFilterRef = useRef(false);
  const previousActiveDistrictIdForPillRef = useRef<number | null | undefined>(undefined);

  // Both files are committed and tiny (32 KB + 45 KB); the hook memoises across mounts.
  // Gated on the toggle so nothing is fetched for a session that never turns it on.
  const neighborhoodState = useDistrictAssetsState(NEIGHBORHOOD_DISTRICT_ID, isNeighborhoodsOn);
  const neighborhoodData = neighborhoodState.status === "ready" ? neighborhoodState.loaded : null;
  const [isNeighborhoodChatOpen, setIsNeighborhoodChatOpen] = useState(false);
  const [isPickingChatPoint, setIsPickingChatPoint] = useState(false);
  const [chatPointError, setChatPointError] = useState<string | null>(null);
  const [showChatResults, setShowChatResults] = useState(false);
  const neighborhoodChat = useNeighborhoodChat(neighborhoodData?.assets ?? null);
  const chatResult = isNeighborhoodChatOpen ? neighborhoodChat.result : null;
  const previousChatMapState = useRef<{ enabled: boolean; legislation: boolean } | null>(null);
  const chatResultKeys = useMemo(() => chatResult?.items.map((item) => item.key) ?? [], [chatResult]);
  const chatAssets = useMemo(() => neighborhoodData && chatResult
    ? { ...neighborhoodData.assets, features: neighborhoodData.assets.features.filter((item) => chatResultKeys.includes(assetKey(item.properties))) }
    : neighborhoodData?.assets, [neighborhoodData, chatResult, chatResultKeys]);

  useEffect(() => {
    if (!chatResult) { setShowChatResults(false); return; }
    setShowChatResults(true);
    setSelectedAsset(null);
    setPanelSelection(null);
    const map = mapRef.current?.getMap();
    if (!map || !chatResult.items.length) return;
    const points = chatResult.items;
    const width = map.getContainer()?.clientWidth ?? 0;
    map.fitBounds([
      [Math.min(...points.map((point) => point.longitude)), Math.min(...points.map((point) => point.latitude))],
      [Math.max(...points.map((point) => point.longitude)), Math.max(...points.map((point) => point.latitude))],
    ], { padding: width > 640 ? { top: 80, bottom: 80, left: Math.min(380, width * .4), right: 60 } : 48, maxZoom: 14, duration: 500 });
  }, [chatResult]);

  function closeNeighborhoodChat() {
    neighborhoodChat.clearResults();
    setIsNeighborhoodChatOpen(false);
    setIsPickingChatPoint(false);
    setSelectedAsset(null);
    setPanelSelection(null);
    if (previousChatMapState.current) {
      setIsNeighborhoodsOn(previousChatMapState.current.enabled);
      setShowLegislation(previousChatMapState.current.legislation);
      previousChatMapState.current = null;
    }
  }

  function openNeighborhoodChat() {
    onMapBackgroundClick();
    previousChatMapState.current = { enabled: isNeighborhoodsOn, legislation: showLegislation };
    neighborhoodChat.setNeighborhood(selectedNeighborhood?.replace(/^Los Angeles - /, "") ?? null);
    setIsNeighborhoodChatOpen(true);
    setIsNeighborhoodsOn(true);
    setShowLegislation(false);
    setIsNeighborhoodPanelOpen(false);
    setIsInfoOpen(false);
    setIsDistrictFilterOpen(false);
    const bounds = getDistrictAssetSource(NEIGHBORHOOD_DISTRICT_ID)?.bounds;
    if (bounds) mapRef.current?.getMap().fitBounds(bounds, { padding: 60, duration: 500 });
  }

  function chooseChatPoint(point: Origin) {
    if (!boundaries || findDistrictIdForPoint(boundaries, point.longitude, point.latitude) !== 2) {
      setChatPointError("Choose a point inside the Council District 2 boundary.");
      return;
    }
    setChatPointError(null);
    setIsPickingChatPoint(false);
    neighborhoodChat.choosePoint(point);
  }

  // Existing parent navigation closes this independent mode; council-file chat stays untouched.
  useEffect(() => {
    if (isNeighborhoodChatOpen && (hideMapChrome || districtOverviewOpen || activeMarkerId)) closeNeighborhoodChat();
  }, [hideMapChrome, districtOverviewOpen, activeMarkerId]);
  /**
   * The pin symbol layers name icon ids, so they must not mount before those ids exist in the
   * style -- MapLibre warns every frame for an unknown `icon-image` and draws nothing.
   */
  const arePinImagesReady = useAssetPinImages(mapRef, isNeighborhoodsOn && isMapReady);
  const neighborhoodBoundary = useMemo(
    () => (boundaries ? findDistrictFeature(boundaries, NEIGHBORHOOD_DISTRICT_ID) ?? null : null),
    [boundaries],
  );
  const neighborhoodCounts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const feature of neighborhoodData?.assets.features ?? []) {
      const key = feature.properties?.category ?? "";
      tally[key] = (tally[key] ?? 0) + 1;
    }
    return tally;
  }, [neighborhoodData]);

  const availableDistrictIds = useMemo(() => {
    const ids = new Set<number>();
    markers.forEach((marker) => {
      if (marker.districtId != null) {
        ids.add(marker.districtId);
      }
    });
    return (ids.size > 0 ? [...ids] : DEFAULT_DISTRICT_IDS).sort((a, b) => a - b);
  }, [markers]);
  // Specific bodies (e.g. "Fire Department") present on loaded pins, grouped by category in canonical order.
  const availableBodyGroups = useMemo(() => {
    // NB: `Map` is shadowed by the react-map-gl import in this file, so use a plain object.
    const byCategory: Record<string, Set<string>> = {};
    markers.forEach((marker) =>
      marker.affiliations.forEach((group) => {
        const set = (byCategory[group.category] ??= new Set<string>());
        group.items.forEach((name) => set.add(name));
      }),
    );
    const orderedCats = AFFILIATION_CATEGORY_ORDER.filter((category) => category in byCategory);
    const extras = Object.keys(byCategory)
      .filter((category) => !AFFILIATION_CATEGORY_ORDER.includes(category))
      .sort();
    return [...orderedCats, ...extras].map((category) => ({
      category,
      bodies: [...byCategory[category]].sort(),
    }));
  }, [markers]);
  const allBodies = useMemo(() => availableBodyGroups.flatMap((group) => group.bodies), [availableBodyGroups]);
  // Project categories (Housing, Education, …) present on loaded pins, in canonical order.
  const availableCategories = useMemo(() => {
    const present = new Set<MarkerCategory>();
    markers.forEach((marker) => present.add(marker.category));
    return MARKER_CATEGORIES.filter((category) => present.has(category));
  }, [markers]);
  // Pin count per project category (NB: `Map` is shadowed by react-map-gl, so use a plain object).
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    markers.forEach((marker) => {
      counts[marker.category] = (counts[marker.category] ?? 0) + 1;
    });
    return counts;
  }, [markers]);
  const visibleMarkers = useMemo(() => {
    // The body filter only narrows once the user deselects something; "all selected" shows every pin
    // (including pins that have no affiliations).
    const bodyFilterActive = allBodies.length > 0 && !allBodies.every((body) => selectedBodies.has(body));
    // Same "all selected = no filter" semantics for the project-category filter.
    const categoryFilterActive =
      availableCategories.length > 0 && !availableCategories.every((category) => selectedCategories.has(category));
    return markers.filter((marker) => {
      // Always keep the actively-selected project visible (e.g. opened via "View on Map" from the
      // district overview), even if it falls outside the current district/category pin filters.
      if (marker.id === activeMarkerId) {
        return true;
      }
      if (marker.districtId == null || !selectedDistrictIds.has(marker.districtId)) {
        return false;
      }
      if (categoryFilterActive && !selectedCategories.has(marker.category)) {
        return false;
      }
      if (!bodyFilterActive) {
        return true;
      }
      return marker.affiliations.some((group) => group.items.some((name) => selectedBodies.has(name)));
    });
  }, [markers, selectedDistrictIds, selectedBodies, allBodies, selectedCategories, availableCategories, activeMarkerId]);
  const selectedDistrictIdList = useMemo(() => [...selectedDistrictIds], [selectedDistrictIds]);
  const activeFilterDistrictIds = useMemo(
    () => availableDistrictIds.filter((id) => selectedDistrictIds.has(id)),
    [availableDistrictIds, selectedDistrictIds],
  );
  /** Councilmember pill: most recent map focus (`activeDistrictId`) or filter checkbox. No pill when both are cleared (e.g. map background click). */
  const pillDistrictId = useMemo((): number | null => {
    if (activeFilterDistrictIds.length === 0) {
      return null;
    }
    if (lastTouchedDistrictId != null && activeFilterDistrictIds.includes(lastTouchedDistrictId)) {
      return lastTouchedDistrictId;
    }
    if (activeDistrictId != null && activeFilterDistrictIds.includes(activeDistrictId)) {
      return activeDistrictId;
    }
    if (activeDistrictId == null && lastTouchedDistrictId == null) {
      return null;
    }
    return Math.min(...activeFilterDistrictIds);
  }, [activeFilterDistrictIds, lastTouchedDistrictId, activeDistrictId]);

  const { profile: districtProfile } = useDistrictProfile(pillDistrictId);
  const { biosByDistrict } = useCouncilMemberBios();
  const showDistrictPill = pillDistrictId != null;
  const displayedDistrictId = pillDistrictId ?? lastVisibleDistrictId;
  const bio = pillDistrictId != null ? biosByDistrict?.get(pillDistrictId) : undefined;
  const councilNameRaw = (bio?.name?.trim() || districtProfile?.name?.trim() || "") || "";
  const displayedName = councilNameRaw
    ? formatPersonNameForDisplay(councilNameRaw)
    : displayedDistrictId != null
      ? `District ${displayedDistrictId}`
      : "District";
  const displayedLabel =
    displayedDistrictId != null ? `District ${displayedDistrictId}` : "";
  const portraitSrc = (bio?.profilePic?.trim() || districtProfile?.profile_pic?.trim() || "").trim() || null;
  const initials = displayedName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("");

  const mapGuidanceHowToUse = useMemo(() => {
    // Touch devices (no hover) never see the hover preview cards, so tell them to tap.
    const isTouch = typeof window !== "undefined" && Boolean(window.matchMedia?.("(hover: none)").matches);
    return isTouch
      ? [
          "Tap a pin to open project details.",
          "Tap a district to view its projects.",
          "Tap the address pin to see its label.",
        ]
      : [
          "Hover pins to preview project names.",
          "Click pins to open project details.",
          "Click a district to view its projects.",
        ];
  }, []);

  const setMapInstance = useCallback((instance: MapRef | null) => {
    mapRef.current = instance;
    setIsMapReady(Boolean(instance));
  }, []);

  useEffect(() => {
    if (activeDistrictId === previousActiveDistrictIdForPillRef.current) {
      return;
    }
    if (activeDistrictId != null) {
      setLastTouchedDistrictId(activeDistrictId);
    } else if (previousActiveDistrictIdForPillRef.current != null) {
      setLastTouchedDistrictId(null);
    }
    previousActiveDistrictIdForPillRef.current = activeDistrictId;
  }, [activeDistrictId]);

  useEffect(() => {
    if (pillDistrictId != null) {
      setLastVisibleDistrictId(pillDistrictId);
    }
  }, [pillDistrictId]);

  useEffect(() => {
    if (districtOverviewOpen) {
      setIsInfoOpen(false);
      setIsDistrictFilterOpen(false);
    }
  }, [districtOverviewOpen]);

  useEffect(() => {
    if (availableDistrictIds.length === 0) {
      return;
    }

    if (addressDrivenDistrictPinsId != null) {
      setSelectedDistrictIds(new Set([addressDrivenDistrictPinsId]));
      setLastTouchedDistrictId(addressDrivenDistrictPinsId);
      hasInitializedDistrictFilterRef.current = true;
      return;
    }

    if (!hasInitializedDistrictFilterRef.current) {
      setSelectedDistrictIds(new Set(availableDistrictIds));
      hasInitializedDistrictFilterRef.current = true;
    }
  }, [availableDistrictIds, addressDrivenDistrictPinsId]);

  useEffect(() => {
    if (allBodies.length === 0 || hasInitializedCategoryFilterRef.current) {
      return;
    }
    setSelectedBodies(new Set(allBodies));
    hasInitializedCategoryFilterRef.current = true;
  }, [allBodies]);

  useEffect(() => {
    if (availableCategories.length === 0 || hasInitializedMarkerCategoryFilterRef.current) {
      return;
    }
    setSelectedCategories(new Set(availableCategories));
    hasInitializedMarkerCategoryFilterRef.current = true;
  }, [availableCategories]);

  useEffect(() => {
    if (!activeMarkerId) {
      return;
    }

    const markerIsVisible = visibleMarkers.some((marker) => marker.id === activeMarkerId);
    if (!markerIsVisible) {
      onMapBackgroundClick();
    }
  }, [activeMarkerId, onMapBackgroundClick, visibleMarkers]);

  useEffect(() => {
    setPillPortraitFailed(false);
  }, [portraitSrc, pillDistrictId]);

  useEffect(() => {
    return () => {
      if (pillSwapTimeoutRef.current != null) {
        window.clearTimeout(pillSwapTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (pillDistrictId == null) {
      lastPillDistrictIdRef.current = null;
      setIsDistrictPillVisible(false);
      if (pillSwapTimeoutRef.current != null) {
        window.clearTimeout(pillSwapTimeoutRef.current);
        pillSwapTimeoutRef.current = null;
      }
      return;
    }

    const previousDistrictId = lastPillDistrictIdRef.current;
    lastPillDistrictIdRef.current = pillDistrictId;

    if (previousDistrictId == null || previousDistrictId === pillDistrictId) {
      setIsDistrictPillVisible(true);
      return;
    }

    setIsDistrictPillVisible(false);
    if (pillSwapTimeoutRef.current != null) {
      window.clearTimeout(pillSwapTimeoutRef.current);
    }
    pillSwapTimeoutRef.current = window.setTimeout(() => {
      setIsDistrictPillVisible(true);
      pillSwapTimeoutRef.current = null;
    }, DISTRICT_PILL_SWAP_MS);
  }, [pillDistrictId]);

  useLayoutEffect(() => {
    const overviewWasOpen = prevDistrictOverviewOpenRef.current;

    try {
      const map = mapRef.current?.getMap();
      if (!map || !isMapReady) {
        return;
      }

      const shouldForceRefocus = districtRefocusSignal !== lastHandledRefocusSignalRef.current;
      if (shouldForceRefocus) {
        lastHandledRefocusSignalRef.current = districtRefocusSignal;
        lastDistrictFocusRef.current = null;
      }

      if (activeDistrictId == null) {
        lastDistrictFocusRef.current = null;
        if (addressFocusPoint) {
          map.jumpTo({
            center: [addressFocusPoint.longitude, addressFocusPoint.latitude],
            zoom: Math.max(map.getZoom(), 12.8),
          });
        }
        return;
      }

      if (boundaries) {
        const districtFeature = findDistrictFeature(boundaries, activeDistrictId);
        if (districtFeature) {
          const [[minLng, minLat], [maxLng, maxLat]] = getFeatureBounds(districtFeature);

          if (districtOverviewOpen) {
            const framingKey = `${activeDistrictId}:sheet`;
            if (!shouldForceRefocus && overviewWasOpen === true && lastDistrictFocusRef.current === framingKey) {
              return;
            }
            lastDistrictFocusRef.current = framingKey;
            const bottomPad = Math.max(220, Math.round(window.innerHeight * 0.44));
            map.fitBounds(
              [
                [minLng, minLat],
                [maxLng, maxLat],
              ],
              {
                padding: { top: 96, bottom: bottomPad, left: 72, right: 72 },
                maxZoom: 14,
                minZoom: 8.8,
                duration: 0,
              },
            );
            return;
          }

          if (overviewWasOpen === true && !shouldForceRefocus) {
            lastDistrictFocusRef.current = `${activeDistrictId}:post-sheet`;
            return;
          }

          const postSheetKey = `${activeDistrictId}:post-sheet`;
          if (lastDistrictFocusRef.current === postSheetKey) {
            return;
          }

          const framingKey = `${activeDistrictId}:full`;
          if (!shouldForceRefocus && lastDistrictFocusRef.current === framingKey) {
            return;
          }
          lastDistrictFocusRef.current = framingKey;
          map.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat],
            ],
            {
              padding: { top: 96, bottom: 96, left: 72, right: 72 },
              maxZoom: 14,
              minZoom: 8.8,
              duration: 0,
            },
          );
          return;
        }
      }

      if (addressFocusPoint) {
        map.jumpTo({
          center: [addressFocusPoint.longitude, addressFocusPoint.latitude],
          zoom: Math.max(map.getZoom(), 12.8),
        });
      }
    } finally {
      prevDistrictOverviewOpenRef.current = districtOverviewOpen;
    }
  }, [activeDistrictId, boundaries, addressFocusPoint, districtRefocusSignal, districtOverviewOpen, isMapReady]);

  function handleZoom(delta: number) {
    const map = mapRef.current?.getMap();
    if (!map) {
      return;
    }
    map.easeTo({ zoom: map.getZoom() + delta, duration: 200 });
  }

  function handleMapMouseMove(event: MapLayerMouseEvent) {
    if (!isNeighborhoodsOn) {
      return;
    }
    // Hit-testing is already scoped by interactiveLayerIds, so no queryRenderedFeatures call is
    // needed -- the same reasoning HomelessCountPage records for its own hover handler.
    const assetFeature = event.features?.find(
      (feature) => feature.layer?.id === ASSET_POINTS_LAYER_ID,
    );
    if (assetFeature) {
      const properties = assetFeature.properties ?? {};
      const label = typeof properties.label === "string" ? properties.label : null;
      setHoveredNeighborhood(null);
      setHoveredAsset(
        label
          ? {
              label,
              category: typeof properties.category === "string" ? properties.category : "",
              // Carried so the hover layer can match this one pin rather than every pin
              // sharing its name.
              neighborhood:
                typeof properties.neighborhood === "string" ? properties.neighborhood : "",
              longitude: event.lngLat.lng,
              latitude: event.lngLat.lat,
            }
          : null,
      );
      return;
    }

    setHoveredAsset(null);
    const neighborhoodFeature = event.features?.find(
      (feature) => feature.layer?.id === NEIGHBORHOOD_FILL_LAYER_ID,
    );
    const csaLabel = neighborhoodFeature?.properties?.CSA_Label;
    setHoveredNeighborhood(
      typeof csaLabel === "string"
        ? { label: csaLabel, longitude: event.lngLat.lng, latitude: event.lngLat.lat }
        : null,
    );
  }

  function handleMapMouseLeave() {
    setHoveredNeighborhood(null);
    setHoveredAsset(null);
  }

  /**
   * A card click, in the opposite direction to a pin click: move the map to the pin, select it
   * (which is what enlarges and lights it), and flash the card back so the two ends of the
   * round trip are visibly the same row.
   */
  function handleSelectAssetFromPanel(asset: PanelAsset) {
    if (isNeighborhoodChatOpen) {
      if (chatResult && !chatResultKeys.includes(asset.key)) neighborhoodChat.clearResults();
      neighborhoodChat.chooseResource(asset);
      setShowChatResults(false);
      setPanelSelection(resolvePanelSelection(asset.properties, panelSelection));
    }
    setSelectedAsset({
      longitude: asset.longitude,
      latitude: asset.latitude,
      properties: asset.properties,
    });
    focusNonceRef.current += 1;
    setAssetFocus({ key: asset.key, nonce: focusNonceRef.current });

    const map = mapRef.current?.getMap();
    if (!map) {
      return;
    }
    // The panel covers the left edge, so centring the pin would park it underneath. Shifting
    // the target right by half the dock's width lands it in the visible half instead. Skipped
    // below the breakpoint where the dock goes full-width and there is no visible half.
    const width = map.getContainer()?.clientWidth ?? 0;
    const offset: [number, number] = width >= PANEL_OFFSET_MIN_WIDTH ? [PANEL_WIDTH_PX / 2, 0] : [0, 0];
    map.easeTo({
      center: [asset.longitude, asset.latitude],
      // Never zooms out: the user may have zoomed in deliberately before clicking the card.
      zoom: Math.max(map.getZoom(), ASSET_FOCUS_ZOOM),
      offset,
      duration: 700,
    });
  }

  function handleMapClick(event: MapLayerMouseEvent) {
    if (isPickingChatPoint) {
      chooseChatPoint({ longitude: event.lngLat.lng, latitude: event.lngLat.lat });
      return;
    }
    setSearchDismissSignal((n) => n + 1);
    setIsAddressCardOpen(false);

    // Checked before onMapBackgroundClick() and before the district lookup: a resource pin sits
    // on top of a district fill, so without this a click on one would both open its popup and
    // re-select the district underneath it.
    // `layer` is read optionally on purpose, matching how this handler already reads
    // `properties?.District`: a queried feature is not guaranteed to carry every field.
    const assetFeature = event.features?.find(
      (feature) => feature.layer?.id === ASSET_POINTS_LAYER_ID,
    );
    if (assetFeature && assetFeature.geometry?.type === "Point") {
      const [longitude, latitude] = assetFeature.geometry.coordinates;
      const properties = (assetFeature.properties ?? {}) as Partial<AssetProperties>;
      setSelectedAsset({ longitude, latitude, properties });

      // Open whichever panel can show this pin -- switching panels if the open one cannot --
      // then ask it to scroll to the card and flash it. The nonce makes a repeat click on the
      // same pin re-run the effect instead of being skipped as unchanged state.
      if (isNeighborhoodChatOpen) {
        const item = chatResult?.items.find((candidate) => candidate.key === assetKey(properties));
        if (item) neighborhoodChat.chooseResource(item);
        setShowChatResults(false);
      }
      const nextSelection = resolvePanelSelection(properties, panelSelection);
      if (nextSelection) {
        focusNonceRef.current += 1;
        setPanelSelection(nextSelection);
        setAssetFocus({ key: assetKey(properties), nonce: focusNonceRef.current });
      }
      return;
    }

    setSelectedAsset(null);

    // A neighbourhood click beats the district fill underneath it, and in overlay mode a click
    // anywhere on the map must not re-select a district -- both are explicit requirements, and
    // both have to be handled before onMapBackgroundClick()/the district lookup below.
    if (isNeighborhoodsOn) {
      const neighborhoodFeature = event.features?.find(
        (feature) => feature.layer?.id === NEIGHBORHOOD_FILL_LAYER_ID,
      );
      const label = neighborhoodFeature?.properties?.CSA_Label;
      if (isNeighborhoodChatOpen && typeof label === "string") {
        neighborhoodChat.clearResults();
        neighborhoodChat.setNeighborhood(label.replace(/^Los Angeles - /, ""));
      }
      setPanelSelection(typeof label === "string" ? { kind: "neighborhood", csaLabel: label } : null);
      setAssetFocus(null);
      onMapBackgroundClick();
      return;
    }

    onMapBackgroundClick();

    const clickedFeature = event.features?.find((feature) => {
      const districtValue = feature.properties?.District;
      return typeof districtValue === "number" || typeof districtValue === "string";
    });

    if (!clickedFeature) {
      return;
    }

    const districtValue = clickedFeature.properties?.District;
    const parsedDistrictId = Number(districtValue);
    if (Number.isNaN(parsedDistrictId)) {
      return;
    }

    setSelectedDistrictIds(new Set([parsedDistrictId]));
    hasInitializedDistrictFilterRef.current = true;
    onDistrictSelect(parsedDistrictId);
  }

  return (
    <div className="city-demo-map">
      <Map
        ref={setMapInstance}
        initialViewState={DEFAULT_VIEW_STATE}
        onClick={handleMapClick}
        onMouseMove={handleMapMouseMove}
        onMouseLeave={handleMapMouseLeave}
        cursor={isPickingChatPoint ? "crosshair" : hoveredAsset || hoveredNeighborhood ? "pointer" : undefined}
        // Every id here must name a layer that is actually mounted, or MapLibre warns on each
        // query — which is why the two sets below track what the <Source> above renders.
        interactiveLayerIds={[
          "district-fill-dim",
          "district-labels",
          ...(isNeighborhoodsOn
            ? ["district-fill-scrim"]
            : ["district-fill-selected", "district-highlight"]),
          ...(isNeighborhoodsOn && neighborhoodData
            ? [NEIGHBORHOOD_FILL_LAYER_ID, ASSET_POINTS_LAYER_ID]
            : []),
        ]}
        mapStyle={LIGHT_BASE_MAP_STYLE}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        {boundaries ? (
          <Source id="district-boundaries" type="geojson" data={boundaries}>
            <Layer {...buildDistrictFillDimLayer()} />
            {/* The per-district colour fill and the pill highlight are both suppressed in
                neighbourhood mode: a saturated CD6 or CD4 fill alongside the scrim would pull
                attention straight back out of the district in focus. */}
            {isNeighborhoodsOn ? null : (
              <Layer {...buildDistrictFillLayer(selectedDistrictIdList)} />
            )}
            {isNeighborhoodsOn ? (
              <Layer {...buildDistrictScrimLayer(NEIGHBORHOOD_DISTRICT_ID)} />
            ) : null}
            <Layer {...districtOutlineLayer} />
            {!isNeighborhoodsOn && pillDistrictId != null ? (
              <Layer {...buildHighlightLayer(pillDistrictId)} />
            ) : null}
            <Layer
              {...(isNeighborhoodsOn
                ? buildFocusedDistrictLabelsLayer(NEIGHBORHOOD_DISTRICT_ID)
                : districtLabelsLayer)}
            />
          </Source>
        ) : null}

        {addressFocusPoint ? (
          <Marker
            longitude={addressFocusPoint.longitude}
            latitude={addressFocusPoint.latitude}
            anchor="bottom"
            subpixelPositioning
            style={{ zIndex: 5 }}
          >
            {/* Capture the click so it doesn't fall through to the map canvas — a canvas
                click selects the underlying district and clears the address focus params,
                which would unmount this pin. */}
            <div
              className={`map-address-marker${isAddressCardOpen ? " map-address-marker--open" : ""}`}
              role="img"
              tabIndex={0}
              aria-label={
                addressFocusLabel ? `Your searched address: ${addressFocusLabel}` : "Your searched address"
              }
              onClick={(event) => {
                // Swallow the click so it can't fall through to the map canvas (which would
                // clear the address focus and remove the pin), and tap-toggle the label card.
                event.stopPropagation();
                setIsAddressCardOpen((open) => !open);
              }}
            >
              {addressFocusLabel ? (
                <span className="map-address-pin-card" role="tooltip">
                  <span className="map-address-pin-card-label">Your address</span>
                  <span className="map-address-pin-card-value">{addressFocusLabel}</span>
                </span>
              ) : null}
              <LocationPinIcon
                className="map-address-pin"
                width={34}
                height={34}
                style={{ color: ADDRESS_PIN_COLOR }}
                aria-hidden
              />
            </div>
          </Marker>
        ) : null}

        {(isNeighborhoodsOn && !showLegislation ? [] : visibleMarkers).map((marker) => {
          const showHoverCard = hoveredMarkerId === marker.id;
          const markerZIndex = activeMarkerId === marker.id ? 4 : showHoverCard ? 6 : 1;
          const titleColor = CATEGORY_COLOR[marker.category];
          const pinSrc = PIN_SRC[marker.category];
          const markerCouncilNameRaw =
            marker.districtId != null ? biosByDistrict?.get(marker.districtId)?.name?.trim() || "" : "";
          const markerCouncilName = markerCouncilNameRaw ? formatPersonNameForDisplay(markerCouncilNameRaw) : null;

          return (
            <Marker
              key={marker.id}
              longitude={marker.longitude}
              latitude={marker.latitude}
              anchor="bottom"
              subpixelPositioning
              style={{ zIndex: markerZIndex }}
            >
              <button
                type="button"
                className={`map-project-marker ${activeMarkerId === marker.id ? "marker-active" : ""}`}
                aria-label={marker.label}
                onMouseEnter={() => setHoveredMarkerId(marker.id)}
                onMouseLeave={() => setHoveredMarkerId((current) => (current === marker.id ? null : current))}
                onFocus={() => setHoveredMarkerId(marker.id)}
                onBlur={() => setHoveredMarkerId((current) => (current === marker.id ? null : current))}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  if (isPickingChatPoint) {
                    chooseChatPoint({ longitude: marker.longitude, latitude: marker.latitude });
                    return;
                  }
                  if (isNeighborhoodChatOpen) closeNeighborhoodChat();
                  // Both panels dock to the left edge; the project sidebar would slide in
                  // on top of this one, so the neighbourhood selection yields to it -- highlight
                  // and popup included, or the council file opens over a still-glowing CD2 pin.
                  setPanelSelection(null);
                  setAssetFocus(null);
                  setSelectedAsset(null);
                  onMarkerSelect(marker);
                }}
              >
                <span className="map-marker-pin-anchor">
                  {showHoverCard ? (
                    <span className="map-marker-hover-card" role="tooltip">
                      <span className="map-marker-hover-title">{formatProjectTitleForDisplay(marker.label)}</span>
                      <span className="map-marker-hover-category">
                        <CategoryPillStatic category={marker.category} />
                      </span>
                      {/* {marker.primaryAddress?.trim() ? (
                        <span className="map-marker-hover-address">{marker.primaryAddress}</span>
                      ) : null} */}
                      {markerCouncilName || marker.districtId != null ? (
                        <span className="map-marker-hover-member">
                          {markerCouncilName ?? "Council Member"}
                          {marker.districtId != null ? ` · District ${marker.districtId}` : ""}
                        </span>
                      ) : null}
                      {marker.affiliations.length > 0 ? (
                        <span className="map-marker-hover-chips">
                          <ProjectAffiliationChips affiliations={marker.affiliations} density="comfortable" />
                        </span>
                      ) : null}
                      <span className="map-marker-hover-cta">Click to learn more.</span>
                    </span>
                  ) : null}
                  <span className={`map-marker-pin-visual ${showHoverCard ? "is-hovered" : ""}`.trim()}>
                    <span
                      className={`map-marker-district-badge ${activeMarkerId === marker.id ? "is-active" : ""}`.trim()}
                      aria-hidden
                    >
                      {marker.districtId ?? ""}
                    </span>
                    <img
                      className="map-marker-pin-img"
                      src={pinSrc}
                      alt=""
                      width={39}
                      height={48}
                      draggable={false}
                    />
                  </span>
                  {/* <span className="map-marker-side-title" style={{ color: titleColor }}>
                    {marker.label}
                  </span> */}
                </span>
              </button>
            </Marker>
          );
        })}

        {/* Last map child: the resource pins must draw above every district fill and label. */}
        {isNeighborhoodsOn && neighborhoodData && arePinImagesReady ? (
          <NeighborhoodOverlay
            assets={chatAssets ?? neighborhoodData.assets}
            neighborhoods={neighborhoodData.neighborhoods}
            districtBoundary={neighborhoodBoundary}
            activeCategories={chatResult ? CATEGORY_ORDER : neighborhoodCategories}
            chatResultKeys={chatResultKeys}
            selectedNeighborhood={selectedNeighborhood}
            hoveredNeighborhood={hoveredNeighborhood}
            hoveredAsset={hoveredAsset}
            selected={selectedAsset}
            onCloseSelected={() => setSelectedAsset(null)}
            districtId={NEIGHBORHOOD_DISTRICT_ID}
          />
        ) : null}
        {isNeighborhoodChatOpen && neighborhoodChat.origin ? (
          <Marker longitude={neighborhoodChat.origin.longitude} latitude={neighborhoodChat.origin.latitude}>
            <div className="nc-origin" role="img" aria-label="Your selected search point" />
          </Marker>
        ) : null}
      </Map>

      {isPickingChatPoint ? <div className="nc-point-picker" role="region" aria-label="Choose search location">
        <p>Click a point inside CD2, or move the map and use its center.</p>
        {chatPointError ? <p role="alert">{chatPointError}</p> : null}
        <button type="button" onClick={() => {
          const center = mapRef.current?.getMap().getCenter();
          if (center) chooseChatPoint({ longitude: center.lng, latitude: center.lat });
        }}>Use map center</button>
        <button type="button" onClick={() => setIsPickingChatPoint(false)}>Cancel</button>
      </div> : null}
      {isNeighborhoodChatOpen ? <NeighborhoodChatPanel chat={neighborhoodChat}
        loading={neighborhoodState.status === "loading" || neighborhoodState.status === "unavailable"}
        loadError={neighborhoodState.status === "error"} picking={isPickingChatPoint}
        onPick={() => { setChatPointError(null); setIsPickingChatPoint(true); }} onClose={closeNeighborhoodChat} /> : null}
      {chatResult && showChatResults && neighborhoodData && !isPickingChatPoint ? <NeighborhoodResults
        result={chatResult} neighborhoods={neighborhoodData.neighborhoods}
        onSelect={handleSelectAssetFromPanel} onClose={neighborhoodChat.clearResults} /> : null}

      {isNeighborhoodsOn && neighborhoodData && panelSelection && !showChatResults && !isPickingChatPoint ? (
        <ResourceDetailPanel
          selection={panelSelection}
          assets={neighborhoodData.assets}
          focus={assetFocus}
          sourceUrl={getPanelSourceUrl(neighborhoodData.neighborhoods, panelSelection)}
          districtId={NEIGHBORHOOD_DISTRICT_ID}
          onSelectAsset={handleSelectAssetFromPanel}
          onClose={() => {
            setPanelSelection(null);
            setAssetFocus(null);
            // The pin's highlight and popup belong to this panel; leaving them behind orphans
            // an enlarged, glowing pin with nothing on screen explaining it.
            setSelectedAsset(null);
          }}
        />
      ) : null}

      <div
        className={`map-district-pill-shell ${
          showDistrictPill && !districtOverviewOpen && isDistrictPillVisible && !isSearchExpanded
            ? "is-visible"
            : "is-hidden"
        }${hideMapChrome ? " map-district-pill-shell--elevated" : ""}`}
      >
        <span className="project-sidebar-tool-btn-with-hint">
          <button
            type="button"
            className="map-district-pill"
            onClick={() => {
              if (pillDistrictId != null) {
                onOpenDistrictOverview(pillDistrictId);
              }
            }}
            aria-label={pillDistrictId != null ? `Open District ${pillDistrictId} overview` : "District overview hidden"}
            aria-hidden={showDistrictPill && !districtOverviewOpen ? undefined : true}
            tabIndex={showDistrictPill && !districtOverviewOpen ? 0 : -1}
          >
            <span className="map-district-avatar" aria-hidden="true">
              {portraitSrc && !pillPortraitFailed ? (
                <img
                  src={portraitSrc}
                  alt=""
                  className="map-district-avatar-img"
                  onError={() => setPillPortraitFailed(true)}
                />
              ) : (
                <span className="map-district-avatar-initials">{initials}</span>
              )}
            </span>
            <span className="map-district-pill-copy">
              <span className="map-district-pill-name">{displayedName}</span>
              <span className="map-district-pill-sep" aria-hidden="true">
                {" "}
                •{" "}
              </span>
              <span className="map-district-pill-district">{displayedLabel}</span>
            </span>
          </button>
          <span className="project-sidebar-tool-btn-hint" aria-hidden="true">
            District Overview
          </span>
        </span>
      </div>

      {districtOverviewOpen || hideMapChrome ? null : (
        <>
          <div className="map-search-dock">
            <MapAddressSearch dismissSignal={searchDismissSignal} onExpandedChange={setIsSearchExpanded} />
          </div>

          <div className="map-control-stack map-control-stack--figma" aria-label="Map controls">
            <div className="map-figma-controls-wrap">
              <div className="map-control-pill map-control-pill--stacked map-control-pill--tools">
                <button
                  type="button"
                  className={`map-figma-ctrl-btn map-figma-ctrl-btn--expandable ${isInfoOpen ? "is-active" : ""}`}
                  aria-label="Toggle accessibility information"
                  aria-expanded={isInfoOpen}
                  onClick={() => {
                    setIsInfoOpen((current) => !current);
                    setIsDistrictFilterOpen(false);
                  }}
                >
                  <span className="map-figma-ctrl-btn-label">Accessibility</span>
                  <svg
                    className="map-figma-ctrl-icon"
                    width="100%"
                    height="100%"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15849 13.7588 7.52152 14.2151 8.06353C14.6713 8.60553 14.9211 9.29152 14.92 10C14.92 12 11.92 13 11.92 13M12 17H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span className="map-control-pill-rule" aria-hidden="true" />
                <button
                  type="button"
                  className={`map-figma-ctrl-btn map-figma-ctrl-btn--expandable ${isDistrictFilterOpen ? "is-active" : ""}`}
                  aria-label="Filter projects by district"
                  aria-expanded={isDistrictFilterOpen}
                  onClick={() => {
                    setIsDistrictFilterOpen((current) => !current);
                    setIsInfoOpen(false);
                  }}
                >
                  <span className="map-figma-ctrl-btn-label">Filter</span>
                  <svg
                    className="map-figma-ctrl-icon"
                    width="100%"
                    height="100%"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M3.38589 5.66687C2.62955 4.82155 2.25138 4.39889 2.23712 4.03968C2.22473 3.72764 2.35882 3.42772 2.59963 3.22889C2.87684 3 3.44399 3 4.57828 3H19.4212C20.5555 3 21.1227 3 21.3999 3.22889C21.6407 3.42772 21.7748 3.72764 21.7624 4.03968C21.7481 4.39889 21.3699 4.82155 20.6136 5.66687L14.9074 12.0444C14.7566 12.2129 14.6812 12.2972 14.6275 12.3931C14.5798 12.4781 14.5448 12.5697 14.5236 12.6648C14.4997 12.7721 14.4997 12.8852 14.4997 13.1113V18.4584C14.4997 18.6539 14.4997 18.7517 14.4682 18.8363C14.4403 18.911 14.395 18.9779 14.336 19.0315C14.2692 19.0922 14.1784 19.1285 13.9969 19.2012L10.5969 20.5612C10.2293 20.7082 10.0455 20.7817 9.89802 20.751C9.76901 20.7242 9.6558 20.6476 9.583 20.5377C9.49975 20.4122 9.49975 20.2142 9.49975 19.8184V13.1113C9.49975 12.8852 9.49975 12.7721 9.47587 12.6648C9.45469 12.5697 9.41971 12.4781 9.37204 12.3931C9.31828 12.2972 9.2429 12.2129 9.09213 12.0444L3.38589 5.66687Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {hasNeighborhoodMap(NEIGHBORHOOD_DISTRICT_ID) ? (
                  <>
                    <span className="map-control-pill-rule" aria-hidden="true" />
                    <button
                      type="button"
                      className={`map-figma-ctrl-btn map-figma-ctrl-btn--expandable ${
                        isNeighborhoodsOn ? "is-active" : ""
                      }`}
                      aria-label="Show neighborhood boundaries and resources"
                      aria-pressed={isNeighborhoodsOn}
                      onClick={() => {
                        // The flyout has its own X. Once closed, this button brings it back
                        // rather than tearing the overlay down and rebuilding it.
                        if (isNeighborhoodChatOpen) closeNeighborhoodChat();
                        if (isNeighborhoodsOn && !isNeighborhoodPanelOpen) {
                          setIsNeighborhoodPanelOpen(true);
                          setIsInfoOpen(false);
                          setIsDistrictFilterOpen(false);
                          return;
                        }
                        const next = !isNeighborhoodsOn;
                        setIsNeighborhoodsOn(next);
                        setIsNeighborhoodPanelOpen(next);
                        setIsInfoOpen(false);
                        setIsDistrictFilterOpen(false);
                        if (!next) {
                          setSelectedAsset(null);
                          setPanelSelection(null);
                          setAssetFocus(null);
                          setHoveredNeighborhood(null);
                          setHoveredAsset(null);
                          setShowLegislation(true);
                        } else {
                          // Legislation pins off by default so the neighbourhood layer is
                          // legible on its own; the flyout's checkbox brings them back.
                          setShowLegislation(false);
                          // Without this, toggling the layer on while looking at another part of
                          // the city shows an empty map and reads as broken.
                          const bounds = getDistrictAssetSource(NEIGHBORHOOD_DISTRICT_ID)?.bounds;
                          if (bounds) {
                            mapRef.current?.getMap().fitBounds(bounds, {
                              padding: 64,
                              duration: 700,
                            });
                          }
                        }
                      }}
                    >
                      <span className="map-figma-ctrl-btn-label">Neighborhoods</span>
                      <svg
                        className="map-figma-ctrl-icon"
                        width="100%"
                        height="100%"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M9 20L3 17V4l6 3m0 13 6-3m-6 3V7m6 10 6 3V7l-6-3m0 13V4m0 0L9 7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <span className="map-control-pill-rule" aria-hidden="true" />
                    <button type="button" className={`map-figma-ctrl-btn map-figma-ctrl-btn--expandable ${isNeighborhoodChatOpen ? "is-active" : ""}`}
                      aria-label="Open CD2 neighborhood chat" aria-expanded={isNeighborhoodChatOpen}
                      onClick={() => isNeighborhoodChatOpen ? closeNeighborhoodChat() : openNeighborhoodChat()}>
                      <span className="map-figma-ctrl-btn-label">Neighborhood chat</span>
                      <svg className="map-figma-ctrl-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M4 4h16v12H9l-5 4V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        <path d="M8 8h8M8 12h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </>
                ) : null}
              </div>

              <div className="map-control-pill map-control-pill--stacked">
                <span className="map-figma-ctrl-tooltip-wrap">
                  <span className="map-figma-ctrl-tooltip" aria-hidden="true">
                    Zoom In
                  </span>
                  <button
                    type="button"
                    className="map-figma-ctrl-btn"
                    aria-label="Zoom in"
                    onClick={() => handleZoom(0.65)}
                  >
                    <img src="/zoom-in-icon.svg" alt="" width={18} height={18} />
                  </button>
                </span>
                <span className="map-control-pill-rule" aria-hidden="true" />
                <span className="map-figma-ctrl-tooltip-wrap">
                  <span className="map-figma-ctrl-tooltip" aria-hidden="true">
                    Zoom Out
                  </span>
                  <button
                    type="button"
                    className="map-figma-ctrl-btn"
                    aria-label="Zoom out"
                    onClick={() => handleZoom(-0.65)}
                  >
                    <img src="/zoom-out-icon.svg" alt="" width={18} height={18} />
                  </button>
                </span>
              </div>

              {isInfoOpen ? (
                <div className="map-figma-flyout map-figma-flyout--info" aria-label="Accessibility information">
                  <div className="map-guidance-topbar">
                    <span className="map-guidance-topbar-title">Accessibility</span>
                    <button
                      type="button"
                      className="map-guidance-close-btn"
                      aria-label="Close map guidance"
                      onClick={() => setIsInfoOpen(false)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>

                  <div className="map-guidance-sections">
                    <section className="map-guidance-section" aria-label="Map guidance: map">
                      <h4 className="map-guidance-section-title">Map</h4>
                      <p className="map-guidance-section-body">
                        Use the district overlays for geographic context and the project markers for quick detail checks.
                      </p>
                    </section>

                    <section className="map-guidance-section" aria-label="Map guidance: icons">
                      <h4 className="map-guidance-section-title">Icons</h4>
                      <div className="map-guidance-icons" role="list" aria-label="Map icon legend">
                        {MAP_GUIDANCE_ICON_ITEMS.map((item) => {
                          const isExplained = explainedCategory === item.label;
                          return (
                            <div key={item.label} className="map-guidance-icon-item" role="listitem">
                              <div className="map-guidance-icon-head">
                                <img
                                  className="map-guidance-icon-img"
                                  src={item.src}
                                  alt=""
                                  width={26}
                                  height={32}
                                  draggable={false}
                                />
                                <span className="map-guidance-icon-label">{item.label}</span>
                              </div>
                              <button
                                type="button"
                                className="map-guidance-icon-explain"
                                aria-expanded={isExplained}
                                onClick={() =>
                                  setExplainedCategory((current) => (current === item.label ? null : item.label))
                                }
                              >
                                What does this mean
                              </button>
                              {isExplained ? (
                                <p className="map-guidance-icon-description">{categoryDescription(item.label)}</p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section className="map-guidance-section" aria-label="Map guidance: how to use">
                      <h4 className="map-guidance-section-title">How to Use</h4>
                      <div className="map-guidance-section-body map-guidance-howto">
                        {mapGuidanceHowToUse.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              ) : null}

              {isNeighborhoodsOn && isNeighborhoodPanelOpen ? (
                <div
                  className="map-figma-flyout map-figma-flyout--district-filter map-figma-flyout--neighborhood"
                  aria-label="Neighborhood resource categories"
                >
                  <div className="map-utility-header">
                    <strong>Neighborhood resources</strong>
                    <button
                      type="button"
                      className="map-flyout-close-btn"
                      aria-label="Close neighborhood resource filters"
                      onClick={() => setIsNeighborhoodPanelOpen(false)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                  <p>
                    Councils, parks, public-safety sites and projects in and around District{" "}
                    {NEIGHBORHOOD_DISTRICT_ID}.
                  </p>
                  <div className="map-neighborhood-legislation-toggle">
                    <label className="map-district-filter-option">
                      <input
                        type="checkbox"
                        checked={showLegislation}
                        onChange={() => setShowLegislation((current) => !current)}
                      />
                      <span>Also show council file pins</span>
                    </label>
                  </div>
                  <div
                    className="map-district-filter-actions"
                    role="group"
                    aria-label="Neighborhood category quick actions"
                  >
                    <button
                      type="button"
                      className="map-district-filter-action-btn"
                      onClick={() => setNeighborhoodCategories(CATEGORY_ORDER)}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="map-district-filter-action-btn"
                      onClick={() => setNeighborhoodCategories([])}
                    >
                      Deselect all
                    </button>
                  </div>
                  <div className="map-neighborhood-legend">
                    {CATEGORY_ORDER.map((category) => (
                      <label key={category} className="map-district-filter-option">
                        <input
                          type="checkbox"
                          checked={neighborhoodCategories.includes(category)}
                          onChange={() =>
                            setNeighborhoodCategories((current) =>
                              current.includes(category)
                                ? current.filter((item) => item !== category)
                                : CATEGORY_ORDER.filter(
                                    (item) => current.includes(item) || item === category,
                                  ),
                            )
                          }
                        />
                        {/* The pin itself, not a colour chip. The four hues are close enough
                            under tritanopia (safety vs district projects, ΔE 2.1) that the glyph
                            is what actually distinguishes them -- see CATEGORY_COLORS. */}
                        <img
                          className="map-neighborhood-legend-icon"
                          src={pinImageUrl(ASSET_PIN_SOURCES[category])}
                          alt=""
                          width={18}
                          height={18}
                        />
                        <span className="map-neighborhood-legend-label">
                          {CATEGORY_LABELS[category]}
                        </span>
                        <span className="map-neighborhood-legend-count">
                          {neighborhoodCounts[category] ?? 0}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="map-neighborhood-legend-note">
                    Outlines are LAHSA areas that only approximate council districts — the dashed
                    line is District {NEIGHBORHOOD_DISTRICT_ID}&rsquo;s actual edge.
                  </p>
                </div>
              ) : null}

              {isDistrictFilterOpen ? (
                <div className="map-figma-flyout map-figma-flyout--district-filter" aria-label="District project filters">
                  <div className="map-utility-header">
                    <strong>District filters</strong>
                    <span>Pins</span>
                  </div>
                  <p>Select council districts to show project pins on the map.</p>
                  <div className="map-district-filter-actions" role="group" aria-label="District filter quick actions">
                    <button
                      type="button"
                      className="map-district-filter-action-btn"
                      onClick={() => setSelectedDistrictIds(new Set(availableDistrictIds))}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="map-district-filter-action-btn"
                      onClick={() => {
                        setLastTouchedDistrictId(null);
                        setSelectedDistrictIds(new Set<number>());
                      }}
                    >
                      Deselect all
                    </button>
                  </div>
                  <div className="map-district-filter-grid">
                    {availableDistrictIds.map((districtId) => (
                      <label key={districtId} className="map-district-filter-option">
                        <input
                          type="checkbox"
                          checked={selectedDistrictIds.has(districtId)}
                          onChange={() => {
                            setLastTouchedDistrictId(districtId);
                            setSelectedDistrictIds((current) => {
                              const next = new Set(current);
                              if (next.has(districtId)) {
                                next.delete(districtId);
                              } else {
                                next.add(districtId);
                              }
                              return next;
                            });
                          }}
                        />
                        <span>{`District ${districtId}`}</span>
                      </label>
                    ))}
                  </div>

                  {availableCategories.length > 0 ? (
                    <div className="map-district-filter-categories">
                      <div className="map-utility-header">
                        <strong>Project categories</strong>
                        <span>Pins</span>
                      </div>
                      <p>Filter pins by project category.</p>
                      <div
                        className="map-district-filter-actions"
                        role="group"
                        aria-label="Project category filter quick actions"
                      >
                        <button
                          type="button"
                          className="map-district-filter-action-btn"
                          onClick={() => setSelectedCategories(new Set(availableCategories))}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          className="map-district-filter-action-btn"
                          onClick={() => setSelectedCategories(new Set<MarkerCategory>())}
                        >
                          Deselect all
                        </button>
                      </div>
                      <div className="map-district-filter-grid">
                        {availableCategories.map((category) => (
                          <label key={category} className="map-district-filter-option">
                            <input
                              type="checkbox"
                              checked={selectedCategories.has(category)}
                              onChange={() =>
                                setSelectedCategories((current) => {
                                  const next = new Set(current);
                                  if (next.has(category)) {
                                    next.delete(category);
                                  } else {
                                    next.add(category);
                                  }
                                  return next;
                                })
                              }
                            />
                            <span className="map-category-swatch-label">
                              <img
                                className="map-category-swatch"
                                src={PIN_SRC[category]}
                                alt=""
                                aria-hidden="true"
                                width={14}
                                height={15}
                                decoding="async"
                              />
                              {`${category}`}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {availableBodyGroups.length > 0 ? (
                    <div className="map-district-filter-categories">
                      <div className="map-utility-header">
                        <strong>Categories</strong>
                        <span>Pins</span>
                      </div>
                      <p>Filter pins by the specific bodies (committees, departments, etc.) involved.</p>
                      <div className="map-district-filter-actions" role="group" aria-label="Category filter quick actions">
                        <button
                          type="button"
                          className="map-district-filter-action-btn"
                          onClick={() => setSelectedBodies(new Set(allBodies))}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          className="map-district-filter-action-btn"
                          onClick={() => setSelectedBodies(new Set<string>())}
                        >
                          Deselect all
                        </button>
                      </div>
                      <div className="map-category-filter-list">
                        {availableBodyGroups.map((group) => {
                          const allSelected = group.bodies.every((body) => selectedBodies.has(body));
                          const someSelected = group.bodies.some((body) => selectedBodies.has(body));
                          const isExpanded = expandedCategories.has(group.category);
                          return (
                            <div key={group.category} className="map-category-filter-group">
                              <div className="map-category-filter-head">
                                <label className="map-district-filter-option map-category-filter-head-label">
                                  <TristateCheckbox
                                    checked={allSelected}
                                    indeterminate={someSelected && !allSelected}
                                    onChange={() =>
                                      setSelectedBodies((current) => {
                                        const next = new Set(current);
                                        if (allSelected) {
                                          group.bodies.forEach((body) => next.delete(body));
                                        } else {
                                          group.bodies.forEach((body) => next.add(body));
                                        }
                                        return next;
                                      })
                                    }
                                  />
                                  <span>{group.category}</span>
                                </label>
                                <button
                                  type="button"
                                  className="map-category-filter-toggle"
                                  aria-expanded={isExpanded}
                                  aria-label={`${isExpanded ? "See less of" : "See more of"} ${group.category}`}
                                  onClick={() =>
                                    setExpandedCategories((current) => {
                                      const next = new Set(current);
                                      if (next.has(group.category)) {
                                        next.delete(group.category);
                                      } else {
                                        next.add(group.category);
                                      }
                                      return next;
                                    })
                                  }
                                >
                                  {isExpanded ? "See less" : "See more"}
                                </button>
                              </div>
                              {isExpanded ? (
                              <div className="map-category-filter-items">
                                {group.bodies.map((body) => (
                                  <label key={body} className="map-district-filter-option">
                                    <input
                                      type="checkbox"
                                      checked={selectedBodies.has(body)}
                                      onChange={() =>
                                        setSelectedBodies((current) => {
                                          const next = new Set(current);
                                          if (next.has(body)) {
                                            next.delete(body);
                                          } else {
                                            next.add(body);
                                          }
                                          return next;
                                        })
                                      }
                                    />
                                    <span>{body}</span>
                                  </label>
                                ))}
                              </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      {hideMapChrome ? null : (
        <a
          className="map-feedback-button"
          href="https://forms.gle/kqi9Ex3VA47HhoC28"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open CityWise feedback form in a new tab"
          onClick={() => posthog?.capture("feedback_button_clicked")}
        >
          Give us your feedback!
        </a>
      )}
    </div>
  );
}
