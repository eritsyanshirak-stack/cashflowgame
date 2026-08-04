from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f'Missing anchor in {path}: {old[:120]}')
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'Expected one regex replacement in {path}, got {count}: {pattern[:120]}')
    write(path, updated)


# Commands carry a financing plan. The engine executes the plan on a cloned state,
# so a failed purchase rolls every sale and pledge back automatically.
types_path = 'src/game/domain/types.ts'
replace_once(
    types_path,
    "  | { type: 'BUY_BUSINESS'; funding: Funding; collateralAssetId?: string }",
    "  | { type: 'BUY_BUSINESS'; funding: Funding; collateralAssetId?: string; saleAssetIds?: string[] }",
)
replace_once(
    types_path,
    "  | { type: 'BUY_OPPORTUNITY'; funding: Funding; collateralAssetId?: string }",
    "  | { type: 'BUY_OPPORTUNITY'; funding: Funding; collateralAssetId?: string; saleAssetIds?: string[] }",
)

engine_path = 'src/game/engine/engine.ts'
helper = r'''
const liquidateAssetsForDeal = (player: Player, saleAssetIds: string[] | undefined, collateralAssetId?: string) => {
  const ids = [...new Set(saleAssetIds ?? [])]
  if (collateralAssetId && ids.includes(collateralAssetId)) {
    return { ok: false as const, error: 'Один актив нельзя одновременно продать и заложить' }
  }
  const assets = ids.map((id) => player.assets.find((asset) => asset.id === id))
  if (assets.some((asset) => !asset)) return { ok: false as const, error: 'Один из выбранных активов уже недоступен' }

  const sold: Array<{ name: string; proceeds: number }> = []
  for (const asset of assets as Asset[]) {
    const result = sellAsset(player, asset, assetMarketValue(asset))
    sold.push({ name: asset.name, proceeds: result.proceeds })
  }
  return { ok: true as const, sold }
}

'''
replace_once(engine_path, "const awardProgress =", helper + "const awardProgress =")

business_handler = r'''  if (command.type === 'BUY_BUSINESS') {
    if (decision.kind !== 'business') return reject(current, 'Сейчас нет сделки')
    const business = businesses.find((item) => item.id === decision.businessId)
    if (!business || business.requiredLevel > playerLevel(player)) return reject(current, `Для этой сделки нужен уровень ${business?.requiredLevel ?? '?'}`)

    const liquidation = liquidateAssetsForDeal(player, command.saleAssetIds, command.collateralAssetId)
    if (!liquidation.ok) return reject(current, liquidation.error)
    const asset = makeAsset(state, player, decision.businessId, command.funding, decision.askingPrice, command.collateralAssetId, decision.inspection ?? 'none', decision.hiddenIssue ?? 'none')
    if (!asset) return reject(current, command.funding === 'cash' ? 'Даже после продажи выбранных активов денег не хватает' : command.funding.startsWith('partner') ? 'Не хватает денег даже с долей партнёра' : 'Банк не одобрил итоговую схему финансирования')

    player.assets.push(asset)
    if (liquidation.sold.length > 0) {
      const total = liquidation.sold.reduce((sum, item) => sum + item.proceeds, 0)
      addEvent(state, 'Активы проданы для сделки', `${liquidation.sold.map((item) => item.name).join(', ')}. На первый взнос направлено ${total.toLocaleString('ru-RU')} ₽.`, 'neutral')
    }
    awardProgress(state, player, 60, 'finance', 10)
    addEvent(state, 'Новый актив', `${asset.name}, доля ${Math.round(asset.ownership * 100)}%`, 'good')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  if (command.type === 'BUY_OPPORTUNITY') {'''
regex_once(
    engine_path,
    r"  if \(command\.type === 'BUY_BUSINESS'\) \{.*?\n  \}\n\n  if \(command\.type === 'BUY_OPPORTUNITY'\) \{",
    business_handler,
)

