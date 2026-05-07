import { useEffect, useState, useRef } from 'react';
import './App.css';
import { fetchTournamentState, saveTournamentState, registerTournamentPlayer } from '../shared/tournamentApi.js';

const STORAGE_KEY = 'archery_v32_final_data_v5';
const ROUNDS = [1, 2, 3, 4, 5, 6];
const FINAL_PRIMARY_ROUNDS = 6;
const FINAL_ROUNDS_COUNT = 12;
const MAX_SCORE = 30;
const EMPTY_BRACKET = {
  roundOf32: [],
  roundOf16: [],
  quarterFinals: [],
  semiFinals: [],
  final12: null,
  final34: null,
  winners: [],
};

const DEFAULT_SCORE_SUBMISSION = {
  activeRound: 1,
  entries: [],
};

const DEFAULT_PLAYOFF_FINAL_ROUND = 1;
const DEFAULT_PLAYOFF_FINAL_ROUNDS = {
  final12: DEFAULT_PLAYOFF_FINAL_ROUND,
  final34: DEFAULT_PLAYOFF_FINAL_ROUND,
};

const DEFAULT_STATE = {
  tournamentName: 'Жаа атуу боюнча турнир',
  location: 'Чолпон-Ата, 2026-жыл',
  category: 'Классикалык жаа, 50 метр, эркектер',
  playoffDivision: 'all',
  headReferee: '',
  headSecretary: '',
  players: [],
  playerDirectory: [],
  scores: {},
  bracket: EMPTY_BRACKET,
  playoffStage: 'none',
  playoffMode: 16,
  playoffFinalRounds: DEFAULT_PLAYOFF_FINAL_ROUNDS,
  playerNumberBook: {},
  scoreSubmission: DEFAULT_SCORE_SUBMISSION,
};

const seedOrders = {
  32: [0, 31, 15, 16, 7, 24, 8, 23, 4, 27, 11, 20, 3, 28, 12, 19, 1, 30, 14, 17, 6, 25, 9, 22, 5, 26, 10, 21, 2, 29, 13, 18],
  16: [0, 15, 7, 8, 4, 11, 3, 12, 2, 13, 5, 10, 6, 9, 1, 14],
  8: [0, 7, 3, 4, 1, 6, 2, 5],
  4: [0, 3, 1, 2],
};

const playoffStageKeysByMode = {
  32: ['roundOf32', 'roundOf16', 'quarterFinals', 'semiFinals'],
  16: ['roundOf16', 'quarterFinals', 'semiFinals'],
  8: ['quarterFinals', 'semiFinals'],
  4: ['semiFinals'],
};

const tabs = [
  { id: 'players', label: 'Катышуучулар' },
  { id: 'playerData', label: 'Оюнчу тизмеси' },
  { id: 'journal', label: 'Тандоо элек' },
  { id: 'rating', label: 'Даража' },
  { id: 'playoff', label: 'Жеке элек' },
  { id: 'report', label: 'Отчёт' },
];

const stageMeta = {
  roundOf32: { label: '1/16 финал', short: '1/16' },
  roundOf16: { label: '1/8 финал', short: '1/8' },
  quarterFinals: { label: 'Чейрек финал', short: '1/4' },
  semiFinals: { label: 'Жарым финал', short: '1/2' },
  final12: { label: 'Финал', short: 'Финал' },
  final34: { label: '3-орун үчүн беттеш', short: '3-орун' },
};

const playoffStageTitles = {
  roundOf32: '1/16 финал',
  roundOf16: '1/8 финал',
  quarterFinals: '1/4 финал',
  semiFinals: 'Жарым финал',
  final12: 'Финал',
};

const PLAYOFF_DIVISIONS = [
  { id: 'all', label: 'Баары' },
  { id: 'male', label: 'Эркек' },
  { id: 'female', label: 'Аял' },
];

const createMatch = (id, p1, p2, isFinal = false) => ({
  id,
  p1,
  p2,
  s1: 0,
  s2: 0,
  shootOffS1: 0,
  shootOffS2: 0,
  s1_bot: 0,
  s2_bot: 0,
  winner: null,
  isFinal,
  roundsP1: Array(FINAL_ROUNDS_COUNT).fill(0),
  roundsP2: Array(FINAL_ROUNDS_COUNT).fill(0),
  submittedRoundsP1: Array(FINAL_PRIMARY_ROUNDS).fill(false),
  submittedRoundsP2: Array(FINAL_PRIMARY_ROUNDS).fill(false),
  submittedShootOffP1: false,
  submittedShootOffP2: false,
});

const normalizePlayerName = (name) => name.trim().toLocaleLowerCase();
const sanitizeNonNegativeNumber = (value, maxLength = 2) => {
  const digitsOnly = String(value ?? '').replace(/[^\d]/g, '').slice(0, maxLength);
  if (!digitsOnly) {
    return '';
  }

  return String(Math.min(Number(digitsOnly), MAX_SCORE));
};
const normalizePlayoffDivision = (value) => (['all', 'male', 'female'].includes(value) ? value : 'all');
const matchesPlayoffDivision = (player, playoffDivision) => playoffDivision === 'all' || player.gender === playoffDivision;
const normalizePlayoffFinalRounds = (value) => ({
  final12: ROUNDS.includes(Number(value?.final12)) ? Number(value.final12) : DEFAULT_PLAYOFF_FINAL_ROUND,
  final34: ROUNDS.includes(Number(value?.final34)) ? Number(value.final34) : DEFAULT_PLAYOFF_FINAL_ROUND,
});
const isStandardPlayoffShootOffActive = (match) =>
  Boolean(match && !match.isFinal && Number(match.s1) === Number(match.s2) && (match.submittedP1 || match.submittedP2 || match.submittedShootOffP1 || match.submittedShootOffP2));

const createEmptyBracket = () => ({
  roundOf32: [],
  roundOf16: [],
  quarterFinals: [],
  semiFinals: [],
  final12: null,
  final34: null,
  winners: [],
});

const buildPlayerNumberBook = (players, savedBook = {}) => {
  const nextBook = { ...savedBook };

  players.forEach((player, index) => {
    const normalizedName = normalizePlayerName(player.name || '');
    const entryNumber = player.entryNumber ?? index + 1;

    if (normalizedName && !nextBook[normalizedName]) {
      nextBook[normalizedName] = entryNumber;
    }
  });

  return nextBook;
};

const sortPlayersByEntryNumber = (players) =>
  [...players].sort((a, b) => {
    const aNumber = a.entryNumber ?? Number.MAX_SAFE_INTEGER;
    const bNumber = b.entryNumber ?? Number.MAX_SAFE_INTEGER;

    if (aNumber !== bNumber) {
      return aNumber - bNumber;
    }

    return a.name.localeCompare(b.name);
  });

const normalizeStoredPlayers = (players, savedBook = {}) => {
  const resolvedBook = buildPlayerNumberBook(players, savedBook);

  return players.map((player, index) => {
    const normalizedName = normalizePlayerName(player.name || '');
    const fallbackNumber = resolvedBook[normalizedName] ?? index + 1;

    return {
      ...player,
      phone: player.phone ?? '',
      gender: player.gender ?? '',
      entryNumber: player.entryNumber ?? fallbackNumber,
    };
  });
};

const normalizePlayerDirectory = (players) =>
  sortPlayersByEntryNumber(
    (players || []).map((player, index) => ({
      ...player,
      phone: player.phone ?? '',
      gender: player.gender ?? '',
      entryNumber: player.entryNumber ?? index + 1,
    })),
  );

const isEmptyBracket = (bracket) =>
  !bracket.final12 &&
  !bracket.final34 &&
  bracket.winners.length === 0 &&
  bracket.roundOf32.length === 0 &&
  bracket.roundOf16.length === 0 &&
  bracket.quarterFinals.length === 0 &&
  bracket.semiFinals.length === 0;

const parseStoredState = (raw) => {
  if (!raw) {
    return DEFAULT_STATE;
  }

  const parsed = JSON.parse(raw);
  const normalizedPlayers = normalizeStoredPlayers(parsed.players || [], parsed.playerNumberBook || {});
  const playerNumberBook = buildPlayerNumberBook(normalizedPlayers, parsed.playerNumberBook || {});

  return {
    ...DEFAULT_STATE,
    ...parsed,
    playoffDivision: normalizePlayoffDivision(parsed.playoffDivision),
    playoffFinalRounds: normalizePlayoffFinalRounds(parsed.playoffFinalRounds),
    players: normalizedPlayers,
    playerDirectory: normalizePlayerDirectory(parsed.playerDirectory || parsed.players || []),
    playerNumberBook,
    bracket: parsed.bracket ? { ...EMPTY_BRACKET, ...parsed.bracket } : EMPTY_BRACKET,
    scoreSubmission: {
      ...DEFAULT_SCORE_SUBMISSION,
      ...(parsed.scoreSubmission || {}),
      entries: Array.isArray(parsed.scoreSubmission?.entries) ? parsed.scoreSubmission.entries : [],
    },
  };
};

