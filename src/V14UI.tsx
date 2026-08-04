import { useEffect, useMemo, useState } from 'react'
import { businesses } from './game/content/content'
import type { Asset, Decision, Funding, GameCommand } from './game/domain/types'
import { assessLoan, assetCashflow, assetLiquidationProceeds, assetMarketValue, availableCollateral, loanPayment, pledgedLoanForAsset, totalDebt } from './game/systems/economy'
import { calculateStockSale } from './game/systems/stockSale'
import { availableStockCollateral, listingMonthsRemaining, stockFreeQuantity } from './game/systems/v14'
import { useGameStore } from './store/gameStore'

const money = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`
const percent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`

export function GlobalEventBanner() {
  const event = useGameStore((store) => store.game.globalEvent)
  const month = useGameStore((store) => store.game.month)
  if (!event) return null
  return <section className="v14-global-event">
    <span>СОБЫТИЕ РЫНКА · ЕЩЁ {Math.max(1, event.expiresMonth - month)} МЕС.</span>
    <b>{event.title}</b>
    <small>{event.description}</small>
  </section>
}

const quickSaleImpact = (player: ReturnType<typeof useGameStore.getState>['game']['players'][number], asset: Asset) => {
  const grossPrice = Math.round(assetMarketValue(asset) * 0.93)
  const collateralDebt = pledgedLoanForAsset(player, asset.id)?.balance ?? 0
  const securedDebt = asset.loan + collateralDebt
  return {
    grossPrice,
    proceeds: Math.max(0, grossPrice - securedDebt),
    deficiency: Math.max(0, securedDebt - grossPrice),
  }
}

