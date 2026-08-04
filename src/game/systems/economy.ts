import { difficultySettings } from '../content/content'
import type { Asset, Difficulty, MonthlyReport, Player, PlayerStatus, StockQuote } from '../domain/types'
import { skillLevel } from './progression'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const assetRampMultiplier = (asset: Asset, currentMonth?: number) => {
  if (currentMonth == null) return 1
  const age = Math.max(0, currentMonth - asset.purchaseMonth)
  if (age === 0) return 0.55
  if (age === 1) return 0.75
  if (age === 2) return 0.9
  return 1
}

export const assetRealizedRevenue = (asset: Asset, currentMonth?: number) =>
  Math.round(asset.revenue * assetRampMultiplier(asset, currentMonth) * clamp(asset.performanceMultiplier ?? 1, 0.6, 1.3))

export const assetCashflow = (asset: Asset, currentMonth?: number) =>
  assetRealizedRevenue(asset, currentMonth) - asset.operatingCosts - asset.monthlyPayment

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

export const portfolioManagementCost = (player: Player, currentMonth?: number) => {
  const freeCapacity = 3 + skillLevel(player, 'management')
  const excessBusinesses = Math.max(0, player.assets.length - freeCapacity)
  if (excessBusinesses === 0) return 0
  const grossRevenue = player.assets.reduce((sum, asset) => sum + assetRealizedRevenue(asset, currentMonth), 0)
  const overheadRate = Math.min(0.36, excessBusinesses * 0.07)
  return Math.round(grossRevenue * overheadRate)
}

export const passiveIncome = (player: Player, market: StockQuote[] = [], currentMonth?: number) =>
  player.assets.reduce((sum, asset) => sum + assetCashflow(asset, currentMonth), 0) +
  Math.round(player.deposit * 0.009) +
  Math.round(player.bonds * 0.014) + monthlyStockDividends(player, market)

export const monthlyExpenses = (player: Player, currentMonth?: number) =>
  player.baseExpenses + Math.round(player.baseDebt * 0.02) +
  player.loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0) +
  portfolioManagementCost(player, currentMonth)

export const monthlyCashflow = (player: Player, market: StockQuote[] = [], currentMonth?: number) =>
  player.salary + passiveIncome(player, market, currentMonth) - monthlyExpenses(player, currentMonth)

export const totalDebt = (player: Player) =>
  player.baseDebt +
  player.assets.reduce((sum, asset) => sum + asset.loan, 0) +
  player.loans.reduce((sum, loan) => sum + loan.balance, 0)

export const monthlyDebtPayments = (player: Player) =>
  Math.round(player.baseDebt * 0.02) +
  player.assets.reduce((sum, asset) => sum + asset.monthlyPayment, 0) +
  player.loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0)

