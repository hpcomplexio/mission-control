# Mission Control

Control plane and dashboard for tri-repo agent orchestration:
- `mission-control` (dashboard + hub)
- `immaculate-vibes` (workspace repo)
- `self-healing-systems` (healer service)

## Current Status (Round 1 Complete)

Completed in this repo:
- Hub server implemented in `server/src` with:
- `POST /spawn`
- `GET /events` (SSE + heartbeat + replay support)
- `POST /events` (idempotency key handling)
- `GET /agents`
- `POST /inject`
- `POST /decisions/:id/resolve`
- Shared event schema and API contract in `server/contracts/`.
- Contract fixtures and schema validation test templates in `tests/contracts/`.
- Tri-service local orchestration in `docker-compose.dev.yml`:
- `dashboard` on `3000`
- `agent-server` on `8787`
- `healer` on `8000`

Validated gates:
- Hub event ingest works.
- Idempotency works (`deduped: true` on duplicate key).
- SSE stream works and emits live events.
- Healer callbacks to hub work with auth.
- Known failure path reaches `heal.completed`.
- Unknown failure path reaches `heal.escalated`.

## Local Run

```bash
docker compose -f docker-compose.dev.yml up --build -d
docker compose -f docker-compose.dev.yml ps
```

Dashboard:
- `http://localhost:3000`

Hub:
- `http://localhost:8787`

Healer:
- `http://localhost:8000`

Shutdown:

```bash
docker compose -f docker-compose.dev.yml down
```

## Contract Test

```bash
node --test tests/contracts/event_schema.contract.test.mjs
```

## What Is Left For "Fully Done"

- Run full spawn-to-commit flow against real `immaculate-vibes` tasks.
- Verify decision inbox unblock loop end-to-end with a real paused agent.
- Add scripted E2E checks (not just manual curl validation).
- Add CI gates for contract/API/integration tests.
- Harden observability:
- structured logs for correlation IDs
- clear error surfacing in dashboard for failed heals/retries
- Document operator runbook for recovery and rollback flows.

## Important Paths

- `server/contracts/event-schema.json`
- `server/contracts/api-contract.md`
- `server/src/`
- `tests/contracts/`
- `docker-compose.dev.yml`
