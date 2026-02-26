import { CheckSquare, AlertOctagon, Cpu } from 'lucide-react'

export default function MissionBrief({ mission, modeConfig }) {
  const isCTO = modeConfig?.id === 'cto'
  const fields = modeConfig?.brief?.fields || {}
  const accentClass = isCTO ? 'text-blue-400' : 'text-accent'
  const accentBorder = isCTO ? 'border-blue-400/30' : 'border-accent/30'
  const warnBorder = 'border-warn/30'

  if (!mission.title) {
    return (
      <div className="text-center py-8">
        <div className="text-muted text-xs">
          {isCTO ? 'NO DIAGNOSTIC PROFILE' : 'NO ACTIVE MISSION'}
        </div>
        <div className="text-muted/50 text-xs mt-1">Complete the interview to initialize</div>
      </div>
    )
  }

  const autonomyLabel = mission.autonomyLevel?.toLowerCase().includes('full') ? 'HIGH'
    : mission.autonomyLevel?.toLowerCase().includes('often') ? 'LOW'
    : 'MEDIUM'
  const autonomyColor = autonomyLabel === 'HIGH' ? accentClass : autonomyLabel === 'LOW' ? 'text-warn' : 'text-blue-400'

  return (
    <div className="space-y-4 animate-fadeIn">
      <div>
        <div className="text-xs text-muted mb-1 tracking-widest">{fields.objective || 'OBJECTIVE'}</div>
        <p className="text-sm text-text leading-relaxed">{mission.objective}</p>
      </div>

      {mission.successMetrics?.filter(Boolean).length > 0 && (
        <div>
          <div className={`flex items-center gap-1.5 text-xs text-muted mb-2 tracking-widest`}>
            <CheckSquare size={10} />
            <span>{fields.success || 'SUCCESS LOOKS LIKE'}</span>
          </div>
          {mission.successMetrics.filter(Boolean).map((m, i) => (
            <p key={i} className={`text-xs text-text/80 pl-3 border-l ${accentBorder} py-0.5`}>{m}</p>
          ))}
        </div>
      )}

      {mission.constraints?.filter(Boolean).length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted mb-2 tracking-widest">
            <AlertOctagon size={10} />
            <span>{fields.constraints || 'CONSTRAINTS'}</span>
          </div>
          {mission.constraints.filter(Boolean).map((c, i) => (
            <p key={i} className={`text-xs text-warn/70 pl-3 border-l ${warnBorder} py-0.5`}>{c}</p>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          <Cpu size={10} className="text-muted" />
          <span className="text-xs text-muted">{fields.autonomy || 'AUTONOMY'}</span>
        </div>
        <span className={`text-xs font-bold ${autonomyColor}`}>{autonomyLabel}</span>
      </div>

      {mission.createdAt && (
        <div className="text-xs text-muted/50">
          INITIALIZED {new Date(mission.createdAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
