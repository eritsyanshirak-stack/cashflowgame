from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/App.tsx",
    """    const selectedAssets = player.assets.filter((asset) => saleAssetIds.includes(asset.id))
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
""",
    """    const selectedAssets = player.assets.filter((asset) => saleAssetIds.includes(asset.id))
    const saleImpactFor = (asset: Player['assets'][number]) => {
      const collateralDebt = pledgedLoanForAsset(player, asset.id)?.balance ?? 0
      const grossPrice = assetMarketValue(asset)
      const securedDebt = asset.loan + collateralDebt
      const proceeds = Math.max(0, grossPrice - securedDebt)
      const deficiency = Math.max(0, securedDebt - grossPrice)
      return { proceeds, deficiency, deficiencyPayment: loanPayment(deficiency, 0.36, 36) }
    }
    const financingPlayer = structuredClone(player)
    let saleProceeds = 0
    let saleDeficiency = 0
    let deficiencyPayment = 0
    let lostMonthlyFlow = 0
    for (const asset of selectedAssets) {
      const impact = saleImpactFor(asset)
      saleProceeds += impact.proceeds
      saleDeficiency += impact.deficiency
      deficiencyPayment += impact.deficiencyPayment
      lostMonthlyFlow += assetCashflow(asset)
      financingPlayer.assets = financingPlayer.assets.filter((item) => item.id !== asset.id)
      financingPlayer.loans = financingPlayer.loans.filter((loan) => loan.collateralAssetId !== asset.id)
      financingPlayer.cash += impact.proceeds
      if (impact.deficiency > 0) financingPlayer.loans.push({
        id: `preview-deficiency-${asset.id}`,
        name: `Остаток после продажи: ${asset.name}`,
        balance: impact.deficiency,
        monthlyPayment: impact.deficiencyPayment,
        annualRate: 0.36,
        termMonths: 36,
        missedPayments: 0,
      })
    }
    const cashAfterSales = financingPlayer.cash
    const remainingGap = Math.max(0, downPayment - cashAfterSales)
    const projectedOperatingIncome = business.revenue - business.operatingCosts
    const hasBuyerContribution = cashAfterSales >= downPayment * 0.3
    const unsecured = assessLoan(financingPlayer, remainingGap, game.difficulty, undefined, projectedOperatingIncome, businessPayment)
    const collateralOffers = financingPlayer.assets
      .map((asset) => ({ asset, offer: assessLoan(financingPlayer, remainingGap, game.difficulty, asset, projectedOperatingIncome, businessPayment) }))
      .filter(({ offer }) => remainingGap > 0 && offer.approved)
""",
)

replace_once(
    "src/App.tsx",
    """        <div className=\"funding-actions\">{player.assets.map((asset) => {
          const proceeds = assetLiquidationProceeds(player, asset)
          const selected = saleAssetIds.includes(asset.id)
          return <button type=\"button\" key={asset.id} aria-pressed={selected} className={selected ? 'selected-funding' : ''} onClick={() => toggleSaleAsset(asset.id)}>
            <b>{selected ? '✓ Продать' : 'Продать'} {asset.name}</b>
            <small>На руки {money(proceeds)} · поток {money(assetCashflow(asset))}/мес</small>
          </button>
        })}</div>
""",
    """        <div className=\"funding-actions\">{player.assets.map((asset) => {
          const impact = saleImpactFor(asset)
          const selected = saleAssetIds.includes(asset.id)
          return <button type=\"button\" key={asset.id} aria-pressed={selected} className={selected ? 'selected-funding' : ''} onClick={() => toggleSaleAsset(asset.id)}>
            <b>{selected ? '✓ Продать' : 'Продать'} {asset.name}</b>
            <small>На руки {money(impact.proceeds)}{impact.deficiency > 0 ? ` · останется долг ${money(impact.deficiency)}` : ''} · поток {money(assetCashflow(asset))}/мес</small>
          </button>
        })}</div>
""",
)

