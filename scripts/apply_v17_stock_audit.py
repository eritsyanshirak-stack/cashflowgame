from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


# Types: link acquisition loans to stocks and keep ownership history.
replace_once(
    "src/game/domain/types.ts",
    "  relatedAssetId?: string\n  missedPayments?: number\n}",
    "  relatedAssetId?: string\n  relatedStockId?: string\n  missedPayments?: number\n}",
)
replace_once(
    "src/game/domain/types.ts",
    "  purchaseFees?: number\n  pledgedQuantity?: number\n}",
    "  purchaseFees?: number\n  pledgedQuantity?: number\n  cumulativeDividends?: number\n  cumulativeFinancingCosts?: number\n}",
)

# Replace stock math with explicit price, fee, dividend and financing layers.
Path("src/game/systems/stockSale.ts").write_text(r'''export const STOCK_COMMISSION_RATE = 0.007
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
''')

# Engine imports and save version.
replace_once(
    "src/game/engine/engine.ts",
    "import { STOCK_COMMISSION_RATE, stockPurchaseTotal, stockSaleProceeds } from '../systems/stockSale'",
    "import { clampStockPriceForMonth, STOCK_COMMISSION_RATE, STOCK_MIN_PRICE, stockPurchaseTotal, stockSaleProceeds } from '../systems/stockSale'",
)
replace_once("src/game/engine/engine.ts", "  version: 11,", "  version: 12,")

# Price movement: preserve the start-of-month price and cap the final combined move.
replace_once(
    "src/game/engine/engine.ts",
    "    quote.price = Math.max(500, Math.round(quote.price * (1 + move)))",
    "    quote.price = Math.max(STOCK_MIN_PRICE, Math.round(quote.price * (1 + move)))",
)
replace_once(
    "src/game/engine/engine.ts",
    "    quote.previousPrice = quote.price\n    quote.price = Math.max(500, Math.round(quote.price * (1 + move)))",
    "    quote.price = Math.max(STOCK_MIN_PRICE, Math.round(quote.price * (1 + move)))",
)
replace_once(
    "src/game/engine/engine.ts",
    "const settleResales = (state: GameState, player: Player, nextMonth: number) => {",
    "const clampFinalStockMoves = (state: GameState) => {\n  for (const quote of state.stockMarket) {\n    quote.price = clampStockPriceForMonth(quote.previousPrice, quote.price)\n  }\n}\n\nconst settleResales = (state: GameState, player: Player, nextMonth: number) => {",
)

# Track dividends and the interest-like financing cost attached to stock acquisition loans.
replace_once(
    "src/game/engine/engine.ts",
    "const settleMonth = (state: GameState) => {",
    "const recordMonthlyStockReturns = (player: Player, market: GameState['stockMarket']) => {\n  for (const holding of player.stocks) {\n    const quote = market.find((item) => item.id === holding.stockId)\n    if (!quote) continue\n    const dividend = Math.round(holding.quantity * quote.price * quote.dividendYield / 12)\n    holding.cumulativeDividends = Math.max(0, Math.round((holding.cumulativeDividends ?? 0) + dividend))\n  }\n  for (const loan of player.loans) {\n    if (!loan.relatedStockId || loan.balance <= 0) continue\n    const holding = player.stocks.find((item) => item.stockId === loan.relatedStockId)\n    if (!holding) continue\n    const principalReduction = Math.min(loan.balance, Math.round(loan.monthlyPayment * 0.72))\n    const financingCost = Math.max(0, loan.monthlyPayment - principalReduction)\n    holding.cumulativeFinancingCosts = Math.max(0, Math.round((holding.cumulativeFinancingCosts ?? 0) + financingCost))\n  }\n}\n\nconst settleMonth = (state: GameState) => {",
)
replace_once(
    "src/game/engine/engine.ts",
    "  state.players.forEach((player) => { if (player.status === 'active') recordMonthlyAssetReturns(player) })\n  const humanReport",
    "  state.players.forEach((player) => { if (player.status === 'active') recordMonthlyAssetReturns(player) })\n  state.players.forEach((player) => { if (player.status === 'active') recordMonthlyStockReturns(player, state.stockMarket) })\n  const humanReport",
)
replace_once(
    "src/game/engine/engine.ts",
    "  updateGlobalEvent(state, () => random(state))\n  processAssetListings",
    "  updateGlobalEvent(state, () => random(state))\n  clampFinalStockMoves(state)\n  processAssetListings",
)

# Link loans used to buy shares to the relevant position.
replace_once(
    "src/game/engine/engine.ts",
    "collateralAssetId: collateral?.id, missedPayments: 0 })",
    "collateralAssetId: collateral?.id, relatedStockId: quote.id, missedPayments: 0 })",
)

