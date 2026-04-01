# CityWise-Frontend

`CityWise-Frontend` is the React + TypeScript + Vite frontend for the CityWise MVP.

## Structure

```text
src/
  app/           app bootstrap and route composition
  features/      route-facing product areas (landing, districts, map demo)
  shared/api/    backend client and contracts
  shared/map/    reusable map helpers and district boundary utilities
  shared/mock/   demo-only fixtures and geocoding helpers
  shared/ui/     shared shell-level UI
```

## MVP slice

- landing page entry route at `/`
- general mock map route at `/map`
- one district overview route at `/districts/:districtId`
- project cards sourced from the backend `GET /districts/{district_id}/projects` endpoint
- frontend-local curated district copy
- frontend-local LA council district GeoJSON overlay rendered with `react-map-gl` and MapLibre

## Mock screen assumptions

- the landing page uses mock-only content
- the `/map` screen uses a general LA-focused demo map with one pin per backend project that has a valid district
- the `/map` screen overlays the frontend-local district GeoJSON with hard-coded district colors and a zoom-based fill fade so boundaries read clearly at city scale
- the `/map` screen includes a frontend-local basemap selector with a few standard demo options
- the district pill at the top of `/map` updates when you click either a project pin or a district boundary so the demo visibly reacts to map exploration
- the district pill is clickable and opens the district overview route for the currently selected district
- the `/map` search uses a demo geocoding hack and drops a generated sample marker at the searched location so the map feels alive before the side panel exists
- clicking a project pin opens a details panel for that same backend project record and shows its title, voting record, and timeline
- the district overview route remains available for the backend-driven MVP slice

## Demo-only hacks

- each backend project pin is placed by taking its district boundary center and applying a deterministic nudge, so the pins are district-aware but not geographically accurate
- the map pin layout is a demo party trick: it scatters every valid-district project into its district polygon without any real project coordinates, clustering, or collision handling
- the district representative names in the top pill are a frontend-local demo roster rather than a backend-backed source of truth
- the district overview page uses frontend-local demo contact and biography content, plus deterministic fake budgets derived from district id and project id
- the `/map` geocoding flow drops a generated sample marker at the searched location instead of creating a production-quality place or project record
- clicking a geocoded search marker still uses a random real backend project to keep the demo feeling alive before a real search-to-record model exists
- the `/about` route is intentionally a throwaway animated joke page for the demo and should be removed once real about-page content exists

## Local Docker workflow

Create `.env.local` from `.env.example` and choose host ports that do not clash with your local environment.

Recommended non-clashing defaults:

- frontend host port: `15173`
- backend host port: `18100`

Run:

```bash
cp .env.example .env.local
docker compose -f compose.local.yml --env-file .env.local up --build
```

Run the backend alongside it from [CityWise-Backend](/home/codex/workspace/VISIC/CityWise-Backend):

```bash
cp .env.example .env.local
docker compose -f compose.local.yml --env-file .env.local up --build -d db api
docker compose -f compose.local.yml --env-file .env.local run --rm seed
```

Then open:

```text
http://localhost:15173/
http://localhost:15173/map
http://localhost:15173/districts/11
```

Key settings:

- `FRONTEND_HOST_PORT` controls the published frontend port
- `VITE_PORT` controls the port inside the container/dev server
- `VITE_API_BASE_URL` points the frontend at the backend API
- change them in `.env.local`

## Validation

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```
