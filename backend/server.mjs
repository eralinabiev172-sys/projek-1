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
const isValidPhone = (value) => /^\d{1,10}$/.test(value)

const registerPlayer = async (payload) => {
  const currentState = await readState()
  const name = sanitizePlayerName(payload.name)
  const phone = sanitizePhone(payload.phone)
  const gender = payload.gender === 'female' ? 'female' : 'male'

  if (!name || !isValidPlayerName(name)) {
    throw new Error('Аты-жөнү туура эмес.')
  }

  if (!phone || !isValidPhone(phone)) {
    throw new Error('Телефон номери туура эмес.')
  }

  const normalizedName = normalizePlayerName(name)
  const existsByName = currentState.players.some((player) => normalizePlayerName(player.name || '') === normalizedName)
  const existsByPhone = currentState.players.some((player) => sanitizePhone(player.phone) === phone)

  if (existsByName || existsByPhone) {
    throw new Error('Мындай катышуучу мурун катталган.')
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

    sendJson(response, 404, { error: 'Not found' })
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Unknown error' })
  }
})

server.listen(PORT, () => {
  console.log(`Tournament backend running on http://localhost:${PORT}`)
})
