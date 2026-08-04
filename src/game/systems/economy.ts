import { difficultySettings } from '../content/content'
import type { Asset, Difficulty, MonthlyReport, Player, PlayerStatus, StockQuote } from '../domain/types'
import { skillLevel } from './progression'

export const assetRevenueMultiplier = (asset: Asset) => {
  if (asset.status === 'suspended') return 0
  if (asset.status === 'stressed') return 0.62
  const launch = asset.launchMonthsRemaining ?? 0
  if (asset.status === 'launching' || launch > 0) return launch >= 2 ? 0.55 : 0.8
  return 1
}

export const effectiveAssetRevenue = (asset: Asset) =>
  Math.round(asset.revenue * assetRevenueMultiplier(asset) * (asset.externalRevenueMultiplier ?? 1))

export const assetCashflow = (asset: Asset) =>
  effectiveAssetRevenue(asset) - asset.operatingCosts - asset.monthlyPayment

export const assetMarketValue = (asset: Asset) =>
  asset.marketValue ?? Math.round(asset.price * asset.ownership)

export const assetSaleProceeds = (asset: Asset) =>
  Math.max(0, assetMarketValue(asset) - asset.loan)

export const assetLiquidationProceeds = (player: Player, asset: Asset, grossPrice = assetMarketValue(asset)) =>
  Math.max(0, grossPrice - asset.loan - (pledgedLoanForAsset(player, asset.id)?.balance ?? 0))

export const stockMarketValue = (player: Player, market: StockQuote[]) =>
  player.stocks.reduce((sum, holding) => sum + holding.quantity * (market.find((quote) => quote.id === holding.stockId)?.price ?? 0), 0)

export const freeStockMarketValue = (player: Player, market: StockQuote[]) =>
  player.stocks.reduce((sum, holding) => {
    const freeQuantity = Math.max(0, holding.quantity - (holding.pledgedQuantity ?? 0))
    return sum + freeQuantity * (market.find((quote) => quote.id === holding.stockId)?.price ?? 0)
  }, 0)

export const monthlyStockDividends = (player: Player, market: StockQuote[]) =>
  player.stocks.reduce((sum, holding) => {
    const quote = market.find((item) => item.id === holding.stockId)
    return sum + (quote ? Math.round(holding.quantity * quote.price * quote.dividendYield / 12) : 0)
  }, 0)

export const portfolioManagementCost = (player: Player) => {
  const freeCapacity = 3 + skillLevel(player, 'management')
  const excessBusinesses = Math.max(0, player.assets.length - freeCapacity)
  if (excessBusinesses === 0) return 0
  const grossRevenue = player.assets.reduce((sum, asset) => sum + asset.revenue, 0)
  const overheadRate = Math.min(0.48, excessBusinesses * 0.12)
  return Math.round(grossRevenue * overheadRate)
}

export const passiveIncome = (player: Player, market: StockQuote[] = []) =>
  player.assets.reduce((sum, asset) => sum + assetCashflow(asset), 0) +
  Math.round(player.deposit * 0.009) +
  Math.round(player.bonds * 0.014) + monthlyStockDividends(player, market)

export const monthlyExpenses = (player: Player) =>
  player.baseExpenses + Math.round(player.baseDebt * 0.02) +
  player.loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0) +
  portfolioManagementCost(player)

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

const acquisitionIncomeWeight: Record<Difficulty, number> = { easy: 0.4, normal: 0.25, hard: 0.15 }
const reserveMonthsForLoan: Record<Difficulty, number> = { easy: 0.25, normal: 0.5, hard: 1 }
const acquisitionGapToCash: Record<Difficulty, number> = { easy: 1.1, normal: 0.8, hard: 0.35 }
const unsecuredSalaryMultiplier: Record<Difficulty, number> = { easy: 3.5, normal: 1.75, hard: 1 }

