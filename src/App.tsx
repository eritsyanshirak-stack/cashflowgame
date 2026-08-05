import { useEffect, useRef, useState } from 'react'
import './App.css'
import './premium.css'
import './tabletop.css'
import { board, businesses, developments, difficultySettings, professions } from './game/content/content'
import type { Decision, Difficulty, GameCommand, GameState, MonthlyReport, Player, SkillId } from './game/domain/types'
import { assessLoan, assetCashflow, assetLiquidationProceeds, assetMarketValue, availableCollateral, competitionStandings, freedomChecklist, freedomProgress, loanPayment, monthlyCashflow, monthlyExpenses, monthlyStockDividends, netWorth, passiveIncome, pledgedLoanForAsset, stockMarketValue, totalDebt } from './game/systems/economy'
import { hasSave } from './game/persistence/save'
import { useGameStore } from './store/gameStore'
import { developmentCost, nextPlayerLevelXp, nextSkillXp, playerLevel, rankName, skillDefinitions, skillLevel, trainingCost } from './game/systems/progression'
import { AssetSalesCore, BuyerOfferModal, DealFinancingCore, GlobalEventBanner, MarginCallModal, V14DecisionContent } from './V14UI'
import { DealProfilePanel, EventChainPanel, PortfolioSynergyPanel, RivalIntentPanel, SellerCounterPanel, SpecializationModal } from './V15UI'
import { AssetInvestmentPanel } from './V16UI'
import { calculateStockSale, STOCK_COMMISSION_RATE } from './game/systems/stockSale'
import { dealProjectedOperatingIncome } from './game/systems/v15'

