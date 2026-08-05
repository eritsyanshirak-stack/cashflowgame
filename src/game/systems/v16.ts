import type { Asset, BusinessTemplate, Player } from '../domain/types'
import { assetLiquidationProceeds, assetMarketValue, loanPayment, pledgedLoanForAsset } from './economy'

export interface PartnershipTerms {
  dealPrice: number
  financedLoan: number
  totalDownPayment: number
  partnerShare: 0.3 | 0.5
  playerOwnership: number
  playerCashNeeded: number
  partnerCashContribution: number
  playerLoan: number
  playerMonthlyPayment: number
  projectedPlayerFlow: number
}

export const calculatePartnershipTerms = (
  business: BusinessTemplate,
  discount: number,
  partnerShare: 0.3 | 0.5,
): PartnershipTerms => {
  const dealPrice = Math.round(business.price * discount)
  const financedLoan = Math.min(dealPrice, Math.round(business.loan * (dealPrice / business.price)))
  const totalDownPayment = Math.max(0, dealPrice - financedLoan)
  const playerOwnership = 1 - partnerShare
  const playerCashNeeded = Math.round(totalDownPayment * playerOwnership)
  const partnerCashContribution = totalDownPayment - playerCashNeeded
  const playerLoan = Math.round(financedLoan * playerOwnership)
  const playerMonthlyPayment = loanPayment(playerLoan, business.loanRate, business.loanTermMonths)
  const projectedPlayerFlow = Math.round((business.revenue - business.operatingCosts) * playerOwnership) - playerMonthlyPayment

  return {
    dealPrice,
    financedLoan,
    totalDownPayment,
    partnerShare,
    playerOwnership,
    playerCashNeeded,
    partnerCashContribution,
    playerLoan,
    playerMonthlyPayment,
    projectedPlayerFlow,
  }
}

export const assetInvestmentBasis = (asset: Asset) =>
  Math.max(0, Math.round(asset.cashInvested ?? asset.downPayment + asset.totalDevelopmentCost))

export interface AssetSaleSummary {
  invested: number
  marketValue: number
  securedDebt: number
  relatedAcquisitionDebt: number
  marketProceeds: number
  marketProfit: number
  marketProfitPercent: number
  quickPrice: number
  quickProceeds: number
  quickProfit: number
  quickProfitPercent: number
  breakEvenGrossPrice: number
}

export const calculateAssetSaleSummary = (player: Player, asset: Asset): AssetSaleSummary => {
  const invested = assetInvestmentBasis(asset)
  const marketValue = assetMarketValue(asset)
  const collateralDebt = pledgedLoanForAsset(player, asset.id)?.balance ?? 0
  const securedDebt = asset.loan + collateralDebt
  const relatedAcquisitionDebt = player.loans.filter((loan) => loan.relatedAssetId === asset.id).reduce((sum, loan) => sum + loan.balance, 0)
  const marketProceeds = assetLiquidationProceeds(player, asset, marketValue)
  const quickPrice = Math.round(marketValue * 0.93)
  const quickProceeds = assetLiquidationProceeds(player, asset, quickPrice)
  const marketProfit = marketProceeds - invested - relatedAcquisitionDebt
  const quickProfit = quickProceeds - invested - relatedAcquisitionDebt
  return {
    invested,
    marketValue,
    securedDebt,
    relatedAcquisitionDebt,
    marketProceeds,
    marketProfit,
    marketProfitPercent: invested > 0 ? marketProfit / invested * 100 : 0,
    quickPrice,
    quickProceeds,
    quickProfit,
    quickProfitPercent: invested > 0 ? quickProfit / invested * 100 : 0,
    breakEvenGrossPrice: invested + securedDebt + relatedAcquisitionDebt,
  }
}

export const reduceAssetInvestmentBasis = (asset: Asset, soldRatio: number) => {
  const ratio = Math.max(0, Math.min(1, soldRatio))
  asset.cashInvested = Math.max(0, Math.round(assetInvestmentBasis(asset) * (1 - ratio)))
}
