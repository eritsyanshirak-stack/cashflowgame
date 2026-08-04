import { board, businesses, chanceCards, developments, difficultySettings, expenseCards, initialStockMarket, marketHeadlines, professions } from '../content/content'
import type { Asset, BotStrategy, CommandResult, Decision, Funding, GameCommand, GameEvent, GameState, Player } from '../domain/types'
import { assessLoan, assetCashflow, assetMarketValue, createMonthlyReport, isBankrupt, isFinanciallyFree, loanPayment, meetsFreedomConditions, monthlyExpenses, pledgedLoanForAsset } from '../systems/economy'
import { developmentCost, emptySkills, grantProgress, playerLevel, skillLevel, trainingCost } from '../systems/progression'

export const emptyGame = (seed = Date.now()): GameState => ({
  version: 8,
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
    experience: 0,
    skills: emptySkills(),
    status: 'active',
    eliminatedMonth: null,
    freedomStreak: 0,
    botStrategy: isBot ? botStrategies[(index - 1) % botStrategies.length] : undefined,
  }
}

const decisionForCell = (state: GameState, type: (typeof board)[number]['type']): Decision => {
  if (type === 'business') {
    const player = state.players[0]
    const unlocked = businesses.filter((item) => item.requiredLevel <= playerLevel(player))
    const business = pick(state, unlocked)
    return { kind: 'business', businessId: business.id, askingPrice: business.price, negotiated: false }
  }
  if (type === 'expense') {
    const [title, amount] = pick(state, expenseCards)
    return { kind: 'expense', title, amount }
  }
  if (type === 'chance') {
    const [title, investment, minReturn, maxReturn, durationMonths] = pick(state, chanceCards)
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
    if (random(state) < settings.offerChance) {
      const premium = 0.91 + random(state) * 0.24 + asset.developmentLevel * 0.01
      asset.saleOffer = Math.round(asset.marketValue * premium)
      asset.offerExpiresMonth = state.month + 1
    }

    const performanceFloor = state.difficulty === 'easy' ? 0.9 : state.difficulty === 'normal' ? 0.78 : 0.65
    const performanceCeiling = state.difficulty === 'easy' ? 1.12 : state.difficulty === 'normal' ? 1.15 : 1.22
    const qualityBonus = Math.min(0.08, asset.developmentLevel * 0.018)
    asset.performanceMultiplier = Math.min(1.3, performanceFloor + random(state) * (performanceCeiling - performanceFloor) + qualityBonus)
    if (!player.isBot && asset.performanceMultiplier < 0.82) {
      addEvent(state, 'Слабый месяц бизнеса', `${asset.name}: спрос просел, выручка ниже плана.`, 'bad')
    } else if (!player.isBot && asset.performanceMultiplier > 1.12) {
      addEvent(state, 'Сильный месяц бизнеса', `${asset.name}: продажи превысили ожидания.`, 'good')
    }

    if (asset.loan > 0) {
      const annualRate = asset.loanAnnualRate || 0.22
      const monthlyInterest = Math.round(asset.loan * annualRate / 12)
      const principalPayment = Math.max(0, asset.monthlyPayment - monthlyInterest)
      asset.loan = Math.max(0, asset.loan - principalPayment)
      asset.loanTermMonths = Math.max(0, asset.loanTermMonths - 1)
      asset.monthlyPayment = asset.loan > 0 ? loanPayment(asset.loan, annualRate, Math.max(1, asset.loanTermMonths)) : 0
    }
  })
  player.loans.forEach((loan) => {
    const interest = Math.round(loan.balance * loan.annualRate / 12)
    const principalPayment = Math.max(0, loan.monthlyPayment - interest)
    loan.balance = Math.max(0, loan.balance - principalPayment)
    loan.termMonths = Math.max(0, loan.termMonths - 1)
    loan.monthlyPayment = loan.balance > 0 ? loanPayment(loan.balance, loan.annualRate, Math.max(1, loan.termMonths)) : 0
  })
  player.loans = player.loans.filter((loan) => loan.balance > 0)
}

