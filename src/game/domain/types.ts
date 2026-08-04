export type PlayerId = string
export type Phase = 'setup' | 'ready' | 'decision' | 'victory'
export type CellType = 'salary' | 'business' | 'market' | 'expense' | 'chance' | 'bank' | 'growth'

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
}

export interface Asset extends BusinessTemplate {
  ownerId: PlayerId
  ownership: number
  marketValue?: number
  monthlyPayment: number
  purchaseMonth: number
}

export interface Loan {
  id: string
  name: string
  balance: number
  monthlyPayment: number
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
}

export type Decision =
  | { kind: 'business'; businessId: string }
  | { kind: 'expense'; title: string; amount: number }
  | { kind: 'chance'; title: string; investment: number; returnAmount: number }
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
  livingExpenses: number
  operatingCosts: number
  assetDebtPayments: number
  loanPayments: number
  netCashflow: number
  endingCash: number
}

export interface GameState {
  version: 2
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
}

export type Funding = 'cash' | 'credit' | 'partner30' | 'partner50'

export type GameCommand =
  | { type: 'START_GAME'; professionId: string; botCount?: number; seed?: number }
  | { type: 'ROLL_DICE' }
  | { type: 'BUY_BUSINESS'; funding: Funding }
  | { type: 'SELL_ASSET'; assetId: string }
  | { type: 'SKIP_DECISION' }
  | { type: 'PAY_EXPENSE'; withCredit?: boolean }
  | { type: 'TAKE_CHANCE' }
  | { type: 'DEPOSIT'; amount: number }
  | { type: 'WITHDRAW_DEPOSIT'; amount: number }
  | { type: 'BUY_BONDS'; amount: number }
  | { type: 'SELL_BONDS'; amount: number }
  | { type: 'TAKE_LOAN'; amount: number }
  | { type: 'REPAY_LOAN'; amount: number }
  | { type: 'TRAIN'; cost: number }

export interface CommandResult {
  state: GameState
  accepted: boolean
  error?: string
}