const money = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`
const TUTORIAL_KEY = 'vyhod-iz-kruga-tutorial-v1'

const tutorialSteps = [
  { icon: '◎', eyebrow: 'ЦЕЛЬ ПАРТИИ', title: 'Выйди из денежного круга', text: 'Побеждает не тот, у кого больше денег на руках. Пассивный доход должен покрыть расходы, а в запасе нужен резерв на три месяца.' },
  { icon: '⚄', eyebrow: 'КАЖДЫЙ ХОД', title: 'Бросай и принимай решение', text: 'Клетки дают сделки, расходы, рынок, банк и развитие. Любое решение меняет твою экономику, а соперники ходят следом.' },
  { icon: '◆', eyebrow: 'ГЛАВНЫЙ ПРИНЦИП', title: 'Покупай денежный поток', text: 'Смотри на чистый доход бизнеса после расходов и долгов. Дорогой актив без положительного потока не приближает к свободе.' },
  { icon: '♟', eyebrow: 'ГОНКА', title: 'Соперники могут победить раньше', text: 'Следи за вкладкой "Гонка", не перегружай себя кредитами и оставляй запас денег на непредвиденные расходы.' },
] as const

function SetupScreen() {
  const [professionId, setProfessionId] = useState('trainer')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [botCount, setBotCount] = useState(2)
  const dispatch = useGameStore((store) => store.dispatch)
  const continueGame = useGameStore((store) => store.continueGame)
  const profession = professions.find((item) => item.id === professionId) ?? professions[0]

  return <main className="setup-shell">
    <section className="brand-lockup">
      <span className="eyebrow">ФИНАНСОВАЯ СТРАТЕГИЯ</span>
      <div className="brand-mark"><span>₽</span></div>
      <h1>ВЫХОД<br/><em>ИЗ КРУГА</em></h1>
      <p>Не симулятор богатства. Игра про решения, которые либо дают тебе свободу, либо оставляют в вечной гонке.</p>
      <div className="game-chips" aria-hidden="true"><i /><i /><i /><span>6</span></div>
    </section>

    <section className="setup-card">
      <div className="section-label"><span>01</span> Стартовая позиция</div>
      <label htmlFor="profession">Кем ты начинаешь?</label>
      <select id="profession" value={professionId} onChange={(event) => setProfessionId(event.target.value)}>
        {professions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <div className="profession-grid">
        <Metric label="Деньги" value={money(profession.cash)} />
        <Metric label="Доход" value={`${money(profession.salary)}/мес`} good />
        <Metric label="Расходы" value={`${money(profession.expenses)}/мес`} />
        <Metric label="Долг" value={money(profession.debt)} bad />
      </div>
      <div className="setup-option"><label>Уровень сложности</label><div className="choice-row difficulty-row">
        {(Object.keys(difficultySettings) as Difficulty[]).map((level) => <button key={level} className={difficulty === level ? 'selected' : ''} onClick={() => setDifficulty(level)}><b>{difficultySettings[level].label}</b><small>{difficultySettings[level].description}</small></button>)}
      </div></div>
      <div className="setup-option compact"><label>Соперники</label><div className="stepper"><button onClick={() => setBotCount(Math.max(1, botCount - 1))}>−</button><strong>{botCount} бота</strong><button onClick={() => setBotCount(Math.min(3, botCount + 1))}>+</button></div></div>
      <button className="primary-action" onClick={() => dispatch({ type: 'START_GAME', professionId, botCount, difficulty })}>
        Начать новую игру <span>→</span>
      </button>
      {hasSave() && <button className="ghost-action" onClick={continueGame}>Продолжить сохранённую партию</button>}
    </section>
  </main>
}

function Metric({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  return <div className="metric"><small>{label}</small><strong className={good ? 'good' : bad ? 'bad' : ''}>{value}</strong></div>
}

function GameScreen() {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const resetGame = useGameStore((store) => store.resetGame)
  const error = useGameStore((store) => store.error)
  const [tab, setTab] = useState<'board' | 'race' | 'assets' | 'journal'>('board')
  const [dismissedReportMonth, setDismissedReportMonth] = useState<number | null>(null)
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem(TUTORIAL_KEY))
  const [confirmReset, setConfirmReset] = useState(false)
  const [rollAnimation, setRollAnimation] = useState(false)
  const [eventFlash, setEventFlash] = useState(false)
  const previousEventId = useRef(game.events[0]?.id)
  const rollTimer = useRef<number | null>(null)
  const player = game.players[0]
  const freedom = freedomProgress(player, game.stockMarket)
  const freedomState = freedomChecklist(player, game.stockMarket)
  const report = game.lastMonthlyReport
  const level = playerLevel(player)
  const nextLevelXp = nextPlayerLevelXp(player)

  useEffect(() => {
    const eventId = game.events[0]?.id
    if (!eventId || eventId === previousEventId.current || game.pendingDecision) return
    previousEventId.current = eventId
    setEventFlash(true)
    const timer = window.setTimeout(() => setEventFlash(false), 1900)
    return () => window.clearTimeout(timer)
  }, [game.events, game.pendingDecision])

  useEffect(() => () => {
    if (rollTimer.current) window.clearTimeout(rollTimer.current)
  }, [])

  const roll = () => {
    if (rollAnimation || game.phase !== 'ready') return
    setRollAnimation(true)
    rollTimer.current = window.setTimeout(() => {
      dispatch({ type: 'ROLL_DICE' })
      rollTimer.current = window.setTimeout(() => setRollAnimation(false), 1050)
    }, 420)
  }

  const finishTutorial = () => {
    localStorage.setItem(TUTORIAL_KEY, 'seen')
    setShowTutorial(false)
  }

  return <main className="game-shell">
    <header className="topbar">
      <div><span className="eyebrow">ВЫХОД ИЗ КРУГА</span><strong>Месяц {game.month} · День {game.day}</strong></div>
      <button className="icon-button" aria-label="Новая игра" onClick={() => setConfirmReset(true)}>↻</button>
    </header>

    <GlobalEventBanner />
    <section className="hero-stats">
      <div className="level-row"><span>Уровень {level} · {rankName(level)}</span><strong>{nextLevelXp ? `${player.experience}/${nextLevelXp} XP` : 'MAX'}</strong></div>
      <div className="freedom-row"><span>Путь к свободе</span><strong>{freedom}%</strong></div>
      <div className="progress"><i style={{ width: `${Math.min(100, freedom)}%` }} /></div>
      <div className="stats-grid">
        <Metric label="Деньги" value={money(player.cash)} />
        <Metric label="Капитал" value={money(netWorth(player, game.stockMarket))} />
        <Metric label="Пассивный доход" value={`${money(passiveIncome(player, game.stockMarket))}/мес`} good />
        <Metric label="Расходы" value={`${money(monthlyExpenses(player))}/мес`} bad />
      </div>
      <div className="freedom-checks">
        <span className={freedomState.incomeCovered ? 'done' : ''}>Поток {freedomState.incomeCovered ? '✓' : '—'}</span>
        <span className={freedomState.reserveReady ? 'done' : ''}>Резерв ×3 {freedomState.reserveReady ? '✓' : money(Math.max(0, freedomState.reserveTarget - freedomState.reserveCurrent))}</span>
        <span className={freedomState.debtLoadReady ? 'done' : ''}>Долги {freedomState.debtLoadReady ? '✓' : `${Math.round(freedomState.debtServiceLoad * 100)}%`}</span>
        <span className={freedomState.streak >= 3 ? 'done' : ''}>Стабильность {freedomState.streak}/3 мес.</span>
      </div>
    </section>

    {tab === 'board' && <Board onRoll={roll} rolling={rollAnimation} />}
    {tab === 'race' && <><Race /><RivalIntentPanel /></>}
    {tab === 'assets' && <Assets />}
    {tab === 'journal' && <Journal />}

    {error && <div className="toast">{error}</div>}
    {eventFlash && game.events[0] && <div className={`event-flash ${game.events[0].tone ?? 'neutral'}`}><i>{game.events[0].tone === 'good' ? '+' : game.events[0].tone === 'bad' ? '−' : '•'}</i><span><b>{game.events[0].title}</b><small>{game.events[0].description}</small></span></div>}
    <BuyerOfferModal />
    <MarginCallModal />
    <SpecializationModal />
    {game.pendingDecision && !rollAnimation && <DecisionSheet decision={game.pendingDecision} dispatch={dispatch} />}
    {report && dismissedReportMonth !== report.month && <MonthlyReportSheet report={report} onClose={() => setDismissedReportMonth(report.month)} />}
    {game.phase === 'finished' && <GameResult game={game} onReset={resetGame} />}
    {showTutorial && <Tutorial onClose={finishTutorial} />}
    {confirmReset && <ConfirmReset onCancel={() => setConfirmReset(false)} onConfirm={resetGame} />}

    <nav className="bottom-nav">
      <button className={tab === 'board' ? 'active' : ''} onClick={() => setTab('board')}><span>▦</span>Поле</button>
      <button className={tab === 'race' ? 'active' : ''} onClick={() => setTab('race')}><span>♟</span>Гонка</button>
      <button className={tab === 'assets' ? 'active' : ''} onClick={() => setTab('assets')}><span>◆</span>Активы</button>
      <button className={tab === 'journal' ? 'active' : ''} onClick={() => setTab('journal')}><span>▤</span>Журнал</button>
    </nav>
  </main>
}

function Board({ onRoll, rolling }: { onRoll: () => void; rolling: boolean }) {
  const game = useGameStore((store) => store.game)
  const player = game.players[0]
  const currentCell = board[player.position]
  const boardFreedom = freedomProgress(player, game.stockMarket)
  const [visualPosition, setVisualPosition] = useState(player.position)
  const previousTarget = useRef(player.position)

  useEffect(() => {
    if (player.position === previousTarget.current) return
    const start = previousTarget.current
    const steps = game.lastRoll ?? ((player.position - start + board.length) % board.length)
    previousTarget.current = player.position
    const timers = Array.from({ length: steps }, (_, index) => window.setTimeout(
      () => setVisualPosition((start + index + 1) % board.length),
      90 + index * 125,
    ))
    return () => timers.forEach(window.clearTimeout)
  }, [game.lastRoll, player.position])

  return <section className="board-section">
    <div className="turn-card">
      <div><small>ТВОЙ ХОД</small><strong>{currentCell.icon} {currentCell.label}</strong></div>
      <div className="die">{game.lastRoll ?? '•'}</div>
    </div>
    <div className="board-frame">
      <div className="board-track">
      {board.map((cell, index) => <div className={`tile tile-${cell.type} ${index === visualPosition ? 'current' : ''}`} key={`${cell.type}-${index}`}>
        <small>{index + 1}</small><span className="tile-icon">{cell.icon}</span><b>{cell.label}</b>
        <div className="tokens">{game.players.filter((item) => (item.isBot ? item.position : visualPosition) === index).map((item) => <i className={item.isBot ? `bot bot-${game.players.indexOf(item)}` : 'human moving-token'} title={item.name} key={item.id}><span /></i>)}</div>
      </div>)}
      <div className="board-center" aria-hidden="true">
        <span>ЦЕЛЬ ИГРЫ</span>
        <strong>ПАССИВНЫЙ<br/>ДОХОД</strong>
        <i>поток + резерв + 3 стабильных месяца</i>
        <div className="center-progress"><b style={{ width: `${boardFreedom}%` }} /></div>
        <em>{boardFreedom}% · {player.freedomStreak ?? 0}/3</em>
      </div>
      </div>
    </div>
    <button className={`roll-button ${rolling ? 'rolling' : ''}`} disabled={game.phase !== 'ready' || rolling} onClick={onRoll}>
      <span className={`cube dice-face dice-${game.lastRoll ?? 0}`} aria-hidden="true"><i /><i /><i /><i /><i /><i /></span><b>{rolling ? 'Кубик брошен...' : game.phase === 'ready' ? 'Бросить кубик' : 'Прими решение'}</b><small>{rolling ? 'Фишка движется по полю' : game.phase === 'ready' ? 'Испытай рынок' : 'Заверши событие этого хода'}</small>
    </button>
    <div className="rivals">{competitionStandings(game.players, game.stockMarket).slice(0, 3).map((rival, index) => <div className={rival.id === player.id ? 'you' : rival.status} key={rival.id}><b>{index + 1}</b><span>{rival.name}<small>{rival.status === 'bankrupt' ? 'Выбыл' : `${freedomProgress(rival, game.stockMarket)}% · ${money(netWorth(rival, game.stockMarket))}`}</small></span></div>)}</div>
  </section>
}

function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const item = tutorialSteps[step]
  const last = step === tutorialSteps.length - 1
  return <div className="tutorial-backdrop"><section className="tutorial-card">
    <button className="tutorial-skip" onClick={onClose}>Пропустить</button>
    <div className="tutorial-art"><span>{item.icon}</span><i /><i /><i /></div>
    <span className="eyebrow">{item.eyebrow}</span>
    <h2>{item.title}</h2><p>{item.text}</p>
    <div className="tutorial-dots">{tutorialSteps.map((_, index) => <i className={index === step ? 'active' : ''} key={index} />)}</div>
    <button className="primary-action" onClick={() => last ? onClose() : setStep((value) => value + 1)}>{last ? 'Начать игру' : 'Дальше'} <span>→</span></button>
  </section></div>
}

function ConfirmReset({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return <div className="sheet-backdrop"><section className="decision-sheet confirm-sheet"><div className="decision-symbol bad-bg">↻</div><span className="eyebrow">НОВАЯ ПАРТИЯ</span><h2>Начать заново?</h2><p>Текущий прогресс и сохранение этой партии будут удалены.</p><button className="danger-action" onClick={onConfirm}>Да, начать заново</button><button className="ghost-action" onClick={onCancel}>Остаться в игре</button></section></div>
}

const strategyName = (player: Player) => !player.isBot ? 'Твоя стратегия' : player.botStrategy === 'careful' ? 'Осторожный' : player.botStrategy === 'aggressive' ? 'Агрессивный' : 'Сбалансированный'

function Race() {
  const game = useGameStore((store) => store.game)
  const standings = competitionStandings(game.players, game.stockMarket)
  return <section className="content-section">
    <div className="section-heading"><span className="eyebrow">КОНКУРЕНЦИЯ</span><h2>Гонка игроков</h2></div>
    <p className="race-intro">Побеждает тот, кто первым покроет расходы пассивным доходом и сохранит ликвидный резерв на три месяца. Разовый высокий капитал сам по себе свободы не даёт.</p>
    <div className="race-list">{standings.map((rival, index) => {
      const progress = freedomProgress(rival, game.stockMarket)
      const cashflow = monthlyCashflow(rival, game.stockMarket)
      return <article className={`race-card ${rival.id === 'human' ? 'human' : ''} ${rival.status}`} key={rival.id}>
        <div className="race-rank">{rival.status === 'bankrupt' ? '×' : index + 1}</div>
        <div className="race-main"><div className="race-name"><span><b>{rival.name}</b><small>{strategyName(rival)} · уровень {playerLevel(rival)}</small></span><strong>{rival.status === 'free' ? 'Свобода' : rival.status === 'bankrupt' ? 'Банкрот' : `${progress}%`}</strong></div>
          <div className="race-progress"><i style={{ width: `${Math.min(100, progress)}%` }} /></div>
          <div className="race-facts"><span>Капитал <b>{money(netWorth(rival, game.stockMarket))}</b></span><span>Общий поток <b className={cashflow >= 0 ? 'good' : 'bad'}>{cashflow >= 0 ? '+' : ''}{money(cashflow)}</b></span><span>Долг <b>{money(totalDebt(rival))}</b></span><span>Активы <b>{rival.assets.length + rival.stocks.length}</b></span></div>
        </div>
      </article>
    })}</div>
  </section>
}

function Assets() {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const player = game.players[0]
  return <section className="content-section">
    <div className="section-heading"><span className="eyebrow">ПОРТФЕЛЬ</span><h2>Твои активы</h2></div>
    <div className="summary-line"><span>Денежный поток</span><strong className={monthlyCashflow(player, game.stockMarket) >= 0 ? 'good' : 'bad'}>{money(monthlyCashflow(player, game.stockMarket))}/мес</strong></div>
    <div className="summary-line"><span>Общий долг</span><strong>{money(totalDebt(player))}</strong></div>
    <div className="skill-panel"><div className="portfolio-heading"><span><small>НАВЫКИ</small><b>Уровень {playerLevel(player)} · {rankName(playerLevel(player))}</b></span><strong>{player.experience} XP</strong></div><div className="skill-grid">{(Object.keys(skillDefinitions) as SkillId[]).map((skillId) => {
      const definition = skillDefinitions[skillId]
      const level = skillLevel(player, skillId)
      const next = nextSkillXp(player, skillId)
      return <div key={skillId}><span>{definition.icon}</span><b>{definition.name}</b><small>{level}/3{next ? ` · ${player.skills[skillId]}/${next}` : ' · MAX'}</small></div>
    })}</div></div>
    <PortfolioSynergyPanel />
    <EventChainPanel />
    {player.assets.length === 0 ? <div className="empty-state"><span>◇</span><h3>Активов пока нет</h3><p>Ищи сделки с положительным потоком. Цена сама по себе ничего не говорит.</p></div> : player.assets.map((asset) => <article className="asset-card asset-card-detailed" key={asset.id}>
      <div className="asset-main"><div className="asset-icon">{asset.icon}</div><div><small>{asset.category} · доля {Math.round(asset.ownership * 100)}% · {asset.riskRating === 'low' ? 'низкий риск' : asset.riskRating === 'medium' ? 'средний риск' : 'высокий риск'}</small><h3>{asset.name}</h3><strong className={assetCashflow(asset) >= 0 ? 'good' : 'bad'}>{money(assetCashflow(asset))}/мес</strong></div></div>
      {(asset.synergyBonus ?? 0) > 0 && <div className="v15-asset-synergy">Связка портфеля +{Math.round((asset.synergyBonus ?? 0) * 100)}% к выручке · {asset.synergyLabel}</div>}
      <div className={asset.legalIssue ? "pledge-badge" : "negotiation-note"}>{asset.legalIssue ? `⚠ ${asset.legalIssue} · ${asset.issueMonths ?? 0} мес.` : asset.status === 'launching' ? `Запуск: ещё ${asset.launchMonthsRemaining ?? 0} мес.` : asset.status === 'stressed' ? 'Бизнес работает с просадкой' : 'Бизнес работает стабильно'}</div>
      {asset.legalIssue && asset.issueCost && <button className="primary-action" disabled={game.phase !== 'ready' || player.cash < asset.issueCost} onClick={() => dispatch({ type: 'RESOLVE_ASSET_ISSUE', assetId: asset.id })}>Устранить проблему · {money(asset.issueCost)}</button>}
      {pledgedLoanForAsset(player, asset.id) && <div className="pledge-badge">В залоге у банка · остаток {money(pledgedLoanForAsset(player, asset.id)!.balance)}</div>}
      <div className="asset-facts"><span>Рыночная стоимость <b>{money(assetMarketValue(asset))}</b></span><span>Долг самого бизнеса <b>{money(asset.loan)}</b></span><span>Уровень развития <b>{asset.developmentLevel}/4</b></span><span>Получишь после банков <b>{money(assetLiquidationProceeds(player, asset))}</b></span></div>
      <AssetInvestmentPanel player={player} asset={asset} />
      {asset.saleOffer && asset.offerExpiresMonth === game.month && <div className="sale-offer"><div><small>ПРЕДЛОЖЕНИЕ ДО КОНЦА МЕСЯЦА</small><strong>{money(asset.saleOffer)}</strong></div><button disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'ACCEPT_SALE_OFFER', assetId: asset.id })}>Принять</button></div>}
      <div className="development-list">{developments.filter((item) => !asset.developments.includes(item.id)).map((item) => {
        const cost = developmentCost(player, asset, item.costRate)
        return <button key={item.id} disabled={game.phase !== 'ready' || asset.lastDevelopedMonth === game.month || player.cash < cost} onClick={() => dispatch({ type: 'DEVELOP_ASSET', assetId: asset.id, developmentId: item.id })}><span><b>{item.name}</b><small>{item.description}</small></span><strong>{money(cost)}</strong></button>
      })}</div>
      <div className="partner-actions"><span>{asset.ownership < 1 ? `Партнёр владеет ${Math.round((1 - asset.ownership) * 100)}%` : 'Ты единственный владелец'}</span><button disabled={game.phase !== 'ready' || asset.ownership >= 1} onClick={() => dispatch({ type: 'BUY_PARTNER_SHARE', assetId: asset.id })}>Выкупить 10% · {money(Math.round((assetMarketValue(asset) / asset.ownership) * 0.1 * 1.08))}</button><button disabled={game.phase !== 'ready' || asset.ownership <= 0.5} onClick={() => dispatch({ type: 'SELL_PARTNER_SHARE', assetId: asset.id })}>Продать 10% · {money(Math.round((assetMarketValue(asset) / asset.ownership) * 0.1 * 0.96))}</button></div>
      <button className="sell-button" disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'SELL_ASSET', assetId: asset.id })}>Продать срочно · 93% рынка</button>
    </article>)}
    <AssetSalesCore />
    <div className="saving-card"><Metric label="Депозит" value={money(player.deposit)} /><Metric label="Облигации" value={money(player.bonds)} /></div>
    <div className="portfolio-section">
      <div className="portfolio-heading"><span><small>БИРЖЕВОЙ ПОРТФЕЛЬ</small><b>{money(stockMarketValue(player, game.stockMarket))}</b></span><strong className="good">+{money(monthlyStockDividends(player, game.stockMarket))}/мес</strong></div>
      {player.stocks.length === 0 ? <p>Акций пока нет. Купить их можно на клетке "Рынок".</p> : player.stocks.map((holding) => {
        const quote = game.stockMarket.find((item) => item.id === holding.stockId)!
        const exactCostBasis = holding.costBasis ?? holding.averagePrice * holding.quantity
        const result = calculateStockSale(holding.averagePrice, quote.price, holding.quantity, STOCK_COMMISSION_RATE, exactCostBasis)
        const entryMarketPrice = holding.averageMarketPrice ?? Math.round((holding.marketCostBasis ?? exactCostBasis / (1 + STOCK_COMMISSION_RATE)) / holding.quantity)
        return <div className="holding-row v16-holding-row" key={holding.stockId}><span><b>{quote.ticker} · {holding.quantity} шт.</b><small>{quote.name} · вход {money(entryMarketPrice)} · себестоимость {money(holding.averagePrice)} · безубыток {money(result.breakEvenPrice)}</small><small>Текущая стоимость {money(result.grossValue)} · комиссия продажи {money(result.commission)} · на руки {money(result.proceeds)}</small></span><strong className={result.profit >= 0 ? 'good' : 'bad'}>{result.profit >= 0 ? '+' : ''}{money(result.profit)}<small>{result.profitPercent >= 0 ? '+' : ''}{result.profitPercent.toFixed(1)}% после комиссии</small></strong></div>
      })}
    </div>
    {player.resaleDeals.length > 0 && <div className="portfolio-section"><div className="portfolio-heading"><span><small>ТОВАРЫ НА ПЕРЕПРОДАЖЕ</small><b>{player.resaleDeals.length} активных</b></span></div>{player.resaleDeals.map((deal) => <div className="holding-row" key={deal.id}><span><b>{deal.title}</b><small>Вложено {money(deal.investment)} · результат в месяце {deal.resolvesMonth}</small></span><strong>{deal.delays ? 'Задержка' : 'В работе'}<small>ожидание {money(deal.expectedMin)} - {money(deal.expectedMax)}</small></strong></div>)}</div>}
    {player.activeContracts.length > 0 && <div className="portfolio-section"><div className="portfolio-heading"><span><small>КОНТРАКТЫ</small><b>{player.activeContracts.length} в работе</b></span></div>{player.activeContracts.map((contract) => <div className="holding-row" key={contract.id}><span><b>{contract.title}</b><small>Вложено {money(contract.investment)} · результат в месяце {contract.resolvesMonth}</small></span><strong>{Math.round(contract.successChance * 100)}%<small>выплата {money(contract.payout)}</small></strong></div>)}</div>}
    {player.loans.length > 0 && <div className="loan-list"><small>КРЕДИТЫ</small>{player.loans.map((loan) => <div key={loan.id}><span><b>{loan.name}</b><small>{Math.round(loan.annualRate * 100)}% · ещё {loan.termMonths} мес.</small></span><strong>{money(loan.balance)}<small>{money(loan.monthlyPayment)}/мес</small></strong></div>)}</div>}
  </section>
}

function ReportLine({ label, value, income }: { label: string; value: number; income?: boolean }) {
  if (value === 0) return null
  return <div className="report-line"><span>{label}</span><strong className={income ? 'good' : 'bad'}>{income ? '+' : '-'}{money(value)}</strong></div>
}

function MonthlyReportSheet({ report, onClose }: { report: MonthlyReport; onClose: () => void }) {
  return <div className="sheet-backdrop report-backdrop"><section className="decision-sheet report-sheet">
    <div className="sheet-handle" />
    <span className="eyebrow">МЕСЯЦ {report.month} ЗАКРЫТ</span>
    <h2>Куда ушли деньги</h2>
    <div className="report-balance"><span>Было в начале</span><strong>{money(report.startingCash)}</strong></div>
    <div className="report-group"><small>ДОХОДЫ</small><ReportLine label="Зарплата" value={report.salary} income /><ReportLine label="Доход активов" value={report.assetRevenue} income /><ReportLine label="Проценты по депозиту" value={report.depositIncome} income /><ReportLine label="Доход облигаций" value={report.bondIncome} income /><ReportLine label="Дивиденды по акциям" value={report.stockDividends} income /><ReportLine label="Возврат перепродаж" value={report.resaleReturns} income /><ReportLine label="Доход от контрактов" value={report.contractReturns ?? 0} income /></div>
    <div className="report-group"><small>РАСХОДЫ</small><ReportLine label="Жизнь и обязательные платежи" value={report.livingExpenses} /><ReportLine label="Содержание активов" value={report.operatingCosts} /><ReportLine label="Долги активов" value={report.assetDebtPayments} /><ReportLine label="Другие кредиты" value={report.loanPayments} /></div>
    <div className="report-result"><div><span>Итог месяца</span><strong className={report.netCashflow >= 0 ? 'good' : 'bad'}>{report.netCashflow >= 0 ? '+' : ''}{money(report.netCashflow)}</strong></div><div><span>Денег сейчас</span><strong>{money(report.endingCash)}</strong></div></div>
    <button className="primary-action" onClick={onClose}>Продолжить игру <span>→</span></button>
  </section></div>
}

function Journal() {
  const events = useGameStore((store) => store.game.events)
  return <section className="content-section">
    <div className="section-heading"><span className="eyebrow">ИСТОРИЯ РЕШЕНИЙ</span><h2>Журнал партии</h2></div>
    <div className="timeline">{events.map((event) => <article key={event.id}><i className={event.tone} /><div><small>Месяц {event.month} · День {event.day}</small><h3>{event.title}</h3><p>{event.description}</p></div></article>)}</div>
  </section>
}

function DecisionSheet({ decision, dispatch }: { decision: Decision; dispatch: (command: GameCommand) => boolean }) {
  const game = useGameStore((store) => store.game)
  const player = game.players[0]
  const commonSkip = <button className="ghost-action" onClick={() => dispatch({ type: 'SKIP_DECISION' })}>Пропустить и завершить ход</button>
  let body: React.ReactNode

  if (decision.kind === 'business' || decision.kind === 'opportunity') {
    const business = businesses.find((item) => item.id === decision.businessId)!
    const financedLoan = Math.min(decision.askingPrice, Math.round(business.loan * (decision.askingPrice / business.price)))
    const payment = loanPayment(financedLoan, business.loanRate, business.loanTermMonths)
    const operatingIncome = dealProjectedOperatingIncome(decision.profile, decision.inspection ?? 'none', business.revenue, business.operatingCosts)
    const flow = operatingIncome - payment
    const flowLabel = decision.profile ? (decision.inspection === 'full' ? 'Проверенный поток' : 'Заявленный поток') : 'Поток после запуска'
    body = <>
      {decision.kind === 'business' ? <div className="deal-title"><span>{business.icon}</span><div><small>{business.category} · уровень {business.requiredLevel}</small><h2>{business.name}</h2></div></div> : <><div className="decision-symbol good-bg">★</div><span className="eyebrow">РЕДКАЯ ВОЗМОЖНОСТЬ</span><h2>{decision.title}</h2><p>{decision.description}</p></>}
      <div className="deal-grid"><Metric label="Цена" value={money(decision.askingPrice)} /><Metric label="Первый взнос" value={money(Math.max(0, decision.askingPrice - financedLoan))} /><Metric label="Риск" value={business.riskRating === 'low' ? 'Низкий' : business.riskRating === 'medium' ? 'Средний' : 'Высокий'} /><Metric label={flowLabel} value={money(flow) + '/мес'} good={flow >= 0} bad={flow < 0} /></div>
      <DealProfilePanel decision={decision} />
      <div className="bank-verdict"><div><small>ПРОВЕРКА ДОКУМЕНТОВ</small><b>{decision.inspection && decision.inspection !== 'none' ? (decision.issueRevealed ? (decision.hiddenIssue && decision.hiddenIssue !== 'none' ? 'Найдена проблема' : 'Проверка чистая') : 'Результат неоднозначный') : 'Не проводилась'}</b></div><span>{decision.issueRevealed && decision.hiddenIssue && decision.hiddenIssue !== 'none' ? ({ documents: 'Проблемы с документами или лицензией', lease: 'Риск по аренде', repair: 'Скрытый ремонт', 'hidden-debt': 'Скрытый долг' } as const)[decision.hiddenIssue] : 'Без проверки риск скрытых проблем выше'}</span></div>
      {(!decision.inspection || decision.inspection === 'none') && <div className="split-actions two"><button onClick={() => dispatch({ type: 'INSPECT_BUSINESS', level: 'basic' })}>Базовая проверка</button><button onClick={() => dispatch({ type: 'INSPECT_BUSINESS', level: 'full' })}>Полная проверка</button></div>}
      {decision.kind === 'business' && !decision.negotiated && <div className="negotiation"><div><b>Попробовать торг</b><small>Чем ниже цена, тем выше шанс потерять сделку</small></div><div><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.95 })}>−5%</button><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.9 })}>−10%</button><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.85 })}>−15%</button></div></div>}
      {decision.kind === 'business' && decision.negotiationNote && <div className="negotiation-note">{decision.negotiationNote}</div>}
      <SellerCounterPanel decision={decision} />
      <DealFinancingCore decision={decision} />
      {commonSkip}
    </>
  } else if (decision.kind === 'chance') {
    const midpoint = Math.round((decision.minReturn + decision.maxReturn) / 2)
    body = <><div className="decision-symbol good-bg">↗</div><span className="eyebrow">ПЕРЕПРОДАЖА</span><h2>{decision.title}</h2><p>Деньги будут заняты {decision.durationMonths} мес. Итог заранее не гарантирован.</p><div className="deal-grid"><Metric label="Вложить" value={money(decision.investment)} /><Metric label="Мин. возврат" value={money(decision.minReturn)} /><Metric label="Средний сценарий" value={money(midpoint)} /><Metric label="Макс. возврат" value={money(decision.maxReturn)} good /></div><button className="primary-action" disabled={player.cash < decision.investment} onClick={() => dispatch({ type: 'TAKE_CHANCE' })}>Взять возможность <span>→</span></button>{commonSkip}</>
  } else if (decision.kind === 'bank') {
    const rateDelta = game.globalEvent?.creditRateDelta ?? 0
    const amounts = [100_000, 300_000, 700_000]
    body = <><div className="decision-symbol good-bg">₽</div><span className="eyebrow">БАНК</span><h2>Кредит и управление долгом</h2><p>Банк оценивает реальный денежный поток, резерв и уже существующие платежи.</p><div className="v14-action-list">{amounts.map((amount) => { const offer = assessLoan(player, amount, game.difficulty, undefined, 0, 0, rateDelta); return <button key={amount} disabled={!offer.approved} onClick={() => dispatch({ type: 'TAKE_LOAN', amount })}><b>Без залога · {money(amount)}</b><small>{offer.approved ? `${Math.round(offer.annualRate * 100)}% · ${money(offer.monthlyPayment)}/мес.` : offer.reason}</small></button> })}</div>{player.assets.length > 0 && <div className="v14-action-list">{player.assets.map((asset) => { const amount = availableCollateral(player, asset); const offer = assessLoan(player, amount, game.difficulty, asset, 0, 0, rateDelta); return <button key={asset.id} disabled={!offer.approved || amount <= 0} onClick={() => dispatch({ type: 'TAKE_LOAN', amount, collateralAssetId: asset.id })}><b>Заложить {asset.name}</b><small>{amount > 0 ? `До ${money(amount)} · ${money(offer.monthlyPayment)}/мес.` : 'Актив уже в залоге'}</small></button> })}</div>}<button className="ghost-action" disabled={player.loans.length === 0 || player.cash <= 0} onClick={() => dispatch({ type: 'REPAY_LOAN', amount: Math.min(100_000, player.cash) })}>Погасить до {money(Math.min(100_000, player.cash))}</button>{commonSkip}</>
  } else if (decision.kind === 'growth') {
    body = <><div className="decision-symbol good-bg">↑</div><span className="eyebrow">РАЗВИТИЕ</span><h2>Прокачать финансовый навык</h2><div className="v14-action-list">{(Object.keys(skillDefinitions) as SkillId[]).map((skillId) => { const definition = skillDefinitions[skillId]; const level = skillLevel(player, skillId); const cost = trainingCost(player, skillId); return <button key={skillId} disabled={level >= 3 || player.cash < cost} onClick={() => dispatch({ type: 'TRAIN', skillId })}><b>{definition.icon} {definition.name} · {level}/3</b><small>{level >= 3 ? 'Максимальный уровень' : `${definition.description} · ${money(cost)}`}</small></button> })}</div>{commonSkip}</>
  } else if (decision.kind === 'salary') {
    body = <><span className="eyebrow">РАСЧЁТ</span><h2>Финансовая пауза</h2><p>Текущий денежный поток: <strong>{money(monthlyCashflow(player, game.stockMarket))}/мес</strong></p>{commonSkip}</>
  } else body = <V14DecisionContent decision={decision} commonSkip={commonSkip} />

  return <div className="sheet-backdrop"><section className={`decision-sheet decision-${decision.kind}`}><div className="sheet-handle" />{body}</section></div>
}

function GameResult({ game, onReset }: { game: GameState; onReset: () => void }) {
  const standings = competitionStandings(game.players, game.stockMarket)
  const winner = game.players.find((player) => player.id === game.outcome?.winnerId)
  const humanWon = winner?.id === 'human'
  const title = humanWon ? 'Ты выиграл гонку' : winner ? `${winner.name} победил` : 'Ты обанкротился'
  const description = game.outcome?.reason === 'freedom'
    ? `${winner?.name ?? 'Игрок'} первым покрыл расходы пассивным доходом.`
    : game.outcome?.reason === 'last-solvent' ? `${winner?.name ?? 'Игрок'} остался последним платёжеспособным участником.` : 'Долги, отрицательный капитал и кассовый разрыв остановили твою игру.'
  return <div className="sheet-backdrop victory"><section className="decision-sheet result-sheet"><div className="victory-mark">{humanWon ? '₽' : '×'}</div><span className="eyebrow">ИТОГИ · МЕСЯЦ {game.month}</span><h2>{title}</h2><p>{description}</p><div className="final-standings">{standings.map((player, index) => <div key={player.id}><b>{player.status === 'bankrupt' ? '×' : index + 1}</b><span>{player.name}<small>{player.status === 'bankrupt' ? 'Банкрот' : `${freedomProgress(player, game.stockMarket)}% пути к свободе`}</small></span><strong>{money(netWorth(player, game.stockMarket))}</strong></div>)}</div><button className="primary-action" onClick={onReset}>Сыграть ещё раз</button></section></div>
}

export default function App() {
  const phase = useGameStore((store) => store.game.phase)
  return phase === 'setup' ? <SetupScreen /> : <GameScreen />
}
