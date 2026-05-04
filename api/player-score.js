import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

const EMPTY_BRACKET = {
  roundOf32: [],
  roundOf16: [],
  quarterFinals: [],
  semiFinals: [],
  final12: null,
  final34: null,
  winners: [],
}

const dbToJs = (dbRow) => ({
  tournamentName: dbRow.tournament_name,
  location: dbRow.location,
  category: dbRow.category,
  headReferee: dbRow.head_referee,
  headSecretary: dbRow.head_secretary,
  players: dbRow.players || [],
  scores: dbRow.scores || {},
  bracket: dbRow.bracket || EMPTY_BRACKET,
  playoffStage: dbRow.playoff_stage,
  playoffMode: dbRow.playoff_mode,
  playerNumberBook: dbRow.player_number_book || {},
  scoreSubmission: normalizeScoreSubmission(dbRow.score_submission),
})

const sanitizePhone = (value) => String(value || '').replace(/\D/g, '').slice(0, 10)
const isValidPhone = (value) => !value || /^\d{1,10}$/.test(value)
const isValidScoreValue = (value) => Number.isInteger(value) && value >= 0 && value <= 999
const normalizeScoreSubmission = (value) => ({
  activeRound: [1, 2, 3, 4, 5, 6].includes(Number(value?.activeRound)) ? Number(value.activeRound) : 1,
  entries: Array.isArray(value?.entries) ? value.entries : [],
})

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const playerId = String(req.body?.playerId || '').trim()
    const phone = sanitizePhone(req.body?.phone)
    const score = Number.parseInt(req.body?.score, 10)

    if (!playerId) {
      return res.status(400).json({ error: 'Оюнчу тандалган жок.' })
    }

    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ error: 'Телефон номери туура эмес.' })
    }

    if (!isValidScoreValue(score)) {
      return res.status(400).json({ error: 'Упай 0дөн 999га чейинки сан болушу керек.' })
    }

    const { data: currentData, error: fetchError } = await supabase
      .from('tournament_state')
      .select('*')
      .eq('id', 'main')
      .single()

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message })
    }

    const scoreSubmission = normalizeScoreSubmission(currentData?.score_submission)
    const activeRound = scoreSubmission.activeRound
    const currentState = dbToJs(currentData)
    const player = currentState.players.find((item) => item.id === playerId)

    if (!player) {
      return res.status(400).json({ error: 'Оюнчу табылган жок.' })
    }

    if (sanitizePhone(player.phone) !== phone) {
      return res.status(400).json({ error: 'Телефон номери дал келген жок.' })
    }

    const updatedScores = {
      ...currentState.scores,
      [player.id]: {
        ...(currentState.scores[player.id] || {}),
        [activeRound]: score,
      },
    }

    const nextEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      playerId: player.id,
      playerName: player.name,
      round: activeRound,
      score,
      submittedAt: new Date().toISOString(),
    }

    const updatedScoreSubmission = {
      ...scoreSubmission,
      entries: [nextEntry, ...scoreSubmission.entries].slice(0, 500),
    }

    const { data: updatedData, error: updateError } = await supabase
      .from('tournament_state')
      .update({
        scores: updatedScores,
        score_submission: updatedScoreSubmission,
      })
      .eq('id', 'main')
      .select('*')
      .single()

    if (updateError) {
      return res.status(500).json({ error: updateError.message })
    }

    return res.status(200).json(dbToJs(updatedData))
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
