import { describe, expect, it } from 'vitest'
import { businesses, difficultySettings } from '../content/content'
import type { Asset } from '../domain/types'
import { assessLoan, isFinanciallyFree, loanPayment, monthlyExpenses, portfolioManagementCost } from '../systems/economy'
import { emptyGame, executeCommand } from './engine'

const startedGame = (seed = 101) =>
  executeCommand(emptyGame(seed), { type: 'START_GAME', professionId: 'trainer', botCount: 2, difficulty: 'normal', seed }).state

const testAsset = (businessId: string, ownerId: string, index: number): Asset => {
  const business = businesses.find((item) => item.id === businessId)!
  return {
    ...business,
    id: `${business.id}-${index}`,
    ownerId,
    ownership: 1,
    monthlyPayment: loanPayment(business.loan, business.loanAnnualRate, business.loanTermMonths),
    purchaseMonth: 1,
    developmentLevel: 0,
    developments: [],
    totalDevelopmentCost: 0,
    lastDevelopedMonth: null,
    saleOffer: null,
    offerExpiresMonth: null,
  }
}

describe('balance guardrails', () => {
  it('uses debt-service limits instead of allowing almost all income to be committed', () => {
    expect(difficultySettings.easy.maxDebtLoad).toBeLessThanOrEqual(0.5)
    expect(difficultySettings.normal.maxDebtLoad).toBeLessThan(difficultySettings.easy.maxDebtLoad)
    expect(difficultySettings.hard.maxDebtLoad).toBeLessThan(difficultySettings.normal.maxDebtLoad)
  })

  it('still allows a modest acquisition gap but rejects a purchase with almost no buyer money', () => {
    const game = startedGame()
    const player = game.players[0]
    const pickup = businesses.find((item) => item.id === 'pickup')!
    const projectedIncome = pickup.revenue - pickup.operatingCosts
    const projectedPayment = loanPayment(pickup.loan, pickup.loanAnnualRate, pickup.loanTermMonths)

    player.cash = 150_000
    const modestGap = assessLoan(player, 30_000, 'normal', undefined, projectedIncome, projectedPayment)
    expect(modestGap.approved).toBe(true)

    player.cash = 20_000
    const recklessGap = assessLoan(player, 130_000, 'normal', undefined, projectedIncome, projectedPayment)
    expect(recklessGap.approved).toBe(false)
    expect(recklessGap.reason).toContain('собственных денег')
  })

  it('stops repeated unsecured borrowing instead of creating an unlimited money loop', () => {
    let game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'bank' }
    let approvedLoans = 0

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const result = executeCommand(game, { type: 'TAKE_LOAN', amount: 100_000 })
      if (!result.accepted) break
      approvedLoans += 1
      game = result.state
    }

    expect(approvedLoans).toBeGreaterThan(0)
    expect(approvedLoans).toBeLessThanOrEqual(3)
    expect(executeCommand(game, { type: 'TAKE_LOAN', amount: 100_000 }).accepted).toBe(false)
  })

  it('adds management overhead when a player buys more businesses than they can control', () => {
    const game = startedGame()
    const player = game.players[0]
    player.assets = Array.from({ length: 3 }, (_, index) => testAsset('coffee', player.id, index))
    expect(portfolioManagementCost(player)).toBe(0)

    player.assets.push(testAsset('coffee', player.id, 4))
    expect(portfolioManagementCost(player)).toBeGreaterThan(0)

    player.skills.management = 200
    expect(portfolioManagementCost(player)).toBe(0)
  })

  it('does not declare freedom while unsecured debt is dangerously high', () => {
    const game = startedGame()
    const player = game.players[0]
    player.deposit = 20_000_000
    player.cash = monthlyExpenses(player) * 3
    player.freedomStreak = 3
    player.loans.push({
      id: 'debt-wall',
      name: 'Кредитная пирамида',
      balance: 1_000_000,
      monthlyPayment: 0,
      annualRate: 0.25,
      termMonths: 36,
    })

    expect(isFinanciallyFree(player, game.stockMarket)).toBe(false)
  })
})