opportunity_handler = r'''  if (command.type === 'BUY_OPPORTUNITY') {
    if (decision.kind !== 'opportunity') return reject(current, 'Сейчас нет редкой сделки')
    const deal = rareDeals.find((item) => item.id === decision.opportunityId)
    if (!deal || deal.minLevel > playerLevel(player)) return reject(current, `Для этой возможности нужен уровень ${deal?.minLevel ?? '?'}`)

    const liquidation = liquidateAssetsForDeal(player, command.saleAssetIds, command.collateralAssetId)
    if (!liquidation.ok) return reject(current, liquidation.error)
    const asset = makeAsset(state, player, decision.businessId, command.funding, decision.askingPrice, command.collateralAssetId, decision.inspection ?? 'none', decision.hiddenIssue ?? 'none')
    if (!asset) return reject(current, 'Не удалось профинансировать эту возможность выбранной схемой')

    player.assets.push(asset)
    if (liquidation.sold.length > 0) {
      const total = liquidation.sold.reduce((sum, item) => sum + item.proceeds, 0)
      addEvent(state, 'Активы проданы для возможности', `${liquidation.sold.map((item) => item.name).join(', ')}. Получено ${total.toLocaleString('ru-RU')} ₽.`, 'neutral')
    }
    awardProgress(state, player, 85, 'finance', 14)
    addEvent(state, 'Редкая возможность куплена', `${decision.title}: ${asset.name} за ${decision.askingPrice.toLocaleString('ru-RU')} ₽.`, 'good')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  if (command.type === 'PAY_EXPENSE') {'''
regex_once(
    engine_path,
    r"  if \(command\.type === 'BUY_OPPORTUNITY'\) \{.*?\n  \}\n\n  if \(command\.type === 'PAY_EXPENSE'\) \{",
    opportunity_handler,
)

app_path = 'src/App.tsx'
planner_prelude = r'''  const player = game.players[0]
  const [saleAssetIds, setSaleAssetIds] = useState<string[]>([])
  const toggleSaleAsset = (assetId: string) => setSaleAssetIds((current) =>
    current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId],
  )
  const commonSkip = <button className="ghost-action" onClick={() => dispatch({ type: 'SKIP_DECISION' })}>Пропустить и завершить ход</button>

  const renderFundingPlanner = (
    business: (typeof businesses)[number],
    askingPrice: number,
    buy: (funding: Funding, collateralAssetId?: string) => boolean,
  ) => {
    const financedLoan = Math.min(askingPrice, Math.round(business.loan * (askingPrice / business.price)))
    const businessPayment = loanPayment(financedLoan, business.loanRate, business.loanTermMonths)
    const downPayment = Math.max(0, askingPrice - financedLoan)
    const selectedAssets = player.assets.filter((asset) => saleAssetIds.includes(asset.id))
    const saleProceeds = selectedAssets.reduce((sum, asset) => sum + assetLiquidationProceeds(player, asset), 0)
    const cashAfterSales = player.cash + saleProceeds
    const remainingGap = Math.max(0, downPayment - cashAfterSales)
    const projectedOperatingIncome = business.revenue - business.operatingCosts
    const hasBuyerContribution = cashAfterSales >= downPayment * 0.3
    const unsecured = assessLoan(player, remainingGap, game.difficulty, undefined, projectedOperatingIncome, businessPayment)
    const collateralOffers = player.assets
      .filter((asset) => !saleAssetIds.includes(asset.id))
      .map((asset) => ({ asset, offer: assessLoan(player, remainingGap, game.difficulty, asset, projectedOperatingIncome, businessPayment) }))
      .filter(({ offer }) => remainingGap > 0 && offer.approved)

    return <>
      <div className="cash-check"><span>Свои деньги</span><strong>{money(player.cash)}</strong></div>
      {player.assets.length > 0 && <div className="deal-financing-panel">
        <div className="portfolio-heading"><span><small>СОБРАТЬ ФИНАНСИРОВАНИЕ</small><b>Продать активы для первого взноса</b></span><strong className={saleProceeds > 0 ? 'good' : ''}>+{money(saleProceeds)}</strong></div>
        <div className="funding-actions">{player.assets.map((asset) => {
          const proceeds = assetLiquidationProceeds(player, asset)
          const selected = saleAssetIds.includes(asset.id)
          return <button type="button" key={asset.id} aria-pressed={selected} className={selected ? 'selected-funding' : ''} onClick={() => toggleSaleAsset(asset.id)}>
            <b>{selected ? '✓ Продать' : 'Продать'} {asset.name}</b>
            <small>На руки {money(proceeds)} · поток {money(assetCashflow(asset))}/мес</small>
          </button>
        })}</div>
      </div>}
      <div className="deal-funding-summary">
        <span>После выбранных продаж <b>{money(cashAfterSales)}</b></span>
        <span>Осталось найти <b className={remainingGap > 0 ? 'bad' : 'good'}>{money(remainingGap)}</b></span>
      </div>
      <button className="primary-action" disabled={remainingGap > 0} onClick={() => buy('cash')}>
        {saleAssetIds.length > 0 ? 'Продать выбранные и купить' : 'Купить за свои'} <span>→</span>
      </button>
      <div className="funding-actions">
        {remainingGap > 0 && unsecured.approved && hasBuyerContribution && <button onClick={() => buy('credit')}><b>{saleAssetIds.length > 0 ? 'Продать активы + кредит' : 'Наличными + кредит'}</b><small>Банк добавит {money(remainingGap)} · {money(unsecured.monthlyPayment)}/мес</small></button>}
        {collateralOffers.map(({ asset, offer }) => <button key={asset.id} onClick={() => buy('secured', asset.id)}><b>{saleAssetIds.length > 0 ? 'Продать выбранные + ' : ''}заложить {asset.name}</b><small>Получить {money(remainingGap)} · {Math.round(offer.annualRate * 100)}% · {money(offer.monthlyPayment)}/мес</small></button>)}
        <button disabled={cashAfterSales < Math.round(downPayment * .7)} onClick={() => buy('partner30')}><b>{saleAssetIds.length > 0 ? 'Продажа + партнёр 30%' : 'Партнёр 30%'}</b><small>Твой взнос {money(Math.round(downPayment * .7))}</small></button>
        <button disabled={cashAfterSales < Math.round(downPayment * .5)} onClick={() => buy('partner50')}><b>{saleAssetIds.length > 0 ? 'Продажа + партнёр 50%' : 'Партнёр 50%'}</b><small>Твой взнос {money(Math.round(downPayment * .5))}</small></button>
      </div>
      {remainingGap > 0 && !unsecured.approved && collateralOffers.length === 0 && <div className="bank-verdict declined"><b>Текущая схема не проходит</b><span>{unsecured.reason}. Выбери другой актив для продажи или залога.</span></div>}
    </>
  }

  let body: React.ReactNode'''
