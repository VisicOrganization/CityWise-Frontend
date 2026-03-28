Please treat CityWise-Frontend as the React application repository for the CityWise MVP.

Important context:
- prefer React + TypeScript + Vite
- use `project` as the user-facing product vocabulary
- use `react-map-gl` over direct `maplibre-gl` integration for React map work
- keep curated district copy and district GeoJSON local to the frontend for MVP
- do not add fake markers, inferred anchors, or geocoding work unless explicitly requested

Local development:
- prefer the Docker-based workflow in `compose.local.yml`
- choose host ports that do not clash with an existing local developer environment
- agent-friendly default ports are:
  - frontend host port `15173`
  - backend host port `18100`
- configure frontend ports and API base URL in `.env.local`
- configure published frontend port mapping in `compose.local.yml`

Map work:
- start with [react-map-gl docs/examples](/home/codex/workspace/VISIC/maplibre/react-map-gl/docs/README.md)
- then verify lower-level behavior in [maplibre-gl-js](/home/codex/workspace/VISIC/maplibre/maplibre-gl-js/README.md)
- confirm style/source/layer validity in [maplibre-style-spec](/home/codex/workspace/VISIC/maplibre/maplibre-style-spec/README.md)

Implementation boundaries:
- keep MVP scope tight around the district overview page and project detail support
- do not expand into search/filter UI, auth, admin tooling, or backend-managed editorial content