export function DealFinancingCore({ decision }: { decision: Extract<Decision, { kind: 'business' | 'opportunity' }> }) {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const player = game.players[0]
  const business = businesses.find((item) => item.id === decision.businessId)
  const [saleAssetIds, setSaleAssetIds] = useState<string[]>([])
  const [collateralAssetId, setCollateralAssetId] = useState<string>()

  useEffect(() => {
    setSaleAssetIds([])
    setCollateralAssetId(undefined)
  }, [decision.businessId, decision.askingPrice])

  if (!business) return null
  const financedLoan = Math.min(decision.askingPrice, Math.round(business.loan * (decision.askingPrice / business.price)))
  const businessPayment = loanPayment(financedLoan, business.loanRate, business.loanTermMonths)
  const downPayment = Math.max(0, decision.askingPrice - financedLoan)
  const selectedAssets = player.assets.filter((asset) => saleAssetIds.includes(asset.id))
  const financingPlayer = structuredClone(player)
  let saleProceeds = 0
  let deficiency = 0
  let lostFlow = 0

  for (const asset of selectedAssets) {
    const impact = quickSaleImpact(player, asset)
    saleProceeds += impact.proceeds
    deficiency += impact.deficiency
    lostFlow += assetCashflow(asset)
    financingPlayer.assets = financingPlayer.assets.filter((item) => item.id !== asset.id)
    financingPlayer.loans = financingPlayer.loans.filter((loan) => loan.collateralAssetId !== asset.id)
    financingPlayer.cash += impact.proceeds
    if (impact.deficiency > 0) financingPlayer.loans.push({
      id: `preview-deficiency-${asset.id}`,
      name: `Остаток после продажи: ${asset.name}`,
      balance: impact.deficiency,
      monthlyPayment: loanPayment(impact.deficiency, 0.36, 36),
      annualRate: 0.36,
      termMonths: 36,
      missedPayments: 0,
    })
  }

  const cashAfterSales = financingPlayer.cash
  const gap = Math.max(0, downPayment - cashAfterSales)
  const projectedIncome = business.revenue - business.operatingCosts
  const rateDelta = game.globalEvent?.creditRateDelta ?? 0
  const unsecured = assessLoan(financingPlayer, gap, game.difficulty, undefined, projectedIncome, businessPayment, rateDelta)
  const collateralOptions = financingPlayer.assets.map((asset) => ({
    asset,
    limit: availableCollateral(financingPlayer, asset),
    offer: assessLoan(financingPlayer, gap, game.difficulty, asset, projectedIncome, businessPayment, rateDelta),
  }))
  const selectedCollateral = collateralOptions.find(({ asset }) => asset.id === collateralAssetId)

  const toggleSale = (assetId: string) => {
    setSaleAssetIds((current) => current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId])
    if (collateralAssetId === assetId) setCollateralAssetId(undefined)
  }
  const toggleCollateral = (assetId: string) => {
    setCollateralAssetId((current) => current === assetId ? undefined : assetId)
    setSaleAssetIds((current) => current.filter((id) => id !== assetId))
  }
  const buy = (funding: Funding, collateral?: string) => dispatch({
    type: decision.kind === 'business' ? 'BUY_BUSINESS' : 'BUY_OPPORTUNITY',
    funding,
    collateralAssetId: collateral,
    saleAssetIds,
  })

  return <section className="v14-financing">
    <div className="v14-section-title"><span><small>СОБРАТЬ ФИНАНСИРОВАНИЕ</small><b>Продать или заложить актив</b></span><strong>{money(gap)} нужно</strong></div>
    {player.assets.length > 0 && <div className="v14-financing-assets">{player.assets.map((asset) => {
      const impact = quickSaleImpact(player, asset)
      const option = collateralOptions.find((item) => item.asset.id === asset.id)
      const selectedSale = saleAssetIds.includes(asset.id)
      const selectedPledge = collateralAssetId === asset.id
      return <article className={`${selectedSale ? 'selected-sale' : ''} ${selectedPledge ? 'selected-pledge' : ''}`} key={asset.id}>
        <div><b>{asset.name}</b><small>Рынок {money(assetMarketValue(asset))} · поток {money(assetCashflow(asset))}/мес.</small></div>
        <div className="v14-two-actions">
          <button aria-pressed={selectedSale} onClick={() => toggleSale(asset.id)}><b>{selectedSale ? '✓ Продать' : 'Продать'}</b><small>Срочно за {money(impact.grossPrice)} · на руки {money(impact.proceeds)}</small></button>
          <button aria-pressed={selectedPledge} disabled={gap <= 0 || Boolean(pledgedLoanForAsset(player, asset.id)) || !option?.limit} onClick={() => toggleCollateral(asset.id)}><b>{selectedPledge ? '✓ Заложить' : 'Заложить'}</b><small>{pledgedLoanForAsset(player, asset.id) ? 'Уже в залоге' : option?.limit ? `Лимит ${money(option.limit)}` : 'Нет свободной стоимости'}</small></button>
        </div>
      </article>
    })}</div>}
    <div className="v14-summary-grid">
      <span>Свои деньги <b>{money(player.cash)}</b></span>
      <span>После продаж <b>{money(cashAfterSales)}</b></span>
      <span>Первый взнос <b>{money(downPayment)}</b></span>
      <span>Дефицит <b className={gap > 0 ? 'bad' : 'good'}>{money(gap)}</b></span>
    </div>
    {deficiency > 0 && <div className="v14-warning"><b>После продажи останется долг {money(deficiency)}</b><span>Также исчезнет поток {money(lostFlow)}/мес.</span></div>}
    <div className="v14-action-list">
      <button disabled={gap > 0} onClick={() => buy('cash')}><b>{saleAssetIds.length ? 'Продать выбранные и купить' : 'Купить за свои'}</b><small>Без нового кредита</small></button>
      {gap > 0 && <button disabled={!unsecured.approved || cashAfterSales < downPayment * 0.3} onClick={() => buy('credit')}><b>Добавить обычный кредит</b><small>{unsecured.approved ? `${money(gap)} · ${money(unsecured.monthlyPayment)}/мес.` : unsecured.reason}</small></button>}
      {gap > 0 && selectedCollateral && <button disabled={!selectedCollateral.offer.approved} onClick={() => buy('secured', selectedCollateral.asset.id)}><b>Купить под залог {selectedCollateral.asset.name}</b><small>{selectedCollateral.offer.approved ? `${money(gap)} · ${Math.round(selectedCollateral.offer.annualRate * 100)}% · ${money(selectedCollateral.offer.monthlyPayment)}/мес.` : selectedCollateral.offer.reason}</small></button>}
      <button disabled={cashAfterSales < Math.round(downPayment * 0.7)} onClick={() => buy('partner30')}><b>Партнёр получает 30%</b><small>Твой взнос {money(Math.round(downPayment * 0.7))}</small></button>
      <button disabled={cashAfterSales < Math.round(downPayment * 0.5)} onClick={() => buy('partner50')}><b>Партнёр получает 50%</b><small>Твой взнос {money(Math.round(downPayment * 0.5))}</small></button>
    </div>
  </section>
}

