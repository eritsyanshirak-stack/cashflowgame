import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const write = (path, content) => fs.writeFileSync(path, content)
const replaceRequired = (path, from, to) => {
  const current = read(path)
  if (!current.includes(from)) throw new Error(`Missing replacement anchor in ${path}: ${from.slice(0, 100)}`)
  write(path, current.replace(from, to))
}
const replaceRegexRequired = (path, pattern, to) => {
  const current = read(path)
  if (!pattern.test(current)) throw new Error(`Missing regex anchor in ${path}: ${pattern}`)
  write(path, current.replace(pattern, to))
}
const replaceAllRequired = (path, from, to) => {
  const current = read(path)
  if (!current.includes(from)) throw new Error(`Missing replaceAll anchor in ${path}: ${from}`)
  write(path, current.split(from).join(to))
}

const contentPath = 'src/game/content/content.ts'
replaceRequired(
  contentPath,
  `  easy: { label: 'Спокойно', description: 'Рынок мягче, торг проще', negotiationChance: 0.76, marketVolatility: 0.05, offerChance: 0.52, botActivity: 0.48, maxDebtLoad: 0.5, unsecuredRate: 0.2, securedRate: 0.14, resaleDelayChance: 0.08 },
  normal: { label: 'Баланс', description: 'Честная конкуренция', negotiationChance: 0.6, marketVolatility: 0.09, offerChance: 0.42, botActivity: 0.72, maxDebtLoad: 0.38, unsecuredRate: 0.25, securedRate: 0.18, resaleDelayChance: 0.15 },
  hard: { label: 'Жёстко', description: 'Сильные боты и нервный рынок', negotiationChance: 0.46, marketVolatility: 0.14, offerChance: 0.34, botActivity: 0.86, maxDebtLoad: 0.3, unsecuredRate: 0.31, securedRate: 0.23, resaleDelayChance: 0.24 },`,
  `  easy: { label: 'Спокойно', description: 'Больше запаса на ошибку', negotiationChance: 0.78, marketVolatility: 0.05, offerChance: 0.52, botActivity: 0.74, maxDebtLoad: 0.5, unsecuredRate: 0.2, securedRate: 0.14, resaleDelayChance: 0.08 },
  normal: { label: 'Баланс', description: 'Кредиты и бизнес требуют расчёта', negotiationChance: 0.6, marketVolatility: 0.09, offerChance: 0.42, botActivity: 0.9, maxDebtLoad: 0.38, unsecuredRate: 0.25, securedRate: 0.18, resaleDelayChance: 0.15 },
  hard: { label: 'Жёстко', description: 'Сильные соперники и дорогие ошибки', negotiationChance: 0.44, marketVolatility: 0.14, offerChance: 0.34, botActivity: 0.98, maxDebtLoad: 0.3, unsecuredRate: 0.31, securedRate: 0.23, resaleDelayChance: 0.24 },`,
)

replaceRegexRequired(
  contentPath,
  /export const developments = \[[\s\S]*?\] as const/,
  `export const developments = [
  { id: 'marketing', name: 'Маркетинг', description: 'Умеренный рост продаж, без гарантии мгновенной окупаемости', costRate: 0.1, revenueRate: 0.08, costGrowthRate: 0.03, valueRate: 0.08 },
  { id: 'automation', name: 'Автоматизация', description: 'Снижает часть расходов, но требует дорогого внедрения', costRate: 0.12, revenueRate: 0.03, costGrowthRate: -0.08, valueRate: 0.1 },
  { id: 'manager', name: 'Управляющий', description: 'Повышает устойчивость и управляемость бизнеса', costRate: 0.16, revenueRate: 0.05, costGrowthRate: 0.02, valueRate: 0.12 },
  { id: 'scale', name: 'Вторая точка', description: 'Рост выручки вместе с заметным ростом постоянных расходов', costRate: 0.35, revenueRate: 0.2, costGrowthRate: 0.16, valueRate: 0.22 },
] as const`,
)

