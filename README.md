# CityWise-Frontend

`CityWise-Frontend` is the React + TypeScript + Vite frontend for the CityWise MVP.

## MVP slice

- one district overview route at `/districts/:districtId`
- project cards sourced from the backend `GET /districts/{district_id}/projects` endpoint
- frontend-local curated district copy
- frontend-local LA council district GeoJSON overlay rendered with `react-map-gl` and MapLibre

## Local Docker workflow

Create `.env.local` from `.env.example` and choose host ports that do not clash with your local environment.

Recommended non-clashing defaults:

- frontend host port: `15173`
- backend host port: `18100`

Run:

```bash
docker compose -f compose.local.yml --env-file .env.local up --build
```

Key settings:

- `FRONTEND_HOST_PORT` controls the published frontend port
- `VITE_PORT` controls the port inside the container/dev server
- `VITE_API_BASE_URL` points the frontend at the backend API

## Validation

```bash
npm install
npm run typecheck
npm run test
npm run build
```
