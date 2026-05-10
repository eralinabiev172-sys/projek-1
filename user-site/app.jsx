import './app.css'

import { useEffect, useMemo, useState } from 'react'
import { fetchTournamentState, registerTournamentPlayer, submitPlayerScore, submitPlayoffPlayerScore } from '../shared/tournamentApi.js'

const EMPTY_BRACKET = {
  roundOf32: [],
  roundOf16: [],
  quarterFinals: [],
  semiFinals: [],
  final12: null,
  final34: null,
  winners: [],
}

const FINAL_PRIMARY_ROUNDS = 6
const FINAL_ROUNDS_COUNT = 12
const TARGET_GROUP_SIZE = 4
const QUALIFICATION_ROUNDS = [1, 2, 3, 4, 5, 6]
const PLAYER_IDENTITY_KEY = 'archery_user_registered_player_v1'
const DEFAULT_SCORE_SUBMISSION = {
  activeRound: 1,
  entries: [],
}
const DEFAULT_PASSWORD_PROTECTION_ENABLED = false
const DEFAULT_PLAYOFF_FINAL_ROUNDS = {
  final12: 1,
  final34: 1,
}
const createEmptyCompetitionState = () => ({
  playoffMode: 16,
  playoffStage: 'none',
  playoffFinalRounds: { ...DEFAULT_PLAYOFF_FINAL_ROUNDS },
  bracket: { ...EMPTY_BRACKET },
})

const DEFAULT_STATE = {
  tournamentName: 'Жаа атуу боюнча мелдеш',
  location: 'Чолпон-Ата, 2026-жыл',
  category: 'Салттуу жаа, 50 метр, эркектер',
  players: [],
  scores: {},
  competitionDivisions: {
    all: createEmptyCompetitionState(),
    male: createEmptyCompetitionState(),
    female: createEmptyCompetitionState(),
  },
  playerNumberBook: {},
  scoreSubmission: DEFAULT_SCORE_SUBMISSION,
  passwordProtectionEnabled: DEFAULT_PASSWORD_PROTECTION_ENABLED,
}

const sections = [
  { id: 'register', label: 'Катталуу' },
  { id: 'login', label: 'Кирүү' },
  { id: 'rating', label: 'Даража' },
  { id: 'scoreEntry', label: 'Очко жазуу' },
  { id: 'playoff', label: 'Жеке элек' },
]


const seedOrders = {
  32: [0, 31, 15, 16, 7, 24, 8, 23, 4, 27, 11, 20, 3, 28, 12, 19, 2, 29, 13, 18, 5, 26, 10, 21, 6, 25, 9, 22, 1, 30, 14, 17],
  16: [0, 15, 7, 8, 4, 11, 3, 12, 2, 13, 5, 10, 6, 9, 1, 14],
  8: [0, 7, 3, 4, 1, 6, 2, 5],
  4: [0, 3, 1, 2],
}

const initialRegistrationForm = {
  fullName: '',
  phone: '',
  gender: 'male',
}

const initialLoginForm = {
  fullName: '',
}

const initialScoreForm = {
  playerId: '',
  score: '',
}

const initialPlayoffScoreForm = {
  score: '',
}

const stageTitles = {
  roundOf32: '1/16 финал',
  roundOf16: '1/8 финал',
  quarterFinals: 'Чейрек финал',
  semiFinals: 'Жарым финал',
  final12: 'Финал',
  final34: '3-орун үчүн беттеш',
}

const playoffStageKeysByMode = {
  32: ['roundOf32', 'roundOf16', 'quarterFinals', 'semiFinals'],
  16: ['roundOf16', 'quarterFinals', 'semiFinals'],
  8: ['quarterFinals', 'semiFinals'],
  4: ['semiFinals'],
}

const MAX_PLAYER_SCORE = 30
const normalizePlayerName = (name) => name.trim().toLocaleLowerCase()
const sanitizePlayerName = (value) => value.replace(/[^\p{L}\s'-]/gu, '').replace(/\s{2,}/g, ' ')
const sanitizePhone = (value) => value.replace(/\D/g, '').slice(0, 10)
const sanitizePassword = (value) => value.replace(/\D/g, '').slice(0, 4)
const LETTER_SEQUENCE = ['A', 'B', 'C', 'D']
const getLaneLetter = (entryNumber) => LETTER_SEQUENCE[(Math.max(Number(entryNumber) || 1, 1) - 1) % LETTER_SEQUENCE.length]
const getTargetNumber = (entryNumber) => Math.floor((Math.max(Number(entryNumber) || 1, 1) - 1) / TARGET_GROUP_SIZE) + 1
const getPlayerRoundScore = (scores, playerId, round) => scores?.[playerId]?.[round] ?? ''
const getGenderLabel = (gender) => (gender === 'female' ? 'Аял' : 'Эркек')
const normalizePasswordProtectionEnabled = (value) => (typeof value === 'boolean' ? value : DEFAULT_PASSWORD_PROTECTION_ENABLED)
const sanitizeNonNegativeNumber = (value) => {
  const digitsOnly = value.replace(/[^\d]/g, '').slice(0, 2)
  if (digitsOnly === '') {
    return ''
  }

  return String(Math.min(Number(digitsOnly), MAX_PLAYER_SCORE))
}
const isValidPlayerName = (value) => /^[\p{L}\s'-]+$/u.test(value.trim())
const isValidPhone = (value) => /^\d+$/.test(value.trim())
const isValidPassword = (value) => /^\d{4}$/.test(value.trim())
const normalizePlayoffFinalRounds = (value) => ({
  final12: [1, 2, 3, 4, 5, 6].includes(Number(value?.final12)) ? Number(value.final12) : 1,
  final34: [1, 2, 3, 4, 5, 6].includes(Number(value?.final34)) ? Number(value.final34) : 1,
})
const findPlayerByName = (players, name) =>
  players.find((player) => normalizePlayerName(player.name || '') === normalizePlayerName(name))
const findPlayerByCredentials = (players, fullName) =>
  players.find((player) => normalizePlayerName(player.name || '') === normalizePlayerName(fullName))
const findPlayerForRegistration = (players, { fullName, phone, password }) =>
  players.find(
    (player) =>
      normalizePlayerName(player.name || '') === normalizePlayerName(fullName) ||
      sanitizePhone(player.phone || '') === sanitizePhone(phone),
  )

const createEmptyState = () => ({
  ...DEFAULT_STATE,
  competitionDivisions: {
    all: createEmptyCompetitionState(),
    male: createEmptyCompetitionState(),
    female: createEmptyCompetitionState(),
  },
})

const loadRegisteredPlayer = () => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(PLAYER_IDENTITY_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    return parsed?.playerId && parsed?.name ? parsed : null
  } catch {
    return null
  }
}

const saveRegisteredPlayer = (player) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PLAYER_IDENTITY_KEY, JSON.stringify(player))
}

const clearRegisteredPlayer = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(PLAYER_IDENTITY_KEY)
}

const buildPlayerNumberBook = (players, savedBook = {}) => {
  const nextBook = { ...savedBook }

  players.forEach((player, index) => {
    const normalizedName = normalizePlayerName(player.name || '')
    const entryNumber = player.entryNumber ?? index + 1

    if (normalizedName && !nextBook[normalizedName]) {
      nextBook[normalizedName] = entryNumber
    }
  })

  return nextBook
}

const sortPlayersByEntryNumber = (players) =>
  [...players].sort((left, right) => {
    const leftNumber = left.entryNumber ?? Number.MAX_SAFE_INTEGER
    const rightNumber = right.entryNumber ?? Number.MAX_SAFE_INTEGER

    if (leftNumber !== rightNumber) {
      return leftNumber - rightNumber
    }

    return (left.name || '').localeCompare(right.name || '')
  })

