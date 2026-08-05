import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import type { Asset } from '../domain/types'
import { assetMarketValue, loanPayment } from '../systems/economy'
import { calculateStockSale, STOCK_COMMISSION_RATE, stockPurchaseTotal, stockSaleProceeds } from '../systems/stockSale'
import { assetInvestmentBasis, calculateAssetSaleSummary, calculatePartnershipTerms } from '../systems/v16'
import { emptyGame, executeCommand } from './engine'

const startedGame = () => executeCommand(emptyGame(160), {
  type: 'START_GAME', professionId: 'trainer', botCount: 1, difficulty: 'easy', seed: 160,
}).state

const testAsset = (): Asset => {
  const business = businesses.find((item) => item.id === 'coffee')!
  return {
    ...business,
    id: 'coffee-owned',
    ownerId: 'human',
    ownership: 1,
    monthlyPayment: loanPayment(business.loan, business.loanRate, business.loanTermMonths),
    purchaseMonth: 1,
    developmentLevel: 0,
    developments: [],
    totalDevelopmentCost: 0,
    lastDevelopedMonth: null,
    saleOffer: null,
    offerExpiresMonth: null,
    status: 'active',
    marketValue: 650_000,
    purchaseCashContribution: 150_000,
    cashInvested: 185_000,
  }
}

