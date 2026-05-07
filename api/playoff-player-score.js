import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY
const SCORE_SUBMISSION_META_KEY = '__scoreSubmission'
const PLAYOFF_DIVISION_META_KEY = '__playoffDivision'
const PLAYOFF_FINAL_ROUNDS_META_KEY = '__playoffFinalRounds'
const MAX_PLAYER_SCORE = 30

const EMPTY_BRACKET = {
  roundOf32: [],
  roundOf16: [],
  quarterFinals: [],
  semiFinals: [],
  final12: null,
  final34: null,
  winners: [],
}

const PLAYOFF_SUBMISSION_STAGES = ['roundOf32', 'roundOf16', 'quarterFinals', 'semiFinals', 'final']

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
  bracket: dbRow.bracket || EMPTY_BRACKET,
  playoffStage: dbRow.playoff_stage,
  playoffMode: dbRow.playoff_mode,
  playerNumberBook: extractPlayerNumberBook(dbRow.player_number_book),
  scoreSubmission: readStoredScoreSubmission(dbRow),
})

const sanitizePhone = (value) => String(value || '').replace(/\D/g, '').slice(0, 10)
const isValidPhone = (value) => !value || /^\d{1,10}$/.test(value)
const isValidScoreValue = (value) => Number.isInteger(value) && value >= 0 && value <= MAX_PLAYER_SCORE
const isScoreInputDigitsOnly = (value) => /^\d{1,3}$/.test(String(value || '').trim())

const findActivePlayoffMatch = (bracket, playoffStage, playerId) => {
  if (playoffStage === 'final') {
    const finals = [bracket.final12, bracket.final34].filter(Boolean)
    return finals.find((match) => match?.p1?.id === playerId || match?.p2?.id === playerId) || null
  }

  if (!PLAYOFF_SUBMISSION_STAGES.includes(playoffStage)) {
    return null
  }

  const stageMatches = Array.isArray(bracket?.[playoffStage]) ? bracket[playoffStage] : []
  return stageMatches.find((match) => match?.p1?.id === playerId || match?.p2?.id === playerId) || null
}

