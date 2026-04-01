# CityWise Frontend Master Guide

This guide is meant to help a new engineer understand how the frontend is organized, what is real versus demo-only, and where to make changes safely.

## 1. What This Frontend Actually Is

CityWise frontend is a React + TypeScript + Vite app for the MVP.

It currently has three meaningful user-facing surfaces:

1. landing page at `/`
2. map demo at `/map`
3. district overview at `/districts/:districtId`

The most important mental model is this:

- some UI content is driven by the backend
- some UI content is intentionally frontend-local for MVP/demo purposes
- the codebase is organized so route-facing product code lives in `features/`, while reusable or cross-feature code lives in `shared/`

## 2. High-Level Architecture

Current frontend structure:

```text
src/
  app/           app bootstrap and route composition
  features/      route-facing product areas
  shared/api/    backend client and response contracts
  shared/map/    reusable map helpers and district geometry utilities
  shared/mock/   demo-only fixtures and geocoding helpers
  shared/ui/     cross-feature shell UI
```

Think of it this way:

- `app/` decides what routes exist
- `features/` owns actual product screens and feature-specific hooks/components
- `shared/` holds code that is reused or should not be owned by one feature

## 3. Routes And Product Surfaces

The route map lives in:

- [`src/app/routes.tsx`](/home/codex/workspace/VISIC/CityWise-Frontend/src/app/routes.tsx)

Current routes:

- `/` → landing page
- `/about` → demo/about page
- `/map` → citywide map demo
- `/districts/:districtId` → district overview page

That route file is intentionally thin. If you are looking for real behavior, do not stay in `app/`; jump into the feature directory for the route.

## 4. Directory-By-Directory Breakdown

## `src/app/`

Important files:

- [`src/app/App.tsx`](/home/codex/workspace/VISIC/CityWise-Frontend/src/app/App.tsx)
- [`src/app/routes.tsx`](/home/codex/workspace/VISIC/CityWise-Frontend/src/app/routes.tsx)

What lives here:

- top-level app composition
- route registration

What should not live here:

- feature-specific loading logic
- backend fetch logic
- demo fixtures

This layer should stay mostly declarative.

## `src/features/landing/`

Important file:

- [`src/features/landing/LandingPage.tsx`](/home/codex/workspace/VISIC/CityWise-Frontend/src/features/landing/LandingPage.tsx)

What it does:

- renders the product entry page
- captures an address-style search string
- forwards the user into `/map` with query params

Important boundary:

- this page is mostly presentation plus simple navigation behavior
- it is not the main data-integration surface

## `src/features/districts/`

Important files:

- [`src/features/districts/DistrictOverviewPage.tsx`](/home/codex/workspace/VISIC/CityWise-Frontend/src/features/districts/DistrictOverviewPage.tsx)
- [`src/features/districts/useDistrictProjects.ts`](/home/codex/workspace/VISIC/CityWise-Frontend/src/features/districts/useDistrictProjects.ts)
- [`src/features/districts/DistrictMap.tsx`](/home/codex/workspace/VISIC/CityWise-Frontend/src/features/districts/DistrictMap.tsx)
- [`src/features/districts/districtContent.ts`](/home/codex/workspace/VISIC/CityWise-Frontend/src/features/districts/districtContent.ts)

What this feature owns:

- district overview route
- district-specific project loading
- district map rendering on the overview page
- frontend-local district profile/copy

Important behavior split:

- project list data is backend-driven
- district biography/contact/impact content is frontend-local for MVP

This is one of the most important frontend boundaries to understand. The district page looks unified in the UI, but the underlying sources are mixed:

- real backend project records
- local district profile/demo content

## `src/features/map-demo/`

Important files:

