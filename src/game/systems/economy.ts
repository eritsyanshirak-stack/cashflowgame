import { difficultySettings } from '../content/content'
import type { Asset, Difficulty, MonthlyReport, Player, StockQuote } from '../domain/types'

export const assetCashflow = (asset: Asset) =>
  asset.revenue - asset.operatingCosts - asset.monthlyPayment

export const assetMarketValue = (asset: Asset) =>
  asset.marketValue ?? Math.round(asset.price * asset.ownership)

export const assetSaleProceeds = (asset: Asset) =>
  Math.max(0, assetMarketValue(asset) - asset.loan)

export const assetLiquidationProceeds = (player: Player, asset: Asset, grossPrice = assetMarketValue(asset)) =>
  Math.max(0, grossPrice - asset.loan - (pledgedLoanForAsset(player, asset.id)?.balance ?? 0))

export const stockMarketValue = (player: Player, market: StockQuote[]) =>
  player.stocks.reduce((sum, holding) => sum + holding.quantity * (market.find((quote) => quote.id === holding.stockId)?.price ?? 0), 0)

export const monthlyStockDividends = (player: Player, market: StockQuote[]) =>
  player.stocks.reduce((sum, holding) => {
    const quote = market.find((item) => item.id === holding.stockId)
    return sum + (quote ? Math.round(holding.quantity * quote.price * quote.dividendYield / 12) : 0)
  }, 0)

export const passiveIncome = (player: Player, market: StockQuote[] = []) =>
  player.assets.reduce((sum, asset) => sum + assetCashflow(asset), 0) +
  Math.round(player.deposit * 0.009) +
  Math.round(player.bonds * 0.014) + monthlyStockDividends(player, market)

export const monthlyExpenses = (player: Player) =>
  player.baseExpenses + player.loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0)

export const monthlyCashflow = (player: Player, market: StockQuote[] = []) =>
  player.salary + passiveIncome(player, market) - monthlyExpenses(player)

export const totalDebt = (player: Player) =>
  player.baseDebt +
  player.assets.reduce((sum, asset) => sum + asset.loan, 0) +
  player.loans.reduce((sum, loan) => sum + loan.balance, 0)

export const monthlyDebtPayments = (player: Player) =>
  Math.round(player.baseDebt * 0.02) +
  player.assets.reduce((sum, asset) => sum + asset.monthlyPayment, 0) +
  player.loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0)

export const loanPayment = (amount: number, annualRate: number, termMonths: number) => {
  if (amount <= 0) return 0
  const monthlyRate = annualRate / 12
  return Math.round(amount * monthlyRate / (1 - (1 + monthlyRate) ** -termMonths))
}

export const pledgedLoanForAsset = (player: Player, assetId: string) =>
  player.loans.find((loan) => loan.collateralAssetId === assetId)

export const availableCollateral = (player: Player, asset: Asset) => {
  if (pledgedLoanForAsset(player, asset.id)) return 0
  return Math.max(0, Math.round((assetMarketValue(asset) - asset.loan) * 0.55))
}

export interface BankAssessment {
  approved: boolean
  score: number
  debtLoad: number
  limit: number
  amount: number
  annualRate: number
  termMonths: number
  monthlyPayment: number
  reason: string
}

export const assessLoan = (
  player: Player,
  amount: number,
  difficulty: Difficulty,
  collateral?: Asset,
  projectedMonthlyIncome = 0,
  projectedMonthlyPayment = 0,
): BankAssessment => {
  const settings = difficultySettings[difficulty]
  const securedLimit = collateral ? availableCollateral(player, collateral) : Number.POSITIVE_INFINITY
  const annualRate = collateral ? settings.securedRate : settings.unsecuredRate
  const termMonths = collateral ? 48 : 36
  const monthlyPayment = loanPayment(amount, annualRate, termMonths)
  const investmentIncome = Math.round(player.deposit * 0.009) + Math.round(player.bonds * 0.014)
  const businessOperatingIncome = player.assets.reduce((sum, asset) => sum + asset.revenue - asset.operatingCosts, 0)
  const income = Math.max(1, player.salary + investmentIncome + businessOperatingIncome + projectedMonthlyIncome)
  const obligations = player.baseExpenses + monthlyDebtPayments(player) + projectedMonthlyPayment + monthlyPayment
  const debtLoad = obligations / income
  const freeForDebt = Math.max(0, income * settings.maxDebtLoad - player.baseExpenses - monthlyDebtPayments(player) - projectedMonthlyPayment)
  const paymentPerRuble = loanPayment(100_000, annualRate, termMonths) / 100_000
  const incomeLimit = Math.max(0, Math.floor(freeForDebt / Math.max(paymentPerRuble, 0.001) / 10_000) * 10_000)
  const limit = Math.max(0, Math.min(incomeLimit, securedLimit))
  const leveragePenalty = Math.min(230, Math.round((totalDebt(player) / Math.max(1, income * 12)) * 145))
  const cashflowBonus = Math.min(90, Math.round(Math.max(0, monthlyCashflow(player)) / income * 130))
  const score = Math.max(300, Math.min(850, 735 + cashflowBonus - leveragePenalty - (difficulty === 'hard' ? 35 : 0)))
  const approved = amount > 0 && amount <= limit && debtLoad <= settings.maxDebtLoad
  const reason = approved
    ? collateral ? 'Одобрено под залог актива' : 'Одобрено без залога'
    : collateral && securedLimit < amount ? 'Стоимость залога не покрывает сумму'
      : freeForDebt <= 0 ? 'Доход уже перегружен обязательными платежами'
        : `Банк готов дать не больше ${limit.toLocaleString('ru-RU')} ₽`
  return { approved, score, debtLoad, limit, amount, annualRate, termMonths, monthlyPayment, reason }
}

export const netWorth = (player: Player, market: StockQuote[] = []) =>
  player.cash + player.deposit + player.bonds +
  stockMarketValue(player, market) +
  player.assets.reduce((sum, asset) => sum + assetMarketValue(asset) - asset.loan, 0) -
  player.baseDebt - player.loans.reduce((sum, loan) => sum + loan.balance, 0)

export const isFinanciallyFree = (player: Player, market: StockQuote[] = []) =>
  passiveIncome(player, market) >= monthlyExpenses(player)

export const createMonthlyReport = (player: Player, month: number, market: StockQuote[] = [], resaleReturns = 0): MonthlyReport => {
  const assetRevenue = player.assets.reduce((sum, asset) => sum + asset.revenue, 0)
  const operatingCosts = player.assets.reduce((sum, asset) => sum + asset.operatingCosts, 0)
  const assetDebtPayments = player.assets.reduce((sum, asset) => sum + asset.monthlyPayment, 0)
  const depositIncome = Math.round(player.deposit * 0.009)
  const bondIncome = Math.round(player.bonds * 0.014)
  const stockDividends = monthlyStockDividends(player, market)
  const loanPayments = player.loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0)
  const netCashflow = player.salary + assetRevenue + depositIncome + bondIncome + stockDividends + resaleReturns -
    player.baseExpenses - operatingCosts - assetDebtPayments - loanPayments

  return {
    month,
    startingCash: player.cash,
    salary: player.salary,
    assetRevenue,
    depositIncome,
    bondIncome, stockDividends, resaleReturns,
    livingExpenses: player.baseExpenses,
    operatingCosts,
    assetDebtPayments,
    loanPayments,
    netCashflow,
    endingCash: player.cash + netCashflow,
  }
}
