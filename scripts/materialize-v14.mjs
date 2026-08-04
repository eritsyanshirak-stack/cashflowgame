import fs from 'node:fs'

const path = 'src/game/engine/engine.ts'
let source = fs.readFileSync(path, 'utf8')

const between = (start, end, replacement) => {
  const from = source.indexOf(start)
  if (from < 0) throw new Error(`Missing start anchor: ${start}`)
  const to = source.indexOf(end, from)
  if (to < 0) throw new Error(`Missing end anchor: ${end}`)
  source = source.slice(0, from) + replacement + source.slice(to)
}
const once = (from, to) => {
  if (!source.includes(from)) throw new Error(`Missing anchor: ${from.slice(0, 120)}`)
  source = source.replace(from, to)
}

once(
  "import { board, businesses, chanceCards, developments, difficultySettings, expenseCards, initialStockMarket, marketHeadlines, professions, rareDeals } from '../content/content'",
  "import { board, businesses, chanceCards, developments, difficultySettings, expenseScenarios, initialStockMarket, marketHeadlines, professions, rareDeals } from '../content/content'",
)
once(
  "import { developmentCost, emptySkills, grantProgress, playerLevel, skillLevel, trainingCost } from '../systems/progression'",
  "import { developmentCost, emptySkills, grantProgress, playerLevel, skillLevel, trainingCost } from '../systems/progression'\nimport { createContractOptions, createStockMarginCall, emptyRecentCards, pickFresh, processAssetListings, settleContracts, stockFreeQuantity, updateGlobalEvent } from '../systems/v14'\nimport { handleDecisionV14Command, handleReadyV14Command, quickSellAssetForFunding, sellAssetShareForFunding } from './v14Core'",
)

once('  version: 8,', '  version: 9,')
once(
  "  marketHeadline: 'Рынок открылся без сильных движений',\n  outcome: null,",
  "  marketHeadline: 'Рынок открылся без сильных движений',\n  globalEvent: null,\n  recentCards: emptyRecentCards(),\n  buyerOffers: [],\n  activeMarginCall: null,\n  outcome: null,",
)
once('    resaleDeals: [],\n    experience: 0,', '    resaleDeals: [],\n    activeContracts: [],\n    experience: 0,')

between('const decisionForCell =', '\n\nconst updateAssetMarket', `const decisionForCell = (state: GameState, type: (typeof board)[number]['type']): Decision => {
  const player = state.players[0]
  if (type === 'business') {
    const unlocked = businesses.filter((item) => item.requiredLevel <= playerLevel(player))
    const business = pickFresh(state, 'business', unlocked, (item) => item.id, () => random(state), 4)
    return {
      kind: 'business', businessId: business.id, askingPrice: business.price, negotiated: false,
      inspection: 'none', hiddenIssue: rollIssue(state, business.riskRating), issueRevealed: false,
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
    return { kind: 'partnership', businessId: business.id, title: business.name, description: 'Владелец ищет партнёра и готов продать долю с небольшой скидкой.', discount: 0.9 }
  }
  if (type === 'management') return { kind: 'management' }
  if (type === 'chance') {
    const availableRareDeals = rareDeals.filter((item) => item.minLevel <= playerLevel(player))
    if (availableRareDeals.length > 0 && random(state) < 0.18) {
      const deal = pickFresh(state, 'chance', availableRareDeals, (item) => item.id, () => random(state), 5)
      const business = businesses.find((item) => item.id === deal.businessId)!
      return {
        kind: 'opportunity', opportunityId: deal.id, businessId: business.id,
        askingPrice: Math.round(business.price * deal.discount), title: deal.title, description: deal.description,
        inspection: 'none', hiddenIssue: rollIssue(state, business.riskRating, deal.issueChance * 0.45), issueRevealed: false,
      }
    }
    const card = pickFresh(state, 'chance', chanceCards, (item) => item[0], () => random(state), 5)
    const [title, investment, minReturn, maxReturn, durationMonths] = card
    return { kind: 'chance', title, investment, minReturn, maxReturn, durationMonths }
  }
  if (type === 'market') return { kind: 'market', title: state.marketHeadline, description: 'Смотри не только на движение цены, но и на риск, дивиденды и долю акций в капитале.' }
  return { kind: type }
}`)

once(
`    asset.saleOffer = null
    asset.offerExpiresMonth = null
    if (random(state) < settings.offerChance) {
      const premium = 0.91 + random(state) * 0.24 + asset.developmentLevel * 0.01
      asset.saleOffer = Math.round(asset.marketValue * premium)
      asset.offerExpiresMonth = state.month + 1
    }`,
`    asset.saleOffer = null
    asset.offerExpiresMonth = null
    if (player.isBot && random(state) < settings.offerChance) {
      const premium = 0.91 + random(state) * 0.24 + asset.developmentLevel * 0.01
      asset.saleOffer = Math.round(asset.marketValue * premium)
      asset.offerExpiresMonth = state.month + 1
    }`,
)