const businessBlock = `export const businesses: BusinessTemplate[] = [
  { id: 'vending', name: 'Вендинговый автомат', icon: '🥤', category: 'Микробизнес', price: 90_000, downPayment: 90_000, loan: 0, loanAnnualRate: 0, loanTermMonths: 0, revenue: 12_000, operatingCosts: 6_000, requiredLevel: 1 },
  { id: 'coffee', name: 'Кофейный островок', icon: '☕', category: 'Общепит', price: 480_000, downPayment: 150_000, loan: 330_000, loanAnnualRate: 0.24, loanTermMonths: 60, revenue: 62_000, operatingCosts: 44_000, requiredLevel: 1 },
  { id: 'pickup', name: 'Пункт выдачи заказов', icon: '📦', category: 'Сервис', price: 620_000, downPayment: 180_000, loan: 440_000, loanAnnualRate: 0.24, loanTermMonths: 60, revenue: 75_000, operatingCosts: 52_000, requiredLevel: 1 },
  { id: 'marketplace', name: 'Магазин на маркетплейсе', icon: '🛒', category: 'Онлайн', price: 350_000, downPayment: 200_000, loan: 150_000, loanAnnualRate: 0.25, loanTermMonths: 48, revenue: 58_000, operatingCosts: 42_000, requiredLevel: 1 },
  { id: 'cleaning', name: 'Клининг-сервис', icon: '🧹', category: 'Услуги', price: 290_000, downPayment: 170_000, loan: 120_000, loanAnnualRate: 0.25, loanTermMonths: 48, revenue: 52_000, operatingCosts: 38_000, requiredLevel: 1 },
  { id: 'barber', name: 'Барбершоп', icon: '💈', category: 'Услуги', price: 850_000, downPayment: 270_000, loan: 580_000, loanAnnualRate: 0.23, loanTermMonths: 72, revenue: 105_000, operatingCosts: 74_000, requiredLevel: 2 },
  { id: 'fitness', name: 'Фитнес-студия', icon: '🏋️', category: 'Спорт', price: 950_000, downPayment: 290_000, loan: 660_000, loanAnnualRate: 0.23, loanTermMonths: 72, revenue: 120_000, operatingCosts: 84_000, requiredLevel: 2 },
  { id: 'school', name: 'Онлайн-школа', icon: '🎓', category: 'Онлайн', price: 540_000, downPayment: 260_000, loan: 280_000, loanAnnualRate: 0.24, loanTermMonths: 60, revenue: 88_000, operatingCosts: 62_000, requiredLevel: 2 },
  { id: 'agency', name: 'SMM-агентство', icon: '📱', category: 'Услуги', price: 410_000, downPayment: 210_000, loan: 200_000, loanAnnualRate: 0.25, loanTermMonths: 48, revenue: 78_000, operatingCosts: 58_000, requiredLevel: 2 },
  { id: 'dark-kitchen', name: 'Кухня доставки', icon: '🍜', category: 'Общепит', price: 780_000, downPayment: 250_000, loan: 530_000, loanAnnualRate: 0.24, loanTermMonths: 60, revenue: 105_000, operatingCosts: 74_000, requiredLevel: 2 },
  { id: 'wash', name: 'Автомойка', icon: '🚗', category: 'Авто', price: 1_600_000, downPayment: 460_000, loan: 1_140_000, loanAnnualRate: 0.22, loanTermMonths: 84, revenue: 180_000, operatingCosts: 128_000, requiredLevel: 3 },
  { id: 'it', name: 'IT-сервис', icon: '🖥️', category: 'IT', price: 1_400_000, downPayment: 520_000, loan: 880_000, loanAnnualRate: 0.22, loanTermMonths: 72, revenue: 190_000, operatingCosts: 135_000, requiredLevel: 3 },
  { id: 'warehouse', name: 'Склад самообслуживания', icon: '🏗️', category: 'Недвижимость', price: 2_100_000, downPayment: 590_000, loan: 1_510_000, loanAnnualRate: 0.19, loanTermMonths: 120, revenue: 205_000, operatingCosts: 145_000, requiredLevel: 3 },
  { id: 'apartment', name: 'Квартира под аренду', icon: '🏠', category: 'Недвижимость', price: 4_200_000, downPayment: 1_050_000, loan: 3_150_000, loanAnnualRate: 0.16, loanTermMonths: 180, revenue: 135_000, operatingCosts: 50_000, requiredLevel: 4 },
  { id: 'factory', name: 'Мини-производство', icon: '⚙️', category: 'Производство', price: 3_600_000, downPayment: 1_100_000, loan: 2_500_000, loanAnnualRate: 0.21, loanTermMonths: 120, revenue: 315_000, operatingCosts: 210_000, requiredLevel: 4 },
  { id: 'medical', name: 'Медицинский центр', icon: '🏥', category: 'Медицина', price: 5_100_000, downPayment: 1_450_000, loan: 3_650_000, loanAnnualRate: 0.2, loanTermMonths: 120, revenue: 455_000, operatingCosts: 315_000, requiredLevel: 5 },
]`
replaceRegexRequired(
  contentPath,
  /export const businesses: BusinessTemplate\[\] = \[[\s\S]*?\n\]\n\nexport const board/,
  `${businessBlock}

export const board`,
)

