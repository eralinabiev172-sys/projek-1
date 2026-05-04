import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

const normalizePlayerName = (name) => name.trim().toLocaleLowerCase()
const sanitizePhone = (value) => String(value || '').replace(/\D/g, '').slice(0, 10)
const sanitizePlayerName = (value) => String(value || '').replace(/[^\p{L}\s'-]/gu, '').replace(/\s{2,}/g, ' ').trim()
const isValidPlayerName = (value) => /^[\p{L}\s'-]+$/u.test(value)
const isValidPhone = (value) => !value || /^\d{1,10}$/.test(value)
const normalizeScoreSubmission = (value) => ({
  activeRound: [1, 2, 3, 4, 5, 6].includes(Number(value?.activeRound)) ? Number(value.activeRound) : 1,
  entries: Array.isArray(value?.entries) ? value.entries : [],
})

// Преобразование из snake_case (БД) в camelCase (JS)
const dbToJs = (dbRow) => ({
  tournamentName: dbRow.tournament_name,
  location: dbRow.location,
  category: dbRow.category,
  headReferee: dbRow.head_referee,
  headSecretary: dbRow.head_secretary,
  players: dbRow.players || [],
  scores: dbRow.scores || {},
  bracket: dbRow.bracket || {
    roundOf32: [],
    roundOf16: [],
    quarterFinals: [],
    semiFinals: [],
    final12: null,
    final34: null,
    winners: [],
  },
  playoffStage: dbRow.playoff_stage,
  playoffMode: dbRow.playoff_mode,
  playerNumberBook: dbRow.player_number_book || {},
  scoreSubmission: normalizeScoreSubmission(dbRow.score_submission),
})

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

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { name: rawName, phone: rawPhone, gender } = req.body

    // Валидация
    const name = sanitizePlayerName(rawName)
    const phone = sanitizePhone(rawPhone)
    const playerGender = gender === 'female' ? 'female' : 'male'

    if (!name || !isValidPlayerName(name)) {
      return res.status(400).json({ error: 'Аты-жөнү туура эмес.' })
    }

    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ error: 'Телефон номери туура эмес.' })
    }

    // Получение текущего состояния
    const { data: currentData, error: fetchError } = await supabase
      .from('tournament_state')
      .select('*')
      .eq('id', 'main')
      .single()

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return res.status(500).json({ error: fetchError.message })
    }

    const currentState = dbToJs(currentData)

    // Проверка на дубликаты
    const normalizedName = normalizePlayerName(name)
    const existsByName = currentState.players.some(
      (player) => normalizePlayerName(player.name || '') === normalizedName
    )
    const existsByPhone = phone && currentState.players.some(
      (player) => sanitizePhone(player.phone) === phone
    )

    if (existsByName) {
      return res.status(400).json({ error: 'Мындай аттагы катышуучу мурун катталган.' })
    }

    if (existsByPhone) {
      return res.status(400).json({ error: 'Мындай телефон номери менен катышуучу мурун катталган.' })
    }

    // Создание нового игрока
    const highestNumber = Math.max(
      0,
      ...Object.values(currentState.playerNumberBook || {}).map((value) => Number(value) || 0)
    )
    const entryNumber = highestNumber + 1

    const newPlayer = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      phone,
      gender: playerGender,
      entryNumber,
    }

    // Обновление состояния
    const updatedPlayers = [...currentState.players, newPlayer]
    const updatedPlayerNumberBook = {
      ...(currentState.playerNumberBook || {}),
      [normalizedName]: entryNumber,
    }

    const { data: updatedData, error: updateError } = await supabase
      .from('tournament_state')
      .update({
        players: updatedPlayers,
        player_number_book: updatedPlayerNumberBook,
      })
      .eq('id', 'main')
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return res.status(500).json({ error: updateError.message })
    }

    return res.status(200).json(dbToJs(updatedData))
  } catch (error) {
    console.error('Error registering player:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
