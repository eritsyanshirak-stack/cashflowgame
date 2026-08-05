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

/** Cost basis that still belongs to the player's current ownership share. */
export const assetInvestmentBasis = (asset: Asset) =>
  Math.max(0, Math.round(asset.cashInvested ?? asset.downPayment + asset.totalDevelopmentCost))

/** All of the player's own cash ever put into the asset, including later improvements and problem resolution. */
export const assetLifetimeInvestment = (asset: Asset) =>
  Math.max(0, Math.round(asset.lifetimeCashInvested ?? assetInvestmentBasis(asset)))

export const addAssetInvestment = (asset: Asset, amount: number) => {
  const safeAmount = Math.max(0, Math.round(amount))
  if (safeAmount === 0) return
  const currentBasis = assetInvestmentBasis(asset)
  const lifetimeBasis = assetLifetimeInvestment(asset)
  asset.cashInvested = currentBasis + safeAmount
  asset.lifetimeCashInvested = lifetimeBasis + safeAmount
}

export const recordAssetCashReturn = (asset: Asset, amount: number) => {
  asset.lifetimeCashInvested ??= assetLifetimeInvestment(asset)
  asset.cashReturned = Math.max(0, Math.round((asset.cashReturned ?? 0) + Math.max(0, amount)))
}

export const recordAssetNetCashflow = (asset: Asset, amount: number) => {
  asset.cumulativeNetCashflow = Math.round((asset.cumulativeNetCashflow ?? 0) + amount)
}

export interface AssetExitResult {
  grossPrice: number
  proceeds: number
  deficiency: number
  netSaleValue: number
  positionProfit: number
  totalProfit: number
  totalProfitPercent: number
}

export const calculateAssetExitResult = (player: Player, asset: Asset, grossPrice: number): AssetExitResult => {
  const safeGrossPrice = Math.max(0, Math.round(grossPrice))
  const invested = assetInvestmentBasis(asset)
  const lifetimeInvested = assetLifetimeInvestment(asset)
  const cashReturned = Math.round(asset.cashReturned ?? 0)
  const cumulativeNetCashflow = Math.round(asset.cumulativeNetCashflow ?? 0)
  const collateralDebt = pledgedLoanForAsset(player, asset.id)?.balance ?? 0
  const securedDebt = asset.loan + collateralDebt
  const relatedAcquisitionDebt = player.loans
    .filter((loan) => loan.relatedAssetId === asset.id)
    .reduce((sum, loan) => sum + loan.balance, 0)
  const proceeds = assetLiquidationProceeds(player, asset, safeGrossPrice)
  const deficiency = Math.max(0, securedDebt - safeGrossPrice)
  // Economic value of the exit. A deficiency is not free: it remains as a new loan after the sale.
  const netSaleValue = proceeds - deficiency
  const positionProfit = netSaleValue - invested - relatedAcquisitionDebt
  const totalProfit = cashReturned + cumulativeNetCashflow + netSaleValue - lifetimeInvested - relatedAcquisitionDebt

  return {
    grossPrice: safeGrossPrice,
    proceeds,
    deficiency,
    netSaleValue,
    positionProfit,
    totalProfit,
    totalProfitPercent: lifetimeInvested > 0 ? totalProfit / lifetimeInvested * 100 : 0,
  }
}

export interface AssetSaleSummary {
  invested: number
  lifetimeInvested: number
  cashReturned: number
  cumulativeNetCashflow: number
  marketValue: number
  securedDebt: number
  relatedAcquisitionDebt: number
  marketProceeds: number
  marketDeficiency: number
  marketPositionProfit: number
  marketProfit: number
  marketProfitPercent: number
  quickPrice: number
  quickProceeds: number
  quickDeficiency: number
  quickPositionProfit: number
  quickProfit: number
  quickProfitPercent: number
  breakEvenGrossPrice: number
  debtFreeGrossPrice: number
}

export const calculateAssetSaleSummary = (player: Player, asset: Asset): AssetSaleSummary => {
  const invested = assetInvestmentBasis(asset)
  const lifetimeInvested = assetLifetimeInvestment(asset)
  const cashReturned = Math.round(asset.cashReturned ?? 0)
  const cumulativeNetCashflow = Math.round(asset.cumulativeNetCashflow ?? 0)
  const marketValue = assetMarketValue(asset)
  const collateralDebt = pledgedLoanForAsset(player, asset.id)?.balance ?? 0
  const securedDebt = asset.loan + collateralDebt
  const relatedAcquisitionDebt = player.loans
    .filter((loan) => loan.relatedAssetId === asset.id)
    .reduce((sum, loan) => sum + loan.balance, 0)
  const quickPrice = Math.round(marketValue * 0.93)
  const marketExit = calculateAssetExitResult(player, asset, marketValue)
  const quickExit = calculateAssetExitResult(player, asset, quickPrice)
  const breakEvenGrossPrice = Math.max(
    0,
    securedDebt + relatedAcquisitionDebt + lifetimeInvested - cashReturned - cumulativeNetCashflow,
  )

  return {
    invested,
    lifetimeInvested,
    cashReturned,
    cumulativeNetCashflow,
    marketValue,
    securedDebt,
    relatedAcquisitionDebt,
    marketProceeds: marketExit.proceeds,
    marketDeficiency: marketExit.deficiency,
    marketPositionProfit: marketExit.positionProfit,
    marketProfit: marketExit.totalProfit,
    marketProfitPercent: marketExit.totalProfitPercent,
    quickPrice,
    quickProceeds: quickExit.proceeds,
    quickDeficiency: quickExit.deficiency,
    quickPositionProfit: quickExit.positionProfit,
    quickProfit: quickExit.totalProfit,
    quickProfitPercent: quickExit.totalProfitPercent,
    breakEvenGrossPrice,
    debtFreeGrossPrice: securedDebt,
  }
}

export const reduceAssetInvestmentBasis = (asset: Asset, soldRatio: number) => {
  asset.lifetimeCashInvested ??= assetLifetimeInvestment(asset)
  const ratio = Math.max(0, Math.min(1, soldRatio))
  asset.cashInvested = Math.max(0, Math.round(assetInvestmentBasis(asset) * (1 - ratio)))
}
