import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { ControlPlaneDb } from '../src/db.js';
import { EventHub } from '../src/eventHub.js';
import { AgentService } from '../src/agentService.js';
import { loadEventContract, validateEventEnvelope } from '../src/contract.js';

let tmpDir;
let db;
let eventHub;
let agentService;
let healerCalls;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-server-'));
  db = new ControlPlaneDb(path.join(tmpDir, 'controlplane.db'));
  eventHub = new EventHub({ db, heartbeatMs: 60_000 });
  healerCalls = [];
  const healerClient = {
    async forwardBuildFailed(event) {
      healerCalls.push(event);
      return { ok: true };
    }
  };
  agentService = new AgentService({ db, eventHub, healerClient });
});

afterEach(() => {
  agentService.close();
  eventHub.close();
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('spawn emits agent.spawned and appears in /agents model', async () => {
  const repoPath = fs.mkdtempSync(path.join(tmpDir, 'repo-'));
  const response = await agentService.spawn({
    task: 'Build feature',
    repoPath,
    metadata: { runImmediately: false }
  });

  assert.equal(response.status, 'accepted');

  const events = db.getEventsAfter(0, 100).map((row) => row.event);
  const spawned = events.find((event) => event.type === 'agent.spawned');
  assert.ok(spawned);
  assert.equal(spawned.agentId, response.agentId);

  const agents = agentService.listAgents();
  assert.ok(agents.some((agent) => agent.agentId === response.agentId));
});

test('build.failed emits and forwards to healer', async () => {
  const repoPath = fs.mkdtempSync(path.join(tmpDir, 'repo-'));
  await agentService.spawn({
    task: 'Fail build',
    repoPath,
    metadata: {
      runImmediately: true,
      buildCommand: `node -e \"process.stderr.write('boom\\n');process.exit(1)\"`
    }
  });

  await waitFor(() => {
    const events = db.getEventsAfter(0, 200).map((row) => row.event.type);
    return events.includes('build.failed');
  }, 5000);

  const events = db.getEventsAfter(0, 200).map((row) => row.event);
  const failed = events.find((event) => event.type === 'build.failed');
  assert.ok(failed);
  assert.equal(healerCalls.length, 1);
  assert.equal(healerCalls[0].type, 'build.failed');
});

test('duplicate events with same Idempotency-Key dedupe', () => {
  const contract = loadEventContract(path.resolve('server/contracts/event-schema.json'));
  const event = {
    id: 'evt-1',
    schemaVersion: '1.0.0',
    eventVersion: 1,
    source: 'mission-control',
    type: 'agent.progress',
    severity: 'info',
    timestamp: new Date().toISOString(),
    correlationId: 'corr-1',
    payload: { step: 'x' }
  };

  const first = ingestWithIdempotency('idem-1', event, contract);
  const second = ingestWithIdempotency('idem-1', event, contract);

  assert.equal(first.deduped, false);
  assert.equal(second.deduped, true);

  const events = db.getEventsAfter(0, 100);
  assert.equal(events.length, 1);
});

test('SSE Last-Event-ID replay backfills missed events', () => {
  const eventA = {
    id: 'evt-a',
    schemaVersion: '1.0.0',
    eventVersion: 1,
    source: 'mission-control',
    type: 'agent.progress',
    severity: 'info',
    timestamp: new Date().toISOString(),
    correlationId: 'corr-a',
    payload: { ping: 'a' }
  };
  const eventB = {
    ...eventA,
    id: 'evt-b',
    correlationId: 'corr-b',
    payload: { ping: 'b' }
  };

  const seqA = eventHub.publish(eventA);
  eventHub.publish(eventB);

  const req = new FakeReq({ 'last-event-id': String(seqA) });
  const res = new FakeRes();
  eventHub.attachClient(req, res);

  const text = res.body();
  assert.ok(text.includes('id: 2'));
  assert.ok(text.includes('"id":"evt-b"'));

  req.emit('close');
});

function ingestWithIdempotency(idemKey, event, contract) {
  db.pruneIdempotency(10 * 60 * 1000);
  const existing = db.getIdempotencyRecord(idemKey);
  if (existing && Date.now() - existing.createdAt <= 10 * 60 * 1000) {
    return { ...existing.response, accepted: true, deduped: true };
  }

  const validation = validateEventEnvelope(contract, event);
  assert.equal(validation.valid, true);

  const streamId = eventHub.publish(event);
  const result = { accepted: true, deduped: false, eventId: event.id, streamId };
  db.saveIdempotencyRecord(idemKey, result);
  return result;
}

class FakeReq extends EventEmitter {
  constructor(headers = {}) {
    super();
    this.headers = headers;
  }
}

class FakeRes {
  constructor() {
    this.headers = null;
    this.chunks = [];
  }

  writeHead(_statusCode, headers) {
    this.headers = headers;
  }

  write(chunk) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
  }

  end() {}

  body() {
    return this.chunks.join('');
  }
}

async function waitFor(conditionFn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (conditionFn()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('timed out waiting for condition');
}
