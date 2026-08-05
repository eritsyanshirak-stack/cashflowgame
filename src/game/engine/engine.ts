import { board, businesses, chanceCards, developments, difficultySettings, expenseCards, expenseScenarios, initialStockMarket, marketHeadlines, professions, rareDeals } from '../content/content'
import type { Asset, BotStrategy, BusinessIssue, CommandResult, Decision, DueDiligence, Funding, GameCommand, GameEvent, GameState, Player, RiskRating } from '../domain/types'
import { assessLoan, assetCashflow, assetMarketValue, createMonthlyReport, effectiveAssetRevenue, isBankrupt, isFinanciallyFree, loanPayment, meetsFreedomConditions, pledgedLoanForAsset, portfolioManagementCost } from '../systems/economy'
import { developmentCost, emptySkills, grantProgress, playerLevel, skillLevel, trainingCost } from '../systems/progression'
import { createContractOptions, createStockMarginCall, emptyRecentCards, pickFresh, processAssetListings, settleContracts, stockFreeQuantity, updateGlobalEvent } from '../systems/v14'
import { handleDecisionV14Command, handleReadyV14Command, quickSellAssetForFunding, sellAssetShareForFunding } from './v14Core'
import { handleDecisionV15Command, handleReadyV15Command } from './v15Core'
import { applyDealProfileToAsset, createDealProfile, createSellerCounter, dealProjectedOperatingIncome, negotiationSpecializationBonus, refreshPortfolioSynergies, refreshRivalIntents, resolveEventChains, revealedDealFacts, scheduleDealChain } from '../systems/v15'
import { clampStockPriceForMonth, STOCK_COMMISSION_RATE, STOCK_MIN_PRICE, stockPurchaseTotal, stockSaleProceeds } from '../systems/stockSale'
import { addAssetInvestment, calculateAssetExitResult, calculatePartnershipTerms, recordAssetCashReturn, recordAssetNetCashflow, reduceAssetInvestmentBasis } from '../systems/v16'

export const emptyGame = (seed = Date.now()): GameState => ({
  version: 12,
  seed: seed >>> 0,
  phase: 'setup',
  day: 1,
  month: 1,
  round: 0,
  currentPlayerIndex: 0,
  lastRoll: null,
  players: [],
  pendingDecision: null,
  events: [],
  lastMonthlyReport: null,
  difficulty: 'normal',
  stockMarket: structuredClone(initialStockMarket),
  marketHeadline: 'Рынок открылся без сильных движений',
  globalEvent: null,
  recentCards: emptyRecentCards(),
  buyerOffers: [],
  activeMarginCall: null,
  eventChains: [],
  outcome: null,
})

const random = (state: GameState) => {
  state.seed = (Math.imul(1664525, state.seed) + 1013904223) >>> 0
  return state.seed / 4294967296
}

const pick = <T>(state: GameState, values: readonly T[]) => values[Math.floor(random(state) * values.length)]
const uid = (state: GameState, prefix: string) => `${prefix}-${state.month}-${state.day}-${state.seed}-${state.events.length}`

const addEvent = (state: GameState, title: string, description: string, tone: GameEvent['tone'] = 'neutral') => {
  state.events.unshift({ id: uid(state, 'event'), title, description, tone, month: state.month, day: state.day })
  state.events = state.events.slice(0, 40)
}

const botStrategies: BotStrategy[] = ['careful', 'balanced', 'aggressive']
const issueByRisk: Record<RiskRating, number> = { low: 0.12, medium: 0.24, high: 0.38 }
const issueLabels: Record<Exclude<BusinessIssue, 'none'>, string> = {
  documents: 'Проблема с документами или лицензией',
  lease: 'Слабый договор аренды и рост платежей',
  repair: 'Скрытая поломка оборудования',
  'hidden-debt': 'Неучтённый долг прошлого владельца',
}

const rollIssue = (state: GameState, risk: RiskRating, extraChance = 0): BusinessIssue => {
  if (random(state) >= Math.min(0.8, issueByRisk[risk] + extraChance)) return 'none'
  return pick(state, ['documents', 'lease', 'repair', 'hidden-debt'] as const)
}

const makePlayer = (professionId: string, name: string, isBot: boolean, index: number): Player => {
  const profession = professions.find((item) => item.id === professionId) ?? professions[0]
  return {
    id: isBot ? `bot-${index}` : 'human',
    name,
    isBot,
    professionId: profession.id,
    position: 0,
    cash: profession.cash,
    salary: profession.salary,
    baseExpenses: profession.expenses,
    baseDebt: profession.debt,
    assets: [],
    loans: [],
    deposit: 0,
    bonds: 0,
    stocks: [],
    resaleDeals: [],
    activeContracts: [],
    experience: 0,
    skills: emptySkills(),
    status: 'active',
    eliminatedMonth: null,
    botStrategy: isBot ? botStrategies[(index - 1) % botStrategies.length] : undefined,
    freedomStreak: 0,
    restructuringUsed: false,
    specialization: undefined,
    jobActive: true,
    rivalIntent: isBot ? 'Оценивает рынок и готовит следующий ход' : undefined,
  }
}

const decisionForCell = (state: GameState, type: (typeof board)[number]['type']): Decision => {
  const player = state.players[0]
  if (type === 'business') {
    const unlocked = businesses.filter((item) => item.requiredLevel <= playerLevel(player))
    const business = pickFresh(state, 'business', unlocked, (item) => item.id, () => random(state), 4)
    const profile = createDealProfile(business, () => random(state), uid(state, `profile-${business.id}`))
    const askingPrice = Math.round(business.price * profile.valueMultiplier / 10_000) * 10_000
    return {
      kind: 'business', businessId: business.id, askingPrice, originalAskingPrice: askingPrice, negotiated: false,
      inspection: 'none', hiddenIssue: rollIssue(state, business.riskRating), issueRevealed: false, profile, revealedFacts: [],
    }
  }
  if (type === 'expense') {
    const scenario = pickFresh(state, 'expense', expenseScenarios, (item) => item.id, () => random(state), 5)
    return { kind: 'expense', title: scenario.title, amount: scenario.amount, options: scenario.options }
  }
  if (type === 'contract') {
    const { card, options } = createContractOptions(state, player, () => random(state))
    return { kind: 'contract', title: card.title, description: card.description, options }
  }
  if (type === 'auction') {
    const unlocked = businesses.filter((item) => item.requiredLevel <= playerLevel(player))
    const business = pickFresh(state, 'business', unlocked, (item) => item.id, () => random(state), 4)
    const marketValue = business.price
    const minimumStep = Math.max(10_000, Math.round(marketValue * 0.05 / 10_000) * 10_000)
    return {
      kind: 'auction', businessId: business.id, title: business.name,
      currentBid: Math.round(marketValue * 0.65 / 10_000) * 10_000,
      marketValue, minimumStep, inspected: false,
      issue: rollIssue(state, business.riskRating, 0.08), issueRevealed: false,
      botCeilings: state.players.slice(1).map((bot) => Math.round(marketValue * (0.76 + random(state) * (bot.botStrategy === 'aggressive' ? 0.38 : bot.botStrategy === 'careful' ? 0.2 : 0.29)) / 10_000) * 10_000),
      leadingBot: null,
    }
  }
  if (type === 'partnership') {
    const unlocked = businesses.filter((item) => item.requiredLevel <= playerLevel(player))
    const business = pickFresh(state, 'business', unlocked, (item) => item.id, () => random(state), 4)
    const partnerPool = state.players.slice(1).filter((item) => item.status === 'active')
    const partnerName = partnerPool.length ? pick(state, partnerPool).name : pick(state, ['Ирина', 'Максим', 'Олег'])
    return {
      kind: 'partnership', businessId: business.id, title: business.name,
      description: `${partnerName} нашёл объект и предлагает разделить первый взнос, кредит и будущий доход.`,
      discount: 0.9, originalDiscount: 0.9, partnerName, negotiated: false,
    }
  }
  if (type === 'management') return { kind: 'management' }
  if (type === 'chance') {
    const availableRareDeals = rareDeals.filter((item) => item.minLevel <= playerLevel(player))
    if (availableRareDeals.length > 0 && random(state) < 0.18) {
      const deal = pickFresh(state, 'chance', availableRareDeals, (item) => item.id, () => random(state), 5)
      const business = businesses.find((item) => item.id === deal.businessId)!
      const profile = createDealProfile(business, () => random(state), uid(state, `profile-${deal.id}`))
      const askingPrice = Math.round(business.price * deal.discount * profile.valueMultiplier / 10_000) * 10_000
      return {
        kind: 'opportunity', opportunityId: deal.id, businessId: business.id,
        askingPrice, originalAskingPrice: askingPrice, title: deal.title, description: deal.description,
        inspection: 'none', hiddenIssue: rollIssue(state, business.riskRating, deal.issueChance * 0.45), issueRevealed: false, profile, revealedFacts: [],
      }
    }
    const card = pickFresh(state, 'chance', chanceCards, (item) => item[0], () => random(state), 5)
    const [title, investment, minReturn, maxReturn, durationMonths] = card
    return { kind: 'chance', title, investment, minReturn, maxReturn, durationMonths }
  }
  if (type === 'market') return { kind: 'market', title: state.marketHeadline, description: 'Смотри не только на движение цены, но и на риск, дивиденды и долю акций в капитале.' }
  return { kind: type }
}

