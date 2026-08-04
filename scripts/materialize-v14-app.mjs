import fs from 'node:fs'

const path = 'src/App.tsx'
let source = fs.readFileSync(path, 'utf8')
const once = (from, to) => {
  if (!source.includes(from)) throw new Error(`Missing App anchor: ${from.slice(0, 120)}`)
  source = source.replace(from, to)
}
const between = (start, end, replacement) => {
  const from = source.indexOf(start)
  if (from < 0) throw new Error(`Missing App start: ${start}`)
  const to = source.indexOf(end, from)
  if (to < 0) throw new Error(`Missing App end: ${end}`)
  source = source.slice(0, from) + replacement + source.slice(to)
}

once(
  "import type { Decision, Difficulty, Funding, GameCommand, GameState, MonthlyReport, Player, SkillId } from './game/domain/types'",
  "import type { Decision, Difficulty, GameCommand, GameState, MonthlyReport, Player, SkillId } from './game/domain/types'",
)
once(
  "import { developmentCost, nextPlayerLevelXp, nextSkillXp, playerLevel, rankName, skillDefinitions, skillLevel, trainingCost } from './game/systems/progression'",
  "import { developmentCost, nextPlayerLevelXp, nextSkillXp, playerLevel, rankName, skillDefinitions, skillLevel, trainingCost } from './game/systems/progression'\nimport { AssetSalesCore, BuyerOfferModal, DealFinancingCore, GlobalEventBanner, MarginCallModal, V14DecisionContent } from './V14UI'",
)

once(
  "    </header>\n\n    <section className=\"hero-stats\">",
  "    </header>\n\n    <GlobalEventBanner />\n    <section className=\"hero-stats\">",
)
once(
  "    {game.pendingDecision && !rollAnimation && <DecisionSheet decision={game.pendingDecision} dispatch={dispatch} />}",
  "    <BuyerOfferModal />\n    <MarginCallModal />\n    {game.pendingDecision && !rollAnimation && <DecisionSheet decision={game.pendingDecision} dispatch={dispatch} />}",
)
once(
  '<ReportLine label="Возврат перепродаж" value={report.resaleReturns} income />',
  '<ReportLine label="Возврат перепродаж" value={report.resaleReturns} income /><ReportLine label="Доход от контрактов" value={report.contractReturns ?? 0} income />',
)
once(
  '      <button className="sell-button" disabled={game.phase !== \'ready\'} onClick={() => dispatch({ type: \'SELL_ASSET\', assetId: asset.id })}>Продать по рынку</button>',
  '      <button className="sell-button" disabled={game.phase !== \'ready\'} onClick={() => dispatch({ type: \'SELL_ASSET\', assetId: asset.id })}>Продать срочно · 93% рынка</button>',
)
once(
  '    <div className="saving-card"><Metric label="Депозит" value={money(player.deposit)} /><Metric label="Облигации" value={money(player.bonds)} /></div>',
  '    <AssetSalesCore />\n    <div className="saving-card"><Metric label="Депозит" value={money(player.deposit)} /><Metric label="Облигации" value={money(player.bonds)} /></div>',
)
once(
  '<small>{quote.name} · средняя {money(holding.averagePrice)}</small>',
  '<small>{quote.name} · средняя {money(holding.averagePrice)} · свободно {Math.max(0, holding.quantity - (holding.pledgedQuantity ?? 0))} · заложено {holding.pledgedQuantity ?? 0}</small>',
)
once(
  "    {player.resaleDeals.length > 0 && <div className=\"portfolio-section\"><div className=\"portfolio-heading\"><span><small>ТОВАРЫ НА ПЕРЕПРОДАЖЕ</small><b>{player.resaleDeals.length} активных</b></span></div>{player.resaleDeals.map((deal) => <div className=\"holding-row\" key={deal.id}><span><b>{deal.title}</b><small>Вложено {money(deal.investment)} · результат в месяце {deal.resolvesMonth}</small></span><strong>{deal.delays ? 'Задержка' : 'В работе'}<small>ожидание {money(deal.expectedMin)} - {money(deal.expectedMax)}</small></strong></div>)}</div>}",
  "    {player.resaleDeals.length > 0 && <div className=\"portfolio-section\"><div className=\"portfolio-heading\"><span><small>ТОВАРЫ НА ПЕРЕПРОДАЖЕ</small><b>{player.resaleDeals.length} активных</b></span></div>{player.resaleDeals.map((deal) => <div className=\"holding-row\" key={deal.id}><span><b>{deal.title}</b><small>Вложено {money(deal.investment)} · результат в месяце {deal.resolvesMonth}</small></span><strong>{deal.delays ? 'Задержка' : 'В работе'}<small>ожидание {money(deal.expectedMin)} - {money(deal.expectedMax)}</small></strong></div>)}</div>}\n    {player.activeContracts.length > 0 && <div className=\"portfolio-section\"><div className=\"portfolio-heading\"><span><small>КОНТРАКТЫ</small><b>{player.activeContracts.length} в работе</b></span></div>{player.activeContracts.map((contract) => <div className=\"holding-row\" key={contract.id}><span><b>{contract.title}</b><small>Вложено {money(contract.investment)} · результат в месяце {contract.resolvesMonth}</small></span><strong>{Math.round(contract.successChance * 100)}%<small>выплата {money(contract.payout)}</small></strong></div>)}</div>}",
)

