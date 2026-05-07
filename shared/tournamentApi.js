const API_BASE = '/api'

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    const text = await response.text()

    try {
      const payload = JSON.parse(text)
      throw new Error(payload.error || payload.message || `Request failed: ${response.status}`)
    } catch {
      let parsedPayload = null
      try {
        parsedPayload = JSON.parse(text)
      } catch {}

      throw new Error(parsedPayload?.error || parsedPayload?.message || text || `Request failed: ${response.status}`)
    }
  }

  return response.json()
}

export const fetchTournamentState = async () => request('/state')

export const saveTournamentState = async (state) =>
  request('/state', {
    method: 'PUT',
    body: JSON.stringify(state),
  })

export const registerTournamentPlayer = async (player) =>
  request('/register-player', {
    method: 'POST',
    body: JSON.stringify(player),
  })

export const submitPlayerScore = async (payload) =>
  request('/player-score', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const submitPlayoffPlayerScore = async (payload) =>
  request('/playoff-player-score', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
