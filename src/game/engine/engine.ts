import { board, businesses, chanceCards, expenseCards, professions } from '../content/content'
import type { Asset, CommandResult, Decision, Funding, GameCommand, GameEvent, GameState, Player } from '../domain/types'
import { isFinanciallyFree, monthlyCashflow } from '../systems/economy'

export const emptyGame = (seed = Date.now()): GameState => ({
  version: 2,
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
  }
}

const decisionForCell = (state: GameState, type: (typeof board)[number]['type']): Decision => {
  if (type === 'business') return { kind: 'business', businessId: pick(state, businesses).id }
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

const settleMonth = (state: GameState) => {
  state.month += 1
  state.day = 1
  state.players.forEach((player) => { player.cash += monthlyCashflow(player) })
  addEvent(state, 'Новый месяц', `Твой денежный поток: ${monthlyCashflow(state.players[0]).toLocaleString('ru-RU')} ₽`, monthlyCashflow(state.players[0]) >= 0 ? 'good' : 'bad')
}

const advanceCalendar = (state: GameState) => {
  // A month is seven human turns: six four-day steps and a final five-day step.
  // Bot count never affects the calendar because this runs once per human turn.
  state.day += state.day >= 25 ? 5 : 4
  state.round += 1
  if (state.day >= 30) settleMonth(state)
}

const makeAsset = (state: GameState, player: Player, businessId: string, funding: Funding): Asset | null => {
  const business = businesses.find((item) => item.id === businessId)
  if (!business) return null
  const ownership = funding === 'partner30' ? 0.7 : funding === 'partner50' ? 0.5 : 1
  const downPayment = Math.round(business.downPayment * ownership)
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
    downPayment,
    loan: assetLoan,
    revenue: Math.round(business.revenue * ownership),
    operatingCosts: Math.round(business.operatingCosts * ownership),
    monthlyPayment: Math.round(assetLoan * 0.015),
    purchaseMonth: state.month,
  }
}

const runBots = (state: GameState) => {
  for (let index = 1; index < state.players.length; index += 1) {
    const bot = state.players[index]
    const roll = 1 + Math.floor(random(state) * 6)
    bot.position = (bot.position + roll) % board.length
    const cell = board[bot.position]
    if (cell.type === 'business' && random(state) < 0.62) {
      const business = pick(state, businesses)
      const payment = Math.round(business.loan * 0.015)
      const profitable = business.revenue - business.operatingCosts - payment > 0
      if (profitable && bot.cash > business.downPayment + bot.baseExpenses * 0.5) {
        const asset = makeAsset(state, bot, business.id, 'cash')
        if (asset) {
          bot.assets.push(asset)
          addEvent(state, 'Ход соперника', `${bot.name} купил ${business.name}`)
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
    started.players = [makePlayer(profession.id, 'Ты', false, 0)]
    for (let index = 0; index < botCount; index += 1) started.players.push(makePlayer(botProfessions[index % botProfessions.length].id, `Соперник ${index + 1}`, true, index + 1))
    started.phase = 'ready'
    addEvent(started, 'Партия началась', 'Цель - покрыть расходы пассивным доходом.', 'good')
    return { state: started, accepted: true }
  }

  if (state.phase === 'setup' || state.phase === 'victory') return reject(current, 'Команда сейчас недоступна')
  const player = state.players[0]

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

  if (command.type === 'SKIP_DECISION') {
    addEvent(state, 'Решение пропущено', 'Ты сохранил деньги и завершил ход.')
    completeHumanTurn(state)
    return { state, accepted: true }
  }

  if (command.type === 'BUY_BUSINESS') {
    if (decision.kind !== 'business') return reject(current, 'Сейчас нет сделки')
    const asset = makeAsset(state, player, decision.businessId, command.funding)
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