const typesPath = 'src/game/domain/types.ts'
replaceRequired(typesPath, `  operatingCosts: number
  requiredLevel: number`, `  operatingCosts: number
  requiredLevel: number
  loanAnnualRate: number
  loanTermMonths: number`)
replaceRequired(typesPath, `  offerExpiresMonth: number | null
}`, `  offerExpiresMonth: number | null
  performanceMultiplier?: number
}`)
replaceRequired(typesPath, `  eliminatedMonth: number | null
  botStrategy?: BotStrategy`, `  eliminatedMonth: number | null
  freedomStreak: number
  botStrategy?: BotStrategy`)
replaceRequired(typesPath, `  version: 7`, `  version: 8`)

const savePath = 'src/game/persistence/save.ts'
replaceRequired(savePath, `version: z.literal(7)`, `version: z.literal(8)`)
replaceRequired(
  savePath,
  `    status: z.enum(['active', 'free', 'bankrupt']), eliminatedMonth: z.number().int().positive().nullable(),
    botStrategy: z.enum(['careful', 'balanced', 'aggressive']).optional(),`,
  `    status: z.enum(['active', 'free', 'bankrupt']), eliminatedMonth: z.number().int().positive().nullable(),
    freedomStreak: z.number().int().nonnegative(),
    botStrategy: z.enum(['careful', 'balanced', 'aggressive']).optional(),`,
)
replaceRequired(savePath, `export const SAVE_KEY = 'vyhod-iz-kruga-save-v7'`, `export const SAVE_KEY = 'vyhod-iz-kruga-save-v8'`)

const economyPath = 'src/game/systems/economy.ts'
const economySource = `import { difficultySettings } from '../content/content'
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
                : \`Банк готов дать не больше \${limit.toLocaleString('ru-RU')} ₽\`
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
`
write(economyPath, economySource)

const enginePath = 'src/game/engine/engine.ts'
replaceRegexRequired(
  enginePath,
  /import \{ assessLoan,[^\n]+\} from '\.\.\/systems\/economy'/,
  `import { assessLoan, assetCashflow, assetMarketValue, createMonthlyReport, isBankrupt, isFinanciallyFree, loanPayment, meetsFreedomConditions, monthlyExpenses, pledgedLoanForAsset } from '../systems/economy'`,
)
replaceRequired(enginePath, `  version: 7,`, `  version: 8,`)
replaceRequired(enginePath, `    eliminatedMonth: null,
    botStrategy:`, `    eliminatedMonth: null,
    freedomStreak: 0,
    botStrategy:`)

replaceRegexRequired(
  enginePath,
  /const updateAssetMarket = \(state: GameState, player: Player\) => \{[\s\S]*?\n\}\n\nconst updateStockMarket/,
  `const updateAssetMarket = (state: GameState, player: Player) => {
  const settings = difficultySettings[state.difficulty]
  player.assets.forEach((asset) => {
    const marketMove = (random(state) * 2 - 1) * settings.marketVolatility
    const businessQuality = Math.min(0.06, asset.developmentLevel * 0.012)
    const currentValue = assetMarketValue(asset)
    asset.marketValue = Math.max(Math.round(asset.price * asset.ownership * 0.55), Math.round(currentValue * (1 + marketMove + businessQuality)))
    asset.saleOffer = null
    asset.offerExpiresMonth = null
    if (random(state) < settings.offerChance) {
      const premium = 0.91 + random(state) * 0.24 + asset.developmentLevel * 0.01
      asset.saleOffer = Math.round(asset.marketValue * premium)
      asset.offerExpiresMonth = state.month + 1
    }

    const performanceFloor = state.difficulty === 'easy' ? 0.9 : state.difficulty === 'normal' ? 0.78 : 0.65
    const performanceCeiling = state.difficulty === 'easy' ? 1.12 : state.difficulty === 'normal' ? 1.15 : 1.22
    const qualityBonus = Math.min(0.08, asset.developmentLevel * 0.018)
    asset.performanceMultiplier = Math.min(1.3, performanceFloor + random(state) * (performanceCeiling - performanceFloor) + qualityBonus)
    if (!player.isBot && asset.performanceMultiplier < 0.82) {
      addEvent(state, 'Слабый месяц бизнеса', \`\${asset.name}: спрос просел, выручка ниже плана.\`, 'bad')
    } else if (!player.isBot && asset.performanceMultiplier > 1.12) {
      addEvent(state, 'Сильный месяц бизнеса', \`\${asset.name}: продажи превысили ожидания.\`, 'good')
    }

    if (asset.loan > 0) {
      const annualRate = asset.loanAnnualRate || 0.22
      const monthlyInterest = Math.round(asset.loan * annualRate / 12)
      const principalPayment = Math.max(0, asset.monthlyPayment - monthlyInterest)
      asset.loan = Math.max(0, asset.loan - principalPayment)
      asset.loanTermMonths = Math.max(0, asset.loanTermMonths - 1)
      asset.monthlyPayment = asset.loan > 0 ? loanPayment(asset.loan, annualRate, Math.max(1, asset.loanTermMonths)) : 0
    }
  })
  player.loans.forEach((loan) => {
    const interest = Math.round(loan.balance * loan.annualRate / 12)
    const principalPayment = Math.max(0, loan.monthlyPayment - interest)
    loan.balance = Math.max(0, loan.balance - principalPayment)
    loan.termMonths = Math.max(0, loan.termMonths - 1)
    loan.monthlyPayment = loan.balance > 0 ? loanPayment(loan.balance, loan.annualRate, Math.max(1, loan.termMonths)) : 0
  })
  player.loans = player.loans.filter((loan) => loan.balance > 0)
}

const updateStockMarket`,
)

