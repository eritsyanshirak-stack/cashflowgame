import type { CommandResult, GameCommand, GameState } from '../domain/types'
import { assetMarketValue } from '../systems/economy'
import { emptyGame as baseEmptyGame, executeCommand as baseExecuteCommand } from './engine'

export type PatchedGameCommand = GameCommand |
  { type: 'LIST_ASSET'; assetId: string; askingPrice: number } |
  { type: 'CANCEL_ASSET_LISTING'; assetId: string } |
  { type: 'COUNTER_SALE_OFFER'; assetId: string; multiplier: 1.05 | 1.1 | 1.15 }

type V13State = GameState & { balanceV13?: boolean }
type ListedAsset = GameState['players'][number]['assets'][number] & {
  listingPrice?: number | null
  listingExpiresMonth?: number | null
}

const clone = <T,>(value: T): T => structuredClone(value)

const hashUnit = (state: GameState, salt: string) => {
  let hash = (state.seed ^ (state.month * 2654435761)) >>> 0
  for (let index = 0; index < salt.length; index += 1) {
    hash = Math.imul(hash ^ salt.charCodeAt(index), 2246822519) >>> 0
    hash = (hash ^ (hash >>> 13)) >>> 0
  }
  return hash / 4294967296
}

const addEvent = (state: GameState, title: string, description: string, tone: 'good' | 'bad' | 'neutral' = 'neutral') => {
  state.events.unshift({
    id: `v13-${state.month}-${state.day}-${state.events.length}-${Math.round(hashUnit(state, title) * 1_000_000)}`,
    title,
    description,
    month: state.month,
    day: state.day,
    tone,
  })
  state.events = state.events.slice(0, 100)
}

const scaleInitialShares = (state: GameState) => {
  const targetPrices: Record<string, number> = {
    energy: 4_600,
    tech: 7_950,
    retail: 3_150,
    bank: 6_050,
    biotech: 8_500,
  }
  state.stockMarket.forEach((quote) => {
    const target = targetPrices[quote.id]
    if (!target) return
    quote.price = target
    quote.previousPrice = target
  })
}

const prepareState = (current: GameState) => {
  const prepared = clone(current) as V13State
  if (!prepared.balanceV13 && prepared.phase !== 'setup') {
    scaleInitialShares(prepared)
    prepared.balanceV13 = true
  }
  return prepared
}

const rebalanceExpense = (result: CommandResult, command: PatchedGameCommand) => {
  if (!result.accepted || command.type !== 'ROLL_DICE') return
  const decision = result.state.pendingDecision
  if (decision?.kind === 'expense') decision.amount = Math.max(1_000, Math.round(decision.amount / 5))
}

const enhanceStockMarket = (state: GameState) => {
  const rareRoll = hashUnit(state, `rare-market-${state.month}`)
  const rare = rareRoll < 0.12
  const rareIndex = Math.floor(hashUnit(state, `rare-sector-${state.month}`) * state.stockMarket.length)
  const rarePositive = hashUnit(state, `rare-direction-${state.month}`) >= 0.5

  state.stockMarket.forEach((quote, index) => {
    const previous = Math.max(1, quote.previousPrice)
    const baseMove = quote.price / previous - 1
    let move = Math.max(-0.32, Math.min(0.36, baseMove * 1.45))
    if (rare && index === rareIndex) {
      move = rarePositive
        ? 0.5 + hashUnit(state, `rare-up-${quote.id}-${state.month}`) * 0.15
        : -0.5
      state.marketHeadline = rarePositive
        ? `${quote.name}: событие резко подняло котировки`
        : `${quote.name}: кризис обвалил котировки`
    }
    quote.price = Math.max(500, Math.round(previous * (1 + move)))
  })
}

const processListings = (state: GameState) => {
  const player = state.players[0]
  for (const rawAsset of player.assets) {
    const asset = rawAsset as ListedAsset
    if (!asset.listingPrice || !asset.listingExpiresMonth) continue
    if (asset.listingExpiresMonth < state.month) {
      asset.listingPrice = null
      asset.listingExpiresMonth = null
      asset.saleOffer = null
      asset.offerExpiresMonth = null
      addEvent(state, 'Объявление снято', `${asset.name}: за три месяца покупатель не найден.`, 'neutral')
      continue
    }

    const marketValue = Math.max(1, assetMarketValue(asset))
    const ratio = asset.listingPrice / marketValue
    const responseChance = ratio <= 0.95 ? 0.92 : ratio <= 1 ? 0.76 : ratio <= 1.1 ? 0.5 : ratio <= 1.2 ? 0.28 : 0.1
    const responseRoll = hashUnit(state, `listing-response-${asset.id}-${state.month}`)
    if (responseRoll >= responseChance) {
      asset.saleOffer = null
      asset.offerExpiresMonth = null
      continue
    }

    const fullPriceChance = Math.max(0.12, 0.78 - Math.max(0, ratio - 1) * 2.4)
    const fullPrice = hashUnit(state, `listing-full-${asset.id}-${state.month}`) < fullPriceChance
    const buyerFactor = 0.88 + hashUnit(state, `listing-price-${asset.id}-${state.month}`) * 0.12
    asset.saleOffer = fullPrice
      ? asset.listingPrice
      : Math.max(Math.round(marketValue * 0.82), Math.round(Math.min(asset.listingPrice, marketValue * buyerFactor)))
    asset.offerExpiresMonth = state.month
    addEvent(state, 'Покупатель откликнулся', `${asset.name}: предложение ${asset.saleOffer.toLocaleString('ru-RU')} ₽.`, 'good')
  }
}