const updateAssetMarket = (state: GameState, player: Player) => {
  const settings = difficultySettings[state.difficulty]
  player.assets.forEach((asset) => {
    const marketMove = (random(state) * 2 - 1) * settings.marketVolatility
    const businessQuality = Math.min(0.06, asset.developmentLevel * 0.012)
    const currentValue = assetMarketValue(asset)
    asset.marketValue = Math.max(Math.round(asset.price * asset.ownership * 0.55), Math.round(currentValue * (1 + marketMove + businessQuality)))
    asset.saleOffer = null
    asset.offerExpiresMonth = null
    if (player.isBot && random(state) < settings.offerChance) {
      const premium = 0.91 + random(state) * 0.24 + asset.developmentLevel * 0.01
      asset.saleOffer = Math.round(asset.marketValue * premium)
      asset.offerExpiresMonth = state.month + 1
    }
    if ((asset.launchMonthsRemaining ?? 0) > 0) {
      asset.launchMonthsRemaining = Math.max(0, (asset.launchMonthsRemaining ?? 0) - 1)
      if (asset.launchMonthsRemaining === 0 && !asset.legalIssue) asset.status = 'active'
    }
    if ((asset.incidentCooldown ?? 0) > 0) {
      asset.incidentCooldown = Math.max(0, (asset.incidentCooldown ?? 0) - 1)
      if (asset.incidentCooldown === 0 && !asset.issueCost && asset.status === 'stressed') {
        asset.status = 'active'
        asset.legalIssue = undefined
      }
    }
    asset.loan = Math.max(0, asset.loan - Math.round(asset.monthlyPayment * 0.68))
    asset.monthlyPayment = asset.loan > 0 ? loanPayment(asset.loan, asset.loanRate, Math.max(1, asset.loanTermMonths - Math.max(0, state.month - asset.purchaseMonth))) : 0
  })
  player.loans.forEach((loan) => {
    loan.balance = Math.max(0, loan.balance - Math.round(loan.monthlyPayment * 0.72))
    loan.missedPayments = Math.max(0, (loan.missedPayments ?? 0) - 1)
    loan.termMonths = Math.max(0, loan.termMonths - 1)
    loan.monthlyPayment = loan.balance > 0 ? Math.min(loan.monthlyPayment, loanPayment(loan.balance, loan.annualRate, Math.max(1, loan.termMonths))) : 0
  })
  for (const loan of player.loans.filter((item) => item.balance <= 0 && item.collateralStockId)) {
    const holding = player.stocks.find((item) => item.stockId === loan.collateralStockId)
    if (holding) holding.pledgedQuantity = Math.max(0, (holding.pledgedQuantity ?? 0) - (loan.collateralStockQuantity ?? 0))
  }
  player.loans = player.loans.filter((loan) => loan.balance > 0)
}

const updateStockMarket = (state: GameState) => {
  const settings = difficultySettings[state.difficulty]
  const headline = pick(state, marketHeadlines)
  state.marketHeadline = headline.title
  state.stockMarket.forEach((quote) => {
    quote.previousPrice = quote.price
    const sectorImpact = quote.sector === headline.sector ? headline.impact : 0
    const marketNoise = (random(state) * 2 - 1) * settings.marketVolatility * 1.45
    const move = Math.max(-0.32, Math.min(0.36, sectorImpact + marketNoise))
    quote.price = Math.max(STOCK_MIN_PRICE, Math.round(quote.price * (1 + move)))
  })
  if (random(state) < 0.12) {
    const quote = pick(state, state.stockMarket)
    const crash = random(state) < 0.48
    const move = crash ? -0.5 : 0.5 + random(state) * 0.15
    quote.price = Math.max(STOCK_MIN_PRICE, Math.round(quote.price * (1 + move)))
    state.marketHeadline = crash ? `${quote.ticker}: обвал на 50%` : `${quote.ticker}: сильный рост ${Math.round(move * 100)}%`
  }
}

const clampFinalStockMoves = (state: GameState) => {
  for (const quote of state.stockMarket) {
    quote.price = clampStockPriceForMonth(quote.previousPrice, quote.price)
  }
}

const settleResales = (state: GameState, player: Player, nextMonth: number) => {
  let returns = 0
  const settings = difficultySettings[state.difficulty]
  for (const deal of player.resaleDeals) {
    if (deal.resolvesMonth > nextMonth) continue
    const canDelay = deal.delays < 1
    if (canDelay && random(state) < settings.resaleDelayChance) {
      deal.resolvesMonth += 1
      deal.delays += 1
      if (!player.isBot) addEvent(state, 'Товар завис', `${deal.title}: покупатель сорвался, ждём ещё месяц.`, 'bad')
      continue
    }
    returns += deal.outcomeAmount
    if (!player.isBot) {
      const profit = deal.outcomeAmount - deal.investment
      addEvent(state, 'Перепродажа завершена', `${deal.title}: ${profit >= 0 ? '+' : ''}${profit.toLocaleString('ru-RU')} ₽`, profit >= 0 ? 'good' : 'bad')
    }
  }
  player.resaleDeals = player.resaleDeals.filter((deal) => deal.resolvesMonth > nextMonth)
  return returns
}

const applyIssueToAsset = (asset: Asset, issue: BusinessIssue) => {
  if (issue === 'none') return
  asset.legalIssue = issueLabels[issue]
  asset.issueMonths = 0
  if (issue === 'documents') {
    asset.status = 'suspended'
    asset.issueCost = Math.round(asset.price * 0.08 * asset.ownership)
    asset.marketValue = Math.round(assetMarketValue(asset) * 0.78)
  } else if (issue === 'lease') {
    asset.status = 'stressed'
    asset.issueCost = Math.round(asset.price * 0.045 * asset.ownership)
    asset.operatingCosts = Math.round(asset.operatingCosts * 1.18)
  } else if (issue === 'repair') {
    asset.status = 'stressed'
    asset.issueCost = Math.round(asset.price * 0.06 * asset.ownership)
    asset.marketValue = Math.round(assetMarketValue(asset) * 0.86)
  } else {
    asset.status = 'stressed'
    const hiddenDebt = Math.round(asset.price * 0.09 * asset.ownership)
    asset.loan += hiddenDebt
    asset.monthlyPayment = loanPayment(asset.loan, Math.max(asset.loanRate, 0.28), asset.loanTermMonths)
    asset.issueCost = Math.round(hiddenDebt * 0.35)
  }
}

const processAssetRisks = (state: GameState, player: Player) => {
  const difficultyMultiplier = state.difficulty === 'easy' ? 0.7 : state.difficulty === 'hard' ? 1.35 : 1
  const managementProtection = Math.max(0.62, 1 - skillLevel(player, 'management') * 0.1)
  for (const asset of [...player.assets]) {
    if (asset.legalIssue) {
      asset.issueMonths = (asset.issueMonths ?? 0) + 1
      if ((asset.issueMonths ?? 0) >= 3 && asset.status === 'suspended') {
        repossessAsset(state, player, asset, 'юридическая проблема не устранена, актив принудительно реализован')
      }
      continue
    }
    if ((asset.insuredUntilMonth ?? 0) >= state.month || (asset.warrantyUntilMonth ?? 0) >= state.month) continue
    if ((asset.launchMonthsRemaining ?? 0) > 0 || (asset.incidentCooldown ?? 0) > 0) continue
    const base = asset.riskRating === 'low' ? 0.04 : asset.riskRating === 'medium' ? 0.08 : 0.13
    const diligenceProtection = asset.dueDiligence === 'full' ? 0.48 : asset.dueDiligence === 'basic' ? 0.72 : 1
    if (random(state) >= base * difficultyMultiplier * managementProtection * diligenceProtection) continue
    const issue = pick(state, ['documents', 'lease', 'repair'] as const)
    applyIssueToAsset(asset, issue)
    if (!player.isBot) addEvent(state, 'Проблема в бизнесе', `${asset.name}: ${issueLabels[issue]}.`, 'bad')
  }
}

const addDeficiencyDebt = (state: GameState, player: Player, assetName: string, amount: number) => {
  if (amount <= 0) return
  const rate = 0.36
  const termMonths = 36
  player.loans.push({
    id: uid(state, 'deficiency'), name: `Остаток после изъятия: ${assetName}`,
    balance: amount, annualRate: rate, termMonths,
    monthlyPayment: loanPayment(amount, rate, termMonths), missedPayments: 0,
  })
}

const repossessAsset = (state: GameState, player: Player, asset: Asset, reason: string) => {
  if (!player.assets.some((item) => item.id === asset.id)) return
  const pledged = pledgedLoanForAsset(player, asset.id)
  const forcedPrice = Math.round(assetMarketValue(asset) * 0.68)
  const securedDebt = asset.loan + (pledged?.balance ?? 0)
  const surplus = Math.max(0, forcedPrice - securedDebt)
  const deficiency = Math.max(0, securedDebt - forcedPrice)
  if (pledged) player.loans = player.loans.filter((loan) => loan.id !== pledged.id)
  player.assets = player.assets.filter((item) => item.id !== asset.id)
  player.cash += surplus
  addDeficiencyDebt(state, player, asset.name, deficiency)
  addEvent(state, 'Банк забрал актив', `${asset.name}: ${reason}. Продажа банком ${forcedPrice.toLocaleString('ru-RU')} ₽${deficiency > 0 ? `, остаточный долг ${deficiency.toLocaleString('ru-RU')} ₽` : ''}.`, 'bad')
}