replaceRegexRequired(
  enginePath,
  /const settleMonth = \(state: GameState\) => \{[\s\S]*?\n\}\n\nconst advanceCalendar/,
  `const settleMonth = (state: GameState) => {
  const nextMonth = state.month + 1
  const resaleReturns = state.players.map((player) => player.status === 'active' ? settleResales(state, player, nextMonth) : 0)
  const humanReport = createMonthlyReport(state.players[0], state.month, state.stockMarket, resaleReturns[0])
  state.players.forEach((player, index) => {
    if (player.status !== 'active') return
    const report = createMonthlyReport(player, state.month, state.stockMarket, resaleReturns[index])
    player.cash += report.netCashflow
    player.baseDebt = Math.max(0, player.baseDebt - Math.round(player.baseDebt * 0.014))
  })
  state.players.forEach((player) => {
    if (player.status === 'active') updateAssetMarket(state, player)
  })
  updateStockMarket(state)
  state.month = nextMonth
  state.day = 1
  state.players.forEach((player) => {
    if (player.status !== 'active') return
    player.freedomStreak = meetsFreedomConditions(player, state.stockMarket, state.month) ? player.freedomStreak + 1 : 0
  })
  state.lastMonthlyReport = humanReport
  addEvent(state, 'Итоги месяца', \`Чистый результат: \${humanReport.netCashflow.toLocaleString('ru-RU')} ₽\`, humanReport.netCashflow >= 0 ? 'good' : 'bad')
}

const advanceCalendar`,
)

replaceAllRequired(
  enginePath,
  `const projectedAssetPayment = Math.round(business.loan * ownership * 0.015)`,
  `const projectedAssetPayment = loanPayment(Math.round(business.loan * ownership), business.loanAnnualRate, business.loanTermMonths)`,
)
replaceRequired(
  enginePath,
  `    monthlyPayment: Math.round(assetLoan * 0.015),
    purchaseMonth: state.month,`,
  `    monthlyPayment: loanPayment(assetLoan, business.loanAnnualRate, business.loanTermMonths),
    purchaseMonth: state.month,
    performanceMultiplier: 1,`,
)

replaceRegexRequired(
  enginePath,
  /const sellAsset = \(player: Player, asset: Asset, grossPrice: number\) => \{[\s\S]*?\n\}\n\nconst awardProgress/,
  `const sellAsset = (player: Player, asset: Asset, grossPrice: number) => {
  const collateralLoan = pledgedLoanForAsset(player, asset.id)
  const collateralDebt = collateralLoan?.balance ?? 0
  const assetDebtPayment = Math.min(grossPrice, asset.loan)
  const assetDebtShortfall = Math.max(0, asset.loan - grossPrice)
  const equityBeforeCollateral = Math.max(0, grossPrice - asset.loan)
  const collateralPayment = Math.min(equityBeforeCollateral, collateralDebt)
  const proceeds = equityBeforeCollateral - collateralPayment

  if (assetDebtShortfall > 0) {
    const annualRate = 0.29
    const termMonths = 36
    player.loans.push({
      id: \`shortfall-\${asset.id}\`,
      name: \`Остаток долга: \${asset.name}\`,
      balance: assetDebtShortfall,
      monthlyPayment: loanPayment(assetDebtShortfall, annualRate, termMonths),
      annualRate,
      termMonths,
    })
  }

  if (collateralLoan) {
    collateralLoan.balance -= collateralPayment
    collateralLoan.collateralAssetId = undefined
    collateralLoan.monthlyPayment = collateralLoan.balance > 0 ? loanPayment(collateralLoan.balance, collateralLoan.annualRate, Math.max(1, collateralLoan.termMonths)) : 0
    if (collateralLoan.balance === 0) player.loans = player.loans.filter((loan) => loan.id !== collateralLoan.id)
  }
  player.cash += proceeds
  player.assets = player.assets.filter((item) => item.id !== asset.id)
  return { proceeds, collateralPayment, assetDebtPayment, assetDebtShortfall }
}

const awardProgress`,
)