between('function DecisionSheet(', '\nfunction GameResult', `function DecisionSheet({ decision, dispatch }: { decision: Decision; dispatch: (command: GameCommand) => boolean }) {
  const game = useGameStore((store) => store.game)
  const player = game.players[0]
  const commonSkip = <button className="ghost-action" onClick={() => dispatch({ type: 'SKIP_DECISION' })}>Пропустить и завершить ход</button>
  let body: React.ReactNode

  if (decision.kind === 'business' || decision.kind === 'opportunity') {
    const business = businesses.find((item) => item.id === decision.businessId)!
    const financedLoan = Math.min(decision.askingPrice, Math.round(business.loan * (decision.askingPrice / business.price)))
    const payment = loanPayment(financedLoan, business.loanRate, business.loanTermMonths)
    const flow = business.revenue - business.operatingCosts - payment
    body = <>
      {decision.kind === 'business' ? <div className="deal-title"><span>{business.icon}</span><div><small>{business.category} · уровень {business.requiredLevel}</small><h2>{business.name}</h2></div></div> : <><div className="decision-symbol good-bg">★</div><span className="eyebrow">РЕДКАЯ ВОЗМОЖНОСТЬ</span><h2>{decision.title}</h2><p>{decision.description}</p></>}
      <div className="deal-grid"><Metric label="Цена" value={money(decision.askingPrice)} /><Metric label="Первый взнос" value={money(Math.max(0, decision.askingPrice - financedLoan))} /><Metric label="Риск" value={business.riskRating === 'low' ? 'Низкий' : business.riskRating === 'medium' ? 'Средний' : 'Высокий'} /><Metric label="Поток после запуска" value={money(flow) + '/мес'} good={flow >= 0} bad={flow < 0} /></div>
      <div className="bank-verdict"><div><small>ПРОВЕРКА ДОКУМЕНТОВ</small><b>{decision.inspection && decision.inspection !== 'none' ? (decision.issueRevealed ? (decision.hiddenIssue && decision.hiddenIssue !== 'none' ? 'Найдена проблема' : 'Проверка чистая') : 'Результат неоднозначный') : 'Не проводилась'}</b></div><span>{decision.issueRevealed && decision.hiddenIssue && decision.hiddenIssue !== 'none' ? ({ documents: 'Проблемы с документами или лицензией', lease: 'Риск по аренде', repair: 'Скрытый ремонт', 'hidden-debt': 'Скрытый долг' } as const)[decision.hiddenIssue] : 'Без проверки риск скрытых проблем выше'}</span></div>
      {(!decision.inspection || decision.inspection === 'none') && <div className="split-actions two"><button onClick={() => dispatch({ type: 'INSPECT_BUSINESS', level: 'basic' })}>Базовая проверка</button><button onClick={() => dispatch({ type: 'INSPECT_BUSINESS', level: 'full' })}>Полная проверка</button></div>}
      {decision.kind === 'business' && !decision.negotiated && <div className="negotiation"><div><b>Попробовать торг</b><small>Чем ниже цена, тем выше шанс потерять сделку</small></div><div><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.95 })}>−5%</button><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.9 })}>−10%</button><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.85 })}>−15%</button></div></div>}
      {decision.kind === 'business' && decision.negotiationNote && <div className="negotiation-note">{decision.negotiationNote}</div>}
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
`)

fs.writeFileSync(path, source)
console.log('materialized v1.4 App')
