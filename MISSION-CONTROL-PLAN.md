# Mission Control — Build Plan

## What This Is

A local dashboard for a solo CEO running an AI agent army. Two operating modes:

**Army Mode** — deploy autonomous coding agents toward a goal. You set the mission, they build, you unblock when needed.

**CTO Mode** — analyst agents crawl GitHub, Linear, Notion and surface where the engineering org is bleeding. You decide where to focus.

The dashboard is the control surface. Agents are the workers. The human is the tiebreaker.

---

## Current State (POC Scaffold)

A fully mocked React dashboard exists at `/mission-control`. It runs locally at `http://localhost:3000` via Vite.

**What's built:**
- Mode selector screen (Army vs CTO)
- Interview flow — agent-led intake that compiles a mission/diagnostic brief
- Fleet view — agent cards with status, progress, logs, blockers
- Decision inbox — human-in-the-loop response queue
- Insights panel (CTO mode) — critical/warn/info severity signals
- Mission/Focus brief panel
- Inject Event / Force Rescan lever
- All state driven from `src/config/modes.js`

**What's fake:**
- All agent data is mock objects in `src/data/mockData.js`
- No real processes running
- No real data from GitHub, Linear, or Notion
- Timers are JavaScript string manipulation, not real agent runtimes

---

## Architecture

### Two Repos

**Repo 1: `mission-control`** (this repo)
The dashboard. Always running. Agents can propose and build improvements to this repo as a second track of work.

**Repo 2: `[project]`**
Whatever the agents are actually building. The dashboard watches this repo.

They fail independently. A broken build in the project doesn't take down mission control.

### Two Tracks

**Track 1** — agents build the project (Repo 2)
**Track 2** — agents observe their own workflow, surface friction, propose dashboard improvements, build them into Repo 1

The dashboard evolves based on what agents actually need, not what was designed upfront.

---

## What Needs to Be Built

### Phase 1 — Real Agent Loop

Replace mock data with a real agent process.

**Agent server** (`server/index.js` or `server/main.py`)
- Spawns a Claude Code agent via API or CLI
- Passes it a task and a repo path
- Streams stdout/stderr output
- Watches the repo for git commits and file changes
- Maintains agent state (status, progress, current task, log)
- Serves state to the dashboard via SSE or WebSocket

**Dashboard wiring**
- Replace `initialAgents` in `mockData.js` with a live fetch from the agent server
- Subscribe to SSE stream for real-time updates
- Wire "Inject Event" button to a real server endpoint

**Suggested agent server stack:** Node.js with Express + `@anthropic-ai/claude-code` SDK, or Python with FastAPI + subprocess for Claude Code CLI.

**Minimal agent server stub:**
```js
// server/index.js
import express from 'express'
const app = express()

// POST /spawn — start an agent on a task
app.post('/spawn', async (req, res) => {
  const { task, repoPath } = req.body
  // spawn Claude Code process here
  // store agent state
  res.json({ agentId })
})

// GET /events — SSE stream of agent state changes
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  // push state on change
})

// POST /inject — trigger a chaos/interrupt event
app.post('/inject', async (req, res) => {
  const { type, agentId } = req.body
  // force checkin, inject blocker, etc.
})

app.listen(3001)
```

---

### Phase 2 — Real Data Sources (CTO Mode)

Connect analyst agents to real tools.

**GitHub integration**
- Scan open PRs older than N days
- Detect stale branches, unreviewed PRs, failed CI
- Surface as Insights in the dashboard

**Linear integration**
- Pull sprint data
- Calculate cycle time per engineer
- Detect context-switching patterns (engineers on 4+ tickets)
- Flag at-risk sprint goals

**Notion integration**
- Index engineering workspace pages
- Flag docs not updated in 60+ days that are referenced in active tickets
- Surface orphaned specs

Each integration runs as an analyst agent. Results are posted to the Insights panel via the agent server.

---

### Phase 3 — Human-in-the-Loop Triggers

Make the "force human interaction" mechanisms real.

**Confidence threshold** — agent reports confidence score with each action. Below a threshold, it surfaces to Decision Inbox automatically before proceeding.

**Plan invalidation** — inject new strategic context that forces agents to re-evaluate their current approach before continuing.

**Bug injection** — introduce a deliberate test failure that blocks the build and forces a check-in. Useful for testing the escalation path.

**Force checkin** — pause a specific agent and require a human response before it continues. Available from the Fleet view per agent.

---

### Phase 4 — Self-Improving Dashboard

The meta loop where agents improve their own tooling.

**Proposal format** — when an agent surfaces a dashboard improvement, it should follow this structure in the Decision Inbox:

```
AGENT: [agent name]
PROBLEM: [what friction they encountered, how many times]
PROPOSAL: [specific UI component or data view]
IMPLEMENTATION: [what file to create/edit, rough approach]
```

**Approval flow** — you approve in the Decision Inbox. A separate agent picks up the proposal and implements it in `mission-control/src/components/`. The dashboard updates on next reload.

---

## Key Files

```
mission-control/
  src/
    config/
      modes.js          ← ALL mode config lives here. Start here when extending.
    components/
      ModeSelector.jsx  ← First screen, mode picker
      FleetView.jsx     ← Agent cards, status, logs
      Interview.jsx     ← Intake flow, compiles mission brief
      InsightsPanel.jsx ← CTO mode: severity-ranked signals
      DecisionInbox.jsx ← Human response queue
      MissionBrief.jsx  ← Compiled brief display
    data/
      mockData.js       ← Replace with live API calls in Phase 1
    App.jsx             ← Root layout, global state, panel routing
```

---

## Open Questions for Agent Review

1. **Agent infrastructure** — Is Claude Code via API + a thin Node server the right approach, or is there a framework (LangGraph, CrewAI, AutoGen) that handles multi-agent coordination better for this use case?

2. **Existing codebase reuse** — Are there open source projects (agent observability, LLM ops dashboards, Claude Code wrappers) whose components could accelerate Phase 1 or Phase 2 rather than building from scratch?

3. **State management** — As agent count grows, local React state won't scale. What's the right time to introduce a proper state layer (Zustand, a database, Redis)?

4. **Agent coordination** — When multiple agents work the same repo, how do we prevent conflicts? Is git branch-per-agent the right model, or is there a better approach?

5. **CTO mode data** — GitHub/Linear/Notion all have rate limits and auth complexity. Is there a unified engineering data layer (LinearB, Swarmia, Jellyfish) that already aggregates this and has a cleaner API to build on?

---

## Success Criteria for POC

- One real Claude Code agent spawned from the dashboard
- Agent works in a real repo, commits show up in the Fleet view
- At least one real blocker surfaces in the Decision Inbox
- Human responds, agent unblocks and continues
- Dashboard feels alive with real data, not mock tickers
