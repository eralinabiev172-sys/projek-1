import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, 'data')
const dataFile = join(dataDir, 'tournament-state.json')
const PORT = Number(process.env.PORT || 8787)

const EMPTY_BRACKET = {
  roundOf32: [],
  roundOf16: [],
  quarterFinals: [],
  semiFinals: [],
  final12: null,
  final34: null,
  winners: [],
}

const DEFAULT_STATE = {
  tournamentName: 'Жаа атуу боюнча турнир',
  location: 'Чолпон-Ата, 2026-жыл',
  category: 'Классикалык жаа, 50 метр, эркектер',
  headReferee: '',
  headSecretary: '',
  players: [],
  scores: {},
  bracket: EMPTY_BRACKET,
  playoffStage: 'none',
  playoffMode: 16,
  playerNumberBook: {},
  scoreSubmission: {
    activeRound: 1,
    entries: [],
  },
}

const normalizePlayerName = (name) => name.trim().toLocaleLowerCase()
const sanitizePhone = (value) => String(value || '').replace(/\D/g, '').slice(0, 10)
const sanitizePlayerName = (value) => String(value || '').replace(/[^\p{L}\s'-]/gu, '').replace(/\s{2,}/g, ' ').trim()

let writeQueue = Promise.resolve()

const ensureStorage = async () => {
  await mkdir(dataDir, { recursive: true })
  try {
    await readFile(dataFile, 'utf8')
  } catch {
    await writeFile(dataFile, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8')
  }
}

const readState = async () => {
  await ensureStorage()
  try {
    const raw = await readFile(dataFile, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_STATE,
      ...parsed,
      bracket: parsed.bracket ? { ...EMPTY_BRACKET, ...parsed.bracket } : { ...EMPTY_BRACKET },
      players: Array.isArray(parsed.players) ? parsed.players : [],
      scores: parsed.scores || {},
      playerNumberBook: parsed.playerNumberBook || {},
      scoreSubmission: normalizeScoreSubmission(parsed.scoreSubmission),
    }
  } catch {
    return { ...DEFAULT_STATE, bracket: { ...EMPTY_BRACKET } }
  }
}

const writeState = async (state) => {
  await ensureStorage()
  writeQueue = writeQueue.then(() => writeFile(dataFile, JSON.stringify(state, null, 2), 'utf8'))
  await writeQueue
  return state
}

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  response.end(JSON.stringify(payload))
}

const readBody = async (request) =>
  new Promise((resolve, reject) => {
    let data = ''
    request.on('data', (chunk) => {
      data += chunk
    })
    request.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })

const isValidPlayerName = (value) => /^[\p{L}\s'-]+$/u.test(value)
const isValidPhone = (value) => !value || /^\d{1,10}$/.test(value)
const isValidScoreValue = (value) => Number.isInteger(value) && value >= 0 && value <= 999
const normalizeScoreSubmission = (value) => ({
  activeRound: [1, 2, 3, 4, 5, 6].includes(Number(value?.activeRound)) ? Number(value.activeRound) : 1,
  entries: Array.isArray(value?.entries) ? value.entries : [],
})

const registerPlayer = async (payload) => {
  const currentState = await readState()
  const name = sanitizePlayerName(payload.name)
  const phone = sanitizePhone(payload.phone)
  const gender = payload.gender === 'female' ? 'female' : 'male'

  if (!name || !isValidPlayerName(name)) {
    throw new Error('Аты-жөнү туура эмес.')
  }

  if (phone && !isValidPhone(phone)) {
    throw new Error('Телефон номери туура эмес.')
  }

  const normalizedName = normalizePlayerName(name)
  const existsByName = currentState.players.some((player) => normalizePlayerName(player.name || '') === normalizedName)
  const existsByPhone = phone && currentState.players.some((player) => sanitizePhone(player.phone) === phone)

  if (existsByName) {
    throw new Error('Мындай аттагы катышуучу мурун катталган.')
  }

  if (existsByPhone) {
    throw new Error('Мындай телефон номери менен катышуучу мурун катталган.')
  }

  const highestNumber = Math.max(0, ...Object.values(currentState.playerNumberBook || {}).map((value) => Number(value) || 0))
  const entryNumber = highestNumber + 1

  const nextState = {
    ...currentState,
    players: [...currentState.players, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, phone, gender, entryNumber }],
    playerNumberBook: {
      ...(currentState.playerNumberBook || {}),
      [normalizedName]: entryNumber,
    },
  }

  await writeState(nextState)
  return nextState
}

const submitPlayerScore = async (payload) => {
  const currentState = await readState()
  const playerId = String(payload.playerId || '').trim()
  const phone = sanitizePhone(payload.phone)
  const score = Number.parseInt(payload.score, 10)
  const scoreSubmission = normalizeScoreSubmission(currentState.scoreSubmission)
  const activeRound = scoreSubmission.activeRound

  if (!playerId) {
    throw new Error('Оюнчу тандалган жок.')
  }

  if (!phone || !isValidPhone(phone)) {
    throw new Error('Телефон номери туура эмес.')
  }

  if (!isValidScoreValue(score)) {
    throw new Error('Упай 0дон 999га чейинки сан болушу керек.')
  }

  const player = currentState.players.find((item) => item.id === playerId)
  if (!player) {
    throw new Error('Оюнчу табылган жок.')
  }

  if (sanitizePhone(player.phone) !== phone) {
    throw new Error('Телефон номери дал келген жок.')
  }

  const nextEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    playerId: player.id,
    playerName: player.name,
    round: activeRound,
    score,
    submittedAt: new Date().toISOString(),
  }

  const nextState = {
    ...currentState,
    scores: {
      ...currentState.scores,
      [player.id]: {
        ...(currentState.scores[player.id] || {}),
        [activeRound]: score,
      },
    },
    scoreSubmission: {
      ...scoreSubmission,
      entries: [nextEntry, ...scoreSubmission.entries].slice(0, 500),
    },
  }

  await writeState(nextState)
  return nextState
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`)

  if (request.method === 'OPTIONS') {
    sendJson(response, 200, { ok: true })
    return
  }

  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, { ok: true })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/state') {
      sendJson(response, 200, await readState())
      return
    }

    if (request.method === 'PUT' && url.pathname === '/api/state') {
      const body = await readBody(request)
      const nextState = {
        ...DEFAULT_STATE,
        ...body,
        bracket: body.bracket ? { ...EMPTY_BRACKET, ...body.bracket } : { ...EMPTY_BRACKET },
        players: Array.isArray(body.players) ? body.players : [],
        scores: body.scores || {},
        playerNumberBook: body.playerNumberBook || {},
        scoreSubmission: normalizeScoreSubmission(body.scoreSubmission),
      }
      await writeState(nextState)
      sendJson(response, 200, nextState)
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/register-player') {
      const body = await readBody(request)
      sendJson(response, 200, await registerPlayer(body))
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/player-score') {
      const body = await readBody(request)
      sendJson(response, 200, await submitPlayerScore(body))
      return
    }

    sendJson(response, 404, { error: 'Not found' })
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Unknown error' })
  }
})

server.listen(PORT, () => {
  console.log(`Tournament backend running on http://localhost:${PORT}`)
})