const coverShortfallFromReserves = (player: Player) => {
  if (player.cash >= 0) return
  const fromDeposit = Math.min(player.deposit, -player.cash)
  player.deposit -= fromDeposit
  player.cash += fromDeposit
  const fromBonds = Math.min(player.bonds, -player.cash)
  player.bonds -= fromBonds
  player.cash += fromBonds
}

const handleDebtStress = (state: GameState, player: Player) => {
  coverShortfallFromReserves(player)
  if (player.cash >= 0) {
    player.assets.forEach((asset) => { asset.missedPayments = Math.max(0, (asset.missedPayments ?? 0) - 1) })
    return
  }

  addEvent(state, 'Просрочка платежей', `${player.name}: кассовый разрыв ${Math.abs(player.cash).toLocaleString('ru-RU')} ₽.`, player.isBot ? 'neutral' : 'bad')
  player.assets.forEach((asset) => { if (asset.loan > 0) asset.missedPayments = (asset.missedPayments ?? 0) + 1 })
  player.loans.forEach((loan) => { loan.missedPayments = (loan.missedPayments ?? 0) + 1 })

  for (const loan of [...player.loans]) {
    if (!loan.collateralAssetId || (loan.missedPayments ?? 0) < 2) continue
    const collateral = player.assets.find((asset) => asset.id === loan.collateralAssetId)
    if (collateral) repossessAsset(state, player, collateral, 'две просрочки по залоговому кредиту')
  }
  for (const asset of [...player.assets]) {
    if ((asset.missedPayments ?? 0) >= 2 || ((asset.issueMonths ?? 0) >= 3 && asset.status === 'suspended')) {
      repossessAsset(state, player, asset, (asset.missedPayments ?? 0) >= 2 ? 'две просрочки по кредиту бизнеса' : 'бизнес не устранил юридическую проблему')
    }
  }

  const toxicLoan = player.loans.find((loan) => !loan.collateralAssetId && (loan.missedPayments ?? 0) >= 3)
  if (toxicLoan) {
    const forcedAsset = player.assets.filter((asset) => !pledgedLoanForAsset(player, asset.id)).sort((a, b) => assetMarketValue(b) - assetMarketValue(a))[0]
    if (forcedAsset) {
      const forcedPrice = Math.round(assetMarketValue(forcedAsset) * 0.64)
      const before = player.cash
      sellAsset(player, forcedAsset, forcedPrice)
      const available = Math.max(0, player.cash - Math.max(0, before))
      const payment = Math.min(available, toxicLoan.balance)
      toxicLoan.balance -= payment
      player.cash -= payment
      toxicLoan.monthlyPayment = toxicLoan.balance > 0 ? loanPayment(toxicLoan.balance, toxicLoan.annualRate, Math.max(1, toxicLoan.termMonths)) : 0
      addEvent(state, 'Принудительная продажа', `${forcedAsset.name} продан со скидкой для погашения просроченного долга.`, 'bad')
      player.loans = player.loans.filter((loan) => loan.balance > 0)
    }
  }
}

const recordMonthlyAssetReturns = (player: Player) => {
  if (player.assets.length === 0) return
  const managementCost = portfolioManagementCost(player)
  const totalEffectiveRevenue = player.assets.reduce((sum, asset) => sum + Math.max(0, effectiveAssetRevenue(asset)), 0)
  for (const asset of player.assets) {
    const acquisitionLoanPayment = player.loans
      .filter((loan) => loan.relatedAssetId === asset.id)
      .reduce((sum, loan) => sum + loan.monthlyPayment, 0)
    const managementShare = managementCost <= 0
      ? 0
      : totalEffectiveRevenue > 0
        ? Math.round(managementCost * Math.max(0, effectiveAssetRevenue(asset)) / totalEffectiveRevenue)
        : Math.round(managementCost / player.assets.length)
    recordAssetNetCashflow(asset, assetCashflow(asset) - acquisitionLoanPayment - managementShare)
  }
}

const recordMonthlyStockReturns = (player: Player, market: GameState['stockMarket']) => {
  for (const holding of player.stocks) {
    const quote = market.find((item) => item.id === holding.stockId)
    if (!quote) continue
    const dividend = Math.round(holding.quantity * quote.price * quote.dividendYield / 12)
    holding.cumulativeDividends = Math.max(0, Math.round((holding.cumulativeDividends ?? 0) + dividend))
  }
  for (const loan of player.loans) {
    if (!loan.relatedStockId || loan.balance <= 0) continue
    const holding = player.stocks.find((item) => item.stockId === loan.relatedStockId)
    if (!holding) continue
    const principalReduction = Math.min(loan.balance, Math.round(loan.monthlyPayment * 0.72))
    const financingCost = Math.max(0, loan.monthlyPayment - principalReduction)
    holding.cumulativeFinancingCosts = Math.max(0, Math.round((holding.cumulativeFinancingCosts ?? 0) + financingCost))
  }
}

const settleMonth = (state: GameState) => {
  const nextMonth = state.month + 1
  const resaleReturns = state.players.map((player) => player.status === 'active' ? settleResales(state, player, nextMonth) : 0)
  const contractReturns = state.players.map((player) => player.status === 'active' ? settleContracts(state, player, nextMonth, () => random(state)) : 0)
  state.players.forEach((player) => { if (player.status === 'active') processAssetRisks(state, player) })
  resolveEventChains(state, nextMonth, () => random(state), (title, description, tone = 'neutral') => addEvent(state, title, description, tone))
  state.players.forEach((player) => { if (player.status === 'active') recordMonthlyAssetReturns(player) })
  state.players.forEach((player) => { if (player.status === 'active') recordMonthlyStockReturns(player, state.stockMarket) })
  const humanReport = createMonthlyReport(state.players[0], state.month, state.stockMarket, resaleReturns[0], contractReturns[0])
  state.players.forEach((player, index) => {
    if (player.status !== 'active') return
    const report = createMonthlyReport(player, state.month, state.stockMarket, resaleReturns[index], contractReturns[index])
    player.cash += report.netCashflow
    player.baseDebt = Math.max(0, player.baseDebt - Math.round(player.baseDebt * 0.014))
    handleDebtStress(state, player)
  })
  state.players.forEach((player) => {
    if (player.status === 'active') {
      refreshPortfolioSynergies(player)
      updateAssetMarket(state, player)
    }
  })
  updateStockMarket(state)
  state.month = nextMonth
  state.day = 1
  updateGlobalEvent(state, () => random(state))
  clampFinalStockMoves(state)
  processAssetListings(state, () => random(state))
  state.activeMarginCall = createStockMarginCall(state.players[0], state.stockMarket)
  refreshRivalIntents(state)
  state.players.forEach((player) => {
    if (player.status !== 'active') return
    player.freedomStreak = meetsFreedomConditions(player, state.stockMarket) ? (player.freedomStreak ?? 0) + 1 : 0
  })
  state.lastMonthlyReport = humanReport
  addEvent(state, 'Итоги месяца', `Чистый результат: ${humanReport.netCashflow.toLocaleString('ru-RU')} ₽. Устойчивость свободы: ${state.players[0].freedomStreak ?? 0}/3 мес.`, humanReport.netCashflow >= 0 ? 'good' : 'bad')
}

const advanceCalendar = (state: GameState) => {
  // A month is seven human turns: six four-day steps and a final five-day step.
  // Bot count never affects the calendar because this runs once per human turn.
  state.day += state.day >= 25 ? 5 : 4
  state.round += 1
  if (state.day >= 30) settleMonth(state)
}

