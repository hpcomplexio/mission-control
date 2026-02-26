import http from 'node:http';
import { sendJson, requireBearer } from './auth.js';
import { loadEventContract, validateEventEnvelope } from './contract.js';
import { ControlPlaneDb } from './db.js';
import { EventHub } from './eventHub.js';
import { HealerClient } from './healerClient.js';
import { AgentService } from './agentService.js';
import { uuidv7 } from './id.js';

export function createApp(config) {
  const contract = loadEventContract(config.eventSchemaPath);
  const db = new ControlPlaneDb(config.dbPath);
  const eventHub = new EventHub({ db });
  const healerClient = new HealerClient({
    healerUrl: config.healerUrl,
    healerToken: config.healerToken,
    timeoutMs: 5000
  });
  const agentService = new AgentService({ db, eventHub, healerClient });

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/events') {
        eventHub.attachClient(req, res);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/agents') {
        sendJson(res, 200, { agents: agentService.listAgents() });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/spawn') {
        if (!requireBearer(req, res, config.token)) return;
        const body = await parseJsonBody(req, res);
        if (!body) return;
        if (!body.task || !body.repoPath) {
          sendJson(res, 400, { error: 'task and repoPath are required' });
          return;
        }
        const response = await agentService.spawn(body);
        sendJson(res, 202, response);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/events') {
        if (!requireBearer(req, res, config.token)) return;
        const idemKey = req.headers['idempotency-key'];
        if (!idemKey || typeof idemKey !== 'string') {
          sendJson(res, 400, { error: 'Idempotency-Key header required' });
          return;
        }

        db.pruneIdempotency(10 * 60 * 1000);
        const existing = db.getIdempotencyRecord(idemKey);
        if (existing && Date.now() - existing.createdAt <= 10 * 60 * 1000) {
          sendJson(res, 200, { ...existing.response, accepted: true, deduped: true });
          return;
        }

        const body = await parseJsonBody(req, res);
        if (!body) return;
        const validation = validateEventEnvelope(contract, body);
        if (!validation.valid) {
          sendJson(res, 400, { error: 'invalid_event', details: validation.errors });
          return;
        }
        const seq = eventHub.publish(body);
        const result = { accepted: true, deduped: false, eventId: body.id, streamId: seq };
        db.saveIdempotencyRecord(idemKey, result);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/inject') {
        if (!requireBearer(req, res, config.token)) return;
        const body = await parseJsonBody(req, res);
        if (!body) return;
        if (!body.type) {
          sendJson(res, 400, { error: 'type required' });
          return;
        }
        const event = agentService.injectEvent(body);
        sendJson(res, 200, { accepted: true, event });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/decisions') {
        const status = url.searchParams.get('status');
        const decisions = db.listDecisions({ status: status || undefined });
        sendJson(res, 200, { decisions });
        return;
      }

      if (req.method === 'POST' && /^\/decisions\/[^/]+\/resolve$/.test(url.pathname)) {
        if (!requireBearer(req, res, config.token)) return;
        const body = await parseJsonBody(req, res);
        if (!body) return;
        if (!body.resolution || !body.actor) {
          sendJson(res, 400, { error: 'resolution and actor required' });
          return;
        }
        const decisionId = url.pathname.split('/')[2];
        const resolved = await agentService.resolveDecision({
          decisionId,
          resolution: body.resolution,
          actor: body.actor,
          notes: body.notes
        });
        if (!resolved) {
          sendJson(res, 404, { error: 'decision_not_found' });
          return;
        }
        sendJson(res, 200, { accepted: true, decisionId });
        return;
      }

      sendJson(res, 404, { error: 'not_found' });
    } catch (err) {
      sendJson(res, 500, { error: 'internal_error', message: String(err.message || err) });
    }
  });

  return {
    server,
    db,
    eventHub,
    agentService,
    close: () => {
      agentService.close();
      eventHub.close();
      db.close();
      server.close();
    }
  };
}

function parseJsonBody(req, res) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        if (!text) {
          resolve({});
          return;
        }
        resolve(JSON.parse(text));
      } catch {
        sendJson(res, 400, { error: 'invalid_json' });
        resolve(null);
      }
    });
  });
}

export function makeEvent({ type, severity, correlationId, agentId, payload }) {
  return {
    id: uuidv7(),
    schemaVersion: '1.0.0',
    eventVersion: 1,
    source: 'mission-control',
    type,
    severity,
    timestamp: new Date().toISOString(),
    correlationId,
    agentId,
    payload
  };
}
