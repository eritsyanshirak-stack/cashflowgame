from pathlib import Path

path = Path('src/V14UI.tsx')
source = path.read_text()

start = source.find('function StockFinancePanel(')
end = source.find('\n\nexport function MarketDecision', start)
if start < 0 or end < 0:
    raise RuntimeError('Stock finance panel anchors not found')

panel = r'''function StockFinancePanel({ stockId, onClose }: { stockId: string; onClose: () => void }) {
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
  const financingPlayer = structuredClone(player)
  let releasedCash = 0

  const wholeAsset = financingPlayer.assets.find((asset) => asset.id === saleAssetId)
  if (wholeAsset) {
    const impact = quickSaleImpact(player, wholeAsset)
    releasedCash += impact.proceeds
    financingPlayer.cash += impact.proceeds
    financingPlayer.assets = financingPlayer.assets.filter((asset) => asset.id !== wholeAsset.id)
    financingPlayer.loans = financingPlayer.loans.filter((loan) => loan.collateralAssetId !== wholeAsset.id)
    if (impact.deficiency > 0) financingPlayer.loans.push({
      id: `stock-preview-deficiency-${wholeAsset.id}`,
      name: `Остаток после продажи: ${wholeAsset.name}`,
      balance: impact.deficiency,
      monthlyPayment: loanPayment(impact.deficiency, 0.36, 36),
      annualRate: 0.36,
      termMonths: 36,
      missedPayments: 0,
    })
  }

  const shareAsset = financingPlayer.assets.find((asset) => asset.id === shareAssetId)
  if (shareAsset && !pledgedLoanForAsset(financingPlayer, shareAsset.id)) {
    const ownershipToSell = sharePercent / 100
    const soldRatio = Math.min(1, ownershipToSell / Math.max(0.01, shareAsset.ownership))
    const shareGross = Math.round(assetMarketValue(shareAsset) * soldRatio * 0.96)
    const debtPart = Math.round(shareAsset.loan * soldRatio)
    const shareProceeds = Math.max(0, shareGross - debtPart)
    const remainingRatio = 1 - soldRatio
    releasedCash += shareProceeds
    financingPlayer.cash += shareProceeds
    shareAsset.ownership = Math.round((shareAsset.ownership - ownershipToSell) * 100) / 100
    shareAsset.price = Math.round(shareAsset.price * remainingRatio)
    shareAsset.downPayment = Math.round(shareAsset.downPayment * remainingRatio)
    shareAsset.loan = Math.round(shareAsset.loan * remainingRatio)
    shareAsset.revenue = Math.round(shareAsset.revenue * remainingRatio)
    shareAsset.operatingCosts = Math.round(shareAsset.operatingCosts * remainingRatio)
    shareAsset.monthlyPayment = Math.round(shareAsset.monthlyPayment * remainingRatio)
    shareAsset.marketValue = Math.round(assetMarketValue(shareAsset) * remainingRatio)
  }

  const gap = Math.max(0, cost - financingPlayer.cash)
  const collateral = funding === 'secured' ? financingPlayer.assets.find((asset) => asset.id === collateralAssetId) : undefined
  const creditOffer = gap > 0 && funding !== 'cash'
    ? assessLoan(financingPlayer, gap, game.difficulty, collateral, 0, 0, game.globalEvent?.creditRateDelta ?? 0)
    : null
  const canBuy = gap === 0 || (
    funding === 'credit'
      ? financingPlayer.cash >= cost * 0.35 && Boolean(creditOffer?.approved)
      : funding === 'secured'
        ? Boolean(collateral && creditOffer?.approved)
        : false
  )

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
    <div className="v14-summary-grid">
      <span>Стоимость с комиссией <b>{money(cost)}</b></span>
      <span>Денег после продаж <b>{money(financingPlayer.cash)}</b></span>
      <span>Освободишь из активов <b>{money(releasedCash)}</b></span>
      <span>Останется профинансировать <b className={gap > 0 ? 'bad' : 'good'}>{money(gap)}</b></span>
    </div>
    <div className="v14-choice-tabs"><button className={funding === 'cash' ? 'active' : ''} onClick={() => setFunding('cash')}>Свои</button><button className={funding === 'credit' ? 'active' : ''} onClick={() => setFunding('credit')}>Кредит</button><button className={funding === 'secured' ? 'active' : ''} onClick={() => setFunding('secured')}>Под залог</button></div>
    {player.assets.length > 0 && <div className="v14-finance-extra"><b>Дополнительно освободить деньги</b><select value={saleAssetId ?? ''} onChange={(event) => { setSaleAssetId(event.target.value || undefined); if (event.target.value) setShareAssetId(undefined) }}><option value="">Не продавать бизнес целиком</option>{player.assets.filter((asset) => asset.id !== collateralAssetId).map((asset) => <option key={asset.id} value={asset.id}>Срочно продать: {asset.name} · на руки {money(quickSaleImpact(player, asset).proceeds)}</option>)}</select><div className="v14-share-select"><select value={shareAssetId ?? ''} onChange={(event) => { setShareAssetId(event.target.value || undefined); if (event.target.value) setSaleAssetId(undefined) }}><option value="">Не продавать долю бизнеса</option>{player.assets.filter((asset) => asset.id !== collateralAssetId && !pledgedLoanForAsset(player, asset.id)).map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select><select value={sharePercent} disabled={!shareAssetId} onChange={(event) => setSharePercent(Number(event.target.value) as 10 | 25 | 50)}><option value={10}>10%</option><option value={25}>25%</option><option value={50}>50%</option></select></div></div>}
    {funding === 'secured' && <div className="v14-finance-extra"><b>Какой бизнес заложить</b><select value={collateralAssetId ?? ''} onChange={(event) => { setCollateralAssetId(event.target.value || undefined); if (event.target.value === saleAssetId) setSaleAssetId(undefined); if (event.target.value === shareAssetId) setShareAssetId(undefined) }}><option value="">Выбери актив</option>{player.assets.filter((asset) => !pledgedLoanForAsset(player, asset.id) && availableCollateral(player, asset) > 0).map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · лимит {money(availableCollateral(player, asset))}</option>)}</select></div>}
    {gap > 0 && funding !== 'cash' && <div className={creditOffer?.approved ? 'v14-info' : 'v14-warning'}><b>{creditOffer?.approved ? `Банк готов добавить ${money(gap)}` : creditOffer?.reason ?? 'Выбери схему финансирования'}</b>{creditOffer?.approved && <span>{Math.round(creditOffer.annualRate * 100)}% годовых · {money(creditOffer.monthlyPayment)}/мес.</span>}</div>}
    <button className="primary-action" disabled={!canBuy} onClick={buy}>Купить {quantity} шт. <span>→</span></button>
  </section>
}'''

source = source[:start] + panel + source[end:]

old = "{([25, 50, 75, 100] as const).map((share) => <button key={share} disabled={free <= 0 || availableStockCollateral(player, holding, quote) <= 0} onClick={() => dispatch({ type: 'PLEDGE_STOCK', stockId: quote.id, percent: share })}>{share}%</button>)}"
new = "{([25, 50, 75, 100] as const).map((share) => { const pledgeQuantity = Math.max(1, Math.floor(free * share / 100)); const pledgeAmount = Math.floor(pledgeQuantity * quote.price * 0.45); return <button key={share} disabled={free <= 0 || availableStockCollateral(player, holding, quote) <= 0} onClick={() => dispatch({ type: 'PLEDGE_STOCK', stockId: quote.id, percent: share })}>{share}% · +{money(pledgeAmount)}</button> })}"
if old not in source:
    raise RuntimeError('Pledge amount buttons anchor not found')
source = source.replace(old, new, 1)

path.write_text(source)
print('materialized transparent stock financing UI')