export const assessLoan = (
  player: Player,
  amount: number,
  difficulty: Difficulty,
  collateral?: Asset,
  projectedMonthlyIncome = 0,
  projectedMonthlyPayment = 0,
  rateDelta = 0,
): BankAssessment => {
  const settings = difficultySettings[difficulty]
  const financeLevel = skillLevel(player, 'finance')
  const securedLimit = collateral ? availableCollateral(player, collateral) : Number.POSITIVE_INFINITY
  const existingUnsecuredLoans = player.loans.filter((loan) => !loan.collateralAssetId && !loan.collateralStockId)
  const financeDiscount = financeLevel * 0.015
  const repeatLoanSurcharge = collateral ? 0 : existingUnsecuredLoans.length * 0.02
  const annualRate = Math.max(0.08, (collateral ? settings.securedRate : settings.unsecuredRate) + rateDelta - financeDiscount + repeatLoanSurcharge)
  const termMonths = collateral ? 48 : 36
  const monthlyPayment = loanPayment(amount, annualRate, termMonths)

  const investmentIncome = Math.round((player.deposit * 0.009 + player.bonds * 0.014) * 0.7)
  const verifiedBusinessIncome = Math.round(player.assets.reduce(
    (sum, asset) => sum + Math.max(0, effectiveAssetRevenue(asset) - asset.operatingCosts),
    0,
  ) * 0.55)
  const projectedIncome = Math.round(Math.max(0, projectedMonthlyIncome) * acquisitionIncomeWeight[difficulty])
  const income = Math.max(1, player.salary + investmentIncome + verifiedBusinessIncome + projectedIncome)

  const existingDebtPayments = monthlyDebtPayments(player)
  const debtPayments = existingDebtPayments + projectedMonthlyPayment + monthlyPayment
  const debtLoad = debtPayments / income
  const skilledDebtLimit = settings.maxDebtLoad + financeLevel * 0.02

  const livingCosts = player.baseExpenses + portfolioManagementCost(player)
  const safetyMargin = Math.round(livingCosts * (difficulty === 'easy' ? 0.08 : difficulty === 'normal' ? 0.15 : 0.22))
  const freeForDebt = Math.max(0, income - livingCosts - existingDebtPayments - projectedMonthlyPayment - safetyMargin)
  const paymentPerRuble = loanPayment(100_000, annualRate, termMonths) / 100_000
  const incomeLimit = Math.max(0, Math.floor(freeForDebt / Math.max(paymentPerRuble, 0.001) / 10_000) * 10_000)

  const unsecuredBalance = existingUnsecuredLoans.reduce((sum, loan) => sum + loan.balance, 0)
  const verifiedNetBusinessIncome = player.assets.reduce((sum, asset) => sum + Math.max(0, assetCashflow(asset)), 0)
  const unsecuredCap = Math.round(
    player.salary * (unsecuredSalaryMultiplier[difficulty] + financeLevel * 0.35) +
    verifiedNetBusinessIncome * (difficulty === 'easy' ? 9 : difficulty === 'normal' ? 6 : 4),
  )
  const unsecuredRoom = collateral ? Number.POSITIVE_INFINITY : Math.max(0, unsecuredCap - unsecuredBalance)
  const limit = Math.max(0, Math.min(incomeLimit, securedLimit, unsecuredRoom))

  const acquisitionLoan = projectedMonthlyIncome > 0 || projectedMonthlyPayment > 0
  const contributionLimit = player.cash * (acquisitionGapToCash[difficulty] + financeLevel * 0.1)
  const contributionReady = !acquisitionLoan || amount <= contributionLimit
  const liquidity = player.cash + player.deposit + player.bonds
  const liquidityReady = liquidity >= monthlyExpenses(player) * reserveMonthsForLoan[difficulty]

  const leveragePenalty = Math.min(250, Math.round((totalDebt(player) / Math.max(1, income * 12)) * 155))
  const debtLoadPenalty = Math.min(170, Math.round(debtLoad * 210))
  const repeatedLoanPenalty = existingUnsecuredLoans.length * 28
  const cashflowBonus = Math.min(80, Math.round(Math.max(0, monthlyCashflow(player)) / income * 110))
  const score = Math.max(300, Math.min(850, 745 + cashflowBonus - leveragePenalty - debtLoadPenalty - repeatedLoanPenalty - (difficulty === 'hard' ? 25 : 0)))
  const minimumScore = collateral ? 550 : 600

  const approved = amount > 0 && amount <= limit && debtLoad <= skilledDebtLimit &&
    contributionReady && liquidityReady && score >= minimumScore
  const reason = approved
    ? collateral ? 'Одобрено под залог актива' : 'Одобрено без залога'
    : collateral && securedLimit < amount ? 'Стоимость залога не покрывает сумму'
      : !contributionReady ? 'Нужно вложить больше собственных денег в первый взнос'
        : !liquidityReady ? 'Сначала создай денежный резерв'
          : debtLoad > skilledDebtLimit ? 'Долговая нагрузка выше допустимой'
            : score < minimumScore ? 'Кредитный рейтинг пока недостаточен'
              : freeForDebt <= 0 ? 'Доход уже перегружен обязательными платежами'
                : `Банк готов дать не больше ${limit.toLocaleString('ru-RU')} ₽`
  return { approved, score, debtLoad, limit, amount, annualRate, termMonths, monthlyPayment, reason }
}

export const netWorth = (player: Player, market: StockQuote[] = []) =>
  player.cash + player.deposit + player.bonds +
  stockMarketValue(player, market) +
  player.assets.reduce((sum, asset) => sum + assetMarketValue(asset) - asset.loan, 0) -
  player.baseDebt - player.loans.reduce((sum, loan) => sum + loan.balance, 0)