const handleListingCommand = (current: GameState, command: Extract<PatchedGameCommand, { type: 'LIST_ASSET' | 'CANCEL_ASSET_LISTING' }>): CommandResult => {
  const state = prepareState(current)
  if (state.phase !== 'ready') return { state: current, accepted: false, error: 'Сначала заверши текущее решение' }
  const asset = state.players[0].assets.find((item) => item.id === command.assetId) as ListedAsset | undefined
  if (!asset) return { state: current, accepted: false, error: 'Актив не найден' }

  if (command.type === 'CANCEL_ASSET_LISTING') {
    asset.listingPrice = null
    asset.listingExpiresMonth = null
    asset.saleOffer = null
    asset.offerExpiresMonth = null
    addEvent(state, 'Продажа отменена', `${asset.name} снят с рынка.`, 'neutral')
    return { state, accepted: true }
  }

  const marketValue = assetMarketValue(asset)
  const minPrice = Math.round(marketValue * 0.9)
  const maxPrice = Math.round(marketValue * 1.4)
  if (!Number.isFinite(command.askingPrice) || command.askingPrice < minPrice || command.askingPrice > maxPrice) {
    return { state: current, accepted: false, error: `Цена должна быть от ${minPrice.toLocaleString('ru-RU')} ₽ до ${maxPrice.toLocaleString('ru-RU')} ₽` }
  }
  asset.listingPrice = Math.round(command.askingPrice)
  asset.listingExpiresMonth = state.month + 3
  asset.saleOffer = null
  asset.offerExpiresMonth = null
  addEvent(state, 'Актив выставлен на продажу', `${asset.name}: цена ${asset.listingPrice.toLocaleString('ru-RU')} ₽, срок три месяца.`, 'neutral')
  return { state, accepted: true }
}

const handleCounterOffer = (current: GameState, command: Extract<PatchedGameCommand, { type: 'COUNTER_SALE_OFFER' }>): CommandResult => {
  const state = prepareState(current)
  if (state.phase !== 'ready') return { state: current, accepted: false, error: 'Сначала заверши текущее решение' }
  const asset = state.players[0].assets.find((item) => item.id === command.assetId) as ListedAsset | undefined
  if (!asset?.saleOffer || asset.offerExpiresMonth !== state.month) return { state: current, accepted: false, error: 'Предложение уже недоступно' }

  const counterPrice = Math.round(asset.saleOffer * command.multiplier)
  const premium = Math.max(0, counterPrice / Math.max(1, assetMarketValue(asset)) - 1)
  const acceptanceChance = Math.max(0.08, Math.min(0.9, 0.74 - premium * 1.9 - (command.multiplier - 1) * 1.4))
  const accepted = hashUnit(state, `counter-${asset.id}-${state.month}-${command.multiplier}`) < acceptanceChance
  if (accepted) {
    asset.saleOffer = counterPrice
    const result = baseExecuteCommand(state, { type: 'ACCEPT_SALE_OFFER', assetId: asset.id })
    if (result.accepted) addEvent(result.state, 'Контроффер принят', `${asset.name}: покупатель согласился на ${counterPrice.toLocaleString('ru-RU')} ₽.`, 'good')
    return result
  }

  asset.saleOffer = null
  asset.offerExpiresMonth = null
  addEvent(state, 'Покупатель отказался', `${asset.name}: встречная цена ${counterPrice.toLocaleString('ru-RU')} ₽ не принята. Объявление остаётся активным.`, 'bad')
  return { state, accepted: true }
}

const prepareQuickSale = (state: GameState, assetIds: string[]) => {
  for (const id of assetIds) {
    const asset = state.players[0].assets.find((item) => item.id === id)
    if (!asset) continue
    asset.marketValue = Math.round(assetMarketValue(asset) * 0.93)
  }
}

export const emptyGame = baseEmptyGame

export const executeCommand = (current: GameState, command: PatchedGameCommand): CommandResult => {
  if (command.type === 'LIST_ASSET' || command.type === 'CANCEL_ASSET_LISTING') return handleListingCommand(current, command)
  if (command.type === 'COUNTER_SALE_OFFER') return handleCounterOffer(current, command)

  const prepared = prepareState(current)
  const previousMonth = prepared.month

  if (command.type === 'SELL_ASSET') prepareQuickSale(prepared, [command.assetId])
  if ((command.type === 'BUY_BUSINESS' || command.type === 'BUY_OPPORTUNITY') && command.saleAssetIds?.length) {
    prepareQuickSale(prepared, command.saleAssetIds)
  }

  const result = baseExecuteCommand(prepared, command as GameCommand)
  if (!result.accepted) return { ...result, state: current }

  const state = result.state as V13State
  if (command.type === 'START_GAME') {
    scaleInitialShares(state)
    state.balanceV13 = true
  }

  rebalanceExpense(result, command)
  if (state.month > previousMonth) {
    enhanceStockMarket(state)
    processListings(state)
  }
  return result
}
