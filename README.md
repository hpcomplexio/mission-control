# MISSION CONTROL — POC Scaffold

A command center for a solo CEO running an AI agent army.

## Setup

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Project Structure

```
src/
  App.jsx                  # Root layout, global state, panel routing
  components/
    FleetView.jsx          # Agent cards, status, logs, blockers
    Interview.jsx          # Agent-led interview to build mission brief
    MissionBrief.jsx       # Display compiled mission context
    DecisionInbox.jsx      # Human-in-the-loop decision queue
  data/
    mockData.js            # Mock agents, mission state, interview questions
  index.css                # Global styles, animations, theme vars
```

## Current State (Mock)

All agent data is simulated in `mockData.js`. The UI is fully functional with:
- Live agent fleet view with status, progress, logs
- Typing interview flow that compiles a mission brief
- Decision inbox with respond/resolve flow
- "Inject Event" button to simulate chaos (blockers, proposals)
- Reset button to start fresh

## Next: Wire Up Real Agents

To connect a real Claude Code agent:

1. **Spawn agent via API** — use `@anthropic-ai/claude-code` SDK or CLI
2. **Stream output** — pipe stdout to a small Express/Fastify server
3. **Serve events** — use SSE or WebSocket to push to the dashboard
4. **Replace mock data** — swap `initialAgents` in `mockData.js` with live state

### Example agent server stub (Node)

```js
// server/index.js
import { ClaudeCode } from '@anthropic-ai/claude-code'
import express from 'express'

const app = express()
const agents = new Map()

app.post('/spawn', async (req, res) => {
  const { task, repoPath } = req.body
  const agent = new ClaudeCode({ task, cwd: repoPath })
  agents.set(agent.id, agent)
  agent.run() // non-blocking
  res.json({ agentId: agent.id })
})

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  // push agent state changes to dashboard
})

app.listen(3001)
```

## The Two-Track System

**Track 1** — the project your agents are building (set during interview)  
**Track 2** — this dashboard itself (agents propose + build improvements)

Agents work on Track 1, surface observations, and occasionally propose dashboard features.
You approve in the Decision Inbox. Another agent builds it here.

## Adding a Real Lever

The "Inject Event" button in FleetView is currently mock.
To make it real, wire it to your agent server:

```js
// In FleetView.jsx, replace onInjectChaos with:
const handleRealChaos = async () => {
  await fetch('http://localhost:3001/inject', {
    method: 'POST',
    body: JSON.stringify({ type: 'force_checkin', agentId: 'agent-001' })
  })
}
```

## What Agents Can Add

When an agent surfaces a proposal (via Decision Inbox), it should:
1. Describe the problem it encountered
2. Propose a specific UI component or data view
3. Implement it in `src/components/` if approved
4. Submit as a PR / commit to this repo

The dashboard evolves based on what agents actually need.
