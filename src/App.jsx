import { useEffect, useState } from 'react';
import './App.css';

const STORAGE_KEY = 'archery_v32_final_data_v5';
const ROUNDS = [1, 2, 3, 4, 5, 6];
const FINAL_PRIMARY_ROUNDS = 6;
const FINAL_ROUNDS_COUNT = 12;
const EMPTY_BRACKET = {
  roundOf32: [],
  roundOf16: [],
  quarterFinals: [],
  semiFinals: [],
  final12: null,
  final34: null,
  winners: [],
};

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
};

const seedOrders = {
  32: [0, 31, 15, 16, 7, 24, 8, 23, 4, 27, 11, 20, 3, 28, 12, 19, 1, 30, 14, 17, 6, 25, 9, 22, 5, 26, 10, 21, 2, 29, 13, 18],
  16: [0, 15, 7, 8, 4, 11, 3, 12, 2, 13, 5, 10, 6, 9, 1, 14],
  8: [0, 7, 3, 4, 1, 6, 2, 5],
};

const tabs = [
  { id: 'players', label: 'Катышуучулар' },
  { id: 'journal', label: 'Журнал' },
  { id: 'rating', label: 'Рейтинг' },
  { id: 'playoff', label: 'Тор' },
  { id: 'report', label: 'Отчет' },
];

const stageMeta = {
  roundOf32: { label: '1/16 финал', short: '1/16' },
  roundOf16: { label: '1/8 финал', short: '1/8' },
  quarterFinals: { label: 'Чейрек финал', short: '1/4' },
  semiFinals: { label: 'Жарым финал', short: '1/2' },
  final12: { label: 'Финал', short: 'Финал' },
  final34: { label: '3-орун үчүн беттеш', short: '3-орун' },
};

const createMatch = (id, p1, p2, isFinal = false) => ({
  id,
  p1,
  p2,
  s1: 0,
  s2: 0,
  s1_bot: 0,
  s2_bot: 0,
  winner: null,
  isFinal,
  roundsP1: Array(FINAL_ROUNDS_COUNT).fill(0),
  roundsP2: Array(FINAL_ROUNDS_COUNT).fill(0),
});

const loadInitialState = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_STATE;
    }

    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      bracket: parsed.bracket ? { ...EMPTY_BRACKET, ...parsed.bracket } : EMPTY_BRACKET,
    };
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

const getWinnerName = (match) => match.winner?.name || 'Аныктала элек';

const getBracketStagesForSheet = (bracket, playoffMode) => {
  const keys = [];

  if (playoffMode === 32) keys.push('roundOf32');
  if (playoffMode >= 16) keys.push('roundOf16');
  keys.push('quarterFinals', 'semiFinals');

  return keys
    .map((key) => ({
      key,
      ...stageMeta[key],
      matches: normalizeMatchList(key, bracket),
    }))
    .filter((stage) => stage.matches.length > 0);
};

