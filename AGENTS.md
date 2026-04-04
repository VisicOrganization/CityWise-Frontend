Please treat CityWise-Frontend as the React application repository for the CityWise MVP.

Important context:
- prefer React + TypeScript + Vite
- use `project` as the user-facing product vocabulary
- use `react-map-gl` over direct `maplibre-gl` integration for React map work
- keep curated district copy and district GeoJSON local to the frontend for MVP
- do not add fake markers, inferred anchors, or geocoding work unless explicitly requested

Git workflow requirements:
- Before making frontend changes, check the current branch inside `CityWise-Frontend`.
- Before starting new frontend work, check whether the current branch is associated with a pull request and whether that pull request has already merged.
- If the current frontend branch's pull request is already merged, switch back to `main`, update from `origin/main`, and create a fresh `codex/<task-slug>` branch before editing.
- Fetch `origin/main` before creating a new frontend working branch, and treat `origin/main` as the latest source of truth.
- If the branch is `main`, do not work from it. Create or switch to a task branch such as `codex/<task-slug>` from the latest `origin/main`.
- If the branch is already non-`main`, confirm it is the correct branch for the requested frontend work before proceeding.
- If the frontend working branch was created from the wrong base branch, rebase it onto the latest `origin/main` before opening a PR. Prefer a targeted rewrite such as `git rebase --onto origin/main <old-base-branch> <working-branch>`.
- If a rebased frontend branch has already been pushed, update the remote with `git push --force-with-lease`.
- Never commit to `main`.
- Never push directly to `main`.
- Use pull requests to merge frontend changes into `main`.
- Once the implementation approach is settled with the user, make logical commits on the working branch as work is completed.
- Pushing to the active frontend working branch, including `codex/*`, is allowed.
- After creating a frontend commit on the working branch, push it by default so the branch and any open PR stay current.
- Only keep a frontend commit local if the user explicitly asks not to push yet or both sides have clearly agreed to hold pushes.
- When publishing frontend work, prefer opening a draft PR first.
- If the GitHub integration cannot create the PR, fall back to authenticated `gh pr create`.

Local development:
- prefer the Docker-based workflow in `compose.yml`
- choose host ports that do not clash with an existing local developer environment
- agent-friendly default ports are:
  - frontend host port `15173`
  - backend host port `18100`
- configure frontend ports and API base URL in `.env`
- configure published frontend port mapping in `compose.yml`
- exact local startup commands:
  - `cp .env.example .env`
  - `docker compose up --build -d`
- default demo route:
  - `http://localhost:15173/`
  - map mock: `http://localhost:15173/map`
  - district overview: `http://localhost:15173/districts/11`

Validation commands:
- run lint with `npm run lint`
- run tests with `npm run test`
- run a type check with `npm run typecheck`
- run a production build with `npm run build`

If frontend work is part of a cross-repo change, validate the frontend repo with the commands above and confirm any affected backend API or payload assumptions in `CityWise-Backend` before finishing.

Map work:
- start with [react-map-gl docs/examples](/home/codex/workspace/VISIC/maplibre/react-map-gl/docs/README.md)
- then verify lower-level behavior in [maplibre-gl-js](/home/codex/workspace/VISIC/maplibre/maplibre-gl-js/README.md)
- confirm style/source/layer validity in [maplibre-style-spec](/home/codex/workspace/VISIC/maplibre/maplibre-style-spec/README.md)

Implementation boundaries:
- keep MVP scope tight around the district overview page and project detail support
- do not expand into search/filter UI, auth, admin tooling, or backend-managed editorial content
