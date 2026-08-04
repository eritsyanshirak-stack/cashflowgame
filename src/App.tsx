import { useState } from 'react'
import './App.css'
import './premium.css'
import { board, businesses, developments, difficultySettings, professions } from './game/content/content'
import type { Decision, Difficulty, Funding, GameCommand, MonthlyReport } from './game/domain/types'
import { assessLoan, assetCashflow, assetLiquidationProceeds, assetMarketValue, availableCollateral, monthlyCashflow, monthlyExpenses, netWorth, passiveIncome, pledgedLoanForAsset, totalDebt } from './game/systems/economy'
import { hasSave } from './game/persistence/save'
import { useGameStore } from './store/gameStore'

const money = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`

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
      <div className="brand-mark">₽</div>
      <h1>ВЫХОД<br/><em>ИЗ КРУГА</em></h1>
      <p>Не симулятор богатства. Игра про решения, которые либо дают тебе свободу, либо оставляют в вечной гонке.</p>
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
  const [tab, setTab] = useState<'board' | 'assets' | 'journal'>('board')
  const [dismissedReportMonth, setDismissedReportMonth] = useState<number | null>(null)
  const player = game.players[0]
  const freedom = Math.min(100, Math.round((passiveIncome(player) / Math.max(1, monthlyExpenses(player))) * 100))
  const report = game.lastMonthlyReport

  return <main className="game-shell">
    <header className="topbar">
      <div><span className="eyebrow">ВЫХОД ИЗ КРУГА</span><strong>Месяц {game.month} · День {game.day}</strong></div>
      <button className="icon-button" aria-label="Новая игра" onClick={resetGame}>↻</button>
    </header>

    <section className="hero-stats">
      <div className="freedom-row"><span>Путь к свободе</span><strong>{freedom}%</strong></div>
      <div className="progress"><i style={{ width: `${freedom}%` }} /></div>
      <div className="stats-grid">
        <Metric label="Деньги" value={money(player.cash)} />
        <Metric label="Капитал" value={money(netWorth(player))} />
        <Metric label="Пассивный доход" value={`${money(passiveIncome(player))}/мес`} good />
        <Metric label="Расходы" value={`${money(monthlyExpenses(player))}/мес`} bad />
      </div>
    </section>

    {tab === 'board' && <Board onRoll={() => dispatch({ type: 'ROLL_DICE' })} />}
    {tab === 'assets' && <Assets />}
    {tab === 'journal' && <Journal />}

    {error && <div className="toast">{error}</div>}
    {game.pendingDecision && <DecisionSheet decision={game.pendingDecision} dispatch={dispatch} />}
    {report && dismissedReportMonth !== report.month && <MonthlyReportSheet report={report} onClose={() => setDismissedReportMonth(report.month)} />}
    {game.phase === 'victory' && <Victory onReset={resetGame} />}

    <nav className="bottom-nav">
      <button className={tab === 'board' ? 'active' : ''} onClick={() => setTab('board')}><span>◈</span>Поле</button>
      <button className={tab === 'assets' ? 'active' : ''} onClick={() => setTab('assets')}><span>▤</span>Активы</button>
      <button className={tab === 'journal' ? 'active' : ''} onClick={() => setTab('journal')}><span>≡</span>Журнал</button>
    </nav>
  </main>
}

function Board({ onRoll }: { onRoll: () => void }) {
  const game = useGameStore((store) => store.game)
  const player = game.players[0]
  const currentCell = board[player.position]
  return <section className="board-section">
    <div className="turn-card">
      <div><small>ТВОЙ ХОД</small><strong>{currentCell.icon} {currentCell.label}</strong></div>
      <div className="die">{game.lastRoll ?? '•'}</div>
    </div>
    <div className="board-track">
      {board.map((cell, index) => <div className={`tile ${index === player.position ? 'current' : ''}`} key={`${cell.type}-${index}`}>
        <small>{index + 1}</small><span>{cell.icon}</span>
        <div className="tokens">{game.players.filter((item) => item.position === index).map((item) => <i className={item.isBot ? 'bot' : 'human'} key={item.id} />)}</div>
      </div>)}
    </div>
    <button className="roll-button" disabled={game.phase !== 'ready'} onClick={onRoll}>
      <span className="cube">⌁</span><b>{game.phase === 'ready' ? 'Бросить кубик' : 'Прими решение'}</b><small>Ход нельзя отменить</small>
    </button>
    <div className="rivals">
      {game.players.slice(1).map((bot) => <div key={bot.id}><i /> <span>{bot.name}<small>{bot.botStrategy === 'careful' ? 'Осторожный' : bot.botStrategy === 'aggressive' ? 'Агрессивный' : 'Сбалансированный'} · {money(netWorth(bot))}</small></span></div>)}
    </div>
  </section>
}

function Assets() {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const player = game.players[0]
  return <section className="content-section">
    <div className="section-heading"><span className="eyebrow">ПОРТФЕЛЬ</span><h2>Твои активы</h2></div>
    <div className="summary-line"><span>Денежный поток</span><strong className={monthlyCashflow(player) >= 0 ? 'good' : 'bad'}>{money(monthlyCashflow(player))}/мес</strong></div>
    <div className="summary-line"><span>Общий долг</span><strong>{money(totalDebt(player))}</strong></div>
    {player.assets.length === 0 ? <div className="empty-state"><span>◇</span><h3>Активов пока нет</h3><p>Ищи сделки с положительным потоком. Цена сама по себе ничего не говорит.</p></div> : player.assets.map((asset) => <article className="asset-card asset-card-detailed" key={asset.id}>
      <div className="asset-main"><div className="asset-icon">{asset.icon}</div><div><small>{asset.category} · доля {Math.round(asset.ownership * 100)}%</small><h3>{asset.name}</h3><strong className={assetCashflow(asset) >= 0 ? 'good' : 'bad'}>{money(assetCashflow(asset))}/мес</strong></div></div>
      {pledgedLoanForAsset(player, asset.id) && <div className="pledge-badge">В залоге у банка · остаток {money(pledgedLoanForAsset(player, asset.id)!.balance)}</div>}
      <div className="asset-facts"><span>Рыночная стоимость <b>{money(assetMarketValue(asset))}</b></span><span>Долг самого бизнеса <b>{money(asset.loan)}</b></span><span>Уровень развития <b>{asset.developmentLevel}/4</b></span><span>Получишь после банков <b>{money(assetLiquidationProceeds(player, asset))}</b></span></div>
      {asset.saleOffer && asset.offerExpiresMonth === game.month && <div className="sale-offer"><div><small>ПРЕДЛОЖЕНИЕ ДО КОНЦА МЕСЯЦА</small><strong>{money(asset.saleOffer)}</strong></div><button disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'ACCEPT_SALE_OFFER', assetId: asset.id })}>Принять</button></div>}
      <div className="development-list">{developments.filter((item) => !asset.developments.includes(item.id)).map((item) => {
        const cost = Math.round(asset.price * asset.ownership * item.costRate)
        return <button key={item.id} disabled={game.phase !== 'ready' || asset.lastDevelopedMonth === game.month || player.cash < cost} onClick={() => dispatch({ type: 'DEVELOP_ASSET', assetId: asset.id, developmentId: item.id })}><span><b>{item.name}</b><small>{item.description}</small></span><strong>{money(cost)}</strong></button>
      })}</div>
      <div className="partner-actions"><span>{asset.ownership < 1 ? `Партнёр владеет ${Math.round((1 - asset.ownership) * 100)}%` : 'Ты единственный владелец'}</span><button disabled={game.phase !== 'ready' || asset.ownership >= 1} onClick={() => dispatch({ type: 'BUY_PARTNER_SHARE', assetId: asset.id })}>Выкупить 10%</button><button disabled={game.phase !== 'ready' || asset.ownership <= 0.5} onClick={() => dispatch({ type: 'SELL_PARTNER_SHARE', assetId: asset.id })}>Продать 10%</button></div>
      <button className="sell-button" disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'SELL_ASSET', assetId: asset.id })}>Продать по рынку</button>
    </article>)}
    <div className="saving-card"><Metric label="Депозит" value={money(player.deposit)} /><Metric label="Облигации" value={money(player.bonds)} /></div>
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
    <div className="report-group"><small>ДОХОДЫ</small><ReportLine label="Зарплата" value={report.salary} income /><ReportLine label="Доход активов" value={report.assetRevenue} income /><ReportLine label="Проценты по депозиту" value={report.depositIncome} income /><ReportLine label="Доход облигаций" value={report.bondIncome} income /></div>
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

  if (decision.kind === 'business') {
    const business = businesses.find((item) => item.id === decision.businessId)!
    const payment = Math.round(business.loan * 0.015)
    const flow = business.revenue - business.operatingCosts - payment
    const downPayment = Math.max(0, decision.askingPrice - business.loan)
    const gap = Math.max(0, downPayment - player.cash)
    const projectedOperatingIncome = business.revenue - business.operatingCosts
    const unsecured = assessLoan(player, gap, game.difficulty, undefined, projectedOperatingIncome, payment)
    const collateralOffers = player.assets.map((asset) => ({ asset, offer: assessLoan(player, gap, game.difficulty, asset, projectedOperatingIncome, payment) })).filter(({ offer }) => offer.approved)
    const buy = (funding: Funding, collateralAssetId?: string) => dispatch({ type: 'BUY_BUSINESS', funding, collateralAssetId })
    body = <><div className="deal-title"><span>{business.icon}</span><div><small>{business.category}</small><h2>{business.name}</h2></div></div>
      <div className="deal-grid"><Metric label="Цена" value={money(decision.askingPrice)} /><Metric label="Первый взнос" value={money(downPayment)} /><Metric label="Долг бизнеса" value={money(business.loan)} /><Metric label="Чистый поток" value={`${money(flow)}/мес`} good={flow >= 0} bad={flow < 0} /></div>
      {!decision.negotiated && <div className="negotiation"><div><b>Попробовать торг</b><small>Чем ниже цена, тем выше шанс потерять сделку</small></div><div><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.95 })}>−5%</button><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.9 })}>−10%</button><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.85 })}>−15%</button></div></div>}
      {decision.negotiationNote && <div className="negotiation-note">{decision.negotiationNote}</div>}
      <div className="cash-check"><span>У тебя сейчас</span><strong>{money(player.cash)}</strong></div>
      {gap > 0 && <div className={`bank-verdict ${unsecured.approved ? 'approved' : 'declined'}`}><div><small>БАНКОВСКАЯ ОЦЕНКА · {unsecured.score}</small><b>{unsecured.approved ? `Одобрено ${money(gap)}` : 'Без залога отказ'}</b></div><span>{unsecured.approved ? `${Math.round(unsecured.annualRate * 100)}% · ${money(unsecured.monthlyPayment)}/мес` : unsecured.reason}</span></div>}
      <button className="primary-action" disabled={gap > 0} onClick={() => buy('cash')}>Купить за свои <span>→</span></button>
      <div className="funding-actions">
        {gap > 0 && unsecured.approved && <button onClick={() => buy('credit')}><b>Наличными + кредит</b><small>Банк добавит {money(gap)}</small></button>}
        {gap > 0 && collateralOffers.map(({ asset, offer }) => <button key={asset.id} onClick={() => buy('secured', asset.id)}><b>Заложить {asset.name}</b><small>{money(gap)} · {Math.round(offer.annualRate * 100)}% · {money(offer.monthlyPayment)}/мес</small></button>)}
        <button disabled={player.cash < Math.round(downPayment * .7)} onClick={() => buy('partner30')}><b>Партнёр 30%</b><small>Твой взнос {money(Math.round(downPayment * .7))}</small></button>
        <button disabled={player.cash < Math.round(downPayment * .5)} onClick={() => buy('partner50')}><b>Партнёр 50%</b><small>Твой взнос {money(Math.round(downPayment * .5))}</small></button>
      </div>{commonSkip}</>
  } else if (decision.kind === 'expense') body = <><div className="decision-symbol bad-bg">!</div><span className="eyebrow">НЕПРЕДВИДЕННЫЙ РАСХОД</span><h2>{decision.title}</h2><div className="big-number bad">-{money(decision.amount)}</div><button className="primary-action" onClick={() => dispatch({ type: 'PAY_EXPENSE' })}>Оплатить</button><button className="ghost-action" onClick={() => dispatch({ type: 'PAY_EXPENSE', withCredit: true })}>Оплатить в кредит</button></>
  else if (decision.kind === 'chance') body = <><div className="decision-symbol good-bg">↗</div><span className="eyebrow">ВОЗМОЖНОСТЬ</span><h2>{decision.title}</h2><div className="deal-grid"><Metric label="Вложение" value={money(decision.investment)} /><Metric label="Возврат" value={money(decision.returnAmount)} good /></div><button className="primary-action" onClick={() => dispatch({ type: 'TAKE_CHANCE' })}>Вложиться <span>→</span></button>{commonSkip}</>
  else if (decision.kind === 'bank') {
    const profile = assessLoan(player, 0, game.difficulty)
    const unsecured = assessLoan(player, 100_000, game.difficulty)
    const collateralOffers = player.assets.map((asset) => ({ asset, limit: availableCollateral(player, asset), offer: assessLoan(player, Math.min(300_000, availableCollateral(player, asset)), game.difficulty, asset) })).filter(({ offer, limit }) => limit > 0 && offer.approved)
    body = <><span className="eyebrow">БАНК</span><h2>Твой кредитный профиль</h2><div className="credit-profile"><div><small>РЕЙТИНГ</small><strong>{profile.score}</strong></div><div><small>НАГРУЗКА</small><strong>{Math.round(profile.debtLoad * 100)}%</strong></div><div><small>ЛИМИТ БЕЗ ЗАЛОГА</small><strong>{money(profile.limit)}</strong></div></div><div className="cash-check"><span>Общий долг</span><strong>{money(totalDebt(player))}</strong></div><div className="funding-actions">{unsecured.approved && <button onClick={() => dispatch({ type: 'TAKE_LOAN', amount: 100_000 })}><b>Взять 100 000 ₽</b><small>{Math.round(unsecured.annualRate * 100)}% · {money(unsecured.monthlyPayment)}/мес</small></button>}{collateralOffers.map(({ asset, offer }) => <button key={asset.id} onClick={() => dispatch({ type: 'TAKE_LOAN', amount: offer.amount, collateralAssetId: asset.id })}><b>Под залог: {asset.name}</b><small>Получить {money(offer.amount)} · {Math.round(offer.annualRate * 100)}%</small></button>)}<button onClick={() => dispatch({ type: 'REPAY_LOAN', amount: 100_000 })}><b>Погасить 100 000 ₽</b><small>Сначала закрывается самый ранний кредит</small></button></div>{!unsecured.approved && <div className="bank-verdict declined"><b>Новый кредит без залога недоступен</b><span>{unsecured.reason}</span></div>}{commonSkip}</>
  }
  else if (decision.kind === 'market') body = <><span className="eyebrow">РЫНОК</span><h2>{decision.title}</h2><p>{decision.description}</p><div className="split-actions two"><button onClick={() => dispatch({ type: 'DEPOSIT', amount: 50_000 })}>Депозит 50 000</button><button onClick={() => dispatch({ type: 'BUY_BONDS', amount: 50_000 })}>Облигации 50 000</button><button onClick={() => dispatch({ type: 'WITHDRAW_DEPOSIT', amount: 50_000 })}>Снять депозит</button><button onClick={() => dispatch({ type: 'SELL_BONDS', amount: 50_000 })}>Продать облигации</button></div>{commonSkip}</>
  else if (decision.kind === 'growth') body = <><div className="decision-symbol good-bg">↑</div><span className="eyebrow">РАЗВИТИЕ</span><h2>Вложиться в себя</h2><p>Обучение стоит 60 000 ₽ и увеличивает активный доход на 21 000 ₽ в месяц.</p><button className="primary-action" onClick={() => dispatch({ type: 'TRAIN', cost: 60_000 })}>Пройти обучение</button>{commonSkip}</>
  else body = <><span className="eyebrow">РАСЧЁТ</span><h2>Финансовая пауза</h2><p>Текущий денежный поток: <strong>{money(monthlyCashflow(player))}/мес</strong></p>{commonSkip}</>

  return <div className="sheet-backdrop"><section className="decision-sheet"><div className="sheet-handle" />{body}</section></div>
}

function Victory({ onReset }: { onReset: () => void }) {
  return <div className="sheet-backdrop victory"><section className="decision-sheet"><div className="victory-mark">₽</div><span className="eyebrow">ФИНАНСОВАЯ СВОБОДА</span><h2>Ты вышел из круга</h2><p>Пассивный доход теперь покрывает твои расходы. Ты больше не обязан работать ради следующего платежа.</p><button className="primary-action" onClick={onReset}>Сыграть ещё раз</button></section></div>
}

export default function App() {
  const phase = useGameStore((store) => store.game.phase)
  return phase === 'setup' ? <SetupScreen /> : <GameScreen />
}
