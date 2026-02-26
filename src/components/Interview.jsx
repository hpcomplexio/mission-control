import { useState, useEffect, useRef } from 'react'
import { Send, CheckCircle } from 'lucide-react'

function TypingText({ text, speed = 18, onDone }) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    setDisplayed('')
    let i = 0
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1))
        i++
      } else {
        clearInterval(interval)
        onDone?.()
      }
    }, speed)
    return () => clearInterval(interval)
  }, [text])
  return <span>{displayed}</span>
}

export default function Interview({ onComplete, modeConfig }) {
  const questions = modeConfig?.interview?.questions || []
  const agentName = modeConfig?.interview?.agentName || 'AGENT'
  const agentRole = modeConfig?.interview?.agentRole || 'Intake Agent'
  const intro = modeConfig?.interview?.intro || "Let's get started."
  const doneMessage = modeConfig?.id === 'cto'
    ? 'Diagnostic profile compiled. Deploying analyst agents.'
    : 'Mission brief compiled. Deploying agents now.'
  const briefLabel = modeConfig?.id === 'cto' ? 'DIAGNOSTIC BRIEF' : 'MISSION BRIEF'
  const isCTO = modeConfig?.id === 'cto'

  const [phase, setPhase] = useState('intro')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState([])
  const [input, setInput] = useState('')
  const [typingDone, setTypingDone] = useState(false)
  const [history, setHistory] = useState([])
  const inputRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, phase])

  const startInterview = () => {
    setPhase('questioning')
    setHistory([{ role: 'agent', text: questions[0] }])
    setTypingDone(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() || !typingDone) return
    const answer = input.trim()
    const newAnswers = [...answers, answer]
    const newHistory = [...history, { role: 'user', text: answer }]
    setAnswers(newAnswers)
    setInput('')
    setTypingDone(false)
    const nextIndex = questionIndex + 1
    if (nextIndex < questions.length) {
      setQuestionIndex(nextIndex)
      setHistory([...newHistory, { role: 'agent', text: questions[nextIndex] }])
    } else {
      setHistory([...newHistory, { role: 'agent', text: doneMessage }])
      setPhase('done')
      setTimeout(() => {
        onComplete({
          title: newAnswers[0]?.slice(0, 60) || 'Active Mission',
          objective: newAnswers[0],
          constraints: [newAnswers[3]].filter(Boolean),
          successMetrics: [newAnswers[1]].filter(Boolean),
          autonomyLevel: newAnswers[4],
          createdAt: new Date().toISOString(),
          status: 'active',
          rawAnswers: newAnswers,
        })
      }, 1800)
    }
  }

  const ac = isCTO
    ? { text: 'text-blue-400', bg: 'bg-blue-400', border: 'border-blue-400/20', focus: 'focus:border-blue-400/50', btn: 'bg-blue-400/10 border-blue-400/30 hover:bg-blue-400/20', dot: 'bg-blue-400', dotHalf: 'bg-blue-400/50' }
    : { text: 'text-accent', bg: 'bg-accent', border: 'border-accent/20', focus: 'focus:border-accent/50', btn: 'bg-accent/10 border-accent/30 hover:bg-accent/20', dot: 'bg-accent', dotHalf: 'bg-accent/50' }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="font-display font-bold text-text tracking-widest text-sm">{briefLabel}</h2>
        <p className="text-xs text-muted mt-1">
          {isCTO ? 'Diagnostic calibration — shapes what agents surface' : 'Agent interview — establishes shared context for the fleet'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
        {phase === 'intro' && (
          <div className="animate-fadeIn">
            <div className="border border-border rounded p-4 bg-panel">
              <p className="text-xs text-muted mb-1">{agentName} / {agentRole}</p>
              <p className="text-sm text-text leading-relaxed">{intro}</p>
              <button onClick={startInterview} className={`mt-4 text-xs ${ac.bg} text-void font-bold px-4 py-2 rounded hover:opacity-90 transition-opacity`}>
                BEGIN →
              </button>
            </div>
          </div>
        )}

        {history.map((msg, i) => (
          <div key={i} className={`animate-fadeIn flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded p-3 ${msg.role === 'agent' ? 'bg-panel border border-border text-text' : `bg-dim border ${ac.border} ${ac.text}`}`}>
              {msg.role === 'agent' && i === history.length - 1 && phase !== 'done' ? (
                <p className="text-sm leading-relaxed">
                  <TypingText text={msg.text} onDone={() => setTypingDone(true)} />
                  {!typingDone && <span className={`animate-blink ${ac.text} ml-0.5`}>▋</span>}
                </p>
              ) : (
                <p className="text-sm leading-relaxed">{msg.text}</p>
              )}
              {msg.role === 'agent' && i === history.length - 1 && phase === 'done' && (
                <div className="flex items-center gap-2 mt-2">
                  <CheckCircle size={12} className={ac.text} />
                  <span className={`text-xs ${ac.text}`}>BRIEF LOCKED</span>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {phase === 'questioning' && (
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={typingDone ? 'Your answer...' : 'Listening...'}
            disabled={!typingDone}
            className={`flex-1 bg-panel border border-border rounded px-3 py-2 text-sm text-text placeholder-muted outline-none ${ac.focus} transition-colors disabled:opacity-40 font-mono`}
          />
          <button type="submit" disabled={!typingDone || !input.trim()} className={`p-2 border rounded transition-colors disabled:opacity-30 ${ac.btn}`}>
            <Send size={14} className={ac.text} />
          </button>
        </form>
      )}

      {phase === 'questioning' && (
        <div className="flex gap-1.5 mt-3 justify-center">
          {questions.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i < questionIndex ? `w-4 ${ac.dot}` : i === questionIndex ? `w-4 ${ac.dotHalf}` : 'w-1 bg-border'}`} />
          ))}
        </div>
      )}
    </div>
  )
}
