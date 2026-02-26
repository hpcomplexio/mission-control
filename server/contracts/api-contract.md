# Mission Control API Contract (Packet 1)

## Event Envelope Contract
All published events MUST match `event-schema.json`:

- Required: `id`, `schemaVersion`, `eventVersion`, `source`, `type`, `severity`, `timestamp`, `correlationId`, `payload`
- Optional: `agentId`
- Unknown fields: consumers MUST ignore unknown top-level fields and unknown `payload` fields.

### Versioning Policy
- `schemaVersion` follows semver:
- Patch: non-breaking clarifications.
- Minor: additive fields (backward compatible).
- Major: breaking changes.
- `eventVersion` increments only when payload semantics change for a specific `type`.
- Consumers MUST tolerate additional fields and payload keys.

## `POST /events`

### Auth
- Requires `Authorization: Bearer <token>`.
- Shared local-dev token contract:
- `MISSION_CONTROL_TOKEN`
- `SELF_HEALER_TOKEN`
- Unauthenticated requests MUST return `401`.

### Idempotency
- Requires `Idempotency-Key` header.
- Dedupe window: 10 minutes by `Idempotency-Key`.
- Duplicate publish returns `200` with previous result metadata.
- Response shape: `{ accepted: true, deduped: boolean }`.
- Delivery remains at-least-once; consumers dedupe by event `id`.

## `GET /events` (SSE)
- SSE stream sends heartbeat every 15 seconds.
- Clients resume with `Last-Event-ID`.
- Server backfills up to the last 500 events on reconnect.

## Auth-required write endpoints
The following endpoints require bearer auth and return `401` without valid auth:

- `POST /events`
- `POST /heal`
- `POST /inject`
- `POST /decisions/:id/resolve`
