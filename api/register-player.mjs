import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const DATA_DIR = '/tmp/tournament-data'
const DATA_FILE = join(DATA_DIR, 'tournament-state.json')

const DEFAULT_STATE = {
  tournamentName: 'Жаа атуу боюнча турнир',
  location: 'Чолпон-Ата, 2026-жыл',
  category: 'Классикалык жаа, 50 метр, эркектер',
  headReferee: '',
  headSecretary: '',
  players: [],
  scores: {},
  bracket: {
    roundOf32: [],
    roundOf16: [],
    quarterFinals: [],
    semiFinals: [],
    final12: null,
    final34: null,
    winners: [],
  },
  playoffStage: 'none',
  playoffMode: 16,
  playerNumberBook: {},
}

const normalizePlayerName = (name) => name.trim().toLocaleLowerCase()
const sanitizePhone = (value) => String(value || '').replace(/\\D/g, '').slice(0, 10)
const sanitizePlayerName = (value) => String(value || '').replace(/[^\\p{L}\\s'-]/gu, '').replace(/\\s{2,}/g, ' ').trim()
const isValidPlayerName = (value) => /^[\\p{L}\\s'-]+$/u.test(value)
const isValidPhone = (value) => !value || /^\\d{1,10}$/.test(value)

const ensureStorage = async () => {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    await readFile(DATA_FILE, 'utf8')
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8')
  }
}

const readState = async () => {
  await ensureStorage()
  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    return { ...DEFAULT_STATE }
  }
}

const writeState = async (state) => {
  await ensureStorage()
  await writeFile(DATA_FILE, JSON.stringify(state, null, 2), 'utf8')
  return state
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { name: rawName, phone: rawPhone, gender } = req.body

    const currentState = await readState()
    const name = sanitizePlayerName(rawName)
    const phone = sanitizePhone(rawPhone)
    const playerGender = gender === 'female' ? 'female' : 'male'

    if (!name || !isValidPlayerName(name)) {
      return res.status(400).json({ error: 'Аты-жөнү туура эмес.' })
    }

    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ error: 'Телефон номери туура эмес.' })
    }

    const normalizedName = normalizePlayerName(name)
    const existsByName = currentState.players.some((player) => normalizePlayerName(player.name || '') === normalizedName)
    const existsByPhone = phone && currentState.players.some((player) => sanitizePhone(player.phone) === phone)

    if (existsByName) {
      return res.status(400).json({ error: 'Мындай аттагы катышуучу мурун катталган.' })
    }

    if (existsByPhone) {
      return res.status(400).json({ error: 'Мындай телефон номери менен катышуучу мурун катталган.' })
    }

    const highestNumber = Math.max(0, ...Object.values(currentState.playerNumberBook || {}).map((value) => Number(value) || 0))
    const entryNumber = highestNumber + 1

    const nextState = {
      ...currentState,
      players: [
        ...currentState.players,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, phone, gender: playerGender, entryNumber },
      ],
      playerNumberBook: {
        ...(currentState.playerNumberBook || {}),
        [normalizedName]: entryNumber,
      },
    }

    await writeState(nextState)
    return res.status(200).json(nextState)
  } catch (error) {
    console.error('Error registering player:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
