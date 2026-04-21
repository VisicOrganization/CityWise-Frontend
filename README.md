# CityWise-Frontend

`CityWise-Frontend` is the React + TypeScript + Vite frontend for the CityWise MVP.

## Table Of Contents

- [Structure](#structure)
- [Requirements](#requirements)
- [Setup](#setup)
- [Configuration](#configuration)
- [Quick Start](#quick-start)
- [Common Workflows](#common-workflows)
- [Testing And Validation](#testing-and-validation)
- [Deployment Notes](#deployment-notes)
- [Current Boundaries](#current-boundaries)

## Structure

```text
CityWise-Frontend/
  public/            static frontend assets
  src/app/           app bootstrap and route composition
  src/features/      route-facing product areas
  src/shared/api/    backend client and contracts
  src/shared/map/    reusable map helpers and district boundary utilities
  src/shared/mock/   demo-only fixtures and geocoding helpers
  src/shared/ui/     shared shell-level UI
  src/test/          frontend test setup
```

## Requirements

- Node.js 20+
- npm
- optional local Docker for the preferred frontend workflow

The project tracks dependencies in:

- `package.json` for runtime and scripts
- `package-lock.json` for reproducible installs

The frontend expects the backend API to be available separately. For the MVP, the main read-path assumptions come from `CityWise-Backend`.

## Setup

From `CityWise-Frontend/`:

```bash
npm install
```

For the preferred local Docker workflow:

```bash
cp .env.example .env
docker compose up --build -d
```

## Configuration

Environment variables are read from `.env` for the local Docker workflow.

Expected settings in `.env`:

- `FRONTEND_HOST_PORT`
- `VITE_PORT`
- `VITE_API_BASE_URL`

Recommended non-clashing defaults:

- `FRONTEND_HOST_PORT=15173`
- `VITE_PORT=5173`
- `VITE_API_BASE_URL=http://localhost:18100`

For local Docker work, copy `.env.example` to `.env`. The local `docker compose` workflow is intentionally unsupported without that file.

The frontend container always serves the Vite dev server on `VITE_PORT` internally. `FRONTEND_HOST_PORT` only controls the host-side published port.

`VITE_API_BASE_URL` should point at the backend API. For the documented local MVP flow, that is the backend Docker host port `18100`.
Address search geocoding uses this same backend base URL and calls `GET /nominatim/search`.

## Quick Start

### Docker-first

If you want the frontend running locally with the least setup:

```bash
cp .env.example .env
docker compose up --build -d
```

This starts the local stack from [`compose.yml`](./compose.yml):

- `frontend`

Published host ports come from `.env`:

- `FRONTEND_HOST_PORT` for the browser entrypoint
- `VITE_PORT` for the container-side Vite port

Open:

```text
http://localhost:15173/
http://localhost:15173/map
http://localhost:15173/districts/11
```

### Without Docker

You can also run the frontend directly:

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

If you do that, make sure `VITE_API_BASE_URL` points at a running backend.
For host-run Vite on `http://localhost:5173`, the backend must allow that origin via `FRONTEND_ORIGINS`.

## Common Workflows

### Run The Frontend

Docker:

```bash
cp .env.example .env
docker compose up --build -d
```

Without Docker:

```bash
npm install
npm run dev
```

Current routes:

- `GET /` landing page
- `GET /about` throwaway demo page
- `GET /map` citywide demo map
- `GET /districts/{district_id}` district overview route

### Run With The Backend

The frontend is intended to run alongside `CityWise-Backend`.

From [`CityWise-Backend`](/home/codex/workspace/VISIC/CityWise-Backend):

```bash
cp .env.example .env
docker compose up --build -d db api
docker compose run --rm scrape
```

Then point the frontend at:

```text
VITE_API_BASE_URL=http://localhost:18100
```

Manual backend checks:

```bash
curl -i http://127.0.0.1:18100/health
curl -i "http://127.0.0.1:18100/nominatim/search?q=test&format=jsonv2&limit=1"
curl -i "http://127.0.0.1:18100/districts/11/projects?page=1&page_size=3"
curl -i http://127.0.0.1:18100/projects/25-0358
```

Expected browser geocoding request shape:

```text
http://localhost:18100/nominatim/search?q=<query>&format=jsonv2&limit=4
```

### Map And District MVP Assumptions

- project cards come from backend `GET /districts/{district_id}/projects`
- project details come from backend `GET /projects/{project_id}`
- district copy remains frontend-local for MVP
- LA city council district GeoJSON remains frontend-local for MVP
- the React map implementation uses `react-map-gl` over direct MapLibre integration
- the district overview route is still part of the MVP slice and must remain routable

### Demo-only Behavior

- the landing page uses mock-only content
- the `/map` screen uses a general LA-focused demo map with one pin per backend project that has a valid district
- project pins are district-aware but not geographically accurate; they are deterministically nudged within district shapes
- the top district pill reacts to project-pin or district-boundary clicks and opens the district overview
- the map search uses a demo geocoding flow and drops a generated sample marker at the searched location
- clicking a geocoded search marker still uses a real backend project detail payload to keep the demo interactive
- the district overview screen uses frontend-local representative/contact/about copy and deterministic fake budgets
- the `/about` route is intentionally throwaway demo content

## Testing And Validation

Preferred validation entry points:

```bash
npm run lint
npm run test
npm run typecheck
npm run build
```

`lint` and `typecheck` both run `tsc --noEmit`.

The test suite uses Vitest with a jsdom environment and focuses on:

- route rendering behavior
- map demo interactions
- district page routing behavior
- shared map-layer and marker utilities

## Deployment Notes

The repo currently includes GitHub Pages deployment wiring:

- `.github/workflows/deploy-gh-pages.yml`
- `CNAME`

`vite.config.ts` switches its base path only when `DEPLOY_TARGET=github-pages`. For all other builds, the app uses `/`.

If deployment hosting changes, update both the deployment workflow/config and any repository-level custom-domain setup so frontend deployment docs do not drift from reality.

## Current Boundaries

- `project` is the frontend-facing product concept, even when the backend persistence model still reflects council files
- MVP scope stays tight around the landing page, citywide map demo, district overview route, and project detail support
- district search/filter UI, auth, admin tooling, backend-managed editorial content, and real geocoding are intentionally out of scope
- district GeoJSON and curated district copy remain frontend-local for MVP
- the frontend assumes backend district/project responses are read-only data sources and does not perform write flows