export function AssetSalesCore() {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const player = game.players[0]
  const [prices, setPrices] = useState<Record<string, string>>({})

  const defaults = useMemo(() => Object.fromEntries(player.assets.map((asset) => [asset.id, String(Math.round(assetMarketValue(asset) * 1.1))])), [player.assets])
  useEffect(() => setPrices((current) => ({ ...defaults, ...current })), [defaults])
  if (player.assets.length === 0) return null

  return <section className="v14-sales-desk">
    <div className="v14-section-title"><span><small>ПРОДАЖА БИЗНЕСОВ</small><b>Выставить свою цену</b></span></div>
    <p>Цена объявления — от 90% до 140% рынка. Чем выше цена, тем реже покупатели и жёстче торг.</p>
    <div className="v14-listings">{player.assets.map((asset) => {
      const market = assetMarketValue(asset)
      const input = prices[asset.id] ?? String(Math.round(market * 1.1))
      const months = listingMonthsRemaining(game, asset.listingExpiresMonth)
      return <article key={asset.id}>
        <div className="v14-listing-head"><span><b>{asset.name}</b><small>Рынок {money(market)} · срочно {money(Math.round(market * 0.93))}</small></span>{asset.listingPrice ? <strong>{months <= 1 ? 'Последний месяц' : `Осталось ${months} мес.`}</strong> : null}</div>
        {asset.listingPrice && <div className="v14-listing-status"><span>Выставлен за <b>{money(asset.listingPrice)}</b></span><small>Покупатель появится отдельным окном</small></div>}
        <div className="v14-price-entry"><input type="number" inputMode="numeric" min={Math.round(market * 0.9)} max={Math.round(market * 1.4)} step="1000" value={input} onChange={(event) => setPrices((current) => ({ ...current, [asset.id]: event.target.value }))}/><button disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'LIST_ASSET', assetId: asset.id, askingPrice: Number(input) })}>Выставить</button></div>
        <div className="v14-presets">{[.9, 1, 1.1, 1.2, 1.3, 1.4].map((ratio) => <button key={ratio} onClick={() => setPrices((current) => ({ ...current, [asset.id]: String(Math.round(market * ratio)) }))}>{Math.round(ratio * 100)}%</button>)}</div>
        <div className="v14-share-actions"><span>Продать часть бизнеса:</span>{([10, 25, 50] as const).map((share) => <button key={share} disabled={game.phase !== 'ready' || asset.ownership * 100 <= share} onClick={() => dispatch({ type: 'SELL_ASSET_SHARE', assetId: asset.id, percent: share })}>{share}%</button>)}</div>
        <div className="v14-two-actions"><button disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'SELL_ASSET', assetId: asset.id })}>Продать срочно</button>{asset.listingPrice && <button disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'CANCEL_ASSET_LISTING', assetId: asset.id })}>Снять объявление</button>}</div>
      </article>
    })}</div>
  </section>
}

