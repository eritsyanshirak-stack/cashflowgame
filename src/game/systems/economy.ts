import type { Asset, Player } from '../domain/types'

export const assetCashflow = (asset: Asset) =>
  asset.revenue - asset.operatingCosts - asset.monthlyPayment

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