export const liquidReserve = (player: Player, market: StockQuote[] = []) =>
  player.cash + player.deposit + player.bonds + freeStockMarketValue(player, market)

export const freedomChecklist = (player: Player, market: StockQuote[] = []) => {
  const expenses = monthlyExpenses(player)
  const reliableIncome = Math.max(1,
    player.salary +
    player.assets.reduce((sum, asset) => sum + Math.max(0, effectiveAssetRevenue(asset) - asset.operatingCosts), 0) +
    Math.round(player.deposit * 0.009) + Math.round(player.bonds * 0.014),
  )
  const debtServiceLoad = monthlyDebtPayments(player) / reliableIncome
  const unsecuredDebt = player.loans.filter((loan) => !loan.collateralAssetId && !loan.collateralStockId).reduce((sum, loan) => sum + loan.balance, 0)
  return {
    incomeCovered: passiveIncome(player, market) >= expenses,
    reserveReady: liquidReserve(player, market) >= expenses * 3,
    debtLoadReady: debtServiceLoad <= 0.35,
    unsecuredReady: unsecuredDebt <= expenses * 2,
    positiveCapital: netWorth(player, market) > 0,
    streak: player.freedomStreak ?? 0,
    reserveTarget: expenses * 3,
    reserveCurrent: liquidReserve(player, market),
    debtServiceLoad,
  }
}

export const meetsFreedomConditions = (player: Player, market: StockQuote[] = []) => {
  const check = freedomChecklist(player, market)
  return check.incomeCovered && check.reserveReady && check.debtLoadReady && check.unsecuredReady && check.positiveCapital
}

export const isFinanciallyFree = (player: Player, market: StockQuote[] = []) =>
  meetsFreedomConditions(player, market) && (player.freedomStreak ?? 0) >= 3

export const freedomProgress = (player: Player, market: StockQuote[] = []) =>
  Math.max(0, Math.round((passiveIncome(player, market) / Math.max(1, monthlyExpenses(player))) * 100))

export const isBankrupt = (player: Player, market: StockQuote[] = []) =>
  player.cash < -monthlyExpenses(player) * 2 && netWorth(player, market) < 0 && monthlyCashflow(player, market) < 0

export const competitionStatus = (player: Player, market: StockQuote[] = []): PlayerStatus => {
  if (player.status !== 'active') return player.status
  if (isFinanciallyFree(player, market)) return 'free'
  if (isBankrupt(player, market)) return 'bankrupt'
  return 'active'
}

export const competitionStandings = (players: Player[], market: StockQuote[] = []) =>
  [...players].sort((a, b) => {
    const statusWeight = (player: Player) => competitionStatus(player, market) === 'free' ? 2 : competitionStatus(player, market) === 'active' ? 1 : 0
    const statusDifference = statusWeight(b) - statusWeight(a)
    if (statusDifference) return statusDifference
    const freedomDifference = freedomProgress(b, market) - freedomProgress(a, market)
    if (freedomDifference) return freedomDifference
    return netWorth(b, market) - netWorth(a, market)
  })

export const createMonthlyReport = (player: Player, month: number, market: StockQuote[] = [], resaleReturns = 0, contractReturns = 0): MonthlyReport => {
  const assetRevenue = player.assets.reduce((sum, asset) => sum + effectiveAssetRevenue(asset), 0)
  const managementCost = portfolioManagementCost(player)
  const operatingCosts = player.assets.reduce((sum, asset) => sum + asset.operatingCosts, 0) + managementCost
  const assetDebtPayments = player.assets.reduce((sum, asset) => sum + asset.monthlyPayment, 0)
  const depositIncome = Math.round(player.deposit * 0.009)
  const bondIncome = Math.round(player.bonds * 0.014)
  const stockDividends = monthlyStockDividends(player, market)
  const loanPayments = player.loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0)
  const baseDebtPayment = Math.round(player.baseDebt * 0.02)
  const netCashflow = player.salary + assetRevenue + depositIncome + bondIncome + stockDividends + resaleReturns + contractReturns -
    player.baseExpenses - baseDebtPayment - operatingCosts - assetDebtPayments - loanPayments

  return {
    month,
    startingCash: player.cash,
    salary: player.salary,
    assetRevenue,
    depositIncome,
    bondIncome, stockDividends, resaleReturns, contractReturns,
    livingExpenses: player.baseExpenses + baseDebtPayment,
    operatingCosts,
    assetDebtPayments,
    loanPayments,
    netCashflow,
    endingCash: player.cash + netCashflow,
  }
}
