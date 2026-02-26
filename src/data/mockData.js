// Mock data — replace with real agent API calls
// Each agent maps to a Claude Code / Codex process you spawn

export const AGENT_STATUSES = {
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  IDLE: 'idle',
  THINKING: 'thinking',
}

export const initialAgents = [
  {
    id: 'agent-001',
    name: 'ARCH-1',
    role: 'System Architect',
    status: AGENT_STATUSES.ACTIVE,
    currentTask: 'Scaffolding REST API structure',
    lastCommit: 'feat: add base router config',
    progress: 62,
    runtime: '00:14:32',
    blockers: [],
    log: [
      '[00:01] Initialized repo structure',
      '[00:04] Created base Express server',
      '[00:09] Defined route contracts',
      '[00:14] Writing controller stubs...',
    ],
  },
  {
    id: 'agent-002',
    name: 'FORGE-1',
    role: 'Backend Engineer',
    status: AGENT_STATUSES.THINKING,
    currentTask: 'Designing database schema',
    lastCommit: null,
    progress: 28,
    runtime: '00:06:11',
    blockers: [],
    log: [
      '[00:01] Analyzing requirements brief',
      '[00:03] Evaluating Postgres vs SQLite for POC',
      '[00:06] Drafting entity relationships...',
    ],
  },
  {
    id: 'agent-003',
    name: 'SCOUT-1',
    role: 'Research Agent',
    status: AGENT_STATUSES.BLOCKED,
    currentTask: 'Awaiting architecture decision',
    lastCommit: null,
    progress: 10,
    runtime: '00:08:44',
    blockers: ['Need DB choice before writing migration scripts'],
    log: [
      '[00:01] Reviewed existing codebase (none)',
      '[00:03] Identified dependency on schema design',
      '[00:08] BLOCKED: waiting on FORGE-1 schema output',
    ],
  },
]

export const initialMission = {
  title: null,
  objective: null,
  constraints: [],
  successMetrics: [],
  createdAt: null,
  status: 'awaiting_interview', // awaiting_interview | active | paused
}

export const initialDecisions = []

export const INTERVIEW_QUESTIONS = [
  "What are we building? Describe it like you're pitching it.",
  "What does 'done' look like for this first version?",
  "What's the one thing we absolutely cannot get wrong?",
  "Any hard constraints — tech stack, timeline, things to avoid?",
  "How aggressive should the agents be? Full autonomy, or check in often?",
]
