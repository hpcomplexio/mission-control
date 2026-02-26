const API_BASE = (import.meta.env.VITE_CONTROL_PLANE_URL || '').replace(/\/$/, '')

const RETRY_DELAYS_MS = [500, 1000, 2000, 5000]

function buildUrl(path) {
  return `${API_BASE}${path}`
}

async function request(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export async function fetchAgents() {
  const data = await request('/agents')
  return Array.isArray(data) ? data : (data?.agents || [])
}

export async function fetchPendingDecisions() {
  const data = await request('/decisions?status=pending')
  return Array.isArray(data) ? data : (data?.decisions || [])
}

export function resolveDecision(decisionId, payload) {
  return request(`/decisions/${decisionId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

function parseSseChunk(chunk, state, onMessage) {
  state.buffer += chunk
  const lines = state.buffer.split(/\r?\n/)
  state.buffer = lines.pop() || ''

  for (const line of lines) {
    if (!line) {
      if (state.message.data.length > 0) {
        onMessage({ ...state.message, data: state.message.data.join('\n') })
      }
      state.message = { id: null, event: 'message', data: [] }
      continue
    }

    if (line.startsWith(':')) {
      continue
    }

    const sepIndex = line.indexOf(':')
    const field = sepIndex === -1 ? line : line.slice(0, sepIndex)
    const value = sepIndex === -1 ? '' : line.slice(sepIndex + 1).trimStart()

    if (field === 'event') {
      state.message.event = value || 'message'
    } else if (field === 'data') {
      state.message.data.push(value)
    } else if (field === 'id') {
      state.message.id = value
    }
  }
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    if (!signal) return

    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    if (signal.aborted) {
      onAbort()
      return
    }

    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export function subscribeToEvents({
  initialLastEventId,
  onEnvelope,
  onStateChange,
  onError,
}) {
  let closed = false
  let reconnectAttempt = 0
  let lastEventId = initialLastEventId || null
  let controller = null

  const close = () => {
    closed = true
    controller?.abort()
  }

  const run = async () => {
    while (!closed) {
      controller = new AbortController()
      const headers = { Accept: 'text/event-stream' }
      if (lastEventId) {
        headers['Last-Event-ID'] = lastEventId
      }

      try {
        onStateChange?.(reconnectAttempt > 0 ? 'reconnecting' : 'connecting')

        const response = await fetch(buildUrl('/events'), {
          headers,
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          throw new Error(`SSE connect failed: ${response.status}`)
        }

        reconnectAttempt = 0
        onStateChange?.('open')

        const decoder = new TextDecoder()
        const parserState = {
          buffer: '',
          message: { id: null, event: 'message', data: [] },
        }

        const reader = response.body.getReader()

        while (!closed) {
          const { done, value } = await reader.read()
          if (done) {
            throw new Error('SSE disconnected')
          }

          const chunk = decoder.decode(value, { stream: true })
          parseSseChunk(chunk, parserState, (message) => {
            if (message.id) {
              lastEventId = message.id
            }

            if (!message.data || message.event === 'heartbeat') {
              return
            }

            try {
              const envelope = JSON.parse(message.data)
              if (envelope?.id) {
                lastEventId = envelope.id
              }
              onEnvelope?.(envelope)
            } catch (error) {
              onError?.(new Error('Failed to parse SSE event payload'))
            }
          })
        }
      } catch (error) {
        if (closed || error?.name === 'AbortError') {
          break
        }

        onError?.(error)
        onStateChange?.('reconnecting')

        const backoff = RETRY_DELAYS_MS[Math.min(reconnectAttempt, RETRY_DELAYS_MS.length - 1)]
        reconnectAttempt += 1

        try {
          await wait(backoff, controller.signal)
        } catch {
          break
        }
      }
    }

    onStateChange?.('closed')
  }

  run()

  return {
    close,
    getLastEventId: () => lastEventId,
  }
}