const formatSubmissionTimestamp = (value) => {
  if (!value) {
    return 'Убакыты белгисиз';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Убакыты белгисиз';
  }

  return date.toLocaleString('ru-RU');
};

const loadInitialState = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE;
  }

  try {
    return parseStoredState(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_STATE;
  }
};

const Icon = ({ size = 18, className = '', children }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const TargetIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1.5" />
  </Icon>
);

const UsersIcon = (props) => (
  <Icon {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="9.5" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);

const MedalIcon = (props) => (
  <Icon {...props}>
    <path d="M8 3h8l-2 6h-4L8 3Z" />
    <circle cx="12" cy="16" r="5" />
    <path d="m12 13 1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2L9 15.3l2-.3 1-2Z" />
  </Icon>
);

const TrashIcon = (props) => (
  <Icon {...props}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </Icon>
);

const RefreshIcon = (props) => (
  <Icon {...props}>
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0 1 15.55-6.36L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 0 1-15.55 6.36L3 16" />
  </Icon>
);

const PrinterIcon = (props) => (
  <Icon {...props}>
    <path d="M7 8V3h10v5" />
    <rect x="5" y="14" width="14" height="7" rx="1" />
    <rect x="3" y="8" width="18" height="8" rx="2" />
    <path d="M17 12h.01" />
  </Icon>
);

const CheckUserIcon = (props) => (
  <Icon {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="10" cy="7" r="4" />
    <path d="m16 11 2 2 4-4" />
  </Icon>
);

const MenuIcon = (props) => (
  <Icon {...props}>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </Icon>
);

const normalizeMatchList = (stageKey, bracket) => {
  if (stageKey === 'final12' || stageKey === 'final34') {
    return bracket[stageKey] ? [bracket[stageKey]] : [];
  }

  return bracket[stageKey] || [];
};

const getBracketStagesForSheet = (bracket, playoffMode) => {
  return (playoffStageKeysByMode[playoffMode] || playoffStageKeysByMode[8])
    .map((key) => ({
      key,
      ...stageMeta[key],
      matches: normalizeMatchList(key, bracket),
    }))
    .filter((stage) => stage.matches.length > 0);
};

const getInitialStageKey = (playoffMode) => (playoffStageKeysByMode[playoffMode] || playoffStageKeysByMode[8])[0];

const getVisibleStageKeys = (playoffMode) => playoffStageKeysByMode[playoffMode] || playoffStageKeysByMode[8];

const getRoundIndex = (playoffMode, stageKey) => getVisibleStageKeys(playoffMode).indexOf(stageKey);

const getStageMatchCount = (playoffMode, stageKey) => {
  const roundIndex = getRoundIndex(playoffMode, stageKey);
  if (roundIndex < 0) {
    return 0;
  }

  return playoffMode / 2 ** (roundIndex + 1);
};

const getSeedNumbersForMatch = (playoffMode, stageKey, matchIndex) => {
  const initialStageKey = getInitialStageKey(playoffMode);
  if (stageKey !== initialStageKey) {
    return null;
  }

  const order = seedOrders[playoffMode];
  if (!order) {
    return null;
  }

  return [order[matchIndex * 2] + 1, order[matchIndex * 2 + 1] + 1];
};

const getJournalSheetLayout = (playerCount) => {
  const safeCount = Math.max(playerCount, 1);
  const headerRowHeight = safeCount <= 10 ? 13 : safeCount <= 22 ? 11 : 9;
  const tableHeight = safeCount <= 10 ? 182 : safeCount <= 22 ? 188 : 194;
  const rowHeight = Math.max(6.2, Math.min(24, (tableHeight - headerRowHeight) / safeCount));

  if (safeCount <= 6) {
    return {
      className: 'journal-sheet--spacious',
      style: {
        '--journal-table-height': `${tableHeight}mm`,
        '--journal-header-row-height': `${headerRowHeight}mm`,
        '--journal-row-height': `${rowHeight}mm`,
        '--journal-font-size': '1.1rem',
        '--journal-header-font-size': '0.84rem',
        '--journal-cell-padding-y': '14px',
        '--journal-cell-padding-x': '10px',
      },
    };
  }

  if (safeCount <= 12) {
    return {
      className: 'journal-sheet--balanced',
      style: {
        '--journal-table-height': `${tableHeight}mm`,
        '--journal-header-row-height': `${headerRowHeight}mm`,
        '--journal-row-height': `${rowHeight}mm`,
        '--journal-font-size': '1rem',
        '--journal-header-font-size': '0.8rem',
        '--journal-cell-padding-y': '12px',
        '--journal-cell-padding-x': '9px',
      },
    };
  }

  if (safeCount <= 24) {
    return {
      className: 'journal-sheet--compact',
      style: {
        '--journal-table-height': `${tableHeight}mm`,
        '--journal-header-row-height': `${headerRowHeight}mm`,
        '--journal-row-height': `${rowHeight}mm`,
        '--journal-font-size': '0.9rem',
        '--journal-header-font-size': '0.76rem',
        '--journal-cell-padding-y': '10px',
        '--journal-cell-padding-x': '8px',
      },
    };
  }

  return {
    className: 'journal-sheet--dense',
    style: {
      '--journal-table-height': `${tableHeight}mm`,
      '--journal-header-row-height': `${headerRowHeight}mm`,
      '--journal-row-height': `${rowHeight}mm`,
      '--journal-font-size': '0.8rem',
      '--journal-header-font-size': '0.7rem',
      '--journal-cell-padding-y': '7px',
      '--journal-cell-padding-x': '6px',
    },
  };
};

const getReportSheetLayout = (playoffMode, bracketStagesForSheet, hasFinalMatches) => {
  const stageCount = bracketStagesForSheet.length;
  const totalMatches = bracketStagesForSheet.reduce((sum, stage) => sum + stage.matches.length, 0) + (hasFinalMatches ? 2 : 0);

  if (playoffMode === 8) {
    return {
      className: 'report-sheet--mode8',
      style: {
        '--report-board-gap': totalMatches <= 6 ? '18px' : '16px',
        '--report-stage-width': totalMatches <= 6 ? '142px' : '134px',
        '--report-finals-width': totalMatches <= 6 ? '154px' : '146px',
        '--report-stage-font-size': totalMatches <= 6 ? '10px' : '9px',
        '--report-stage-title-font-size': totalMatches <= 6 ? '10px' : '9px',
        '--report-match-height': totalMatches <= 6 ? '42' : '38',
      },
    };
  }

  if (playoffMode === 16) {
    return {
      className: 'report-sheet--mode16',
      style: {
        '--report-board-gap': hasFinalMatches ? '14px' : '16px',
        '--report-stage-width': hasFinalMatches ? '126px' : '132px',
        '--report-finals-width': hasFinalMatches ? '138px' : '144px',
        '--report-stage-font-size': '9px',
        '--report-stage-title-font-size': '9px',
        '--report-match-height': hasFinalMatches ? '38' : '40',
      },
    };
  }

  if (playoffMode === 32) {
    return {
      className: 'report-sheet--mode32',
      style: {
        '--report-board-gap': stageCount >= 4 ? '6px' : '7px',
        '--report-stage-width': stageCount >= 4 ? '78px' : '84px',
        '--report-finals-width': hasFinalMatches ? '88px' : '92px',
        '--report-stage-font-size': '6.7px',
        '--report-stage-title-font-size': '6.7px',
        '--report-match-height': stageCount >= 4 ? '24' : '26',
      },
    };
  }

  return {
    className: 'report-sheet--compact',
    style: {
      '--report-board-gap': '10px',
      '--report-stage-width': '102px',
      '--report-finals-width': '112px',
      '--report-stage-font-size': '8px',
      '--report-stage-title-font-size': '8px',
      '--report-match-height': '32',
    },
  };
};

const App = () => {
  const initialState = loadInitialState();

  const [tournamentName, setTournamentName] = useState(initialState.tournamentName);
  const [location, setLocation] = useState(initialState.location);
  const [category, setCategory] = useState(initialState.category);
  const [playoffDivision, setPlayoffDivision] = useState(normalizePlayoffDivision(initialState.playoffDivision));
  const [playoffFinalRounds, setPlayoffFinalRounds] = useState(normalizePlayoffFinalRounds(initialState.playoffFinalRounds));
  const [headReferee, setHeadReferee] = useState(initialState.headReferee);
  const [headSecretary, setHeadSecretary] = useState(initialState.headSecretary);
  const [players, setPlayers] = useState(initialState.players);
  const [playerDirectory, setPlayerDirectory] = useState(initialState.playerDirectory || []);
  const [playerNumberBook, setPlayerNumberBook] = useState(initialState.playerNumberBook);
  const [scores, setScores] = useState(initialState.scores);
  const [scoreSubmission, setScoreSubmission] = useState(initialState.scoreSubmission || DEFAULT_SCORE_SUBMISSION);
  const [activeTab, setActiveTab] = useState('players');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPhone, setNewPlayerPhone] = useState('');
  const [newPlayerGender, setNewPlayerGender] = useState('male');
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPlayersListExpanded, setIsPlayersListExpanded] = useState(false);
  const [playoffMode, setPlayoffMode] = useState(initialState.playoffMode);
  const [playoffStage, setPlayoffStage] = useState(initialState.playoffStage);
  const [bracket, setBracket] = useState(initialState.bracket);
  const [printTarget, setPrintTarget] = useState(null);
  const [isResetConfirmVisible, setIsResetConfirmVisible] = useState(false);
  const isRemoteHydratedRef = useRef(false);
  const skipNextRemoteSaveRef = useRef(false);
  const preserveLocalChangesUntilRef = useRef(0);
  const lastLocalMutationAtRef = useRef(0);
  const reportDate = new Date().toLocaleDateString('ru-RU');

  const applyTournamentState = (nextState) => {
    setTournamentName(nextState.tournamentName);
    setLocation(nextState.location);
    setCategory(nextState.category);
    setPlayoffDivision(normalizePlayoffDivision(nextState.playoffDivision));
    setPlayoffFinalRounds(normalizePlayoffFinalRounds(nextState.playoffFinalRounds));
    setHeadReferee(nextState.headReferee);
    setHeadSecretary(nextState.headSecretary);
    setPlayers(nextState.players);
    setPlayerDirectory(nextState.playerDirectory || []);
    setPlayerNumberBook(nextState.playerNumberBook);
    setScores(nextState.scores || {});
    setScoreSubmission(nextState.scoreSubmission || DEFAULT_SCORE_SUBMISSION);
    setBracket(nextState.bracket);
    setPlayoffStage(nextState.playoffStage);
    setPlayoffMode(nextState.playoffMode);
  };

  useEffect(() => {
    const nextState = {
      tournamentName,
      location,
      category,
      playoffDivision,
      playoffFinalRounds,
      headReferee,
      headSecretary,
      players,
      playerDirectory,
      playerNumberBook,
      scores,
      scoreSubmission,
      rounds: ROUNDS,
      bracket,
      playoffStage,
      playoffMode,
    };

    const isPristine =
      tournamentName === DEFAULT_STATE.tournamentName &&
      location === DEFAULT_STATE.location &&
      category === DEFAULT_STATE.category &&
      playoffDivision === DEFAULT_STATE.playoffDivision &&
      playoffFinalRounds.final12 === DEFAULT_STATE.playoffFinalRounds.final12 &&
      playoffFinalRounds.final34 === DEFAULT_STATE.playoffFinalRounds.final34 &&
      headReferee === DEFAULT_STATE.headReferee &&
      headSecretary === DEFAULT_STATE.headSecretary &&
      players.length === 0 &&
      playerDirectory.length === 0 &&
      Object.keys(playerNumberBook).length === 0 &&
      Object.keys(scores).length === 0 &&
      scoreSubmission.activeRound === DEFAULT_SCORE_SUBMISSION.activeRound &&
      scoreSubmission.entries.length === 0 &&
      playoffStage === DEFAULT_STATE.playoffStage &&
      playoffMode === DEFAULT_STATE.playoffMode &&
      isEmptyBracket(bracket);

    if (isPristine) {
      window.localStorage.removeItem(STORAGE_KEY);
      if (!skipNextRemoteSaveRef.current && isRemoteHydratedRef.current) {
        saveTournamentState(DEFAULT_STATE).catch(() => {});
      }
      skipNextRemoteSaveRef.current = false;
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));

    if (skipNextRemoteSaveRef.current) {
      skipNextRemoteSaveRef.current = false;
      return;
    }

    if (!isRemoteHydratedRef.current) {
      return;
    }

    const saveStartedAt = Date.now();
    preserveLocalChangesUntilRef.current = saveStartedAt + 15000;
    saveTournamentState(nextState)
      .then(() => {
        if (lastLocalMutationAtRef.current <= saveStartedAt) {
          preserveLocalChangesUntilRef.current = Date.now() + 1000;
        }
      })
      .catch(() => {});
  }, [tournamentName, location, category, playoffDivision, playoffFinalRounds, headReferee, headSecretary, players, playerDirectory, playerNumberBook, scores, scoreSubmission, bracket, playoffStage, playoffMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleAfterPrint = () => {
      setPrintTarget(null);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let isMounted = true;

    const syncFromServer = async () => {
      try {
        const nextState = parseStoredState(JSON.stringify(await fetchTournamentState()));
        if (!isMounted) {
          return;
        }

        if (Date.now() < preserveLocalChangesUntilRef.current) {
          isRemoteHydratedRef.current = true;
          return;
        }

        skipNextRemoteSaveRef.current = true;
        applyTournamentState(nextState);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
        isRemoteHydratedRef.current = true;
      } catch {
        if (!isMounted) {
          return;
        }

        isRemoteHydratedRef.current = true;
      }
    };

    syncFromServer();
    const intervalId = window.setInterval(syncFromServer, 3000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (players.length === 0) {
      return;
    }

    setPlayerDirectory((prev) => {
      const knownIds = new Set(prev.map((player) => player.id));
      const missingPlayers = players.filter((player) => !knownIds.has(player.id));

      if (missingPlayers.length === 0) {
        return prev;
      }

      return normalizePlayerDirectory([...prev, ...missingPlayers]);
    });
  }, [players]);

  const calculateTotal = (playerId) => {
    const playerScores = scores[playerId] || {};
    return Object.values(playerScores).reduce((sum, value) => sum + Number(value || 0), 0);
  };

  const orderedPlayers = sortPlayersByEntryNumber(players);
  const filteredOrderedPlayers = orderedPlayers.filter((player) => matchesPlayoffDivision(player, playoffDivision));
  const rankedPlayers = [...players].sort((a, b) => calculateTotal(b.id) - calculateTotal(a.id));
  const filteredRankedPlayers = rankedPlayers.filter((player) => matchesPlayoffDivision(player, playoffDivision));
  const playoffEligiblePlayers = filteredRankedPlayers;
  const journalSheetLayout = getJournalSheetLayout(filteredOrderedPlayers.length);
  const bracketStagesForSheet = getBracketStagesForSheet(bracket, playoffMode);
  const scoreSubmissionEntries = (scoreSubmission.entries || []).filter((entry) => {
    const player = players.find((item) => item.id === entry.playerId);
    return player ? matchesPlayoffDivision(player, playoffDivision) : playoffDivision === 'all';
  });
  const visibleStageKeys = getVisibleStageKeys(playoffMode);
  const playersPreviewCount = 3;
  const visiblePlayers = isPlayersListExpanded ? orderedPlayers : orderedPlayers.slice(0, playersPreviewCount);
  const hiddenPlayersCount = Math.max(orderedPlayers.length - playersPreviewCount, 0);
  const playerPositionMap = Object.fromEntries(orderedPlayers.map((player, index) => [player.id, index + 1]));
  const normalizedPlayerSearchQuery = playerSearchQuery.trim().toLocaleLowerCase();
  const filteredPlayerData = playerDirectory.filter((player) => {
    if (!matchesPlayoffDivision(player, playoffDivision)) {
      return false;
    }

    if (!normalizedPlayerSearchQuery) {
      return true;
    }

    const genderLabel = player.gender === 'male' ? 'эркек' : player.gender === 'female' ? 'аял' : '';

    return [player.name || '', player.phone || '', genderLabel]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedPlayerSearchQuery);
  });
  const malePlayersCount = filteredPlayerData.filter((player) => player.gender === 'male').length;
  const femalePlayersCount = filteredPlayerData.filter((player) => player.gender === 'female').length;
  const playoffStages = visibleStageKeys.map((stageKey) => ({
    stageKey,
    title: playoffStageTitles[stageKey] || stageMeta[stageKey].label,
    matches: bracket[stageKey],
    action:
      playoffStage === stageKey
        ? {
            label: stageKey === 'semiFinals' ? 'Финалга өтүү' : 'Алга',
            onClick: () => advance(stageKey),
          }
        : null,
  }));
  const hasFinalMatches = Boolean(bracket.final12 || bracket.final34 || playoffStage === 'final');
  const reportSheetLayout = getReportSheetLayout(playoffMode, bracketStagesForSheet, hasFinalMatches);

  const addPlayer = async () => {
    const name = newPlayerName.trim();
    if (!name) return;
    const phone = newPlayerPhone.trim();

    try {
      // Отправляем данные на сервер
      const nextState = parseStoredState(JSON.stringify(await registerTournamentPlayer({
        name,
        phone,
        gender: newPlayerGender,
      })));

      // Обновляем локальное состояние
      skipNextRemoteSaveRef.current = true;
      applyTournamentState(nextState);
      
      // Очищаем форму
      setNewPlayerName('');
      setNewPlayerPhone('');
      setNewPlayerGender('male');
    } catch (error) {
      // Показываем ошибку пользователю
      alert(`Оюнчу кошууда ката кетти: ${error.message || 'Белгисиз ката'}`);
      console.error('Failed to add player:', error);
    }
  };

  const removePlayer = (playerId) => {
    const removedPlayer = players.find((player) => player.id === playerId);

    setPlayers((prev) => prev.filter((player) => player.id !== playerId));
    if (removedPlayer) {
      const normalizedName = normalizePlayerName(removedPlayer.name || '');
      setPlayerNumberBook((prev) => {
        if (!normalizedName || !(normalizedName in prev)) {
          return prev;
        }

        const next = { ...prev };
        delete next[normalizedName];
        return next;
      });
    }

    setScores((prev) => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
  };

  const updateScore = (playerId, roundId, value) => {
    const sanitizedValue = sanitizeNonNegativeNumber(value);
    const score = Number.parseInt(sanitizedValue, 10);
    lastLocalMutationAtRef.current = Date.now();
    preserveLocalChangesUntilRef.current = Date.now() + 15000;
    setScores((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || {}),
        [roundId]: Number.isNaN(score) ? 0 : score,
      },
    }));
  };

  const clearPlayerDirectory = () => {
    setPlayerDirectory([]);
    setPlayerSearchQuery('');
  };

  const openScoreRound = (round) => {
    setScoreSubmission((prev) => ({
      ...prev,
      activeRound: round,
    }));
  };

  const openPlayoffFinalRound = (stageKey, round) => {
    setPlayoffFinalRounds((prev) => ({
      ...prev,
      [stageKey]: round,
    }));
  };

  const openNextPlayoffFinalRound = (stageKey) => {
    setPlayoffFinalRounds((prev) => ({
      ...prev,
      [stageKey]: Math.min(prev[stageKey] + 1, ROUNDS.length),
    }));
  };

  const openPreviousPlayoffFinalRound = (stageKey) => {
    setPlayoffFinalRounds((prev) => ({
      ...prev,
      [stageKey]: Math.max(prev[stageKey] - 1, 1),
    }));
  };

  const buildBracket = (limit) => {
    const seeds = seedOrders[limit];
    const selected = playoffEligiblePlayers.slice(0, limit);

    while (selected.length < limit) {
      selected.push({ id: `empty-${selected.length}`, name: 'Бош', isEmpty: true });
    }

    const nextBracket = createEmptyBracket();

    const stageKey = limit === 32 ? 'roundOf32' : limit === 16 ? 'roundOf16' : 'quarterFinals';
    for (let i = 0; i < limit; i += 2) {
      nextBracket[stageKey].push(createMatch(`${stageKey}-${i}`, selected[seeds[i]], selected[seeds[i + 1]]));
    }

    setBracket(nextBracket);
    setPlayoffStage(stageKey);
    setActiveTab('playoff');
  };

  const startPlayoff = () => {
    if (playoffEligiblePlayers.length < 2) return;
    buildBracket(playoffMode);
  };

  const resolveWinner = (match) => {
    if (match.s1 > match.s2) return match.p1;
    if (match.s2 > match.s1) return match.p2;
    if (!match.isFinal) {
      if (Number(match.shootOffS1) > Number(match.shootOffS2)) return match.p1;
      if (Number(match.shootOffS2) > Number(match.shootOffS1)) return match.p2;
      return null;
    }
    if (match.s1_bot > match.s2_bot) return match.p1;
    if (match.s2_bot > match.s1_bot) return match.p2;
    return null;
  };

  const updateMatch = (stage, matchId, playerNumber, value, roundIndex = 0, scoreType = 'main') => {
    setBracket((prev) => {
      const next = { ...prev };

      const applyUpdate = (match) => {
        const sanitizedValue = sanitizeNonNegativeNumber(value, 2);
        const parsedScore = Number.parseInt(sanitizedValue, 10);
        const score = Number.isNaN(parsedScore) ? 0 : parsedScore;

        if (match.isFinal) {
          const finalRoundLimit = playoffFinalRounds[stage] ?? DEFAULT_PLAYOFF_FINAL_ROUND;
          if (roundIndex >= finalRoundLimit) {
            return;
          }

          if (roundIndex < FINAL_PRIMARY_ROUNDS) {
            if (playerNumber === 1) {
              match.roundsP1[roundIndex] = score;
            } else {
              match.roundsP2[roundIndex] = score;
            }
          }

          match.s1 = match.roundsP1.slice(0, FINAL_PRIMARY_ROUNDS).reduce((sum, item) => sum + item, 0);
          match.s2 = match.roundsP2.slice(0, FINAL_PRIMARY_ROUNDS).reduce((sum, item) => sum + item, 0);

          for (let index = 0; index < FINAL_PRIMARY_ROUNDS; index += 1) {
            const left = Number(match.roundsP1[index] || 0);
            const right = Number(match.roundsP2[index] || 0);
            const bonusIndex = index + FINAL_PRIMARY_ROUNDS;

            if (left === 0 && right === 0) {
              match.roundsP1[bonusIndex] = 0;
              match.roundsP2[bonusIndex] = 0;
            } else if (left > right) {
              match.roundsP1[bonusIndex] = 2;
              match.roundsP2[bonusIndex] = 0;
            } else if (right > left) {
              match.roundsP1[bonusIndex] = 0;
              match.roundsP2[bonusIndex] = 2;
            } else {
              match.roundsP1[bonusIndex] = 1;
              match.roundsP2[bonusIndex] = 1;
            }
          }

          match.s1_bot = match.roundsP1.slice(FINAL_PRIMARY_ROUNDS).reduce((sum, item) => sum + item, 0);
          match.s2_bot = match.roundsP2.slice(FINAL_PRIMARY_ROUNDS).reduce((sum, item) => sum + item, 0);
        } else {
          if (scoreType === 'shootOff') {
            if (playerNumber === 1) {
              match.shootOffS1 = score;
              match.submittedShootOffP1 = score > 0 || value === '0';
            } else {
              match.shootOffS2 = score;
              match.submittedShootOffP2 = score > 0 || value === '0';
            }
          } else if (playerNumber === 1) {
            match.s1 = score;
            match.submittedP1 = score > 0 || value === '0';
          } else {
            match.s2 = score;
            match.submittedP2 = score > 0 || value === '0';
          }
        }

        match.winner = resolveWinner(match);
      };

      if (stage === 'final12' || stage === 'final34') {
        const updated = {
          ...next[stage],
          roundsP1: [...next[stage].roundsP1],
          roundsP2: [...next[stage].roundsP2],
        };
        applyUpdate(updated);
        next[stage] = updated;
        return next;
      }

      next[stage] = next[stage].map((match) => {
        if (match.id !== matchId) return match;

        const updated = {
          ...match,
          roundsP1: [...match.roundsP1],
          roundsP2: [...match.roundsP2],
        };
        applyUpdate(updated);
        return updated;
      });

      return next;
    });
  };

  const advance = (currentStage) => {
    const currentMatches = bracket[currentStage];
    if (!currentMatches.length || currentMatches.some((match) => !match.winner)) {
      return;
    }

    const winners = currentMatches.map((match) => match.winner);
    const nextMatches = [];

    if (currentStage === 'roundOf32') {
      for (let i = 0; i < winners.length; i += 2) {
        nextMatches.push(createMatch(`roundOf16-${i}`, winners[i], winners[i + 1]));
      }
      setBracket((prev) => ({ ...prev, roundOf16: nextMatches }));
      setPlayoffStage('roundOf16');
      return;
    }

    if (currentStage === 'roundOf16') {
      for (let i = 0; i < winners.length; i += 2) {
        nextMatches.push(createMatch(`quarterFinals-${i}`, winners[i], winners[i + 1]));
      }
      setBracket((prev) => ({ ...prev, quarterFinals: nextMatches }));
      setPlayoffStage('quarterFinals');
      return;
    }

    if (currentStage === 'quarterFinals') {
      for (let i = 0; i < winners.length; i += 2) {
        nextMatches.push(createMatch(`semiFinals-${i}`, winners[i], winners[i + 1]));
      }
      setBracket((prev) => ({ ...prev, semiFinals: nextMatches }));
      setPlayoffStage('semiFinals');
      return;
    }

    if (currentStage === 'semiFinals') {
      const losers = currentMatches.map((match) => (match.winner?.id === match.p1.id ? match.p2 : match.p1));
      setBracket((prev) => ({
        ...prev,
        final12: createMatch('final12', winners[0], winners[1], true),
        final34: createMatch('final34', losers[0], losers[1], true),
      }));
      setPlayoffStage('final');
    }
  };

  const finishTournament = () => {
    if (!bracket.final12?.winner || !bracket.final34?.winner) return;

    const silver = bracket.final12.winner.id === bracket.final12.p1.id ? bracket.final12.p2 : bracket.final12.p1;
    const fourth = bracket.final34.winner.id === bracket.final34.p1.id ? bracket.final34.p2 : bracket.final34.p1;

    setBracket((prev) => ({
      ...prev,
      winners: [bracket.final12.winner, silver, bracket.final34.winner, fourth],
    }));
    setActiveTab('report');
  };

  const resetTournament = () => {
    const preservedPlayerDirectory = [...playerDirectory];
    setTournamentName(DEFAULT_STATE.tournamentName);
    setLocation(DEFAULT_STATE.location);
    setCategory(DEFAULT_STATE.category);
    setPlayoffDivision(DEFAULT_STATE.playoffDivision);
    setHeadReferee(DEFAULT_STATE.headReferee);
    setHeadSecretary(DEFAULT_STATE.headSecretary);
    setPlayoffFinalRounds(DEFAULT_STATE.playoffFinalRounds);
    setPlayers([]);
    setPlayerDirectory(preservedPlayerDirectory);
    setPlayerNumberBook({});
    setScores({});
    setScoreSubmission(DEFAULT_SCORE_SUBMISSION);
    setBracket(createEmptyBracket());
    setPlayoffStage(DEFAULT_STATE.playoffStage);
    setPlayoffMode(DEFAULT_STATE.playoffMode);
    setActiveTab('players');
    setNewPlayerName('');
    setNewPlayerPhone('');
    setNewPlayerGender('male');
    setPlayerSearchQuery('');
    setIsMenuOpen(false);
    setIsPlayersListExpanded(false);
    setPrintTarget(null);
    setIsResetConfirmVisible(false);
  };

  const handlePrintSheet = (target) => {
    setPrintTarget(target);
    window.setTimeout(() => {
      window.print();
    }, 80);
  };

  return (
    <div className="app-shell">
      <div className="app-background" aria-hidden="true" />

      <header className="topbar">
        <div className="topbar__brand">
          <div className="brand-icon">
            <TargetIcon size={20} />
          </div>
          <div>
            <p className="eyebrow">Турнир башкаруу</p>
            <h1 className="brand-title">Жаа атуу платформасы</h1>
          </div>
        </div>

        <button
          type="button"
          className={`menu-toggle ${isMenuOpen ? 'menu-toggle--open' : ''}`}
          aria-label="Менюну ачуу"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <MenuIcon size={20} />
        </button>

        <div className={`topbar__actions ${isMenuOpen ? 'topbar__actions--open' : ''}`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setIsMenuOpen(false);
              }}
              className={`tab-button ${activeTab === tab.id ? 'tab-button--active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="page">
        {isResetConfirmVisible && (
          <section className="confirm-banner">
            <div>
              <p className="eyebrow">Ырастоо</p>
              <h3 className="confirm-banner__title">Баарын тазалоону чын эле каалайсызбы?</h3>
              <p className="confirm-banner__text">
                Катышуучулар, журнал, рейтинг, плей-офф жана колдонуучунун панели тазаланат. `Оюнчу тизмеси` гана сакталат.
              </p>
            </div>
            <div className="confirm-banner__actions">
              <button type="button" className="ghost-button" onClick={() => setIsResetConfirmVisible(false)}>
                Жок, артка кайтуу
              </button>
              <button type="button" className="primary-button" onClick={resetTournament}>
                Ооба, баарын тазалоо
              </button>
            </div>
          </section>
        )}

        <section className="hero-card">
          <div>
            <p className="eyebrow">Мобилдик версияга ылайыкталган</p>
            <h2 className="hero-card__title">{tournamentName}</h2>
            <p className="hero-card__text">
              Квалификацияны, торду жана акыркы отчетту бир колдонмодо жүргүзүңүз.
            </p>
          </div>

          <div className="hero-stats">
            <div className="stat-chip">
              <span className="stat-chip__label">Катышуучулар</span>
              <strong>{players.length}</strong>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">Топ</span>
              <strong>{playoffMode}</strong>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">Этап</span>
              <strong>{stageMeta[playoffStage]?.short || '—'}</strong>
            </div>
          </div>
        </section>

        {activeTab === 'players' && (
          <div className="layout-grid">
            <section className="panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Турнир маалыматы</p>
                  <h3 className="panel__title">Негизги жөндөөлөр</h3>
                </div>
                <button type="button" onClick={() => setIsResetConfirmVisible(true)} className="ghost-button">
                  <RefreshIcon size={16} /> Баарын тазалоо
                </button>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span className="field__label">Турнирдин аталышы</span>
                  <input className="field__control" value={tournamentName} onChange={(event) => setTournamentName(event.target.value)} />
                </label>

                <div className="field-row">
                  <label className="field">
                    <span className="field__label">Өткөрүлгөн жери</span>
                    <input className="field__control" value={location} onChange={(event) => setLocation(event.target.value)} />
                  </label>

                  <label className="field">
                    <span className="field__label">Категория</span>
                    <input className="field__control" value={category} onChange={(event) => setCategory(event.target.value)} />
                  </label>
                </div>

                <div className="field">
                  <span className="field__label">Плей-офф категориясы</span>
                  <div className="mode-switch">
                    {PLAYOFF_DIVISIONS.map((division) => (
                      <button
                        key={division.id}
                        type="button"
                        onClick={() => setPlayoffDivision(division.id)}
                        className={`mode-switch__button ${playoffDivision === division.id ? 'mode-switch__button--active' : ''}`}
                      >
                        {division.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field-row field-row--accent">
                  <label className="field">
                    <span className="field__label">Башкы калыс</span>
                    <input className="field__control field__control--bright" value={headReferee} onChange={(event) => setHeadReferee(event.target.value)} />
                  </label>

                  <label className="field">
                    <span className="field__label">Башкы катчы</span>
                    <input className="field__control field__control--bright" value={headSecretary} onChange={(event) => setHeadSecretary(event.target.value)} />
                  </label>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Тизме</p>
                  <h3 className="panel__title">Катышуучулар</h3>
                </div>
                <div className="panel__header-actions">
                  <div className="pill">
                    <UsersIcon size={16} />
                    {players.length}
                  </div>
                </div>
              </div>

              <div className="add-player-panel">
                <div className="add-player-grid">
                  <input
                    className="field__control"
                    placeholder="Катышуучунун аты-жөнү"
                    value={newPlayerName}
                    onChange={(event) => setNewPlayerName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') addPlayer();
                    }}
                  />
                  <input
                    className="field__control"
                    placeholder="+996"
                    value={newPlayerPhone}
                    onChange={(event) => setNewPlayerPhone(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') addPlayer();
                    }}
                  />
                </div>

                <div className="add-player-actions">
                  <div className="player-gender-switch">
                    <label className="player-gender-option">
                      <input
                        type="radio"
                        name="admin-player-gender"
                        value="male"
                        checked={newPlayerGender === 'male'}
                        onChange={(event) => setNewPlayerGender(event.target.value)}
                      />
                      <span>Эркек</span>
                    </label>

                    <label className="player-gender-option">
                      <input
                        type="radio"
                        name="admin-player-gender"
                        value="female"
                        checked={newPlayerGender === 'female'}
                        onChange={(event) => setNewPlayerGender(event.target.value)}
                      />
                      <span>Аял</span>
                    </label>
                  </div>

                  <button type="button" onClick={addPlayer} className="primary-button">
                    Кошуу
                  </button>
                </div>
              </div>

              <div className="players-list">
                {orderedPlayers.length === 0 && <div className="empty-state">Азырынча катышуучулар кошула элек.</div>}

                {visiblePlayers.map((player, index) => (
                  <article key={player.id} className="player-card">
                    <div className="player-card__content">
                      <p className="player-card__index">№ {playerPositionMap[player.id] ?? index + 1}</p>
                      <h4 className="player-card__name">{player.name}</h4>
                      <p className="player-card__meta">{player.phone || 'Телефон кошула элек'}</p>
                      <p className="player-card__meta">
                        {player.gender === 'male' ? 'Эркек' : player.gender === 'female' ? 'Аял' : 'Жынысы кошула элек'}
                      </p>
                    </div>
                    <button type="button" onClick={() => removePlayer(player.id)} className="icon-button" aria-label="Катышуучуну өчүрүү">
                      <TrashIcon size={16} />
                    </button>
                  </article>
                ))}
              </div>

              {hiddenPlayersCount > 0 && (
                <div className="players-list__toggle">
                  <button
                    type="button"
                    className="secondary-button secondary-button--auto"
                    onClick={() => setIsPlayersListExpanded((prev) => !prev)}
                  >
                    {isPlayersListExpanded ? 'Жашыруу' : `Дагы ${hiddenPlayersCount} катышуучуну көрсөтүү`}
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'journal' && (
          <section className="report-page">
            <div className="panel">
              <div className="panel__header panel__header--stack">
                <div>
                  <p className="eyebrow">Квалификация</p>
                  <h3 className="panel__title">Упай журналы</h3>
                </div>

                <div className="score-round-manager">
                  <div className="score-round-manager__summary">
                    <span className="pill">Ачык айлампа: {scoreSubmission.activeRound}</span>
                    <p className="score-round-manager__hint">
                      Оюнчулар азыр ушул айлампага гана упай жаза алышат. 2-айлампаны админ ачмайынча колдонуучулар киргизе албайт.
                    </p>
                  </div>

                  <div className="mode-switch">
                    {ROUNDS.map((round) => (
                      <button
                        key={round}
                        type="button"
                        className={`mode-switch__button ${scoreSubmission.activeRound === round ? 'mode-switch__button--active' : ''}`}
                        onClick={() => openScoreRound(round)}
                      >
                        Айлампа {round}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table className="score-table">
                  <thead>
                    <tr>
                      <th>Катышуучу</th>
                      {ROUNDS.map((round) => (
                        <th key={round}>Айлампа {round}</th>
                      ))}
                      <th>Жалпы</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrderedPlayers.map((player) => (
                      <tr key={player.id}>
                        <td className="score-table__name">{player.name}</td>
                        {ROUNDS.map((round) => (
                          <td key={round}>
                            <input
                              type="text"
                              className="table-input"
                              value={scores[player.id]?.[round] ?? ''}
                              onChange={(event) => updateScore(player.id, round, event.target.value)}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={2}
                            />
                          </td>
                        ))}
                        <td className="score-table__total">{calculateTotal(player.id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="submission-feed">
                <div className="panel__header">
                  <div>
                    <p className="eyebrow">Оюнчулардан келди</p>
                    <h3 className="panel__title">Акыркы жөнөтүлгөн упайлар</h3>
                  </div>
                  <div className="pill">{scoreSubmissionEntries.length}</div>
                </div>

                {scoreSubmissionEntries.length > 0 ? (
                  <div className="submission-feed__list">
                    {scoreSubmissionEntries.slice(0, 12).map((entry) => (
                      <article key={entry.id} className="submission-feed__item">
                        <div>
                          <strong>{entry.playerName}</strong>
                          <p className="submission-feed__meta">
                            Айлампа {entry.round} • {formatSubmissionTimestamp(entry.submittedAt)}
                          </p>
                        </div>
                        <div className="submission-feed__value">{entry.score}</div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">Оюнчулардан жөнөтүлгөн упай азырынча жок.</div>
                )}
              </div>
            </div>

            <div
              className={`report-sheet journal-sheet ${journalSheetLayout.className} ${
                printTarget === 'journal' ? 'print-sheet-active' : ''
              }`}
              id="official-journal"
              style={journalSheetLayout.style}
            >
              <div className="report-sheet__topline">
                <span>Расмий журнал</span>
                <span>Күнү: {reportDate}</span>
              </div>

              <div className="report-sheet__header report-sheet__header--compact">
                <h2>{tournamentName}</h2>
                <p className="report-sheet__meta">{location}</p>
                <p className="report-sheet__badge">{category}</p>
              </div>

              <section className="report-sheet__body">
                <div className="report-section-heading">
                  <span>Квалификациялык журнал</span>
                </div>

                <div className="journal-sheet__table-wrap">
                  <table className="journal-sheet__table">
                    <colgroup>
                      <col className="journal-sheet__col journal-sheet__col--index" />
                      <col className="journal-sheet__col journal-sheet__col--name" />
                      {ROUNDS.map((round) => (
                        <col key={round} className="journal-sheet__col journal-sheet__col--round" />
                      ))}
                      <col className="journal-sheet__col journal-sheet__col--total" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Катышуучу</th>
                        {ROUNDS.map((round) => (
                          <th key={round}>R{round}</th>
                        ))}
                        <th>Жалпы</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRankedPlayers.length > 0 ? (
                        filteredRankedPlayers.map((player, index) => (
                          <tr key={player.id}>
                            <td>{index + 1}</td>
                            <td className="journal-sheet__name">{player.name}</td>
                            {ROUNDS.map((round) => (
                              <td key={round}>{scores[player.id]?.[round] ?? 0}</td>
                            ))}
                            <td className="journal-sheet__total">{calculateTotal(player.id)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={ROUNDS.length + 3}>Катышуучулар жана упайлар азырынча киргизиле элек.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="report-sheet__footer">
                <div />
                <div className="report-signatures">
                  <div className="report-signature-row">
                    <span>Башкы калыс</span>
                    <strong>{headReferee || '________________'}</strong>
                  </div>
                  <div className="report-signature-row">
                    <span>Башкы катчы</span>
                    <strong>{headSecretary || '________________'}</strong>
                  </div>
                  <div className="report-stamp">МӨӨР</div>
                </div>
              </section>
            </div>

            <button type="button" onClick={() => handlePrintSheet('journal')} className="primary-button">
              <PrinterIcon size={18} /> Журналды PDF кылып чыгаруу
            </button>
          </section>
        )}

        {activeTab === 'playerData' && (
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Маалыматтар</p>
                <h3 className="panel__title">Оюнчулардын толук тизмеси</h3>
              </div>
              <div className="panel__header-actions">
                <div className="pill">Эркек: {malePlayersCount}</div>
                <div className="pill">Аял: {femalePlayersCount}</div>
                <button type="button" className="secondary-button" onClick={clearPlayerDirectory}>
                  Тизмени тазалоо
                </button>
                <div className="pill">
                  <UsersIcon size={16} />
                  {playerDirectory.length}
                </div>
              </div>
            </div>

            <div className="player-search">
              <input
                className="field__control"
                placeholder="Оюнчуну издөө: аты, телефон же жынысы"
                value={playerSearchQuery}
                onChange={(event) => setPlayerSearchQuery(event.target.value)}
              />
            </div>

            <div className="player-data-list">
              {filteredPlayerData.length > 0 ? (
                filteredPlayerData.map((player, index) => (
                  <article key={player.id} className="player-data-card">
                    <div className="player-data-card__top">
                      <div className="player-data-badge">{index + 1}</div>
                      <div className="player-data-card__title">
                        <h4>{player.name}</h4>
                        <p>Оюнчунун сакталган маалыматы</p>
                      </div>
                    </div>

                    <div className="player-data-card__grid">
                      <div className="player-data-field">
                        <span>Аты-жөнү</span>
                        <strong>{player.name}</strong>
                      </div>
                      <div className="player-data-field">
                        <span>Телефон номери</span>
                        <strong>{player.phone || 'Азырынча кошулган эмес'}</strong>
                      </div>
                      <div className="player-data-field">
                        <span>Жынысы</span>
                        <strong>
                          {player.gender === 'male'
                            ? 'Эркек'
                            : player.gender === 'female'
                              ? 'Аял'
                              : player.gender || 'Азырынча кошулган эмес'}
                        </strong>
                      </div>
                    </div>
                  </article>
                ))
              ) : filteredOrderedPlayers.length > 0 ? (
                <div className="empty-state">Мындай оюнчу табылган жок.</div>
              ) : (
                <div className="empty-state">Оюнчулардын сакталган тизмеси азырынча бош.</div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'rating' && (
          <section className="panel">
            <div className="panel__header panel__header--stack">
              <div>
                <p className="eyebrow">Тандоо</p>
                <h3 className="panel__title">Жыйынтык жана тандоо</h3>
                <p>
                  Плей-оффко азыр <strong>{PLAYOFF_DIVISIONS.find((division) => division.id === playoffDivision)?.label || 'Баары'}</strong>{' '}
                  категориясындагы {playoffEligiblePlayers.length} оюнчу кирет.
                </p>
              </div>

              <div className="mode-switch">
                {[32, 16, 8].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPlayoffMode(mode)}
                    className={`mode-switch__button ${playoffMode === mode ? 'mode-switch__button--active' : ''}`}
                  >
                    Топ-{mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="rating-list">
              {playoffEligiblePlayers.map((player, index) => (
                <article key={player.id} className={`rating-card ${index < playoffMode ? 'rating-card--selected' : ''}`}>
                  <div className="rating-card__left">
                    <div className="rating-badge">{index + 1}</div>
                    <div>
                      <h4>{player.name}</h4>
                      <p>{index < playoffMode ? 'Торго кирет' : 'Күтүү тизмеси'}</p>
                    </div>
                  </div>
                  <strong>{calculateTotal(player.id)}</strong>
                </article>
              ))}
            </div>

            <div className="panel__footer">
              <button type="button" onClick={startPlayoff} className="primary-button primary-button--wide">
                <MedalIcon size={18} /> Торду түзүү
              </button>
            </div>
          </section>
        )}

        {activeTab === 'playoff' && (
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Финалдык тор</p>
                <h3 className="panel__title">Беттеш тору</h3>
              </div>
            </div>

            <div
              className="bracket-grid"
              style={{
                '--bracket-column-count': playoffStages.length + (hasFinalMatches ? 1 : 0),
                '--bracket-column-width': playoffMode === 32 ? '248px' : playoffMode === 16 ? '264px' : '280px',
                '--bracket-column-gap': playoffMode === 32 ? '34px' : playoffMode === 16 ? '40px' : '48px',
              }}
            >
              {playoffStages.map((stage) => (
                <StageColumn
                  key={stage.stageKey}
                  stageKey={stage.stageKey}
                  title={stage.title}
                  playoffMode={playoffMode}
                  matches={stage.matches}
                  action={stage.action}
                  onMatchUpdate={(matchId, playerNumber, value, scoreType) => updateMatch(stage.stageKey, matchId, playerNumber, value, 0, scoreType)}
                />
              ))}

              {hasFinalMatches && (
                <div className="stage-column stage-column--final">
                  <div className="stage-column__header">
                    <p className="stage-column__eyebrow">Этап</p>
                    <h4>{playoffStageTitles.final12}</h4>
                  </div>

                  <div className="score-round-manager score-round-manager--compact">
                    <div className="score-round-manager__summary">
                      <span className="pill">А{playoffFinalRounds.final12}</span>
                    </div>

                    <div className="mode-switch mode-switch--compact">
                      {ROUNDS.slice(0, playoffFinalRounds.final12).map((round) => (
                        <button
                          key={`final12-round-${round}`}
                          type="button"
                          className={`mode-switch__button ${playoffFinalRounds.final12 === round ? 'mode-switch__button--active' : ''}`}
                          onClick={() => openPlayoffFinalRound('final12', round)}
                        >
                          А{round}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="mode-switch__button mode-switch__button--plus"
                        onClick={() => openPreviousPlayoffFinalRound('final12')}
                        disabled={playoffFinalRounds.final12 <= 1}
                        aria-label="Мурунку айлампа"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        className="mode-switch__button mode-switch__button--plus"
                        onClick={() => openNextPlayoffFinalRound('final12')}
                        disabled={playoffFinalRounds.final12 >= ROUNDS.length}
                        aria-label="Кийинки айлампа"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {bracket.final12 && (
                    <Match
                      match={bracket.final12}
                      isFinal
                      activeRound={playoffFinalRounds.final12}
                      onUpdate={(playerNumber, value, roundIndex) => updateMatch('final12', null, playerNumber, value, roundIndex)}
                    />
                  )}

                  <div className="score-round-manager score-round-manager--compact">
                    <div className="score-round-manager__summary">
                      <span className="pill">А{playoffFinalRounds.final34}</span>
                    </div>

                    <div className="mode-switch mode-switch--compact">
                      {ROUNDS.slice(0, playoffFinalRounds.final34).map((round) => (
                        <button
                          key={`final34-round-${round}`}
                          type="button"
                          className={`mode-switch__button ${playoffFinalRounds.final34 === round ? 'mode-switch__button--active' : ''}`}
                          onClick={() => openPlayoffFinalRound('final34', round)}
                        >
                          А{round}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="mode-switch__button mode-switch__button--plus"
                        onClick={() => openPreviousPlayoffFinalRound('final34')}
                        disabled={playoffFinalRounds.final34 <= 1}
                        aria-label="Мурунку айлампа 3-4"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        className="mode-switch__button mode-switch__button--plus"
                        onClick={() => openNextPlayoffFinalRound('final34')}
                        disabled={playoffFinalRounds.final34 >= ROUNDS.length}
                        aria-label="Кийинки айлампа 3-4"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {bracket.final34 && (
                    <Match
                      match={bracket.final34}
                      isFinal
                      activeRound={playoffFinalRounds.final34}
                      onUpdate={(playerNumber, value, roundIndex) => updateMatch('final34', null, playerNumber, value, roundIndex)}
                    />
                  )}

                  {playoffStage === 'final' && (
                    <button type="button" onClick={finishTournament} className="primary-button primary-button--wide">
                      <CheckUserIcon size={18} /> Турнирди аяктоо
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'report' && (
          <section className="report-page">
            <div
              className={`report-sheet ${reportSheetLayout.className} ${printTarget === 'report' ? 'print-sheet-active' : ''}`}
              id="official-report"
              style={reportSheetLayout.style}
            >
              <div className="report-sheet__topline">
                <span>Расмий отчет</span>
                <span>Күнү: {reportDate}</span>
              </div>

              <div className="report-sheet__header report-sheet__header--compact">
                <h2>{tournamentName}</h2>
                <p className="report-sheet__meta">{location}</p>
                <p className="report-sheet__badge">{category}</p>
              </div>

              <section className="report-sheet__body">
                <div className="report-section-heading">
                  <span>Турнирдик сетка</span>
                </div>
                <div className="report-bracket-layout">
                  <div className="report-bracket-layout__board">
                    {bracketStagesForSheet.length > 0 ? (
                      bracketStagesForSheet.map((stage, index) => (
                        <ReportStageColumn
                          key={stage.key}
                          title={stage.label}
                          stageIndex={index}
                          matches={stage.matches}
                          matchHeight={Number.parseInt(reportSheetLayout.style['--report-match-height'], 10)}
                        />
                      ))
                    ) : (
                      <div className="report-empty-state">Финалдык тордун маалыматы азырынча түзүлгөн жок.</div>
                    )}

                    <div className="report-bracket-layout__finals">
                      {bracket.final12 && <ReportPaperFinalBlock title="Финал 1-2-орунга" match={bracket.final12} />}
                      {bracket.final34 && <ReportPaperFinalBlock title="Финал 3-4-орунга" match={bracket.final34} />}
                    </div>
                  </div>
                </div>
              </section>

              <section className="report-sheet__footer">
                <div className="report-places">
                  <table className="report-places__table">
                    <tbody>
                      {bracket.winners.length > 0 ? (
                        bracket.winners.map((player, index) => (
                          <tr key={player.id} className={index === 0 ? 'report-places__row report-places__row--winner' : 'report-places__row'}>
                            <td>{index + 1}</td>
                            <td>{player.name}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="2">Жеңүүчүлөр азырынча аныктала элек.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="report-signatures">
                  <div className="report-signature-row">
                    <span>Башкы калыс</span>
                    <strong>{headReferee || '________________'}</strong>
                  </div>
                  <div className="report-signature-row">
                    <span>Башкы катчы</span>
                    <strong>{headSecretary || '________________'}</strong>
                  </div>
                  <div className="report-stamp">МӨӨР</div>
                </div>
              </section>
            </div>

            <button type="button" onClick={() => handlePrintSheet('report')} className="primary-button">
              <PrinterIcon size={18} /> Баяндаманы PDF кылып чыгаруу
            </button>
          </section>
        )}
      </main>
    </div>
  );
};

const StageColumn = ({ stageKey, title, playoffMode, matches, onMatchUpdate, action }) => {
  const roundIndex = getRoundIndex(playoffMode, stageKey);
  const roundFactor = 2 ** Math.max(roundIndex, 0);
  const slotCount = getStageMatchCount(playoffMode, stageKey);
  const slotStageClassName = `bracket-match-slot--${stageKey}`;
  const connectorStageClassName = `bracket-match-slot__connector--${stageKey}`;
  const editableConnectorClassName =
    stageKey === 'roundOf32'
      ? 'playoff-line-editable-round32'
      : stageKey === 'roundOf16'
        ? 'playoff-line-editable-round16'
        : stageKey === 'quarterFinals'
          ? 'playoff-line-editable-quarterfinals'
          : stageKey === 'semiFinals'
            ? 'playoff-line-editable-semifinals'
            : 'playoff-line-editable';
  const columnStyle = {
    '--stage-offset': `calc(((var(--bracket-match-height) + var(--bracket-match-gap)) * ${roundFactor - 1}) / 2)`,
    '--stage-gap': `calc((var(--bracket-match-height) + var(--bracket-match-gap)) * ${roundFactor} - var(--bracket-match-height))`,
  };
  const stageSlots = Array.from({ length: slotCount }, (_, matchIndex) => {
    const match = matches[matchIndex];
    if (match) {
      return {
        kind: 'match',
        key: match.id,
        match,
        seedNumbers: getSeedNumbersForMatch(playoffMode, stageKey, matchIndex),
      };
    }

    return {
      kind: 'placeholder',
      key: `${stageKey}-placeholder-${matchIndex}`,
    };
  });

  return (
    <div className="stage-column" style={columnStyle}>
      <div className="stage-column__header">
        <p className="stage-column__eyebrow">Этап</p>
        <h4>{title}</h4>
      </div>

      <div className="stage-column__matches">
        {stageSlots.length > 0 ? (
          stageSlots.map((slot) => (
            <div
              key={slot.key}
              className={`bracket-match-slot ${slotStageClassName} ${stageKey === 'semiFinals' ? 'bracket-match-slot--semiFinals' : ''}`}
            >
              {roundIndex > 0 && (
                <div
                  className={`bracket-match-slot__connector bracket-match-slot__connector--custom ${editableConnectorClassName} ${
                    connectorStageClassName
                  } ${
                    stageKey === 'semiFinals' ? 'bracket-match-slot__connector--semiFinals' : ''
                  }`}
                  aria-hidden="true"
                />
              )}
              {slot.kind === 'match' ? (
                <Match
                  match={slot.match}
                  seedNumbers={slot.seedNumbers}
                  onUpdate={(playerNumber, value, scoreType) => onMatchUpdate(slot.match.id, playerNumber, value, scoreType)}
                />
              ) : (
                <PlaceholderMatch />
              )}
            </div>
          ))
        ) : (
          <div className="empty-state empty-state--soft">Бул этап үчүн жуптар азырынча түзүлгөн жок.</div>
        )}
      </div>

      {action && (
        <button type="button" onClick={action.onClick} className="secondary-button">
          {action.label}
        </button>
      )}
    </div>
  );
};

const PlaceholderMatch = () => (
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
);

const Match = ({ match, seedNumbers, onUpdate, activeRound = FINAL_PRIMARY_ROUNDS }) => {
  if (!match) return null;
  const showShootOff = isStandardPlayoffShootOffActive(match);

  if (match.isFinal) {
    return (
      <article className={`match-card match-card--final ${match.winner ? 'match-card--winner' : ''}`}>
        <FinalPlayer
          playerNumber={1}
          rounds={match.roundsP1}
          name={match.p1.name}
          mainScore={match.s1}
          extraScore={match.s1_bot}
          isWinner={match.winner?.id === match.p1.id}
          activeRound={activeRound}
          onUpdate={onUpdate}
        />
        <div className="match-divider" />
        <FinalPlayer
          playerNumber={2}
          rounds={match.roundsP2}
          name={match.p2.name}
          mainScore={match.s2}
          extraScore={match.s2_bot}
          isWinner={match.winner?.id === match.p2.id}
          activeRound={activeRound}
          onUpdate={onUpdate}
        />
      </article>
    );
  }

  return (
    <article className={`playoff-card ${match.winner ? 'playoff-card--winner' : ''}`}>
      <div className={`playoff-row ${match.winner?.id === match.p1.id ? 'playoff-row--winner' : ''}`}>
        <div className="playoff-row__identity">
          {seedNumbers && <span className="match-player__seed">{seedNumbers[0]}</span>}
          <span className="playoff-row__name">{match.p1.name}</span>
        </div>
        <div className="playoff-score-stack">
          <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} className="playoff-score-input" value={match.s1 ?? ''} onChange={(event) => onUpdate(1, event.target.value, 'main')} />
          {showShootOff && (
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              className="playoff-score-input playoff-score-input--shootout"
              value={match.shootOffS1 ?? ''}
              onChange={(event) => onUpdate(1, event.target.value, 'shootOff')}
            />
          )}
        </div>
      </div>
      <div className={`playoff-row playoff-row--divided ${match.winner?.id === match.p2.id ? 'playoff-row--winner' : ''}`}>
        <div className="playoff-row__identity">
          {seedNumbers && <span className="match-player__seed">{seedNumbers[1]}</span>}
          <span className="playoff-row__name">{match.p2.name}</span>
        </div>
        <div className="playoff-score-stack">
          <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} className="playoff-score-input" value={match.s2 ?? ''} onChange={(event) => onUpdate(2, event.target.value, 'main')} />
          {showShootOff && (
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              className="playoff-score-input playoff-score-input--shootout"
              value={match.shootOffS2 ?? ''}
              onChange={(event) => onUpdate(2, event.target.value, 'shootOff')}
            />
          )}
        </div>
      </div>
    </article>
  );
};

const FinalPlayer = ({ playerNumber, rounds, name, mainScore, extraScore, isWinner, onUpdate, activeRound }) => (
  <div className={`final-player ${isWinner ? 'final-player--winner' : ''}`}>
    <div className="final-rounds-group">
      <div className="final-rounds-group__label">Негизги</div>
      <div className="final-rounds">
        {rounds.slice(0, activeRound).map((value, index) => (
          <input
            key={index}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            className="mini-input"
            value={value ?? ''}
            onChange={(event) => onUpdate(playerNumber, event.target.value, index)}
          />
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
        {rounds.slice(FINAL_PRIMARY_ROUNDS, FINAL_PRIMARY_ROUNDS + activeRound).map((value, index) => (
          <input
            key={index + FINAL_PRIMARY_ROUNDS}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="mini-input mini-input--accent"
            value={value ?? ''}
            readOnly
            tabIndex={-1}
          />
        ))}
      </div>
    </div>
  </div>
);

const ReportStageColumn = ({ title, stageIndex, matches, matchHeight = 36 }) => {
  const roundFactor = 2 ** Math.max(stageIndex, 0);
  const baseGap = 10;
  const stageOffset = ((matchHeight + baseGap) * (roundFactor - 1)) / 2;
  const stageGap = (matchHeight + baseGap) * roundFactor - matchHeight;
  const connectorSpan = (matchHeight + baseGap) * (roundFactor / 2);
  const connectorGap = 6;
  const connectorForwardOffset = 70;
  const connectorRailLeft = -1 + connectorForwardOffset;
  const connectorLineLeft = 2 + connectorForwardOffset;
  const connectorLineWidth = 10;
  const connectorBranchWidth = 28;
  const connectorRailHeight = Math.max(connectorSpan - connectorGap, 0);
  const connectorRailTop = `calc(50% - ${connectorSpan / 2}px + ${connectorGap / 2}px)`;

  return (
    <article className="report-stage-column">
      <div className="report-stage-column__title">
        <div>{title}</div>
      </div>

      <div className="report-stage-column__matches" style={{ paddingTop: `${stageOffset}px`, gap: `${stageGap}px` }}>
        {matches.map((match, index) => (
          <div key={match.id || index} className="report-stage-column__slot" style={{ minHeight: `${matchHeight}px` }}>
            {stageIndex > 0 && (
              <>
                <div
                  className="report-stage-column__connector-line"
                  style={{ left: `${connectorLineLeft}px`, top: '50%', width: `${connectorLineWidth}px` }}
                />
                <div
                  className="report-stage-column__connector-rail"
                  style={{
                    left: `${connectorRailLeft}px`,
                    top: connectorRailTop,
                    height: `${connectorRailHeight}px`,
                  }}
                />
                <div
                  className="report-stage-column__connector-branch report-stage-column__connector-branch--top"
                  style={{
                    left: `${connectorRailLeft - connectorBranchWidth + 1}px`,
                    top: connectorRailTop,
                    width: `${connectorBranchWidth}px`,
                  }}
                />
                <div
                  className="report-stage-column__connector-branch report-stage-column__connector-branch--bottom"
                  style={{
                    left: `${connectorRailLeft - connectorBranchWidth + 1}px`,
                    top: `calc(${connectorRailTop} + ${connectorRailHeight}px)`,
                    width: `${connectorBranchWidth}px`,
                  }}
                />
              </>
            )}
            <ReportMatchCard match={match} />
          </div>
        ))}
      </div>
    </article>
  );
};

const ReportMatchCard = ({ match }) => (
  <article className="report-match-card">
    <div className="report-match-card__row">
      <div className="report-match-card__name">{match.p1.name}</div>
      <div className="report-match-card__score">{match.s1}</div>
    </div>
    <div className="report-match-card__row report-match-card__row--divided">
      <div className="report-match-card__name">{match.p2.name}</div>
      <div className="report-match-card__score">{match.s2}</div>
    </div>
  </article>
);

const REPORT_FINAL_COLUMN_COUNT = 6;

const ReportPaperFinalBlock = ({ title, match }) => (
  <article className="report-final-block">
    <div className="report-final-block__title">
      {title}
    </div>
    <div className="report-final-block__legend">
      <span>Негизги</span>
      <span>Кошумча</span>
    </div>
    <div className="report-final-block__body">
      <ReportPaperFinalRow
        name={match.p1.name}
        rounds={match.roundsP1}
        isWinner={match.winner?.id === match.p1.id}
      />
      <ReportPaperFinalRow
        name={match.p2.name}
        rounds={match.roundsP2}
        isWinner={match.winner?.id === match.p2.id}
      />
    </div>
  </article>
);

const ReportPaperFinalRow = ({ name, rounds, isWinner }) => {
  const primaryRounds = rounds.slice(0, REPORT_FINAL_COLUMN_COUNT);
  const extraRounds = rounds.slice(FINAL_PRIMARY_ROUNDS, FINAL_PRIMARY_ROUNDS + REPORT_FINAL_COLUMN_COUNT);

  return (
    <div className={`report-final-row ${isWinner ? 'report-final-row--winner' : ''}`}>
      <div className="report-final-row__scores report-final-row__scores--top" style={{ gridTemplateColumns: `repeat(${REPORT_FINAL_COLUMN_COUNT}, minmax(0, 1fr))` }}>
        {primaryRounds.map((value, index) => (
          <div key={index} className="report-final-row__cell">
            {value}
          </div>
        ))}
      </div>
      <div className="report-final-row__name">
        {name}
      </div>
      <div className="report-final-row__scores" style={{ gridTemplateColumns: `repeat(${REPORT_FINAL_COLUMN_COUNT}, minmax(0, 1fr))` }}>
        {extraRounds.map((value, index) => (
          <div key={index} className="report-final-row__cell">
            {value}
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