replace_once(
    "src/App.tsx",
    """      <div className=\"deal-funding-summary\">
        <span>После выбранных продаж <b>{money(cashAfterSales)}</b></span>
        <span>Осталось найти <b className={remainingGap > 0 ? 'bad' : 'good'}>{money(remainingGap)}</b></span>
      </div>
""",
    """      <div className=\"deal-funding-summary\">
        <span>После выбранных продаж <b>{money(cashAfterSales)}</b></span>
        <span>Осталось найти <b className={remainingGap > 0 ? 'bad' : 'good'}>{money(remainingGap)}</b></span>
      </div>
      {saleDeficiency > 0 && <div className=\"bank-verdict declined\"><div><small>ПОСЛЕДСТВИЯ ПРОДАЖИ</small><b>Останется долг {money(saleDeficiency)}</b></div><span>Новый платёж {money(deficiencyPayment)}/мес · потеря потока {money(lostMonthlyFlow)}/мес</span></div>}
""",
)

replace_once(
    "src/game/engine/engine.ts",
    """  const proceeds = Math.max(0, grossPrice - totalSecuredDebt)
  const deficiency = Math.max(0, totalSecuredDebt - grossPrice)
""",
    """  const proceeds = Math.max(0, grossPrice - totalSecuredDebt)
  const deficiency = Math.max(0, totalSecuredDebt - grossPrice)
  const bankPayment = Math.min(grossPrice, totalSecuredDebt)
""",
)

replace_once(
    "src/game/engine/engine.ts",
    """  return { proceeds, collateralPayment: Math.min(grossPrice, collateralDebt), deficiency }
""",
    """  const businessLoanPayment = Math.min(asset.loan, bankPayment)
  const collateralPayment = Math.max(0, bankPayment - businessLoanPayment)
  return { proceeds, collateralPayment, bankPayment, deficiency }
""",
)

replace_once(
    "src/game/engine/engine.ts",
    """    const { proceeds, collateralPayment } = sellAsset(player, asset, marketValue)
    addEvent(state, 'Актив продан', `${asset.name}: ${marketValue.toLocaleString('ru-RU')} ₽, банку ${(asset.loan + collateralPayment).toLocaleString('ru-RU')} ₽, на руки ${proceeds.toLocaleString('ru-RU')} ₽`, proceeds >= asset.downPayment ? 'good' : 'neutral')
""",
    """    const { proceeds, bankPayment, deficiency } = sellAsset(player, asset, marketValue)
    addEvent(state, 'Актив продан', `${asset.name}: ${marketValue.toLocaleString('ru-RU')} ₽, банку ${bankPayment.toLocaleString('ru-RU')} ₽, на руки ${proceeds.toLocaleString('ru-RU')} ₽${deficiency > 0 ? `, остаточный долг ${deficiency.toLocaleString('ru-RU')} ₽` : ''}`, proceeds >= asset.downPayment ? 'good' : deficiency > 0 ? 'bad' : 'neutral')
""",
)

replace_once(
    "src/game/engine/deal-financing.test.ts",
    """  it('combines a sale with a secured loan and forbids selling the collateral', () => {
""",
    """  it('keeps an underwater asset deficiency when it is sold inside a successful deal', () => {
    const game = startedGame()
    const player = game.players[0]
    const underwater = testAsset('vending', player.id, 'underwater-vending')
    underwater.marketValue = 100_000
    underwater.loan = 180_000
    underwater.monthlyPayment = loanPayment(underwater.loan, underwater.loanRate, underwater.loanTermMonths)
    player.assets = [underwater]
    player.cash = 150_000
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'coffee', askingPrice: 480_000, negotiated: false }

    const result = executeCommand(game, { type: 'BUY_BUSINESS', funding: 'cash', saleAssetIds: [underwater.id] })

    expect(result.accepted).toBe(true)
    const deficiency = result.state.players[0].loans.find((loan) => loan.name.includes('Остаток после продажи'))
    expect(deficiency?.balance).toBe(80_000)
    expect(deficiency?.monthlyPayment).toBeGreaterThan(0)
  })

  it('combines a sale with a secured loan and forbids selling the collateral', () => {
""",
)

print("Financing audit fixes applied")
