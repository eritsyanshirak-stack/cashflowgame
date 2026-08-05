export const STOCK_COMMISSION_RATE = 0.007

export interface StockSaleSummary {
  quantity: number
  averagePrice: number
  currentPrice: number
  invested: number
  grossValue: number
  grossProfit: number
  commission: number
  proceeds: number
  profit: number
  profitPercent: number
  breakEvenPrice: number
}

export const stockPurchaseTotal = (
  price: number,
  quantity: number,
  commissionRate = STOCK_COMMISSION_RATE,
) => Math.ceil(Math.max(0, price) * Math.max(0, Math.floor(quantity)) * (1 + Math.max(0, commissionRate)))

export const stockSaleProceeds = (
  price: number,
  quantity: number,
  commissionRate = STOCK_COMMISSION_RATE,
) => Math.floor(Math.max(0, price) * Math.max(0, Math.floor(quantity)) * (1 - Math.min(1, Math.max(0, commissionRate))))

export const calculateStockSale = (
  averagePrice: number,
  currentPrice: number,
  quantity: number,
  commissionRate = STOCK_COMMISSION_RATE,
  investedOverride?: number,
): StockSaleSummary => {
  const safeQuantity = Math.max(0, Math.floor(quantity))
  const safeAveragePrice = Math.max(0, averagePrice)
  const safeCurrentPrice = Math.max(0, currentPrice)
  const safeCommissionRate = Math.min(1, Math.max(0, commissionRate))
  const invested = investedOverride === undefined ? Math.round(safeAveragePrice * safeQuantity) : Math.max(0, Math.round(investedOverride))
  const grossValue = Math.round(safeCurrentPrice * safeQuantity)
  const proceeds = stockSaleProceeds(safeCurrentPrice, safeQuantity, safeCommissionRate)
  const commission = grossValue - proceeds
  const grossProfit = grossValue - invested
  const profit = proceeds - invested
  const profitPercent = invested > 0 ? profit / invested * 100 : 0
  const exactAverageCost = safeQuantity > 0 ? invested / safeQuantity : safeAveragePrice
  const breakEvenPrice = safeQuantity > 0 && safeCommissionRate < 1
    ? Math.ceil(exactAverageCost / (1 - safeCommissionRate))
    : 0

  return {
    quantity: safeQuantity,
    averagePrice: safeAveragePrice,
    currentPrice: safeCurrentPrice,
    invested,
    grossValue,
    grossProfit,
    commission,
    proceeds,
    profit,
    profitPercent,
    breakEvenPrice,
  }
}
