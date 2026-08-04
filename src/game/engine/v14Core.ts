import { businesses } from '../content/content'
import type { BuyerOfferAction, GameCommand, GameState, Player } from '../domain/types'
import { assetCashflow, assetLiquidationProceeds, assetMarketValue, loanPayment, pledgedLoanForAsset } from '../systems/economy'
import { skillLevel } from '../systems/progression'
import { createStockMarginCall, negotiateBuyerOffer, pledgeStockLoanTerms, pushSystemEvent, stockFreeQuantity } from '../systems/v14'

export interface V14CommandResult {
  handled: boolean
  accepted: boolean
  completeTurn?: boolean
  error?: string
}

const rejected = (error: string): V14CommandResult => ({ handled: true, accepted: false, error })
const accepted = (completeTurn = false): V14CommandResult => ({ handled: true, accepted: true, completeTurn })

const sellAssetAtPrice = (state: GameState, player: Player, assetId: string, grossPrice: number, label: string) => {
  const asset = player.assets.find((item) => item.id === assetId)
  if (!asset) return false
  const collateralLoan = pledgedLoanForAsset(player, asset.id)
  const securedDebt = asset.loan + (collateralLoan?.balance ?? 0)
  const proceeds = assetLiquidationProceeds(player, asset, grossPrice)
  const deficiency = Math.max(0, securedDebt - grossPrice)
  player.cash += proceeds
  player.assets = player.assets.filter((item) => item.id !== asset.id)
  player.loans = player.loans.filter((loan) => loan.id !== collateralLoan?.id)
  state.buyerOffers = state.buyerOffers.filter((offer) => offer.assetId !== asset.id)
  if (deficiency > 0) player.loans.push({
    id: `deficiency-${asset.id}-${state.month}-${state.day}`,
    name: `Остаток долга: ${asset.name}`,
    balance: deficiency,
    monthlyPayment: loanPayment(deficiency, 0.36, 36),
    annualRate: 0.36,
    termMonths: 36,
    missedPayments: 0,
  })
  pushSystemEvent(state, label, `${asset.name}: цена ${grossPrice.toLocaleString('ru-RU')} ₽, на руки ${proceeds.toLocaleString('ru-RU')} ₽${deficiency > 0 ? `, остаточный долг ${deficiency.toLocaleString('ru-RU')} ₽` : ''}.`, deficiency > 0 ? 'bad' : 'good')
  return true
}

const respondToBuyer = (state: GameState, offerId: string, action: BuyerOfferAction, random: () => number): V14CommandResult => {
  const player = state.players[0]
  const offer = state.buyerOffers.find((item) => item.id === offerId)
  if (!offer) return rejected('Предложение уже недоступно')
  const asset = player.assets.find((item) => item.id === offer.assetId)
  if (!asset) return rejected('Актив уже продан')
  if (action === 'reject') {
    state.buyerOffers = state.buyerOffers.filter((item) => item.id !== offer.id)
    pushSystemEvent(state, 'Предложение отклонено', `${asset.name} остаётся на продаже.`)
    return accepted()
  }
  if (action === 'accept') {
    sellAssetAtPrice(state, player, asset.id, offer.offeredPrice, 'Актив продан покупателю')
    return accepted()
  }
  if (offer.final) return rejected('Покупатель уже назвал финальную цену')
  const premium = action === 'counter5' ? 1.05 : action === 'counter10' ? 1.1 : 1.15
  const requestedPrice = Math.round(offer.offeredPrice * premium)
  const result = negotiateBuyerOffer(offer, requestedPrice, skillLevel(player, 'negotiation'), random)
  if (result.kind === 'accepted') {
    sellAssetAtPrice(state, player, asset.id, result.price, 'Покупатель принял контроффер')
    return accepted()
  }
  if (result.kind === 'walk') {
    state.buyerOffers = state.buyerOffers.filter((item) => item.id !== offer.id)
    pushSystemEvent(state, 'Покупатель вышел из переговоров', `${asset.name} остаётся в объявлении.`, 'bad')
    return accepted()
  }
  offer.offeredPrice = result.price
  offer.round = 2
  offer.final = true
  pushSystemEvent(state, 'Финальное предложение покупателя', `${asset.name}: ${result.price.toLocaleString('ru-RU')} ₽.`, 'neutral')
  return accepted()
}

