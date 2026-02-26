import { MODES, MODE_CONFIG } from '../config/modes'

export default function ModeSelector({ onSelect }) {
  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col items-center justify-center p-8">
      <div className="scanline" />

      <div className="mb-12 text-center animate-fadeIn">
        <div className="font-display font-black text-text tracking-[0.4em] text-2xl mb-2">MISSION CONTROL</div>
        <div className="text-muted text-xs tracking-widest">SELECT OPERATING MODE</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        {Object.values(MODE_CONFIG).map((mode, i) => (
          <button
            key={mode.id}
            onClick={() => onSelect(mode.id)}
            className="group text-left border border-border bg-panel rounded-lg p-6 hover:border-opacity-60 transition-all duration-300 animate-slideUp"
            style={{
              animationDelay: `${i * 0.1}s`,
              '--hover-color': mode.accentColor,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = mode.accentColor + '66'
              e.currentTarget.style.boxShadow = `0 0 24px ${mode.accentColor}11`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = ''
              e.currentTarget.style.boxShadow = ''
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div
                  className="font-display font-black text-sm tracking-widest mb-1"
                  style={{ color: mode.accentColor }}
                >
                  {mode.label}
                </div>
                <div className="text-xs text-muted">{mode.tagline}</div>
              </div>
              <span className="text-2xl">{mode.icon}</span>
            </div>

            <p className="text-xs text-muted/80 leading-relaxed mb-5">{mode.description}</p>

            <div className="flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: mode.accentColor }}
              />
              <span className="text-xs tracking-widest" style={{ color: mode.accentColor }}>
                ENTER MODE →
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-12 text-xs text-muted/40 tracking-widest animate-fadeIn">
        v0.1.0 · POC
      </div>
    </div>
  )
}