const resolvePlayoffWinner = (match) => {
  if (!match) return null
  if (Number(match.s1) > Number(match.s2)) return match.p1
  if (Number(match.s2) > Number(match.s1)) return match.p2
  if (!match.isFinal) {
    if (Number(match.shootOffS1) > Number(match.shootOffS2)) return match.p1
    if (Number(match.shootOffS2) > Number(match.shootOffS1)) return match.p2
    return null
  }
  if (Number(match.s1_bot) > Number(match.s2_bot)) return match.p1
  if (Number(match.s2_bot) > Number(match.s1_bot)) return match.p2
  return null
}
const shouldUseShootOffForStandardMatch = (match) =>
  Boolean(
    match &&
      !match.isFinal &&
      Number(match.s1) === Number(match.s2) &&
      ((match.submittedP1 && match.submittedP2) || Number(match.s1) !== 0 || Number(match.s2) !== 0),
  )

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
    const rawScore = String(req.body?.score || '').trim()
    const score = Number.parseInt(rawScore, 10)

    if (!playerId) {
      return res.status(400).json({ error: 'РћСЋРЅС‡Сѓ С‚Р°РЅРґР°Р»РіР°РЅ Р¶РѕРє.' })
    }

    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ error: 'РўРµР»РµС„РѕРЅ РЅРѕРјРµСЂРё С‚СѓСѓСЂР° СЌРјРµСЃ.' })
    }

    if (!isScoreInputDigitsOnly(rawScore) || !isValidScoreValue(score)) {
      return res.status(400).json({ error: `РЈРїР°Р№ 0РґУ©РЅ ${MAX_PLAYER_SCORE}РіР° С‡РµР№РёРЅРєРё СЃР°РЅ Р±РѕР»СѓС€Сѓ РєРµСЂРµРє.` })
    }

    const { data: currentData, error: fetchError } = await supabase
      .from('tournament_state')
      .select('*')
      .eq('id', 'main')
      .single()

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message })
    }

    const currentState = dbToJs(currentData)
    const player = currentState.players.find((item) => item.id === playerId)

    if (!player) {
      return res.status(400).json({ error: 'РћСЋРЅС‡Сѓ С‚Р°Р±С‹Р»РіР°РЅ Р¶РѕРє.' })
    }

    if (sanitizePhone(player.phone) !== phone) {
      return res.status(400).json({ error: 'РўРµР»РµС„РѕРЅ РЅРѕРјРµСЂРё РґР°Р» РєРµР»РіРµРЅ Р¶РѕРє.' })
    }

    const activeMatch = findActivePlayoffMatch(currentState.bracket, currentState.playoffStage, playerId)
    if (!activeMatch) {
      return res.status(400).json({ error: 'Сиз үчүн ачык плей-офф беттеш табылган жок.' })
    }

    const isPlayerOne = activeMatch?.p1?.id === playerId
    const updatedMatch = {
      ...activeMatch,
      roundsP1: Array.isArray(activeMatch.roundsP1) ? [...activeMatch.roundsP1] : Array(12).fill(0),
      roundsP2: Array.isArray(activeMatch.roundsP2) ? [...activeMatch.roundsP2] : Array(12).fill(0),
      submittedRoundsP1: Array.isArray(activeMatch.submittedRoundsP1) ? [...activeMatch.submittedRoundsP1] : Array(6).fill(false),
      submittedRoundsP2: Array.isArray(activeMatch.submittedRoundsP2) ? [...activeMatch.submittedRoundsP2] : Array(6).fill(false),
      shootOffS1: Number(activeMatch.shootOffS1 || 0),
      shootOffS2: Number(activeMatch.shootOffS2 || 0),
      submittedShootOffP1: Boolean(activeMatch.submittedShootOffP1),
      submittedShootOffP2: Boolean(activeMatch.submittedShootOffP2),
    }

    if (currentState.playoffStage === 'final') {
      const finalStageKey = activeMatch.id === 'final34' ? 'final34' : 'final12'
      const activeRound = currentState.playoffFinalRounds?.[finalStageKey] || 1
      const submittedRoundsKey = isPlayerOne ? 'submittedRoundsP1' : 'submittedRoundsP2'
      const roundsKey = isPlayerOne ? 'roundsP1' : 'roundsP2'

      if (updatedMatch[submittedRoundsKey][activeRound - 1]) {
        return res.status(409).json({ error: 'Бул финал айлампасы үчүн упай мурунтан эле жөнөтүлгөн.' })
      }

      updatedMatch[roundsKey][activeRound - 1] = score
      updatedMatch[submittedRoundsKey][activeRound - 1] = true

      updatedMatch.s1 = updatedMatch.roundsP1.slice(0, 6).reduce((sum, item) => sum + Number(item || 0), 0)
      updatedMatch.s2 = updatedMatch.roundsP2.slice(0, 6).reduce((sum, item) => sum + Number(item || 0), 0)

      for (let index = 0; index < 6; index += 1) {
        const left = Number(updatedMatch.roundsP1[index] || 0)
        const right = Number(updatedMatch.roundsP2[index] || 0)
        const bonusIndex = index + 6

        if (!updatedMatch.submittedRoundsP1[index] && !updatedMatch.submittedRoundsP2[index]) {
          updatedMatch.roundsP1[bonusIndex] = 0
          updatedMatch.roundsP2[bonusIndex] = 0
        } else if (left > right) {
          updatedMatch.roundsP1[bonusIndex] = 2
          updatedMatch.roundsP2[bonusIndex] = 0
        } else if (right > left) {
          updatedMatch.roundsP1[bonusIndex] = 0
          updatedMatch.roundsP2[bonusIndex] = 2
        } else {
          updatedMatch.roundsP1[bonusIndex] = 1
          updatedMatch.roundsP2[bonusIndex] = 1
        }
      }

      updatedMatch.s1_bot = updatedMatch.roundsP1.slice(6).reduce((sum, item) => sum + Number(item || 0), 0)
      updatedMatch.s2_bot = updatedMatch.roundsP2.slice(6).reduce((sum, item) => sum + Number(item || 0), 0)
    } else {
      const useShootOff = shouldUseShootOffForStandardMatch(updatedMatch)
      const submissionKey = useShootOff
        ? isPlayerOne ? 'submittedShootOffP1' : 'submittedShootOffP2'
        : isPlayerOne ? 'submittedP1' : 'submittedP2'
      if (updatedMatch[submissionKey]) {
        return res.status(409).json({ error: 'Бул плей-офф беттеш үчүн упай мурунтан эле жөнөтүлгөн.' })
      }

      if (useShootOff) {
        updatedMatch[isPlayerOne ? 'shootOffS1' : 'shootOffS2'] = score
      } else {
        updatedMatch[isPlayerOne ? 's1' : 's2'] = score
      }
      updatedMatch[submissionKey] = true
    }

    updatedMatch.winner = resolvePlayoffWinner(updatedMatch)

    const updatedBracket = { ...currentState.bracket }
    if (currentState.playoffStage === 'final') {
      if (updatedBracket.final12?.id === updatedMatch.id) {
        updatedBracket.final12 = updatedMatch
      } else if (updatedBracket.final34?.id === updatedMatch.id) {
        updatedBracket.final34 = updatedMatch
      }
    } else {
      updatedBracket[currentState.playoffStage] = (updatedBracket[currentState.playoffStage] || []).map((match) =>
        match.id === updatedMatch.id ? updatedMatch : match,
      )
    }

    const { data: updatedData, error: updateError } = await supabase
      .from('tournament_state')
      .update({
        bracket: updatedBracket,
        player_number_book: writeStoredPlayerNumberBook(
          currentState.playerNumberBook,
          currentState.scoreSubmission,
          currentState.playoffDivision,
          currentState.playoffFinalRounds,
        ),
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
