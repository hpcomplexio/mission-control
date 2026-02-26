# Tri-Repo Integration Plan v2 (Tightened Execution Spec)

Date: 2026-02-26
Repos:
- `mission-control` (dashboard + event hub)
- `immaculate-vibes` (workbench repo where agents commit)
- `self-healing-systems` (healer service)

## 1) Non-Negotiable Contract Rules

### Event Envelope (required for every event)
```json
{
  "id": "uuid-v7",
  "schemaVersion": "1.0.0",
  "eventVersion": 1,
  "source": "mission-control | self-healing-systems | immaculate-vibes",
  "type": "agent.spawned | agent.progress | agent.completed | build.failed | build.passed | heal.attempted | heal.completed | heal.escalated | decision.required | decision.resolved",
  "severity": "info | warn | critical",
  "timestamp": "ISO-8601",
  "correlationId": "uuid-v7",
  "agentId": "string (optional)",
  "payload": {}
}
```

### Versioning Policy
- `schemaVersion` follows semver:
- Patch: non-breaking clarifications.
- Minor: additive fields (backward compatible).
- Major: breaking changes.
- `eventVersion` increments only when payload semantics change for a specific `type`.
- Consumers must ignore unknown fields and must not fail on additional payload keys.

### Idempotency + Deduplication
- `id` is globally unique per event emission attempt.
- `POST /events` accepts `Idempotency-Key` header.
- Hub dedupes by `Idempotency-Key` for 10 minutes.
- Duplicate publish returns `200` with previous result metadata.
- At-least-once delivery is expected; consumers must dedupe by `id`.

### Retry + Timeout Standards
- Outbound HTTP retries: max 3 attempts, exponential backoff `500ms, 1s, 2s`, jitter +/-20%.
- Per-attempt timeout: 5 seconds for control plane calls.
- Build/test timeout: 10 minutes per run.
- Healer execution timeout: 5 minutes per incident.
- Circuit breaker opens after 5 consecutive healer failures for 2 minutes.

### Auth (local dev minimum)
- Shared bearer token between hub and healer via env vars:
- `MISSION_CONTROL_TOKEN`
- `SELF_HEALER_TOKEN`
- Required on `POST /events`, `POST /heal`, `POST /inject`, `POST /decisions/:id/resolve`.
- Reject unauthenticated requests with `401`.

## 2) API Tightening (authoritative contract)

### `POST /spawn`
- Request: `{ task, repoPath, branch?, priority?, metadata? }`
- Response: `{ agentId, correlationId, status: "accepted" }`
- Must emit `agent.spawned` within 1 second after acceptance.

### `GET /events` (SSE)
- Event stream includes heartbeat every 15 seconds.
- Resume support via `Last-Event-ID`.
- Backfill up to last 500 events on reconnect.

### `POST /events`
- Validates against `event-schema.json`.
- Requires `Idempotency-Key`.
- Returns `{ accepted: true, deduped: boolean }`.

### `POST /heal` (in healer)
- Request must include original `build.failed` payload and `correlationId`.
- Must emit:
- `heal.attempted` at start.
- `heal.completed` with `patchSummary` and `changedFiles` on success.
- `heal.escalated` with `reasonCode` and `humanContext` on failure.

### `POST /decisions/:id/resolve`
- Request: `{ resolution, actor, notes? }`
- Must emit `decision.resolved`.
- If linked to a paused agent, resume workflow and emit `agent.progress`.

## 3) State Model (explicit durability)

### In-memory (POC)
- Live agent process map.
- SSE subscriber list.

### Persistent (required now)
- SQLite in `mission-control/server/data/controlplane.db` for:
- decisions
- event log (rolling 7 days)
- agent run metadata (status, start/end timestamps, repo, branch, correlationId)

Reason:
- Restart-safe Decision Inbox.
- Auditable timeline for debugging and replay.

## 4) Failure Handling Matrix

- Healer unavailable:
- Hub emits `heal.escalated` with `reasonCode=healer_unreachable`.
- Create `decision.required` immediately (no silent drop).

- Unknown classifier result:
- Healer emits `heal.escalated` with `reasonCode=unknown_failure_signature`.
- Include first 100 lines of failing output and candidate files.

- Stuck agent process (>15 minutes no output):
- Hub emits `decision.required` with `reasonCode=agent_stalled`.

- Flapping failures (same signature 3 times in 30 minutes):
- Auto-escalate to decision; block further auto-heal on that signature for 60 minutes.