regex_once(
    app_path,
    r"  const player = game\.players\[0\]\n  const commonSkip = .*?\n  let body: React\.ReactNode",
    planner_prelude,
)

business_ui = r'''  if (decision.kind === 'business') {
    const business = businesses.find((item) => item.id === decision.businessId)!
    const financedLoan = Math.min(decision.askingPrice, Math.round(business.loan * (decision.askingPrice / business.price)))
    const payment = loanPayment(financedLoan, business.loanRate, business.loanTermMonths)
    const flow = business.revenue - business.operatingCosts - payment
    const buy = (funding: Funding, collateralAssetId?: string) => dispatch({ type: 'BUY_BUSINESS', funding, collateralAssetId, saleAssetIds })
    body = <><div className="deal-title"><span>{business.icon}</span><div><small>{business.category} · уровень {business.requiredLevel}</small><h2>{business.name}</h2></div></div>
      <div className="deal-grid"><Metric label="Цена" value={money(decision.askingPrice)} /><Metric label="Первый взнос" value={money(Math.max(0, decision.askingPrice - financedLoan))} /><Metric label="Риск" value={business.riskRating === 'low' ? 'Низкий' : business.riskRating === 'medium' ? 'Средний' : 'Высокий'} /><Metric label="Поток после запуска" value={`${money(flow)}/мес`} good={flow >= 0} bad={flow < 0} /></div>
      <div className="bank-verdict"><div><small>ПРОВЕРКА ДОКУМЕНТОВ</small><b>{decision.inspection && decision.inspection !== 'none' ? (decision.issueRevealed ? (decision.hiddenIssue && decision.hiddenIssue !== 'none' ? 'Найдена проблема' : 'Проверка чистая') : 'Результат неоднозначный') : 'Не проводилась'}</b></div><span>{decision.issueRevealed && decision.hiddenIssue && decision.hiddenIssue !== 'none' ? ({ documents: 'Проблемы с документами или лицензией', lease: 'Риск по аренде', repair: 'Скрытый ремонт', 'hidden-debt': 'Скрытый долг' } as const)[decision.hiddenIssue] : 'Без проверки риск скрытых проблем выше'}</span></div>
      {(!decision.inspection || decision.inspection === 'none') && <div className="split-actions two"><button onClick={() => dispatch({ type: 'INSPECT_BUSINESS', level: 'basic' })}>Базовая проверка</button><button onClick={() => dispatch({ type: 'INSPECT_BUSINESS', level: 'full' })}>Полная проверка</button></div>}
      {!decision.negotiated && <div className="negotiation"><div><b>Попробовать торг</b><small>Чем ниже цена, тем выше шанс потерять сделку</small></div><div><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.95 })}>−5%</button><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.9 })}>−10%</button><button onClick={() => dispatch({ type: 'NEGOTIATE_BUSINESS', offerPercent: 0.85 })}>−15%</button></div></div>}
      {decision.negotiationNote && <div className="negotiation-note">{decision.negotiationNote}</div>}
      {renderFundingPlanner(business, decision.askingPrice, buy)}
      {commonSkip}</>
  } else if (decision.kind === 'opportunity') {'''