const makeAsset = (state: GameState, player: Player, businessId: string, funding: Funding, dealPrice?: number, collateralAssetId?: string, diligence: DueDiligence = 'none', hiddenIssue: BusinessIssue = 'none', profile?: import('../domain/types').DealProfile, sellerTerm?: import('../domain/types').SellerCounter['term']): Asset | null => {
  const business = businesses.find((item) => item.id === businessId)
  if (!business) return null
  const ownership = funding === 'partner30' ? 0.7 : funding === 'partner50' ? 0.5 : 1
  const assetId = uid(state, business.id)
  const purchasePrice = dealPrice ?? business.price
  const financedLoan = Math.min(purchasePrice, Math.round(business.loan * (purchasePrice / business.price)))
  const downPayment = Math.round(Math.max(0, purchasePrice - financedLoan) * ownership)
  const purchaseCashContribution = Math.min(player.cash, downPayment)
  const acquisitionGap = Math.max(0, downPayment - player.cash)
  if (funding === 'cash' && acquisitionGap > 0) return null
  if ((funding === 'partner30' || funding === 'partner50') && acquisitionGap > 0) return null
  const assetLoan = Math.round(financedLoan * ownership)
  const projectedAssetPayment = loanPayment(assetLoan, business.loanRate, business.loanTermMonths)
  if ((funding === 'credit' || funding === 'secured') && acquisitionGap > 0) {
    if (funding === 'credit' && player.cash < downPayment * 0.3) return null
    const collateral = funding === 'secured' ? player.assets.find((asset) => asset.id === collateralAssetId) : undefined
    if (funding === 'secured' && !collateral) return null
    const projectedIncome = Math.round(dealProjectedOperatingIncome(profile, diligence, business.revenue, business.operatingCosts) * ownership)
    const assessment = assessLoan(player, acquisitionGap, state.difficulty, collateral, projectedIncome, projectedAssetPayment, state.globalEvent?.creditRateDelta ?? 0)
    if (!assessment.approved) return null
    player.loans.push({
      id: uid(state, 'loan'),
      name: funding === 'secured' ? `Залог: ${collateral!.name}` : `Взнос: ${business.name}`,
      balance: acquisitionGap,
      monthlyPayment: assessment.monthlyPayment,
      annualRate: assessment.annualRate,
      termMonths: assessment.termMonths,
      collateralAssetId: collateral?.id,
      relatedAssetId: assetId,
      missedPayments: 0,
    })
    player.cash += acquisitionGap
  }
  player.cash -= downPayment
  const asset: Asset = {
    ...business,
    id: assetId,
    ownerId: player.id,
    ownership,
    price: purchasePrice,
    downPayment,
    loan: assetLoan,
    revenue: Math.round(business.revenue * ownership),
    operatingCosts: Math.round(business.operatingCosts * ownership),
    monthlyPayment: projectedAssetPayment,
    purchaseMonth: state.month,
    developmentLevel: 0,
    developments: [],
    totalDevelopmentCost: 0,
    lastDevelopedMonth: null,
    saleOffer: null,
    offerExpiresMonth: null,
    status: 'launching',
    dueDiligence: diligence,
    launchMonthsRemaining: business.category === 'Недвижимость' ? 1 : 2,
    incidentCooldown: 0,
    issueMonths: 0,
    missedPayments: 0,
    listingPrice: null,
    listingStartedMonth: null,
    listingExpiresMonth: null,
    externalRevenueMultiplier: state.globalEvent?.category === business.category ? state.globalEvent.revenueMultiplier : 1,
    purchaseCashContribution,
    cashInvested: purchaseCashContribution,
    lifetimeCashInvested: purchaseCashContribution,
    cashReturned: 0,
    cumulativeNetCashflow: 0,
  }
  applyDealProfileToAsset(asset, profile, sellerTerm)
  applyIssueToAsset(asset, hiddenIssue)
  if (!player.isBot) scheduleDealChain(state, asset)
  return asset
}

const applyDevelopment = (asset: Asset, developmentId: string, cost: number, marketingLevel = 0) => {
  const development = developments.find((item) => item.id === developmentId)
  if (!development) return false
  const marketingBonus = development.id === 'marketing' ? marketingLevel * 0.04 : 0
  asset.revenue = Math.round(asset.revenue * (1 + development.revenueRate + marketingBonus))
  asset.operatingCosts = Math.max(0, Math.round(asset.operatingCosts * (1 + development.costGrowthRate)))
  asset.marketValue = Math.round(assetMarketValue(asset) * (1 + development.valueRate))
  asset.developments.push(development.id)
  asset.developmentLevel += 1
  addAssetInvestment(asset, cost)
  asset.totalDevelopmentCost += cost
  return true
}

const sellAsset = (player: Player, asset: Asset, grossPrice: number) => {
  const collateralLoan = pledgedLoanForAsset(player, asset.id)
  const collateralDebt = collateralLoan?.balance ?? 0
  const totalSecuredDebt = asset.loan + collateralDebt
  const proceeds = Math.max(0, grossPrice - totalSecuredDebt)
  const deficiency = Math.max(0, totalSecuredDebt - grossPrice)
  const bankPayment = Math.min(grossPrice, totalSecuredDebt)
  if (collateralLoan) player.loans = player.loans.filter((loan) => loan.id !== collateralLoan.id)
  if (deficiency > 0) {
    const rate = 0.36
    const termMonths = 36
    player.loans.push({ id: `sale-deficiency-${asset.id}`, name: `Остаток после продажи: ${asset.name}`, balance: deficiency, monthlyPayment: loanPayment(deficiency, rate, termMonths), annualRate: rate, termMonths, missedPayments: 0 })
  }
  player.cash += proceeds
  player.assets = player.assets.filter((item) => item.id !== asset.id)
  const businessLoanPayment = Math.min(asset.loan, bankPayment)
  const collateralPayment = Math.max(0, bankPayment - businessLoanPayment)
  return { proceeds, collateralPayment, bankPayment, deficiency }
}


const liquidateAssetsForDeal = (player: Player, saleAssetIds: string[] | undefined, collateralAssetId?: string) => {
  const ids = [...new Set(saleAssetIds ?? [])]
  if (collateralAssetId && ids.includes(collateralAssetId)) {
    return { ok: false as const, error: 'Один актив нельзя одновременно продать и заложить' }
  }
  const assets = ids.map((id) => player.assets.find((asset) => asset.id === id))
  if (assets.some((asset) => !asset)) return { ok: false as const, error: 'Один из выбранных активов уже недоступен' }

  const sold: Array<{ name: string; proceeds: number }> = []
  for (const asset of assets as Asset[]) {
    const result = sellAsset(player, asset, Math.round(assetMarketValue(asset) * 0.93))
    sold.push({ name: asset.name, proceeds: result.proceeds })
  }
  return { ok: true as const, sold }
}

const awardProgress = (state: GameState, player: Player, experience: number, skillId?: Parameters<typeof grantProgress>[2], skillPoints = 0) => {
  const oldLevel = playerLevel(player)
  const oldSkillLevel = skillId ? skillLevel(player, skillId) : 0
  grantProgress(player, experience, skillId, skillPoints)
  const newLevel = playerLevel(player)
  const newSkillLevel = skillId ? skillLevel(player, skillId) : 0
  if (skillId === 'brand' && newSkillLevel > oldSkillLevel) player.salary += 12_000 * (newSkillLevel - oldSkillLevel)
  if (!player.isBot && newLevel > oldLevel) addEvent(state, 'Новый уровень', `Теперь доступен уровень ${newLevel}. Открылись более крупные сделки.`, 'good')
}

const runBots = (state: GameState) => {
  const settings = difficultySettings[state.difficulty]
  for (let index = 1; index < state.players.length; index += 1) {
    const bot = state.players[index]
    if (bot.status !== 'active') continue
    const strategy = bot.botStrategy ?? 'balanced'
    const risk = strategy === 'careful' ? 0.72 : strategy === 'aggressive' ? 1.25 : 1
    const roll = 1 + Math.floor(random(state) * 6)
    bot.position = (bot.position + roll) % board.length
    const cell = board[bot.position]

    for (const asset of bot.assets.slice()) {
      const offerPremium = asset.saleOffer ? asset.saleOffer / Math.max(1, assetMarketValue(asset)) : 0
      const weakAsset = assetCashflow(asset) < 0
      if ((offerPremium > (strategy === 'aggressive' ? 1.16 : 1.08) || weakAsset) && random(state) < settings.botActivity) {
        sellAsset(bot, asset, asset.saleOffer ?? assetMarketValue(asset))
        addEvent(state, 'Соперник продал актив', `${bot.name} вышел из ${asset.name}`)
      }
    }

    if (bot.assets.length > 0 && random(state) < settings.botActivity * 0.42) {
      const asset = pick(state, bot.assets)
      const available = developments.filter((item) => !asset.developments.includes(item.id))
      const development = available[0]
      if (development) {
        const cost = developmentCost(bot, asset, development.costRate)
        if (bot.cash > cost + bot.baseExpenses * (strategy === 'careful' ? 1 : 0.35)) {
          applyDevelopment(asset, development.id, cost, skillLevel(bot, 'marketing'))
          bot.cash -= cost
          awardProgress(state, bot, 35, development.id === 'marketing' ? 'marketing' : 'management', 10)
          addEvent(state, 'Соперник развивает бизнес', `${bot.name}: ${asset.name} - ${development.name}`)
        }
      }
    }

    if (cell.type === 'business' && random(state) < settings.botActivity * risk) {
      const unlocked = businesses.filter((item) => item.requiredLevel <= playerLevel(bot))
      const business = pick(state, unlocked)
      const payment = loanPayment(business.loan, business.loanRate, business.loanTermMonths)
      const profitable = business.revenue - business.operatingCosts - payment > 0
      const reserve = bot.baseExpenses * (strategy === 'careful' ? 2 : strategy === 'aggressive' ? 0.6 : 1.2)
      if (profitable && bot.cash > business.downPayment * 0.3 + reserve) {
        const funding: Funding = bot.cash >= business.downPayment + reserve ? 'cash' : bot.cash >= business.downPayment * 0.5 + reserve ? 'partner50' : 'credit'
        const discount = random(state) < settings.negotiationChance * 0.45 ? 0.92 : 1
        const diligence: DueDiligence = strategy === 'careful' ? 'full' : strategy === 'balanced' ? 'basic' : 'none'
        const hiddenIssue = diligence === 'full' ? 'none' : rollIssue(state, business.riskRating, diligence === 'basic' ? -0.1 : 0)
        const asset = makeAsset(state, bot, business.id, funding, Math.round(business.price * discount), undefined, diligence, hiddenIssue)
        if (asset) {
          bot.assets.push(asset)
          awardProgress(state, bot, 55, 'finance', 8)
          addEvent(state, 'Ход соперника', `${bot.name} купил ${business.name}${discount < 1 ? ' после торга' : ''}`)
        }
      }
    }
    if (cell.type === 'expense') bot.cash -= pick(state, expenseCards)[1]
    if (cell.type === 'market' && random(state) < settings.botActivity) {
      const quotes = [...state.stockMarket].sort((a, b) => strategy === 'careful' ? b.dividendYield - a.dividendYield : (b.price / b.previousPrice) - (a.price / a.previousPrice))
      const quote = quotes[0]
      const reserve = bot.baseExpenses * (strategy === 'careful' ? 1 : 0.35)
      const buyPrice = stockPurchaseTotal(quote.price, 1)
      if (bot.cash >= buyPrice + reserve) {
        bot.cash -= buyPrice
        const holding = bot.stocks.find((item) => item.stockId === quote.id)
        if (holding) {
          const oldQuantity = holding.quantity
          const oldCostBasis = holding.costBasis ?? holding.averagePrice * oldQuantity
          const oldMarketCostBasis = holding.marketCostBasis ?? (holding.averageMarketPrice ?? Math.round(holding.averagePrice / (1 + STOCK_COMMISSION_RATE))) * oldQuantity
          const newQuantity = oldQuantity + 1
          holding.costBasis = oldCostBasis + buyPrice
          holding.marketCostBasis = oldMarketCostBasis + quote.price
          holding.averagePrice = Math.round(holding.costBasis / newQuantity)
          holding.averageMarketPrice = Math.round(holding.marketCostBasis / newQuantity)
          holding.purchaseFees = holding.costBasis - holding.marketCostBasis
          holding.quantity = newQuantity
        } else bot.stocks.push({ stockId: quote.id, quantity: 1, averagePrice: buyPrice, averageMarketPrice: quote.price, costBasis: buyPrice, marketCostBasis: quote.price, purchaseFees: buyPrice - quote.price })
      }
    }
    if (cell.type === 'contract' && random(state) < settings.botActivity * 0.72) {
      const { card, options } = createContractOptions(state, bot, () => random(state))
      const option = strategy === 'careful' ? options[0] : strategy === 'aggressive' ? options[2] : options[1]
      const reserve = bot.baseExpenses * (strategy === 'careful' ? 1 : 0.35)
      if (option && bot.cash >= option.investment + reserve) {
        bot.cash -= option.investment
        bot.activeContracts.push({ id: uid(state, 'bot-contract'), title: `${card.title}: ${option.title}`, investment: option.investment, payout: option.payout, resolvesMonth: state.month + option.durationMonths, successChance: option.successChance, skillId: option.skillId })
        awardProgress(state, bot, 18, option.skillId, 5)
      }
    }
    if (cell.type === 'chance' && random(state) < settings.botActivity * 0.55) {
      const [title, investment, minReturn, maxReturn, durationMonths] = pick(state, chanceCards)
      if (bot.cash > investment + bot.baseExpenses * 0.4) {
        bot.cash -= investment
        bot.resaleDeals.push({ id: uid(state, 'bot-resale'), title, investment, expectedMin: minReturn, expectedMax: maxReturn, resolvesMonth: state.month + durationMonths, outcomeAmount: Math.round(minReturn + random(state) * (maxReturn - minReturn)), delays: 0 })
        awardProgress(state, bot, 18, 'brand', 5)
      }
    }
  }
}