- [`src/features/map-demo/MapDemoPage.tsx`](/home/codex/workspace/VISIC/CityWise-Frontend/src/features/map-demo/MapDemoPage.tsx)
- [`src/features/map-demo/useMapDemoData.ts`](/home/codex/workspace/VISIC/CityWise-Frontend/src/features/map-demo/useMapDemoData.ts)
- [`src/features/map-demo/useProjectDetail.ts`](/home/codex/workspace/VISIC/CityWise-Frontend/src/features/map-demo/useProjectDetail.ts)
- [`src/features/map-demo/CityDemoMap.tsx`](/home/codex/workspace/VISIC/CityWise-Frontend/src/features/map-demo/CityDemoMap.tsx)
- [`src/features/map-demo/ProjectDetailsPanel.tsx`](/home/codex/workspace/VISIC/CityWise-Frontend/src/features/map-demo/ProjectDetailsPanel.tsx)
- [`src/features/map-demo/projectMarkers.ts`](/home/codex/workspace/VISIC/CityWise-Frontend/src/features/map-demo/projectMarkers.ts)

What this feature owns:

- the citywide map demo route
- map selection state
- marker generation
- project detail loading for the side panel
- search interaction on the map

Important product fact:

- this route is a hybrid of real backend data and deliberate demo behavior

Examples:

- real backend project records are used
- district geometry is frontend-local
- marker placement is deterministic demo logic, not real geocoding for projects
- search uses a demo geocoding helper
- clicking a search result can still end up showing a real backend project to keep the experience feeling alive

If you change this route, first decide whether the change belongs to:

- real backend-driven behavior
- presentation behavior
- demo scaffolding that should eventually be removed or replaced

## `src/features/about/`

Important file:

- [`src/features/about/AboutPage.tsx`](/home/codex/workspace/VISIC/CityWise-Frontend/src/features/about/AboutPage.tsx)

This page is intentionally low-stakes and demo-oriented.

Do not use it as an architectural model for more important screens.

## `src/shared/api/`

Important files:

- [`src/shared/api/client.ts`](/home/codex/workspace/VISIC/CityWise-Frontend/src/shared/api/client.ts)
- [`src/shared/api/contracts.ts`](/home/codex/workspace/VISIC/CityWise-Frontend/src/shared/api/contracts.ts)

What lives here:

- fetch wrappers for backend endpoints
- shared TypeScript response contracts

This is the main integration boundary with the backend.

Current backend-facing calls:

- `getDistrictProjects`
- `getProjectDetail`

If backend response shape changes, this directory should be one of the first places you inspect.

## `src/shared/map/`

Important files:

- [`src/shared/map/districtBoundaries.ts`](/home/codex/workspace/VISIC/CityWise-Frontend/src/shared/map/districtBoundaries.ts)
- [`src/shared/map/districtLayers.ts`](/home/codex/workspace/VISIC/CityWise-Frontend/src/shared/map/districtLayers.ts)

What lives here:

- district boundary loading
- geometry helpers
- shared layer definitions for MapLibre/react-map-gl usage

This code should stay general-purpose enough to be reused by both district and map-demo features.

## `src/shared/mock/`

Important files:

- [`src/shared/mock/mapDemo.ts`](/home/codex/workspace/VISIC/CityWise-Frontend/src/shared/mock/mapDemo.ts)
- [`src/shared/mock/demoGeocoding.ts`](/home/codex/workspace/VISIC/CityWise-Frontend/src/shared/mock/demoGeocoding.ts)

This directory is extremely important for understanding the frontend honestly.

This is where demo-only behavior is kept on purpose.

Examples:

- district roster/demo district metadata
- landing page prompt content
- map-demo search behavior
- generated search markers

If a behavior feels a little fake in the UI, it probably belongs here.

## `src/shared/ui/`

Important file:

- [`src/shared/ui/AppShell.tsx`](/home/codex/workspace/VISIC/CityWise-Frontend/src/shared/ui/AppShell.tsx)

What it does:

- provides the top navigation and shell wrapper
- gives feature pages a common layout frame

This is the right place for truly shared layout chrome, not feature-specific content.

## 5. Real Data vs Demo Data

This is the most important conceptual boundary in the frontend.

### Real backend-driven data

Comes from the backend API and is represented in `shared/api/`.

Examples:

- district project cards
- project detail payloads
- project voting/timeline/document data

### Frontend-local but still intentional MVP data

Kept locally because there is no backend-managed source yet.

Examples:

- district biography/contact/profile content
- district representative display metadata
- local GeoJSON district boundaries in `public/data/`

### Demo-only scaffolding

Intentionally fake or provisional behavior that should not be mistaken for production-ready modeling.

Examples:

