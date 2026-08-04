import type { Asset, MonthlyReport, Player } from '../domain/types'

export const assetCashflow = (asset: Asset) =>
  asset.revenue - asset.operatingCosts - asset.monthlyPayment

export const assetMarketValue = (asset: Asset) =>
  asset.marketValue ?? Math.round(asset.price * asset.ownership)

export const assetSaleProceeds = (asset: Asset) =>
  Math.max(0, assetMarketValue(asset) - asset.loan)

export const passiveIncome = (player: Player) =>
  player.assets.reduce((sum, asset) => sum + assetCashflow(asset), 0) +
  Math.round(player.deposit * 0.009) +
  Math.round(player.bonds * 0.014)

export const monthlyExpenses = (player: Player) =>
  player.baseExpenses + player.loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0)

export const monthlyCashflow = (player: Player) =>
  player.salary + passiveIncome(player) - monthlyExpenses(player)

export const totalDebt = (player: Player) =>
  player.baseDebt +
  player.assets.reduce((sum, asset) => sum + asset.loan, 0) +
  player.loans.reduce((sum, loan) => sum + loan.balance, 0)

export const netWorth = (player: Player) =>
  player.cash + player.deposit + player.bonds +
  player.assets.reduce((sum, asset) => sum + asset.price * asset.ownership - asset.loan, 0) -
  player.baseDebt - player.loans.reduce((sum, loan) => sum + loan.balance, 0)

export const isFinanciallyFree = (player: Player) =>
  passiveIncome(player) >= monthlyExpenses(player)

export const createMonthlyReport = (player: Player, month: number): MonthlyReport => {
  const assetRevenue = player.assets.reduce((sum, asset) => sum + asset.revenue, 0)
  const operatingCosts = player.assets.reduce((sum, asset) => sum + asset.operatingCosts, 0)
  const assetDebtPayments = player.assets.reduce((sum, asset) => sum + asset.monthlyPayment, 0)
  const depositIncome = Math.round(player.deposit * 0.009)
  const bondIncome = Math.round(player.bonds * 0.014)
  const loanPayments = player.loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0)
  const netCashflow = player.salary + assetRevenue + depositIncome + bondIncome -
    player.baseExpenses - operatingCosts - assetDebtPayments - loanPayments

  return {
    month,
    startingCash: player.cash,
    salary: player.salary,
    assetRevenue,
    depositIncome,
    bondIncome,
    livingExpenses: player.baseExpenses,
    operatingCosts,
    assetDebtPayments,
    loanPayments,
    netCashflow,
    endingCash: player.cash + netCashflow,
  }
}