export function BuyerOfferModal() {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const offer = game.buyerOffers[0]
  if (!offer) return null
  const player = game.players[0]
  const asset = player.assets.find((item) => item.id === offer.assetId)
  if (!asset) return null
  const proceeds = assetLiquidationProceeds(player, asset, offer.offeredPrice)
  const difference = offer.offeredPrice / Math.max(1, offer.marketValue) * 100 - 100
  return <div className="sheet-backdrop v14-priority-modal"><section className="decision-sheet v14-offer-modal">
    <div className="sheet-handle"/><span className="eyebrow">ПОКУПАТЕЛЬ НАШЁЛСЯ</span><h2>{offer.buyerName} предлагает сделку</h2>
    <div className="v14-offer-price"><span>{asset.name}<small>Твоя цена {money(offer.askingPrice)} · рынок {money(offer.marketValue)}</small></span><strong>{money(offer.offeredPrice)}<small className={difference >= 0 ? 'good' : 'bad'}>{percent(difference)} к рынку</small></strong></div>
    <div className="v14-summary-grid"><span>Банкам уйдёт <b>{money(Math.min(offer.offeredPrice, asset.loan + (pledgedLoanForAsset(player, asset.id)?.balance ?? 0)))}</b></span><span>Получишь на руки <b className="good">{money(proceeds)}</b></span></div>
    {offer.final && <div className="v14-warning"><b>Это финальная цена покупателя</b><span>Следующий контроффер он уже не рассматривает.</span></div>}
    <button className="primary-action" onClick={() => dispatch({ type: 'RESPOND_BUYER_OFFER', offerId: offer.id, action: 'accept' })}>Принять {money(offer.offeredPrice)} <span>→</span></button>
    {!offer.final && <div className="split-actions"><button onClick={() => dispatch({ type: 'RESPOND_BUYER_OFFER', offerId: offer.id, action: 'counter5' })}>+5%</button><button onClick={() => dispatch({ type: 'RESPOND_BUYER_OFFER', offerId: offer.id, action: 'counter10' })}>+10%</button><button onClick={() => dispatch({ type: 'RESPOND_BUYER_OFFER', offerId: offer.id, action: 'counter15' })}>+15%</button></div>}
    <button className="ghost-action" onClick={() => dispatch({ type: 'RESPOND_BUYER_OFFER', offerId: offer.id, action: 'reject' })}>Отказать и оставить объявление</button>
  </section></div>
}

export function MarginCallModal() {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const call = game.activeMarginCall
  if (!call) return null
  const quote = game.stockMarket.find((item) => item.id === call.stockId)
  const player = game.players[0]
  return <div className="sheet-backdrop v14-priority-modal"><section className="decision-sheet">
    <div className="decision-symbol bad-bg">!</div><span className="eyebrow">МАРЖИН-КОЛЛ</span><h2>{quote?.ticker ?? 'Акции'} упали слишком сильно</h2>
    <p>Залог сейчас стоит {money(call.marketValue)}, а долг — {money(call.balance)}. Банк требует восстановить запас.</p>
    <div className="v14-action-list"><button disabled={player.cash < call.requiredPayment} onClick={() => dispatch({ type: 'RESOLVE_MARGIN_CALL', action: 'pay' })}><b>Довнести {money(call.requiredPayment)}</b><small>Сохранить акции в залоге</small></button><button onClick={() => dispatch({ type: 'RESOLVE_MARGIN_CALL', action: 'sell' })}><b>Продать часть залога</b><small>Банк продаст необходимое количество акций</small></button><button disabled={player.cash < call.balance} onClick={() => dispatch({ type: 'RESOLVE_MARGIN_CALL', action: 'close' })}><b>Закрыть кредит полностью</b><small>{money(call.balance)}</small></button></div>
  </section></div>
}