const updateStockMarket = (state: GameState) => {
  const settings = difficultySettings[state.difficulty]
  const headline = pick(state, marketHeadlines)
  state.marketHeadline = headline.title
  state.stockMarket.forEach((quote) => {
    quote.previousPrice = quote.price
    const sectorImpact = quote.sector === headline.sector ? headline.impact : 0
    const marketNoise = (random(state) * 2 - 1) * settings.marketVolatility
    quote.price = Math.max(1_000, Math.round(quote.price * (1 + sectorImpact + marketNoise)))
  })
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

const settleMonth = (state: GameState) => {
  const nextMonth = state.month + 1
  const resaleReturns = state.players.map((player) => player.status === 'active' ? settleResales(state, player, nextMonth) : 0)
  const humanReport = createMonthlyReport(state.players[0], state.month, state.stockMarket, resaleReturns[0])
  state.players.forEach((player, index) => {
    if (player.status !== 'active') return
    const report = createMonthlyReport(player, state.month, state.stockMarket, resaleReturns[index])
    player.cash += report.netCashflow
    player.baseDebt = Math.max(0, player.baseDebt - Math.round(player.baseDebt * 0.014))
  })
  state.players.forEach((player) => {
    if (player.status === 'active') updateAssetMarket(state, player)
  })
  updateStockMarket(state)
  state.month = nextMonth
  state.day = 1
  state.players.forEach((player) => {
    if (player.status !== 'active') return
    player.freedomStreak = meetsFreedomConditions(player, state.stockMarket, state.month) ? player.freedomStreak + 1 : 0
  })
  state.lastMonthlyReport = humanReport
  addEvent(state, 'Итоги месяца', `Чистый результат: ${humanReport.netCashflow.toLocaleString('ru-RU')} ₽`, humanReport.netCashflow >= 0 ? 'good' : 'bad')
}

const advanceCalendar = (state: GameState) => {
  // A month is seven human turns: six four-day steps and a final five-day step.
  // Bot count never affects the calendar because this runs once per human turn.
  state.day += state.day >= 25 ? 5 : 4
  state.round += 1
  if (state.day >= 30) settleMonth(state)
}

const makeAsset = (state: GameState, player: Player, businessId: string, funding: Funding, dealPrice?: number, collateralAssetId?: string): Asset | null => {
  const business = businesses.find((item) => item.id === businessId)
  if (!business) return null
  const ownership = funding === 'partner30' ? 0.7 : funding === 'partner50' ? 0.5 : 1
  const purchasePrice = dealPrice ?? business.price
  const downPayment = Math.round(Math.max(0, purchasePrice - business.loan) * ownership)
  const acquisitionGap = Math.max(0, downPayment - player.cash)
  if (funding === 'cash' && acquisitionGap > 0) return null
  if ((funding === 'partner30' || funding === 'partner50') && acquisitionGap > 0) return null
  if ((funding === 'credit' || funding === 'secured') && acquisitionGap > 0) {
    if (funding === 'credit' && player.cash < downPayment * 0.3) return null
    const collateral = funding === 'secured' ? player.assets.find((asset) => asset.id === collateralAssetId) : undefined
    if (funding === 'secured' && !collateral) return null
    const projectedIncome = Math.round((business.revenue - business.operatingCosts) * ownership)
    const projectedAssetPayment = loanPayment(Math.round(business.loan * ownership), business.loanAnnualRate, business.loanTermMonths)
    const assessment = assessLoan(player, acquisitionGap, state.difficulty, collateral, projectedIncome, projectedAssetPayment)
    if (!assessment.approved) return null
    player.loans.push({
      id: uid(state, 'loan'),
      name: funding === 'secured' ? `Залог: ${collateral!.name}` : `Взнос: ${business.name}`,
      balance: acquisitionGap,
      monthlyPayment: assessment.monthlyPayment,
      annualRate: assessment.annualRate,
      termMonths: assessment.termMonths,
      collateralAssetId: collateral?.id,
    })
    player.cash += acquisitionGap
  }
  player.cash -= downPayment
  const assetLoan = Math.round(business.loan * ownership)
  return {
    ...business,
    id: uid(state, business.id),
    ownerId: player.id,
    ownership,
    price: purchasePrice,
    downPayment,
    loan: assetLoan,
    revenue: Math.round(business.revenue * ownership),
    operatingCosts: Math.round(business.operatingCosts * ownership),
    monthlyPayment: loanPayment(assetLoan, business.loanAnnualRate, business.loanTermMonths),
    purchaseMonth: state.month,
    performanceMultiplier: 1,
    developmentLevel: 0,
    developments: [],
    totalDevelopmentCost: 0,
    lastDevelopedMonth: null,
    saleOffer: null,
    offerExpiresMonth: null,
  }
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
  asset.totalDevelopmentCost += cost
  return true
}

const sellAsset = (player: Player, asset: Asset, grossPrice: number) => {
  const collateralLoan = pledgedLoanForAsset(player, asset.id)
  const collateralDebt = collateralLoan?.balance ?? 0
  const assetDebtPayment = Math.min(grossPrice, asset.loan)
  const assetDebtShortfall = Math.max(0, asset.loan - grossPrice)
  const equityBeforeCollateral = Math.max(0, grossPrice - asset.loan)
  const collateralPayment = Math.min(equityBeforeCollateral, collateralDebt)
  const proceeds = equityBeforeCollateral - collateralPayment

  if (assetDebtShortfall > 0) {
    const annualRate = 0.29
    const termMonths = 36
    player.loans.push({
      id: `shortfall-${asset.id}`,
      name: `Остаток долга: ${asset.name}`,
      balance: assetDebtShortfall,
      monthlyPayment: loanPayment(assetDebtShortfall, annualRate, termMonths),
      annualRate,
      termMonths,
    })
  }

  if (collateralLoan) {
    collateralLoan.balance -= collateralPayment
    collateralLoan.collateralAssetId = undefined
    collateralLoan.monthlyPayment = collateralLoan.balance > 0 ? loanPayment(collateralLoan.balance, collateralLoan.annualRate, Math.max(1, collateralLoan.termMonths)) : 0
    if (collateralLoan.balance === 0) player.loans = player.loans.filter((loan) => loan.id !== collateralLoan.id)
  }
  player.cash += proceeds
  player.assets = player.assets.filter((item) => item.id !== asset.id)
  return { proceeds, collateralPayment, assetDebtPayment, assetDebtShortfall }
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
      const weakAsset = assetCashflow(asset, state.month) < 0
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
      const ranked = unlocked
        .map((business) => {
          const payment = loanPayment(business.loan, business.loanAnnualRate, business.loanTermMonths)
          const flow = business.revenue - business.operatingCosts - payment
          return { business, flow, score: flow / Math.max(1, business.downPayment) }
        })
        .filter((item) => item.flow > 0)
        .sort((a, b) => b.score - a.score)
      const shortlist = ranked.slice(0, Math.max(1, Math.min(4, ranked.length)))
      const selected = shortlist[Math.floor(random(state) * shortlist.length)]
      const business = selected?.business
      const reserve = monthlyExpenses(bot, state.month) * (strategy === 'careful' ? 1.5 : strategy === 'aggressive' ? 0.5 : 1)
      if (business && bot.cash > business.downPayment * 0.35 + reserve) {
        const funding: Funding = bot.cash >= business.downPayment + reserve
          ? 'cash'
          : bot.cash >= business.downPayment * 0.5 + reserve
            ? 'partner50'
            : 'credit'
        const discount = random(state) < settings.negotiationChance * 0.6 ? 0.92 : 1
        const asset = makeAsset(state, bot, business.id, funding, Math.round(business.price * discount))
        if (asset) {
          bot.assets.push(asset)
          awardProgress(state, bot, 65, 'finance', 10)
          addEvent(state, 'Ход соперника', `${bot.name} купил ${business.name}${discount < 1 ? ' после торга' : ''}`)
        }
      }
    }
    if (cell.type === 'growth' && random(state) < settings.botActivity * 0.75) {
      const skillId = strategy === 'careful' ? 'finance' : strategy === 'aggressive' ? 'marketing' : bot.assets.length >= 3 ? 'management' : 'finance'
      const cost = trainingCost(bot, skillId)
      const reserve = monthlyExpenses(bot, state.month) * (strategy === 'careful' ? 1.5 : 0.75)
      if (bot.cash > cost + reserve && skillLevel(bot, skillId) < 3) {
        bot.cash -= cost
        awardProgress(state, bot, 65, skillId, 45)
      }
    }
    if (cell.type === 'expense') bot.cash -= pick(state, expenseCards)[1]
    if (cell.type === 'market' && random(state) < settings.botActivity) {
      const quotes = [...state.stockMarket].sort((a, b) => strategy === 'careful' ? b.dividendYield - a.dividendYield : (b.price / b.previousPrice) - (a.price / a.previousPrice))
      const quote = quotes[0]
      const reserve = bot.baseExpenses * (strategy === 'careful' ? 1 : 0.35)
      const buyPrice = Math.ceil(quote.price * 1.015)
      if (bot.cash >= buyPrice + reserve) {
        bot.cash -= buyPrice
        const holding = bot.stocks.find((item) => item.stockId === quote.id)
        if (holding) {
          holding.averagePrice = Math.round((holding.averagePrice * holding.quantity + buyPrice) / (holding.quantity + 1))
          holding.quantity += 1
        } else bot.stocks.push({ stockId: quote.id, quantity: 1, averagePrice: buyPrice })
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
    if (isFinanciallyFree(player, state.stockMarket, state.month)) {
      player.status = 'free'
      finishGame(state, player.id, 'freedom')
      return
    }
    if (isBankrupt(player, state.stockMarket, state.month)) {
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
    addEvent(started, 'Партия началась', 'Цель — выполнить все условия свободы и удержать их три месяца подряд.', 'good')
    return { state: started, accepted: true }
  }

  if (state.phase === 'setup' || state.phase === 'finished') return reject(current, 'Команда сейчас недоступна')
  const player = state.players[0]

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
    player.cash += command.type === 'BUY_PARTNER_SHARE' ? -sharePrice : sharePrice
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
    const { proceeds, collateralPayment } = sellAsset(player, asset, marketValue)
    addEvent(state, 'Актив продан', `${asset.name}: ${marketValue.toLocaleString('ru-RU')} ₽, банку ${(asset.loan + collateralPayment).toLocaleString('ru-RU')} ₽, на руки ${proceeds.toLocaleString('ru-RU')} ₽`, proceeds >= asset.downPayment ? 'good' : 'neutral')
    return { state, accepted: true }
  }

  if (command.type === 'ACCEPT_SALE_OFFER') {
    if (state.phase !== 'ready') return reject(current, 'Сначала заверши текущее решение')
    const assetIndex = player.assets.findIndex((asset) => asset.id === command.assetId)
    if (assetIndex < 0) return reject(current, 'Актив не найден')
    const asset = player.assets[assetIndex]
    if (!asset.saleOffer || asset.offerExpiresMonth !== state.month) return reject(current, 'Предложение уже недоступно')
    const { proceeds } = sellAsset(player, asset, asset.saleOffer)
    addEvent(state, 'Предложение принято', `${asset.name}: на руки ${proceeds.toLocaleString('ru-RU')} ₽`, 'good')
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

  if (command.type === 'NEGOTIATE_BUSINESS') {
    if (decision.kind !== 'business') return reject(current, 'Сейчас нет сделки для торга')
    if (decision.negotiated) return reject(current, 'Ты уже сделал предложение')
    const settings = difficultySettings[state.difficulty]
    const boldnessPenalty = command.offerPercent === 0.85 ? 0.28 : command.offerPercent === 0.9 ? 0.13 : 0
    const success = random(state) < settings.negotiationChance + skillLevel(player, 'negotiation') * 0.07 - boldnessPenalty
    decision.negotiated = true
    if (success) {
      decision.askingPrice = Math.round(decision.askingPrice * command.offerPercent)
      decision.negotiationNote = `Продавец согласился на скидку ${Math.round((1 - command.offerPercent) * 100)}%`
      addEvent(state, 'Торг удался', decision.negotiationNote, 'good')
      awardProgress(state, player, 24, 'negotiation', 14)
      return { state, accepted: true }
    }
    const dealLost = random(state) < (command.offerPercent === 0.85 ? 0.62 : command.offerPercent === 0.9 ? 0.34 : 0.12)
    if (dealLost) {
      addEvent(state, 'Сделка сорвалась', 'Продавец отказался продолжать переговоры.', 'bad')
      completeHumanTurn(state)
    } else {
      decision.negotiationNote = 'Продавец отказал в скидке, но готов продать по исходной цене.'
      addEvent(state, 'Скидки не дали', decision.negotiationNote)
    }
    return { state, accepted: true }
  }

  if (command.type === 'SKIP_DECISION') {
    addEvent(state, 'Решение пропущено', 'Ты сохранил деньги и завершил ход.')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  if (command.type === 'BUY_BUSINESS') {
    if (decision.kind !== 'business') return reject(current, 'Сейчас нет сделки')
    const business = businesses.find((item) => item.id === decision.businessId)
    if (!business || business.requiredLevel > playerLevel(player)) return reject(current, `Для этой сделки нужен уровень ${business?.requiredLevel ?? '?'}`)
    const asset = makeAsset(state, player, decision.businessId, command.funding, decision.askingPrice, command.collateralAssetId)
    if (!asset) return reject(current, command.funding === 'cash' ? 'Не хватает своих денег' : command.funding.startsWith('partner') ? 'Не хватает денег даже с долей партнёра' : 'Банк не одобрил эту схему финансирования')
    player.assets.push(asset)
    awardProgress(state, player, 60, 'finance', 10)
    addEvent(state, 'Новый актив', `${asset.name}, доля ${Math.round(asset.ownership * 100)}%`, 'good')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  if (command.type === 'PAY_EXPENSE') {
    if (decision.kind !== 'expense') return reject(current, 'Сейчас нет обязательного расхода')
    if (command.withCredit || player.cash < decision.amount) {
      const borrowed = command.withCredit ? decision.amount : decision.amount - player.cash
      if (!command.withCredit) player.cash = 0
      player.loans.push({ id: uid(state, 'expense-loan'), name: decision.title, balance: borrowed, monthlyPayment: Math.round(borrowed * 0.05), annualRate: 0.42, termMonths: 24 })
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
    const holding = player.stocks.find((item) => item.stockId === quote.id)
    if (command.type === 'BUY_STOCK') {
      const total = Math.ceil(quote.price * command.quantity * 1.015)
      if (player.cash < total) return reject(current, 'Не хватает денег на покупку акций')
      player.cash -= total
      if (holding) {
        holding.averagePrice = Math.round((holding.averagePrice * holding.quantity + total) / (holding.quantity + command.quantity))
        holding.quantity += command.quantity
      } else player.stocks.push({ stockId: quote.id, quantity: command.quantity, averagePrice: Math.round(total / command.quantity) })
      addEvent(state, 'Акции куплены', `${quote.ticker}: ${command.quantity} шт. за ${total.toLocaleString('ru-RU')} ₽`)
    } else {
      if (!holding || holding.quantity < command.quantity) return reject(current, 'Столько акций в портфеле нет')
      const proceeds = Math.floor(quote.price * command.quantity * 0.985)
      player.cash += proceeds
      holding.quantity -= command.quantity
      if (holding.quantity === 0) player.stocks = player.stocks.filter((item) => item.stockId !== quote.id)
      addEvent(state, 'Акции проданы', `${quote.ticker}: ${command.quantity} шт., получено ${proceeds.toLocaleString('ru-RU')} ₽`, proceeds >= holding.averagePrice * command.quantity ? 'good' : 'bad')
    }
    return { state, accepted: true }
  }
  if (command.type === 'TAKE_LOAN') {
    if (decision.kind !== 'bank') return reject(current, 'Кредит можно взять только в банке')
    if (command.amount <= 0) return reject(current, 'Некорректная сумма')
    const collateral = command.collateralAssetId ? player.assets.find((asset) => asset.id === command.collateralAssetId) : undefined
    const assessment = assessLoan(player, command.amount, state.difficulty, collateral)
    if (!assessment.approved) return reject(current, assessment.reason)
    player.cash += command.amount
    player.loans.push({ id: uid(state, 'bank-loan'), name: collateral ? `Кредит под залог: ${collateral.name}` : 'Банковский кредит', balance: command.amount, monthlyPayment: assessment.monthlyPayment, annualRate: assessment.annualRate, termMonths: assessment.termMonths, collateralAssetId: collateral?.id })
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
