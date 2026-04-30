import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

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

// Преобразование из snake_case (БД) в camelCase (JS)
const dbToJs = (dbRow) => ({
  tournamentName: dbRow.tournament_name,
  location: dbRow.location,
  category: dbRow.category,
  headReferee: dbRow.head_referee,
  headSecretary: dbRow.head_secretary,
  players: dbRow.players || [],
  scores: dbRow.scores || {},
  bracket: dbRow.bracket || DEFAULT_STATE.bracket,
  playoffStage: dbRow.playoff_stage,
  playoffMode: dbRow.playoff_mode,
  playerNumberBook: dbRow.player_number_book || {},
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
  player_number_book: jsState.playerNumberBook,
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