function StockFinancePanel({ stockId, onClose }: { stockId: string; onClose: () => void }) {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const player = game.players[0]
  const quote = game.stockMarket.find((item) => item.id === stockId)!
  const [quantity, setQuantity] = useState(5)
  const [funding, setFunding] = useState<'cash' | 'credit' | 'secured'>('cash')
  const [saleAssetId, setSaleAssetId] = useState<string>()
  const [shareAssetId, setShareAssetId] = useState<string>()
  const [sharePercent, setSharePercent] = useState<10 | 25 | 50>(10)
  const [collateralAssetId, setCollateralAssetId] = useState<string>()
  const cost = Math.ceil(quote.price * quantity * 1.015)

  const buy = () => {
    const accepted = dispatch({
      type: 'BUY_STOCK', stockId, quantity, funding,
      saleAssetIds: saleAssetId ? [saleAssetId] : undefined,
      shareSaleAssetId: shareAssetId,
      shareSalePercent: shareAssetId ? sharePercent : undefined,
      collateralAssetId: funding === 'secured' ? collateralAssetId : undefined,
    })
    if (accepted) onClose()
  }

  return <section className="v14-stock-finance">
    <div className="v14-section-title"><span><small>ПОКУПКА АКЦИЙ</small><b>{quote.ticker} · {money(quote.price)}/шт.</b></span><button onClick={onClose}>×</button></div>
    <label>Количество<input type="number" inputMode="numeric" min="1" max="999" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))}/></label>
    <div className="v14-summary-grid"><span>Стоимость с комиссией <b>{money(cost)}</b></span><span>Денег сейчас <b>{money(player.cash)}</b></span></div>
    <div className="v14-choice-tabs"><button className={funding === 'cash' ? 'active' : ''} onClick={() => setFunding('cash')}>Свои</button><button className={funding === 'credit' ? 'active' : ''} onClick={() => setFunding('credit')}>Кредит</button><button className={funding === 'secured' ? 'active' : ''} onClick={() => setFunding('secured')}>Под залог</button></div>
    {player.assets.length > 0 && <div className="v14-finance-extra"><b>Дополнительно освободить деньги</b><select value={saleAssetId ?? ''} onChange={(event) => { setSaleAssetId(event.target.value || undefined); if (event.target.value) setShareAssetId(undefined) }}><option value="">Не продавать бизнес целиком</option>{player.assets.filter((asset) => asset.id !== collateralAssetId).map((asset) => <option key={asset.id} value={asset.id}>Срочно продать: {asset.name} · на руки {money(quickSaleImpact(player, asset).proceeds)}</option>)}</select><div className="v14-share-select"><select value={shareAssetId ?? ''} onChange={(event) => { setShareAssetId(event.target.value || undefined); if (event.target.value) setSaleAssetId(undefined) }}><option value="">Не продавать долю бизнеса</option>{player.assets.filter((asset) => asset.id !== collateralAssetId).map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select><select value={sharePercent} disabled={!shareAssetId} onChange={(event) => setSharePercent(Number(event.target.value) as 10 | 25 | 50)}><option value={10}>10%</option><option value={25}>25%</option><option value={50}>50%</option></select></div></div>}
    {funding === 'secured' && <div className="v14-finance-extra"><b>Какой бизнес заложить</b><select value={collateralAssetId ?? ''} onChange={(event) => { setCollateralAssetId(event.target.value || undefined); if (event.target.value === saleAssetId) setSaleAssetId(undefined); if (event.target.value === shareAssetId) setShareAssetId(undefined) }}><option value="">Выбери актив</option>{player.assets.filter((asset) => !pledgedLoanForAsset(player, asset.id) && availableCollateral(player, asset) > 0).map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · лимит {money(availableCollateral(player, asset))}</option>)}</select></div>}
    <button className="primary-action" disabled={funding === 'secured' && !collateralAssetId} onClick={buy}>Купить {quantity} шт. <span>→</span></button>
  </section>
}

