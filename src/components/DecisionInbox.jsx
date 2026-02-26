import { useState } from 'react'
import { MessageSquare, ChevronRight } from 'lucide-react'

export default function DecisionInbox({ decisions, onRespond }) {
  const [selected, setSelected] = useState(null)
  const [response, setResponse] = useState('')

  const pending = decisions.filter(d => d.status === 'pending')
  const resolved = decisions.filter(d => d.status === 'resolved')

  const handleRespond = (decision) => {
    if (!response.trim()) return
    onRespond(decision.id, response.trim())
    setResponse('')
    setSelected(null)
  }

  if (decisions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center mx-auto mb-3">
          <MessageSquare size={14} className="text-muted" />
        </div>
        <div className="text-muted text-xs">INBOX CLEAR</div>
        <div className="text-muted/50 text-xs mt-1">Agents are operating autonomously</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <div>
          <div className="text-xs text-warn tracking-widest mb-2">{pending.length} PENDING</div>
          {pending.map(decision => (
            <div key={decision.id} className="border border-warn/30 bg-warn/5 rounded p-3 mb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-muted mb-1">{decision.agentName} · {decision.timestamp}</div>
                  <p className="text-sm text-text leading-relaxed">{decision.question}</p>
                  {decision.context && (
                    <p className="text-xs text-muted mt-1 italic">{decision.context}</p>
                  )}
                </div>
              </div>

              {selected === decision.id ? (
                <div className="mt-3">
                  <textarea
                    value={response}
                    onChange={e => setResponse(e.target.value)}
                    placeholder="Your decision..."
                    rows={2}
                    className="w-full bg-void border border-border rounded px-3 py-2 text-sm text-text placeholder-muted outline-none focus:border-accent/50 transition-colors font-mono resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleRespond(decision)}
                      className="text-xs bg-accent text-void font-bold px-3 py-1.5 rounded hover:opacity-90 transition-opacity"
                    >
                      SEND DECISION
                    </button>
                    <button
                      onClick={() => setSelected(null)}
                      className="text-xs text-muted border border-border px-3 py-1.5 rounded hover:border-muted transition-colors"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSelected(decision.id)}
                  className="mt-2 flex items-center gap-1 text-xs text-warn hover:text-warn/80 transition-colors"
                >
                  RESPOND <ChevronRight size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <div className="text-xs text-muted tracking-widest mb-2">{resolved.length} RESOLVED</div>
          {resolved.map(decision => (
            <div key={decision.id} className="border border-border/50 rounded p-3 mb-2 opacity-50">
              <div className="text-xs text-muted mb-1">{decision.agentName}</div>
              <p className="text-xs text-muted line-through">{decision.question}</p>
              <p className="text-xs text-accent/60 mt-1">↳ {decision.response}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
