import { describe, expect, it } from 'vitest'
import { calculateStockSale, STOCK_COMMISSION_RATE, stockPurchaseTotal, stockSaleProceeds } from './stockSale'

describe('stock sale preview', () => {
  it('uses the reduced 0.7% commission on both purchase and sale', () => {
    expect(STOCK_COMMISSION_RATE).toBe(0.007)
    expect(stockPurchaseTotal(1_000, 10)).toBe(10_070)
    expect(stockSaleProceeds(1_000, 10)).toBe(9_930)
  })

  it('shows profit after the 0.7% selling commission', () => {
    const result = calculateStockSale(1_000, 1_200, 10)

    expect(result.invested).toBe(10_000)
    expect(result.grossValue).toBe(12_000)
    expect(result.grossProfit).toBe(2_000)
    expect(result.commission).toBe(84)
    expect(result.proceeds).toBe(11_916)
    expect(result.profit).toBe(1_916)
    expect(result.profitPercent).toBeCloseTo(19.16)
    expect(result.breakEvenPrice).toBe(1_008)
  })

  it('separates the market result from the real result after sale', () => {
    const result = calculateStockSale(1_000, 990, 4)

    expect(result.grossProfit).toBe(-40)
    expect(result.proceeds).toBe(3_932)
    expect(result.profit).toBe(-68)
    expect(result.profitPercent).toBeCloseTo(-1.7)
  })

  it('normalizes invalid quantity and commission inputs', () => {
    const result = calculateStockSale(1_000, 1_200, -3, 2)

    expect(result.quantity).toBe(0)
    expect(result.proceeds).toBe(0)
    expect(result.profit).toBe(0)
  })
})