const App = () => {
  const initialState = loadInitialState();

  const [tournamentName, setTournamentName] = useState(initialState.tournamentName);
  const [location, setLocation] = useState(initialState.location);
  const [category, setCategory] = useState(initialState.category);
  const [headReferee, setHeadReferee] = useState(initialState.headReferee);
  const [headSecretary, setHeadSecretary] = useState(initialState.headSecretary);
  const [players, setPlayers] = useState(initialState.players);
  const [scores, setScores] = useState(initialState.scores);
  const [activeTab, setActiveTab] = useState('players');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [playoffMode, setPlayoffMode] = useState(initialState.playoffMode);
  const [playoffStage, setPlayoffStage] = useState(initialState.playoffStage);
  const [bracket, setBracket] = useState(initialState.bracket);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tournamentName,
        location,
        category,
        headReferee,
        headSecretary,
        players,
        scores,
        rounds: ROUNDS,
        bracket,
        playoffStage,
        playoffMode,
      }),
    );
  }, [tournamentName, location, category, headReferee, headSecretary, players, scores, bracket, playoffStage, playoffMode]);

  const calculateTotal = (playerId) => {
    const playerScores = scores[playerId] || {};
    return Object.values(playerScores).reduce((sum, value) => sum + Number(value || 0), 0);
  };

  const rankedPlayers = [...players].sort((a, b) => calculateTotal(b.id) - calculateTotal(a.id));
  const bracketStagesForSheet = getBracketStagesForSheet(bracket, playoffMode);

  const addPlayer = () => {
    const name = newPlayerName.trim();
    if (!name) return;

    setPlayers((prev) => [...prev, { id: Date.now().toString(), name }]);
    setNewPlayerName('');
  };

  const removePlayer = (playerId) => {
    setPlayers((prev) => prev.filter((player) => player.id !== playerId));
    setScores((prev) => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
  };

  const updateScore = (playerId, roundId, value) => {
    const score = Number.parseInt(value, 10);
    setScores((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || {}),
        [roundId]: Number.isNaN(score) ? 0 : score,
      },
    }));
  };

  const buildBracket = (limit) => {
    const seeds = seedOrders[limit];
    const selected = rankedPlayers.slice(0, limit);

    while (selected.length < limit) {
      selected.push({ id: `empty-${selected.length}`, name: 'Бош', isEmpty: true });
    }

    const nextBracket = {
      roundOf32: [],
      roundOf16: [],
      quarterFinals: [],
      semiFinals: [],
      final12: null,
      final34: null,
      winners: [],
    };

    const stageKey = limit === 32 ? 'roundOf32' : limit === 16 ? 'roundOf16' : 'quarterFinals';
    for (let i = 0; i < limit; i += 2) {
      nextBracket[stageKey].push(createMatch(`${stageKey}-${i}`, selected[seeds[i]], selected[seeds[i + 1]]));
    }

    setBracket(nextBracket);
    setPlayoffStage(stageKey);
    setActiveTab('playoff');
  };

  const startPlayoff = () => {
    if (rankedPlayers.length < 2) return;
    buildBracket(playoffMode);
  };

  const resolveWinner = (match) => {
    if (match.s1 > match.s2) return match.p1;
    if (match.s2 > match.s1) return match.p2;
    if (match.s1_bot > match.s2_bot) return match.p1;
    if (match.s2_bot > match.s1_bot) return match.p2;
    return null;
  };

  const updateMatch = (stage, matchId, playerNumber, value, roundIndex = 0) => {
    setBracket((prev) => {
      const next = { ...prev };

      const applyUpdate = (match) => {
        const score = Math.max(0, Number.parseInt(value, 10) || 0);

        if (match.isFinal) {
          const normalized = roundIndex >= FINAL_PRIMARY_ROUNDS ? Math.min(score, 2) : score;

          if (playerNumber === 1) {
            match.roundsP1[roundIndex] = normalized;
            match.s1 = match.roundsP1.slice(0, FINAL_PRIMARY_ROUNDS).reduce((sum, item) => sum + item, 0);
            match.s1_bot = match.roundsP1.slice(FINAL_PRIMARY_ROUNDS).reduce((sum, item) => sum + item, 0);
          } else {
            match.roundsP2[roundIndex] = normalized;
            match.s2 = match.roundsP2.slice(0, FINAL_PRIMARY_ROUNDS).reduce((sum, item) => sum + item, 0);
            match.s2_bot = match.roundsP2.slice(FINAL_PRIMARY_ROUNDS).reduce((sum, item) => sum + item, 0);
          }
        } else if (playerNumber === 1) {
          match.s1 = score;
        } else {
          match.s2 = score;
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
    if (!window.confirm('Турнирди тазалап, кайра баштайбызбы?')) return;

    setPlayers([]);
    setScores({});
    setBracket(EMPTY_BRACKET);
    setPlayoffStage('none');
    setPlayoffMode(16);
    setActiveTab('players');
    window.localStorage.removeItem(STORAGE_KEY);
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
            <p className="eyebrow">Tournament Manager</p>
            <h1 className="brand-title">Жаа атуу платформасы</h1>
          </div>
        </div>

        <button
          type="button"
          className="menu-toggle"
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
                <button type="button" onClick={resetTournament} className="ghost-button">
                  <RefreshIcon size={16} /> Тазалоо
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
                <div className="pill">
                  <UsersIcon size={16} />
                  {players.length}
                </div>
              </div>

              <div className="add-player">
                <input
                  className="field__control"
                  placeholder="Катышуучунун аты-жөнү"
                  value={newPlayerName}
                  onChange={(event) => setNewPlayerName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addPlayer();
                  }}
                />
                <button type="button" onClick={addPlayer} className="primary-button">
                  Кошуу
                </button>
              </div>

              <div className="players-list">
                {players.length === 0 && <div className="empty-state">Азырынча катышуучулар кошула элек.</div>}

                {players.map((player, index) => (
                  <article key={player.id} className="player-card">
                    <div>
                      <p className="player-card__index">{index + 1}-номер</p>
                      <h4 className="player-card__name">{player.name}</h4>
                    </div>
                    <button type="button" onClick={() => removePlayer(player.id)} className="icon-button" aria-label="Катышуучуну өчүрүү">
                      <TrashIcon size={16} />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'journal' && (
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Квалификация</p>
                <h3 className="panel__title">Упай журналы</h3>
              </div>
            </div>

            <div className="table-wrap">
              <table className="score-table">
                <thead>
                  <tr>
                    <th>Катышуучу</th>
                    {ROUNDS.map((round) => (
                      <th key={round}>Раунд {round}</th>
                    ))}
                    <th>Жалпы</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <tr key={player.id}>
                      <td className="score-table__name">{player.name}</td>
                      {ROUNDS.map((round) => (
                        <td key={round}>
                          <input
                            type="number"
                            className="table-input"
                            value={scores[player.id]?.[round] ?? ''}
                            onChange={(event) => updateScore(player.id, round, event.target.value)}
                          />
                        </td>
                      ))}
                      <td className="score-table__total">{calculateTotal(player.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'rating' && (
          <section className="panel">
            <div className="panel__header panel__header--stack">
              <div>
                <p className="eyebrow">Тандоо</p>
                <h3 className="panel__title">Рейтинг жана тандоо</h3>
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
              {rankedPlayers.map((player, index) => (
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
                <p className="eyebrow">Плей-офф</p>
                <h3 className="panel__title">Беттеш тору</h3>
              </div>
            </div>

            <div className="bracket-grid">
              {playoffMode === 32 && (
                <StageColumn
                  title="1/16 финал"
                  matches={bracket.roundOf32}
                  onMatchUpdate={(matchId, playerNumber, value) => updateMatch('roundOf32', matchId, playerNumber, value)}
                  action={playoffStage === 'roundOf32' ? { label: 'Алга', onClick: () => advance('roundOf32') } : null}
                />
              )}

              {playoffMode >= 16 && (
                <StageColumn
                  title="1/8 финал"
                  matches={bracket.roundOf16}
                  onMatchUpdate={(matchId, playerNumber, value) => updateMatch('roundOf16', matchId, playerNumber, value)}
                  action={playoffStage === 'roundOf16' ? { label: 'Алга', onClick: () => advance('roundOf16') } : null}
                />
              )}

              <StageColumn
                title="Чейрек финал"
                matches={bracket.quarterFinals}
                onMatchUpdate={(matchId, playerNumber, value) => updateMatch('quarterFinals', matchId, playerNumber, value)}
                action={playoffStage === 'quarterFinals' ? { label: 'Алга', onClick: () => advance('quarterFinals') } : null}
              />

              <StageColumn
                title="Жарым финал"
                matches={bracket.semiFinals}
                onMatchUpdate={(matchId, playerNumber, value) => updateMatch('semiFinals', matchId, playerNumber, value)}
                action={playoffStage === 'semiFinals' ? { label: 'Финалга өтүү', onClick: () => advance('semiFinals') } : null}
              />

              <div className="stage-column stage-column--final">
                <div className="stage-column__header">
                  <p className="stage-column__eyebrow">Чечүүчү оюндар</p>
                  <h4>Финал</h4>
                </div>

                {bracket.final12 && (
                  <Match
                    match={bracket.final12}
                    isFinal
                    onUpdate={(playerNumber, value, roundIndex) => updateMatch('final12', null, playerNumber, value, roundIndex)}
                  />
                )}

                {bracket.final34 && (
                  <Match
                    match={bracket.final34}
                    isFinal
                    onUpdate={(playerNumber, value, roundIndex) => updateMatch('final34', null, playerNumber, value, roundIndex)}
                  />
                )}

                {playoffStage === 'final' && (
                  <button type="button" onClick={finishTournament} className="primary-button primary-button--wide">
                    <CheckUserIcon size={18} /> Турнирди аяктоо
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'report' && (
          <section className="report-page">
            <div className="report-sheet" id="official-report">
              <div className="report-sheet__header report-sheet__header--compact">
                <p className="eyebrow">Расмий отчет</p>
                <h2>{tournamentName}</h2>
                <p className="report-sheet__meta">{location}</p>
                <p className="report-sheet__badge">{category}</p>
              </div>

              <section className="report-sheet__body">
                <div className="report-bracket-board">
                  {bracketStagesForSheet.map((stage) => (
                    <article key={stage.key} className="report-bracket-column">
                      <div className="report-bracket-column__title">{stage.label}</div>
                      <div className="report-bracket-column__list">
                        {stage.matches.map((match, index) => (
                          <ReportMatchBox key={match.id} match={match} index={index} />
                        ))}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="report-finals-panel">
                  {bracket.final12 && <ReportFinalTable title="Финал 1-2-орунга" match={bracket.final12} />}
                  {bracket.final34 && <ReportFinalTable title="Финал 3-4-орунга" match={bracket.final34} />}
                </div>
              </section>

              <section className="report-sheet__footer">
                <div className="report-places">
                  <h3>Жыйынтык орундар</h3>
                  <table className="report-places__table">
                    <tbody>
                      {bracket.winners.length > 0 ? (
                        bracket.winners.map((player, index) => (
                          <tr key={player.id}>
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

            <button type="button" onClick={() => window.print()} className="primary-button">
              <PrinterIcon size={18} /> Басып чыгаруу
            </button>
          </section>
        )}
      </main>
    </div>
  );
};

const ReportMatchBox = ({ match, index }) => (
  <div className="report-match-box">
    <div className="report-match-box__seed">{index + 1}.</div>
    <div className="report-match-box__rows">
      <div className="report-match-box__row">
        <span>{match.p1.name}</span>
        <strong>{match.s1}</strong>
      </div>
      <div className="report-match-box__row">
        <span>{match.p2.name}</span>
        <strong>{match.s2}</strong>
      </div>
      <div className="report-match-box__winner">
        Жеңүүчү: {getWinnerName(match)}
      </div>
    </div>
  </div>
);

const ReportFinalTable = ({ title, match }) => (
  <div className="report-final-table">
    <div className="report-final-table__title">{title}</div>
    <table className="report-final-table__grid">
      <tbody>
        <tr>
          {match.roundsP1.map((score, index) => (
            <td key={`top-${index}`}>{score}</td>
          ))}
        </tr>
        <tr>
          <td colSpan={FINAL_ROUNDS_COUNT} className="report-final-table__name">{match.p1.name}</td>
        </tr>
        <tr>
          {match.roundsP2.map((score, index) => (
            <td key={`bottom-${index}`}>{score}</td>
          ))}
        </tr>
        <tr>
          <td colSpan={FINAL_ROUNDS_COUNT} className="report-final-table__name">{match.p2.name}</td>
        </tr>
      </tbody>
    </table>
  </div>
);

const StageColumn = ({ title, matches, onMatchUpdate, action }) => (
  <div className="stage-column">
    <div className="stage-column__header">
      <p className="stage-column__eyebrow">Этап</p>
      <h4>{title}</h4>
    </div>

    <div className="stage-column__matches">
      {matches.length > 0 ? (
        matches.map((match) => (
          <Match key={match.id} match={match} onUpdate={(playerNumber, value) => onMatchUpdate(match.id, playerNumber, value)} />
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

const Match = ({ match, onUpdate }) => {
  if (!match) return null;

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
          onUpdate={onUpdate}
        />
      </article>
    );
  }

  return (
    <article className={`match-card ${match.winner ? 'match-card--winner' : ''}`}>
      <div className="match-player">
        <span className="match-player__name">{match.p1.name}</span>
        <input type="number" className="match-input" value={match.s1 || ''} onChange={(event) => onUpdate(1, event.target.value)} />
      </div>
      <div className="match-player">
        <span className="match-player__name">{match.p2.name}</span>
        <input type="number" className="match-input" value={match.s2 || ''} onChange={(event) => onUpdate(2, event.target.value)} />
      </div>
    </article>
  );
};

const FinalPlayer = ({ playerNumber, rounds, name, mainScore, extraScore, isWinner, onUpdate }) => (
  <div className={`final-player ${isWinner ? 'final-player--winner' : ''}`}>
    <div className="final-rounds-group">
      <div className="final-rounds-group__label">Негизги</div>
      <div className="final-rounds">
        {rounds.slice(0, FINAL_PRIMARY_ROUNDS).map((value, index) => (
          <input
            key={index}
            type="number"
            className="mini-input"
            value={value || ''}
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
        {rounds.slice(FINAL_PRIMARY_ROUNDS).map((value, index) => (
          <input
            key={index + FINAL_PRIMARY_ROUNDS}
            type="number"
            className="mini-input mini-input--accent"
            value={value || ''}
            onChange={(event) => onUpdate(playerNumber, event.target.value, index + FINAL_PRIMARY_ROUNDS)}
          />
        ))}
      </div>
    </div>
  </div>
);

export default App;
