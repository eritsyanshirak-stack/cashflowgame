import { describe, expect, it } from 'vitest'
import { calculateStockSale } from './stockSale'

describe('stock sale preview', () => {
  it('shows profit after the 1.5% selling commission', () => {
    const result = calculateStockSale(1_000, 1_200, 10)

    expect(result.invested).toBe(10_000)
    expect(result.grossValue).toBe(12_000)
    expect(result.commission).toBe(180)
    expect(result.proceeds).toBe(11_820)
    expect(result.profit).toBe(1_820)
    expect(result.profitPercent).toBeCloseTo(18.2)
  })

  it('shows a real loss instead of comparing only market prices', () => {
    const result = calculateStockSale(1_000, 990, 4)

    expect(result.proceeds).toBe(3_900)
    expect(result.profit).toBe(-100)
    expect(result.profitPercent).toBeCloseTo(-2.5)
  })

  it('normalizes invalid quantity and commission inputs', () => {
    const result = calculateStockSale(1_000, 1_200, -3, 2)

    expect(result.quantity).toBe(0)
    expect(result.proceeds).toBe(0)
    expect(result.profit).toBe(0)
  })
})
