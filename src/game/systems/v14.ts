import { contractCards, globalEvents } from '../content/content'
import type { BuyerOffer, ContractOption, GameEvent, GameState, MarginCall, Player, RecentCards, StockHolding, StockQuote } from '../domain/types'
import { assetMarketValue, loanPayment } from './economy'
import { skillLevel } from './progression'
import { buyerArchetypeLabel, buyerOfferMultiplier, chooseBuyerArchetype, contractSpecializationBonus, stockCollateralRatio } from './v15'

export const emptyRecentCards = (): RecentCards => ({
  business: [],
  expense: [],
  chance: [],
  contract: [],
  global: [],
})

export const pickFresh = <T>(
  state: GameState,
  bucket: keyof RecentCards,
  values: readonly T[],
  idOf: (value: T) => string,
  random: () => number,
  memory = 4,
): T => {
  const recent = state.recentCards[bucket] ?? []
  const available = values.filter((value) => !recent.includes(idOf(value)))
  const pool = available.length > 0 ? available : [...values]
  const selected = pool[Math.floor(random() * pool.length)] ?? values[0]
  state.recentCards[bucket] = [idOf(selected), ...recent.filter((id) => id !== idOf(selected))].slice(0, memory)
  return selected
}

const eventId = (state: GameState, prefix: string) => `${prefix}-${state.month}-${state.day}-${state.seed}-${state.events.length}`

export const pushSystemEvent = (state: GameState, title: string, description: string, tone: GameEvent['tone'] = 'neutral') => {
  state.events.unshift({ id: eventId(state, 'v14'), title, description, tone, month: state.month, day: state.day })
  state.events = state.events.slice(0, 100)
}

export const createContractOptions = (state: GameState, player: Player, random: () => number) => {
  const card = pickFresh(state, 'contract', contractCards, (item) => item.id, random, 4)
  const level = skillLevel(player, card.skillId)
  const skillBonus = level * 0.06
  const specialization = contractSpecializationBonus(player)
  const options: ContractOption[] = [
    {
      id: 'safe', title: 'Небольшой безопасный проект',
      investment: Math.round(card.baseInvestment * 0.55), payout: Math.round(card.basePayout * 0.72 * specialization.payout),
      durationMonths: 1, successChance: Math.min(0.99, 0.9 + skillBonus + specialization.success), skillId: card.skillId,
    },
    {
      id: 'balanced', title: 'Полный контракт',
      investment: card.baseInvestment, payout: Math.round(card.basePayout * specialization.payout),
      durationMonths: 1, successChance: Math.min(0.98, 0.72 + skillBonus + specialization.success), skillId: card.skillId,
    },
    {
      id: 'bold', title: 'Расширить объём и команду',
      investment: Math.round(card.baseInvestment * 1.55), payout: Math.round(card.basePayout * 2.05 * specialization.payout),
      durationMonths: 2, successChance: Math.min(0.94, 0.5 + skillBonus + specialization.success), skillId: card.skillId,
    },
  ]
  return { card, options }
}

export const settleContracts = (state: GameState, player: Player, nextMonth: number, random: () => number) => {
  let returns = 0
  const remaining = []
  for (const contract of player.activeContracts ?? []) {
    if (contract.resolvesMonth > nextMonth) {
      remaining.push(contract)
      continue
    }
    const success = random() < contract.successChance
    const amount = success ? contract.payout : Math.round(contract.investment * 0.18)
    returns += amount
    if (!player.isBot) {
      const profit = amount - contract.investment
      pushSystemEvent(
        state,
        success ? 'Контракт выполнен' : 'Контракт сорван',
        `${contract.title}: ${profit >= 0 ? '+' : ''}${profit.toLocaleString('ru-RU')} ₽.`,
        success ? 'good' : 'bad',
      )
    }
  }
  player.activeContracts = remaining
  return returns
}

export const listingMonthsRemaining = (state: GameState, listingExpiresMonth?: number | null) =>
  listingExpiresMonth ? Math.max(0, listingExpiresMonth - state.month) : 0

export const listingResponseChance = (askingPrice: number, marketValue: number) => {
  const ratio = askingPrice / Math.max(1, marketValue)
  if (ratio <= 0.95) return 0.92
  if (ratio <= 1) return 0.84
  if (ratio <= 1.1) return 0.7
  if (ratio <= 1.2) return 0.52
  if (ratio <= 1.3) return 0.32
  return 0.16
}

export const processAssetListings = (state: GameState, random: () => number) => {
  const player = state.players[0]
  const activeAssetIds = new Set(player.assets.map((asset) => asset.id))
  state.buyerOffers = state.buyerOffers.filter((offer) => activeAssetIds.has(offer.assetId) && offer.expiresMonth >= state.month)

  for (const asset of player.assets) {
    if (!asset.listingPrice || !asset.listingExpiresMonth) continue
    if (state.month > asset.listingExpiresMonth) {
      asset.listingPrice = null
      asset.listingStartedMonth = null
      asset.listingExpiresMonth = null
      state.buyerOffers = state.buyerOffers.filter((offer) => offer.assetId !== asset.id)
      pushSystemEvent(state, 'Объявление завершено', `${asset.name}: срок размещения закончился без продажи.`)
      continue
    }
    if (state.buyerOffers.some((offer) => offer.assetId === asset.id)) continue

    const marketValue = Math.max(1, assetMarketValue(asset))
    const chance = listingResponseChance(asset.listingPrice, marketValue)
    if (random() >= chance) continue

    const ratio = asset.listingPrice / marketValue
    const archetype = chooseBuyerArchetype(asset, random)
    const fullPriceChance = ratio <= 1 ? 0.7 : ratio <= 1.1 ? 0.38 : ratio <= 1.2 ? 0.17 : 0.05
    const acceptsAsking = random() < fullPriceChance && archetype !== 'speculator'
    const archetypePrice = Math.round(marketValue * buyerOfferMultiplier(asset, archetype, random))
    const offeredPrice = acceptsAsking ? asset.listingPrice : Math.min(asset.listingPrice, archetypePrice)
    const offer: BuyerOffer = {
      id: eventId(state, `offer-${asset.id}`),
      assetId: asset.id,
      buyerName: buyerArchetypeLabel[archetype],
      askingPrice: asset.listingPrice,
      offeredPrice,
      marketValue,
      round: 1,
      final: false,
      expiresMonth: state.month,
      archetype,
    }
    state.buyerOffers.push(offer)
    pushSystemEvent(state, 'Покупатель откликнулся', `${asset.name}: предложение ${offeredPrice.toLocaleString('ru-RU')} ₽.`, 'good')
  }
}