replaceRequired(
  enginePath,
  `      const weakAsset = assetCashflow(asset) < 0
      if ((offerPremium > (strategy === 'aggressive' ? 1.16 : 1.08) || weakAsset) && random(state) < settings.botActivity) {
        bot.cash += Math.max(0, (asset.saleOffer ?? assetMarketValue(asset)) - asset.loan)
        bot.assets = bot.assets.filter((item) => item.id !== asset.id)
        addEvent(state, 'Соперник продал актив', \`\${bot.name} вышел из \${asset.name}\`)
      }`,
  `      const weakAsset = assetCashflow(asset, state.month) < 0
      if ((offerPremium > (strategy === 'aggressive' ? 1.16 : 1.08) || weakAsset) && random(state) < settings.botActivity) {
        sellAsset(bot, asset, asset.saleOffer ?? assetMarketValue(asset))
        addEvent(state, 'Соперник продал актив', \`\${bot.name} вышел из \${asset.name}\`)
      }`,
)

replaceRegexRequired(
  enginePath,
  /    if \(cell\.type === 'business' && random\(state\) < settings\.botActivity \* risk\) \{[\s\S]*?\n    \}\n    if \(cell\.type === 'expense'\)/,
  `    if (cell.type === 'business' && random(state) < settings.botActivity * risk) {
      const unlocked = businesses.filter((item) => item.requiredLevel <= playerLevel(bot))
      const ranked = unlocked
        .map((business) => {
          const payment = loanPayment(business.loan, business.loanAnnualRate, business.loanTermMonths)
          const flow = business.revenue - business.operatingCosts - payment
          return { business, flow, score: flow / Math.max(1, business.downPayment) }
        })
        .filter((item) => item.flow > 0)
        .sort((a, b) => b.score - a.score)
      const shortlist = ranked.slice(0, Math.max(1, Math.min(4, ranked.length)))
      const selected = shortlist[Math.floor(random(state) * shortlist.length)]
      const business = selected?.business
      const reserve = monthlyExpenses(bot, state.month) * (strategy === 'careful' ? 1.5 : strategy === 'aggressive' ? 0.5 : 1)
      if (business && bot.cash > business.downPayment * 0.35 + reserve) {
        const funding: Funding = bot.cash >= business.downPayment + reserve
          ? 'cash'
          : bot.cash >= business.downPayment * 0.5 + reserve
            ? 'partner50'
            : 'credit'
        const discount = random(state) < settings.negotiationChance * 0.6 ? 0.92 : 1
        const asset = makeAsset(state, bot, business.id, funding, Math.round(business.price * discount))
        if (asset) {
          bot.assets.push(asset)
          awardProgress(state, bot, 65, 'finance', 10)
          addEvent(state, 'Ход соперника', \`\${bot.name} купил \${business.name}\${discount < 1 ? ' после торга' : ''}\`)
        }
      }
    }
    if (cell.type === 'growth' && random(state) < settings.botActivity * 0.75) {
      const skillId = strategy === 'careful' ? 'finance' : strategy === 'aggressive' ? 'marketing' : bot.assets.length >= 3 ? 'management' : 'finance'
      const cost = trainingCost(bot, skillId)
      const reserve = monthlyExpenses(bot, state.month) * (strategy === 'careful' ? 1.5 : 0.75)
      if (bot.cash > cost + reserve && skillLevel(bot, skillId) < 3) {
        bot.cash -= cost
        awardProgress(state, bot, 65, skillId, 45)
      }
    }
    if (cell.type === 'expense')`,
)

replaceAllRequired(enginePath, `isFinanciallyFree(player, state.stockMarket)`, `isFinanciallyFree(player, state.stockMarket, state.month)`)
replaceAllRequired(enginePath, `isBankrupt(player, state.stockMarket)`, `isBankrupt(player, state.stockMarket, state.month)`)
replaceRequired(
  enginePath,
  `addEvent(started, 'Партия началась', 'Цель - покрыть расходы пассивным доходом.', 'good')`,
  `addEvent(started, 'Партия началась', 'Цель — выполнить все условия свободы и удержать их три месяца подряд.', 'good')`,
)