regex_once(
    app_path,
    r"  if \(decision\.kind === 'business'\) \{.*?\n  \} else if \(decision\.kind === 'opportunity'\) \{",
    business_ui,
)

opportunity_ui = r'''  } else if (decision.kind === 'opportunity') {
    const business = businesses.find((item) => item.id === decision.businessId)!
    const financedLoan = Math.min(decision.askingPrice, Math.round(business.loan * (decision.askingPrice / business.price)))
    const payment = loanPayment(financedLoan, business.loanRate, business.loanTermMonths)
    const flow = business.revenue - business.operatingCosts - payment
    const buy = (funding: Funding, collateralAssetId?: string) => dispatch({ type: 'BUY_OPPORTUNITY', funding, collateralAssetId, saleAssetIds })
    body = <><div className="decision-symbol good-bg">★</div><span className="eyebrow">РЕДКАЯ ВОЗМОЖНОСТЬ</span><h2>{decision.title}</h2><p>{decision.description}</p>
      <div className="deal-grid"><Metric label="Цена сделки" value={money(decision.askingPrice)} /><Metric label="Обычная цена" value={money(business.price)} /><Metric label="Первый взнос" value={money(Math.max(0, decision.askingPrice - financedLoan))} /><Metric label="Поток после запуска" value={`${money(flow)}/мес`} good={flow >= 0} bad={flow < 0} /></div>
      <div className="bank-verdict"><div><small>ПРОВЕРКА ДОКУМЕНТОВ</small><b>{decision.inspection && decision.inspection !== 'none' ? (decision.issueRevealed ? (decision.hiddenIssue && decision.hiddenIssue !== 'none' ? 'Обнаружен риск' : 'Существенных проблем нет') : 'Не всё удалось подтвердить') : 'Не проводилась'}</b></div><span>{decision.issueRevealed && decision.hiddenIssue && decision.hiddenIssue !== 'none' ? ({ documents: 'Проблемы с правами или лицензией', lease: 'Проблемный договор аренды', repair: 'Нужен скрытый ремонт', 'hidden-debt': 'Есть неучтённый долг' } as const)[decision.hiddenIssue] : 'Низкая цена может иметь причину'}</span></div>
      {(!decision.inspection || decision.inspection === 'none') && <div className="split-actions two"><button onClick={() => dispatch({ type: 'INSPECT_BUSINESS', level: 'basic' })}>Базовая проверка</button><button onClick={() => dispatch({ type: 'INSPECT_BUSINESS', level: 'full' })}>Полная проверка</button></div>}
      {renderFundingPlanner(business, decision.askingPrice, buy)}
      {commonSkip}</>
  } else if (decision.kind === 'expense')'''
regex_once(
    app_path,
    r"  \} else if \(decision\.kind === 'opportunity'\) \{.*?\n  \} else if \(decision\.kind === 'expense'\)",
    opportunity_ui,
)

# Add small, explicit mobile styles. Existing components and palette remain untouched.
css_path = 'src/premium.css'
css = read(css_path)
css += r'''

.deal-financing-panel {
  margin: 14px 0;
  padding: 14px;
  border: 1px solid rgba(22, 101, 76, .18);
  border-radius: 18px;
  background: rgba(247, 250, 247, .86);
}
.funding-actions button.selected-funding {
  border-color: #17694f;
  box-shadow: inset 0 0 0 1px #17694f;
  background: rgba(23, 105, 79, .08);
}
.deal-funding-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 12px 0;
}
.deal-funding-summary span {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 11px 12px;
  border-radius: 14px;
  background: rgba(20, 30, 27, .055);
  font-size: 12px;
  color: #7b817f;
}
.deal-funding-summary b { font-size: 14px; color: #222827; }
'''
write(css_path, css)