const buildGenderTargetMap = (players) => {
  const targetMap = {}
  const sortedPlayers = sortPlayersByEntryNumber(players)

  ;['male', 'female'].forEach((gender) => {
    sortedPlayers
      .filter((player) => player.gender === gender)
      .forEach((player, index) => {
        targetMap[player.id] = {
          laneLetter: LETTER_SEQUENCE[index % TARGET_GROUP_SIZE],
          targetNumber: Math.floor(index / TARGET_GROUP_SIZE) + 1,
        }
      })
  })

  return targetMap
}

const parseTournamentState = (payload) => {
  if (!payload) {
    return createEmptyState()
  }

  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload
  const players = Array.isArray(parsed.players) ? parsed.players : []
  const normalizedPlayers = players.map((player, index) => ({
    ...player,
    entryNumber: player.entryNumber ?? index + 1,
    laneLetter: player.laneLetter || getLaneLetter(player.entryNumber ?? index + 1),
  }))
  const playerNumberBook = buildPlayerNumberBook(normalizedPlayers, parsed.playerNumberBook || {})

  const normalizeCompetitionState = (value) => ({
    playoffMode: [32, 16, 8, 4].includes(Number(value?.playoffMode)) ? Number(value.playoffMode) : 16,
    playoffStage: ['none', 'roundOf32', 'roundOf16', 'quarterFinals', 'semiFinals', 'final'].includes(value?.playoffStage)
      ? value.playoffStage
      : 'none',
    playoffFinalRounds: normalizePlayoffFinalRounds(value?.playoffFinalRounds),
    bracket: value?.bracket ? { ...EMPTY_BRACKET, ...value.bracket } : { ...EMPTY_BRACKET },
  })
  const normalizeCompetitionDivisions = (value, legacy = {}) => {
    const defaults = {
      all: createEmptyCompetitionState(),
      male: createEmptyCompetitionState(),
      female: createEmptyCompetitionState(),
    }

    if (value && typeof value === 'object') {
      return {
        all: normalizeCompetitionState(value.all),
        male: normalizeCompetitionState(value.male),
        female: normalizeCompetitionState(value.female),
      }
    }

    const legacyDivision =
      legacy.playoffDivision === 'female'
        ? 'female'
        : legacy.playoffDivision === 'male'
          ? 'male'
          : 'all'
    defaults[legacyDivision] = normalizeCompetitionState({
      playoffMode: legacy.playoffMode,
      playoffStage: legacy.playoffStage,
      playoffFinalRounds: legacy.playoffFinalRounds,
      bracket: legacy.bracket,
    })
    return defaults
  }

  return {
    ...DEFAULT_STATE,
    ...parsed,
    passwordProtectionEnabled: normalizePasswordProtectionEnabled(parsed.passwordProtectionEnabled),
    players: sortPlayersByEntryNumber(normalizedPlayers),
    playerNumberBook,
    competitionDivisions: normalizeCompetitionDivisions(parsed.competitionDivisions, parsed),
    scoreSubmission: {
      ...DEFAULT_SCORE_SUBMISSION,
      ...(parsed.scoreSubmission || {}),
      entries: Array.isArray(parsed.scoreSubmission?.entries) ? parsed.scoreSubmission.entries : [],
    },
  }
}

const calculateTotal = (scores, playerId) => {
  const playerScores = scores[playerId] || {}
  return Object.values(playerScores).reduce((sum, value) => sum + Number(value || 0), 0)
}

const getAllMatches = (bracket) => [
  ...(bracket.roundOf32 || []).map((match) => ({ ...match, stage: 'roundOf32' })),
  ...(bracket.roundOf16 || []).map((match) => ({ ...match, stage: 'roundOf16' })),
  ...(bracket.quarterFinals || []).map((match) => ({ ...match, stage: 'quarterFinals' })),
  ...(bracket.semiFinals || []).map((match) => ({ ...match, stage: 'semiFinals' })),
  ...(bracket.final12 ? [{ ...bracket.final12, stage: 'final12' }] : []),
  ...(bracket.final34 ? [{ ...bracket.final34, stage: 'final34' }] : []),
]

const getVisibleStageKeys = (playoffMode) => playoffStageKeysByMode[playoffMode] || playoffStageKeysByMode[8]
const getRoundIndex = (playoffMode, stageKey) => getVisibleStageKeys(playoffMode).indexOf(stageKey)

const getStageMatchCount = (playoffMode, stageKey) => {
  const roundIndex = getRoundIndex(playoffMode, stageKey)
  if (roundIndex < 0) return 0
  return playoffMode / 2 ** (roundIndex + 1)
}

const getSeedNumbersForMatch = (playoffMode, stageKey, matchIndex) => {
  const initialStageKey = getVisibleStageKeys(playoffMode)[0]
  if (stageKey !== initialStageKey) return null
  const order = seedOrders[playoffMode]
  if (!order) return null
  return [order[matchIndex * 2] + 1, order[matchIndex * 2 + 1] + 1]
}

const getPlayerPlayoffMatch = (bracket, playoffStage, playerId) => {
  if (!playerId || playoffStage === 'none') {
    return null
  }

  if (playoffStage === 'final') {
    const finals = [bracket.final12, bracket.final34].filter(Boolean)
    return finals.find((match) => match?.p1?.id === playerId || match?.p2?.id === playerId) || null
  }

  const stageMatches = Array.isArray(bracket?.[playoffStage]) ? bracket[playoffStage] : []
  return stageMatches.find((match) => match?.p1?.id === playerId || match?.p2?.id === playerId) || null
}

const getCurrentPlayerFinalRound = (match, isPlayerOne, openedRound) => {
  const safeOpenedRound = Math.max(1, Math.min(Number(openedRound) || 1, FINAL_PRIMARY_ROUNDS))
  const submittedRounds = isPlayerOne ? match?.submittedRoundsP1 : match?.submittedRoundsP2

  for (let round = 1; round <= safeOpenedRound; round += 1) {
    if (!submittedRounds?.[round - 1]) {
      return round
    }
  }

  return safeOpenedRound
}

const isStandardPlayoffReplayRequired = (match) =>
  Boolean(match && !match.isFinal && !match.winner && Number(match.s1) === Number(match.s2) && !match.submittedShootOffP1 && !match.submittedShootOffP2)
const isStandardPlayoffShootOffActive = (match) =>
  Boolean(
    match &&
      !match.isFinal &&
      Number(match.s1) === Number(match.s2) &&
      ((match.submittedP1 && match.submittedP2) || Number(match.s1) !== 0 || Number(match.s2) !== 0 || match.submittedShootOffP1 || match.submittedShootOffP2),
  )

const TargetIcon = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1.5" />
  </svg>
)

