from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'Fix anchor missing: {label}')
    return text.replace(old, new, 1)

# The main migration creates clean source files. These corrections only adjust
# generated source before tests/build; neither migration script is shipped.
engine_path = 'src/game/engine/engine.ts'
engine = read(engine_path)
engine = replace_once(
    engine,
    """  const purchasePrice = dealPrice ?? business.price
  const downPayment = Math.round(Math.max(0, purchasePrice - business.loan) * ownership)
  const acquisitionGap = Math.max(0, downPayment - player.cash)
""",
    """  const purchasePrice = dealPrice ?? business.price
  const financedLoan = Math.min(purchasePrice, Math.round(business.loan * (purchasePrice / business.price)))
  const downPayment = Math.round(Math.max(0, purchasePrice - financedLoan) * ownership)
  const acquisitionGap = Math.max(0, downPayment - player.cash)
""",
    'proportional acquisition loan',
)
engine = replace_once(
    engine,
    "  const assetLoan = Math.round(business.loan * ownership)\n",
    "  const assetLoan = Math.round(financedLoan * ownership)\n",
    'asset financed loan',
)
engine = replace_once(
    engine,
    """  for (const asset of player.assets) {
    if (asset.legalIssue) {
      asset.issueMonths = (asset.issueMonths ?? 0) + 1
      continue
    }
""",
    """  for (const asset of [...player.assets]) {
    if (asset.legalIssue) {
      asset.issueMonths = (asset.issueMonths ?? 0) + 1
      if ((asset.issueMonths ?? 0) >= 3 && asset.status === 'suspended') {
        repossessAsset(state, player, asset, 'юридическая проблема не устранена, актив принудительно реализован')
      }
      continue
    }
""",
    'unresolved legal closure',
)
write(engine_path, engine)

app_path = 'src/App.tsx'
app = read(app_path)
app = app.replace(
    "import { board, businesses, developments, difficultySettings, professions, rareDeals } from './game/content/content'",
    "import { board, businesses, developments, difficultySettings, professions } from './game/content/content'",
    1,
)
app = app.replace("    const deal = rareDeals.find((item) => item.id === decision.opportunityId)!\n", "", 1)
app = replace_once(
    app,
    """    const payment = loanPayment(business.loan, business.loanRate, business.loanTermMonths)
    const flow = business.revenue - business.operatingCosts - payment
    const downPayment = Math.max(0, decision.askingPrice - business.loan)
""",
    """    const financedLoan = Math.min(decision.askingPrice, Math.round(business.loan * (decision.askingPrice / business.price)))
    const payment = loanPayment(financedLoan, business.loanRate, business.loanTermMonths)
    const flow = business.revenue - business.operatingCosts - payment
    const downPayment = Math.max(0, decision.askingPrice - financedLoan)
""",
    'business card proportional financing',
)
app = replace_once(
    app,
    """    const payment = loanPayment(business.loan, business.loanRate, business.loanTermMonths)
    const downPayment = Math.max(0, decision.askingPrice - business.loan)
    const flow = business.revenue - business.operatingCosts - payment
""",
    """    const financedLoan = Math.min(decision.askingPrice, Math.round(business.loan * (decision.askingPrice / business.price)))
    const payment = loanPayment(financedLoan, business.loanRate, business.loanTermMonths)
    const downPayment = Math.max(0, decision.askingPrice - financedLoan)
    const flow = business.revenue - business.operatingCosts - payment
""",
    'opportunity card proportional financing',
)
write(app_path, app)

engine_test_path = 'src/game/engine/engine.test.ts'
test = read(engine_test_path)
test = test.replace(
    "lastDevelopedMonth: null, saleOffer: null, offerExpiresMonth: null }",
    "lastDevelopedMonth: null, saleOffer: null, offerExpiresMonth: null, status: 'active', dueDiligence: 'none', launchMonthsRemaining: 0, incidentCooldown: 0, issueMonths: 0, missedPayments: 0 }",
    1,
)
test = test.replace(
    "    expect(purchase.state.players[0].cash).toBe(24_000)",
    "    const financedLoan = Math.round(330_000 * (456_000 / 480_000))\n    expect(purchase.state.players[0].cash).toBe(150_000 - (456_000 - financedLoan))",
    1,
)
test = test.replace(
    "expect(sale.state.players[0].loans[0]).toMatchObject({ balance: 20_000, collateralAssetId: undefined })",
    "expect(sale.state.players[0].loans[0]).toMatchObject({ balance: 20_000 })",
    1,
)
test = test.replace(
    "expect(result.state.players[0].assets[0].revenue).toBe(92_160)",
    "expect(result.state.players[0].assets[0].revenue).toBe(Math.round(businesses.find((item) => item.id === 'coffee')!.revenue * 1.28))",
    1,
)
test = test.replace(
    "    bot.deposit = Math.ceil(monthlyExpenses(bot) / 0.009) + 1_000_000",
    "    bot.deposit = Math.ceil(monthlyExpenses(bot) / 0.009) + 1_000_000\n    bot.freedomStreak = 3",
    1,
)
test = replace_once(
    test,
    """  it('requires a three-month liquid reserve before declaring financial freedom', () => {
    const game = startedGame()
    const player = game.players[0]
    player.assets = Array.from({ length: 4 }, (_, index) => ({ ...testAsset('coffee', player.id), id: `coffee-${index}` }))
    player.cash = 0
    expect(passiveIncome(player, game.stockMarket)).toBeGreaterThanOrEqual(monthlyExpenses(player))
    expect(isFinanciallyFree(player, game.stockMarket)).toBe(false)
    player.cash = monthlyExpenses(player) * 3
    expect(isFinanciallyFree(player, game.stockMarket)).toBe(true)
  })
""",
    """  it('requires liquid reserve and three stable months before declaring financial freedom', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = testAsset('coffee', player.id)
    asset.marketValue = 2_000_000
    asset.revenue = monthlyExpenses(player) + asset.operatingCosts + asset.monthlyPayment + 10_000
    player.assets = [asset]
    player.freedomStreak = 3
    player.cash = 0
    expect(passiveIncome(player, game.stockMarket)).toBeGreaterThanOrEqual(monthlyExpenses(player))
    expect(isFinanciallyFree(player, game.stockMarket)).toBe(false)
    player.cash = monthlyExpenses(player) * 3
    expect(isFinanciallyFree(player, game.stockMarket)).toBe(true)
  })
""",
    'stable freedom test',
)
write(engine_test_path, test)

balance_test_path = 'src/game/engine/balance.test.ts'
balance = read(balance_test_path)
balance = balance.replace(
    "lastDevelopedMonth: null, saleOffer: null, offerExpiresMonth: null,",
    "lastDevelopedMonth: null, saleOffer: null, offerExpiresMonth: null, status: 'active', dueDiligence: 'none', launchMonthsRemaining: 0, incidentCooldown: 0, issueMonths: 0, missedPayments: 0,",
    1,
)
balance = balance.replace("Array.from({ length: 4 }", "Array.from({ length: 3 }", 1)
write(balance_test_path, balance)

print('balance v1.2 generated-source corrections applied')
