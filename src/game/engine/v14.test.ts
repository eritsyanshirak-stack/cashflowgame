import { describe, expect, it } from 'vitest'
import { board, businesses } from '../content/content'
import type { Asset, BuyerOffer } from '../domain/types'
import { loanPayment } from '../systems/economy'
import {
  createStockMarginCall,
  emptyRecentCards,
  listingMonthsRemaining,
  listingResponseChance,
  negotiateBuyerOffer,
  pickFresh,
  processAssetListings,
} from '../systems/v14'
import { emptyGame, executeCommand } from './engine'

const startedGame = () => executeCommand(emptyGame(140), {
  type: 'START_GAME', professionId: 'trainer', botCount: 2, difficulty: 'normal', seed: 140,
}).state

const testAsset = (businessId: string, ownerId: string, id: string): Asset => {
  const business = businesses.find((item) => item.id === businessId)!
  return {
    ...business,
    id,
    ownerId,
    ownership: 1,
    monthlyPayment: loanPayment(business.loan, business.loanRate, business.loanTermMonths),
    purchaseMonth: 1,
    developmentLevel: 0,
    developments: [],
    totalDevelopmentCost: 0,
    lastDevelopedMonth: null,
    saleOffer: null,
    offerExpiresMonth: null,
    status: 'active',
    dueDiligence: 'none',
    launchMonthsRemaining: 0,
    incidentCooldown: 0,
    issueMonths: 0,
    missedPayments: 0,
    listingPrice: null,
    listingStartedMonth: null,
    listingExpiresMonth: null,
  }
}

