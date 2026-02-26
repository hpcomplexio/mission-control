import path from 'node:path';

export const DEFAULT_DB_PATH =
  '/Users/haleyparks/Documents/mission-control/server/data/controlplane.db';

export function readConfig(overrides = {}) {
  return {
    port: Number(overrides.port ?? process.env.MISSION_CONTROL_PORT ?? 8787),
    dbPath: overrides.dbPath ?? process.env.MISSION_CONTROL_DB_PATH ?? DEFAULT_DB_PATH,
    token: overrides.token ?? process.env.MISSION_CONTROL_TOKEN ?? 'dev-token',
    healerToken: overrides.healerToken ?? process.env.SELF_HEALER_TOKEN ?? 'dev-token',
    healerUrl: overrides.healerUrl ?? process.env.SELF_HEALER_URL ?? 'http://localhost:8000/heal',
    eventSchemaPath:
      overrides.eventSchemaPath ??
      process.env.MISSION_CONTROL_EVENT_SCHEMA_PATH ??
      path.resolve('server/contracts/event-schema.json')
  };
}
