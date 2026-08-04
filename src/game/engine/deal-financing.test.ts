import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import type { Asset } from '../domain/types'
import { loanPayment } from '../systems/economy'
import { emptyGame, executeCommand } from './engine'

const startedGame = () => executeCommand(emptyGame(77), { type: 'START_GAME', professionId: 'trainer', seed: 77 }).state

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
  }
}

describe('deal financing planner', () => {
  it('sells a selected asset and uses only its net proceeds for the purchase', () => {
    const game = startedGame()
    const player = game.players[0]
    const vending = testAsset('vending', player.id, 'sell-vending')
    player.assets = [vending]
    player.cash = 60_000
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'coffee', askingPrice: 480_000, negotiated: false }

    const result = executeCommand(game, { type: 'BUY_BUSINESS', funding: 'cash', saleAssetIds: [vending.id] })

    expect(result.accepted).toBe(true)
    expect(result.state.players[0].assets).toHaveLength(1)
    expect(result.state.players[0].assets[0].id).not.toBe(vending.id)
    expect(result.state.players[0].assets[0].name).toBe('Кофейный островок')
    expect(result.state.players[0].cash).toBe(0)
  })

  it('rolls the whole plan back when the final purchase cannot be funded', () => {
    const game = startedGame()
    const player = game.players[0]
    const vending = testAsset('vending', player.id, 'rollback-vending')
    player.assets = [vending]
    player.cash = 0
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'coffee', askingPrice: 480_000, negotiated: false }

    const result = executeCommand(game, { type: 'BUY_BUSINESS', funding: 'cash', saleAssetIds: [vending.id] })

    expect(result.accepted).toBe(false)
    expect(result.state.players[0].cash).toBe(0)
    expect(result.state.players[0].assets.map((asset) => asset.id)).toEqual([vending.id])
    expect(result.state.phase).toBe('decision')
  })

  it('combines a sale with a secured loan and forbids selling the collateral', () => {
    const game = startedGame()
    const player = game.players[0]
    const vending = testAsset('vending', player.id, 'mixed-vending')
    const collateral = testAsset('vending', player.id, 'strong-collateral')
    collateral.marketValue = 1_000_000
    collateral.loan = 0
    collateral.monthlyPayment = 0
    collateral.revenue = 150_000
    collateral.operatingCosts = 20_000
    player.assets = [vending, collateral]
    player.cash = 20_000
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'coffee', askingPrice: 480_000, negotiated: false }

    const mixed = executeCommand(game, {
      type: 'BUY_BUSINESS', funding: 'secured', saleAssetIds: [vending.id], collateralAssetId: collateral.id,
    })
    expect(mixed.accepted).toBe(true)
    expect(mixed.state.players[0].assets.some((asset) => asset.id === collateral.id)).toBe(true)
    expect(mixed.state.players[0].loans.some((loan) => loan.collateralAssetId === collateral.id)).toBe(true)

    const invalid = executeCommand(game, {
      type: 'BUY_BUSINESS', funding: 'secured', saleAssetIds: [collateral.id], collateralAssetId: collateral.id,
    })
    expect(invalid.accepted).toBe(false)
    expect(invalid.error).toContain('одновременно')
  })
})
