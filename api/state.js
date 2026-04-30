import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const DATA_DIR = join(tmpdir(), 'tournament-data')
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

  try {
    if (req.method === 'GET') {
      const state = await readState()
      return res.status(200).json(state)
    }

    if (req.method === 'PUT') {
      const nextState = {
        ...DEFAULT_STATE,
        ...req.body,
      }
      await writeState(nextState)
      return res.status(200).json(nextState)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Error handling state:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