export function MarketDecision() {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const player = game.players[0]
  const [financeStockId, setFinanceStockId] = useState<string>()
  return <>
    <span className="eyebrow">БИРЖА · МЕСЯЦ {game.month}</span><h2>{game.marketHeadline}</h2>
    <p>Акции можно купить за свои, в кредит или под залог бизнеса. Залог самих акций создаёт риск маржин-колла.</p>
    <div className="v14-stock-list">{game.stockMarket.map((quote) => {
      const holding = player.stocks.find((item) => item.stockId === quote.id)
      const free = holding ? stockFreeQuantity(holding) : 0
      const change = quote.previousPrice ? (quote.price / quote.previousPrice - 1) * 100 : 0
      const result = holding ? calculateStockSale(holding.averagePrice, quote.price, free) : null
      return <article key={quote.id}>
        <div className="v14-stock-head"><span><b>{quote.ticker}</b><small>{quote.name} · див. {(quote.dividendYield * 100).toFixed(1)}%</small></span><strong>{money(quote.price)}<small className={change >= 0 ? 'good' : 'bad'}>{percent(change)}</small></strong></div>
        {holding && <><div className="v14-summary-grid"><span>Куплено <b>{holding.quantity} шт. · средняя {money(holding.averagePrice)}</b></span><span>Свободно / заложено <b>{free} / {holding.pledgedQuantity ?? 0}</b></span><span>Получишь за свободные <b>{money(result?.proceeds ?? 0)}</b></span><span>Прибыль / убыток <b className={(result?.profit ?? 0) >= 0 ? 'good' : 'bad'}>{money(result?.profit ?? 0)} · {percent(result?.profitPercent ?? 0)}</b></span></div><div className="v14-stock-percent"><span>Продать:</span>{([25, 50, 75, 100] as const).map((share) => { const quantity = Math.max(1, Math.floor(free * share / 100)); return <button key={share} disabled={free <= 0} onClick={() => dispatch({ type: 'SELL_STOCK', stockId: quote.id, quantity })}>{share}%</button> })}</div><div className="v14-stock-percent"><span>Заложить:</span>{([25, 50, 75, 100] as const).map((share) => <button key={share} disabled={free <= 0 || availableStockCollateral(player, holding, quote) <= 0} onClick={() => dispatch({ type: 'PLEDGE_STOCK', stockId: quote.id, percent: share })}>{share}%</button>)}</div></>}
        <div className="v14-two-actions"><button disabled={player.cash < quote.price * 1.015} onClick={() => dispatch({ type: 'BUY_STOCK', stockId: quote.id, quantity: 1, funding: 'cash' })}>Купить 1</button><button onClick={() => setFinanceStockId(quote.id)}>Купить больше / финансирование</button></div>
      </article>
    })}</div>
    {financeStockId && <StockFinancePanel stockId={financeStockId} onClose={() => setFinanceStockId(undefined)}/>} 
    <section className="v14-market-help"><div><b>Депозит · {money(player.deposit)}</b><span>Безопасный резерв: 0,9% в месяц. «Положить» убирает деньги со счёта, «снять» возвращает.</span></div><div><b>Облигации · {money(player.bonds)}</b><span>Доход 1,4% в месяц. Чтобы снова тратить сумму, облигации нужно продать.</span></div><div className="v14-four-actions"><button disabled={player.cash < 50_000} onClick={() => dispatch({ type: 'DEPOSIT', amount: 50_000 })}>Положить 50 000</button><button disabled={player.deposit < 50_000} onClick={() => dispatch({ type: 'WITHDRAW_DEPOSIT', amount: 50_000 })}>Снять 50 000</button><button disabled={player.cash < 50_000} onClick={() => dispatch({ type: 'BUY_BONDS', amount: 50_000 })}>Купить облигации</button><button disabled={player.bonds < 50_000} onClick={() => dispatch({ type: 'SELL_BONDS', amount: 50_000 })}>Продать облигации</button></div></section>
    <button className="ghost-action" onClick={() => dispatch({ type: 'SKIP_DECISION' })}>Завершить операции</button>
  </>
}

