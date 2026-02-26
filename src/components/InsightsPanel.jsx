import { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, ChevronRight, CheckCircle } from 'lucide-react'

const severityConfig = {
  critical: {
    icon: AlertCircle,
    color: '#ff6b35',
    bg: 'bg-warn/5',
    border: 'border-warn/30',
    label: 'CRITICAL',
    textColor: 'text-warn',
  },
  warn: {
    icon: AlertTriangle,
    color: '#facc15',
    bg: 'bg-yellow-500/5',
    border: 'border-yellow-500/30',
    label: 'ATTENTION',
    textColor: 'text-yellow-400',
  },
  info: {
    icon: Info,
    color: '#60a5fa',
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    label: 'SIGNAL',
    textColor: 'text-blue-400',
  },
}

function InsightCard({ insight, onAct, onDismiss }) {
  const cfg = severityConfig[insight.severity]
  const Icon = cfg.icon
  const [expanded, setExpanded] = useState(insight.severity === 'critical')

  return (
    <div className={`rounded border ${cfg.border} ${cfg.bg} p-4 transition-all duration-200 animate-slideUp`}>
      <div className="flex items-start gap-3">
        <Icon size={14} className={`${cfg.textColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`text-xs font-bold tracking-widest ${cfg.textColor}`}>{cfg.label}</span>
            <span className="text-xs text-muted">{insight.source} · {insight.timestamp}</span>
          </div>
          <p className="text-sm text-text font-display font-semibold leading-snug">{insight.title}</p>

          {expanded && (
            <div className="mt-2 animate-fadeIn">
              <p className="text-xs text-muted/80 leading-relaxed">{insight.detail}</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => onAct(insight)}
                  className="text-xs font-bold px-3 py-1.5 rounded border transition-colors"
                  style={{ color: cfg.color, borderColor: cfg.color + '55' }}
                  onMouseEnter={e => e.currentTarget.style.background = cfg.color + '15'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {insight.action} →
                </button>
                <button
                  onClick={() => onDismiss(insight.id)}
                  className="text-xs text-muted border border-border px-3 py-1.5 rounded hover:border-muted transition-colors"
                >
                  DISMISS
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted hover:text-text transition-colors flex-shrink-0"
        >
          <ChevronRight size={14} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>
    </div>
  )
}

export default function InsightsPanel({ insights, onAct, onDismiss }) {
  const critical = insights.filter(i => i.severity === 'critical' && i.status !== 'dismissed')
  const warn = insights.filter(i => i.severity === 'warn' && i.status !== 'dismissed')
  const info = insights.filter(i => i.severity === 'info' && i.status !== 'dismissed')
  const dismissed = insights.filter(i => i.status === 'dismissed')

  const total = critical.length + warn.length + info.length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-text tracking-widest text-sm">INSIGHTS</h2>
          <p className="text-xs text-muted mt-1">
            {total === 0 ? 'All clear — no active signals' : `${total} active signal${total !== 1 ? 's' : ''}`}
            {critical.length > 0 && <span className="text-warn ml-2">· {critical.length} critical</span>}
          </p>
        </div>
      </div>

      {total === 0 && (
        <div className="text-center py-12">
          <CheckCircle size={24} className="text-accent/40 mx-auto mb-3" />
          <div className="text-muted text-xs">No active signals</div>
          <div className="text-muted/50 text-xs mt-1">Agents are scanning — check back shortly</div>
        </div>
      )}

      <div className="space-y-3">
        {[...critical, ...warn, ...info].map(insight => (
          <InsightCard
            key={insight.id}
            insight={insight}
            onAct={onAct}
            onDismiss={onDismiss}
          />
        ))}
      </div>

      {dismissed.length > 0 && (
        <div className="mt-6">
          <div className="text-xs text-muted/50 tracking-widest mb-2">{dismissed.length} DISMISSED</div>
          {dismissed.map(insight => (
            <div key={insight.id} className="text-xs text-muted/30 py-1 line-through">{insight.title}</div>
          ))}
        </div>
      )}
    </div>
  )
}
