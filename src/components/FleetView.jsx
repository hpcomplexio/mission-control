import { useState } from 'react'
import { ChevronDown, ChevronRight, GitCommit, AlertTriangle, Clock } from 'lucide-react'

const statusConfig = {
  active: { label: 'ACTIVE', dot: 'bg-green-400 animate-pulse', text: 'text-green-400' },
  blocked: { label: 'BLOCKED', dot: 'bg-warn animate-pulse-slow', text: 'text-warn' },
  idle: { label: 'IDLE', dot: 'bg-muted', text: 'text-muted' },
  thinking: { label: 'SCANNING', dot: 'bg-blue-400 animate-pulse', text: 'text-blue-400' },
}

function AgentCard({ agent, accentColor, isCTO, onOpenInbox }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = statusConfig[agent.status] || statusConfig.idle

  return (
    <div className="agent-card rounded bg-panel p-4 animate-slideUp">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-text text-sm tracking-widest">{agent.name}</span>
              <span className="text-muted text-xs">/ {agent.role}</span>
            </div>
            <p className="text-xs text-muted mt-0.5 truncate">{agent.currentTask}</p>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <span className={`text-xs font-mono font-bold ${cfg.text}`}>{cfg.label}</span>
          <div className="flex items-center gap-1 mt-1 justify-end text-muted">
            <Clock size={10} />
            <span className="text-xs">{agent.runtime}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 h-px bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${agent.progress}%`, backgroundColor: agent.status === 'blocked' ? '#ff6b3566' : accentColor, opacity: agent.status === 'blocked' ? 0.4 : 1 }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-muted">progress</span>
        <span className="text-xs text-muted">{agent.progress}%</span>
      </div>

      {agent.blockers?.length > 0 && (
        <div className="mt-3 p-2 rounded border border-warn/30 bg-warn/5">
          {agent.blockers.map((blocker, index) => (
            <div key={index} className="flex items-start gap-2">
              <AlertTriangle size={12} className="text-warn flex-shrink-0 mt-0.5" />
              <span className="text-xs text-warn/80">{blocker}</span>
            </div>
          ))}
          <button
            onClick={onOpenInbox}
            className="mt-2 text-xs text-warn border border-warn/40 px-2 py-0.5 rounded hover:bg-warn/10 transition-colors"
          >
            VIEW DECISION INBOX
          </button>
        </div>
      )}

      {agent.lastCommit && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <GitCommit size={10} />
          <span className="truncate">{agent.lastCommit}</span>
        </div>
      )}

      <button onClick={() => setExpanded(!expanded)} className="mt-3 flex items-center gap-1 text-xs text-muted hover:text-text transition-colors">
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {isCTO ? 'SCAN LOG' : 'AGENT LOG'}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1 border-l-2 border-border pl-3">
          {agent.log.map((line, index) => (
            <p key={index} className="text-xs text-muted font-mono">{line}</p>
          ))}
          {(agent.status === 'active' || agent.status === 'thinking') && (
            <p className="text-xs font-mono cursor" style={{ color: accentColor }}>working</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function FleetView({ agents, modeConfig, onOpenInbox }) {
  const isCTO = modeConfig?.id === 'cto'
  const accentColor = modeConfig?.accentColor || '#00ff88'

  const counts = {
    active: agents.filter((agent) => agent.status === 'active').length,
    blocked: agents.filter((agent) => agent.status === 'blocked').length,
    thinking: agents.filter((agent) => agent.status === 'thinking').length,
    idle: agents.filter((agent) => agent.status === 'idle').length,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-text tracking-widest text-sm">
            {isCTO ? 'ANALYST FLEET' : 'FLEET STATUS'}
          </h2>
          <div className="flex gap-4 mt-1 text-xs">
            {counts.active > 0 && <span className="text-green-400">{counts.active} active</span>}
            {counts.thinking > 0 && <span className="text-blue-400">{counts.thinking} scanning</span>}
            {counts.blocked > 0 && <span className="text-warn">{counts.blocked} blocked</span>}
            {counts.idle > 0 && <span className="text-muted">{counts.idle} idle</span>}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            accentColor={accentColor}
            isCTO={isCTO}
            onOpenInbox={onOpenInbox}
          />
        ))}
      </div>
    </div>
  )
}
