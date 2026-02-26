// Mode definitions — drives everything: language, agents, interview, panels

export const MODES = {
  ARMY: 'army',
  CTO: 'cto',
}

export const MODE_CONFIG = {
  [MODES.ARMY]: {
    id: MODES.ARMY,
    label: 'ARMY MODE',
    tagline: 'Command your agent workforce',
    description: 'Deploy autonomous coding agents toward a goal. You set the mission, they build. You unblock, they continue.',
    accentColor: '#00ff88',
    icon: '⚡',

    interview: {
      agentName: 'ARCH-1',
      agentRole: 'Intake Agent',
      intro: "I'll ask you a few questions to build the mission brief. Every agent in your army will operate from this context. Be direct.",
      questions: [
        "What are we building? Describe it like you're pitching it.",
        "What does 'done' look like for this first version?",
        "What's the one thing we absolutely cannot get wrong?",
        "Any hard constraints — tech stack, timeline, things to avoid?",
        "How autonomous should agents be? Full send, or check in often?",
      ],
    },

    brief: {
      title: 'MISSION BRIEF',
      fields: {
        objective: 'OBJECTIVE',
        success: 'SUCCESS LOOKS LIKE',
        constraints: 'CONSTRAINTS',
        autonomy: 'AUTONOMY LEVEL',
      },
    },

    panels: ['fleet', 'mission', 'inbox', 'interview'],
    primaryPanel: 'fleet',

    agents: [
      {
        id: 'agent-001',
        name: 'ARCH-1',
        role: 'System Architect',
        status: 'active',
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
        status: 'thinking',
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
        status: 'blocked',
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
    ],

    chaosEvents: [
      { type: 'blocker', agentIndex: 0, message: 'Rate limit hit on Anthropic API — need fallback strategy' },
      { type: 'blocker', agentIndex: 1, message: 'Schema conflict: field naming mismatch with ARCH-1 contracts' },
      { type: 'proposal', agentName: 'ARCH-1', text: 'A diff view panel would help me surface code changes faster. Worth building into the dashboard?' },
      { type: 'status', agentIndex: 2, newStatus: 'active', task: 'Resumed — schema decision received' },
    ],

    injectLabel: 'INJECT EVENT',
    injectIcon: 'zap',
  },

  [MODES.CTO]: {
    id: MODES.CTO,
    label: 'CTO MODE',
    tagline: 'Diagnose your engineering org',
    description: 'Analyst agents crawl your tools — GitHub, Linear, Notion — and surface where the pain is. You decide where to focus.',
    accentColor: '#60a5fa',
    icon: '🔭',

    interview: {
      agentName: 'DIAG-1',
      agentRole: 'Diagnostic Agent',
      intro: "I'll ask you a few questions to calibrate the diagnostic. Your answers shape what I surface and what I deprioritize.",
      questions: [
        "What's your biggest concern about the engineering org right now?",
        "What does a healthy quarter look like for your team?",
        "Where do you think time is being wasted? Be honest.",
        "What decisions keep landing on your desk that shouldn't?",
        "Which tools are you actually using? (GitHub, Linear, Notion, Slack, other)",
      ],
    },

    brief: {
      title: 'FOCUS AREAS',
      fields: {
        objective: 'PRIMARY CONCERN',
        success: 'HEALTHY QUARTER LOOKS LIKE',
        constraints: 'KNOWN DRAINS',
        autonomy: 'ESCALATION THRESHOLD',
      },
    },

    panels: ['insights', 'fleet', 'inbox', 'interview'],
    primaryPanel: 'insights',

    agents: [
      {
        id: 'scan-001',
        name: 'GITHUB-SCAN',
        role: 'Repository Analyst',
        status: 'active',
        currentTask: 'Scanning PRs open > 5 days',
        lastCommit: null,
        progress: 71,
        runtime: '00:03:12',
        blockers: [],
        log: [
          '[00:01] Connected to GitHub API',
          '[00:02] Fetching open PRs across 4 repos',
          '[00:03] Found 6 PRs stale > 5 days — flagging...',
        ],
      },
      {
        id: 'scan-002',
        name: 'LINEAR-SCAN',
        role: 'Ticket Analyst',
        status: 'thinking',
        currentTask: 'Identifying stuck tickets and cycle time outliers',
        lastCommit: null,
        progress: 45,
        runtime: '00:04:55',
        blockers: [],
        log: [
          '[00:01] Pulled sprint data from Linear',
          '[00:03] Calculating average cycle time per engineer',
          '[00:04] Detecting context-switch patterns...',
        ],
      },
      {
        id: 'scan-003',
        name: 'NOTION-SCAN',
        role: 'Documentation Analyst',
        status: 'active',
        currentTask: 'Finding outdated specs and orphaned docs',
        lastCommit: null,
        progress: 33,
        runtime: '00:02:08',
        blockers: [],
        log: [
          '[00:01] Indexed 84 pages in engineering workspace',
          '[00:02] Flagging docs not updated in 60+ days',
        ],
      },
      {
        id: 'scan-004',
        name: 'SYNTHESIS-1',
        role: 'Pattern Synthesizer',
        status: 'idle',
        currentTask: 'Waiting for scan completion',
        lastCommit: null,
        progress: 0,
        runtime: '00:00:00',
        blockers: [],
        log: [
          '[00:00] Standing by for scan outputs...',
        ],
      },
    ],

    insights: [
      {
        id: 'insight-001',
        severity: 'critical',
        source: 'GITHUB-SCAN',
        title: '6 PRs stale for 5+ days',
        detail: 'auth-service (11d), payments-refactor (8d), and 4 others. No reviewer assigned on 4 of them.',
        action: 'Assign reviewers or close',
        timestamp: '2 min ago',
        status: 'pending',
      },
      {
        id: 'insight-002',
        severity: 'warn',
        source: 'LINEAR-SCAN',
        title: 'Avg cycle time up 40% this sprint',
        detail: '3 engineers context-switching across 4+ tickets simultaneously. Likely blocking each other.',
        action: 'Review sprint load distribution',
        timestamp: '4 min ago',
        status: 'pending',
      },
      {
        id: 'insight-003',
        severity: 'warn',
        source: 'NOTION-SCAN',
        title: '14 spec docs not updated in 60+ days',
        detail: 'Several are referenced in active Linear tickets, meaning engineers may be building against stale specs.',
        action: 'Audit and archive or update',
        timestamp: '5 min ago',
        status: 'pending',
      },
      {
        id: 'insight-004',
        severity: 'info',
        source: 'LINEAR-SCAN',
        title: '2 engineers consistently unblocked and shipping',
        detail: 'Maya and Jordan have closed 8 tickets this sprint with low cycle time. Consider what they have that others don\'t.',
        action: 'Replicate conditions',
        timestamp: '4 min ago',
        status: 'pending',
      },
    ],

    chaosEvents: [
      { type: 'insight', severity: 'critical', source: 'GITHUB-SCAN', title: 'Main branch CI failing for 3 hours', detail: 'No one has picked it up. 4 engineers blocked from merging.', action: 'Assign owner immediately' },
      { type: 'insight', severity: 'warn', source: 'LINEAR-SCAN', title: 'Sprint goal at risk', detail: '60% of planned tickets untouched with 3 days left in sprint.', action: 'Reprioritize or descope' },
      { type: 'rescan', label: 'Re-scanning all sources...' },
    ],

    injectLabel: 'FORCE RESCAN',
    injectIcon: 'refresh',
  },
}
