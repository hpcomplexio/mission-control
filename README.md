# Mission Control

Control plane and dashboard for tri-repo agent orchestration:
- `mission-control` (dashboard + hub)
- `immaculate-vibes` (workspace repo)
- `self-healing-systems` (healer service)

## API Surface (Current)

Hub endpoints in `server/src/app.js`:
- `POST /spawn` (auth required)
- `GET /events` (SSE + replay support via `Last-Event-ID`)
- `POST /events` (auth + idempotency key)
- `GET /agents`
- `POST /inject` (auth required)
- `GET /decisions` (supports `?status=pending`)
- `POST /decisions/:id/resolve` (auth required)

UI client behavior in `src/lib/controlPlane.js`:
- Uses `/api/*` paths from the browser.
- Vite proxy rewrites `/api/*` to hub routes.
- Adds `Authorization: Bearer <token>` on mutating calls.

## Local Dev Run

```bash
npm install
docker compose -f docker-compose.dev.yml up --build -d
docker compose -f docker-compose.dev.yml ps
```

- Dashboard: `http://localhost:3000`
- Hub: `http://localhost:8787`
- Healer: `http://localhost:8000`

## Smoke Runbook

1. Open `http://localhost:3000`.
2. Select a mode and complete the interview flow.
3. Confirm interview completion triggers `POST /spawn` and returns `202`.
4. Confirm Fleet shows the spawned agent without manual refresh.
5. Confirm SSE stream remains connected (`LIVE`) while events continue.
6. Ensure a pending decision exists:
   - Observe incoming `decision.required`, or
   - Create one by injecting an event/failure path from backend flows.
7. Resolve the decision in UI and confirm status updates to resolved.
8. Verify browser console has no CORS or auth errors.
9. Shutdown:

```bash
docker compose -f docker-compose.dev.yml down
```

## Parallel UI Workflow (Codex Desktop)

Use one branch + one worktree + one thread per task.

Recommended task branches:
- `codex/decisions-read`
- `codex/ui-spawn`
- `codex/dev-proxy`
- `codex/ui-auth-consistency`
- `codex/smoke-runbook`
- `codex/final-integration` (merge and validation only; run last)

Suggested execution model:
1. Create/switch each task branch from `main`.
2. Open a separate worktree/thread for each task branch.
3. Run task agents in parallel for the first five branches.
4. Run the final integration branch after all five complete.

Conflict expectation:
- `src/lib/controlPlane.js` and `src/App.jsx` are expected merge hotspots.
- Resolve conflicts by preserving all required outcomes (spawn wiring, proxy paths, auth headers, decisions list).

## Context Safety (When Threads Get Long)

Require each task thread to end with:
1. Files changed
2. Commands run
3. Test/smoke outputs
4. Open risks

Keep a short integration note in this repo root for each completed task branch so final merge does not depend on chat memory.

## Contract Test

```bash
node --test tests/contracts/event_schema.contract.test.mjs
```

## Important Paths

- `server/contracts/event-schema.json`
- `server/contracts/api-contract.md`
- `server/src/`
- `src/lib/controlPlane.js`
- `vite.config.js`
- `docker-compose.dev.yml`