between('const updateStockMarket =', '\n\nconst settleResales', `const updateStockMarket = (state: GameState) => {
  const settings = difficultySettings[state.difficulty]
  const headline = pick(state, marketHeadlines)
  state.marketHeadline = headline.title
  state.stockMarket.forEach((quote) => {
    quote.previousPrice = quote.price
    const sectorImpact = quote.sector === headline.sector ? headline.impact : 0
    const marketNoise = (random(state) * 2 - 1) * settings.marketVolatility * 1.45
    const move = Math.max(-0.32, Math.min(0.36, sectorImpact + marketNoise))
    quote.price = Math.max(500, Math.round(quote.price * (1 + move)))
  })
  if (random(state) < 0.12) {
    const quote = pick(state, state.stockMarket)
    const crash = random(state) < 0.48
    const move = crash ? -0.5 : 0.5 + random(state) * 0.15
    quote.previousPrice = quote.price
    quote.price = Math.max(500, Math.round(quote.price * (1 + move)))
    state.marketHeadline = crash ? `${quote.ticker}: обвал на 50%` : `${quote.ticker}: сильный рост ${Math.round(move * 100)}%`
  }
}`)

once(
"    if ((asset.launchMonthsRemaining ?? 0) > 0 || (asset.incidentCooldown ?? 0) > 0) continue",
"    if ((asset.insuredUntilMonth ?? 0) >= state.month) continue\n    if ((asset.launchMonthsRemaining ?? 0) > 0 || (asset.incidentCooldown ?? 0) > 0) continue",
)

between('const settleMonth =', '\n\nconst advanceCalendar', `const settleMonth = (state: GameState) => {
  const nextMonth = state.month + 1
  const resaleReturns = state.players.map((player) => player.status === 'active' ? settleResales(state, player, nextMonth) : 0)
  const contractReturns = state.players.map((player) => player.status === 'active' ? settleContracts(state, player, nextMonth, () => random(state)) : 0)
  state.players.forEach((player) => { if (player.status === 'active') processAssetRisks(state, player) })
  const humanReport = createMonthlyReport(state.players[0], state.month, state.stockMarket, resaleReturns[0], contractReturns[0])
  state.players.forEach((player, index) => {
    if (player.status !== 'active') return
    const report = createMonthlyReport(player, state.month, state.stockMarket, resaleReturns[index], contractReturns[index])
    player.cash += report.netCashflow
    player.baseDebt = Math.max(0, player.baseDebt - Math.round(player.baseDebt * 0.014))
    handleDebtStress(state, player)
  })
  state.players.forEach((player) => {
    if (player.status === 'active') updateAssetMarket(state, player)
  })
  updateStockMarket(state)
  state.month = nextMonth
  state.day = 1
  updateGlobalEvent(state, () => random(state))
  processAssetListings(state, () => random(state))
  state.activeMarginCall = createStockMarginCall(state.players[0], state.stockMarket)
  state.players.forEach((player) => {
    if (player.status !== 'active') return
    player.freedomStreak = meetsFreedomConditions(player, state.stockMarket) ? (player.freedomStreak ?? 0) + 1 : 0
  })
  state.lastMonthlyReport = humanReport
  addEvent(state, 'Итоги месяца', `Чистый результат: ${humanReport.netCashflow.toLocaleString('ru-RU')} ₽. Устойчивость свободы: ${state.players[0].freedomStreak ?? 0}/3 мес.`, humanReport.netCashflow >= 0 ? 'good' : 'bad')
}`)

once(
"    const assessment = assessLoan(player, acquisitionGap, state.difficulty, collateral, projectedIncome, projectedAssetPayment)",
"    const assessment = assessLoan(player, acquisitionGap, state.difficulty, collateral, projectedIncome, projectedAssetPayment, state.globalEvent?.creditRateDelta ?? 0)",
)
once(
"    missedPayments: 0,\n  }\n  applyIssueToAsset(asset, hiddenIssue)",
"    missedPayments: 0,\n    listingPrice: null,\n    listingStartedMonth: null,\n    listingExpiresMonth: null,\n    externalRevenueMultiplier: state.globalEvent?.category === business.category ? state.globalEvent.revenueMultiplier : 1,\n  }\n  applyIssueToAsset(asset, hiddenIssue)",
)
once(
"    const result = sellAsset(player, asset, assetMarketValue(asset))",
"    const result = sellAsset(player, asset, Math.round(assetMarketValue(asset) * 0.93))",
)

