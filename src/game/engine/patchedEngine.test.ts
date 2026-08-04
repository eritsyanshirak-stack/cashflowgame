import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import type { Asset } from '../domain/types'
import { assetMarketValue, loanPayment } from '../systems/economy'
import { emptyGame, executeCommand } from './patchedEngine'

const startedGame = (seed = 19) => executeCommand(emptyGame(seed), { type: 'START_GAME', professionId: 'trainer', seed }).state

const testAsset = (ownerId: string, id = 'v13-vending'): Asset => {
  const business = businesses.find((item) => item.id === 'vending')!
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
  }
}

describe('balance v1.3 patch', () => {
  it('starts with shares affordable below 10,000 rubles', () => {
    const game = startedGame()
    expect(Math.max(...game.stockMarket.map((quote) => quote.price))).toBeLessThan(10_000)
    expect(game.stockMarket.find((quote) => quote.id === 'retail')?.price).toBe(3_150)
  })

  it('reduces every random expense card fivefold at the moment it appears', () => {
    let expenseAmount: number | undefined
    for (let seed = 1; seed <= 300 && expenseAmount === undefined; seed += 1) {
      const game = startedGame(seed)
      const result = executeCommand(game, { type: 'ROLL_DICE' })
      if (result.state.pendingDecision?.kind === 'expense') expenseAmount = result.state.pendingDecision.amount
    }
    expect(expenseAmount).toBeDefined()
    expect(expenseAmount).toBeLessThanOrEqual(36_000)
    expect(expenseAmount).toBeGreaterThanOrEqual(8_400)
  })

  it('lets a player list an asset only between 90 and 140 percent of market', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = testAsset(player.id)
    player.assets = [asset]
    const market = assetMarketValue(asset)

    const listed = executeCommand(game, { type: 'LIST_ASSET', assetId: asset.id, askingPrice: Math.round(market * 1.2) })
    expect(listed.accepted).toBe(true)
    expect((listed.state.players[0].assets[0] as Asset & { listingPrice?: number }).listingPrice).toBe(Math.round(market * 1.2))

    const tooHighGame = startedGame()
    const tooHighAsset = testAsset(tooHighGame.players[0].id, 'too-high-vending')
    tooHighGame.players[0].assets = [tooHighAsset]
    const rejected = executeCommand(tooHighGame, { type: 'LIST_ASSET', assetId: tooHighAsset.id, askingPrice: Math.round(market * 1.5) })
    expect(rejected.accepted).toBe(false)
  })

  it('applies a seven percent discount to an immediate asset sale', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = testAsset(player.id)
    player.assets = [asset]
    const startingCash = player.cash
    const expectedProceeds = Math.round(assetMarketValue(asset) * 0.93)

    const result = executeCommand(game, { type: 'SELL_ASSET', assetId: asset.id })
    expect(result.accepted).toBe(true)
    expect(result.state.players[0].cash).toBe(startingCash + expectedProceeds)
    expect(result.state.players[0].assets).toHaveLength(0)
  })

  it('can cancel a live listing without selling the business', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = testAsset(player.id)
    player.assets = [asset]
    const listed = executeCommand(game, { type: 'LIST_ASSET', assetId: asset.id, askingPrice: assetMarketValue(asset) })
    const cancelled = executeCommand(listed.state, { type: 'CANCEL_ASSET_LISTING', assetId: asset.id })

    expect(cancelled.accepted).toBe(true)
    expect(cancelled.state.players[0].assets).toHaveLength(1)
    expect((cancelled.state.players[0].assets[0] as Asset & { listingPrice?: number | null }).listingPrice).toBeNull()
  })
})