export const loanPayment = (amount: number, annualRate: number, termMonths: number) => {
  if (amount <= 0 || termMonths <= 0) return 0
  if (annualRate <= 0) return Math.round(amount / termMonths)
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

const acquisitionIncomeWeight: Record<Difficulty, number> = { easy: 0.35, normal: 0.2, hard: 0.1 }
const reserveMonthsForLoan: Record<Difficulty, number> = { easy: 0.5, normal: 1, hard: 1.5 }
const acquisitionGapToCash: Record<Difficulty, number> = { easy: 0.9, normal: 0.65, hard: 0.35 }
const unsecuredSalaryMultiplier: Record<Difficulty, number> = { easy: 3, normal: 1.5, hard: 0.8 }

export const assessLoan = (
  player: Player,
  amount: number,
  difficulty: Difficulty,
  collateral?: Asset,
  projectedMonthlyIncome = 0,
  projectedMonthlyPayment = 0,
): BankAssessment => {
  const settings = difficultySettings[difficulty]
  const financeLevel = skillLevel(player, 'finance')
  const securedLimit = collateral ? availableCollateral(player, collateral) : Number.POSITIVE_INFINITY
  const existingUnsecuredLoans = player.loans.filter((loan) => !loan.collateralAssetId)
  const financeDiscount = financeLevel * 0.012
  const repeatLoanSurcharge = collateral ? 0 : existingUnsecuredLoans.length * 0.025
  const annualRate = Math.max(0.08, (collateral ? settings.securedRate : settings.unsecuredRate) - financeDiscount + repeatLoanSurcharge)
  const termMonths = collateral ? 48 : 36
  const payment = loanPayment(amount, annualRate, termMonths)

  const investmentIncome = Math.round((player.deposit * 0.009 + player.bonds * 0.014) * 0.65)
  const verifiedBusinessIncome = Math.round(player.assets.reduce(
    (sum, asset) => sum + Math.max(0, asset.revenue - asset.operatingCosts - asset.monthlyPayment),
    0,
  ) * 0.5)
  const projectedIncome = Math.round(Math.max(0, projectedMonthlyIncome - projectedMonthlyPayment) * acquisitionIncomeWeight[difficulty])
  const income = Math.max(1, player.salary + investmentIncome + verifiedBusinessIncome + projectedIncome)

  const existingDebtPayments = monthlyDebtPayments(player)
  const debtPayments = existingDebtPayments + projectedMonthlyPayment + payment
  const debtLoad = debtPayments / income
  const skilledDebtLimit = settings.maxDebtLoad + financeLevel * 0.015

  const livingCosts = player.baseExpenses + portfolioManagementCost(player)
  const safetyMargin = Math.round(livingCosts * (difficulty === 'easy' ? 0.12 : difficulty === 'normal' ? 0.2 : 0.28))
  const freeForDebt = Math.max(0, income - livingCosts - existingDebtPayments - projectedMonthlyPayment - safetyMargin)
  const paymentPerRuble = loanPayment(100_000, annualRate, termMonths) / 100_000
  const incomeLimit = Math.max(0, Math.floor(freeForDebt / Math.max(paymentPerRuble, 0.001) / 10_000) * 10_000)

  const unsecuredBalance = existingUnsecuredLoans.reduce((sum, loan) => sum + loan.balance, 0)
  const verifiedNetBusinessIncome = player.assets.reduce((sum, asset) => sum + Math.max(0, assetCashflow(asset)), 0)
  const unsecuredCap = Math.round(
    player.salary * (unsecuredSalaryMultiplier[difficulty] + financeLevel * 0.25) +
    verifiedNetBusinessIncome * (difficulty === 'easy' ? 7 : difficulty === 'normal' ? 4 : 2.5),
  )
  const unsecuredRoom = collateral ? Number.POSITIVE_INFINITY : Math.max(0, unsecuredCap - unsecuredBalance)
  const limit = Math.max(0, Math.min(incomeLimit, securedLimit, unsecuredRoom))

  const acquisitionLoan = projectedMonthlyIncome > 0 || projectedMonthlyPayment > 0
  const contributionLimit = player.cash * (acquisitionGapToCash[difficulty] + financeLevel * 0.08)
  const contributionReady = !acquisitionLoan || amount <= contributionLimit
  const liquidity = player.cash + player.deposit + player.bonds
  const liquidityReady = liquidity >= monthlyExpenses(player) * reserveMonthsForLoan[difficulty]

  const leveragePenalty = Math.min(260, Math.round((totalDebt(player) / Math.max(1, income * 12)) * 165))
  const debtLoadPenalty = Math.min(180, Math.round(debtLoad * 225))
  const repeatedLoanPenalty = existingUnsecuredLoans.length * 34
  const cashflowBonus = Math.min(70, Math.round(Math.max(0, monthlyCashflow(player)) / income * 95))
  const score = Math.max(300, Math.min(850, 745 + cashflowBonus - leveragePenalty - debtLoadPenalty - repeatedLoanPenalty - (difficulty === 'hard' ? 25 : 0)))
  const minimumScore = collateral ? 560 : 610

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
  return { approved, score, debtLoad, limit, amount, annualRate, termMonths, monthlyPayment: payment, reason }
}

export const netWorth = (player: Player, market: StockQuote[] = []) =>
  player.cash + player.deposit + player.bonds +
  stockMarketValue(player, market) +
  player.assets.reduce((sum, asset) => sum + assetMarketValue(asset) - asset.loan, 0) -
  player.baseDebt - player.loans.reduce((sum, loan) => sum + loan.balance, 0)

export const liquidReserve = (player: Player, market: StockQuote[] = []) =>
  player.cash + player.deposit + player.bonds + stockMarketValue(player, market)

export interface FreedomRequirements {
  incomeCoverage: number
  reserve: number
  reserveTarget: number
  reserveShortfall: number
  debtServiceLoad: number
  unsecuredDebt: number
  incomeCovered: boolean
  reserveReady: boolean
  debtLoadReady: boolean
  unsecuredDebtReady: boolean
  capitalReady: boolean
  streakReady: boolean
}

export const freedomRequirements = (player: Player, market: StockQuote[] = [], currentMonth?: number): FreedomRequirements => {
  const expenses = monthlyExpenses(player, currentMonth)
  const income = passiveIncome(player, market, currentMonth)
  const reserve = liquidReserve(player, market)
  const reserveTarget = expenses * 3
  const reliableIncome = Math.max(1,
    player.salary +
    player.assets.reduce((sum, asset) => sum + Math.max(0, assetRealizedRevenue(asset, currentMonth) - asset.operatingCosts), 0) +
    Math.round(player.deposit * 0.009) + Math.round(player.bonds * 0.014),
  )
  const debtServiceLoad = monthlyDebtPayments(player) / reliableIncome
  const unsecuredDebt = player.loans.filter((loan) => !loan.collateralAssetId).reduce((sum, loan) => sum + loan.balance, 0)
  return {
    incomeCoverage: income / Math.max(1, expenses),
    reserve,
    reserveTarget,
    reserveShortfall: Math.max(0, reserveTarget - reserve),
    debtServiceLoad,
    unsecuredDebt,
    incomeCovered: income >= expenses,
    reserveReady: reserve >= reserveTarget,
    debtLoadReady: debtServiceLoad <= 0.32,
    unsecuredDebtReady: unsecuredDebt <= expenses * 1.5,
    capitalReady: netWorth(player, market) > 0,
    streakReady: player.freedomStreak >= 3,
  }
}

export const meetsFreedomConditions = (player: Player, market: StockQuote[] = [], currentMonth?: number) => {
  const requirements = freedomRequirements(player, market, currentMonth)
  return requirements.incomeCovered && requirements.reserveReady && requirements.debtLoadReady &&
    requirements.unsecuredDebtReady && requirements.capitalReady
}

export const isFinanciallyFree = (player: Player, market: StockQuote[] = [], currentMonth?: number) => {
  const requirements = freedomRequirements(player, market, currentMonth)
  return meetsFreedomConditions(player, market, currentMonth) && requirements.streakReady
}

export const freedomProgress = (player: Player, market: StockQuote[] = [], currentMonth?: number) => {
  const requirements = freedomRequirements(player, market, currentMonth)
  const incomeScore = Math.min(1, requirements.incomeCoverage)
  const reserveScore = Math.min(1, requirements.reserve / Math.max(1, requirements.reserveTarget))
  const debtScore = requirements.debtLoadReady ? 1 : Math.max(0, 1 - requirements.debtServiceLoad)
  const unsecuredScore = requirements.unsecuredDebtReady ? 1 : Math.max(0, 1 - requirements.unsecuredDebt / Math.max(1, requirements.reserveTarget))
  const capitalScore = requirements.capitalReady ? 1 : 0
  const streakScore = Math.min(1, player.freedomStreak / 3)
  return Math.max(0, Math.min(100, Math.round(
    incomeScore * 45 + reserveScore * 25 + debtScore * 10 + unsecuredScore * 5 + capitalScore * 5 + streakScore * 10,
  )))
}

export const isBankrupt = (player: Player, market: StockQuote[] = [], currentMonth?: number) =>
  player.cash < -monthlyExpenses(player, currentMonth) * 2 && netWorth(player, market) < 0 && monthlyCashflow(player, market, currentMonth) < 0

export const competitionStatus = (player: Player, market: StockQuote[] = [], currentMonth?: number): PlayerStatus => {
  if (player.status !== 'active') return player.status
  if (isFinanciallyFree(player, market, currentMonth)) return 'free'
  if (isBankrupt(player, market, currentMonth)) return 'bankrupt'
  return 'active'
}

export const competitionStandings = (players: Player[], market: StockQuote[] = [], currentMonth?: number) =>
  [...players].sort((a, b) => {
    const statusWeight = (player: Player) => competitionStatus(player, market, currentMonth) === 'free' ? 2 : competitionStatus(player, market, currentMonth) === 'active' ? 1 : 0
    const statusDifference = statusWeight(b) - statusWeight(a)
    if (statusDifference) return statusDifference
    const freedomDifference = freedomProgress(b, market, currentMonth) - freedomProgress(a, market, currentMonth)
    if (freedomDifference) return freedomDifference
    return netWorth(b, market) - netWorth(a, market)
  })

export const createMonthlyReport = (player: Player, month: number, market: StockQuote[] = [], resaleReturns = 0): MonthlyReport => {
  const assetRevenue = player.assets.reduce((sum, asset) => sum + assetRealizedRevenue(asset, month), 0)
  const operatingCosts = player.assets.reduce((sum, asset) => sum + asset.operatingCosts, 0) + portfolioManagementCost(player, month)
  const assetDebtPayments = player.assets.reduce((sum, asset) => sum + asset.monthlyPayment, 0)
  const depositIncome = Math.round(player.deposit * 0.009)
  const bondIncome = Math.round(player.bonds * 0.014)
  const stockDividends = monthlyStockDividends(player, market)
  const loanPayments = player.loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0)
  const baseDebtPayment = Math.round(player.baseDebt * 0.02)
  const netCashflow = player.salary + assetRevenue + depositIncome + bondIncome + stockDividends + resaleReturns -
    player.baseExpenses - baseDebtPayment - operatingCosts - assetDebtPayments - loanPayments

  return {
    month,
    startingCash: player.cash,
    salary: player.salary,
    assetRevenue,
    depositIncome,
    bondIncome, stockDividends, resaleReturns,
    livingExpenses: player.baseExpenses + baseDebtPayment,
    operatingCosts,
    assetDebtPayments,
    loanPayments,
    netCashflow,
    endingCash: player.cash + netCashflow,
  }
}