const finishGame = (state: GameState, winnerId: string | null, reason: NonNullable<GameState['outcome']>['reason']) => {
  state.phase = 'finished'
  state.pendingDecision = null
  state.outcome = { winnerId, reason }
  const winner = state.players.find((player) => player.id === winnerId)
  if (reason === 'human-bankrupt') addEvent(state, 'Партия окончена', 'Твоя экономика не выдержала долговой нагрузки.', 'bad')
  else if (winner) addEvent(state, 'Победитель определён', `${winner.name} первым завершил гонку.`, winner.isBot ? 'bad' : 'good')
}

const evaluateCompetition = (state: GameState) => {
  for (const player of state.players) {
    if (player.status !== 'active') continue
    if (isFinanciallyFree(player, state.stockMarket)) {
      player.status = 'free'
      finishGame(state, player.id, 'freedom')
      return
    }
    if (isBankrupt(player, state.stockMarket)) {
      player.status = 'bankrupt'
      player.eliminatedMonth = state.month
      addEvent(state, 'Банкротство', `${player.name} выбыл из гонки.`, player.isBot ? 'neutral' : 'bad')
      if (!player.isBot) {
        finishGame(state, null, 'human-bankrupt')
        return
      }
    }
  }
  const active = state.players.filter((player) => player.status === 'active')
  if (active.length === 1 && state.players.length > 1) finishGame(state, active[0].id, 'last-solvent')
}

const completeHumanTurn = (state: GameState) => {
  state.pendingDecision = null
  runBots(state)
  advanceCalendar(state)
  state.currentPlayerIndex = 0
  state.phase = 'ready'
  evaluateCompetition(state)
}

const reject = (state: GameState, error: string): CommandResult => ({ state, accepted: false, error })

