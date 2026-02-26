import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class ControlPlaneDb {
  constructor(dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_log (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        agent_id TEXT,
        created_at INTEGER NOT NULL,
        envelope_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS idempotency_keys (
        idem_key TEXT PRIMARY KEY,
        response_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        correlation_id TEXT NOT NULL,
        agent_id TEXT,
        status TEXT NOT NULL,
        reason_code TEXT,
        resolution TEXT,
        actor TEXT,
        notes TEXT,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        resolved_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS agent_runs (
        agent_id TEXT PRIMARY KEY,
        task TEXT NOT NULL,
        status TEXT NOT NULL,
        repo_path TEXT NOT NULL,
        branch TEXT NOT NULL,
        priority TEXT,
        correlation_id TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_event_log_created_at ON event_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_event_log_seq ON event_log(seq);
      CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
    `);
  }

  close() {
    this.db.close();
  }

  pruneOldEvents() {
    const cutoff = Date.now() - 7 * MS_PER_DAY;
    const stmt = this.db.prepare('DELETE FROM event_log WHERE created_at < ?');
    stmt.run(cutoff);
  }

  insertEvent(event) {
    this.pruneOldEvents();
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO event_log(event_id, correlation_id, event_type, agent_id, created_at, envelope_json)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING seq
    `);
    const row = stmt.get(
      event.id,
      event.correlationId,
      event.type,
      event.agentId ?? null,
      now,
      JSON.stringify(event)
    );
    return Number(row.seq);
  }

  getEventsAfter(lastSeq, limit = 500) {
    const stmt = this.db.prepare(`
      SELECT seq, envelope_json
      FROM event_log
      WHERE seq > ?
      ORDER BY seq ASC
      LIMIT ?
    `);
    return stmt.all(Number(lastSeq) || 0, limit).map((row) => ({
      seq: Number(row.seq),
      event: JSON.parse(row.envelope_json)
    }));
  }

  getSeqForEventId(eventId) {
    const stmt = this.db.prepare('SELECT seq FROM event_log WHERE event_id = ? LIMIT 1');
    const row = stmt.get(eventId);
    return row ? Number(row.seq) : 0;
  }

  getIdempotencyRecord(key) {
    const stmt = this.db.prepare(
      'SELECT response_json, created_at FROM idempotency_keys WHERE idem_key = ? LIMIT 1'
    );
    const row = stmt.get(key);
    if (!row) return null;
    return {
      response: JSON.parse(row.response_json),
      createdAt: Number(row.created_at)
    };
  }

  saveIdempotencyRecord(key, response) {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO idempotency_keys(idem_key, response_json, created_at) VALUES (?, ?, ?)'
    );
    stmt.run(key, JSON.stringify(response), Date.now());
  }

  pruneIdempotency(maxAgeMs = 10 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    this.db.prepare('DELETE FROM idempotency_keys WHERE created_at < ?').run(cutoff);
  }

  upsertAgentRun(run) {
    const stmt = this.db.prepare(`
      INSERT INTO agent_runs(agent_id, task, status, repo_path, branch, priority, correlation_id, metadata_json, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_id)
      DO UPDATE SET
        status=excluded.status,
        metadata_json=excluded.metadata_json,
        ended_at=excluded.ended_at,
        priority=excluded.priority,
        branch=excluded.branch,
        repo_path=excluded.repo_path
    `);
    stmt.run(
      run.agentId,
      run.task,
      run.status,
      run.repoPath,
      run.branch,
      run.priority ?? null,
      run.correlationId,
      JSON.stringify(run.metadata ?? {}),
      run.startedAt,
      run.endedAt ?? null
    );
  }

  listAgents() {
    const stmt = this.db.prepare(`
      SELECT agent_id, task, status, repo_path, branch, priority, correlation_id, metadata_json, started_at, ended_at
      FROM agent_runs
      ORDER BY started_at DESC
    `);
    return stmt.all().map((row) => ({
      agentId: row.agent_id,
      task: row.task,
      status: row.status,
      repoPath: row.repo_path,
      branch: row.branch,
      priority: row.priority,
      correlationId: row.correlation_id,
      metadata: JSON.parse(row.metadata_json),
      startedAt: row.started_at,
      endedAt: row.ended_at
    }));
  }

  createDecision(decision) {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO decisions(id, correlation_id, agent_id, status, reason_code, payload_json, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
    `);
    stmt.run(
      decision.id,
      decision.correlationId,
      decision.agentId ?? null,
      decision.reasonCode ?? null,
      JSON.stringify(decision.payload ?? {}),
      now,
      now
    );
  }

  resolveDecision(id, resolution, actor, notes) {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE decisions
      SET status='resolved', resolution=?, actor=?, notes=?, updated_at=?, resolved_at=?
      WHERE id=?
      RETURNING id, correlation_id, agent_id
    `);
    const row = stmt.get(resolution, actor, notes ?? null, now, now, id);
    if (!row) return null;
    return {
      id: row.id,
      correlationId: row.correlation_id,
      agentId: row.agent_id
    };
  }
}