# New holdings start with explicit history fields.
replace_once(
    "src/game/engine/engine.ts",
    "        purchaseFees: purchaseFee,\n        pledgedQuantity: 0,",
    "        purchaseFees: purchaseFee,\n        pledgedQuantity: 0,\n        cumulativeDividends: 0,\n        cumulativeFinancingCosts: 0,",
)

# Partial sales retain only the proportional history belonging to the remaining shares.
replace_once(
    "src/game/engine/engine.ts",
    "      holding.purchaseFees = Math.max(0, holding.costBasis - holding.marketCostBasis)\n      if (holding.quantity === 0)",
    "      holding.purchaseFees = Math.max(0, holding.costBasis - holding.marketCostBasis)\n      const remainingRatio = holding.quantity / quantityBeforeSale\n      holding.cumulativeDividends = Math.max(0, Math.round((holding.cumulativeDividends ?? 0) * remainingRatio))\n      holding.cumulativeFinancingCosts = Math.max(0, Math.round((holding.cumulativeFinancingCosts ?? 0) * remainingRatio))\n      if (holding.quantity === 0)",
)

# Global stock events use the same lower price floor.
replace_once(
    "src/game/systems/v14.ts",
    "import { assetMarketValue, loanPayment } from './economy'",
    "import { assetMarketValue, loanPayment } from './economy'\nimport { STOCK_MIN_PRICE } from './stockSale'",
)
replace_once(
    "src/game/systems/v14.ts",
    "quote.price = Math.max(500, Math.round(quote.price * (1 + selected.stockImpact)))",
    "quote.price = Math.max(STOCK_MIN_PRICE, Math.round(quote.price * (1 + selected.stockImpact)))",
)

# Add missing opposite global events so no sector has a one-way structural advantage.
replace_once(
    "src/game/content/content.ts",
    "  { id: 'energy-shock', title: 'Энергетический шок', description: 'Энергетика резко меняется, а расходы бизнеса растут.', category: 'Производство', sector: 'Энергетика', revenueMultiplier: 0.86, stockImpact: -0.34, creditRateDelta: 0.01, duration: 2 },\n] as const",
    "  { id: 'energy-shock', title: 'Энергетический шок', description: 'Энергетика резко меняется, а расходы бизнеса растут.', category: 'Производство', sector: 'Энергетика', revenueMultiplier: 0.86, stockImpact: -0.34, creditRateDelta: 0.01, duration: 2 },\n  { id: 'energy-recovery', title: 'Энергетический рынок восстановился', description: 'Экспорт и цены поддержали энергетические компании.', category: 'Производство', sector: 'Энергетика', revenueMultiplier: 1.08, stockImpact: 0.28, creditRateDelta: 0, duration: 2 },\n  { id: 'tech-correction', title: 'Коррекция технологического сектора', description: 'Инвесторы фиксируют прибыль после сильного роста.', category: 'IT', sector: 'Технологии', revenueMultiplier: 0.94, stockImpact: -0.24, creditRateDelta: 0, duration: 2 },\n  { id: 'biotech-breakthrough', title: 'Прорыв в биотехнологиях', description: 'Успешные испытания резко повышают интерес к сектору.', category: 'Медицина', sector: 'Биотех', revenueMultiplier: 1.1, stockImpact: 0.24, creditRateDelta: 0, duration: 2 },\n  { id: 'biotech-regulation', title: 'Ужесточение правил для биотеха', description: 'Новые требования задерживают запуск препаратов.', category: 'Медицина', sector: 'Биотех', revenueMultiplier: 0.92, stockImpact: -0.24, creditRateDelta: 0, duration: 2 },\n] as const",
)