export const executeCommand = (current: GameState, command: GameCommand): CommandResult => {
  const state = structuredClone(current)

  if (command.type === 'START_GAME') {
    if (state.phase !== 'setup') return reject(current, 'Партия уже началась')
    const profession = professions.find((item) => item.id === command.professionId)
    if (!profession) return reject(current, 'Профессия не найдена')
    const botCount = Math.min(3, Math.max(1, command.botCount ?? 2))
    const botProfessions = professions.filter((item) => item.id !== profession.id)
    const started = emptyGame(command.seed ?? state.seed)
    started.difficulty = command.difficulty ?? 'normal'
    started.players = [makePlayer(profession.id, 'Ты', false, 0)]
    const botNames = ['Алексей', 'Марина', 'Денис']
    for (let index = 0; index < botCount; index += 1) started.players.push(makePlayer(botProfessions[index % botProfessions.length].id, botNames[index], true, index + 1))
    started.phase = 'ready'
    addEvent(started, 'Партия началась', 'Цель - покрыть расходы пассивным доходом.', 'good')
    return { state: started, accepted: true }
  }

  if (state.phase === 'setup' || state.phase === 'finished') return reject(current, 'Команда сейчас недоступна')
  const player = state.players[0]
  state.recentCards ??= emptyRecentCards()
  state.buyerOffers ??= []
  state.globalEvent ??= null
  state.activeMarginCall ??= null
  state.eventChains ??= []
  player.activeContracts ??= []

  const v14Anytime = command.type === 'RESPOND_BUYER_OFFER' || command.type === 'RESOLVE_MARGIN_CALL'
  const stockPledgeWindow = command.type === 'PLEDGE_STOCK' && (state.phase === 'ready' || state.pendingDecision?.kind === 'market')
  if (state.phase === 'ready' || v14Anytime || stockPledgeWindow) {
    const v15 = handleReadyV15Command(state, command)
    if (v15.handled) return v15.accepted ? { state, accepted: true } : reject(current, v15.error ?? 'Операция недоступна')
    const v14 = handleReadyV14Command(state, command, () => random(state))
    if (v14.handled) return v14.accepted ? { state, accepted: true } : reject(current, v14.error ?? 'Операция недоступна')
  }
  if (state.activeMarginCall) return reject(current, 'Сначала урегулируй маржин-колл')

  if (command.type === 'RESOLVE_ASSET_ISSUE') {
    if (state.phase !== 'ready') return reject(current, 'Проблему можно решать между ходами')
    const asset = player.assets.find((item) => item.id === command.assetId)
    if (!asset || !asset.legalIssue || !asset.issueCost) return reject(current, 'У этого актива нет проблемы, требующей оплаты')
    if (player.cash < asset.issueCost) return reject(current, 'Не хватает денег на устранение проблемы')
    player.cash -= asset.issueCost
    addAssetInvestment(asset, asset.issueCost)
    addEvent(state, 'Проблема устранена', `${asset.name}: ${asset.legalIssue}. Потрачено ${asset.issueCost.toLocaleString('ru-RU')} ₽.`, 'good')
    asset.legalIssue = undefined
    asset.issueCost = undefined
    asset.issueMonths = 0
    asset.status = (asset.launchMonthsRemaining ?? 0) > 0 ? 'launching' : 'active'
    return { state, accepted: true }
  }

  if (command.type === 'DEVELOP_ASSET') {
    if (state.phase !== 'ready') return reject(current, 'Развитие доступно между ходами')
    const asset = player.assets.find((item) => item.id === command.assetId)
    const development = developments.find((item) => item.id === command.developmentId)
    if (!asset || !development) return reject(current, 'Развитие не найдено')
    if (asset.developments.includes(development.id)) return reject(current, 'Это улучшение уже сделано')
    if (asset.lastDevelopedMonth === state.month) return reject(current, 'Этот бизнес уже развивали в текущем месяце')
    const cost = developmentCost(player, asset, development.costRate)
    if (player.cash < cost) return reject(current, 'Не хватает денег на развитие')
    player.cash -= cost
    applyDevelopment(asset, development.id, cost, skillLevel(player, 'marketing'))
    asset.lastDevelopedMonth = state.month
    awardProgress(state, player, 45, development.id === 'marketing' ? 'marketing' : 'management', 14)
    addEvent(state, 'Развитие бизнеса', `${asset.name}: ${development.name}, вложено ${cost.toLocaleString('ru-RU')} ₽`, 'good')
    return { state, accepted: true }
  }

  if (command.type === 'BUY_PARTNER_SHARE' || command.type === 'SELL_PARTNER_SHARE') {
    if (state.phase !== 'ready') return reject(current, 'Доли можно менять между ходами')
    const asset = player.assets.find((item) => item.id === command.assetId)
    if (!asset) return reject(current, 'Актив не найден')
    const oldOwnership = asset.ownership
    const delta = command.type === 'BUY_PARTNER_SHARE' ? Math.min(0.1, 1 - oldOwnership) : Math.min(0.1, oldOwnership - 0.5)
    if (delta <= 0) return reject(current, command.type === 'BUY_PARTNER_SHARE' ? 'Ты уже владеешь всем бизнесом' : 'Нельзя оставить себе меньше 50%')
    const sharePrice = Math.round((assetMarketValue(asset) / oldOwnership) * delta * (command.type === 'BUY_PARTNER_SHARE' ? 1.08 : 0.96))
    if (command.type === 'BUY_PARTNER_SHARE' && player.cash < sharePrice) return reject(current, 'Не хватает денег на выкуп доли')
    const newOwnership = command.type === 'BUY_PARTNER_SHARE' ? oldOwnership + delta : oldOwnership - delta
    const ratio = newOwnership / oldOwnership
    const oldMarketValue = assetMarketValue(asset)
    const soldRatio = command.type === 'SELL_PARTNER_SHARE' ? delta / oldOwnership : 0
    player.cash += command.type === 'BUY_PARTNER_SHARE' ? -sharePrice : sharePrice
    if (command.type === 'BUY_PARTNER_SHARE') addAssetInvestment(asset, sharePrice)
    else {
      recordAssetCashReturn(asset, sharePrice)
      reduceAssetInvestmentBasis(asset, soldRatio)
    }
    asset.ownership = Math.round(newOwnership * 100) / 100
    asset.revenue = Math.round(asset.revenue * ratio)
    asset.operatingCosts = Math.round(asset.operatingCosts * ratio)
    asset.loan = Math.round(asset.loan * ratio)
    asset.monthlyPayment = Math.round(asset.monthlyPayment * ratio)
    asset.marketValue = Math.round(oldMarketValue * ratio)
    addEvent(state, 'Изменение доли', `${asset.name}: теперь у тебя ${Math.round(asset.ownership * 100)}%`, 'neutral')
    return { state, accepted: true }
  }

  if (command.type === 'SELL_ASSET') {
    if (state.phase !== 'ready') return reject(current, 'Сначала заверши текущее решение')
    const assetIndex = player.assets.findIndex((asset) => asset.id === command.assetId)
    if (assetIndex < 0) return reject(current, 'Актив не найден')
    const asset = player.assets[assetIndex]
    const marketValue = assetMarketValue(asset)
    const quickPrice = Math.round(marketValue * 0.93)
    const exit = calculateAssetExitResult(player, asset, quickPrice)
    const { proceeds, bankPayment, deficiency } = sellAsset(player, asset, quickPrice)
    addEvent(state, 'Актив продан срочно', `${asset.name}: рынок ${marketValue.toLocaleString('ru-RU')} ₽, цена быстрой продажи ${quickPrice.toLocaleString('ru-RU')} ₽, банку ${bankPayment.toLocaleString('ru-RU')} ₽, на руки ${proceeds.toLocaleString('ru-RU')} ₽, общий результат владения ${exit.totalProfit >= 0 ? '+' : ''}${exit.totalProfit.toLocaleString('ru-RU')} ₽${deficiency > 0 ? `, остаточный долг ${deficiency.toLocaleString('ru-RU')} ₽` : ''}`, exit.totalProfit >= 0 ? 'good' : 'bad')
    return { state, accepted: true }
  }

  if (command.type === 'ACCEPT_SALE_OFFER') {
    if (state.phase !== 'ready') return reject(current, 'Сначала заверши текущее решение')
    const assetIndex = player.assets.findIndex((asset) => asset.id === command.assetId)
    if (assetIndex < 0) return reject(current, 'Актив не найден')
    const asset = player.assets[assetIndex]
    if (!asset.saleOffer || asset.offerExpiresMonth !== state.month) return reject(current, 'Предложение уже недоступно')
    const exit = calculateAssetExitResult(player, asset, asset.saleOffer)
    const { proceeds, deficiency } = sellAsset(player, asset, asset.saleOffer)
    addEvent(state, 'Предложение принято', `${asset.name}: на руки ${proceeds.toLocaleString('ru-RU')} ₽, общий результат владения ${exit.totalProfit >= 0 ? '+' : ''}${exit.totalProfit.toLocaleString('ru-RU')} ₽${deficiency > 0 ? `, остаточный долг ${deficiency.toLocaleString('ru-RU')} ₽` : ''}`, exit.totalProfit >= 0 ? 'good' : 'bad')
    return { state, accepted: true }
  }

  if (command.type === 'ROLL_DICE') {
    if (state.phase !== 'ready') return reject(current, 'Сначала заверши текущее решение')
    const roll = 1 + Math.floor(random(state) * 6)
    state.lastRoll = roll
    player.position = (player.position + roll) % board.length
    state.pendingDecision = decisionForCell(state, board[player.position].type)
    state.phase = 'decision'
    return { state, accepted: true }
  }

  if (state.phase !== 'decision' || !state.pendingDecision) return reject(current, 'Нет активного решения')
  const decision = state.pendingDecision
  const v15Decision = handleDecisionV15Command(state, command)
  if (v15Decision.handled) {
    if (!v15Decision.accepted) return reject(current, v15Decision.error ?? 'Операция недоступна')
    if (v15Decision.completeTurn) completeHumanTurn(state)
    return { state, accepted: true }
  }
  const v14Decision = handleDecisionV14Command(state, command, () => random(state))
  if (v14Decision.handled) {
    if (!v14Decision.accepted) return reject(current, v14Decision.error ?? 'Операция недоступна')
    if (v14Decision.completeTurn) completeHumanTurn(state)
    return { state, accepted: true }
  }

  if (command.type === 'NEGOTIATE_BUSINESS') {
    if (decision.kind !== 'business') return reject(current, 'Сейчас нет сделки для торга')
    if (decision.negotiated) return reject(current, 'Ты уже сделал предложение')
    const settings = difficultySettings[state.difficulty]
    const boldnessPenalty = command.offerPercent === 0.85 ? 0.28 : command.offerPercent === 0.9 ? 0.13 : 0
    const successChance = settings.negotiationChance + skillLevel(player, 'negotiation') * 0.07 + negotiationSpecializationBonus(player) - boldnessPenalty
    const success = random(state) < successChance
    decision.negotiated = true
    if (success) {
      decision.askingPrice = Math.round(decision.askingPrice * command.offerPercent)
      decision.negotiationNote = `Продавец согласился на скидку ${Math.round((1 - command.offerPercent) * 100)}%`
      addEvent(state, 'Торг удался', decision.negotiationNote, 'good')
      awardProgress(state, player, 24, 'negotiation', 14)
      return { state, accepted: true }
    }
    const dealLost = random(state) < (command.offerPercent === 0.85 ? 0.34 : command.offerPercent === 0.9 ? 0.16 : 0.05)
    if (dealLost) {
      addEvent(state, 'Сделка сорвалась', 'Продавец отказался продолжать переговоры.', 'bad')
      completeHumanTurn(state)
    } else {
      decision.sellerCounter = createSellerCounter(decision.askingPrice, command.offerPercent, skillLevel(player, 'negotiation'), () => random(state))
      decision.negotiationNote = 'Продавец сделал встречное предложение: можно принять цену или оставить исходную цену с дополнительным условием.'
      addEvent(state, 'Контроффер продавца', decision.negotiationNote, 'neutral')
    }
    return { state, accepted: true }
  }

  if (command.type === 'INSPECT_BUSINESS') {
    if (decision.kind !== 'business' && decision.kind !== 'opportunity') return reject(current, 'Сейчас нечего проверять')
    if (decision.inspection && decision.inspection !== 'none') return reject(current, 'Проверка уже проведена')
    const business = businesses.find((item) => item.id === decision.businessId)!
    const downPayment = Math.max(0, decision.askingPrice - business.loan)
    const cost = command.level === 'full' ? Math.max(35_000, Math.round(downPayment * 0.08)) : Math.max(12_000, Math.round(downPayment * 0.03))
    if (player.cash < cost) return reject(current, 'Не хватает денег на проверку')
    player.cash -= cost
    decision.inspection = command.level
    if (decision.profile) decision.revealedFacts = revealedDealFacts(decision.profile, command.level)
    const revealChance = command.level === 'full' ? 1 : Math.min(0.9, 0.64 + skillLevel(player, 'finance') * 0.08)
    decision.issueRevealed = random(state) < revealChance
    const result = decision.issueRevealed
      ? (decision.hiddenIssue && decision.hiddenIssue !== 'none' ? issueLabels[decision.hiddenIssue] : 'Существенных проблем не найдено')
      : 'Базовая проверка не дала однозначного ответа'
    addEvent(state, command.level === 'full' ? 'Полная проверка сделки' : 'Базовая проверка сделки', `${business.name}: ${result}. Стоимость ${cost.toLocaleString('ru-RU')} ₽.`, decision.issueRevealed && decision.hiddenIssue && decision.hiddenIssue !== 'none' ? 'bad' : 'neutral')
    awardProgress(state, player, 18, 'finance', 8)
    return { state, accepted: true }
  }

  if (command.type === 'SKIP_DECISION') {
    if ((decision.kind === 'business' || decision.kind === 'opportunity') && random(state) < 0.72) {
      const candidates = state.players.slice(1).filter((bot) => bot.status === 'active')
      const bot = candidates.sort((a, b) => b.cash - a.cash)[0]
      const business = businesses.find((item) => item.id === decision.businessId)
      if (bot && business) {
        const reserve = bot.baseExpenses * (bot.botStrategy === 'careful' ? 1.2 : 0.45)
        const downPayment = Math.max(0, decision.askingPrice - Math.min(decision.askingPrice, Math.round(business.loan * (decision.askingPrice / business.price))))
        if (bot.cash >= downPayment * 0.5 + reserve) {
          const funding: Funding = bot.cash >= downPayment + reserve ? 'cash' : 'partner50'
          const rivalAsset = makeAsset(state, bot, decision.businessId, funding, decision.askingPrice, undefined, 'basic', 'none', decision.profile, decision.sellerTerm)
          if (rivalAsset) {
            bot.assets.push(rivalAsset)
            refreshPortfolioSynergies(bot)
            addEvent(state, 'Соперник перехватил сделку', `${bot.name} купил ${business.name}, от которого ты отказался.`, 'bad')
          }
        }
      }
    }
    addEvent(state, 'Решение пропущено', 'Ты сохранил деньги и завершил ход.')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  if (command.type === 'NEGOTIATE_PARTNERSHIP') {
    if (decision.kind !== 'partnership') return reject(current, 'Сейчас нет предложения партнёра')
    if (decision.negotiated) return reject(current, 'Условия уже обсуждались')
    const settings = difficultySettings[state.difficulty]
    const improvement = command.request === 'small' ? 0.03 : 0.06
    const penalty = command.request === 'small' ? 0.04 : 0.22
    const chance = settings.negotiationChance + skillLevel(player, 'negotiation') * 0.08 + negotiationSpecializationBonus(player) - penalty
    decision.negotiated = true
    decision.negotiationSucceeded = random(state) < chance
    if (decision.negotiationSucceeded) {
      decision.discount = Math.max(0.78, Math.round((decision.discount - improvement) * 100) / 100)
      decision.negotiationNote = `${decision.partnerName} договорился снизить цену ещё на ${Math.round(improvement * 100)}%. Новая скидка — ${Math.round((1 - decision.discount) * 100)}%.`
      awardProgress(state, player, 18, 'negotiation', 10)
      addEvent(state, 'Партнёр улучшил условия', decision.negotiationNote, 'good')
    } else {
      decision.discount = decision.originalDiscount
      decision.negotiationNote = `${decision.partnerName} не смог улучшить цену. Исходное предложение осталось доступно.`
      addEvent(state, 'Условия партнёрства без изменений', decision.negotiationNote, 'neutral')
    }
    return { state, accepted: true }
  }

  if (command.type === 'ACCEPT_PARTNERSHIP') {
    if (decision.kind !== 'partnership') return reject(current, 'Сейчас нет предложения партнёра')
    const funding: Funding = command.ownership === 0.3 ? 'partner30' : 'partner50'
    const business = businesses.find((item) => item.id === decision.businessId)
    if (!business) return reject(current, 'Бизнес не найден')
    const terms = calculatePartnershipTerms(business, decision.discount, command.ownership)
    const asset = makeAsset(state, player, decision.businessId, funding, terms.dealPrice, undefined, 'basic', 'none')
    if (!asset) return reject(current, `Для входа нужно ${terms.playerCashNeeded.toLocaleString('ru-RU')} ₽, на счёте недостаточно`)
    asset.partnerName = decision.partnerName
    player.assets.push(asset)
    refreshPortfolioSynergies(player)
    awardProgress(state, player, 55, 'negotiation', 12)
    addEvent(state, 'Партнёрство заключено', `${decision.partnerName} вложил ${terms.partnerCashContribution.toLocaleString('ru-RU')} ₽. Ты вложил ${terms.playerCashNeeded.toLocaleString('ru-RU')} ₽ и получил ${Math.round(asset.ownership * 100)}% ${asset.name}.`, 'good')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  if (command.type === 'BUY_BUSINESS') {
    if (decision.kind !== 'business') return reject(current, 'Сейчас нет сделки')
    const business = businesses.find((item) => item.id === decision.businessId)
    if (!business || business.requiredLevel > playerLevel(player)) return reject(current, `Для этой сделки нужен уровень ${business?.requiredLevel ?? '?'}`)

    const liquidation = liquidateAssetsForDeal(player, command.saleAssetIds, command.collateralAssetId)
    if (!liquidation.ok) return reject(current, liquidation.error)
    const asset = makeAsset(state, player, decision.businessId, command.funding, decision.askingPrice, command.collateralAssetId, decision.inspection ?? 'none', decision.hiddenIssue ?? 'none', decision.profile, decision.sellerTerm)
    if (!asset) return reject(current, command.funding === 'cash' ? 'Даже после продажи выбранных активов денег не хватает' : command.funding.startsWith('partner') ? 'Не хватает денег даже с долей партнёра' : 'Банк не одобрил итоговую схему финансирования')

    player.assets.push(asset)
    refreshPortfolioSynergies(player)
    if (liquidation.sold.length > 0) {
      const total = liquidation.sold.reduce((sum, item) => sum + item.proceeds, 0)
      addEvent(state, 'Активы проданы для сделки', `${liquidation.sold.map((item) => item.name).join(', ')}. На первый взнос направлено ${total.toLocaleString('ru-RU')} ₽.`, 'neutral')
    }
    awardProgress(state, player, 60, 'finance', 10)
    addEvent(state, 'Новый актив', `${asset.name}, доля ${Math.round(asset.ownership * 100)}%`, 'good')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  if (command.type === 'BUY_OPPORTUNITY') {
    if (decision.kind !== 'opportunity') return reject(current, 'Сейчас нет редкой сделки')
    const deal = rareDeals.find((item) => item.id === decision.opportunityId)
    if (!deal || deal.minLevel > playerLevel(player)) return reject(current, `Для этой возможности нужен уровень ${deal?.minLevel ?? '?'}`)

    const liquidation = liquidateAssetsForDeal(player, command.saleAssetIds, command.collateralAssetId)
    if (!liquidation.ok) return reject(current, liquidation.error)
    const asset = makeAsset(state, player, decision.businessId, command.funding, decision.askingPrice, command.collateralAssetId, decision.inspection ?? 'none', decision.hiddenIssue ?? 'none', decision.profile, decision.sellerTerm)
    if (!asset) return reject(current, 'Не удалось профинансировать эту возможность выбранной схемой')

    player.assets.push(asset)
    refreshPortfolioSynergies(player)
    if (liquidation.sold.length > 0) {
      const total = liquidation.sold.reduce((sum, item) => sum + item.proceeds, 0)
      addEvent(state, 'Активы проданы для возможности', `${liquidation.sold.map((item) => item.name).join(', ')}. Получено ${total.toLocaleString('ru-RU')} ₽.`, 'neutral')
    }
    awardProgress(state, player, 85, 'finance', 14)
    addEvent(state, 'Редкая возможность куплена', `${decision.title}: ${asset.name} за ${decision.askingPrice.toLocaleString('ru-RU')} ₽.`, 'good')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  if (command.type === 'PAY_EXPENSE') {
    if (decision.kind !== 'expense') return reject(current, 'Сейчас нет обязательного расхода')
    if (command.withCredit || player.cash < decision.amount) {
      const borrowed = command.withCredit ? decision.amount : decision.amount - player.cash
      if (!command.withCredit) player.cash = 0
      player.loans.push({ id: uid(state, 'expense-loan'), name: decision.title, balance: borrowed, monthlyPayment: Math.round(borrowed * 0.05), annualRate: 0.42, termMonths: 24, missedPayments: 0 })
    } else player.cash -= decision.amount
    addEvent(state, 'Непредвиденный расход', `${decision.title}: ${decision.amount.toLocaleString('ru-RU')} ₽`, 'bad')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  if (command.type === 'TAKE_CHANCE') {
    if (decision.kind !== 'chance') return reject(current, 'Сейчас нет возможности для перепродажи')
    if (player.cash < decision.investment) return reject(current, 'Не хватает денег для вложения')
    const difficultyPenalty = state.difficulty === 'hard' ? 0.95 : state.difficulty === 'easy' ? 1.04 : 1
    const outcomeAmount = Math.round((decision.minReturn + random(state) * (decision.maxReturn - decision.minReturn)) * difficultyPenalty)
    player.cash -= decision.investment
    player.resaleDeals.push({ id: uid(state, 'resale'), title: decision.title, investment: decision.investment, expectedMin: decision.minReturn, expectedMax: decision.maxReturn, resolvesMonth: state.month + decision.durationMonths, outcomeAmount, delays: 0 })
    awardProgress(state, player, 25, 'brand', 8)
    addEvent(state, 'Товар куплен', `${decision.title}: вложено ${decision.investment.toLocaleString('ru-RU')} ₽, результат через ${decision.durationMonths} мес.`, 'neutral')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  const allowedFinanceDecision = decision.kind === 'bank' || decision.kind === 'market'
  if (command.type === 'DEPOSIT' || command.type === 'BUY_BONDS') {
    if (!allowedFinanceDecision) return reject(current, 'Финансовая операция сейчас недоступна')
    if (command.amount <= 0 || player.cash < command.amount) return reject(current, 'Недостаточно денег')
    player.cash -= command.amount
    if (command.type === 'DEPOSIT') player.deposit += command.amount
    else player.bonds += command.amount
    return { state, accepted: true }
  }
  if (command.type === 'WITHDRAW_DEPOSIT' || command.type === 'SELL_BONDS') {
    if (!allowedFinanceDecision) return reject(current, 'Финансовая операция сейчас недоступна')
    const balance = command.type === 'WITHDRAW_DEPOSIT' ? player.deposit : player.bonds
    const amount = Math.min(balance, Math.max(0, command.amount))
    player.cash += amount
    if (command.type === 'WITHDRAW_DEPOSIT') player.deposit -= amount
    else player.bonds -= amount
    return { state, accepted: true }
  }
  if (command.type === 'BUY_STOCK' || command.type === 'SELL_STOCK') {
    if (decision.kind !== 'market') return reject(current, 'Акции доступны только на клетке рынка')
    if (!Number.isInteger(command.quantity) || command.quantity <= 0) return reject(current, 'Некорректное количество акций')
    const quote = state.stockMarket.find((item) => item.id === command.stockId)
    if (!quote) return reject(current, 'Компания не найдена')
    let holding = player.stocks.find((item) => item.stockId === quote.id)
    if (command.type === 'BUY_STOCK') {
      if (command.collateralAssetId && command.saleAssetIds?.includes(command.collateralAssetId)) return reject(current, 'Один бизнес нельзя одновременно продать и заложить')
      if (command.collateralAssetId && command.shareSaleAssetId === command.collateralAssetId) return reject(current, 'Один бизнес нельзя одновременно частично продать и заложить')
      for (const assetId of [...new Set(command.saleAssetIds ?? [])]) {
        if (!quickSellAssetForFunding(state, player, assetId)) return reject(current, 'Выбранный бизнес уже недоступен')
      }
      if (command.shareSaleAssetId && command.shareSalePercent && !sellAssetShareForFunding(state, player, command.shareSaleAssetId, command.shareSalePercent)) return reject(current, 'Не удалось продать выбранную долю')
      const grossPurchase = quote.price * command.quantity
      const total = stockPurchaseTotal(quote.price, command.quantity)
      const purchaseFee = total - grossPurchase
      const funding = command.funding ?? 'cash'
      const gap = Math.max(0, total - player.cash)
      if (gap > 0 && funding === 'cash') return reject(current, 'Не хватает денег на покупку акций')
      if (gap > 0) {
        if (funding === 'credit' && player.cash < total * 0.35) return reject(current, 'Для покупки акций нужно внести минимум 35% своими деньгами')
        const collateral = funding === 'secured' ? player.assets.find((asset) => asset.id === command.collateralAssetId) : undefined
        if (funding === 'secured' && !collateral) return reject(current, 'Выбери бизнес для залога')
        const assessment = assessLoan(player, gap, state.difficulty, collateral, 0, 0, state.globalEvent?.creditRateDelta ?? 0)
        if (!assessment.approved) return reject(current, assessment.reason)
        player.cash += gap
        player.loans.push({ id: uid(state, 'stock-buy-loan'), name: collateral ? `Акции под залог: ${collateral.name}` : `Кредит на акции ${quote.ticker}`, balance: gap, monthlyPayment: assessment.monthlyPayment, annualRate: assessment.annualRate, termMonths: assessment.termMonths, collateralAssetId: collateral?.id, relatedStockId: quote.id, missedPayments: 0 })
      }
      player.cash -= total
      holding = player.stocks.find((item) => item.stockId === quote.id)
      if (holding) {
        const oldQuantity = holding.quantity
        const oldCostBasis = holding.costBasis ?? holding.averagePrice * oldQuantity
        const oldMarketCostBasis = holding.marketCostBasis ?? (holding.averageMarketPrice ?? Math.round(holding.averagePrice / (1 + STOCK_COMMISSION_RATE))) * oldQuantity
        const newQuantity = oldQuantity + command.quantity
        holding.costBasis = oldCostBasis + total
        holding.marketCostBasis = oldMarketCostBasis + grossPurchase
        holding.averagePrice = Math.round(holding.costBasis / newQuantity)
        holding.averageMarketPrice = Math.round(holding.marketCostBasis / newQuantity)
        holding.purchaseFees = holding.costBasis - holding.marketCostBasis
        holding.quantity = newQuantity
      } else player.stocks.push({
        stockId: quote.id,
        quantity: command.quantity,
        averagePrice: Math.round(total / command.quantity),
        averageMarketPrice: quote.price,
        costBasis: total,
        marketCostBasis: grossPurchase,
        purchaseFees: purchaseFee,
        pledgedQuantity: 0,
        cumulativeDividends: 0,
        cumulativeFinancingCosts: 0,
      })
      addEvent(state, 'Акции куплены', `${quote.ticker}: ${command.quantity} шт. за ${total.toLocaleString('ru-RU')} ₽`)
    } else {
      const freeQuantity = holding ? stockFreeQuantity(holding) : 0
      if (!holding || freeQuantity < command.quantity) return reject(current, 'Столько свободных от залога акций нет')
      const proceeds = stockSaleProceeds(quote.price, command.quantity)
      const quantityBeforeSale = holding.quantity
      const totalCostBasis = holding.costBasis ?? holding.averagePrice * quantityBeforeSale
      const totalMarketCostBasis = holding.marketCostBasis ?? (holding.averageMarketPrice ?? Math.round(holding.averagePrice / (1 + STOCK_COMMISSION_RATE))) * quantityBeforeSale
      const soldCostBasis = Math.round(totalCostBasis * command.quantity / quantityBeforeSale)
      const soldMarketCostBasis = Math.round(totalMarketCostBasis * command.quantity / quantityBeforeSale)
      player.cash += proceeds
      holding.quantity -= command.quantity
      holding.costBasis = Math.max(0, totalCostBasis - soldCostBasis)
      holding.marketCostBasis = Math.max(0, totalMarketCostBasis - soldMarketCostBasis)
      holding.purchaseFees = Math.max(0, holding.costBasis - holding.marketCostBasis)
      const remainingRatio = holding.quantity / quantityBeforeSale
      holding.cumulativeDividends = Math.max(0, Math.round((holding.cumulativeDividends ?? 0) * remainingRatio))
      holding.cumulativeFinancingCosts = Math.max(0, Math.round((holding.cumulativeFinancingCosts ?? 0) * remainingRatio))
      if (holding.quantity === 0) player.stocks = player.stocks.filter((item) => item.stockId !== quote.id)
      else {
        holding.averagePrice = Math.round(holding.costBasis / holding.quantity)
        holding.averageMarketPrice = Math.round(holding.marketCostBasis / holding.quantity)
      }
      addEvent(state, 'Акции проданы', `${quote.ticker}: ${command.quantity} шт., получено ${proceeds.toLocaleString('ru-RU')} ₽, результат ${(proceeds - soldCostBasis).toLocaleString('ru-RU')} ₽`, proceeds >= soldCostBasis ? 'good' : 'bad')
    }
    return { state, accepted: true }
  }
  if (command.type === 'TAKE_LOAN') {
    if (decision.kind !== 'bank') return reject(current, 'Кредит можно взять только в банке')
    if (command.amount <= 0) return reject(current, 'Некорректная сумма')
    const collateral = command.collateralAssetId ? player.assets.find((asset) => asset.id === command.collateralAssetId) : undefined
    const assessment = assessLoan(player, command.amount, state.difficulty, collateral, 0, 0, state.globalEvent?.creditRateDelta ?? 0)
    if (!assessment.approved) return reject(current, assessment.reason)
    player.cash += command.amount
    player.loans.push({ id: uid(state, 'bank-loan'), name: collateral ? `Кредит под залог: ${collateral.name}` : 'Банковский кредит', balance: command.amount, monthlyPayment: assessment.monthlyPayment, annualRate: assessment.annualRate, termMonths: assessment.termMonths, collateralAssetId: collateral?.id, missedPayments: 0 })
    return { state, accepted: true }
  }
  if (command.type === 'REPAY_LOAN') {
    if (decision.kind !== 'bank') return reject(current, 'Погашение доступно только в банке')
    let amount = Math.min(player.cash, Math.max(0, command.amount))
    for (const loan of player.loans) {
      const payment = Math.min(amount, loan.balance)
      loan.balance -= payment
      player.cash -= payment
      amount -= payment
      loan.monthlyPayment = loan.balance > 0 ? loanPayment(loan.balance, loan.annualRate, Math.max(1, loan.termMonths)) : 0
      if (amount === 0) break
    }
    for (const loan of player.loans.filter((item) => item.balance <= 0 && item.collateralStockId)) {
      const holding = player.stocks.find((item) => item.stockId === loan.collateralStockId)
      if (holding) holding.pledgedQuantity = Math.max(0, (holding.pledgedQuantity ?? 0) - (loan.collateralStockQuantity ?? 0))
    }
    player.loans = player.loans.filter((loan) => loan.balance > 0)
    return { state, accepted: true }
  }
  if (command.type === 'TRAIN') {
    if (decision.kind !== 'growth') return reject(current, 'Обучение сейчас недоступно')
    if (skillLevel(player, command.skillId) >= 3) return reject(current, 'Этот навык уже развит до максимума')
    const cost = trainingCost(player, command.skillId)
    if (player.cash < cost) return reject(current, 'Не хватает денег на обучение')
    player.cash -= cost
    awardProgress(state, player, 65, command.skillId, 55)
    addEvent(state, 'Навык прокачан', `Вложено ${cost.toLocaleString('ru-RU')} ₽ в развитие.`, 'good')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  return reject(current, 'Команда не соответствует текущему решению')
}
