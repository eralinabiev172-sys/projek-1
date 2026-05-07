import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

const DEFAULT_STATE = {
  tournamentName: 'Жаа атуу боюнча турнир',
  location: 'Чолпон-Ата, 2026-жыл',
  category: 'Классикалык жаа, 50 метр, эркектер',
  playoffDivision: 'all',
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
  playoffFinalRounds: { final12: 1, final34: 1 },
  playerNumberBook: {},
  scoreSubmission: {
    activeRound: 1,
    entries: [],
  },
}

const SCORE_SUBMISSION_META_KEY = '__scoreSubmission'
const PLAYOFF_DIVISION_META_KEY = '__playoffDivision'
const PLAYOFF_FINAL_ROUNDS_META_KEY = '__playoffFinalRounds'

const normalizeScoreSubmission = (value) => ({
  activeRound: [1, 2, 3, 4, 5, 6].includes(Number(value?.activeRound)) ? Number(value.activeRound) : 1,
  entries: Array.isArray(value?.entries) ? value.entries : [],
})
const normalizePlayoffFinalRounds = (value) => ({
  final12: [1, 2, 3, 4, 5, 6].includes(Number(value?.final12)) ? Number(value.final12) : 1,
  final34: [1, 2, 3, 4, 5, 6].includes(Number(value?.final34)) ? Number(value.final34) : 1,
})

const extractPlayerNumberBook = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const nextBook = { ...value }
  delete nextBook[SCORE_SUBMISSION_META_KEY]
  delete nextBook[PLAYOFF_DIVISION_META_KEY]
  delete nextBook[PLAYOFF_FINAL_ROUNDS_META_KEY]
  return nextBook
}

const readStoredScoreSubmission = (dbRow) =>
  normalizeScoreSubmission(dbRow.score_submission || dbRow.player_number_book?.[SCORE_SUBMISSION_META_KEY])

const readStoredPlayoffDivision = (dbRow) => {
  const value = dbRow.player_number_book?.[PLAYOFF_DIVISION_META_KEY]
  return ['all', 'male', 'female'].includes(value) ? value : 'all'
}
const readStoredPlayoffFinalRounds = (dbRow) => normalizePlayoffFinalRounds(dbRow.player_number_book?.[PLAYOFF_FINAL_ROUNDS_META_KEY])

const writeStoredPlayerNumberBook = (playerNumberBook, scoreSubmission, playoffDivision, playoffFinalRounds) => ({
  ...(playerNumberBook || {}),
  [SCORE_SUBMISSION_META_KEY]: normalizeScoreSubmission(scoreSubmission),
  [PLAYOFF_DIVISION_META_KEY]: ['all', 'male', 'female'].includes(playoffDivision) ? playoffDivision : 'all',
  [PLAYOFF_FINAL_ROUNDS_META_KEY]: normalizePlayoffFinalRounds(playoffFinalRounds),
})

// Преобразование из snake_case (БД) в camelCase (JS)
const dbToJs = (dbRow) => ({
  tournamentName: dbRow.tournament_name,
  location: dbRow.location,
  category: dbRow.category,
  playoffDivision: readStoredPlayoffDivision(dbRow),
  playoffFinalRounds: readStoredPlayoffFinalRounds(dbRow),
  headReferee: dbRow.head_referee,
  headSecretary: dbRow.head_secretary,
  players: dbRow.players || [],
  scores: dbRow.scores || {},
  bracket: dbRow.bracket || DEFAULT_STATE.bracket,
  playoffStage: dbRow.playoff_stage,
  playoffMode: dbRow.playoff_mode,
  playerNumberBook: extractPlayerNumberBook(dbRow.player_number_book),
  scoreSubmission: readStoredScoreSubmission(dbRow),
})

// Преобразование из camelCase (JS) в snake_case (БД)
const jsToDb = (jsState) => ({
  tournament_name: jsState.tournamentName,
  location: jsState.location,
  category: jsState.category,
  head_referee: jsState.headReferee,
  head_secretary: jsState.headSecretary,
  players: jsState.players,
  scores: jsState.scores,
  bracket: jsState.bracket,
  playoff_stage: jsState.playoffStage,
  playoff_mode: jsState.playoffMode,
  player_number_book: writeStoredPlayerNumberBook(jsState.playerNumberBook, jsState.scoreSubmission, jsState.playoffDivision, jsState.playoffFinalRounds),
})

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true })
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    if (req.method === 'GET') {
      // Получение состояния из БД
      const { data, error } = await supabase
        .from('tournament_state')
        .select('*')
        .eq('id', 'main')
        .single()

      if (error) {
        // Если записи нет, создаем её
        if (error.code === 'PGRST116') {
          const { data: newData, error: insertError } = await supabase
            .from('tournament_state')
            .insert([{ id: 'main', ...jsToDb(DEFAULT_STATE) }])
            .select()
            .single()

          if (insertError) {
            console.error('Insert error:', insertError)
            return res.status(500).json({ error: insertError.message })
          }

          return res.status(200).json(dbToJs(newData))
        }

        console.error('Select error:', error)
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json(dbToJs(data))
    }

    if (req.method === 'PUT') {
      // Обновление состояния в БД
      const nextState = {
        ...DEFAULT_STATE,
        ...req.body,
        playoffDivision: ['all', 'male', 'female'].includes(req.body?.playoffDivision) ? req.body.playoffDivision : 'all',
        playoffFinalRounds: normalizePlayoffFinalRounds(req.body?.playoffFinalRounds),
        scoreSubmission: normalizeScoreSubmission(req.body?.scoreSubmission),
      }

      const { data, error } = await supabase
        .from('tournament_state')
        .update(jsToDb(nextState))
        .eq('id', 'main')
        .select()
        .single()

      if (error) {
        console.error('Update error:', error)
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json(dbToJs(data))
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Error handling state:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
