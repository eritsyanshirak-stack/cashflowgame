import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import type { Asset } from '../domain/types'
import { assetCashflow, freedomProgress, freedomRequirements, loanPayment, monthlyExpenses } from '../systems/economy'
import { emptyGame, executeCommand } from './engine'

const startedGame = (seed = 501) =>
  executeCommand(emptyGame(seed), { type: 'START_GAME', professionId: 'trainer', botCount: 2, difficulty: 'normal', seed }).state

const makeAsset = (businessId: string, ownerId: string, purchaseMonth: number): Asset => {
  const business = businesses.find((item) => item.id === businessId)!
  return {
    ...business,
    id: `${business.id}-test`,
    ownerId,
    ownership: 1,
    monthlyPayment: loanPayment(business.loan, business.loanAnnualRate, business.loanTermMonths),
    purchaseMonth,
    developmentLevel: 0,
    developments: [],
    totalDevelopmentCost: 0,
    lastDevelopedMonth: null,
    saleOffer: null,
    offerExpiresMonth: null,
    performanceMultiplier: 1,
  }
}

describe('balance v1.2', () => {
  it('keeps ordinary business payback in a strategic range', () => {
    for (const business of businesses.filter((item) => item.loan > 0 && item.requiredLevel <= 3)) {
      const payment = loanPayment(business.loan, business.loanAnnualRate, business.loanTermMonths)
      const flow = business.revenue - business.operatingCosts - payment
      const paybackMonths = business.downPayment / flow
      expect(flow).toBeGreaterThan(0)
      expect(paybackMonths).toBeGreaterThanOrEqual(14)
    }
  })

  it('makes a newly purchased business unprofitable during launch ramp-up', () => {
    const game = startedGame()
    const asset = makeAsset('coffee', game.players[0].id, game.month)
    expect(assetCashflow(asset, game.month)).toBeLessThan(0)
    expect(assetCashflow(asset, game.month + 3)).toBeGreaterThan(0)
  })

  it('turns excess businesses into a real management cost', () => {
    const game = startedGame()
    const player = game.players[0]
    player.assets = Array.from({ length: 9 }, (_, index) => ({ ...makeAsset('coffee', player.id, 1), id: `coffee-${index}` }))
    expect(monthlyExpenses(player, 5)).toBeGreaterThan(player.baseExpenses + Math.round(player.baseDebt * 0.02) + 150_000)
  })

  it('does not show 100 percent freedom when reserve or streak is missing', () => {
    const game = startedGame()
    const player = game.players[0]
    player.assets = Array.from({ length: 2 }, (_, index) => ({ ...makeAsset('medical', player.id, 1), id: `medical-${index}` }))
    player.cash = 0
    player.freedomStreak = 0
    const requirements = freedomRequirements(player, game.stockMarket, 5)
    expect(requirements.incomeCovered).toBe(true)
    expect(requirements.reserveReady).toBe(false)
    expect(freedomProgress(player, game.stockMarket, 5)).toBeLessThan(100)
  })

  it('keeps the unpaid business debt after a distressed sale', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = makeAsset('coffee', player.id, 1)
    asset.marketValue = 100_000
    player.assets.push(asset)
    const result = executeCommand(game, { type: 'SELL_ASSET', assetId: asset.id })
    expect(result.accepted).toBe(true)
    expect(result.state.players[0].assets).toHaveLength(0)
    expect(result.state.players[0].loans.some((loan) => loan.name.includes('Остаток долга'))).toBe(true)
  })
})
