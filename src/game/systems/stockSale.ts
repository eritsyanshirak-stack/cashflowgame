export const STOCK_COMMISSION_RATE = 0.007
export const STOCK_MIN_PRICE = 100
export const STOCK_MONTHLY_LOSS_LIMIT = -0.5
export const STOCK_MONTHLY_GAIN_LIMIT = 0.65

export interface StockSaleContext {
  marketInvested?: number
  cumulativeDividends?: number
  financingCosts?: number
}

export interface StockSaleSummary {
  quantity: number
  averagePrice: number
  currentPrice: number
  invested: number
  marketInvested: number
  purchaseCommission: number
  grossValue: number
  priceProfit: number
  grossProfit: number
  preSaleProfit: number
  commission: number
  proceeds: number
  profit: number
  profitPercent: number
  cumulativeDividends: number
  financingCosts: number
  ownershipProfit: number
  ownershipProfitPercent: number
  strategyProfit: number
  strategyProfitPercent: number
  breakEvenPrice: number
  strategyBreakEvenPrice: number
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

export const clampStockPriceForMonth = (
  previousPrice: number,
  proposedPrice: number,
  minimumMove = STOCK_MONTHLY_LOSS_LIMIT,
  maximumMove = STOCK_MONTHLY_GAIN_LIMIT,
) => {
  const start = Math.max(STOCK_MIN_PRICE, Math.round(previousPrice))
  const floor = Math.max(STOCK_MIN_PRICE, Math.round(start * (1 + minimumMove)))
  const ceiling = Math.max(floor, Math.round(start * (1 + maximumMove)))
  return Math.min(ceiling, Math.max(floor, Math.round(proposedPrice)))
}

export const stockMonthlyChangePercent = (previousPrice: number, currentPrice: number) =>
  previousPrice > 0 ? (currentPrice / previousPrice - 1) * 100 : 0

export const calculateStockSale = (
  averagePrice: number,
  currentPrice: number,
  quantity: number,
  commissionRate = STOCK_COMMISSION_RATE,
  investedOverride?: number,
  context: StockSaleContext = {},
): StockSaleSummary => {
  const safeQuantity = Math.max(0, Math.floor(quantity))
  const safeAveragePrice = Math.max(0, averagePrice)
  const safeCurrentPrice = Math.max(0, currentPrice)
  const safeCommissionRate = Math.min(1, Math.max(0, commissionRate))
  const invested = investedOverride === undefined ? Math.round(safeAveragePrice * safeQuantity) : Math.max(0, Math.round(investedOverride))
  const estimatedMarketInvestment = safeCommissionRate < 1
    ? Math.round(invested / (1 + safeCommissionRate))
    : invested
  const marketInvested = Math.max(0, Math.round(context.marketInvested ?? estimatedMarketInvestment))
  const purchaseCommission = Math.max(0, invested - marketInvested)
  const cumulativeDividends = Math.max(0, Math.round(context.cumulativeDividends ?? 0))
  const financingCosts = Math.max(0, Math.round(context.financingCosts ?? 0))
  const grossValue = Math.round(safeCurrentPrice * safeQuantity)
  const proceeds = stockSaleProceeds(safeCurrentPrice, safeQuantity, safeCommissionRate)
  const commission = grossValue - proceeds
  const priceProfit = grossValue - marketInvested
  const grossProfit = grossValue - invested
  const preSaleProfit = grossProfit
  const profit = proceeds - invested
  const profitPercent = invested > 0 ? profit / invested * 100 : 0
  const ownershipProfit = profit + cumulativeDividends
  const ownershipProfitPercent = invested > 0 ? ownershipProfit / invested * 100 : 0
  const strategyProfit = ownershipProfit - financingCosts
  const strategyProfitPercent = invested > 0 ? strategyProfit / invested * 100 : 0
  const exactAverageCost = safeQuantity > 0 ? invested / safeQuantity : safeAveragePrice
  const breakEvenPrice = safeQuantity > 0 && safeCommissionRate < 1
    ? Math.ceil(exactAverageCost / (1 - safeCommissionRate))
    : 0
  const strategyBreakEvenPrice = safeQuantity > 0 && safeCommissionRate < 1
    ? Math.max(0, Math.ceil((invested - cumulativeDividends + financingCosts) / safeQuantity / (1 - safeCommissionRate)))
    : 0

  return {
    quantity: safeQuantity,
    averagePrice: safeAveragePrice,
    currentPrice: safeCurrentPrice,
    invested,
    marketInvested,
    purchaseCommission,
    grossValue,
    priceProfit,
    grossProfit,
    preSaleProfit,
    commission,
    proceeds,
    profit,
    profitPercent,
    cumulativeDividends,
    financingCosts,
    ownershipProfit,
    ownershipProfitPercent,
    strategyProfit,
    strategyProfitPercent,
    breakEvenPrice,
    strategyBreakEvenPrice,
  }
}