once(
"  const player = state.players[0]\n\n  if (command.type === 'RESOLVE_ASSET_ISSUE')",
`  const player = state.players[0]
  state.recentCards ??= emptyRecentCards()
  state.buyerOffers ??= []
  state.globalEvent ??= null
  state.activeMarginCall ??= null
  player.activeContracts ??= []

  const v14Anytime = command.type === 'RESPOND_BUYER_OFFER' || command.type === 'PLEDGE_STOCK' || command.type === 'RESOLVE_MARGIN_CALL'
  if (state.phase === 'ready' || v14Anytime) {
    const v14 = handleReadyV14Command(state, command, () => random(state))
    if (v14.handled) return v14.accepted ? { state, accepted: true } : reject(current, v14.error ?? 'Операция недоступна')
  }
  if (state.activeMarginCall) return reject(current, 'Сначала урегулируй маржин-колл')

  if (command.type === 'RESOLVE_ASSET_ISSUE')`,
)

once(
"  const decision = state.pendingDecision\n\n  if (command.type === 'NEGOTIATE_BUSINESS')",
`  const decision = state.pendingDecision
  const v14Decision = handleDecisionV14Command(state, command, () => random(state))
  if (v14Decision.handled) {
    if (!v14Decision.accepted) return reject(current, v14Decision.error ?? 'Операция недоступна')
    if (v14Decision.completeTurn) completeHumanTurn(state)
    return { state, accepted: true }
  }

  if (command.type === 'NEGOTIATE_BUSINESS')`,
)

once(
"  if (command.type === 'BUY_BUSINESS') {",
`  if (command.type === 'ACCEPT_PARTNERSHIP') {
    if (decision.kind !== 'partnership') return reject(current, 'Сейчас нет предложения партнёра')
    const funding: Funding = command.ownership === 0.3 ? 'partner30' : 'partner50'
    const business = businesses.find((item) => item.id === decision.businessId)
    if (!business) return reject(current, 'Бизнес не найден')
    const asset = makeAsset(state, player, decision.businessId, funding, Math.round(business.price * decision.discount), undefined, 'basic', 'none')
    if (!asset) return reject(current, 'Не хватает денег на свою долю')
    player.assets.push(asset)
    awardProgress(state, player, 55, 'negotiation', 12)
    addEvent(state, 'Партнёрство заключено', `${asset.name}: твоя доля ${Math.round(asset.ownership * 100)}%.`, 'good')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  if (command.type === 'BUY_BUSINESS') {`,
)

between("  if (command.type === 'BUY_STOCK' || command.type === 'SELL_STOCK') {", "\n  if (command.type === 'TAKE_LOAN') {", `  if (command.type === 'BUY_STOCK' || command.type === 'SELL_STOCK') {
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
      const total = Math.ceil(quote.price * command.quantity * 1.015)
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
        player.loans.push({ id: uid(state, 'stock-buy-loan'), name: collateral ? `Акции под залог: ${collateral.name}` : `Кредит на акции ${quote.ticker}`, balance: gap, monthlyPayment: assessment.monthlyPayment, annualRate: assessment.annualRate, termMonths: assessment.termMonths, collateralAssetId: collateral?.id, missedPayments: 0 })
      }
      player.cash -= total
      holding = player.stocks.find((item) => item.stockId === quote.id)
      if (holding) {
        holding.averagePrice = Math.round((holding.averagePrice * holding.quantity + total) / (holding.quantity + command.quantity))
        holding.quantity += command.quantity
      } else player.stocks.push({ stockId: quote.id, quantity: command.quantity, averagePrice: Math.round(total / command.quantity), pledgedQuantity: 0 })
      addEvent(state, 'Акции куплены', `${quote.ticker}: ${command.quantity} шт. за ${total.toLocaleString('ru-RU')} ₽`)
    } else {
      const freeQuantity = holding ? stockFreeQuantity(holding) : 0
      if (!holding || freeQuantity < command.quantity) return reject(current, 'Столько свободных от залога акций нет')
      const proceeds = Math.floor(quote.price * command.quantity * 0.985)
      const costBasis = holding.averagePrice * command.quantity
      player.cash += proceeds
      holding.quantity -= command.quantity
      if (holding.quantity === 0) player.stocks = player.stocks.filter((item) => item.stockId !== quote.id)
      addEvent(state, 'Акции проданы', `${quote.ticker}: ${command.quantity} шт., получено ${proceeds.toLocaleString('ru-RU')} ₽, результат ${(proceeds - costBasis).toLocaleString('ru-RU')} ₽`, proceeds >= costBasis ? 'good' : 'bad')
    }
    return { state, accepted: true }
  }`)

once(
"    const assessment = assessLoan(player, command.amount, state.difficulty, collateral)",
"    const assessment = assessLoan(player, command.amount, state.difficulty, collateral, 0, 0, state.globalEvent?.creditRateDelta ?? 0)",
)

fs.writeFileSync(path, source)
console.log('materialized v1.4 engine')
