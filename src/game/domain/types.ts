export type PlayerId = string
export type Phase = 'setup' | 'ready' | 'decision' | 'finished'
export type CellType = 'salary' | 'business' | 'market' | 'expense' | 'chance' | 'bank' | 'growth'
export type Difficulty = 'easy' | 'normal' | 'hard'
export type BotStrategy = 'careful' | 'balanced' | 'aggressive'
export type SkillId = 'negotiation' | 'marketing' | 'management' | 'finance' | 'brand'

export type SkillProgress = Record<SkillId, number>
export type PlayerStatus = 'active' | 'free' | 'bankrupt'

export interface Profession {
  id: string
  name: string
  salary: number
  expenses: number
  cash: number
  debt: number
}

export interface BusinessTemplate {
  id: string
  name: string
  icon: string
  category: string
  price: number
  downPayment: number
  loan: number
  revenue: number
  operatingCosts: number
  requiredLevel: number
}

export interface Asset extends BusinessTemplate {
  ownerId: PlayerId
  ownership: number
  marketValue?: number
  monthlyPayment: number
  purchaseMonth: number
  developmentLevel: number
  developments: string[]
  totalDevelopmentCost: number
  lastDevelopedMonth: number | null
  saleOffer: number | null
  offerExpiresMonth: number | null
}

export interface Loan {
  id: string
  name: string
  balance: number
  monthlyPayment: number
  annualRate: number
  termMonths: number
  collateralAssetId?: string
}

export interface StockQuote {
  id: string
  name: string
  ticker: string
  sector: string
  price: number
  previousPrice: number
  dividendYield: number
}

export interface StockHolding {
  stockId: string
  quantity: number
  averagePrice: number
}

export interface ResaleDeal {
  id: string
  title: string
  investment: number
  expectedMin: number
  expectedMax: number
  resolvesMonth: number
  outcomeAmount: number
  delays: number
}

export interface Player {
  id: PlayerId
  name: string
  isBot: boolean
  professionId: string
  position: number
  cash: number
  salary: number
  baseExpenses: number
  baseDebt: number
  assets: Asset[]
  loans: Loan[]
  deposit: number
  bonds: number
  stocks: StockHolding[]
  resaleDeals: ResaleDeal[]
  experience: number
  skills: SkillProgress
  status: PlayerStatus
  eliminatedMonth: number | null
  botStrategy?: BotStrategy
}

export interface GameOutcome {
  winnerId: PlayerId | null
  reason: 'freedom' | 'human-bankrupt' | 'last-solvent'
}

export type Decision =
  | { kind: 'business'; businessId: string; askingPrice: number; negotiated: boolean; negotiationNote?: string }
  | { kind: 'expense'; title: string; amount: number }
  | { kind: 'chance'; title: string; investment: number; minReturn: number; maxReturn: number; durationMonths: number }
  | { kind: 'market'; title: string; description: string }
  | { kind: 'bank' }
  | { kind: 'growth' }
  | { kind: 'salary' }

export interface GameEvent {
  id: string
  title: string
  description: string
  month: number
  day: number
  tone?: 'good' | 'bad' | 'neutral'
}

export interface MonthlyReport {
  month: number
  startingCash: number
  salary: number
  assetRevenue: number
  depositIncome: number
  bondIncome: number
  stockDividends: number
  resaleReturns: number
  livingExpenses: number
  operatingCosts: number
  assetDebtPayments: number
  loanPayments: number
  netCashflow: number
  endingCash: number
}

export interface GameState {
  version: 7
  seed: number
  phase: Phase
  day: number
  month: number
  round: number
  currentPlayerIndex: number
  lastRoll: number | null
  players: Player[]
  pendingDecision: Decision | null
  events: GameEvent[]
  lastMonthlyReport: MonthlyReport | null
  difficulty: Difficulty
  stockMarket: StockQuote[]
  marketHeadline: string
  outcome: GameOutcome | null
}

export type Funding = 'cash' | 'credit' | 'secured' | 'partner30' | 'partner50'

export type GameCommand =
  | { type: 'START_GAME'; professionId: string; botCount?: number; difficulty?: Difficulty; seed?: number }
  | { type: 'ROLL_DICE' }
  | { type: 'NEGOTIATE_BUSINESS'; offerPercent: 0.85 | 0.9 | 0.95 }
  | { type: 'BUY_BUSINESS'; funding: Funding; collateralAssetId?: string }
  | { type: 'SELL_ASSET'; assetId: string }
  | { type: 'ACCEPT_SALE_OFFER'; assetId: string }
  | { type: 'DEVELOP_ASSET'; assetId: string; developmentId: string }
  | { type: 'BUY_PARTNER_SHARE'; assetId: string }
  | { type: 'SELL_PARTNER_SHARE'; assetId: string }
  | { type: 'SKIP_DECISION' }
  | { type: 'PAY_EXPENSE'; withCredit?: boolean }
  | { type: 'TAKE_CHANCE' }
  | { type: 'DEPOSIT'; amount: number }
  | { type: 'WITHDRAW_DEPOSIT'; amount: number }
  | { type: 'BUY_BONDS'; amount: number }
  | { type: 'SELL_BONDS'; amount: number }
  | { type: 'BUY_STOCK'; stockId: string; quantity: number }
  | { type: 'SELL_STOCK'; stockId: string; quantity: number }
  | { type: 'TAKE_LOAN'; amount: number; collateralAssetId?: string }
  | { type: 'REPAY_LOAN'; amount: number }
  | { type: 'TRAIN'; skillId: SkillId }

export interface CommandResult {
  state: GameState
  accepted: boolean
  error?: string
}
