import { describe, expect, it } from 'vitest'
import { globalEvents, marketHeadlines } from '../content/content'
import type { StockHolding } from '../domain/types'
import {
  calculateStockSale,
  clampStockPriceForMonth,
  STOCK_COMMISSION_RATE,
  stockPurchaseTotal,
  stockSaleProceeds,
} from '../systems/stockSale'
import { emptyGame, executeCommand } from './engine'

const startedGame = () => executeCommand(emptyGame(170), {
  type: 'START_GAME', professionId: 'developer', botCount: 1, difficulty: 'easy', seed: 170,
}).state

describe('Balance v1.7 stock audit', () => {
  it('caps the final combined monthly move instead of each shock separately', () => {
    expect(clampStockPriceForMonth(2_000, 300)).toBe(1_000)
    expect(clampStockPriceForMonth(2_000, 4_000)).toBe(3_300)
    expect(clampStockPriceForMonth(2_000, 2_240)).toBe(2_240)
  })

  it('separates price movement from purchase and sale commissions', () => {
    const quantity = 152
    const price = 1_888
    const invested = stockPurchaseTotal(price, quantity)
    const marketInvested = price * quantity
    const result = calculateStockSale(price, price, quantity, STOCK_COMMISSION_RATE, invested, { marketInvested })

    expect(result.priceProfit).toBe(0)
    expect(result.purchaseCommission).toBe(invested - marketInvested)
    expect(result.preSaleProfit).toBe(-(invested - marketInvested))
    expect(result.proceeds).toBe(stockSaleProceeds(price, quantity))
    expect(result.profitPercent).toBeGreaterThan(-1.5)
    expect(result.profitPercent).toBeLessThan(-1.3)
  })

  it('includes dividends and financing costs in the full strategy result', () => {
    const result = calculateStockSale(1_007, 1_050, 100, STOCK_COMMISSION_RATE, 100_700, {
      marketInvested: 100_000,
      cumulativeDividends: 3_000,
      financingCosts: 4_500,
    })
    expect(result.priceProfit).toBe(5_000)
    expect(result.ownershipProfit).toBe(result.profit + 3_000)
    expect(result.strategyProfit).toBe(result.ownershipProfit - 4_500)
    expect(result.strategyBreakEvenPrice).toBeGreaterThan(result.breakEvenPrice)
  })

  it('gives every stock sector both positive and negative news pressure', () => {
    const sectors = ['Энергетика', 'Технологии', 'Ритейл', 'Финансы', 'Биотех']
    for (const sector of sectors) {
      const impacts = [
        ...marketHeadlines.filter((item) => item.sector === sector).map((item) => item.impact),
        ...globalEvents.filter((item) => item.sector === sector).map((item) => item.stockImpact),
      ]
      expect(impacts.some((value) => value > 0), `${sector} needs positive pressure`).toBe(true)
      expect(impacts.some((value) => value < 0), `${sector} needs negative pressure`).toBe(true)
    }
  })

  it('tracks monthly dividends and stock-loan financing cost', () => {
    let game = startedGame()
    const quote = game.stockMarket[0]
    quote.price = 1_000
    quote.previousPrice = 1_000
    quote.dividendYield = 0.12
    const holding: StockHolding = {
      stockId: quote.id,
      quantity: 10,
      averagePrice: 1_007,
      averageMarketPrice: 1_000,
      costBasis: 10_070,
      marketCostBasis: 10_000,
      purchaseFees: 70,
      pledgedQuantity: 0,
      cumulativeDividends: 0,
      cumulativeFinancingCosts: 0,
    }
    game.players[0].stocks = [holding]
    game.players[0].loans.push({
      id: 'stock-acquisition-loan', name: 'Кредит на акции', balance: 10_000,
      monthlyPayment: 1_000, annualRate: 0.24, termMonths: 12, relatedStockId: quote.id,
    })

    for (let turn = 0; turn < 7; turn += 1) {
      game.phase = 'decision'
      game.pendingDecision = { kind: 'salary' }
      game = executeCommand(game, { type: 'SKIP_DECISION' }).state
    }

    const after = game.players[0].stocks[0]
    expect(after.cumulativeDividends).toBe(100)
    expect(after.cumulativeFinancingCosts).toBe(280)
  })

  it('keeps only proportional dividend and financing history after a partial sale', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'market', title: 'Биржа', description: '' }
    game.stockMarket[0].price = 1_000
    game.players[0].stocks = [{
      stockId: game.stockMarket[0].id,
      quantity: 100,
      averagePrice: 1_007,
      averageMarketPrice: 1_000,
      costBasis: 100_700,
      marketCostBasis: 100_000,
      purchaseFees: 700,
      pledgedQuantity: 0,
      cumulativeDividends: 8_000,
      cumulativeFinancingCosts: 3_000,
    }]

    const sold = executeCommand(game, { type: 'SELL_STOCK', stockId: game.stockMarket[0].id, quantity: 40 })
    expect(sold.accepted).toBe(true)
    expect(sold.state.players[0].stocks[0].quantity).toBe(60)
    expect(sold.state.players[0].stocks[0].cumulativeDividends).toBe(4_800)
    expect(sold.state.players[0].stocks[0].cumulativeFinancingCosts).toBe(1_800)
  })
})