const appPath = 'src/App.tsx'
replaceRequired(
  appPath,
  `import { assessLoan, assetCashflow, assetLiquidationProceeds, assetMarketValue, availableCollateral, competitionStandings, freedomProgress, monthlyCashflow, monthlyExpenses, monthlyStockDividends, netWorth, passiveIncome, pledgedLoanForAsset, stockMarketValue, totalDebt } from './game/systems/economy'`,
  `import { assessLoan, assetCashflow, assetLiquidationProceeds, assetMarketValue, availableCollateral, competitionStandings, freedomProgress, freedomRequirements, loanPayment, monthlyCashflow, monthlyExpenses, monthlyStockDividends, netWorth, passiveIncome, pledgedLoanForAsset, stockMarketValue, totalDebt } from './game/systems/economy'`,
)
replaceRequired(
  appPath,
  `  const freedom = Math.min(100, Math.round((passiveIncome(player, game.stockMarket) / Math.max(1, monthlyExpenses(player))) * 100))
  const report = game.lastMonthlyReport`,
  `  const freedom = freedomProgress(player, game.stockMarket, game.month)
  const requirements = freedomRequirements(player, game.stockMarket, game.month)
  const report = game.lastMonthlyReport`,
)
replaceRequired(
  appPath,
  `      <div className="progress"><i style={{ width: \`\${freedom}%\` }} /></div>
      <div className="stats-grid">`,
  `      <div className="progress"><i style={{ width: \`\${freedom}%\` }} /></div>
      <div className="freedom-checklist">
        <span className={requirements.incomeCovered ? 'done' : ''}><i>{requirements.incomeCovered ? '✓' : '1'}</i><b>Пассивный доход</b><small>{Math.round(requirements.incomeCoverage * 100)}% покрытия</small></span>
        <span className={requirements.reserveReady ? 'done' : ''}><i>{requirements.reserveReady ? '✓' : '2'}</i><b>Резерв ×3</b><small>{requirements.reserveReady ? 'Собран' : \`Не хватает \${money(requirements.reserveShortfall)}\`}</small></span>
        <span className={requirements.debtLoadReady && requirements.unsecuredDebtReady ? 'done' : ''}><i>{requirements.debtLoadReady && requirements.unsecuredDebtReady ? '✓' : '3'}</i><b>Безопасный долг</b><small>Платежи {Math.round(requirements.debtServiceLoad * 100)}%</small></span>
        <span className={requirements.streakReady ? 'done' : ''}><i>{requirements.streakReady ? '✓' : '4'}</i><b>Удержать результат</b><small>{player.freedomStreak}/3 месяца</small></span>
      </div>
      <div className="stats-grid">`,
)
replaceAllRequired(appPath, `passiveIncome(player, game.stockMarket)`, `passiveIncome(player, game.stockMarket, game.month)`)
replaceAllRequired(appPath, `monthlyExpenses(player)`, `monthlyExpenses(player, game.month)`)
replaceAllRequired(appPath, `monthlyCashflow(player, game.stockMarket)`, `monthlyCashflow(player, game.stockMarket, game.month)`)
replaceAllRequired(appPath, `freedomProgress(player, game.stockMarket)`, `freedomProgress(player, game.stockMarket, game.month)`)
replaceAllRequired(appPath, `competitionStandings(game.players, game.stockMarket)`, `competitionStandings(game.players, game.stockMarket, game.month)`)
replaceAllRequired(appPath, `freedomProgress(rival, game.stockMarket)`, `freedomProgress(rival, game.stockMarket, game.month)`)
replaceRequired(
  appPath,
  `      const cashflow = monthlyCashflow(rival, game.stockMarket)`,
  `      const cashflow = passiveIncome(rival, game.stockMarket, game.month) - monthlyExpenses(rival, game.month)`,
)
replaceRequired(appPath, `<span>Поток <b className={cashflow >= 0 ? 'good' : 'bad'}>`, `<span>Пассивный разрыв <b className={cashflow >= 0 ? 'good' : 'bad'}>`)
replaceAllRequired(appPath, `assetCashflow(asset)`, `assetCashflow(asset, game.month)`)
replaceRequired(appPath, `const payment = Math.round(business.loan * 0.015)`, `const payment = loanPayment(business.loan, business.loanAnnualRate, business.loanTermMonths)`)
replaceAllRequired(appPath, `freedomProgress(player, game.stockMarket)}% пути`, `freedomProgress(player, game.stockMarket, game.month)}% пути`)
replaceRequired(
  appPath,
  `? \`\${winner?.name ?? 'Игрок'} первым покрыл расходы пассивным доходом.\``,
  `? \`\${winner?.name ?? 'Игрок'} выполнил все условия свободы и удержал их три месяца.\``,
)

