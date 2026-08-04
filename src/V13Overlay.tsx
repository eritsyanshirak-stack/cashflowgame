import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { businesses } from './game/content/content'
import type { Asset, Funding, Player } from './game/domain/types'
import { assessLoan, assetCashflow, assetMarketValue, availableCollateral, loanPayment, pledgedLoanForAsset } from './game/systems/economy'
import { useGameStore } from './store/gameStore'

const money = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`

type ListedAsset = Asset & {
  listingPrice?: number | null
  listingExpiresMonth?: number | null
}

const useDecisionMount = (active: boolean, key: string) => {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!active) {
      setTarget(null)
      return
    }

    let mount: HTMLDivElement | null = null
    const attach = () => {
      const sheet = document.querySelector<HTMLElement>('.decision-business, .decision-opportunity, .decision-market')
      if (!sheet) return
      if (mount?.isConnected) return
      mount = document.createElement('div')
      mount.className = 'v13-portal-mount'
      const skip = Array.from(sheet.children).find((child) => child.classList.contains('ghost-action'))
      sheet.insertBefore(mount, skip ?? null)
      setTarget(mount)
    }

    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      mount?.remove()
      setTarget(null)
    }
  }, [active, key])

  return target
}

const useAssetsMount = (active: boolean) => {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!active) {
      setTarget(null)
      return
    }

    let mount: HTMLDivElement | null = null
    let section: HTMLElement | null = null
    const attach = () => {
      const candidate = Array.from(document.querySelectorAll<HTMLElement>('.content-section'))
        .find((item) => item.querySelector('.section-heading h2')?.textContent?.includes('Твои активы'))
      if (!candidate) return
      section = candidate
      section.classList.add('v13-assets-active')
      if (mount?.isConnected) return
      mount = document.createElement('div')
      mount.className = 'v13-assets-mount'
      const savingCard = candidate.querySelector('.saving-card')
      candidate.insertBefore(mount, savingCard ?? null)
      setTarget(mount)
    }

    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      section?.classList.remove('v13-assets-active')
      mount?.remove()
      setTarget(null)
    }
  }, [active])

  return target
}

const saleImpact = (player: Player, asset: Asset) => {
  const grossPrice = Math.round(assetMarketValue(asset) * 0.93)
  const collateralDebt = pledgedLoanForAsset(player, asset.id)?.balance ?? 0
  const securedDebt = asset.loan + collateralDebt
  const proceeds = Math.max(0, grossPrice - securedDebt)
  const deficiency = Math.max(0, securedDebt - grossPrice)
  return {
    grossPrice,
    proceeds,
    deficiency,
    deficiencyPayment: loanPayment(deficiency, 0.36, 36),
  }
}

function DealFinancingPlanner() {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const decision = game.pendingDecision
  const active = decision?.kind === 'business' || decision?.kind === 'opportunity'
  const decisionKey = active ? `${decision.kind}-${decision.businessId}-${decision.askingPrice}` : 'none'
  const target = useDecisionMount(active, decisionKey)
  const [saleAssetIds, setSaleAssetIds] = useState<string[]>([])
  const [collateralAssetId, setCollateralAssetId] = useState<string>()

  useEffect(() => {
    setSaleAssetIds([])
    setCollateralAssetId(undefined)
  }, [decisionKey])

  if (!active || !target) return null
  const player = game.players[0]
  const business = businesses.find((item) => item.id === decision.businessId)
  if (!business) return null

  const financedLoan = Math.min(decision.askingPrice, Math.round(business.loan * (decision.askingPrice / business.price)))
  const businessPayment = loanPayment(financedLoan, business.loanRate, business.loanTermMonths)
  const downPayment = Math.max(0, decision.askingPrice - financedLoan)
  const selectedAssets = player.assets.filter((asset) => saleAssetIds.includes(asset.id))
  const financingPlayer = structuredClone(player)
  let saleProceeds = 0
  let saleDeficiency = 0
  let deficiencyPayment = 0
  let lostFlow = 0

  selectedAssets.forEach((asset) => {
    const impact = saleImpact(player, asset)
    saleProceeds += impact.proceeds
    saleDeficiency += impact.deficiency
    deficiencyPayment += impact.deficiencyPayment
    lostFlow += assetCashflow(asset)
    financingPlayer.assets = financingPlayer.assets.filter((item) => item.id !== asset.id)
    financingPlayer.loans = financingPlayer.loans.filter((loan) => loan.collateralAssetId !== asset.id)
    financingPlayer.cash += impact.proceeds
    if (impact.deficiency > 0) {
      financingPlayer.loans.push({
        id: `preview-deficiency-${asset.id}`,
        name: `Остаток после продажи: ${asset.name}`,
        balance: impact.deficiency,
        monthlyPayment: impact.deficiencyPayment,
        annualRate: 0.36,
        termMonths: 36,
        missedPayments: 0,
      })
    }
  })

  const cashAfterSales = financingPlayer.cash
  const remainingGap = Math.max(0, downPayment - cashAfterSales)
  const projectedOperatingIncome = business.revenue - business.operatingCosts
  const hasContribution = cashAfterSales >= downPayment * 0.3
  const unsecured = assessLoan(financingPlayer, remainingGap, game.difficulty, undefined, projectedOperatingIncome, businessPayment)
  const collateralOptions = financingPlayer.assets.map((asset) => ({
    asset,
    limit: availableCollateral(financingPlayer, asset),
    offer: assessLoan(financingPlayer, remainingGap, game.difficulty, asset, projectedOperatingIncome, businessPayment),
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
  const buy = (funding: Funding, selectedCollateralId?: string) => dispatch({
    type: decision.kind === 'business' ? 'BUY_BUSINESS' : 'BUY_OPPORTUNITY',
    funding,
    collateralAssetId: selectedCollateralId,
    saleAssetIds,
  })

  return createPortal(<section className="v13-financing-planner">
    <div className="v13-block-title"><span><small>СОБРАТЬ ФИНАНСИРОВАНИЕ</small><b>Продать или заложить актив</b></span><strong>{money(remainingGap)} нужно</strong></div>

    {player.assets.length > 0 ? <div className="v13-deal-assets">{player.assets.map((asset) => {
      const impact = saleImpact(player, asset)
      const selectedSale = saleAssetIds.includes(asset.id)
      const selectedPledge = collateralAssetId === asset.id
      const alreadyPledged = Boolean(pledgedLoanForAsset(player, asset.id))
      const option = collateralOptions.find((item) => item.asset.id === asset.id)
      return <article className={`${selectedSale ? 'sale-selected' : ''} ${selectedPledge ? 'pledge-selected' : ''}`} key={asset.id}>
        <div><b>{asset.name}</b><small>Рынок {money(assetMarketValue(asset))} · поток {money(assetCashflow(asset))}/мес</small></div>
        <div className="v13-choice-row">
          <button aria-pressed={selectedSale} onClick={() => toggleSale(asset.id)}><b>{selectedSale ? '✓ Продать' : 'Продать'}</b><small>Сразу {money(impact.grossPrice)} · на руки {money(impact.proceeds)}</small></button>
          <button aria-pressed={selectedPledge} disabled={remainingGap <= 0 || alreadyPledged || !option?.limit} onClick={() => toggleCollateral(asset.id)}><b>{selectedPledge ? '✓ Заложить' : 'Заложить'}</b><small>{alreadyPledged ? 'Уже в залоге' : option?.limit ? `Лимит ${money(option.limit)}` : 'Нет свободной стоимости'}</small></button>
        </div>
      </article>
    })}</div> : <p className="v13-muted">Активов для продажи или залога пока нет.</p>}

    <div className="v13-summary-grid">
      <span>Свои деньги <b>{money(player.cash)}</b></span>
      <span>После продаж <b>{money(cashAfterSales)}</b></span>
      <span>Первый взнос <b>{money(downPayment)}</b></span>
      <span>Осталось найти <b className={remainingGap > 0 ? 'bad' : 'good'}>{money(remainingGap)}</b></span>
    </div>

    {saleDeficiency > 0 && <div className="v13-warning"><b>После продажи останется долг {money(saleDeficiency)}</b><span>Новый платёж {money(deficiencyPayment)}/мес · потеря потока {money(lostFlow)}/мес</span></div>}

    <div className="v13-final-actions">
      <button disabled={remainingGap > 0} onClick={() => buy('cash')}><b>{saleAssetIds.length ? 'Продать выбранные и купить' : 'Купить за свои'}</b><small>Без нового кредита</small></button>
      {remainingGap > 0 && <button disabled={!unsecured.approved || !hasContribution} onClick={() => buy('credit')}><b>Добавить обычный кредит</b><small>{unsecured.approved && hasContribution ? `${money(remainingGap)} · ${money(unsecured.monthlyPayment)}/мес` : !hasContribution ? 'Нужно больше собственных денег' : unsecured.reason}</small></button>}
      {remainingGap > 0 && selectedCollateral && <button disabled={!selectedCollateral.offer.approved} onClick={() => buy('secured', selectedCollateral.asset.id)}><b>Купить под залог {selectedCollateral.asset.name}</b><small>{selectedCollateral.offer.approved ? `${money(remainingGap)} · ${Math.round(selectedCollateral.offer.annualRate * 100)}% · ${money(selectedCollateral.offer.monthlyPayment)}/мес` : selectedCollateral.offer.reason}</small></button>}
      <button disabled={cashAfterSales < Math.round(downPayment * 0.7)} onClick={() => buy('partner30')}><b>Партнёр получает 30%</b><small>Твой взнос {money(Math.round(downPayment * 0.7))}</small></button>
      <button disabled={cashAfterSales < Math.round(downPayment * 0.5)} onClick={() => buy('partner50')}><b>Партнёр получает 50%</b><small>Твой взнос {money(Math.round(downPayment * 0.5))}</small></button>
    </div>

    {remainingGap > 0 && !collateralAssetId && collateralOptions.some(({ offer }) => offer.approved) && <div className="v13-info">Нажми «Заложить» у нужного актива — увидишь ставку, платёж и финальную кнопку покупки.</div>}
  </section>, target)
}

function MarketHelp() {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const active = game.pendingDecision?.kind === 'market'
  const target = useDecisionMount(active, `market-${game.month}`)
  if (!active || !target) return null
  const player = game.players[0]

  return createPortal(<section className="v13-market-help">
    <div><b>Депозит · {money(player.deposit)}</b><span>Безопасный резерв. Даёт 0,9% в месяц. «Положить» убирает деньги с доступного счёта, «снять» возвращает их обратно.</span></div>
    <div><b>Облигации · {money(player.bonds)}</b><span>Ты даёшь деньги в долг и получаешь 1,4% в месяц. Доход выше депозита; чтобы снова тратить сумму, облигации нужно продать.</span></div>
    <div className="v13-market-actions">
      <button disabled={player.cash < 50_000} onClick={() => dispatch({ type: 'DEPOSIT', amount: 50_000 })}>Положить 50 000 ₽</button>
      <button disabled={player.deposit < 50_000} onClick={() => dispatch({ type: 'WITHDRAW_DEPOSIT', amount: 50_000 })}>Снять 50 000 ₽</button>
      <button disabled={player.cash < 50_000} onClick={() => dispatch({ type: 'BUY_BONDS', amount: 50_000 })}>Купить облигации</button>
      <button disabled={player.bonds < 50_000} onClick={() => dispatch({ type: 'SELL_BONDS', amount: 50_000 })}>Продать облигации</button>
    </div>
  </section>, target)
}

function AssetSalesDesk() {
  const game = useGameStore((store) => store.game)
  const dispatch = useGameStore((store) => store.dispatch)
  const active = game.phase !== 'setup' && game.players[0]?.assets.length > 0
  const target = useAssetsMount(active)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const player = game.players[0]

  const defaults = useMemo(() => Object.fromEntries((player?.assets ?? []).map((asset) => [asset.id, String(Math.round(assetMarketValue(asset) * 1.1))])), [player?.assets])
  useEffect(() => setInputs((current) => ({ ...defaults, ...current })), [defaults])

  if (!active || !target || !player) return null

  return createPortal(<section className="v13-sales-desk">
    <div className="v13-block-title"><span><small>ПРОДАЖА БИЗНЕСОВ</small><b>Быстро или по своей цене</b></span></div>
    <p>Быстрая продажа проходит сразу за 93% рынка. При размещении объявления можно поставить 90–140% рынка и ждать до трёх месяцев.</p>
    <div className="v13-listings">{player.assets.map((rawAsset) => {
      const asset = rawAsset as ListedAsset
      const market = assetMarketValue(asset)
      const min = Math.round(market * 0.9)
      const max = Math.round(market * 1.4)
      const input = inputs[asset.id] ?? String(Math.round(market * 1.1))
      return <article key={asset.id}>
        <div className="v13-listing-head"><span><b>{asset.name}</b><small>Рынок {money(market)} · быстрая цена {money(Math.round(market * 0.93))}</small></span>{asset.listingPrice ? <strong>Выставлен: {money(asset.listingPrice)}</strong> : null}</div>
        {asset.saleOffer && asset.offerExpiresMonth === game.month && <div className="v13-live-offer"><span>Покупатель предлагает <b>{money(asset.saleOffer)}</b></span><div><button onClick={() => dispatch({ type: 'ACCEPT_SALE_OFFER', assetId: asset.id })}>Принять</button><button onClick={() => dispatch({ type: 'COUNTER_SALE_OFFER', assetId: asset.id, multiplier: 1.05 })}>+5%</button><button onClick={() => dispatch({ type: 'COUNTER_SALE_OFFER', assetId: asset.id, multiplier: 1.1 })}>+10%</button><button onClick={() => dispatch({ type: 'COUNTER_SALE_OFFER', assetId: asset.id, multiplier: 1.15 })}>+15%</button></div></div>}
        <div className="v13-price-entry"><input type="number" inputMode="numeric" min={min} max={max} step="1000" value={input} onChange={(event) => setInputs((current) => ({ ...current, [asset.id]: event.target.value }))}/><button disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'LIST_ASSET', assetId: asset.id, askingPrice: Number(input) })}>Выставить</button></div>
        <div className="v13-presets">{[1, 1.1, 1.2, 1.3].map((ratio) => <button key={ratio} onClick={() => setInputs((current) => ({ ...current, [asset.id]: String(Math.round(market * ratio)) }))}>{Math.round(ratio * 100)}%</button>)}</div>
        <div className="v13-sale-actions"><button disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'SELL_ASSET', assetId: asset.id })}>Продать сразу</button>{asset.listingPrice && <button disabled={game.phase !== 'ready'} onClick={() => dispatch({ type: 'CANCEL_ASSET_LISTING', assetId: asset.id })}>Снять объявление</button>}</div>
      </article>
    })}</div>
  </section>, target)
}

export default function V13Overlay() {
  return <>
    <DealFinancingPlanner />
    <MarketHelp />
    <AssetSalesDesk />
  </>
}