export const handleReadyV14Command = (state: GameState, command: GameCommand, random: () => number): V14CommandResult => {
  const player = state.players[0]
  if (command.type === 'LIST_ASSET') {
    const asset = player.assets.find((item) => item.id === command.assetId)
    if (!asset) return rejected('Актив не найден')
    const market = assetMarketValue(asset)
    if (command.askingPrice < Math.round(market * 0.9) || command.askingPrice > Math.round(market * 1.4)) return rejected('Цена должна быть от 90% до 140% рынка')
    asset.listingPrice = Math.round(command.askingPrice)
    asset.listingStartedMonth = state.month
    asset.listingExpiresMonth = state.month + 3
    state.buyerOffers = state.buyerOffers.filter((offer) => offer.assetId !== asset.id)
    pushSystemEvent(state, 'Актив выставлен на продажу', `${asset.name}: ${command.askingPrice.toLocaleString('ru-RU')} ₽, срок 3 месяца.`, 'good')
    return accepted()
  }
  if (command.type === 'CANCEL_ASSET_LISTING') {
    const asset = player.assets.find((item) => item.id === command.assetId)
    if (!asset) return rejected('Актив не найден')
    asset.listingPrice = null
    asset.listingStartedMonth = null
    asset.listingExpiresMonth = null
    state.buyerOffers = state.buyerOffers.filter((offer) => offer.assetId !== asset.id)
    return accepted()
  }
  if (command.type === 'RESPOND_BUYER_OFFER') return respondToBuyer(state, command.offerId, command.action, random)
  if (command.type === 'SELL_ASSET_SHARE') {
    const asset = player.assets.find((item) => item.id === command.assetId)
    if (!asset) return rejected('Актив не найден')
    const ownershipToSell = command.percent / 100
    if (asset.ownership - ownershipToSell < 0.1) return rejected('После продажи должно остаться хотя бы 10% бизнеса')
    const soldRatio = ownershipToSell / asset.ownership
    const grossPrice = Math.round(assetMarketValue(asset) * soldRatio * 0.96)
    const debtPart = Math.round(asset.loan * soldRatio)
    const proceeds = Math.max(0, grossPrice - debtPart)
    const remainingRatio = 1 - soldRatio
    player.cash += proceeds
    asset.ownership = Math.round((asset.ownership - ownershipToSell) * 100) / 100
    asset.price = Math.round(asset.price * remainingRatio)
    asset.downPayment = Math.round(asset.downPayment * remainingRatio)
    asset.loan = Math.round(asset.loan * remainingRatio)
    asset.revenue = Math.round(asset.revenue * remainingRatio)
    asset.operatingCosts = Math.round(asset.operatingCosts * remainingRatio)
    asset.monthlyPayment = Math.round(asset.monthlyPayment * remainingRatio)
    asset.marketValue = Math.round(assetMarketValue(asset) * remainingRatio)
    asset.listingPrice = null
    asset.listingStartedMonth = null
    asset.listingExpiresMonth = null
    state.buyerOffers = state.buyerOffers.filter((offer) => offer.assetId !== asset.id)
    pushSystemEvent(state, 'Продана доля бизнеса', `${asset.name}: продано ${command.percent}%, на руки ${proceeds.toLocaleString('ru-RU')} ₽.`, 'good')
    return accepted()
  }
  if (command.type === 'PLEDGE_STOCK') {
    const holding = player.stocks.find((item) => item.stockId === command.stockId)
    const quote = state.stockMarket.find((item) => item.id === command.stockId)
    if (!holding || !quote) return rejected('Акции не найдены')
    if (player.loans.some((loan) => loan.collateralStockId === command.stockId)) return rejected('Этот пакет уже в залоге')
    const free = stockFreeQuantity(holding)
    const quantity = Math.max(1, Math.floor(free * command.percent / 100))
    const amount = Math.floor(quantity * quote.price * 0.45)
    if (amount < 5_000) return rejected('Пакет слишком мал для залога')
    const terms = pledgeStockLoanTerms(amount)
    holding.pledgedQuantity = (holding.pledgedQuantity ?? 0) + quantity
    player.cash += amount
    player.loans.push({
      id: `stock-loan-${command.stockId}-${state.month}-${state.day}`,
      name: `Кредит под ${quote.ticker}`,
      balance: amount,
      monthlyPayment: terms.monthlyPayment,
      annualRate: terms.annualRate,
      termMonths: terms.termMonths,
      collateralStockId: command.stockId,
      collateralStockQuantity: quantity,
      missedPayments: 0,
    })
    pushSystemEvent(state, 'Акции переданы в залог', `${quote.ticker}: ${quantity} шт., получено ${amount.toLocaleString('ru-RU')} ₽.`, 'good')
    return accepted()
  }
  if (command.type === 'RESOLVE_MARGIN_CALL') {
    const call = state.activeMarginCall
    if (!call) return rejected('Маржин-колла уже нет')
    const loan = player.loans.find((item) => item.id === call.loanId)
    const holding = player.stocks.find((item) => item.stockId === call.stockId)
    const quote = state.stockMarket.find((item) => item.id === call.stockId)
    if (!loan || !holding || !quote) return rejected('Залог не найден')
    if (command.action === 'pay') {
      if (player.cash < call.requiredPayment) return rejected('Недостаточно денег')
      player.cash -= call.requiredPayment
      loan.balance = Math.max(0, loan.balance - call.requiredPayment)
      loan.monthlyPayment = loanPayment(loan.balance, loan.annualRate, Math.max(1, loan.termMonths))
    } else if (command.action === 'close') {
      if (player.cash < loan.balance) return rejected('Недостаточно денег для закрытия')
      player.cash -= loan.balance
      player.loans = player.loans.filter((item) => item.id !== loan.id)
      holding.pledgedQuantity = Math.max(0, (holding.pledgedQuantity ?? 0) - call.pledgedQuantity)
    } else {
      const quantityToSell = Math.min(call.pledgedQuantity, Math.max(1, Math.ceil(call.requiredPayment / Math.max(1, quote.price * 0.985))))
      const proceeds = Math.floor(quantityToSell * quote.price * 0.985)
      holding.quantity -= quantityToSell
      holding.pledgedQuantity = Math.max(0, (holding.pledgedQuantity ?? 0) - quantityToSell)
      loan.collateralStockQuantity = Math.max(0, (loan.collateralStockQuantity ?? 0) - quantityToSell)
      loan.balance = Math.max(0, loan.balance - proceeds)
      loan.monthlyPayment = loanPayment(loan.balance, loan.annualRate, Math.max(1, loan.termMonths))
      if (holding.quantity <= 0) player.stocks = player.stocks.filter((item) => item.stockId !== holding.stockId)
      if (loan.balance <= 0 || (loan.collateralStockQuantity ?? 0) <= 0) player.loans = player.loans.filter((item) => item.id !== loan.id)
    }
    state.activeMarginCall = createStockMarginCall(player, state.stockMarket)
    pushSystemEvent(state, 'Маржин-колл урегулирован', 'Требование банка закрыто.', 'good')
    return accepted()
  }
  return { handled: false, accepted: false }
}

