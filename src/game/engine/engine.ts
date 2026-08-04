import { board, businesses, chanceCards, developments, difficultySettings, expenseCards, professions } from '../content/content'
import type { Asset, BotStrategy, CommandResult, Decision, Funding, GameCommand, GameEvent, GameState, Player } from '../domain/types'
import { assetCashflow, assetMarketValue, assetSaleProceeds, createMonthlyReport, isFinanciallyFree, monthlyCashflow } from '../systems/economy'

export const emptyGame = (seed = Date.now()): GameState => ({
  version: 3,
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
    botStrategy: isBot ? botStrategies[(index - 1) % botStrategies.length] : undefined,
  }
}

const decisionForCell = (state: GameState, type: (typeof board)[number]['type']): Decision => {
  if (type === 'business') {
    const business = pick(state, businesses)
    return { kind: 'business', businessId: business.id, askingPrice: business.price, negotiated: false }
  }
  if (type === 'expense') {
    const [title, amount] = pick(state, expenseCards)
    return { kind: 'expense', title, amount }
  }
  if (type === 'chance') {
    const [title, investment, returnAmount] = pick(state, chanceCards)
    return { kind: 'chance', title, investment, returnAmount }
  }
  if (type === 'market') return { kind: 'market', title: 'Рынок качнуло', description: 'Цены изменились. Проверь запас денег и не принимай решение на эмоциях.' }
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
    asset.loan = Math.max(0, asset.loan - Math.round(asset.monthlyPayment * 0.7))
    asset.monthlyPayment = asset.loan > 0 ? Math.min(asset.monthlyPayment, Math.round(asset.loan * 0.03)) : 0
  })
  player.loans.forEach((loan) => {
    loan.balance = Math.max(0, loan.balance - Math.round(loan.monthlyPayment * 0.72))
    loan.monthlyPayment = loan.balance > 0 ? Math.min(loan.monthlyPayment, Math.round(loan.balance * 0.05)) : 0
  })
  player.loans = player.loans.filter((loan) => loan.balance > 0)
}