const cssPath = 'src/premium.css'
const cssMarker = '/* freedom checklist v1.2 */'
if (!read(cssPath).includes(cssMarker)) {
  fs.appendFileSync(cssPath, `

${cssMarker}
.freedom-checklist{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0 16px}
.freedom-checklist span{display:grid;grid-template-columns:26px 1fr;grid-template-rows:auto auto;column-gap:8px;align-items:center;padding:10px 11px;border:1px solid rgba(20,62,51,.12);border-radius:14px;background:rgba(255,255,255,.52)}
.freedom-checklist span>i{grid-row:1/3;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#e7e2d8;color:#615d55;font-style:normal;font-weight:800;font-size:12px}
.freedom-checklist span>b{font-size:12px;line-height:1.2;color:#282b2d}
.freedom-checklist span>small{font-size:10px;line-height:1.2;color:#858a90;margin-top:2px}
.freedom-checklist span.done{border-color:rgba(19,119,84,.25);background:rgba(224,243,234,.62)}
.freedom-checklist span.done>i{background:#137754;color:white}
@media(max-width:350px){.freedom-checklist{grid-template-columns:1fr}}
`)
}

const engineTestPath = 'src/game/engine/engine.test.ts'
replaceRequired(
  engineTestPath,
  `import { assessLoan, assetCashflow, competitionStandings, freedomProgress, isFinanciallyFree, monthlyCashflow, monthlyExpenses, monthlyStockDividends, netWorth, passiveIncome, stockMarketValue } from '../systems/economy'`,
  `import { assessLoan, assetCashflow, competitionStandings, freedomProgress, isFinanciallyFree, loanPayment, monthlyCashflow, monthlyExpenses, monthlyStockDividends, netWorth, passiveIncome, stockMarketValue } from '../systems/economy'`,
)
replaceAllRequired(
  engineTestPath,
  `monthlyPayment: Math.round(business.loan * 0.015)`,
  `monthlyPayment: loanPayment(business.loan, business.loanAnnualRate, business.loanTermMonths)`,
)
replaceRequired(engineTestPath, `expect(assetCashflow(player.assets[0])).toBe(41_050)`, `expect(assetCashflow(player.assets[0])).toBe(8_507)`)
replaceRequired(engineTestPath, `expect(passiveIncome(player)).toBe(41_050)`, `expect(passiveIncome(player)).toBe(8_507)`)
replaceRequired(engineTestPath, `expect(monthlyCashflow(player)).toBe(85_450)`, `expect(monthlyCashflow(player)).toBe(52_907)`)
replaceRequired(engineTestPath, `expect(asset.revenue).toBe(36_000)`, `expect(asset.revenue).toBe(31_000)`)
replaceRequired(engineTestPath, `expect(asset.revenue).toBe(83_520)`, `expect(asset.revenue).toBe(66_960)`)
replaceRequired(engineTestPath, `expect(result.state.players[0].assets[0].revenue).toBe(43_200)`, `expect(result.state.players[0].assets[0].revenue).toBe(37_200)`)
replaceRequired(engineTestPath, `expect(result.state.players[0].cash).toBe(500_000 - 31_488)`, `expect(result.state.players[0].cash).toBe(500_000 - 39_360)`)
replaceRequired(engineTestPath, `expect(result.state.players[0].assets[0].revenue).toBe(92_160)`, `expect(result.state.players[0].assets[0].revenue).toBe(74_400)`)
replaceRequired(
  engineTestPath,
  `    bot.deposit = Math.ceil(monthlyExpenses(bot) / 0.009) + 1_000_000`,
  `    bot.deposit = Math.ceil(monthlyExpenses(bot) / 0.009) + 1_000_000
    bot.freedomStreak = 3`,
)
replaceRegexRequired(
  engineTestPath,
  /  it\('requires a three-month liquid reserve before declaring financial freedom',[\s\S]*?\n  \}\)\n/,
  `  it('requires a three-month liquid reserve and a three-month streak before declaring financial freedom', () => {
    const game = startedGame()
    const player = game.players[0]
    player.assets = Array.from({ length: 2 }, (_, index) => ({ ...testAsset('medical', player.id), id: \`medical-\${index}\` }))
    player.cash = 0
    expect(passiveIncome(player, game.stockMarket)).toBeGreaterThanOrEqual(monthlyExpenses(player))
    expect(isFinanciallyFree(player, game.stockMarket)).toBe(false)
    player.cash = monthlyExpenses(player) * 3
    player.freedomStreak = 2
    expect(isFinanciallyFree(player, game.stockMarket)).toBe(false)
    player.freedomStreak = 3
    expect(isFinanciallyFree(player, game.stockMarket)).toBe(true)
  })
`,
)

