import { describe, expect, it } from 'vitest'
import { emptyGame, executeCommand } from './engine'

const gameWithStocks = () => {
  const game = executeCommand(emptyGame(240), {
    type: 'START_GAME', professionId: 'trainer', botCount: 1, difficulty: 'normal', seed: 240,
  }).state
  const quote = game.stockMarket.find((item) => item.id === 'tech')!
  game.players[0].stocks = [{ stockId: quote.id, quantity: 10, averagePrice: quote.price, pledgedQuantity: 0 }]
  return { game, quote }
}

describe('v1.4 stock collateral debt', () => {
  it('releases pledged shares after the collateral loan is repaid in full', () => {
    const { game, quote } = gameWithStocks()
    const pledged = executeCommand(game, { type: 'PLEDGE_STOCK', stockId: quote.id, percent: 50 }).state
    const balance = pledged.players[0].loans.find((loan) => loan.collateralStockId === quote.id)!.balance
    pledged.phase = 'decision'
    pledged.pendingDecision = { kind: 'bank' }

    const repaid = executeCommand(pledged, { type: 'REPAY_LOAN', amount: balance })

    expect(repaid.accepted).toBe(true)
    expect(repaid.state.players[0].loans.some((loan) => loan.collateralStockId === quote.id)).toBe(false)
    expect(repaid.state.players[0].stocks[0].pledgedQuantity).toBe(0)
  })

  it('does not allow pledging shares while an unrelated decision is open', () => {
    const { game, quote } = gameWithStocks()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'salary' }

    const result = executeCommand(game, { type: 'PLEDGE_STOCK', stockId: quote.id, percent: 50 })

    expect(result.accepted).toBe(false)
    expect(result.state.players[0].stocks[0].pledgedQuantity).toBe(0)
  })

  it('rejects a stock-backed loan that pushes reliable debt payments above 45 percent', () => {
    const { game, quote } = gameWithStocks()
    const player = game.players[0]
    player.salary = 10_000
    player.baseDebt = 1_000_000

    const result = executeCommand(game, { type: 'PLEDGE_STOCK', stockId: quote.id, percent: 100 })

    expect(result.accepted).toBe(false)
    expect(result.error).toContain('45%')
    expect(result.state.players[0].loans).toHaveLength(0)
  })
})
