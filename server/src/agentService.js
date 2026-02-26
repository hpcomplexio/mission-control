import fs from 'node:fs';
import path from 'node:path';
import { uuidv7 } from './id.js';
import { runShellCommand } from './runner.js';

const BUILD_TIMEOUT_MS = 10 * 60 * 1000;

export class AgentService {
  constructor({ db, eventHub, healerClient }) {
    this.db = db;
    this.eventHub = eventHub;
    this.healerClient = healerClient;
    this.watchers = new Map();
    this.agentState = new Map();
    this.failureSignatures = new Map();
    this.stallTimer = setInterval(() => this.checkStalledAgents(), 60_000);
    this.stallTimer.unref();
  }

  close() {
    clearInterval(this.stallTimer);
    for (const watcher of this.watchers.values()) watcher.close();
    this.watchers.clear();
  }

  listAgents() {
    return this.db.listAgents();
  }

  async spawn({ task, repoPath, branch, priority, metadata = {} }) {
    const agentId = `agent_${uuidv7()}`;
    const correlationId = uuidv7();
    const resolvedBranch = branch || branchFromTask(agentId, task);

    const run = {
      agentId,
      task,
      status: 'running',
      repoPath,
      branch: resolvedBranch,
      priority: priority ?? 'normal',
      correlationId,
      metadata,
      startedAt: Date.now(),
      endedAt: null
    };

    this.agentState.set(agentId, {
      ...run,
      paused: false,
      lastActivityAt: Date.now(),
      pendingBuild: false
    });
    this.db.upsertAgentRun(run);

    this.emit({
      id: uuidv7(),
      schemaVersion: '1.0.0',
      eventVersion: 1,
      source: 'mission-control',
      type: 'agent.spawned',
      severity: 'info',
      timestamp: new Date().toISOString(),
      correlationId,
      agentId,
      payload: {
        task,
        repoPath,
        branch: resolvedBranch,
        priority: priority ?? 'normal'
      }
    });

    this.startWatcher(agentId, repoPath, metadata);
    if (metadata.runImmediately !== false) {
      queueMicrotask(() => this.scheduleBuild(agentId));
    }

    return { agentId, correlationId, status: 'accepted' };
  }

  async resolveDecision({ decisionId, resolution, actor, notes }) {
    const row = this.db.resolveDecision(decisionId, resolution, actor, notes);
    if (!row) return null;

    this.emit({
      id: uuidv7(),
      schemaVersion: '1.0.0',
      eventVersion: 1,
      source: 'mission-control',
      type: 'decision.resolved',
      severity: 'info',
      timestamp: new Date().toISOString(),
      correlationId: row.correlationId,
      agentId: row.agentId ?? undefined,
      payload: { decisionId, resolution, actor, notes: notes ?? null }
    });

    if (row.agentId && this.agentState.has(row.agentId)) {
      const state = this.agentState.get(row.agentId);
      state.paused = false;
      state.lastActivityAt = Date.now();
      this.setAgentStatus(row.agentId, 'running');

      this.emit({
        id: uuidv7(),
        schemaVersion: '1.0.0',
        eventVersion: 1,
        source: 'mission-control',
        type: 'agent.progress',
        severity: 'info',
        timestamp: new Date().toISOString(),
        correlationId: row.correlationId,
        agentId: row.agentId,
        payload: { message: 'Agent resumed after decision resolution' }
      });
      this.scheduleBuild(row.agentId);
    }

    return row;
  }

  injectEvent({ type, severity = 'warn', correlationId, agentId, payload = {} }) {
    const event = {
      id: uuidv7(),
      schemaVersion: '1.0.0',
      eventVersion: 1,
      source: 'mission-control',
      type,
      severity,
      timestamp: new Date().toISOString(),
      correlationId: correlationId ?? uuidv7(),
      agentId,
      payload
    };
    this.emit(event);
    return event;
  }

  emit(event) {
    this.eventHub.publish(event);
    if (event.agentId && this.agentState.has(event.agentId)) {
      this.agentState.get(event.agentId).lastActivityAt = Date.now();
    }
  }

  startWatcher(agentId, repoPath, metadata) {
    if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
      this.setAgentStatus(agentId, 'failed');
      this.createDecisionRequired({
        correlationId: this.agentState.get(agentId).correlationId,
        agentId,
        reasonCode: 'repo_path_invalid',
        payload: { repoPath }
      });
      return;
    }

    if (this.watchers.has(agentId)) this.watchers.get(agentId).close();

    let watcher;
    try {
      watcher = fs.watch(repoPath, { recursive: true }, () => {
        this.scheduleBuild(agentId);
      });
    } catch {
      watcher = fs.watch(repoPath, () => {
        this.scheduleBuild(agentId);
      });
    }
    this.watchers.set(agentId, watcher);

    watcher.on('error', () => {
      this.createDecisionRequired({
        correlationId: this.agentState.get(agentId).correlationId,
        agentId,
        reasonCode: 'watcher_failed',
        payload: { repoPath }
      });
    });