const balanceTestPath = 'src/game/engine/balance.test.ts'
replaceRequired(
  balanceTestPath,
  `import { assessLoan, isFinanciallyFree, monthlyExpenses, portfolioManagementCost } from '../systems/economy'`,
  `import { assessLoan, assetCashflow, freedomProgress, isFinanciallyFree, loanPayment, monthlyExpenses, portfolioManagementCost } from '../systems/economy'`,
)
replaceAllRequired(
  balanceTestPath,
  `monthlyPayment: Math.round(business.loan * 0.015)`,
  `monthlyPayment: loanPayment(business.loan, business.loanAnnualRate, business.loanTermMonths)`,
)
replaceRequired(
  balanceTestPath,
  `    const projectedPayment = Math.round(pickup.loan * 0.015)`,
  `    const projectedPayment = loanPayment(pickup.loan, pickup.loanAnnualRate, pickup.loanTermMonths)`,
)
replaceRequired(
  balanceTestPath,
  `    player.loans.push({`,
  `    player.freedomStreak = 3
    player.loans.push({`,
)

const v12TestPath = 'src/game/engine/balance-v12.test.ts'
write(v12TestPath, `import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import type { Asset } from '../domain/types'
import { assetCashflow, freedomProgress, freedomRequirements, loanPayment, monthlyExpenses } from '../systems/economy'
import { emptyGame, executeCommand } from './engine'

const startedGame = (seed = 501) =>
  executeCommand(emptyGame(seed), { type: 'START_GAME', professionId: 'trainer', botCount: 2, difficulty: 'normal', seed }).state

const makeAsset = (businessId: string, ownerId: string, purchaseMonth: number): Asset => {
  const business = businesses.find((item) => item.id === businessId)!
  return {
    ...business,
    id: \`\${business.id}-test\`,
    ownerId,
    ownership: 1,
    monthlyPayment: loanPayment(business.loan, business.loanAnnualRate, business.loanTermMonths),
    purchaseMonth,
    developmentLevel: 0,
    developments: [],
    totalDevelopmentCost: 0,
    lastDevelopedMonth: null,
    saleOffer: null,
    offerExpiresMonth: null,
    performanceMultiplier: 1,
  }
}

describe('balance v1.2', () => {
  it('keeps ordinary business payback in a strategic range', () => {
    for (const business of businesses.filter((item) => item.loan > 0 && item.requiredLevel <= 3)) {
      const payment = loanPayment(business.loan, business.loanAnnualRate, business.loanTermMonths)
      const flow = business.revenue - business.operatingCosts - payment
      const paybackMonths = business.downPayment / flow
      expect(flow).toBeGreaterThan(0)
      expect(paybackMonths).toBeGreaterThanOrEqual(14)
    }
  })

  it('makes a newly purchased business unprofitable during launch ramp-up', () => {
    const game = startedGame()
    const asset = makeAsset('coffee', game.players[0].id, game.month)
    expect(assetCashflow(asset, game.month)).toBeLessThan(0)
    expect(assetCashflow(asset, game.month + 3)).toBeGreaterThan(0)
  })

  it('turns excess businesses into a real management cost', () => {
    const game = startedGame()
    const player = game.players[0]
    player.assets = Array.from({ length: 9 }, (_, index) => ({ ...makeAsset('coffee', player.id, 1), id: \`coffee-\${index}\` }))
    expect(monthlyExpenses(player, 5)).toBeGreaterThan(player.baseExpenses + Math.round(player.baseDebt * 0.02) + 150_000)
  })

  it('does not show 100 percent freedom when reserve or streak is missing', () => {
    const game = startedGame()
    const player = game.players[0]
    player.assets = Array.from({ length: 2 }, (_, index) => ({ ...makeAsset('medical', player.id, 1), id: \`medical-\${index}\` }))
    player.cash = 0
    player.freedomStreak = 0
    const requirements = freedomRequirements(player, game.stockMarket, 5)
    expect(requirements.incomeCovered).toBe(true)
    expect(requirements.reserveReady).toBe(false)
    expect(freedomProgress(player, game.stockMarket, 5)).toBeLessThan(100)
  })

  it('keeps the unpaid business debt after a distressed sale', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = makeAsset('coffee', player.id, 1)
    asset.marketValue = 100_000
    player.assets.push(asset)
    const result = executeCommand(game, { type: 'SELL_ASSET', assetId: asset.id })
    expect(result.accepted).toBe(true)
    expect(result.state.players[0].assets).toHaveLength(0)
    expect(result.state.players[0].loans.some((loan) => loan.name.includes('Остаток долга'))).toBe(true)
  })
})
`)

console.log('Balance v1.2 source transformation complete')