export const handleDecisionV14Command = (state: GameState, command: GameCommand, random: () => number): V14CommandResult => {
  const player = state.players[0]
  const decision = state.pendingDecision
  if (!decision) return { handled: false, accepted: false }
  if (command.type === 'RESOLVE_EXPENSE' && decision.kind === 'expense') {
    const option = decision.options?.find((item) => item.id === command.optionId)
    if (!option) return rejected('Вариант расхода недоступен')
    if (player.cash < option.amount) return rejected('Недостаточно денег — выбери оплату в кредит')
    player.cash -= option.amount
    if (option.riskChance && option.riskAmount && random() < option.riskChance) {
      player.loans.push({
        id: `expense-risk-${state.month}-${state.day}`,
        name: `Последствия: ${decision.title}`,
        balance: option.riskAmount,
        monthlyPayment: loanPayment(option.riskAmount, 0.34, 18),
        annualRate: 0.34,
        termMonths: 18,
        missedPayments: 0,
      })
      pushSystemEvent(state, 'Экономия обернулась долгом', `${decision.title}: последствия ${option.riskAmount.toLocaleString('ru-RU')} ₽.`, 'bad')
    } else pushSystemEvent(state, decision.title, `Расход закрыт за ${option.amount.toLocaleString('ru-RU')} ₽.`, 'neutral')
    return accepted(true)
  }
  if (command.type === 'TAKE_CONTRACT' && decision.kind === 'contract') {
    const option = decision.options.find((item) => item.id === command.optionId)
    if (!option) return rejected('Контракт недоступен')
    if (player.cash < option.investment) return rejected('Недостаточно денег')
    player.cash -= option.investment
    player.activeContracts.push({
      id: `contract-${state.month}-${state.day}-${option.id}`,
      title: `${decision.title}: ${option.title}`,
      investment: option.investment,
      payout: option.payout,
      resolvesMonth: state.month + option.durationMonths,
      successChance: option.successChance,
      skillId: option.skillId,
    })
    pushSystemEvent(state, 'Контракт взят', `${decision.title}: вложено ${option.investment.toLocaleString('ru-RU')} ₽.`, 'good')
    return accepted(true)
  }
  if (command.type === 'AUCTION_INSPECT' && decision.kind === 'auction') {
    const cost = Math.max(12_000, Math.round(decision.marketValue * 0.015))
    if (decision.inspected) return rejected('Проверка уже проведена')
    if (player.cash < cost) return rejected('Недостаточно денег на проверку')
    player.cash -= cost
    decision.inspected = true
    decision.issueRevealed = true
    return accepted()
  }
  if (command.type === 'AUCTION_BID' && decision.kind === 'auction') {
    if (command.amount < decision.currentBid + decision.minimumStep) return rejected('Ставка слишком мала')
    const highestBot = Math.max(0, ...decision.botCeilings)
    if (command.amount > highestBot) {
      state.pendingDecision = { kind: 'business', businessId: decision.businessId, askingPrice: command.amount, negotiated: true, negotiationNote: 'Победа на аукционе', inspection: decision.inspected ? 'basic' : 'none', hiddenIssue: decision.issue, issueRevealed: decision.issueRevealed }
      pushSystemEvent(state, 'Ты выиграл аукцион', `Финальная цена ${command.amount.toLocaleString('ru-RU')} ₽. Теперь собери финансирование.`, 'good')
      return accepted()
    }
    const eligible = decision.botCeilings.map((ceiling, index) => ({ ceiling, index })).filter((item) => item.ceiling >= command.amount + decision.minimumStep)
    const bot = eligible[Math.floor(random() * eligible.length)] ?? { ceiling: highestBot, index: decision.botCeilings.indexOf(highestBot) }
    decision.currentBid = Math.min(bot.ceiling, command.amount + decision.minimumStep)
    decision.leadingBot = bot.index
    pushSystemEvent(state, 'Соперник перебил ставку', `Новая цена ${decision.currentBid.toLocaleString('ru-RU')} ₽.`, 'neutral')
    return accepted()
  }
  if (command.type === 'AUCTION_WITHDRAW' && decision.kind === 'auction') return accepted(true)
  if (command.type === 'MANAGEMENT_ACTION' && decision.kind === 'management') {
    if (command.action === 'refinance') {
      const loan = [...player.loans].filter((item) => !item.collateralStockId).sort((a, b) => b.annualRate - a.annualRate)[0]
      if (!loan) return rejected('Нет подходящего кредита')
      const fee = Math.round(loan.balance * 0.02)
      if (player.cash < fee) return rejected('Недостаточно денег на комиссию')
      player.cash -= fee
      loan.annualRate = Math.max(0.1, loan.annualRate - 0.04)
      loan.monthlyPayment = loanPayment(loan.balance, loan.annualRate, Math.max(1, loan.termMonths))
      pushSystemEvent(state, 'Кредит рефинансирован', `${loan.name}: новая ставка ${Math.round(loan.annualRate * 100)}%.`, 'good')
    } else {
      const asset = player.assets.find((item) => item.id === command.assetId)
      if (!asset) return rejected('Актив не найден')
      const cost = Math.round(assetMarketValue(asset) * 0.025)
      if (player.cash < cost) return rejected('Недостаточно денег')
      player.cash -= cost
      asset.insuredUntilMonth = state.month + 3
      pushSystemEvent(state, 'Бизнес застрахован', `${asset.name}: защита до месяца ${state.month + 3}.`, 'good')
    }
    return accepted(true)
  }
  return { handled: false, accepted: false }
}

export const quickSellAssetForFunding = (state: GameState, player: Player, assetId: string) => {
  const asset = player.assets.find((item) => item.id === assetId)
  if (!asset) return false
  return sellAssetAtPrice(state, player, assetId, Math.round(assetMarketValue(asset) * 0.93), 'Срочная продажа для финансирования')
}

export const sellAssetShareForFunding = (state: GameState, player: Player, assetId: string, percent: 10 | 25 | 50) =>
  handleReadyV14Command(state, { type: 'SELL_ASSET_SHARE', assetId, percent }, () => 0).accepted

export const businessForDecision = (businessId: string) => businesses.find((item) => item.id === businessId)

export const projectedAssetFlow = (businessId: string) => {
  const business = businessForDecision(businessId)
  return business ? business.revenue - business.operatingCosts : 0
}

export const currentPortfolioFlow = (player: Player) => player.assets.reduce((sum, asset) => sum + assetCashflow(asset), 0)
