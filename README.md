# CityWise-Frontend

`CityWise-Frontend` is the React + TypeScript + Vite frontend for the CityWise MVP.

## MVP slice

- landing page entry route at `/`
- general mock map route at `/map`
- one district overview route at `/districts/:districtId`
- project cards sourced from the backend `GET /districts/{district_id}/projects` endpoint
- frontend-local curated district copy
- frontend-local LA council district GeoJSON overlay rendered with `react-map-gl` and MapLibre

## Mock screen assumptions

- the landing page and `/map` view use mock-only content and markers
- the `/map` screen uses a general LA-focused mock map, not backend data
- the `/map` search uses a demo geocoding hack and drops a generated sample marker at the searched location so the map feels alive before the side panel exists
- the details side panel is intentionally not implemented yet
- the district overview route remains available for the backend-driven MVP slice

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