describe('Balance v1.6 clarity and partnership', () => {
  it('shows exact cash, debt and flow for each partnership split', () => {
    const business = businesses.find((item) => item.id === 'coffee')!
    const terms = calculatePartnershipTerms(business, 0.9, 0.3)

    expect(terms.dealPrice).toBe(432_000)
    expect(terms.financedLoan).toBe(297_000)
    expect(terms.totalDownPayment).toBe(135_000)
    expect(terms.playerCashNeeded).toBe(94_500)
    expect(terms.partnerCashContribution).toBe(40_500)
    expect(terms.playerLoan).toBe(207_900)
    expect(terms.playerMonthlyPayment).toBe(loanPayment(207_900, business.loanRate, business.loanTermMonths))
  })

  it('allows one light partnership negotiation without risking the original deal', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.difficulty = 'easy'
    game.players[0].cash = 300_000
    game.players[0].skills.negotiation = 200
    game.players[0].specialization = 'negotiator'
    game.pendingDecision = {
      kind: 'partnership', businessId: 'coffee', title: 'Кофейный островок',
      description: 'Тест', discount: 0.9, originalDiscount: 0.9,
      partnerName: 'Марина', negotiated: false,
    }

    const negotiated = executeCommand(game, { type: 'NEGOTIATE_PARTNERSHIP', request: 'small' })
    expect(negotiated.accepted).toBe(true)
    expect(negotiated.state.pendingDecision?.kind).toBe('partnership')
    if (negotiated.state.pendingDecision?.kind !== 'partnership') throw new Error('partnership disappeared')
    expect(negotiated.state.pendingDecision.negotiated).toBe(true)
    expect(negotiated.state.pendingDecision.negotiationSucceeded).toBe(true)
    expect(negotiated.state.pendingDecision.discount).toBe(0.87)

    const business = businesses.find((item) => item.id === 'coffee')!
    const terms = calculatePartnershipTerms(business, 0.87, 0.3)
    const cashBefore = negotiated.state.players[0].cash
    const accepted = executeCommand(negotiated.state, { type: 'ACCEPT_PARTNERSHIP', ownership: 0.3 })

    expect(accepted.accepted).toBe(true)
    expect(accepted.state.players[0].cash).toBe(cashBefore - terms.playerCashNeeded)
    expect(accepted.state.players[0].assets[0].ownership).toBe(0.7)
    expect(accepted.state.players[0].assets[0].purchaseCashContribution).toBe(terms.playerCashNeeded)
    expect(accepted.state.players[0].assets[0].cashInvested).toBe(terms.playerCashNeeded)
  })

  it('tracks own cash in a business and adds development spending', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.players[0].cash = 150_000
    game.pendingDecision = {
      kind: 'business', businessId: 'vending', askingPrice: 90_000,
      originalAskingPrice: 90_000, negotiated: false, inspection: 'none', hiddenIssue: 'none', issueRevealed: false,
    }

    const bought = executeCommand(game, { type: 'BUY_BUSINESS', funding: 'cash' })
    expect(bought.accepted).toBe(true)
    const assetBefore = bought.state.players[0].assets[0]
    expect(assetInvestmentBasis(assetBefore)).toBe(90_000)

    const developed = executeCommand(bought.state, { type: 'DEVELOP_ASSET', assetId: assetBefore.id, developmentId: 'marketing' })
    expect(developed.accepted).toBe(true)
    const assetAfter = developed.state.players[0].assets[0]
    expect(assetInvestmentBasis(assetAfter)).toBe(90_000 + assetAfter.totalDevelopmentCost)
  })

  it('compares market and urgent business sale against own invested cash', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = testAsset()
    player.assets = [asset]
    const summary = calculateAssetSaleSummary(player, asset)

    expect(summary.invested).toBe(185_000)
    expect(summary.marketValue).toBe(assetMarketValue(asset))
    expect(summary.marketProceeds).toBe(320_000)
    expect(summary.marketProfit).toBe(135_000)
    expect(summary.quickPrice).toBe(Math.round(650_000 * 0.93))
    expect(summary.breakEvenGrossPrice).toBe(515_000)
  })

  it('subtracts the remaining acquisition loan from the real sale result', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = testAsset()
    player.assets = [asset]
    player.loans = [{
      id: 'acquisition-loan',
      name: 'Кредит на первый взнос',
      balance: 70_000,
      monthlyPayment: 5_000,
      annualRate: 0.24,
      termMonths: 24,
      relatedAssetId: asset.id,
    }]

    const summary = calculateAssetSaleSummary(player, asset)
    expect(summary.relatedAcquisitionDebt).toBe(70_000)
    expect(summary.marketProfit).toBe(65_000)
    expect(summary.breakEvenGrossPrice).toBe(585_000)
  })

  it('keeps an exact stock cost basis for a large position', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'market', title: 'Биржа', description: '' }
    game.players[0].cash = 500_000
    const quote = game.stockMarket[0]
    quote.price = 1_888
    quote.previousPrice = 1_693

    const bought = executeCommand(game, { type: 'BUY_STOCK', stockId: quote.id, quantity: 152 })
    expect(bought.accepted).toBe(true)
    const holding = bought.state.players[0].stocks[0]
    const exactCost = stockPurchaseTotal(1_888, 152)
    expect(holding.costBasis).toBe(exactCost)
    expect(holding.marketCostBasis).toBe(1_888 * 152)
    expect(holding.purchaseFees).toBe(exactCost - 1_888 * 152)

    const result = calculateStockSale(holding.averagePrice, 1_888, 152, STOCK_COMMISSION_RATE, holding.costBasis)
    expect(result.proceeds).toBe(stockSaleProceeds(1_888, 152))
    expect(result.profit).toBe(result.proceeds - exactCost)
    expect(result.profitPercent).toBeGreaterThan(-1.5)
    expect(result.profitPercent).toBeLessThan(-1.3)
  })

  it('preserves the remaining exact basis after a partial stock sale', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'market', title: 'Биржа', description: '' }
    game.players[0].cash = 500_000
    const quote = game.stockMarket[0]
    quote.price = 1_888

    const bought = executeCommand(game, { type: 'BUY_STOCK', stockId: quote.id, quantity: 152 })
    const originalBasis = bought.state.players[0].stocks[0].costBasis!
    const sold = executeCommand(bought.state, { type: 'SELL_STOCK', stockId: quote.id, quantity: 76 })

    expect(sold.accepted).toBe(true)
    expect(sold.state.players[0].stocks[0].quantity).toBe(76)
    expect(sold.state.players[0].stocks[0].costBasis).toBe(originalBasis - Math.round(originalBasis / 2))
  })
})