# Engine tests for atomicity and mixed financing.
test_path = Path('src/game/engine/deal-financing.test.ts')
test_path.write_text(r'''import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import type { Asset } from '../domain/types'
import { loanPayment } from '../systems/economy'
import { emptyGame, executeCommand } from './engine'

const startedGame = () => executeCommand(emptyGame(77), { type: 'START_GAME', professionId: 'trainer', seed: 77 }).state

const testAsset = (businessId: string, ownerId: string, id: string): Asset => {
  const business = businesses.find((item) => item.id === businessId)!
  return {
    ...business,
    id,
    ownerId,
    ownership: 1,
    monthlyPayment: loanPayment(business.loan, business.loanRate, business.loanTermMonths),
    purchaseMonth: 1,
    developmentLevel: 0,
    developments: [],
    totalDevelopmentCost: 0,
    lastDevelopedMonth: null,
    saleOffer: null,
    offerExpiresMonth: null,
    status: 'active',
    dueDiligence: 'none',
    launchMonthsRemaining: 0,
    incidentCooldown: 0,
    issueMonths: 0,
    missedPayments: 0,
  }
}

describe('deal financing planner', () => {
  it('sells a selected asset and uses only its net proceeds for the purchase', () => {
    const game = startedGame()
    const player = game.players[0]
    const vending = testAsset('vending', player.id, 'sell-vending')
    player.assets = [vending]
    player.cash = 60_000
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'coffee', askingPrice: 480_000, negotiated: false }

    const result = executeCommand(game, { type: 'BUY_BUSINESS', funding: 'cash', saleAssetIds: [vending.id] })

    expect(result.accepted).toBe(true)
    expect(result.state.players[0].assets).toHaveLength(1)
    expect(result.state.players[0].assets[0].id).not.toBe(vending.id)
    expect(result.state.players[0].assets[0].name).toBe('Кофейный островок')
    expect(result.state.players[0].cash).toBe(0)
  })

  it('rolls the whole plan back when the final purchase cannot be funded', () => {
    const game = startedGame()
    const player = game.players[0]
    const vending = testAsset('vending', player.id, 'rollback-vending')
    player.assets = [vending]
    player.cash = 0
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'coffee', askingPrice: 480_000, negotiated: false }

    const result = executeCommand(game, { type: 'BUY_BUSINESS', funding: 'cash', saleAssetIds: [vending.id] })

    expect(result.accepted).toBe(false)
    expect(result.state.players[0].cash).toBe(0)
    expect(result.state.players[0].assets.map((asset) => asset.id)).toEqual([vending.id])
    expect(result.state.phase).toBe('decision')
  })

  it('combines a sale with a secured loan and forbids selling the collateral', () => {
    const game = startedGame()
    const player = game.players[0]
    const vending = testAsset('vending', player.id, 'mixed-vending')
    const collateral = testAsset('vending', player.id, 'strong-collateral')
    collateral.marketValue = 1_000_000
    collateral.loan = 0
    collateral.monthlyPayment = 0
    collateral.revenue = 150_000
    collateral.operatingCosts = 20_000
    player.assets = [vending, collateral]
    player.cash = 20_000
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'coffee', askingPrice: 480_000, negotiated: false }

    const mixed = executeCommand(game, {
      type: 'BUY_BUSINESS', funding: 'secured', saleAssetIds: [vending.id], collateralAssetId: collateral.id,
    })
    expect(mixed.accepted).toBe(true)
    expect(mixed.state.players[0].assets.some((asset) => asset.id === collateral.id)).toBe(true)
    expect(mixed.state.players[0].loans.some((loan) => loan.collateralAssetId === collateral.id)).toBe(true)

    const invalid = executeCommand(game, {
      type: 'BUY_BUSINESS', funding: 'secured', saleAssetIds: [collateral.id], collateralAssetId: collateral.id,
    })
    expect(invalid.accepted).toBe(false)
    expect(invalid.error).toContain('одновременно')
  })
})
''', encoding='utf-8')

print('Atomic deal financing source transformation complete')
