import { useState } from "react";

import { getProjectDetail } from "../../shared/api/client";
import type { DistrictProjectCard, ProjectDetail } from "../../shared/api/contracts";
import type { MapMarker } from "../../shared/map/mapTypes";

interface UseProjectDetailState {
  activeProject: ProjectDetail | null;
  detailsError: string | null;
  isDetailsLoading: boolean;
  loadProjectForMarker: (marker: MapMarker, projectCards: DistrictProjectCard[]) => Promise<void>;
  resetProjectDetail: () => void;
}

export function useProjectDetail(): UseProjectDetailState {
  const [activeProject, setActiveProject] = useState<ProjectDetail | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  async function loadProjectForMarker(marker: MapMarker, projectCards: DistrictProjectCard[]) {
    setActiveProject(null);
    setDetailsError(null);
    setIsDetailsLoading(true);

    try {
      if (marker.kind === "project" && marker.projectId) {
        const detail = await getProjectDetail(marker.projectId);
        setActiveProject(detail);
        return;
      }

      if (projectCards.length === 0) {
        throw new Error("No projects were returned by the backend.");
      }

      const randomIndex = Math.floor(Math.random() * projectCards.length);
      const selectedProject = projectCards[randomIndex] ?? projectCards[0];
      const detail = await getProjectDetail(selectedProject.id);
      setActiveProject(detail);
    } catch {
      setDetailsError("Could not load a live backend project for this marker.");
    } finally {
      setIsDetailsLoading(false);
    }
  }

  function resetProjectDetail() {
    setActiveProject(null);
    setDetailsError(null);
    setIsDetailsLoading(false);
  }

  return {
    activeProject,
    detailsError,
    isDetailsLoading,
    loadProjectForMarker,
    resetProjectDetail,
  };
}
