# Contract Fixtures and Test Template

Directory layout:

- `tests/contracts/fixtures/valid/` valid event samples
- `tests/contracts/fixtures/invalid/` invalid event samples
- `tests/contracts/event_schema.contract.test.mjs` schema validation template

Defaults:

- Schema path: `server/contracts/event-schema.json`
- Override with env var: `EVENT_SCHEMA_PATH=/abs/path/to/event-schema.json`

Suggested setup:

1. Add `ajv` as a dev dependency: `npm i -D ajv`
2. Run with Node test runner:

```bash
node --test tests/contracts/event_schema.contract.test.mjs
```
