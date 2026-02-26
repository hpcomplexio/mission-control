import { useEffect, useRef, useState } from 'react'
import { Terminal, Radio, Inbox, Target, RotateCcw, BarChart2 } from 'lucide-react'
import ModeSelector from './components/ModeSelector'
import FleetView from './components/FleetView'
import Interview from './components/Interview'
import MissionBrief from './components/MissionBrief'
import DecisionInbox from './components/DecisionInbox'
import InsightsPanel from './components/InsightsPanel'
import { MODES, MODE_CONFIG } from './config/modes'
import { fetchAgents, fetchPendingDecisions, resolveDecision, spawnAgent, subscribeToEvents } from './lib/controlPlane'
import './index.css'

const LAST_EVENT_STORAGE_KEY = 'mission-control:last-event-id'

const AGENT_STATUS_MAP = {
  running: 'active',
  active: 'active',
  blocked: 'blocked',
  paused: 'blocked',
  idle: 'idle',
  completed: 'idle',
  done: 'idle',
  failed: 'blocked',
  thinking: 'thinking',
  scanning: 'thinking',
}

function padTime(value) {
  return String(value).padStart(2, '0')
}

function parseRuntimeToSeconds(runtime) {
  if (!runtime || typeof runtime !== 'string') return 0
  const parts = runtime.split(':').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0
  return (parts[0] * 3600) + (parts[1] * 60) + parts[2]
}

function formatRuntime(seconds) {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = Math.floor(safe % 60)
  return `${padTime(hours)}:${padTime(minutes)}:${padTime(secs)}`
}

function deriveRuntime(agent) {
  const startedAt = agent.startedAt || agent.started_at
  if (startedAt) {
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    return formatRuntime(elapsed)
  }
  return agent.runtime || '00:00:00'
}

function normalizeAgent(rawAgent) {
  const status = AGENT_STATUS_MAP[String(rawAgent?.status || '').toLowerCase()] || 'idle'
  return {
    id: String(rawAgent?.id || rawAgent?.agentId || ''),
    name: rawAgent?.name || rawAgent?.agentName || rawAgent?.id || 'Agent',
    role: rawAgent?.role || 'Autonomous Agent',
    status,
    currentTask: rawAgent?.currentTask || rawAgent?.task || rawAgent?.statusMessage || 'Awaiting work',
    lastCommit: rawAgent?.lastCommit || rawAgent?.last_commit || null,
    progress: Number.isFinite(rawAgent?.progress) ? rawAgent.progress : 0,
    runtime: deriveRuntime(rawAgent),
    blockers: Array.isArray(rawAgent?.blockers) ? rawAgent.blockers : (rawAgent?.blocker ? [rawAgent.blocker] : []),
    log: Array.isArray(rawAgent?.log) ? rawAgent.log : [],
    startedAt: rawAgent?.startedAt || rawAgent?.started_at || null,
  }
}

function normalizeDecision(rawDecision) {
  const timestamp = rawDecision?.createdAt || rawDecision?.timestamp || new Date().toISOString()
  return {
    id: String(rawDecision?.id || rawDecision?.decisionId || ''),
    agentId: rawDecision?.agentId || rawDecision?.payload?.agentId || null,
    agentName: rawDecision?.agentName || rawDecision?.payload?.agentName || rawDecision?.payload?.agentId || 'SYSTEM',
    question: rawDecision?.question || rawDecision?.prompt || rawDecision?.title || rawDecision?.payload?.question || 'Decision required',
    context: rawDecision?.context || rawDecision?.payload?.context || rawDecision?.payload?.reasonCode || null,
    timestamp: new Date(timestamp).toLocaleTimeString(),
    status: rawDecision?.status || 'pending',
    response: rawDecision?.response,
    isResolving: false,
    resolveError: null,
  }
}

function eventToInsight(event) {
  const supported = new Set([
    'build.failed',
    'build.passed',
    'heal.attempted',
    'heal.completed',
    'heal.escalated',
    'decision.required',
    'decision.resolved',
  ])

  if (!supported.has(event.type)) {
    return null
  }

  const source = event.source || event.agentId || 'system'
  const payload = event.payload || {}
  const detail =
    payload.summary ||
    payload.message ||
    payload.reasonCode ||
    payload.humanContext ||
    payload.patchSummary ||
    'Live control-plane signal'

  const defaultTitle = {
    'build.failed': 'Build failed',
    'build.passed': 'Build passed',
    'heal.attempted': 'Auto-heal started',
    'heal.completed': 'Auto-heal completed',
    'heal.escalated': 'Auto-heal escalated',
    'decision.required': 'Decision required',
    'decision.resolved': 'Decision resolved',
  }

  return {
    id: `insight-${event.id || Date.now()}`,
    severity: event.severity || (event.type.includes('failed') || event.type.includes('escalated') ? 'critical' : 'info'),
    source,
    title: payload.title || defaultTitle[event.type] || event.type,
    detail,
    action: event.type === 'decision.required' ? 'Open inbox' : null,
    timestamp: new Date(event.timestamp || Date.now()).toLocaleTimeString(),
    status: 'pending',
  }
}