const settleMonth = (state: GameState) => {
  const humanReport = createMonthlyReport(state.players[0], state.month)
  state.players.forEach((player) => { player.cash += monthlyCashflow(player) })
  state.players.forEach((player) => updateAssetMarket(state, player))
  state.month += 1
  state.day = 1
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

const makeAsset = (state: GameState, player: Player, businessId: string, funding: Funding, dealPrice?: number): Asset | null => {
  const business = businesses.find((item) => item.id === businessId)
  if (!business) return null
  const ownership = funding === 'partner30' ? 0.7 : funding === 'partner50' ? 0.5 : 1
  const purchasePrice = dealPrice ?? business.price
  const downPayment = Math.round(Math.max(0, purchasePrice - business.loan) * ownership)
  const acquisitionGap = Math.max(0, downPayment - player.cash)
  if (funding === 'cash' && acquisitionGap > 0) return null
  if (funding === 'credit' && acquisitionGap > 0) {
    player.loans.push({ id: uid(state, 'loan'), name: `Взнос: ${business.name}`, balance: acquisitionGap, monthlyPayment: Math.round(acquisitionGap * 0.035) })
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
    monthlyPayment: Math.round(assetLoan * 0.015),
    purchaseMonth: state.month,
    developmentLevel: 0,
    developments: [],
    totalDevelopmentCost: 0,
    lastDevelopedMonth: null,
    saleOffer: null,
    offerExpiresMonth: null,
  }
}

const applyDevelopment = (asset: Asset, developmentId: string, cost: number) => {
  const development = developments.find((item) => item.id === developmentId)
  if (!development) return false
  asset.revenue = Math.round(asset.revenue * (1 + development.revenueRate))
  asset.operatingCosts = Math.max(0, Math.round(asset.operatingCosts * (1 + development.costGrowthRate)))
  asset.marketValue = Math.round(assetMarketValue(asset) * (1 + development.valueRate))
  asset.developments.push(development.id)
  asset.developmentLevel += 1
  asset.totalDevelopmentCost += cost
  return true
}

const runBots = (state: GameState) => {
  const settings = difficultySettings[state.difficulty]
  for (let index = 1; index < state.players.length; index += 1) {
    const bot = state.players[index]
    const strategy = bot.botStrategy ?? 'balanced'
    const risk = strategy === 'careful' ? 0.72 : strategy === 'aggressive' ? 1.25 : 1
    const roll = 1 + Math.floor(random(state) * 6)
    bot.position = (bot.position + roll) % board.length
    const cell = board[bot.position]

    for (const asset of bot.assets.slice()) {
      const offerPremium = asset.saleOffer ? asset.saleOffer / Math.max(1, assetMarketValue(asset)) : 0
      const weakAsset = assetCashflow(asset) < 0
      if ((offerPremium > (strategy === 'aggressive' ? 1.16 : 1.08) || weakAsset) && random(state) < settings.botActivity) {
        bot.cash += Math.max(0, (asset.saleOffer ?? assetMarketValue(asset)) - asset.loan)
        bot.assets = bot.assets.filter((item) => item.id !== asset.id)
        addEvent(state, 'Соперник продал актив', `${bot.name} вышел из ${asset.name}`)
      }
    }

    if (bot.assets.length > 0 && random(state) < settings.botActivity * 0.42) {
      const asset = pick(state, bot.assets)
      const available = developments.filter((item) => !asset.developments.includes(item.id))
      const development = available[0]
      if (development) {
        const cost = Math.round(asset.price * asset.ownership * development.costRate)
        if (bot.cash > cost + bot.baseExpenses * (strategy === 'careful' ? 1 : 0.35)) {
          applyDevelopment(asset, development.id, cost)
          bot.cash -= cost
          addEvent(state, 'Соперник развивает бизнес', `${bot.name}: ${asset.name} - ${development.name}`)
        }
      }
    }

    if (cell.type === 'business' && random(state) < settings.botActivity * risk) {
      const business = pick(state, businesses)
      const payment = Math.round(business.loan * 0.015)
      const profitable = business.revenue - business.operatingCosts - payment > 0
      const reserve = bot.baseExpenses * (strategy === 'careful' ? 1 : strategy === 'aggressive' ? 0.15 : 0.5)
      if (profitable && bot.cash > business.downPayment * 0.5 + reserve) {
        const funding: Funding = bot.cash >= business.downPayment + reserve ? 'cash' : strategy === 'aggressive' ? 'credit' : 'partner50'
        const discount = random(state) < settings.negotiationChance * 0.45 ? 0.92 : 1
        const asset = makeAsset(state, bot, business.id, funding, Math.round(business.price * discount))
        if (asset) {
          bot.assets.push(asset)
          addEvent(state, 'Ход соперника', `${bot.name} купил ${business.name}${discount < 1 ? ' после торга' : ''}`)
        }
      }
    }
    if (cell.type === 'expense') bot.cash -= pick(state, expenseCards)[1]
  }
}

const completeHumanTurn = (state: GameState) => {
  state.pendingDecision = null
  runBots(state)
  advanceCalendar(state)
  state.currentPlayerIndex = 0
  state.phase = isFinanciallyFree(state.players[0]) ? 'victory' : 'ready'
  if (state.phase === 'victory') addEvent(state, 'Финансовая свобода', 'Пассивный доход покрывает все расходы.', 'good')
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

  if (state.phase === 'setup' || state.phase === 'victory') return reject(current, 'Команда сейчас недоступна')
  const player = state.players[0]

  if (command.type === 'DEVELOP_ASSET') {
    if (state.phase !== 'ready') return reject(current, 'Развитие доступно между ходами')
    const asset = player.assets.find((item) => item.id === command.assetId)
    const development = developments.find((item) => item.id === command.developmentId)
    if (!asset || !development) return reject(current, 'Развитие не найдено')
    if (asset.developments.includes(development.id)) return reject(current, 'Это улучшение уже сделано')
    if (asset.lastDevelopedMonth === state.month) return reject(current, 'Этот бизнес уже развивали в текущем месяце')
    const cost = Math.round(asset.price * asset.ownership * development.costRate)
    if (player.cash < cost) return reject(current, 'Не хватает денег на развитие')
    player.cash -= cost
    applyDevelopment(asset, development.id, cost)
    asset.lastDevelopedMonth = state.month
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
    const proceeds = assetSaleProceeds(asset)
    player.cash += proceeds
    player.assets.splice(assetIndex, 1)
    addEvent(state, 'Актив продан', `${asset.name}: ${marketValue.toLocaleString('ru-RU')} ₽, на руки ${proceeds.toLocaleString('ru-RU')} ₽`, proceeds >= asset.downPayment ? 'good' : 'neutral')
    return { state, accepted: true }
  }

  if (command.type === 'ACCEPT_SALE_OFFER') {
    if (state.phase !== 'ready') return reject(current, 'Сначала заверши текущее решение')
    const assetIndex = player.assets.findIndex((asset) => asset.id === command.assetId)
    if (assetIndex < 0) return reject(current, 'Актив не найден')
    const asset = player.assets[assetIndex]
    if (!asset.saleOffer || asset.offerExpiresMonth !== state.month) return reject(current, 'Предложение уже недоступно')
    const proceeds = Math.max(0, asset.saleOffer - asset.loan)
    player.cash += proceeds
    player.assets.splice(assetIndex, 1)
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
    const success = random(state) < settings.negotiationChance - boldnessPenalty
    decision.negotiated = true
    if (success) {
      decision.askingPrice = Math.round(decision.askingPrice * command.offerPercent)
      decision.negotiationNote = `Продавец согласился на скидку ${Math.round((1 - command.offerPercent) * 100)}%`
      addEvent(state, 'Торг удался', decision.negotiationNote, 'good')
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
    const asset = makeAsset(state, player, decision.businessId, command.funding, decision.askingPrice)
    if (!asset) return reject(current, 'Не хватает денег для этой покупки')
    player.assets.push(asset)
    addEvent(state, 'Новый актив', `${asset.name}, доля ${Math.round(asset.ownership * 100)}%`, 'good')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  if (command.type === 'PAY_EXPENSE') {
    if (decision.kind !== 'expense') return reject(current, 'Сейчас нет обязательного расхода')
    if (command.withCredit || player.cash < decision.amount) {
      const borrowed = command.withCredit ? decision.amount : decision.amount - player.cash
      if (!command.withCredit) player.cash = 0
      player.loans.push({ id: uid(state, 'expense-loan'), name: decision.title, balance: borrowed, monthlyPayment: Math.round(borrowed * 0.05) })
    } else player.cash -= decision.amount
    addEvent(state, 'Непредвиденный расход', `${decision.title}: ${decision.amount.toLocaleString('ru-RU')} ₽`, 'bad')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  if (command.type === 'TAKE_CHANCE') {
    if (decision.kind !== 'chance') return reject(current, 'Сейчас нет возможности для перепродажи')
    if (player.cash < decision.investment) return reject(current, 'Не хватает денег для вложения')
    player.cash += decision.returnAmount - decision.investment
    addEvent(state, 'Перепродажа', `Результат +${(decision.returnAmount - decision.investment).toLocaleString('ru-RU')} ₽`, 'good')
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
  if (command.type === 'TAKE_LOAN') {
    if (decision.kind !== 'bank') return reject(current, 'Кредит можно взять только в банке')
    if (command.amount <= 0) return reject(current, 'Некорректная сумма')
    player.cash += command.amount
    player.loans.push({ id: uid(state, 'bank-loan'), name: 'Банковский кредит', balance: command.amount, monthlyPayment: Math.round(command.amount * 0.03) })
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
      loan.monthlyPayment = Math.round(loan.balance * 0.03)
      if (amount === 0) break
    }
    player.loans = player.loans.filter((loan) => loan.balance > 0)
    return { state, accepted: true }
  }
  if (command.type === 'TRAIN') {
    if (decision.kind !== 'growth') return reject(current, 'Обучение сейчас недоступно')
    if (player.cash < command.cost) return reject(current, 'Не хватает денег на обучение')
    player.cash -= command.cost
    player.salary += Math.round(command.cost * 0.35)
    addEvent(state, 'Рост дохода', `Активный доход вырос на ${Math.round(command.cost * 0.35).toLocaleString('ru-RU')} ₽/мес`, 'good')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  return reject(current, 'Команда не соответствует текущему решению')
}
