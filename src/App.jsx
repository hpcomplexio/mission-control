import { useState, useEffect } from 'react'
import { Terminal, Radio, Inbox, Target, RefreshCw, Zap, RotateCcw, BarChart2 } from 'lucide-react'
import ModeSelector from './components/ModeSelector'
import FleetView from './components/FleetView'
import Interview from './components/Interview'
import MissionBrief from './components/MissionBrief'
import DecisionInbox from './components/DecisionInbox'
import InsightsPanel from './components/InsightsPanel'
import { MODES, MODE_CONFIG } from './config/modes'
import './index.css'

export default function App() {
  const [mode, setMode] = useState(null)         // null = mode selector screen
  const [activePanel, setActivePanel] = useState(null)
  const [agents, setAgents] = useState([])
  const [mission, setMission] = useState({ status: 'awaiting_interview' })
  const [decisions, setDecisions] = useState([])
  const [insights, setInsights] = useState([])
  const [chaosIndex, setChaosIndex] = useState(0)
  const [clock, setClock] = useState(new Date())

  const modeConfig = mode ? MODE_CONFIG[mode] : null

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Agent runtime ticker
  useEffect(() => {
    if (mission.status !== 'active') return
    const t = setInterval(() => {
      setAgents(prev => prev.map(a => {
        if (a.status === 'idle') return a
        const [h, m, s] = a.runtime.split(':').map(Number)
        const total = h * 3600 + m * 60 + s + 1
        const pad = n => String(n).padStart(2, '0')
        return { ...a, runtime: `${pad(Math.floor(total/3600))}:${pad(Math.floor((total%3600)/60))}:${pad(total%60)}` }
      }))
    }, 1000)
    return () => clearInterval(t)
  }, [mission.status])

  const selectMode = (selectedMode) => {
    const cfg = MODE_CONFIG[selectedMode]
    setMode(selectedMode)
    setAgents(cfg.agents.map(a => ({ ...a })))
    setInsights(cfg.insights ? cfg.insights.map(i => ({ ...i })) : [])
    setMission({ status: 'awaiting_interview' })
    setDecisions([])
    setChaosIndex(0)
    setActivePanel(cfg.primaryPanel === 'insights' ? 'interview' : 'interview')
  }

  const handleMissionComplete = (missionData) => {
    setMission(missionData)
    setActivePanel(modeConfig.primaryPanel)
  }

  const handleResolveBlocker = (agentId) => {
    const agent = agents.find(a => a.id === agentId)
    const newDecision = {
      id: `d-${Date.now()}`,
      agentId,
      agentName: agent.name,
      question: agent.blockers[0],
      context: `${agent.name} is blocked on: ${agent.currentTask}`,
      timestamp: new Date().toLocaleTimeString(),
      status: 'pending',
    }
    setDecisions(prev => [newDecision, ...prev])
    setActivePanel('inbox')
  }

  const handleDecisionResponse = (decisionId, response) => {
    const decision = decisions.find(d => d.id === decisionId)
    setDecisions(prev => prev.map(d => d.id === decisionId ? { ...d, status: 'resolved', response } : d))
    if (decision?.agentId) {
      setAgents(prev => prev.map(a =>
        a.id === decision.agentId ? { ...a, status: 'active', blockers: [], currentTask: 'Resumed after decision' } : a
      ))
    }
  }

  const handleInsightAct = (insight) => {
    const newDecision = {
      id: `d-${Date.now()}`,
      agentId: insight.source,
      agentName: insight.source,
      question: `${insight.title} — ${insight.detail}`,
      context: `Recommended action: ${insight.action}`,
      timestamp: new Date().toLocaleTimeString(),
      status: 'pending',
    }
    setDecisions(prev => [newDecision, ...prev])
    setInsights(prev => prev.map(i => i.id === insight.id ? { ...i, status: 'actioned' } : i))
    setActivePanel('inbox')
  }

  const handleInsightDismiss = (insightId) => {
    setInsights(prev => prev.map(i => i.id === insightId ? { ...i, status: 'dismissed' } : i))
  }

  const handleInjectChaos = () => {
    const events = modeConfig.chaosEvents
    const event = events[chaosIndex % events.length]
    setChaosIndex(i => i + 1)

    if (event.type === 'blocker') {
      setAgents(prev => prev.map((a, i) =>
        i === event.agentIndex ? { ...a, status: 'blocked', blockers: [event.message] } : a
      ))
    } else if (event.type === 'proposal') {
      const newDecision = {
        id: `d-${Date.now()}`,
        agentId: 'agent-001',
        agentName: event.agentName || 'ARCH-1',
        question: event.text,
        context: 'Dashboard improvement proposal from agent observation',
        timestamp: new Date().toLocaleTimeString(),
        status: 'pending',
      }
      setDecisions(prev => [newDecision, ...prev])
      setActivePanel('inbox')
    } else if (event.type === 'status') {
      setAgents(prev => prev.map((a, i) =>
        i === event.agentIndex ? { ...a, status: event.newStatus, currentTask: event.task, blockers: [] } : a
      ))
    } else if (event.type === 'insight') {
      const newInsight = {
        id: `insight-${Date.now()}`,
        severity: event.severity,
        source: event.source,
        title: event.title,
        detail: event.detail,
        action: event.action,
        timestamp: 'just now',
        status: 'pending',
      }
      setInsights(prev => [newInsight, ...prev])
      setActivePanel('insights')
    } else if (event.type === 'rescan') {
      setAgents(prev => prev.map(a => ({ ...a, status: a.status === 'idle' ? 'thinking' : a.status, progress: Math.min(a.progress + 15, 95) })))
    }
  }

  const handleReset = () => {
    setMode(null)
    setActivePanel(null)
    setAgents([])
    setMission({ status: 'awaiting_interview' })
    setDecisions([])
    setInsights([])
  }

  // Mode selector
  if (!mode) return <ModeSelector onSelect={selectMode} />

  const isCTO = mode === MODES.CTO
  const accentColor = modeConfig.accentColor
  const pendingDecisions = decisions.filter(d => d.status === 'pending').length
  const criticalInsights = insights.filter(i => i.severity === 'critical' && i.status === 'pending').length

  const navItems = [
    ...(isCTO ? [{ id: 'insights', icon: BarChart2, label: 'SIGNALS', badge: criticalInsights }] : []),
    { id: 'fleet',     icon: Radio,    label: 'FLEET' },
    { id: 'inbox',     icon: Inbox,    label: 'INBOX', badge: pendingDecisions },
    { id: 'mission',   icon: Target,   label: isCTO ? 'FOCUS' : 'MISSION' },
    { id: 'interview', icon: Terminal, label: 'BRIEF' },
  ]

  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col">
      <div className="scanline" />

      {/* Header */}
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
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: mission.status === 'active' ? accentColor : '#4a6278' }} />
            <span className="text-xs text-muted tracking-widest">
              {mission.status === 'active' ? 'LIVE' : 'STANDBY'}
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
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
            onClick={handleInjectChaos}
            title={modeConfig.injectLabel}
            className="w-10 h-10 rounded flex items-center justify-center text-muted hover:border transition-all border-transparent"
            style={{ '--hover': accentColor }}
            onMouseEnter={e => { e.currentTarget.style.color = accentColor; e.currentTarget.style.borderColor = accentColor + '44' }}
            onMouseLeave={e => { e.currentTarget.style.color = ''; e.currentTarget.style.borderColor = 'transparent' }}
          >
            {isCTO ? <RefreshCw size={14} /> : <Zap size={14} />}
          </button>

          <button
            onClick={handleReset}
            title="CHANGE MODE"
            className="w-10 h-10 rounded flex items-center justify-center text-muted hover:text-warn hover:bg-warn/10 border border-transparent hover:border-warn/30 transition-all"
          >
            <RotateCcw size={14} />
          </button>
        </nav>

        {/* Panel */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {activePanel === 'insights' && (
              <InsightsPanel insights={insights} onAct={handleInsightAct} onDismiss={handleInsightDismiss} />
            )}
            {activePanel === 'fleet' && (
              <FleetView agents={agents} onResolveBlocker={handleResolveBlocker} onInjectChaos={handleInjectChaos} modeConfig={modeConfig} />
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

      {/* Footer */}
      <footer className="border-t border-border px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted">
          {isCTO ? (
            <>
              <span>{insights.filter(i => i.severity === 'critical' && i.status === 'pending').length} critical</span>
              <span>·</span>
              <span>{insights.filter(i => i.status === 'pending').length} signals</span>
              <span>·</span>
              <span>{pendingDecisions} decisions pending</span>
            </>
          ) : (
            <>
              <span>{agents.filter(a => a.status === 'active').length} active</span>
              <span>·</span>
              <span>{agents.filter(a => a.status === 'blocked').length} blocked</span>
              <span>·</span>
              <span>{pendingDecisions} decisions pending</span>
            </>
          )}
        </div>
        <div className="text-xs text-muted/40 tracking-widest">v0.1.0 · POC · {modeConfig.label}</div>
      </footer>
    </div>
  )
}
