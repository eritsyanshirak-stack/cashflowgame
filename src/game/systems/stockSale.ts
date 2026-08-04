export interface StockSaleSummary {
  quantity: number
  averagePrice: number
  currentPrice: number
  invested: number
  grossValue: number
  commission: number
  proceeds: number
  profit: number
  profitPercent: number
}

export const calculateStockSale = (
  averagePrice: number,
  currentPrice: number,
  quantity: number,
  commissionRate = 0.015,
): StockSaleSummary => {
  const safeQuantity = Math.max(0, Math.floor(quantity))
  const safeAveragePrice = Math.max(0, averagePrice)
  const safeCurrentPrice = Math.max(0, currentPrice)
  const safeCommissionRate = Math.min(1, Math.max(0, commissionRate))
  const invested = Math.round(safeAveragePrice * safeQuantity)
  const grossValue = Math.round(safeCurrentPrice * safeQuantity)
  const proceeds = Math.floor(grossValue * (1 - safeCommissionRate))
  const commission = grossValue - proceeds
  const profit = proceeds - invested
  const profitPercent = invested > 0 ? profit / invested * 100 : 0

  return {
    quantity: safeQuantity,
    averagePrice: safeAveragePrice,
    currentPrice: safeCurrentPrice,
    invested,
    grossValue,
    commission,
    proceeds,
    profit,
    profitPercent,
  }
}