export function V14DecisionContent({ decision, commonSkip }: { decision: Decision; commonSkip: React.ReactNode }) {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const player = game.players[0]
  if (decision.kind === 'market') return <MarketDecision />
  if (decision.kind === 'expense') return <><div className="decision-symbol bad-bg">!</div><span className="eyebrow">НЕПРЕДВИДЕННЫЙ РАСХОД</span><h2>{decision.title}</h2><p>Выбери: решить надёжно или сэкономить сейчас и принять риск.</p><div className="v14-action-list">{(decision.options ?? [{ id: 'full' as const, title: 'Оплатить', description: 'Закрыть расход полностью.', amount: decision.amount }]).map((option) => <button key={option.id} onClick={() => dispatch({ type: 'RESOLVE_EXPENSE', optionId: option.id })}><b>{option.title} · {money(option.amount)}</b><small>{option.description}{option.riskChance ? ` Риск ${(option.riskChance * 100).toFixed(0)}%.` : ''}</small></button>)}</div><button className="ghost-action" onClick={() => dispatch({ type: 'PAY_EXPENSE', withCredit: true })}>Полную сумму в кредит</button></>
  if (decision.kind === 'contract') return <><div className="decision-symbol good-bg">📋</div><span className="eyebrow">КОНТРАКТ</span><h2>{decision.title}</h2><p>{decision.description} Результат зависит от выбранного масштаба и навыка.</p><div className="v14-action-list">{decision.options.map((option) => <button disabled={player.cash < option.investment} key={option.id} onClick={() => dispatch({ type: 'TAKE_CONTRACT', optionId: option.id })}><b>{option.title}</b><small>Вложить {money(option.investment)} · получить {money(option.payout)} через {option.durationMonths} мес. · шанс {Math.round(option.successChance * 100)}%</small></button>)}</div>{commonSkip}</>
  if (decision.kind === 'auction') return <><div className="decision-symbol good-bg">🔨</div><span className="eyebrow">АУКЦИОН С СОПЕРНИКАМИ</span><h2>{decision.title}</h2><div className="v14-summary-grid"><span>Рыночная стоимость <b>{money(decision.marketValue)}</b></span><span>Текущая ставка <b>{money(decision.currentBid)}</b></span></div>{decision.issueRevealed && <div className={decision.issue && decision.issue !== 'none' ? 'v14-warning' : 'v14-info'}><b>{decision.issue && decision.issue !== 'none' ? 'Проверка нашла риск' : 'Документы чистые'}</b></div>}<div className="v14-action-list"><button disabled={decision.inspected || player.cash < Math.max(12_000, decision.marketValue * .015)} onClick={() => dispatch({ type: 'AUCTION_INSPECT' })}><b>Проверить документы</b><small>{money(Math.max(12_000, decision.marketValue * .015))}</small></button><button onClick={() => dispatch({ type: 'AUCTION_BID', amount: decision.currentBid + decision.minimumStep })}><b>Поднять до {money(decision.currentBid + decision.minimumStep)}</b><small>Боты могут перебить ставку</small></button></div><button className="ghost-action" onClick={() => dispatch({ type: 'AUCTION_WITHDRAW' })}>Выйти из аукциона</button></>
  if (decision.kind === 'partnership') return <><div className="decision-symbol good-bg">🤝</div><span className="eyebrow">ПАРТНЁРСТВО</span><h2>{decision.title}</h2><p>{decision.description}</p><div className="v14-action-list"><button onClick={() => dispatch({ type: 'ACCEPT_PARTNERSHIP', ownership: .3 })}><b>Партнёр вкладывает 30%</b><small>У тебя остаётся 70% бизнеса</small></button><button onClick={() => dispatch({ type: 'ACCEPT_PARTNERSHIP', ownership: .5 })}><b>Разделить 50/50</b><small>Меньше взнос и меньше доход</small></button></div>{commonSkip}</>
  if (decision.kind === 'management') return <><div className="decision-symbol good-bg">🧭</div><span className="eyebrow">УПРАВЛЕНИЕ ПОРТФЕЛЕМ</span><h2>Наведи порядок в активах</h2><p>Здесь можно снизить дорогой платёж или временно защитить бизнес от случайных проблем.</p><div className="v14-action-list"><button disabled={!player.loans.some((loan) => !loan.collateralAssetId && !loan.collateralStockId)} onClick={() => dispatch({ type: 'MANAGEMENT_ACTION', action: 'refinance' })}><b>Рефинансировать дорогой кредит</b><small>Комиссия 2%, ставка станет ниже на 4 п.п.</small></button>{player.assets.map((asset) => <button key={asset.id} disabled={player.cash < assetMarketValue(asset) * .025} onClick={() => dispatch({ type: 'MANAGEMENT_ACTION', action: 'insure', assetId: asset.id })}><b>Застраховать: {asset.name}</b><small>{money(assetMarketValue(asset) * .025)} · защита на 3 месяца</small></button>)}</div>{commonSkip}</>
  return null
}

export function PortfolioDebtSummary() {
  const game = useGameStore((store) => store.game)
  return <div className="v14-debt-note">Общий долг портфеля: <b>{money(totalDebt(game.players[0]))}</b></div>
}

export const dispatchCommand = (command: GameCommand) => useGameStore.getState().dispatch(command)