describe('balance v1.4 systems', () => {
  it('replaces two passive expense cells with genuinely different decisions', () => {
    const counts = board.reduce<Record<string, number>>((result, cell) => {
      result[cell.type] = (result[cell.type] ?? 0) + 1
      return result
    }, {})

    expect(board).toHaveLength(20)
    expect(counts.expense).toBe(2)
    expect(counts.contract).toBe(2)
    expect(counts.auction).toBe(1)
    expect(counts.partnership).toBe(1)
    expect(counts.management).toBe(1)
  })

  it('does not repeat a recently drawn card while fresh cards remain', () => {
    const game = startedGame()
    game.recentCards = emptyRecentCards()
    const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

    const drawn = [
      pickFresh(game, 'chance', cards, (item) => item.id, () => 0, 3).id,
      pickFresh(game, 'chance', cards, (item) => item.id, () => 0, 3).id,
      pickFresh(game, 'chance', cards, (item) => item.id, () => 0, 3).id,
    ]

    expect(drawn).toEqual(['a', 'b', 'c'])
  })

  it('makes buyers frequent near market and rare at an unrealistic asking price', () => {
    expect(listingResponseChance(950_000, 1_000_000)).toBe(0.92)
    expect(listingResponseChance(1_000_000, 1_000_000)).toBe(0.84)
    expect(listingResponseChance(1_200_000, 1_000_000)).toBe(0.52)
    expect(listingResponseChance(1_400_000, 1_000_000)).toBe(0.16)
  })

  it('keeps a listing alive for all three advertised months and opens a buyer offer', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = testAsset('vending', player.id, 'listed-vending')
    asset.listingPrice = 90_000
    asset.listingStartedMonth = 1
    asset.listingExpiresMonth = 4
    player.assets = [asset]

    expect(listingMonthsRemaining(game, asset.listingExpiresMonth)).toBe(3)
    game.month = 4
    expect(listingMonthsRemaining(game, asset.listingExpiresMonth)).toBe(0)
    processAssetListings(game, () => 0)

    expect(game.buyerOffers).toHaveLength(1)
    expect(game.buyerOffers[0].offeredPrice).toBe(90_000)
    expect(player.assets[0].listingPrice).toBe(90_000)

    game.buyerOffers = []
    game.month = 5
    processAssetListings(game, () => 0)
    expect(player.assets[0].listingPrice).toBeNull()
  })

  it('lets a buyer accept, counter or walk depending on the negotiation', () => {
    const offer: BuyerOffer = {
      id: 'offer', assetId: 'asset', buyerName: 'Покупатель',
      askingPrice: 110_000, offeredPrice: 95_000, marketValue: 100_000,
      round: 1, final: false, expiresMonth: 2,
    }

    expect(negotiateBuyerOffer(offer, 100_000, 2, () => 0)).toEqual({ kind: 'accepted', price: 100_000 })

    const values = [0.99, 0.99, 0.5]
    const counter = negotiateBuyerOffer(offer, 105_000, 0, () => values.shift() ?? 0.5)
    expect(counter.kind).toBe('counter')

    expect(negotiateBuyerOffer({ ...offer, final: true }, 105_000, 0, () => 0.99)).toEqual({ kind: 'walk' })
  })

  it('starts a contract, locks its investment and keeps the result for a future month', () => {
    const game = startedGame()
    const player = game.players[0]
    player.cash = 100_000
    game.phase = 'decision'
    game.pendingDecision = {
      kind: 'contract', title: 'Тестовый контракт', description: 'Проверка',
      options: [{ id: 'safe', title: 'Безопасный', investment: 20_000, payout: 42_000, durationMonths: 1, successChance: 0.9, skillId: 'management' }],
    }

    const result = executeCommand(game, { type: 'TAKE_CONTRACT', optionId: 'safe' })

    expect(result.accepted).toBe(true)
    expect(result.state.players[0].cash).toBe(80_000)
    expect(result.state.players[0].activeContracts).toHaveLength(1)
    expect(result.state.players[0].activeContracts[0].resolvesMonth).toBe(2)
  })

  it('pledges only part of a stock position and blocks sale of pledged shares', () => {
    const game = startedGame()
    const player = game.players[0]
    const quote = game.stockMarket.find((item) => item.id === 'tech')!
    player.stocks = [{ stockId: quote.id, quantity: 10, averagePrice: quote.price, pledgedQuantity: 0 }]
    const cashBefore = player.cash

    const pledged = executeCommand(game, { type: 'PLEDGE_STOCK', stockId: quote.id, percent: 50 })

    expect(pledged.accepted).toBe(true)
    expect(pledged.state.players[0].stocks[0].pledgedQuantity).toBe(5)
    expect(pledged.state.players[0].cash).toBe(cashBefore + Math.floor(quote.price * 5 * 0.45))
    expect(pledged.state.players[0].loans.some((loan) => loan.collateralStockId === quote.id)).toBe(true)

    const marketGame = structuredClone(pledged.state)
    marketGame.phase = 'decision'
    marketGame.pendingDecision = { kind: 'market', title: 'Рынок', description: 'Тест' }
    const invalidSale = executeCommand(marketGame, { type: 'SELL_STOCK', stockId: quote.id, quantity: 6 })
    expect(invalidSale.accepted).toBe(false)
    expect(invalidSale.error).toContain('свободных')
  })

  it('creates a margin call after a deep fall in pledged shares', () => {
    const game = startedGame()
    const player = game.players[0]
    const quote = game.stockMarket.find((item) => item.id === 'tech')!
    player.stocks = [{ stockId: quote.id, quantity: 10, averagePrice: quote.price, pledgedQuantity: 0 }]
    const pledged = executeCommand(game, { type: 'PLEDGE_STOCK', stockId: quote.id, percent: 100 }).state
    pledged.stockMarket.find((item) => item.id === quote.id)!.price = Math.round(quote.price * 0.5)

    const call = createStockMarginCall(pledged.players[0], pledged.stockMarket)

    expect(call).not.toBeNull()
    expect(call?.stockId).toBe(quote.id)
    expect(call?.requiredPayment).toBeGreaterThan(0)
  })

  it('forbids selling a share of a business that secures another loan', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = testAsset('vending', player.id, 'pledged-business')
    asset.marketValue = 300_000
    player.assets = [asset]
    player.loans.push({
      id: 'secured', name: 'Кредит под бизнес', balance: 70_000,
      monthlyPayment: 4_000, annualRate: 0.18, termMonths: 24,
      collateralAssetId: asset.id,
    })

    const result = executeCommand(game, { type: 'SELL_ASSET_SHARE', assetId: asset.id, percent: 25 })

    expect(result.accepted).toBe(false)
    expect(result.error).toContain('залоге')
    expect(result.state.players[0].assets[0].ownership).toBe(1)
  })

  it('rolls back an asset sale when a stock purchase still cannot be funded', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = testAsset('vending', player.id, 'stock-funding-asset')
    player.assets = [asset]
    player.cash = 0
    game.phase = 'decision'
    game.pendingDecision = { kind: 'market', title: 'Рынок', description: 'Тест' }

    const result = executeCommand(game, {
      type: 'BUY_STOCK', stockId: 'tech', quantity: 1_000, funding: 'cash', saleAssetIds: [asset.id],
    })

    expect(result.accepted).toBe(false)
    expect(result.state.players[0].cash).toBe(0)
    expect(result.state.players[0].assets.map((item) => item.id)).toEqual([asset.id])
  })
})
