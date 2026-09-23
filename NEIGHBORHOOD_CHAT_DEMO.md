# CD2 neighborhood chat demo

This prototype adds a resource-only chat to `/map`. The control is directly below **Neighborhoods**. It uses the committed Council District 2 resource GeoJSON already used by the neighborhood cards, so the chat never maintains a second copy of addresses or coordinates.

## Data flow

1. The frontend loads `public/data/cd2-civic-assets.geojson` and the neighborhood polygons through the existing CD2 loader.
2. A question is sent to `POST /neighborhood-chat/interpret`. The local backend asks the configured Azure deployment for a constrained intent JSON object.
3. The frontend validates that intent, matches it against the loaded records, computes Haversine distance when the user selected a map point, and writes the short answer from card fields.
4. Matching records are rendered as existing resource cards and highlighted with their composite `category|neighborhood|label` key.

The model does not provide addresses, coordinates, distance, URLs, IDs, or factual prose. The backend endpoint does not query the project database, index PDFs, or persist a chat session.

## Supported demo behavior

- Find parks, police, fire, libraries, neighborhood councils, community organizations, businesses, markets, arts, housing, district-office, and transport resources.
- Park searches include reviewed park/recreation labels that are currently grouped under district projects.
- Neighborhood filters include shared facilities through their `serves` values.
- Nearest searches require a user-selected point inside CD2 and return up to three approximate straight-line matches.
- Resource cards expose only recorded address, phone, email, website, meeting information, and serving neighborhoods. Missing fields are reported as unrecorded.
- Resources outside CD2 remain eligible when their cards say they serve CD2 neighborhoods; their containing district is shown.
- Off-topic questions, prompt-injection text, hours, availability, directions, amenities, and other unsupported constraints are refused or marked unsupported.

## Run locally

The frontend `.env` uses `VITE_API_BASE_URL=http://localhost:18100`. A local database holds no council files, so `.env` also sets `VITE_PROJECTS_API_BASE_URL=https://dev.api.citywise.app`: the legislation pins under **Also show council file pins** and their detail panels read from the deployed backend, while the chat endpoint stays local. Unset it and the pins disappear, because there are no local projects to draw. The backend worktree is `/private/tmp/citywise-cd2-neighborhood-backend` on branch `codex/cd2-neighborhood-chat`, created from the latest `origin/main`. The existing backend checkout and its uncommitted work were not changed.

Start the isolated backend and database from that worktree:

```sh
docker compose -p citywise-backend -f /private/tmp/citywise-cd2-neighborhood-backend/compose.yml \
  --env-file /private/tmp/citywise-cd2-neighborhood-backend/.env up --build -d db api
```

Start or recreate the frontend from this repository:

```sh
docker compose up --build -d frontend
```

Open `http://localhost:15173/map`. The backend endpoint is `POST http://localhost:18100/neighborhood-chat/interpret`.

The backend uses the same Azure deployment resolver as council-file chat, but the neighborhood route is separate. It is available only while `CHAT_ENABLED` is enabled and returns a fixed error when the provider is unavailable. No production backend URL should be used for this demo.

## Validation

Frontend checks:

```sh
npm run lint
npm run test
npm run typecheck
npm run build
```

The focused prototype tests cover intent validation, broad and duplicate resource searches, shared neighborhoods, nearest ranking, missing fields, stale responses, retries, map highlights, and restoring the map controls.

Backend checks from the isolated worktree:

```sh
PYTHONPATH=/private/tmp/citywise-cd2-neighborhood-backend \
  /Users/rehaananjaria/Development/visic/city-wise/CityWise-Backend/.venv/bin/python \
  -m pytest tests/test_neighborhood_chat.py
```

## Known limits and removal

Distance is straight-line distance between stored pin coordinates, not walking or driving distance. The data is a curated CD2 snapshot and has no live hours, availability, or eligibility information. Browser visual validation requires an available in-app browser; automated map tests cover the interaction state instead.

To remove the experiment, delete `src/features/neighborhood-chat/`, remove its two additive imports and chat state/integration blocks from `CityMap.tsx`, remove the highlight layer import/use from `NeighborhoodOverlay.tsx`, restore the single `ResourceCard` export if unused, and remove `NEIGHBORHOOD_CHAT_DEMO.md`. Remove the isolated backend package/router/tests from `codex/cd2-neighborhood-chat`; council-file chat files do not need any edits.