# UI: compute exact price-only, ownership and financed strategy results.
replace_once(
    "src/V14UI.tsx",
    "import { calculateStockSale, STOCK_COMMISSION_RATE, stockPurchaseTotal } from './game/systems/stockSale'",
    "import { calculateStockSale, STOCK_COMMISSION_RATE, stockMonthlyChangePercent, stockPurchaseTotal } from './game/systems/stockSale'",
)
replace_once(
    "src/V14UI.tsx",
    "      const change = quote.previousPrice ? (quote.price / quote.previousPrice - 1) * 100 : 0",
    "      const change = stockMonthlyChangePercent(quote.previousPrice, quote.price)",
)
replace_once(
    "src/V14UI.tsx",
    "      const freeCostBasis = holding && holding.quantity > 0 ? Math.round(totalCostBasis * free / holding.quantity) : 0\n      const result = holding ? calculateStockSale(holding.averagePrice, quote.price, free, STOCK_COMMISSION_RATE, freeCostBasis) : null\n      const entryMarketPrice",
    "      const freeCostBasis = holding && holding.quantity > 0 ? Math.round(totalCostBasis * free / holding.quantity) : 0\n      const totalMarketCostBasis = holding ? (holding.marketCostBasis ?? (holding.averageMarketPrice ?? Math.round(holding.averagePrice / (1 + STOCK_COMMISSION_RATE))) * holding.quantity) : 0\n      const freeMarketCostBasis = holding && holding.quantity > 0 ? Math.round(totalMarketCostBasis * free / holding.quantity) : 0\n      const freeDividends = holding && holding.quantity > 0 ? Math.round((holding.cumulativeDividends ?? 0) * free / holding.quantity) : 0\n      const freeFinancingCosts = holding && holding.quantity > 0 ? Math.round((holding.cumulativeFinancingCosts ?? 0) * free / holding.quantity) : 0\n      const result = holding ? calculateStockSale(holding.averagePrice, quote.price, free, STOCK_COMMISSION_RATE, freeCostBasis, { marketInvested: freeMarketCostBasis, cumulativeDividends: freeDividends, financingCosts: freeFinancingCosts }) : null\n      const entryMarketPrice",
)
replace_once(
    "src/V14UI.tsx",
    "          <div className=\"v16-stock-result\">\n            <div><small>СЕЙЧАС БЕЗ ПРОДАЖИ</small><b>{money(result?.grossValue ?? 0)}</b><span className={(result?.grossProfit ?? 0) >= 0 ? 'good' : 'bad'}>Курс дал {(result?.grossProfit ?? 0) >= 0 ? '+' : ''}{money(result?.grossProfit ?? 0)}</span></div>\n            <div><small>ЕСЛИ ПРОДАТЬ СЕЙЧАС</small><b>{money(result?.proceeds ?? 0)}</b><span>Комиссия −{money(result?.commission ?? 0)}</span></div>\n          </div>\n          <div className={(result?.profit ?? 0) >= 0 ? 'v14-info' : 'v14-warning'}>\n            <b>Твой итог после продажи: {(result?.profit ?? 0) >= 0 ? '+' : ''}{money(result?.profit ?? 0)} · {percent(result?.profitPercent ?? 0)}</b>\n            <span>Цена безубыточности — {money(result?.breakEvenPrice ?? 0)}/шт. Всё выше неё уже даёт плюс после комиссии.</span>\n          </div>",
    "          <div className=\"v16-stock-result\">\n            <div><small>ИЗМЕНЕНИЕ ЦЕНЫ</small><b className={(result?.priceProfit ?? 0) >= 0 ? 'good' : 'bad'}>{(result?.priceProfit ?? 0) >= 0 ? '+' : ''}{money(result?.priceProfit ?? 0)}</b><span>Без торговых комиссий</span></div>\n            <div><small>ДО ПРОДАЖИ</small><b className={(result?.preSaleProfit ?? 0) >= 0 ? 'good' : 'bad'}>{(result?.preSaleProfit ?? 0) >= 0 ? '+' : ''}{money(result?.preSaleProfit ?? 0)}</b><span>После комиссии покупки −{money(result?.purchaseCommission ?? 0)}</span></div>\n            <div><small>ЕСЛИ ПРОДАТЬ СЕЙЧАС</small><b>{money(result?.proceeds ?? 0)}</b><span>Комиссия продажи −{money(result?.commission ?? 0)}</span></div>\n          </div>\n          <div className={(result?.ownershipProfit ?? 0) >= 0 ? 'v14-info' : 'v14-warning'}>\n            <b>Результат акций: {(result?.ownershipProfit ?? 0) >= 0 ? '+' : ''}{money(result?.ownershipProfit ?? 0)} · {percent(result?.ownershipProfitPercent ?? 0)}</b>\n            <span>После обеих комиссий и с дивидендами +{money(result?.cumulativeDividends ?? 0)}.</span>\n          </div>\n          {(result?.financingCosts ?? 0) > 0 && <div className={(result?.strategyProfit ?? 0) >= 0 ? 'v14-info' : 'v14-warning'}>\n            <b>Итог стратегии с кредитом: {(result?.strategyProfit ?? 0) >= 0 ? '+' : ''}{money(result?.strategyProfit ?? 0)} · {percent(result?.strategyProfitPercent ?? 0)}</b>\n            <span>Стоимость финансирования за время владения −{money(result?.financingCosts ?? 0)}.</span>\n          </div>}\n          <div className=\"v16-return-note\">Точка безубыточности стратегии — {money(result?.strategyBreakEvenPrice ?? result?.breakEvenPrice ?? 0)}/шт. Она учитывает комиссии, полученные дивиденды и стоимость кредита.</div>",
)

# Tests for the audit findings.
Path("src/game/engine/v17-stock-audit.test.ts").write_text(r'''import { describe, expect, it } from 'vitest'
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
''')
