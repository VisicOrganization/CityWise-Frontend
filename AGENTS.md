Please treat CityWise-Frontend as the React application repository for the CityWise MVP.

Important context:
- prefer React + TypeScript + Vite
- use `project` as the user-facing product vocabulary
- use `react-map-gl` over direct `maplibre-gl` integration for React map work
- keep curated district copy and district GeoJSON local to the frontend for MVP
- do not add fake markers, inferred anchors, or geocoding work unless explicitly requested

Git workflow requirements:
- Before making frontend changes, check the current branch inside `CityWise-Frontend`.
- If the branch is `main`, do not work from it. Create or switch to a task branch such as `codex/<task-slug>`.
- If the branch is already non-`main`, confirm it is the correct branch for the requested frontend work before proceeding.
- Never commit to `main`.
- Never push directly to `main`.
- Use pull requests to merge frontend changes into `main`.
- Once the implementation approach is settled with the user, make logical commits on the working branch as work is completed.
- Pushing to the active frontend working branch, including `codex/*`, is allowed.

Local development:
- prefer the Docker-based workflow in `compose.local.yml`
- choose host ports that do not clash with an existing local developer environment
- agent-friendly default ports are:
  - frontend host port `15173`
  - backend host port `18100`
- configure frontend ports and API base URL in `.env.local`
- configure published frontend port mapping in `compose.local.yml`
- exact local startup commands:
  - `cp .env.example .env.local`
  - `docker compose -f compose.local.yml --env-file .env.local up --build`
- default demo route:
  - `http://localhost:15173/`
  - map mock: `http://localhost:15173/map`
  - district overview: `http://localhost:15173/districts/11`

Validation commands:
- run lint with `npm run lint`
- run tests with `npm run test`
- run a type check with `npm run typecheck`
- run a production build with `npm run build`

Map work:
- start with [react-map-gl docs/examples](/home/codex/workspace/VISIC/maplibre/react-map-gl/docs/README.md)
- then verify lower-level behavior in [maplibre-gl-js](/home/codex/workspace/VISIC/maplibre/maplibre-gl-js/README.md)
- confirm style/source/layer validity in [maplibre-style-spec](/home/codex/workspace/VISIC/maplibre/maplibre-style-spec/README.md)

Implementation boundaries:
- keep MVP scope tight around the district overview page and project detail support
- do not expand into search/filter UI, auth, admin tooling, or backend-managed editorial content
