import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import type { Asset, DealProfile } from '../domain/types'
import { assetCashflow, assetMarketValue, loanPayment } from '../systems/economy'
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
    expect(accepted.state.players[0].assets[0].partnerName).toBe('Марина')
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

  it('keeps the unique deal profile and negotiated seller protection after purchase', () => {
    const game = startedGame()
    const profile: DealProfile = {
      id: 'profile-audit',
      location: 'У метро',
      leaseMonths: 18,
      equipmentCondition: 'fair',
      equipmentLabel: 'Рабочее оборудование',
      ownerDependency: 'medium',
      ownerDependencyLabel: 'Часть клиентов держится на владельце',
      customerRating: 4.6,
      sellerReason: 'Переезд',
      revenueMultiplier: 1.18,
      costMultiplier: 0.91,
      valueMultiplier: 1.05,
      declaredRevenue: 52_000,
      declaredCosts: 31_000,
    }
    game.phase = 'decision'
    game.players[0].cash = 1_000_000
    game.pendingDecision = {
      kind: 'business', businessId: 'coffee', askingPrice: 480_000,
      originalAskingPrice: 480_000, negotiated: true, inspection: 'full', hiddenIssue: 'none', issueRevealed: true,
      profile, revealedFacts: [], sellerTerm: 'warranty',
    }

    const bought = executeCommand(game, { type: 'BUY_BUSINESS', funding: 'cash' })
    expect(bought.accepted).toBe(true)
    const asset = bought.state.players[0].assets[0]
    expect(asset.dealProfile?.id).toBe(profile.id)
    expect(asset.warrantyUntilMonth).toBe(asset.purchaseMonth + 3)
    expect(asset.revenue).not.toBe(businesses.find((item) => item.id === 'coffee')!.revenue)
  })

  it('keeps the unique profile for a rare opportunity too', () => {
    const game = startedGame()
    const profile: DealProfile = {
      id: 'rare-profile-audit',
      location: 'Спальный район',
      leaseMonths: 12,
      equipmentCondition: 'good',
      equipmentLabel: 'Хорошее состояние',
      ownerDependency: 'low',
      ownerDependencyLabel: 'Команда работает самостоятельно',
      customerRating: 4.4,
      sellerReason: 'Смена направления',
      revenueMultiplier: 0.96,
      costMultiplier: 1.08,
      valueMultiplier: 0.92,
      declaredRevenue: 48_000,
      declaredCosts: 32_000,
    }
    game.phase = 'decision'
    game.players[0].cash = 1_000_000
    game.pendingDecision = {
      kind: 'opportunity', opportunityId: 'distressed-coffee', businessId: 'coffee',
      askingPrice: 326_000, originalAskingPrice: 326_000, title: 'Кофейня ниже рынка', description: 'Тест',
      inspection: 'full', hiddenIssue: 'none', issueRevealed: true, profile, revealedFacts: [], sellerTerm: 'transition',
    }

    const bought = executeCommand(game, { type: 'BUY_OPPORTUNITY', funding: 'cash' })
    expect(bought.accepted).toBe(true)
    const asset = bought.state.players[0].assets[0]
    expect(asset.dealProfile?.id).toBe(profile.id)
    expect(asset.transitionSupportUntilMonth).toBe(asset.purchaseMonth + 2)
  })

  it('does not double-count development for assets without the new investment fields', () => {
    const game = startedGame()
    const asset = testAsset()
    delete asset.cashInvested
    delete asset.lifetimeCashInvested
    asset.totalDevelopmentCost = 10_000
    game.players[0].assets = [asset]
    game.players[0].cash = 1_000_000
    game.phase = 'ready'
    const before = asset.downPayment + asset.totalDevelopmentCost

    const developed = executeCommand(game, { type: 'DEVELOP_ASSET', assetId: asset.id, developmentId: 'marketing' })
    expect(developed.accepted).toBe(true)
    const after = developed.state.players[0].assets[0]
    expect(assetInvestmentBasis(after)).toBe(before + (after.totalDevelopmentCost - 10_000))
    expect(after.lifetimeCashInvested).toBe(assetInvestmentBasis(after))
  })

  it('includes prior net cashflow in the total ownership result but shows sale-only result separately', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = testAsset()
    asset.cumulativeNetCashflow = 50_000
    player.assets = [asset]

    const summary = calculateAssetSaleSummary(player, asset)
    expect(summary.marketPositionProfit).toBe(135_000)
    expect(summary.marketProfit).toBe(185_000)
    expect(summary.cumulativeNetCashflow).toBe(50_000)
  })

  it('treats an underwater sale deficiency as debt, not as free disappearance', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = testAsset()
    asset.marketValue = 300_000
    asset.loan = 400_000
    asset.cashInvested = 100_000
    asset.lifetimeCashInvested = 100_000
    player.assets = [asset]

    const summary = calculateAssetSaleSummary(player, asset)
    expect(summary.marketProceeds).toBe(0)
    expect(summary.marketDeficiency).toBe(100_000)
    expect(summary.marketPositionProfit).toBe(-200_000)
    expect(summary.marketProfit).toBe(-200_000)
  })

  it('records the asset net cashflow each closed month including its acquisition-loan payment', () => {
    let game = startedGame()
    const player = game.players[0]
    const asset = testAsset()
    asset.insuredUntilMonth = 99
    asset.cumulativeNetCashflow = 0
    player.assets = [asset]
    player.loans = [{
      id: 'related-loan', name: 'Кредит на взнос', balance: 60_000, monthlyPayment: 5_000,
      annualRate: 0.2, termMonths: 24, relatedAssetId: asset.id,
    }]
    const expected = assetCashflow(asset) - 5_000

    for (let turn = 0; turn < 7; turn += 1) {
      game.phase = 'decision'
      game.pendingDecision = { kind: 'salary' }
      game = executeCommand(game, { type: 'SKIP_DECISION' }).state
    }

    expect(game.month).toBe(2)
    expect(game.players[0].assets[0].cumulativeNetCashflow).toBe(expected)
  })

})
