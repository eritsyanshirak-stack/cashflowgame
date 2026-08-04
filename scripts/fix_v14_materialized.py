from pathlib import Path


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'Missing correction anchor: {label}')
    return text.replace(old, new, 1)


engine_path = Path('src/game/engine/engine.ts')
engine = engine_path.read_text()
engine = replace_required(
    engine,
    "import { board, businesses, chanceCards, developments, difficultySettings, expenseScenarios, initialStockMarket, marketHeadlines, professions, rareDeals } from '../content/content'",
    "import { board, businesses, chanceCards, developments, difficultySettings, expenseCards, expenseScenarios, initialStockMarket, marketHeadlines, professions, rareDeals } from '../content/content'",
    'expense cards import',
)
engine = replace_required(
    engine,
    "  player.loans = player.loans.filter((loan) => loan.balance > 0)\n}",
    "  for (const loan of player.loans.filter((item) => item.balance <= 0 && item.collateralStockId)) {\n    const holding = player.stocks.find((item) => item.stockId === loan.collateralStockId)\n    if (holding) holding.pledgedQuantity = Math.max(0, (holding.pledgedQuantity ?? 0) - (loan.collateralStockQuantity ?? 0))\n  }\n  player.loans = player.loans.filter((loan) => loan.balance > 0)\n}",
    'release repaid stock collateral monthly',
)
engine = replace_required(
    engine,
    "  const v14Anytime = command.type === 'RESPOND_BUYER_OFFER' || command.type === 'PLEDGE_STOCK' || command.type === 'RESOLVE_MARGIN_CALL'\n  if (state.phase === 'ready' || v14Anytime) {",
    "  const v14Anytime = command.type === 'RESPOND_BUYER_OFFER' || command.type === 'RESOLVE_MARGIN_CALL'\n  const stockPledgeWindow = command.type === 'PLEDGE_STOCK' && (state.phase === 'ready' || state.pendingDecision?.kind === 'market')\n  if (state.phase === 'ready' || v14Anytime || stockPledgeWindow) {",
    'restrict stock pledge window',
)
engine = replace_required(
    engine,
    "    const marketValue = assetMarketValue(asset)\n    const { proceeds, bankPayment, deficiency } = sellAsset(player, asset, marketValue)\n    addEvent(state, 'Актив продан', `${asset.name}: ${marketValue.toLocaleString('ru-RU')} ₽, банку ${bankPayment.toLocaleString('ru-RU')} ₽, на руки ${proceeds.toLocaleString('ru-RU')} ₽${deficiency > 0 ? `, остаточный долг ${deficiency.toLocaleString('ru-RU')} ₽` : ''}`, proceeds >= asset.downPayment ? 'good' : deficiency > 0 ? 'bad' : 'neutral')",
    "    const marketValue = assetMarketValue(asset)\n    const quickPrice = Math.round(marketValue * 0.93)\n    const { proceeds, bankPayment, deficiency } = sellAsset(player, asset, quickPrice)\n    addEvent(state, 'Актив продан срочно', `${asset.name}: рынок ${marketValue.toLocaleString('ru-RU')} ₽, цена быстрой продажи ${quickPrice.toLocaleString('ru-RU')} ₽, банку ${bankPayment.toLocaleString('ru-RU')} ₽, на руки ${proceeds.toLocaleString('ru-RU')} ₽${deficiency > 0 ? `, остаточный долг ${deficiency.toLocaleString('ru-RU')} ₽` : ''}`, proceeds >= asset.downPayment ? 'good' : deficiency > 0 ? 'bad' : 'neutral')",
    'quick sale from portfolio',
)
engine = replace_required(
    engine,
    "    player.loans = player.loans.filter((loan) => loan.balance > 0)\n    return { state, accepted: true }\n  }\n  if (command.type === 'TRAIN')",
    "    for (const loan of player.loans.filter((item) => item.balance <= 0 && item.collateralStockId)) {\n      const holding = player.stocks.find((item) => item.stockId === loan.collateralStockId)\n      if (holding) holding.pledgedQuantity = Math.max(0, (holding.pledgedQuantity ?? 0) - (loan.collateralStockQuantity ?? 0))\n    }\n    player.loans = player.loans.filter((loan) => loan.balance > 0)\n    return { state, accepted: true }\n  }\n  if (command.type === 'TRAIN')",
    'release stock collateral after manual repayment',
)
engine = replace_required(
    engine,
    "    if (cell.type === 'chance' && random(state) < settings.botActivity * 0.55) {\n      const [title, investment, minReturn, maxReturn, durationMonths] = pick(state, chanceCards)",
    "    if (cell.type === 'contract' && random(state) < settings.botActivity * 0.72) {\n      const { card, options } = createContractOptions(state, bot, () => random(state))\n      const option = strategy === 'careful' ? options[0] : strategy === 'aggressive' ? options[2] : options[1]\n      const reserve = bot.baseExpenses * (strategy === 'careful' ? 1 : 0.35)\n      if (option && bot.cash >= option.investment + reserve) {\n        bot.cash -= option.investment\n        bot.activeContracts.push({ id: uid(state, 'bot-contract'), title: `${card.title}: ${option.title}`, investment: option.investment, payout: option.payout, resolvesMonth: state.month + option.durationMonths, successChance: option.successChance, skillId: option.skillId })\n        awardProgress(state, bot, 18, option.skillId, 5)\n      }\n    }\n    if (cell.type === 'chance' && random(state) < settings.botActivity * 0.55) {\n      const [title, investment, minReturn, maxReturn, durationMonths] = pick(state, chanceCards)",
    'bot contracts',
)
engine_path.write_text(engine)


