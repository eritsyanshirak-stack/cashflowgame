import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import type { Asset } from '../domain/types'
import { assetCashflow, effectiveAssetRevenue, isFinanciallyFree, loanPayment } from '../systems/economy'
import { emptyGame, executeCommand } from './engine'

const makeAsset = (businessId: string, ownerId = 'human'): Asset => {
  const business = businesses.find((item) => item.id === businessId)!
  return {
    ...business, id: `test-${businessId}`, ownerId, ownership: 1,
    monthlyPayment: loanPayment(business.loan, business.loanRate, business.loanTermMonths),
    purchaseMonth: 1, developmentLevel: 0, developments: [], totalDevelopmentCost: 0,
    lastDevelopedMonth: null, saleOffer: null, offerExpiresMonth: null,
    status: 'launching', dueDiligence: 'none', launchMonthsRemaining: 2,
    incidentCooldown: 0, issueMonths: 0, missedPayments: 0,
  }
}

const started = (seed = 71) => executeCommand(emptyGame(seed), { type: 'START_GAME', professionId: 'trainer', botCount: 1, difficulty: 'normal', seed }).state

describe('risk and stability systems', () => {
  it('ramps up a new business instead of paying full revenue immediately', () => {
    const asset = makeAsset('coffee')
    expect(effectiveAssetRevenue(asset)).toBe(Math.round(asset.revenue * 0.55))
    expect(assetCashflow(asset)).toBeLessThan(asset.revenue - asset.operatingCosts - asset.monthlyPayment)
  })

  it('allows inspection to reveal a hidden issue before purchase', () => {
    const game = started(5)
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'coffee', askingPrice: 480_000, negotiated: false, inspection: 'none', hiddenIssue: 'documents', issueRevealed: false }
    game.players[0].cash = 500_000
    const inspected = executeCommand(game, { type: 'INSPECT_BUSINESS', level: 'full' })
    expect(inspected.accepted).toBe(true)
    expect(inspected.state.pendingDecision).toMatchObject({ inspection: 'full', issueRevealed: true, hiddenIssue: 'documents' })
  })

  it('requires three stable months before declaring freedom', () => {
    const game = started()
    const player = game.players[0]
    player.deposit = 50_000_000
    player.freedomStreak = 2
    expect(isFinanciallyFree(player, game.stockMarket)).toBe(false)
    player.freedomStreak = 3
    expect(isFinanciallyFree(player, game.stockMarket)).toBe(true)
  })

  it('repossesses a financed asset after repeated cash shortfalls and keeps deficiency debt', () => {
    let game = started(91)
    const player = game.players[0]
    const asset = makeAsset('coffee')
    asset.marketValue = 100_000
    asset.loan = 330_000
    asset.monthlyPayment = 250_000
    asset.missedPayments = 1
    player.assets = [asset]
    player.cash = -50_000
    player.salary = 0
    player.baseExpenses = 300_000
    for (let turn = 0; turn < 7; turn += 1) {
      game.phase = 'decision'
      game.pendingDecision = { kind: 'salary' }
      game = executeCommand(game, { type: 'SKIP_DECISION' }).state
    }
    expect(game.players[0].assets).toHaveLength(0)
    expect(game.players[0].loans.some((loan) => loan.name.includes('Остаток после изъятия'))).toBe(true)
  })
})