- map search geocoding flow
- generated search marker behavior
- deterministic marker placement inside district polygons
- some “alive for demo” detail-panel behavior

When making changes, always decide which of those three categories you are touching.

## 6. End-To-End Data Flow

The simplest way to understand the frontend is to follow the main user flows.

### District overview flow

1. route `/districts/:districtId` renders `DistrictOverviewPage`
2. `useDistrictProjects` calls `getDistrictProjects`
3. `shared/api/client.ts` hits the backend
4. page renders returned project cards
5. local district content from `districtContent.ts` fills in the rest of the page
6. `DistrictMap` renders the local district boundary geometry

### Map demo flow

1. route `/map` renders `MapDemoPage`
2. `useMapDemoData` loads district boundaries and backend project cards
3. `projectMarkers.ts` turns project cards into demo markers
4. `CityDemoMap` renders the map and markers
5. selecting a marker calls `useProjectDetail`
6. `useProjectDetail` fetches backend project detail when needed
7. `ProjectDetailsPanel` renders the detail state

### Landing flow

1. `/` renders `LandingPage`
2. user enters a search string
3. app navigates to `/map?q=...`
4. map page consumes the query param and kicks off the demo search flow

## 7. Where To Make Changes

Use this quick map when deciding where a change belongs.

If you are changing route composition:

- start in `src/app/routes.tsx`

If you are changing district overview behavior:

- start in `src/features/districts/`

If you are changing map demo behavior:

- start in `src/features/map-demo/`

If you are changing backend integration or contracts:

- start in `src/shared/api/`

If you are changing general map helpers or layer configuration:

- start in `src/shared/map/`

If you are changing intentionally fake/demo logic:

- start in `src/shared/mock/`

If you are changing shared shell/layout:

- start in `src/shared/ui/`

## 8. Contribution Heuristics

These are the main patterns worth preserving.

### Keep route files thin

Routes should compose feature pages, not contain feature logic.

### Keep feature hooks close to their feature

Examples already in use:

- `useDistrictProjects`
- `useMapDemoData`
- `useProjectDetail`

If the state or loading behavior is feature-specific, keep it in the feature directory.

### Do not let `shared/` turn into a junk drawer

Only move code into `shared/` if:

- it is reused
- it is conceptually cross-feature
- or it is a clean integration boundary like API contracts

### Be explicit about demo-only behavior

If you introduce more temporary behavior, keep it obviously separate from real integration code.

### Preserve MVP boundaries

This repo is intentionally narrow right now.

Avoid casually expanding into:

- auth
- admin tooling
- broad search/filter systems
- backend-managed editorial CMS-style content

unless the work explicitly calls for it.

## 9. Testing And Validation

Useful local commands:

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

What tests currently protect:

- route behavior
- district overview rendering
- map-demo interactions
- map layer and marker helper logic

The tests are practical and UI-focused, which is appropriate for the current app size.

## 10. Local Environment

Frontend-local environment settings live in `.env.local`.

Important ones:

- `FRONTEND_HOST_PORT`
- `VITE_PORT`
- `VITE_API_BASE_URL`

Preferred local Docker flow:

```bash
cp .env.example .env.local
docker compose -f compose.local.yml --env-file .env.local up --build
```

Default useful URLs:

- `http://localhost:15173/`
- `http://localhost:15173/map`
- `http://localhost:15173/districts/11`

## 11. What To Ask When Something Breaks

When debugging, ask these in order:

1. Is the issue in route wiring, feature logic, shared integration, or demo scaffolding?
2. Is the wrong data coming from the backend, or is the frontend shaping/rendering it incorrectly?
3. Is this real product behavior or a demo-only helper acting as designed?
4. Is the bug specific to district overview, map demo, or shared UI?
5. Is the breakage in rendering, async loading state, navigation, or map interaction?

Those questions usually narrow the problem quickly.

## 12. Short Version

If you only remember a few things, remember these:

- `app/` wires routes
- `features/` owns screens and feature-specific hooks
- `shared/api/` is the backend contract boundary
- `shared/mock/` is where fake/demo behavior should stay obvious
- the district page is a mix of backend data and local profile content
- the map page is intentionally hybrid and demo-heavy
- most frontend changes start by deciding whether they belong to a feature, a shared integration boundary, or demo scaffolding
