<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the CityWise frontend. The `posthog-js` and `@posthog/react` packages were installed, PostHog was initialized in `src/main.tsx` with `PostHogProvider` wrapping the app, and 13 custom events were added across 6 files to track the full user journey — from landing page search through map exploration, district overviews, and project detail engagement.

| Event | Description | File |
|---|---|---|
| `address_searched` | User submits an address search from the landing page hero form | `src/features/landing/LandingPage.tsx` |
| `address_suggestion_selected` | User clicks an autocomplete suggestion from the landing page search results | `src/features/landing/LandingPage.tsx` |
| `map_address_searched` | User submits an address search from the in-map search bar | `src/features/map/MapAddressSearch.tsx` |
| `map_address_suggestion_selected` | User selects an autocomplete suggestion from the in-map address search | `src/features/map/MapAddressSearch.tsx` |
| `project_marker_clicked` | User clicks a project pin on the map to open the project details sidebar | `src/features/map/MapPage.tsx` |
| `district_overview_opened` | User opens the district overview sheet (via district pill button or district boundary click) | `src/features/map/MapPage.tsx` |
| `project_external_link_clicked` | User opens the external government document link from the project details panel | `src/features/map/ProjectDetailsPanel.tsx` |
| `voting_record_opened` | User toggles the voting record popover in the project details panel | `src/features/map/ProjectDetailsPanel.tsx` |
| `timeline_view_opened` | User toggles the expanded timeline view in the project details panel | `src/features/map/ProjectDetailsPanel.tsx` |
| `project_panel_expanded` | User expands the project details sidebar to full width | `src/features/map/ProjectDetailsPanel.tsx` |
| `project_opened_from_district` | User taps 'Open on Map' on a project card within the district overview sheet | `src/features/districts/DistrictOverviewSheet.tsx` |
| `district_about_expanded` | User clicks 'Read more' to expand the truncated about section in the district overview | `src/features/districts/DistrictOverviewSheet.tsx` |
| `feedback_button_clicked` | User clicks the 'Give us your feedback!' button on the map | `src/features/map/CityMap.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/368330/dashboard/1471823
- **Insight — Search to Project Click Funnel**: https://us.posthog.com/project/368330/insights/Tk3iPGvM
- **Insight — Project Marker Clicks Over Time**: https://us.posthog.com/project/368330/insights/xwP2U3qK
- **Insight — District Overview Opens Over Time**: https://us.posthog.com/project/368330/insights/YPcvYKRf
- **Insight — Project Detail Feature Usage**: https://us.posthog.com/project/368330/insights/VGAep0n2
- **Insight — Full Engagement Funnel**: https://us.posthog.com/project/368330/insights/O7WxSAVm

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