core_path = Path('src/game/engine/v14Core.ts')
core = core_path.read_text()
core = replace_required(
    core,
    "import { assetCashflow, assetLiquidationProceeds, assetMarketValue, loanPayment, pledgedLoanForAsset } from '../systems/economy'",
    "import { assetCashflow, assetLiquidationProceeds, assetMarketValue, loanPayment, monthlyDebtPayments, pledgedLoanForAsset } from '../systems/economy'",
    'v14 core economy import',
)
core = replace_required(
    core,
    "    if (!asset) return rejected('Актив не найден')\n    const ownershipToSell = command.percent / 100",
    "    if (!asset) return rejected('Актив не найден')\n    if (pledgedLoanForAsset(player, asset.id)) return rejected('Нельзя продать долю бизнеса, пока он находится в залоге')\n    const ownershipToSell = command.percent / 100",
    'forbid partial pledged business sale',
)
core = replace_required(
    core,
    "    const terms = pledgeStockLoanTerms(amount)\n    holding.pledgedQuantity = (holding.pledgedQuantity ?? 0) + quantity",
    "    const terms = pledgeStockLoanTerms(amount)\n    const reliableIncome = Math.max(1, player.salary + player.assets.reduce((sum, asset) => sum + Math.max(0, assetCashflow(asset)), 0))\n    const projectedDebtLoad = (monthlyDebtPayments(player) + terms.monthlyPayment) / reliableIncome\n    if (projectedDebtLoad > 0.45) return rejected('Платежи по долгам после залога превысят 45% надёжного дохода')\n    holding.pledgedQuantity = (holding.pledgedQuantity ?? 0) + quantity",
    'stock pledge debt load guardrail',
)
core = replace_required(
    core,
    "export const sellAssetShareForFunding = (state: GameState, player: Player, assetId: string, percent: 10 | 25 | 50) =>",
    "export const sellAssetShareForFunding = (state: GameState, _player: Player, assetId: string, percent: 10 | 25 | 50) =>",
    'unused funding player',
)
core_path.write_text(core)


system_path = Path('src/game/systems/v14.ts')
system = system_path.read_text()
system = replace_required(
    system,
    "    if (state.month >= asset.listingExpiresMonth) {",
    "    if (state.month > asset.listingExpiresMonth) {",
    'full three month listing window',
)
system_path.write_text(system)


economy_path = Path('src/game/systems/economy.ts')
economy = economy_path.read_text()
economy = replace_required(
    economy,
    "  const liquidity = player.cash + player.deposit + player.bonds + freeStockMarketValue(player, [])",
    "  const liquidity = player.cash + player.deposit + player.bonds",
    'loan reserve liquidity',
)
economy_path.write_text(economy)