function App() {
  const [activeSection, setActiveSection] = useState(null)
  const [registrationMessage, setRegistrationMessage] = useState('')
  const [loginMessage, setLoginMessage] = useState('')
  const [scoreMessage, setScoreMessage] = useState('')
  const [playoffScoreMessage, setPlayoffScoreMessage] = useState('')
  const [tournamentState, setTournamentState] = useState(createEmptyState)
  const [hasLoadedTournamentState, setHasLoadedTournamentState] = useState(false)
  const [hasSuccessfulTournamentSync, setHasSuccessfulTournamentSync] = useState(false)
  const [registeredPlayer, setRegisteredPlayer] = useState(loadRegisteredPlayer)
  const [registrationForm, setRegistrationForm] = useState(initialRegistrationForm)
  const [loginForm, setLoginForm] = useState(initialLoginForm)
  const [scoreForm, setScoreForm] = useState(initialScoreForm)
  const [playoffScoreForm, setPlayoffScoreForm] = useState(initialPlayoffScoreForm)

  useEffect(() => {
    let isMounted = true

    const syncFromServer = async () => {
      try {
        const nextState = parseTournamentState(await fetchTournamentState())
        if (isMounted) {
          setTournamentState(nextState)
          setHasLoadedTournamentState(true)
          setHasSuccessfulTournamentSync(true)
        }
      } catch {
        if (isMounted) {
          setHasLoadedTournamentState(true)
        }
      }
    }

    syncFromServer()
    const intervalId = window.setInterval(syncFromServer, 3000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  const ratingPlayers = useMemo(() => {
    const players = [...tournamentState.players]
    return players
      .map((player) => ({
        ...player,
        total: calculateTotal(tournamentState.scores, player.id),
      }))
      .sort((left, right) => right.total - left.total)
  }, [tournamentState.players, tournamentState.scores])
  const maleRatingPlayers = useMemo(() => ratingPlayers.filter((player) => player.gender === 'male'), [ratingPlayers])
  const femaleRatingPlayers = useMemo(() => ratingPlayers.filter((player) => player.gender === 'female'), [ratingPlayers])
  const malePlayoffMode = tournamentState.competitionDivisions?.male?.playoffMode || 16
  const femalePlayoffMode = tournamentState.competitionDivisions?.female?.playoffMode || 16
  const selectedPlayer = useMemo(
    () => tournamentState.players.find((player) => player.id === registeredPlayer?.playerId) || null,
    [registeredPlayer, tournamentState.players],
  )
  const genderTargetMap = useMemo(() => buildGenderTargetMap(tournamentState.players), [tournamentState.players])
  const selectedTargetMeta = selectedPlayer ? genderTargetMap[selectedPlayer.id] || null : null
  const selectedTargetNumber = selectedTargetMeta?.targetNumber || null
  const selectedTargetGroup = useMemo(() => {
    if (!selectedPlayer) {
      return []
    }

    const currentTargetMeta = genderTargetMap[selectedPlayer.id]
    if (!currentTargetMeta) {
      return []
    }

    return sortPlayersByEntryNumber(
      tournamentState.players.filter((player) => {
        const playerTargetMeta = genderTargetMap[player.id]
        return player.gender === selectedPlayer.gender && playerTargetMeta?.targetNumber === currentTargetMeta.targetNumber
      }),
    ).slice(0, TARGET_GROUP_SIZE)
  }, [genderTargetMap, selectedPlayer, tournamentState.players])
  const playerCompetitionDivision =
    tournamentState.competitionDivisions?.all?.playoffStage !== 'none'
      ? 'all'
      : selectedPlayer?.gender === 'female'
        ? 'female'
        : 'male'
  const activeCompetitionState = tournamentState.competitionDivisions?.[playerCompetitionDivision] || createEmptyCompetitionState()
  const passwordProtectionEnabled = false

  const playoffMatches = useMemo(() => getAllMatches(activeCompetitionState.bracket), [activeCompetitionState.bracket])
  const activeScoreRound = tournamentState.scoreSubmission?.activeRound || 1
  const playoffStages = useMemo(() => {
    const stageKeys = playoffStageKeysByMode[activeCompetitionState.playoffMode] || playoffStageKeysByMode[8]
    return stageKeys.map((stageKey) => ({
      stageKey,
      title: stageTitles[stageKey] || stageKey,
      matches: activeCompetitionState.bracket[stageKey] || [],
    }))
  }, [activeCompetitionState.bracket, activeCompetitionState.playoffMode])
  const hasFinalMatches = Boolean(activeCompetitionState.bracket.final12 || activeCompetitionState.bracket.final34)
  const playerPlayoffMatch = useMemo(
    () => getPlayerPlayoffMatch(activeCompetitionState.bracket, activeCompetitionState.playoffStage, registeredPlayer?.playerId),
    [registeredPlayer, activeCompetitionState.bracket, activeCompetitionState.playoffStage],
  )
  const isPlayerOneInPlayoffMatch = playerPlayoffMatch?.p1?.id === registeredPlayer?.playerId
  const playerPlayoffStageKey =
    activeCompetitionState.playoffStage === 'final'
      ? playerPlayoffMatch?.id === 'final34'
        ? 'final34'
        : playerPlayoffMatch?.id === 'final12'
          ? 'final12'
          : null
      : activeCompetitionState.playoffStage
  const openedPlayoffRound =
    activeCompetitionState.playoffStage === 'final' && playerPlayoffStageKey
      ? activeCompetitionState.playoffFinalRounds?.[playerPlayoffStageKey] || 1
      : 1
  const currentPlayoffRound =
    activeCompetitionState.playoffStage === 'final' && playerPlayoffMatch
      ? getCurrentPlayerFinalRound(playerPlayoffMatch, isPlayerOneInPlayoffMatch, openedPlayoffRound)
      : openedPlayoffRound
  const playoffOpponent = playerPlayoffMatch ? (isPlayerOneInPlayoffMatch ? playerPlayoffMatch.p2 : playerPlayoffMatch.p1) : null
  const isPlayoffShootOffActive = isStandardPlayoffShootOffActive(playerPlayoffMatch)
  const currentPlayoffScore = playerPlayoffMatch
    ? activeCompetitionState.playoffStage === 'final'
      ? (isPlayerOneInPlayoffMatch
          ? playerPlayoffMatch.roundsP1?.[currentPlayoffRound - 1]
          : playerPlayoffMatch.roundsP2?.[currentPlayoffRound - 1]) ?? ''
      : isPlayoffShootOffActive
        ? isPlayerOneInPlayoffMatch
          ? playerPlayoffMatch.shootOffS1 ?? ''
          : playerPlayoffMatch.shootOffS2 ?? ''
      : isPlayerOneInPlayoffMatch
        ? playerPlayoffMatch.s1
        : playerPlayoffMatch.s2
    : ''
  const hasSubmittedPlayoffScore = Boolean(
    playerPlayoffMatch &&
      (activeCompetitionState.playoffStage === 'final'
        ? isPlayerOneInPlayoffMatch
          ? playerPlayoffMatch.submittedRoundsP1?.[currentPlayoffRound - 1]
          : playerPlayoffMatch.submittedRoundsP2?.[currentPlayoffRound - 1]
        : isPlayoffShootOffActive
          ? isPlayerOneInPlayoffMatch
            ? playerPlayoffMatch.submittedShootOffP1
            : playerPlayoffMatch.submittedShootOffP2
        : isPlayerOneInPlayoffMatch
          ? playerPlayoffMatch.submittedP1
          : playerPlayoffMatch.submittedP2),
  )
  const currentRoundScore = selectedPlayer ? tournamentState.scores[selectedPlayer.id]?.[activeScoreRound] ?? '' : ''
  const hasSubmittedCurrentRound = currentRoundScore !== '' && currentRoundScore !== null && currentRoundScore !== undefined
  const isJournalLocked = activeCompetitionState.playoffStage !== 'none'
  const isRegistered = Boolean(selectedPlayer)
  const playerDivisionLabel = selectedPlayer?.gender === 'female' ? 'Аял' : 'Эркек'
  const playerJournalStatusLabel = isJournalLocked ? 'Жабык' : `Ачык A${activeScoreRound}`
  const playerPlayoffStatusLabel = playerPlayoffMatch
    ? activeCompetitionState.playoffStage === 'final'
      ? `Финал A${currentPlayoffRound}`
      : stageTitles[activeCompetitionState.playoffStage] || 'Жеке элек'
    : 'Жеке элек ачыла элек'
  const visibleSections = isRegistered
    ? sections.filter((section) => section.id !== 'register' && section.id !== 'login')
    : sections.filter((section) => section.id === 'register' || section.id === 'login')

  useEffect(() => {
    if (!selectedPlayer) {
      return
    }

    setScoreForm((current) => ({
      ...current,
      playerId: selectedPlayer.id,
    }))
  }, [selectedPlayer])

  useEffect(() => {
    if (!registeredPlayer) {
      return
    }

    if (hasLoadedTournamentState && hasSuccessfulTournamentSync && !selectedPlayer) {
      setRegisteredPlayer(null)
      clearRegisteredPlayer()
      setRegistrationForm(initialRegistrationForm)
      setLoginForm(initialLoginForm)
      setScoreForm(initialScoreForm)
      setPlayoffScoreForm(initialPlayoffScoreForm)
      setRegistrationMessage('')
      setLoginMessage('')
      setScoreMessage('')
      setPlayoffScoreMessage('')
    }
  }, [hasLoadedTournamentState, hasSuccessfulTournamentSync, registeredPlayer, selectedPlayer])

  useEffect(() => {
    if (isRegistered) {
      if (activeSection === 'register' || activeSection === 'login') {
        setActiveSection('scoreEntry')
      }
      return
    }

    if (activeSection && activeSection !== 'register' && activeSection !== 'login') {
      setActiveSection(null)
    }
  }, [activeSection, isRegistered])

  const handleRegistrationChange = ({ target }) => {
    const { name, value } = target

    if (name === 'fullName') {
      setRegistrationForm((current) => ({ ...current, [name]: sanitizePlayerName(value) }))
      return
    }

    if (name === 'phone') {
      setRegistrationForm((current) => ({ ...current, [name]: sanitizePhone(value) }))
      return
    }

    setRegistrationForm((current) => ({ ...current, [name]: value }))
  }

  const handleLoginChange = ({ target }) => {
    const { name, value } = target

    if (name === 'fullName') {
      setLoginForm((current) => ({ ...current, fullName: sanitizePlayerName(value) }))
      return
    }

    setLoginForm((current) => ({ ...current, fullName: sanitizePlayerName(value) }))
  }

  const handleRegistrationSubmit = async (event) => {
    event.preventDefault()

    if (registeredPlayer?.playerId) {
      setRegistrationMessage(`Бул түзмөктөн биринчи сакталган оюнчу: ${registeredPlayer.name}. Кайра катталууга болбойт.`)
      return
    }

    const fullName = registrationForm.fullName.trim()
    const phone = registrationForm.phone.trim()

    if (!fullName || !phone) {
      setRegistrationMessage('Атыңызды жана 4 орундуу сырсөздү толтуруңуз.')
      return
    }

    if (!isValidPlayerName(fullName)) {
      setRegistrationMessage('Аты-жөнү талаасына сандарды же башка белгилерди жазууга болбойт.')
      return
    }

    if (!isValidPhone(phone)) {
      setRegistrationMessage('Номерге цифралар гана жазылышы керек.')
      return
    }

    if (false && passwordProtectionEnabled) {
      setRegistrationMessage('Сырсөз так 4 цифрадан турушу керек.')
      return
    }

    const existingPlayer = findPlayerForRegistration(tournamentState.players, { fullName, phone })
    if (existingPlayer) {
      const identity = { playerId: existingPlayer.id, name: existingPlayer.name }
      setRegisteredPlayer(identity)
      saveRegisteredPlayer(identity)
      setRegistrationForm(initialRegistrationForm)
      setLoginForm({ fullName: existingPlayer.name })
      setRegistrationMessage('Катышуучу мурда катталган. Система сизди автоматтык киргизди.')
      setLoginMessage('')
      setActiveSection('scoreEntry')
      return
    }

    try {
      const nextState = parseTournamentState(
        await registerTournamentPlayer({
          name: fullName,
          phone,
          gender: registrationForm.gender,
        }),
      )

      setTournamentState(nextState)
      const savedPlayer = findPlayerForRegistration(nextState.players, { fullName, phone })
      if (savedPlayer) {
        const identity = { playerId: savedPlayer.id, name: savedPlayer.name }
        setRegisteredPlayer(identity)
        saveRegisteredPlayer(identity)
        setActiveSection('scoreEntry')
      }
      setRegistrationForm(initialRegistrationForm)
      setLoginForm({ fullName })
      setRegistrationMessage('Катталуу ийгиликтүү аяктады.')
    } catch (error) {
      setRegistrationMessage(error.message || 'Катталууну сактоо мүмкүн болгон жок.')
    }
  }

  const handleLoginSubmit = (event) => {
    event.preventDefault()

    if (registeredPlayer?.playerId) {
      setLoginMessage(`Бул түзмөктө азыр ушул катышуучу кирген: ${registeredPlayer.name}.`)
      return
    }

    const fullName = loginForm.fullName.trim()

    if (!fullName) {
      setLoginMessage('4 орундуу сырсөздү жазыңыз.')
      return
    }

    if (passwordProtectionEnabled && !isValidPassword(password)) {
      setLoginMessage('Сырсөз так 4 цифра болушу керек.')
      return
    }

    if (!isValidPlayerName(fullName)) {
      setLoginMessage('Аты-жөнү туура эмес толтурулган.')
      return
    }

    const matchedPlayer = findPlayerByCredentials(tournamentState.players, fullName)
    if (!matchedPlayer) {
      setLoginMessage('Мындай 4 орундуу сырсөз менен катышуучу табылган жок.')
      return
    }

    const identity = { playerId: matchedPlayer.id, name: matchedPlayer.name }
    setRegisteredPlayer(identity)
    saveRegisteredPlayer(identity)
    setRegistrationForm((current) => ({ ...current, fullName: matchedPlayer.name }))
    setLoginForm(initialLoginForm)
    setRegistrationMessage('')
    setLoginMessage(`Кош келиңиз, ${matchedPlayer.name}.`)
    setActiveSection('scoreEntry')
  }

  const handleScoreChange = ({ target }) => {
    const { name, value } = target

    if (name === 'score') {
      setScoreForm((current) => ({ ...current, score: sanitizeNonNegativeNumber(value) }))
      return
    }

    setScoreForm((current) => ({ ...current, [name]: value }))
  }

  const handlePlayoffScoreChange = ({ target }) => {
    setPlayoffScoreForm({ score: sanitizeNonNegativeNumber(target.value) })
  }

  const handleScoreSubmit = async (event) => {
    event.preventDefault()

    if (isJournalLocked) {
      setScoreMessage('"Торду түзүү" баскычын баскандан кийин журнал жабылат. Андан кийин упай плей-оффко гана жазылат.')
      return
    }

    if (!scoreForm.playerId) {
      setScoreMessage('Оюнчуну тандаңыз.')
      return
    }

    if (false && passwordProtectionEnabled) {
      setScoreMessage('Сырсөз табылган жок.')
      return
    }

    if (scoreForm.score === '') {
      setScoreMessage('Упайды жазыңыз.')
      return
    }

    if (!/^\d+$/.test(scoreForm.score)) {
      setScoreMessage('Only 0 and positive digits are allowed.')
      return
    }

    if (Number(scoreForm.score) > MAX_PLAYER_SCORE) {
      setScoreMessage(`Максималдуу упай ${MAX_PLAYER_SCORE}.`)
      return
    }

    if (hasSubmittedCurrentRound) {
      setScoreMessage(`Score for this round is already locked: ${currentRoundScore}. Only the judge can change it.`)
      return
    }

    try {
      const nextState = parseTournamentState(
        await submitPlayerScore({
          playerId: scoreForm.playerId,
          score: scoreForm.score,
        }),
      )

      setTournamentState(nextState)
      setScoreForm((current) => ({ ...initialScoreForm, playerId: current.playerId }))
      setScoreMessage(`Упай журналга жазылды. Азыр ачык раунд: ${nextState.scoreSubmission.activeRound}.`)
    } catch (error) {
      setScoreMessage(error.message || 'Упайды жөнөтүү мүмкүн болгон жок.')
    }
  }

  const handlePlayoffScoreSubmit = async (event) => {
    event.preventDefault()

    if (!selectedPlayer?.id) {
      setPlayoffScoreMessage('Оюнчу табылган жок.')
      return
    }

    if (false && passwordProtectionEnabled) {
      setPlayoffScoreMessage('Сырсөз табылган жок.')
      return
    }

    if (!playerPlayoffMatch) {
      setPlayoffScoreMessage('Сиз үчүн ачык плей-офф беттеш жок.')
      return
    }

    if (playoffScoreForm.score === '') {
      setPlayoffScoreMessage('Упайды жазыңыз.')
      return
    }

    if (!/^\d+$/.test(playoffScoreForm.score)) {
      setPlayoffScoreMessage('Only 0 and positive digits are allowed.')
      return
    }

    if (Number(playoffScoreForm.score) > MAX_PLAYER_SCORE) {
      setPlayoffScoreMessage(`Максималдуу упай ${MAX_PLAYER_SCORE}.`)
      return
    }

    if (hasSubmittedPlayoffScore) {
      setPlayoffScoreMessage(`Сиз бул беттеш үчүн упайды мурда жөнөткөнсүз: ${currentPlayoffScore}.`)
      return
    }

    try {
      const nextState = parseTournamentState(
        await submitPlayoffPlayerScore({
          playerId: selectedPlayer.id,
          score: playoffScoreForm.score,
        }),
      )
      const nextDivisionId = selectedPlayer.gender === 'female' ? 'female' : 'male'
      const nextCompetitionState = nextState.competitionDivisions?.[nextDivisionId] || createEmptyCompetitionState()
      const refreshedMatch = getPlayerPlayoffMatch(nextCompetitionState.bracket, nextCompetitionState.playoffStage, selectedPlayer.id)
      const replayRequired = isStandardPlayoffReplayRequired(refreshedMatch)

      setTournamentState(nextState)
      setPlayoffScoreForm(initialPlayoffScoreForm)
      if (replayRequired) {
        setPlayoffScoreMessage('Эсеп тең болду. Бул беттешти кайра атыш керек.')
        return
      }
      setPlayoffScoreMessage('Плей-офф үчүн упай жөнөтүлдү.')
    } catch (error) {
      setPlayoffScoreMessage(error.message || 'Плей-офф упайын жөнөтүү мүмкүн болгон жок.')
    }
  }

  const handleResetRegistration = () => {
    setRegisteredPlayer(null)
    clearRegisteredPlayer()
    setRegistrationForm(initialRegistrationForm)
    setLoginForm(initialLoginForm)
    setScoreForm(initialScoreForm)
    setPlayoffScoreForm(initialPlayoffScoreForm)
    setRegistrationMessage('Эски катталуу бул түзмөктөн өчүрүлдү. Эми кайра жаңыдан катталсаңыз болот.')
    setLoginMessage('')
    setScoreMessage('')
    setPlayoffScoreMessage('')
    setActiveSection(null)
  }

  return (
    <div className="app-shell">
      <div className="app-background" aria-hidden="true" />

      <header className="topbar">
        <div className="topbar__brand">
          <div className="brand-icon">
            <TargetIcon />
          </div>
          <div>
            <p className="eyebrow">Катышуучулар үчүн</p>
            <h1 className="brand-title">Жаа атуу платформасы</h1>
          </div>
        </div>

        <div className="topbar__actions">
          {visibleSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`tab-button ${activeSection === section.id ? 'tab-button--active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          ))}

          {isRegistered && (
            <button type="button" className="secondary-button" onClick={handleResetRegistration}>
              Чыгуу
            </button>
          )}
        </div>
      </header>

      <main className="page">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Жандуу маалымат</p>
            <h2 className="hero-card__title">{tournamentState.tournamentName}</h2>
            <p className="hero-card__text">
              Бул жерде катышуучулар катталып, админ-панелде жаңыртылган рейтингди жана плей-офф жыйынтыктарын түз көрө алышат.
            </p>
          </div>

          <div className="hero-stats">
            <div className="stat-chip">
              <span className="stat-chip__label">Катышуучулар</span>
              <strong>{tournamentState.players.length}</strong>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">Топ</span>
              <strong>{activeCompetitionState.playoffMode}</strong>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">Жери</span>
              <strong className="stat-chip__compact">{tournamentState.location}</strong>
            </div>
          </div>
        </section>

        {!isRegistered && !activeSection && (
          <section className="panel panel--narrow">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Катышуучу</p>
                <h3 className="panel__title">Катталуу же кирүү тандаңыз</h3>
              </div>
              <div className="pill">Конок</div>
            </div>

            <div className="note-card">
              Бул жерде форма автоматтык ачылбайт. Жогору жактагы `Катталуу` же `Кирүү` баскычын басыңыз.
            </div>
          </section>
        )}

        {isRegistered && (
          <section className="player-status-board">
            <article className="player-status-card">
              <span className="player-status-card__label">Менин атым</span>
              <strong>{selectedPlayer?.name || '—'}</strong>
            </article>
            <article className="player-status-card">
              <span className="player-status-card__label">Менин бөлүмүм</span>
              <strong>{playerDivisionLabel}</strong>
            </article>
            <article className="player-status-card">
              <span className="player-status-card__label">Менин тамгам</span>
              <strong>{selectedTargetMeta?.laneLetter || selectedPlayer?.laneLetter || '—'}</strong>
            </article>
            <article className="player-status-card">
              <span className="player-status-card__label">Журнал</span>
              <strong>{playerJournalStatusLabel}</strong>
            </article>
            <article className="player-status-card">
              <span className="player-status-card__label">Менин бутам</span>
              <strong>{selectedTargetNumber ? `#${selectedTargetNumber}` : '-'}</strong>
            </article>
            <article className="player-status-card">
              <span className="player-status-card__label">Менин торум</span>
              <strong>{playerPlayoffStatusLabel}</strong>
            </article>
          </section>
        )}

        {activeSection === 'register' && (
          <section className="panel panel--narrow">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Катталуу</p>
                <h3 className="panel__title">Турнирге катышуу формасы</h3>
              </div>
              <div className="pill">Ачык</div>
            </div>

            <div className="info-strip">
              <span>{tournamentState.location}</span>
              <span>{tournamentState.category}</span>
            </div>

            <form className="form-grid" onSubmit={handleRegistrationSubmit}>
              <label className="field">
                <span className="field__label">Аты-жөнү</span>
                <input
                  name="fullName"
                  className="field__control"
                  value={registrationForm.fullName}
                  onChange={handleRegistrationChange}
                  autoComplete="name"
                  disabled={Boolean(registeredPlayer)}
                  required
                />
              </label>

              {false && <label className="field">
                <span className="field__label">4 орундуу сырсөз</span>
                <input
                  name="password"
                  className="field__control"
                  value={registrationForm.password}
                  onChange={handleRegistrationChange}
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="one-time-code"
                  placeholder="1234"
                  disabled={Boolean(registeredPlayer)}
                  required={false}
                />
              </label>}

              <label className="field">
                <span className="field__label">Номер</span>
                <input
                  name="phone"
                  className="field__control"
                  value={registrationForm.phone}
                  onChange={handleRegistrationChange}
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="tel"
                  placeholder="0555123456"
                  disabled={Boolean(registeredPlayer)}
                  required
                />
              </label>

              <div className="field field--full">
                <span className="field__label">Жынысы</span>
                <div className="gender-row">
                  <label className="gender-option">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={registrationForm.gender === 'male'}
                      onChange={handleRegistrationChange}
                      disabled={Boolean(registeredPlayer)}
                    />
                    <span>Эркек</span>
                  </label>

                  <label className="gender-option">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={registrationForm.gender === 'female'}
                      onChange={handleRegistrationChange}
                      disabled={Boolean(registeredPlayer)}
                    />
                    <span>Аял</span>
                  </label>
                </div>
              </div>

              <div className="note-card field--full">
                Форманы жөнөткөндөн кийин катышуучу автоматтык түрдө админ-панелдеги катышуучулар тизмесине кошулат.
              </div>

              <button type="submit" className="primary-button field--full">
                Катталуу
              </button>
            </form>

            <div className="action-row">
              <button type="button" className="secondary-button" onClick={handleResetRegistration}>
                Каттоону өчүрүп, кайра катталуу
              </button>
            </div>

            {registrationMessage && <p className="message-line">{registrationMessage}</p>}
          </section>
        )}

        {activeSection === 'login' && (
          <section className="panel panel--narrow">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Кирүү</p>
                <h3 className="panel__title">Мурда катталган катышуучунун кирүүсү</h3>
              </div>
              <div className="pill">Ыкчам</div>
            </div>

            <div className="info-strip">
              <span>Эгер катышуучу мурда катталган болсо, аты менен эле кире алат.</span>
              <span>Аты тизмедеги ат менен так дал келиши керек.</span>
            </div>

            <form className="form-grid" onSubmit={handleLoginSubmit}>
              <label className="field field--full">
                <span className="field__label">Аты-жөнү</span>
                <input
                  name="fullName"
                  className="field__control"
                  value={loginForm.fullName}
                  onChange={handleLoginChange}
                  autoComplete="name"
                  required
                />
              </label>
              {passwordProtectionEnabled && <label className="field field--full">
                <span className="field__label">4 орундуу сырсөз</span>
                <input
                  name="password"
                  className="field__control"
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="one-time-code"
                  required={passwordProtectionEnabled}
                />
              </label>}

              <div className="note-card field--full">
                Киргенден кийин жыйынтыкты, финалдык торду жана өз упайыңызды жөнөтүү бөлүмүн көрөсүз.
              </div>

              <button type="submit" className="primary-button field--full">
                Кирүү
              </button>
            </form>

            {loginMessage && <p className="message-line">{loginMessage}</p>}
          </section>
        )}

        {activeSection === 'rating' && (
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Жыйынтык</p>
                <h3 className="panel__title">Катышуучулардын жыйынтыгы</h3>
              </div>
              <div className="pill">Авто жаңыланат</div>
            </div>

            <div className="rating-board">
              {ratingPlayers.length > 0 ? (
                <div className="rating-sections">
                  <RatingSectionQualified title="Эркек" players={maleRatingPlayers} emptyLabel="Эркек катышуучулар азырынча жок." prefix="male" playoffMode={malePlayoffMode} />
                  <RatingSectionQualified title="Аял" players={femaleRatingPlayers} emptyLabel="Аял катышуучулар азырынча жок." prefix="female" playoffMode={femalePlayoffMode} />
                  <div className="rating-list" style={{ display: 'none' }}>
                    {ratingPlayers.map((player, index) => (
                    <article
                      key={player.id}
                      className={`rating-entry ${index < 3 ? `rating-entry--place-${index + 1}` : ''} ${index === 0 ? 'rating-entry--winner' : ''}`}
                    >
                      <div className="rating-entry__place">{index + 1}</div>
                      <div className="rating-entry__content">
                        <h4>{player.name}</h4>
                        <p>{index === 0 ? '1-орун' : index === 1 ? '2-орун' : index === 2 ? '3-орун' : 'Жалпы упай'}</p>
                      </div>
                      <strong>{player.total}</strong>
                    </article>
                  ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">Азырынча катышуучулар каттала элек.</div>
              )}
            </div>
          </section>
        )}

        {activeSection === 'playoff' && (
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Финалдык тор</p>
                <h3 className="panel__title">Беттештердин жыйынтыгы</h3>
              </div>
              <div className="pill">Авто жаңыланат</div>
            </div>

            {playoffMatches.length > 0 && <div className="playoff-score-panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Очко жазуу</p>
                  <h3 className="panel__title">Оюнчу упайын жөнөтүү</h3>
                  </div>
                <div className="pill">
                  {activeCompetitionState.playoffStage === 'final'
                    ? `Финал A${currentPlayoffRound}`
                    : stageTitles[activeCompetitionState.playoffStage] || 'Тор'}
                </div>
              </div>

              <div className="info-strip">
                <span>Бул жерде сиз өз плей-офф беттешиңиз үчүн упай жибере аласыз.</span>
                <span>Админ ачкан активдүү этапка гана жазуу мүмкүн.</span>
              </div>

              <form className="form-grid" onSubmit={handlePlayoffScoreSubmit}>
                <label className="field field--full">
                  <span className="field__label">Аты</span>
                  <input className="field__control" value={registeredPlayer?.name || ''} readOnly placeholder="Адегенде катталуу керек" />
                </label>

                <label className="field field--full">
                  <span className="field__label">Атаандаш</span>
                  <input className="field__control" value={playoffOpponent?.name || ''} readOnly placeholder="Атаандаш чыкканда көрүнөт" />
                </label>

                <label className="field">
                  <span className="field__label">Упай</span>
                  <input
                    type="text"
                    name="score"
                    className="field__control"
                    value={hasSubmittedPlayoffScore ? String(currentPlayoffScore) : playoffScoreForm.score}
                    onChange={handlePlayoffScoreChange}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    disabled={hasSubmittedPlayoffScore || !playerPlayoffMatch}
                    required
                  />
                </label>

                <div className="note-card field--full">
                  {playerPlayoffMatch
                    ? `Активдүү беттеш: ${playoffOpponent?.name || '—'}. ${activeCompetitionState.playoffStage === 'final' ? `A${currentPlayoffRound} үчүн` : ''} сиздин азыркы мааниниз: ${currentPlayoffScore === '' ? 'жок' : currentPlayoffScore}.`
                    : 'Админ сизди активдүү плей-офф беттешке чыгарганда ошол жерден упай жаза аласыз.'}
                </div>

                <button type="submit" className="primary-button field--full" disabled={hasSubmittedPlayoffScore || !playerPlayoffMatch}>
                  Упайды жөнөттүү
                </button>
              </form>

              {playoffScoreMessage && <p className="message-line">{playoffScoreMessage}</p>}
            </div>}

            {playoffMatches.length > 0 ? (
              <div
                className="bracket-grid"
                style={{
                  '--bracket-column-count': playoffStages.length + (hasFinalMatches ? 1 : 0),
                  '--bracket-column-width': activeCompetitionState.playoffMode === 32 ? '248px' : activeCompetitionState.playoffMode === 16 ? '264px' : '280px',
                  '--bracket-column-gap': activeCompetitionState.playoffMode === 32 ? '34px' : activeCompetitionState.playoffMode === 16 ? '40px' : '48px',
                }}
              >
                {playoffStages.map((stage) => (
                  <ReadOnlyStageColumn
                    key={stage.stageKey}
                    stageKey={stage.stageKey}
                    title={stage.title}
                    playoffMode={activeCompetitionState.playoffMode}
                    matches={stage.matches}
                  />
                ))}

                {hasFinalMatches && (
                  <div className="stage-column stage-column--final">
                    <div className="stage-column__header">
                      <p className="stage-column__eyebrow">Этап</p>
                      <h4>Финал</h4>
                    </div>

                    {activeCompetitionState.bracket.final12 && <ReadOnlyMatch match={activeCompetitionState.bracket.final12} isFinal />}
                    {activeCompetitionState.bracket.final34 && <ReadOnlyMatch match={activeCompetitionState.bracket.final34} isFinal />}
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">Админ-панелде плей-офф азырынча түзүлгөн жок.</div>
            )}
          </section>
        )}

        {activeSection === 'scoreEntry' && (
          <section className="panel panel--narrow">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Очко жазуу</p>
                <h3 className="panel__title">Оюнчу упайын жөнөтүү</h3>
              </div>
              <div className="pill">Ачык раунд: {activeScoreRound}</div>
            </div>

            <div className="info-strip">
              <span>Упай дароо админ журналында көрүнөт.</span>
              <span>Кийинки раунд админ ачмайынча бул жерден башка раундга өтүү мүмкүн эмес.</span>
              <span>Бул бетте сиздин мишенедеги гана 4 оюнчунун журналдагы упайлары корунот.</span>
            </div>

            <TargetGroupPanel
              selectedPlayerId={selectedPlayer?.id}
              targetNumber={selectedTargetNumber}
              players={selectedTargetGroup}
              scores={tournamentState.scores}
              activeRound={activeScoreRound}
              targetMap={genderTargetMap}
            />

            <form className="form-grid" onSubmit={handleScoreSubmit}>
              <label className="field field--full">
                <span className="field__label">Аты</span>
                <input className="field__control" value={registeredPlayer?.name || ''} readOnly placeholder="Адегенде катталуу керек" />
              </label>

              <input type="hidden" name="playerId" value={scoreForm.playerId} readOnly />

              <label className="field">
                <span className="field__label">Упай</span>
                <input
                  type="text"
                  name="score"
                  className="field__control"
                  value={hasSubmittedCurrentRound ? String(currentRoundScore) : scoreForm.score}
                  onChange={handleScoreChange}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  disabled={hasSubmittedCurrentRound || isJournalLocked}
                  required
                />
              </label>

              <div className="note-card field--full">
                {selectedPlayer
                  ? `Азыр ачык раунд: ${activeScoreRound}. Бул ат үчүн ушул раунддагы журналдагы маани: ${currentRoundScore === '' ? 'жок' : currentRoundScore}.`
                  : 'Адегенде Катталуу бөлүмүндө атыңызды сактаңыз. Ошондон кийин бул жерде ат автоматтык чыгат.'}
              </div>

              <button type="submit" className="primary-button field--full" disabled={hasSubmittedCurrentRound || isJournalLocked}>
                Упайды жөнөтүү
              </button>
            </form>

            {scoreMessage && <p className="message-line">{scoreMessage}</p>}
          </section>
        )}
      </main>
    </div>
  )
}

const TargetGroupPanel = ({ selectedPlayerId, targetNumber, players, scores, activeRound, targetMap }) => {
  if (!selectedPlayerId) {
    return null
  }

  if (!players.length) {
    return <div className="note-card">Сиздин бута боюнча топ азырынча табылган жок.</div>
  }

  return (
    <section className="target-group-panel">
      <div className="target-group-panel__header">
        <div>
          <p className="eyebrow">Бута журналы</p>
          <h4 className="panel__title">Бута #{targetNumber}</h4>
        </div>
        <div className="pill">{players.length} оюнчу</div>
      </div>

      <div className="target-group-grid">
        {players.map((player) => {
          const total = calculateTotal(scores, player.id)
          const isCurrentPlayer = player.id === selectedPlayerId
          const targetMeta = targetMap?.[player.id]

          return (
            <article key={player.id} className={`target-player-card ${isCurrentPlayer ? 'target-player-card--current' : ''}`}>
              <div className="target-player-card__header">
                <div>
                  <div className="target-player-card__name-row">
                    <strong>{player.name}</strong>
                    <span className="target-lane-badge">{targetMeta?.laneLetter || player.laneLetter || getLaneLetter(player.entryNumber)}</span>
                  </div>
                  <p className="target-player-card__meta">
                    {getGenderLabel(player.gender)} | Бута #{targetMeta?.targetNumber || getTargetNumber(player.entryNumber)} | #{player.entryNumber}
                  </p>
                </div>
                <div className="target-total-badge">Жалпы: {total}</div>
              </div>

              <div className="target-rounds-grid">
                {QUALIFICATION_ROUNDS.map((round) => {
                  const roundScore = getPlayerRoundScore(scores, player.id, round)
                  const hasScore = roundScore !== '' && roundScore !== null && roundScore !== undefined

                  return (
                    <div
                      key={`${player.id}-round-${round}`}
                      className={`target-round-chip ${round === activeRound ? 'target-round-chip--active' : ''} ${hasScore ? 'target-round-chip--filled' : 'target-round-chip--empty'}`}
                    >
                      <span className="target-round-chip__round">A{round}</span>
                      <strong>{hasScore ? roundScore : '-'}</strong>
                      <span className="target-round-chip__status">{hasScore ? 'Жазылды' : 'Жок'}</span>
                    </div>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

const ReadOnlyStageColumn = ({ stageKey, title, playoffMode, matches }) => {
  const roundIndex = getRoundIndex(playoffMode, stageKey)
  const roundFactor = 2 ** Math.max(roundIndex, 0)
  const slotCount = getStageMatchCount(playoffMode, stageKey)
  const slotStageClassName = `bracket-match-slot--${stageKey}`
  const connectorStageClassName = `bracket-match-slot__connector--${stageKey}`
  const editableConnectorClassName =
    stageKey === 'roundOf32'
      ? 'playoff-line-editable-round32'
      : stageKey === 'roundOf16'
        ? 'playoff-line-editable-round16'
        : stageKey === 'quarterFinals'
          ? 'playoff-line-editable-quarterfinals'
          : stageKey === 'semiFinals'
            ? 'playoff-line-editable-semifinals'
            : 'playoff-line-editable'

  const columnStyle = {
    '--stage-offset': `calc(((var(--bracket-match-height) + var(--bracket-match-gap)) * ${roundFactor - 1}) / 2)`,
    '--stage-gap': `calc((var(--bracket-match-height) + var(--bracket-match-gap)) * ${roundFactor} - var(--bracket-match-height))`,
  }

  const stageSlots = Array.from({ length: slotCount }, (_, matchIndex) => {
    const match = matches[matchIndex]
    if (match) {
      return {
        kind: 'match',
        key: match.id,
        match,
        seedNumbers: getSeedNumbersForMatch(playoffMode, stageKey, matchIndex),
      }
    }

    return {
      kind: 'placeholder',
      key: `${stageKey}-placeholder-${matchIndex}`,
    }
  })

  return (
    <div className="stage-column" style={columnStyle}>
      <div className="stage-column__header">
        <p className="stage-column__eyebrow">Этап</p>
        <h4>{title}</h4>
      </div>

      <div className="stage-column__matches">
        {stageSlots.map((slot) => (
          <div
            key={slot.key}
            className={`bracket-match-slot ${slotStageClassName} ${stageKey === 'semiFinals' ? 'bracket-match-slot--semiFinals' : ''}`}
          >
            {roundIndex > 0 && (
              <div
                className={`bracket-match-slot__connector bracket-match-slot__connector--custom ${editableConnectorClassName} ${connectorStageClassName} ${
                  stageKey === 'semiFinals' ? 'bracket-match-slot__connector--semiFinals' : ''
                }`}
                aria-hidden="true"
              />
            )}
            {slot.kind === 'match' ? <ReadOnlyMatch match={slot.match} seedNumbers={slot.seedNumbers} /> : <ReadOnlyPlaceholderMatch />}
          </div>
        ))}
      </div>
    </div>
  )
}

const ReadOnlyPlaceholderMatch = () => (
  <article className="playoff-card playoff-card--placeholder">
    <div className="playoff-row">
      <div className="playoff-row__name">???</div>
      <div className="playoff-row__score">0</div>
    </div>
    <div className="playoff-row playoff-row--divided">
      <div className="playoff-row__name">???</div>
      <div className="playoff-row__score">0</div>
    </div>
  </article>
)

const ReadOnlyMatch = ({ match, seedNumbers, isFinal = false }) => {
  if (!match) return null
  const showShootOff = isStandardPlayoffShootOffActive(match)

  if (match.isFinal || isFinal) {
    return (
      <article className={`match-card match-card--final ${match.winner ? 'match-card--winner' : ''}`}>
        <ReadOnlyFinalPlayer
          rounds={match.roundsP1 || Array(FINAL_ROUNDS_COUNT).fill(0)}
          name={match.p1?.name || '—'}
          mainScore={match.s1}
          extraScore={match.s1_bot}
          isWinner={match.winner?.id === match.p1?.id}
        />
        <div className="match-divider" />
        <ReadOnlyFinalPlayer
          rounds={match.roundsP2 || Array(FINAL_ROUNDS_COUNT).fill(0)}
          name={match.p2?.name || '—'}
          mainScore={match.s2}
          extraScore={match.s2_bot}
          isWinner={match.winner?.id === match.p2?.id}
        />
      </article>
    )
  }

  return (
    <article className={`playoff-card ${match.winner ? 'playoff-card--winner' : ''}`}>
      <div className={`playoff-row ${match.winner?.id === match.p1?.id ? 'playoff-row--winner' : ''}`}>
        <div className="playoff-row__identity">
          {seedNumbers && <span className="match-player__seed">{seedNumbers[0]}</span>}
          <span className="playoff-row__name">{match.p1?.name || '—'}</span>
        </div>
        <div className="playoff-row__score-stack">
          <div className="playoff-row__score">{match.s1}</div>
          {showShootOff && <div className="playoff-row__score playoff-row__score--shootout">{match.shootOffS1 || ''}</div>}
        </div>
      </div>
      <div className={`playoff-row playoff-row--divided ${match.winner?.id === match.p2?.id ? 'playoff-row--winner' : ''}`}>
        <div className="playoff-row__identity">
          {seedNumbers && <span className="match-player__seed">{seedNumbers[1]}</span>}
          <span className="playoff-row__name">{match.p2?.name || '—'}</span>
        </div>
        <div className="playoff-row__score-stack">
          <div className="playoff-row__score">{match.s2}</div>
          {showShootOff && <div className="playoff-row__score playoff-row__score--shootout">{match.shootOffS2 || ''}</div>}
        </div>
      </div>
    </article>
  )
}

const ReadOnlyFinalPlayer = ({ rounds, name, mainScore, extraScore, isWinner }) => (
  <div className={`final-player ${isWinner ? 'final-player--winner' : ''}`}>
    <div className="final-rounds-group">
      <div className="final-rounds-group__label">Негизги</div>
      <div className="final-rounds">
        {rounds.slice(0, FINAL_PRIMARY_ROUNDS).map((value, index) => (
          <div key={index} className="mini-input mini-input--readonly">
            {value || ''}
          </div>
        ))}
      </div>
    </div>

    <div className="final-player__card">
      <strong>{name}</strong>
      <span>Негизги: {mainScore}</span>
      <span>Кошумча: {extraScore}</span>
    </div>

    <div className="final-rounds-group">
      <div className="final-rounds-group__label">Кошумча</div>
      <div className="final-rounds">
        {rounds.slice(FINAL_PRIMARY_ROUNDS).map((value, index) => (
          <div key={index + FINAL_PRIMARY_ROUNDS} className="mini-input mini-input--accent mini-input--readonly">
            {value || ''}
          </div>
        ))}
      </div>
    </div>
  </div>
)

const RatingSection = ({ title, players, emptyLabel, prefix }) => (
  <div className="rating-group">
    <div className="panel__header">
      <div>
        <p className="eyebrow">Бөлүм</p>
        <h4 className="panel__title">{title}</h4>
      </div>
      <div className="pill">{players.length}</div>
    </div>

    {players.length > 0 ? (
      <div className="rating-list">
        {players.map((player, index) => (
          <article
            key={`${prefix}-${player.id}`}
            className={`rating-entry ${index < 3 ? `rating-entry--place-${index + 1}` : ''} ${index === 0 ? 'rating-entry--winner' : ''}`}
          >
            <div className="rating-entry__place">{index + 1}</div>
            <div className="rating-entry__content">
              <h4>{player.name}</h4>
              <p>{index === 0 ? '1-орун' : index === 1 ? '2-орун' : index === 2 ? '3-орун' : 'Жалпы упай'}</p>
            </div>
            <strong>{player.total}</strong>
          </article>
        ))}
      </div>
    ) : (
      <div className="empty-state">{emptyLabel}</div>
    )}
  </div>
)

const RatingSectionQualified = ({ title, players, emptyLabel, prefix, playoffMode }) => {
  const playoffCount = Math.min(players.length, playoffMode)

  return (
    <div className="rating-group">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Бөлүм</p>
          <h4 className="panel__title">{title}</h4>
        </div>
        <div className="pill">Топ-{playoffMode}</div>
      </div>

      {players.length > 0 ? (
        <>
          <div className="rating-summary-strip">
            <span className="rating-summary-strip__item">
              Өтүү чеги: <strong>Топ-{playoffMode}</strong>
            </span>
            <span className="rating-summary-strip__item">
              Өтүп жаткандар: <strong>{playoffCount}</strong> / {players.length}
            </span>
          </div>

          <div className="rating-list">
            {players.map((player, index) => {
              const isQualified = index < playoffMode

              return (
                <article
                  key={`${prefix}-${player.id}`}
                  className={`rating-entry ${isQualified ? 'rating-entry--qualified' : 'rating-entry--waiting'}`}
                >
                  <div className="rating-entry__place">{index + 1}</div>
                  <div className="rating-entry__content">
                    <h4>{player.name}</h4>
                    <p>{isQualified ? 'Торго кирет' : 'Азырынча өтпөйт'}</p>
                  </div>
                  <div className="rating-entry__result">
                    <span className={`rating-status-pill ${isQualified ? 'rating-status-pill--in' : 'rating-status-pill--out'}`}>
                      {isQualified ? 'Өтөт' : 'Өтпөйт'}
                    </span>
                    <strong>{player.total}</strong>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      ) : (
        <div className="empty-state">{emptyLabel}</div>
      )}
    </div>
  )
}

export default App