## 5) Branch and Conflict Policy

- One agent branch per run: `agent/<agentId>/<short-task-slug>`.
- Direct writes to `main` disallowed for automated agents.
- Healer applies patches only to failing agent branch.
- If branch diverged from base by >200 commits, require human decision before healer patch.

## 6) Phase Plan With Acceptance Gates

### Phase A: Contract Baseline (sequential)
Deliverables:
- `mission-control/server/contracts/event-schema.json`
- `mission-control/server/contracts/api-contract.md`
- `self-healing-systems/contracts/event-schema.json` (mirrored copy)

Acceptance tests:
- Contract validation fixtures pass: valid/invalid samples.
- Unknown field tolerance test passes.
- Semver and `eventVersion` rules documented in `api-contract.md`.

### Phase B1: Agent Hub (`mission-control`)
Deliverables:
- Express server with `/spawn`, `/events`, `/agents`, `/events` publish.
- Repo watcher + build/test executor + healer forwarding.
- SQLite persistence for decisions/event log/agent runs.

Acceptance tests:
- `POST /spawn` emits `agent.spawned` and appears in `GET /agents`.
- Simulated build failure emits `build.failed` and forwards to healer.
- Duplicate `POST /events` with same idempotency key dedupes.
- SSE reconnect with `Last-Event-ID` replays missed events.

### Phase B2: Healer Webhook (`self-healing-systems`)
Deliverables:
- FastAPI `/heal` endpoint + reporter to hub.
- Classifier bridge to existing healer pipeline.

Acceptance tests:
- Known failure emits `heal.attempted` then `heal.completed`.
- Unknown failure emits `heal.attempted` then `heal.escalated`.
- Timeout path emits `heal.escalated` with `reasonCode=healer_timeout`.

### Phase B3: Dashboard Wiring (`mission-control/src`)
Deliverables:
- Replace mock data with API + SSE.
- Decision resolution flow wired end-to-end.
- Insights severity mapping from live events.

Acceptance tests:
- New run appears in Fleet without page refresh.
- `decision.required` appears in inbox in <2 seconds.
- Resolving decision updates agent card state and clears inbox item.

### Phase C: Compose + End-to-End
Deliverables:
- `docker-compose.dev.yml`
- Dockerfiles for hub and healer
- `.env.example` for tokens + URLs + paths

Acceptance tests:
- `docker compose up` boots all services healthy.
- Synthetic known failure auto-heals and updates dashboard.
- Synthetic unknown failure lands in Decision Inbox.
- Full trace for one run is queryable by `correlationId`.

## 7) Required Test Suite (minimum)

- Contract tests: JSON schema validation fixtures.
- API tests: endpoint auth, idempotency, error codes.
- Integration tests: hub <-> healer callbacks with retries/timeouts.
- E2E smoke test: spawn -> fail -> heal/escalate -> resolve.

Command convention (target):
- `npm run test:contracts`
- `npm run test:api`
- `npm run test:integration`
- `npm run test:e2e:local`

## 8) Open Decisions (time-boxed)

- Runtime path:
- Start with CLI agent execution in Phase B.
- Re-evaluate SDK migration only after 10+ runs with measured bottlenecks.

- Persistence scope:
- Keep SQLite for POC and early multi-agent use.
- Move to Redis/Postgres only if concurrent active agents >20 or cross-host scaling required.

- Healer growth:
- Add a "Teach Healer" action in Decision Inbox.
- Each approved fix contributes signature + remediation template to classifier library.

## 9) Ready-to-Run Work Packets

### Packet 1: Contract Agent
"Author `event-schema.json` and `api-contract.md` under `mission-control/server/contracts` with schemaVersion/eventVersion rules, idempotency requirements, SSE resume behavior, and auth requirements."

### Packet 2: Hub Agent
"Implement `mission-control/server` endpoints per contract, including SSE heartbeat + replay, idempotent event ingest, spawn orchestration, repo watcher, healer forwarding, and SQLite persistence."

### Packet 3: Healer Agent
"Implement `self-healing-systems/webhook` FastAPI `/heal` endpoint and reporter with retry/timeouts, classifier bridge, and structured `heal.completed`/`heal.escalated` events."

### Packet 4: UI Agent
"Replace mock dashboard data with live fetch + SSE updates, wire Decision Inbox resolve actions, and map live heal/build severities into InsightsPanel."