export type BuyerNegotiationResult =
  | { kind: 'accepted'; price: number }
  | { kind: 'counter'; price: number }
  | { kind: 'walk' }

export const negotiateBuyerOffer = (
  offer: BuyerOffer,
  requestedPrice: number,
  negotiationLevel: number,
  random: () => number,
  specializationBonus = 0,
): BuyerNegotiationResult => {
  const requestedPremium = requestedPrice / Math.max(1, offer.marketValue) - 1
  const jump = requestedPrice / Math.max(1, offer.offeredPrice) - 1
  const acceptanceChance = Math.max(0.07, Math.min(0.94, 0.68 + negotiationLevel * 0.06 + specializationBonus - requestedPremium * 1.55 - jump * 1.8))
  if (random() < acceptanceChance) return { kind: 'accepted', price: requestedPrice }
  if (offer.final || random() < 0.42 + Math.max(0, requestedPremium) * 0.35) return { kind: 'walk' }
  const floor = Math.max(offer.offeredPrice, Math.round(offer.marketValue * 0.9))
  const ceiling = Math.min(requestedPrice, offer.askingPrice)
  const counter = Math.round(floor + (ceiling - floor) * (0.28 + random() * 0.34))
  return { kind: 'counter', price: Math.max(floor, counter) }
}

export const stockFreeQuantity = (holding: StockHolding) => Math.max(0, holding.quantity - (holding.pledgedQuantity ?? 0))

export const stockCollateralLoan = (player: Player, stockId: string) =>
  player.loans.find((loan) => loan.collateralStockId === stockId)

export const availableStockCollateral = (player: Player, holding: StockHolding, quote: StockQuote) => {
  if (stockCollateralLoan(player, holding.stockId)) return 0
  return Math.floor(stockFreeQuantity(holding) * quote.price * stockCollateralRatio(player))
}

export const createStockMarginCall = (player: Player, market: StockQuote[]): MarginCall | null => {
  for (const loan of player.loans) {
    if (!loan.collateralStockId || !loan.collateralStockQuantity) continue
    const quote = market.find((item) => item.id === loan.collateralStockId)
    if (!quote) continue
    const marketValue = quote.price * loan.collateralStockQuantity
    const maintenanceValue = loan.balance / 0.7
    if (marketValue >= maintenanceValue) continue
    return {
      stockId: loan.collateralStockId,
      loanId: loan.id,
      pledgedQuantity: loan.collateralStockQuantity,
      marketValue,
      balance: loan.balance,
      requiredPayment: Math.max(1_000, Math.ceil((loan.balance - marketValue * 0.62) / 1_000) * 1_000),
    }
  }
  return null
}

export const pledgeStockLoanTerms = (amount: number) => ({
  annualRate: 0.22,
  termMonths: 24,
  monthlyPayment: loanPayment(amount, 0.22, 24),
})

export const updateGlobalEvent = (state: GameState, random: () => number) => {
  if (state.globalEvent && state.globalEvent.expiresMonth > state.month) {
    for (const player of state.players) {
      for (const asset of player.assets) {
        asset.externalRevenueMultiplier = state.globalEvent.category && asset.category === state.globalEvent.category
          ? state.globalEvent.revenueMultiplier
          : 1
      }
    }
    return
  }

  const selected = pickFresh(state, 'global', globalEvents, (item) => item.id, random, 5)
  state.globalEvent = {
    id: selected.id,
    title: selected.title,
    description: selected.description,
    category: selected.category,
    sector: selected.sector,
    revenueMultiplier: selected.revenueMultiplier,
    stockImpact: selected.stockImpact,
    creditRateDelta: selected.creditRateDelta,
    startsMonth: state.month,
    expiresMonth: state.month + selected.duration,
  }
  for (const player of state.players) {
    for (const asset of player.assets) {
      asset.externalRevenueMultiplier = selected.category && asset.category === selected.category ? selected.revenueMultiplier : 1
    }
  }
  if (selected.sector) {
    for (const quote of state.stockMarket) {
      if (quote.sector === selected.sector) quote.price = Math.max(500, Math.round(quote.price * (1 + selected.stockImpact)))
    }
  }
  pushSystemEvent(state, selected.title, `${selected.description} Событие действует до месяца ${state.month + selected.duration}.`, selected.revenueMultiplier >= 1 && selected.stockImpact >= 0 ? 'good' : selected.revenueMultiplier < 1 || selected.stockImpact < 0 ? 'bad' : 'neutral')
}