function buildSpawnPayload(modeConfig, missionData) {
  const objective = missionData?.objective || missionData?.title || 'Mission execution'
  const repoPath = import.meta.env.VITE_DEFAULT_REPO_PATH || '/workspace'
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const branchLabel = modeConfig?.id || 'mission'
  const task = `${modeConfig?.label || 'Mission'}: ${objective}`

  return {
    task,
    repoPath,
    branch: `codex/${branchLabel}-${timestamp}`,
    metadata: {
      mode: modeConfig?.id || 'unknown',
      missionTitle: missionData?.title || null,
      constraints: missionData?.constraints || [],
      successMetrics: missionData?.successMetrics || [],
      autonomyLevel: missionData?.autonomyLevel || null,
    },
  }
}

export default function App() {
  const [mode, setMode] = useState(null)
  const [activePanel, setActivePanel] = useState(null)
  const [agents, setAgents] = useState([])
  const [mission, setMission] = useState({ status: 'awaiting_interview' })
  const [decisions, setDecisions] = useState([])
  const [insights, setInsights] = useState([])
  const [clock, setClock] = useState(new Date())
  const [connectionState, setConnectionState] = useState('closed')

  const streamRef = useRef(null)
  const seenEventIdsRef = useRef(new Set())
  const lastEventIdRef = useRef(localStorage.getItem(LAST_EVENT_STORAGE_KEY) || null)

  const modeConfig = mode ? MODE_CONFIG[mode] : null

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const ticker = setInterval(() => {
      setAgents((prev) => prev.map((agent) => {
        if (agent.startedAt) {
          return { ...agent, runtime: deriveRuntime(agent) }
        }

        if (agent.status === 'idle') {
          return agent
        }

        return { ...agent, runtime: formatRuntime(parseRuntimeToSeconds(agent.runtime) + 1) }
      }))
    }, 1000)

    return () => clearInterval(ticker)
  }, [])

  useEffect(() => {
    if (!mode) {
      return undefined
    }

    let mounted = true

    const loadSnapshot = async () => {
      try {
        const [agentRows, pendingRows] = await Promise.all([
          fetchAgents(),
          fetchPendingDecisions(),
        ])

        if (!mounted) return

        setAgents(agentRows.map(normalizeAgent).filter((agent) => agent.id))
        setDecisions(pendingRows.map(normalizeDecision).filter((decision) => decision.id))
      } catch {
        if (!mounted) return
        setConnectionState((state) => (state === 'open' ? state : 'error'))
      }
    }

    const handleEnvelope = (envelope) => {
      if (!envelope || !envelope.type) return

      if (envelope.id) {
        if (seenEventIdsRef.current.has(envelope.id)) {
          return
        }

        seenEventIdsRef.current.add(envelope.id)
        if (seenEventIdsRef.current.size > 2000) {
          seenEventIdsRef.current = new Set(Array.from(seenEventIdsRef.current).slice(-1000))
        }

        lastEventIdRef.current = envelope.id
        localStorage.setItem(LAST_EVENT_STORAGE_KEY, envelope.id)
      }

      const payload = envelope.payload || {}

      if (envelope.type.startsWith('agent.')) {
        const nextAgent = normalizeAgent({
          ...payload,
          id: payload.id || envelope.agentId || payload.agentId,
        })

        if (!nextAgent.id) return

        setAgents((prev) => {
          const index = prev.findIndex((agent) => agent.id === nextAgent.id)
          if (index === -1) {
            return [nextAgent, ...prev]
          }

          const merged = { ...prev[index], ...nextAgent }
          return prev.map((agent, i) => (i === index ? merged : agent))
        })
      }

      if (envelope.type === 'decision.required') {
        const required = normalizeDecision({
          ...payload,
          id: payload.id || payload.decisionId || envelope.id,
          status: 'pending',
        })

        if (required.id) {
          setDecisions((prev) => {
            const exists = prev.some((decision) => decision.id === required.id)
            return exists ? prev : [required, ...prev]
          })
        }

        setActivePanel((panel) => panel || 'inbox')
      }

      if (envelope.type === 'decision.resolved') {
        const resolvedId = payload.id || payload.decisionId || payload.targetDecisionId
        if (resolvedId) {
          setDecisions((prev) => prev.map((decision) => (
            decision.id === resolvedId
              ? { ...decision, status: 'resolved', isResolving: false, resolveError: null }
              : decision
          )))
        }
      }

      const insight = eventToInsight(envelope)
      if (insight) {
        setInsights((prev) => [insight, ...prev].slice(0, 50))
      }
    }

    loadSnapshot()

    streamRef.current?.close()
    streamRef.current = subscribeToEvents({
      initialLastEventId: lastEventIdRef.current,
      onEnvelope: handleEnvelope,
      onError: () => setConnectionState('reconnecting'),
      onStateChange: (state) => {
        setConnectionState(state)
        if (state === 'open') {
          loadSnapshot()
        }
      },
    })

    return () => {
      mounted = false
      streamRef.current?.close()
      streamRef.current = null
    }
  }, [mode])

  const selectMode = (selectedMode) => {
    const cfg = MODE_CONFIG[selectedMode]
    setMode(selectedMode)
    setInsights([])
    setMission({ status: 'awaiting_interview' })
    setDecisions([])
    setActivePanel(cfg.primaryPanel === 'insights' ? 'interview' : 'interview')
  }

  const handleMissionComplete = async (missionData) => {
    setMission(missionData)
    setActivePanel(modeConfig.primaryPanel)

    try {
      const spawnPayload = buildSpawnPayload(modeConfig, missionData)
      const spawned = await spawnAgent(spawnPayload)

      if (spawned?.agentId) {
        setAgents((prev) => {
          if (prev.some((agent) => agent.id === spawned.agentId)) {
            return prev
          }

          return [normalizeAgent({
            id: spawned.agentId,
            status: 'running',
            task: spawnPayload.task,
            startedAt: new Date().toISOString(),
          }), ...prev]
        })
      }
    } catch {
      setInsights((prev) => [{
        id: `insight-spawn-${Date.now()}`,
        severity: 'critical',
        source: 'spawn',
        title: 'Spawn request failed',
        detail: 'Mission saved, but POST /spawn failed. Check auth/proxy configuration.',
        action: null,
        timestamp: new Date().toLocaleTimeString(),
        status: 'pending',
      }, ...prev].slice(0, 50))
    }
  }

  const handleDecisionResponse = async (decisionId, response) => {
    let decisionToResolve = null

    setDecisions((prev) => prev.map((decision) => {
      if (decision.id !== decisionId) return decision
      decisionToResolve = decision
      return {
        ...decision,
        isResolving: true,
        resolveError: null,
        response,
      }
    }))

    if (decisionToResolve?.agentId) {
      setAgents((prev) => prev.map((agent) => (
        agent.id === decisionToResolve.agentId
          ? { ...agent, status: 'active', currentTask: 'Resuming after decision', blockers: [] }
          : agent
      )))
    }

    try {
      await resolveDecision(decisionId, {
        resolution: response,
        actor: 'dashboard.user',
      })

      setDecisions((prev) => prev.map((decision) => (
        decision.id === decisionId
          ? { ...decision, status: 'resolved', isResolving: false, resolveError: null }
          : decision
      )))
    } catch {
      setDecisions((prev) => prev.map((decision) => (
        decision.id === decisionId
          ? { ...decision, status: 'pending', isResolving: false, resolveError: 'Failed to resolve. Retry.' }
          : decision
      )))
    }
  }

  const handleInsightAct = (insight) => {
    if (insight.action) {
      setActivePanel('inbox')
    }
  }

  const handleInsightDismiss = (insightId) => {
    setInsights((prev) => prev.map((insight) => (
      insight.id === insightId ? { ...insight, status: 'dismissed' } : insight
    )))
  }

  const handleReset = () => {
    setMode(null)
    setActivePanel(null)
    setAgents([])
    setMission({ status: 'awaiting_interview' })
    setDecisions([])
    setInsights([])
    setConnectionState('closed')
  }

  if (!mode) return <ModeSelector onSelect={selectMode} />

  const isCTO = mode === MODES.CTO
  const accentColor = modeConfig.accentColor
  const pendingDecisions = decisions.filter((decision) => decision.status === 'pending').length
  const criticalInsights = insights.filter((insight) => insight.severity === 'critical' && insight.status === 'pending').length

  const navItems = [
    ...(isCTO ? [{ id: 'insights', icon: BarChart2, label: 'SIGNALS', badge: criticalInsights }] : []),
    { id: 'fleet', icon: Radio, label: 'FLEET' },
    { id: 'inbox', icon: Inbox, label: 'INBOX', badge: pendingDecisions },
    { id: 'mission', icon: Target, label: isCTO ? 'FOCUS' : 'MISSION' },
    { id: 'interview', icon: Terminal, label: 'BRIEF' },
  ]

  const isLive = connectionState === 'open'

  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col">
      <div className="scanline" />

      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="font-display font-black text-text tracking-[0.3em] text-sm">MISSION CONTROL</div>
            <div className="text-xs tracking-widest" style={{ color: accentColor + 'aa' }}>
              {modeConfig.label}
              {mission.title && <span className="text-muted ml-2">· {mission.title.toUpperCase().slice(0, 40)}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs font-mono" style={{ color: accentColor }}>{clock.toLocaleTimeString()}</div>
            <div className="text-xs text-muted">{clock.toLocaleDateString()}</div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isLive ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: isLive ? accentColor : '#4a6278' }}
            />
            <span className="text-xs text-muted tracking-widest">
              {isLive ? 'LIVE' : connectionState.toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <nav className="w-16 border-r border-border flex flex-col items-center py-6 gap-2">
          {navItems.map(({ id, icon: Icon, label, badge }) => (
            <button
              key={id}
              onClick={() => setActivePanel(id)}
              title={label}
              className={`relative w-10 h-10 rounded flex flex-col items-center justify-center gap-0.5 transition-all duration-200 border ${
                activePanel === id ? 'text-void' : 'text-muted hover:text-text border-transparent'
              }`}
              style={activePanel === id ? {
                backgroundColor: accentColor + '22',
                color: accentColor,
                borderColor: accentColor + '44',
              } : {}}
            >
              <Icon size={14} />
              <span className="text-[8px] tracking-widest opacity-70">{label}</span>
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-warn text-void text-[9px] font-bold rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          ))}

          <div className="flex-1" />

          <button
            onClick={handleReset}
            title="CHANGE MODE"
            className="w-10 h-10 rounded flex items-center justify-center text-muted hover:text-warn hover:bg-warn/10 border border-transparent hover:border-warn/30 transition-all"
          >
            <RotateCcw size={14} />
          </button>
        </nav>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {activePanel === 'insights' && (
              <InsightsPanel insights={insights} onAct={handleInsightAct} onDismiss={handleInsightDismiss} />
            )}
            {activePanel === 'fleet' && (
              <FleetView agents={agents} modeConfig={modeConfig} onOpenInbox={() => setActivePanel('inbox')} />
            )}
            {activePanel === 'mission' && (
              <div>
                <h2 className="font-display font-bold text-text tracking-widest text-sm mb-4">
                  {modeConfig.brief?.title || 'MISSION BRIEF'}
                </h2>
                <div className="border border-border rounded bg-panel p-4">
                  <MissionBrief mission={mission} modeConfig={modeConfig} />
                </div>
              </div>
            )}
            {activePanel === 'inbox' && (
              <div>
                <h2 className="font-display font-bold text-text tracking-widest text-sm mb-4">DECISION INBOX</h2>
                <DecisionInbox decisions={decisions} onRespond={handleDecisionResponse} />
              </div>
            )}
            {activePanel === 'interview' && (
              <div className="h-[calc(100vh-12rem)] flex flex-col">
                <Interview onComplete={handleMissionComplete} modeConfig={modeConfig} />
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="border-t border-border px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted">
          {isCTO ? (
            <>
              <span>{insights.filter((insight) => insight.severity === 'critical' && insight.status === 'pending').length} critical</span>
              <span>·</span>
              <span>{insights.filter((insight) => insight.status === 'pending').length} signals</span>
              <span>·</span>
              <span>{pendingDecisions} decisions pending</span>
            </>
          ) : (
            <>
              <span>{agents.filter((agent) => agent.status === 'active').length} active</span>
              <span>·</span>
              <span>{agents.filter((agent) => agent.status === 'blocked').length} blocked</span>
              <span>·</span>
              <span>{pendingDecisions} decisions pending</span>
            </>
          )}
        </div>
        <div className="text-xs text-muted/40 tracking-widest">v0.1.0 · LIVE · {modeConfig.label}</div>
      </footer>
    </div>
  )
}
