import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const CONTRACT_DIR = path.resolve('server/contracts');
const FIXTURES_DIR = path.join(CONTRACT_DIR, 'fixtures');

const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;
const ISO_8601_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const VALID_SOURCES = new Set(['mission-control', 'self-healing-systems', 'immaculate-vibes']);
const VALID_TYPES = new Set([
  'agent.spawned',
  'agent.progress',
  'agent.completed',
  'build.failed',
  'build.passed',
  'heal.attempted',
  'heal.completed',
  'heal.escalated',
  'decision.required',
  'decision.resolved'
]);
const VALID_SEVERITIES = new Set(['info', 'warn', 'critical']);

function validateEventEnvelope(event) {
  const required = [
    'id',
    'schemaVersion',
    'eventVersion',
    'source',
    'type',
    'severity',
    'timestamp',
    'correlationId',
    'payload'
  ];

  for (const key of required) {
    if (!(key in event)) {
      return { valid: false, reason: `Missing required field: ${key}` };
    }
  }

  if (typeof event.id !== 'string' || !UUID_V7_RE.test(event.id)) {
    return { valid: false, reason: 'id must be a uuid-v7 string' };
  }

  if (typeof event.schemaVersion !== 'string' || !SEMVER_RE.test(event.schemaVersion)) {
    return { valid: false, reason: 'schemaVersion must be semver' };
  }

  if (!Number.isInteger(event.eventVersion) || event.eventVersion < 1) {
    return { valid: false, reason: 'eventVersion must be an integer >= 1' };
  }

  if (typeof event.source !== 'string' || !VALID_SOURCES.has(event.source)) {
    return { valid: false, reason: 'source is invalid' };
  }

  if (typeof event.type !== 'string' || !VALID_TYPES.has(event.type)) {
    return { valid: false, reason: 'type is invalid' };
  }

  if (typeof event.severity !== 'string' || !VALID_SEVERITIES.has(event.severity)) {
    return { valid: false, reason: 'severity is invalid' };
  }

  if (typeof event.timestamp !== 'string' || !ISO_8601_UTC_RE.test(event.timestamp)) {
    return { valid: false, reason: 'timestamp must be ISO-8601 UTC' };
  }

  if (typeof event.correlationId !== 'string' || !UUID_V7_RE.test(event.correlationId)) {
    return { valid: false, reason: 'correlationId must be a uuid-v7 string' };
  }

  if (event.agentId !== undefined && typeof event.agentId !== 'string') {
    return { valid: false, reason: 'agentId must be a string when provided' };
  }

  if (typeof event.payload !== 'object' || event.payload === null || Array.isArray(event.payload)) {
    return { valid: false, reason: 'payload must be an object' };
  }

  return { valid: true };
}

async function loadFixtures(group) {
  const dir = path.join(FIXTURES_DIR, group);
  const files = await readdir(dir);
  const fixtures = [];

  for (const file of files) {
    const contents = await readFile(path.join(dir, file), 'utf8');
    fixtures.push({ name: file, event: JSON.parse(contents) });
  }

  return fixtures;
}

test('event-schema.json encodes unknown-field tolerance', async () => {
  const schemaRaw = await readFile(path.join(CONTRACT_DIR, 'event-schema.json'), 'utf8');
  const schema = JSON.parse(schemaRaw);

  assert.equal(schema.additionalProperties, true, 'top-level unknown fields must be allowed');
  assert.equal(
    schema.properties?.payload?.additionalProperties,
    true,
    'payload unknown fields must be allowed'
  );
});

test('valid fixtures pass contract validation', async () => {
  const fixtures = await loadFixtures('valid');

  assert.ok(fixtures.length > 0, 'expected at least one valid fixture');

  for (const fixture of fixtures) {
    const result = validateEventEnvelope(fixture.event);
    assert.equal(result.valid, true, `${fixture.name} should be valid (${result.reason ?? 'ok'})`);
  }
});

test('invalid fixtures fail contract validation', async () => {
  const fixtures = await loadFixtures('invalid');

  assert.ok(fixtures.length > 0, 'expected at least one invalid fixture');

  for (const fixture of fixtures) {
    const result = validateEventEnvelope(fixture.event);
    assert.equal(result.valid, false, `${fixture.name} should be invalid`);
  }
});

test('unknown-field tolerance remains compatible for consumers', async () => {
  const fixturePath = path.join(FIXTURES_DIR, 'valid', 'unknown-fields.json');
  const unknownFieldFixture = JSON.parse(await readFile(fixturePath, 'utf8'));

  const result = validateEventEnvelope(unknownFieldFixture);

  assert.equal(result.valid, true, 'unknown fields should not invalidate an event');
  assert.equal(unknownFieldFixture.newTopLevelField.nested, true);
  assert.equal(unknownFieldFixture.payload.newPayloadField, 'consumer must ignore');
});