    this.agentState.get(agentId).buildCommand = metadata.buildCommand || 'npm run build';
    this.agentState.get(agentId).testCommand = metadata.testCommand || 'npm run test --if-present';
  }

  scheduleBuild(agentId) {
    const state = this.agentState.get(agentId);
    if (!state || state.paused) return;
    if (state.pendingBuild) return;
    state.pendingBuild = true;
    setTimeout(() => {
      state.pendingBuild = false;
      this.runBuildPipeline(agentId).catch(() => {
        // pipeline failures are handled in runBuildPipeline
      });
    }, 250);
  }

  async runBuildPipeline(agentId) {
    const state = this.agentState.get(agentId);
    if (!state || state.paused) return;
    state.lastActivityAt = Date.now();

    const build = await runShellCommand(state.buildCommand, state.repoPath, BUILD_TIMEOUT_MS);
    if (!build.ok) {
      await this.handleBuildFailure(agentId, build, 'build');
      return;
    }

    const test = await runShellCommand(state.testCommand, state.repoPath, BUILD_TIMEOUT_MS);
    if (!test.ok) {
      await this.handleBuildFailure(agentId, test, 'test');
      return;
    }

    this.emit({
      id: uuidv7(),
      schemaVersion: '1.0.0',
      eventVersion: 1,
      source: 'mission-control',
      type: 'build.passed',
      severity: 'info',
      timestamp: new Date().toISOString(),
      correlationId: state.correlationId,
      agentId,
      payload: { buildCommand: state.buildCommand, testCommand: state.testCommand }
    });
    this.setAgentStatus(agentId, 'running');
  }

  async handleBuildFailure(agentId, result, phase) {
    const state = this.agentState.get(agentId);
    if (!state) return;

    const signature = signatureOf(result, phase);
    const failureEvent = {
      id: uuidv7(),
      schemaVersion: '1.0.0',
      eventVersion: 1,
      source: 'mission-control',
      type: 'build.failed',
      severity: 'critical',
      timestamp: new Date().toISOString(),
      correlationId: state.correlationId,
      agentId,
      payload: {
        phase,
        command: phase === 'build' ? state.buildCommand : state.testCommand,
        exitCode: result.code,
        timedOut: result.timedOut,
        signature,
        stdoutTail: tail(result.stdout, 100),
        stderrTail: tail(result.stderr, 100)
      }
    };
    this.emit(failureEvent);
    this.setAgentStatus(agentId, 'blocked');

    const now = Date.now();
    const series = (this.failureSignatures.get(signature) || []).filter((ts) => now - ts < 30 * 60 * 1000);
    series.push(now);
    this.failureSignatures.set(signature, series);

    if (series.length >= 3) {
      this.createDecisionRequired({
        correlationId: state.correlationId,
        agentId,
        reasonCode: 'flapping_failure_signature',
        payload: { signature }
      });
      state.paused = true;
      return;
    }

    try {
      await this.healerClient.forwardBuildFailed(failureEvent);
    } catch (err) {
      const reasonCode = err.code === 'circuit_open' ? 'healer_circuit_open' : 'healer_unreachable';
      this.emit({
        id: uuidv7(),
        schemaVersion: '1.0.0',
        eventVersion: 1,
        source: 'mission-control',
        type: 'heal.escalated',
        severity: 'warn',
        timestamp: new Date().toISOString(),
        correlationId: state.correlationId,
        agentId,
        payload: {
          reasonCode,
          humanContext: 'Healer forwarding failed; manual intervention required.'
        }
      });
      this.createDecisionRequired({
        correlationId: state.correlationId,
        agentId,
        reasonCode,
        payload: { error: String(err.message || err) }
      });
      state.paused = true;
    }
  }

  createDecisionRequired({ correlationId, agentId, reasonCode, payload }) {
    const id = uuidv7();
    this.db.createDecision({ id, correlationId, agentId, reasonCode, payload });
    this.emit({
      id: uuidv7(),
      schemaVersion: '1.0.0',
      eventVersion: 1,
      source: 'mission-control',
      type: 'decision.required',
      severity: 'warn',
      timestamp: new Date().toISOString(),
      correlationId,
      agentId,
      payload: {
        decisionId: id,
        reasonCode,
        ...payload
      }
    });
  }

  setAgentStatus(agentId, status) {
    const state = this.agentState.get(agentId);
    if (!state) return;
    state.status = status;
    this.db.upsertAgentRun({
      ...state,
      endedAt: status === 'completed' || status === 'failed' ? Date.now() : null
    });
  }

  checkStalledAgents() {
    const now = Date.now();
    for (const [agentId, state] of this.agentState.entries()) {
      if (state.paused) continue;
      if (now - state.lastActivityAt > 15 * 60 * 1000) {
        state.paused = true;
        state.status = 'blocked';
        this.db.upsertAgentRun({ ...state, endedAt: null });
        this.createDecisionRequired({
          correlationId: state.correlationId,
          agentId,
          reasonCode: 'agent_stalled',
          payload: { lastActivityAt: state.lastActivityAt }
        });
      }
    }
  }
}

function tail(value, maxLines) {
  if (!value) return '';
  const lines = value.split(/\r?\n/);
  return lines.slice(-maxLines).join('\n');
}

function signatureOf(result, phase) {
  const firstErrorLine = `${result.stderr}\n${result.stdout}`
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);
  return `${phase}:${(firstErrorLine || 'unknown').slice(0, 160)}`;
}

function branchFromTask(agentId, task) {
  const slug = String(task || 'task')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return path.posix.join('agent', agentId, slug || 'task');
}
