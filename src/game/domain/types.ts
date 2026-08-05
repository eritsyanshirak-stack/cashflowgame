export type PlayerId = string
export type Phase = 'setup' | 'ready' | 'decision' | 'finished'
export type CellType = 'salary' | 'business' | 'market' | 'expense' | 'chance' | 'bank' | 'growth' | 'contract' | 'auction' | 'partnership' | 'management'
export type Difficulty = 'easy' | 'normal' | 'hard'
export type BotStrategy = 'careful' | 'balanced' | 'aggressive'
export type RiskRating = 'low' | 'medium' | 'high'
export type AssetStatus = 'launching' | 'active' | 'stressed' | 'suspended'
export type DueDiligence = 'none' | 'basic' | 'full'
export type BusinessIssue = 'none' | 'documents' | 'lease' | 'repair' | 'hidden-debt'
export type SkillId = 'negotiation' | 'marketing' | 'management' | 'finance' | 'brand'
export type Specialization = 'operator' | 'negotiator' | 'investor' | 'entrepreneur'
export type BuyerArchetype = 'urgent' | 'strategic' | 'speculator' | 'management'

export interface DealProfile {
  id: string
  location: string
  leaseMonths: number
  equipmentCondition: 'poor' | 'fair' | 'good' | 'excellent'
  equipmentLabel: string
  ownerDependency: 'low' | 'medium' | 'high'
  ownerDependencyLabel: string
  customerRating: number
  sellerReason: string
  revenueMultiplier: number
  costMultiplier: number
  valueMultiplier: number
  declaredRevenue: number
  declaredCosts: number
}

export interface SellerCounter {
  price: number
  term: 'transition' | 'warranty' | 'repairCredit' | 'sellerFinancing'
  note: string
}

export interface EventChain {
  id: string
  kind: 'deferredExpense' | 'equipment' | 'ownerExit'
  title: string
  description: string
  resolvesMonth: number
  assetId?: string
  amount?: number
}

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
  loanRate: number
  loanTermMonths: number
  riskRating: RiskRating
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
  status?: AssetStatus
  dueDiligence?: DueDiligence
  launchMonthsRemaining?: number
  incidentCooldown?: number
  issueMonths?: number
  missedPayments?: number
  legalIssue?: string
  issueCost?: number
  listingPrice?: number | null
  listingStartedMonth?: number | null
  listingExpiresMonth?: number | null
  insuredUntilMonth?: number | null
  externalRevenueMultiplier?: number
  dealProfile?: DealProfile
  synergyBonus?: number
  synergyLabel?: string
  transitionSupportUntilMonth?: number | null
  warrantyUntilMonth?: number | null
  purchaseCashContribution?: number
  cashInvested?: number
  lifetimeCashInvested?: number
  cashReturned?: number
  cumulativeNetCashflow?: number
  partnerName?: string
}

export interface Loan {
  id: string
  name: string
  balance: number
  monthlyPayment: number
  annualRate: number
  termMonths: number
  collateralAssetId?: string
  collateralStockId?: string
  collateralStockQuantity?: number
  relatedAssetId?: string
  missedPayments?: number
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
  averageMarketPrice?: number
  costBasis?: number
  marketCostBasis?: number
  purchaseFees?: number
  pledgedQuantity?: number
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

export interface ActiveContract {
  id: string
  title: string
  investment: number
  payout: number
  resolvesMonth: number
  successChance: number
  skillId: SkillId
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
  activeContracts: ActiveContract[]
  experience: number
  skills: SkillProgress
  status: PlayerStatus
  eliminatedMonth: number | null
  botStrategy?: BotStrategy
  freedomStreak?: number
  restructuringUsed?: boolean
  specialization?: Specialization
  jobActive?: boolean
  rivalIntent?: string
}

export interface GameOutcome {
  winnerId: PlayerId | null
  reason: 'freedom' | 'human-bankrupt' | 'last-solvent'
}

export interface ExpenseOption {
  id: 'full' | 'economy' | 'challenge'
  title: string
  description: string
  amount: number
  riskChance?: number
  riskAmount?: number
}

export interface ContractOption {
  id: 'safe' | 'balanced' | 'bold'
  title: string
  investment: number
  payout: number
  durationMonths: number
  successChance: number
  skillId: SkillId
}

export interface GlobalEvent {
  id: string
  title: string
  description: string
  category: string | null
  sector: string | null
  revenueMultiplier: number
  stockImpact: number
  creditRateDelta: number
  startsMonth: number
  expiresMonth: number
}

export interface BuyerOffer {
  id: string
  assetId: string
  buyerName: string
  askingPrice: number
  offeredPrice: number
  marketValue: number
  round: 1 | 2
  final: boolean
  expiresMonth: number
  archetype?: BuyerArchetype
  buyerPlayerId?: string
}

export interface MarginCall {
  stockId: string
  loanId: string
  pledgedQuantity: number
  marketValue: number
  balance: number
  requiredPayment: number
}

export type Decision =
  | { kind: 'business'; businessId: string; askingPrice: number; originalAskingPrice?: number; negotiated: boolean; negotiationNote?: string; inspection?: DueDiligence; hiddenIssue?: BusinessIssue; issueRevealed?: boolean; profile?: DealProfile; revealedFacts?: string[]; sellerCounter?: SellerCounter; sellerTerm?: SellerCounter['term'] }
  | { kind: 'opportunity'; opportunityId: string; businessId: string; askingPrice: number; originalAskingPrice?: number; title: string; description: string; negotiationNote?: string; inspection?: DueDiligence; hiddenIssue?: BusinessIssue; issueRevealed?: boolean; profile?: DealProfile; revealedFacts?: string[]; sellerCounter?: SellerCounter; sellerTerm?: SellerCounter['term'] }
  | { kind: 'expense'; title: string; amount: number; options?: ExpenseOption[] }
  | { kind: 'chance'; title: string; investment: number; minReturn: number; maxReturn: number; durationMonths: number }
  | { kind: 'contract'; title: string; description: string; options: ContractOption[] }
  | { kind: 'auction'; businessId: string; title: string; currentBid: number; marketValue: number; minimumStep: number; inspected: boolean; issue?: BusinessIssue; issueRevealed?: boolean; botCeilings: number[]; leadingBot: number | null }
  | { kind: 'partnership'; businessId: string; title: string; description: string; discount: number; originalDiscount: number; partnerName: string; negotiated?: boolean; negotiationSucceeded?: boolean; negotiationNote?: string }
  | { kind: 'management' }
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
  contractReturns?: number
  livingExpenses: number
  operatingCosts: number
  assetDebtPayments: number
  loanPayments: number
  netCashflow: number
  endingCash: number
}

export interface RecentCards {
  business: string[]
  expense: string[]
  chance: string[]
  contract: string[]
  global: string[]
}

export interface GameState {
  version: 11
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
  globalEvent: GlobalEvent | null
  recentCards: RecentCards
  buyerOffers: BuyerOffer[]
  activeMarginCall: MarginCall | null
  eventChains: EventChain[]
  outcome: GameOutcome | null
}

export type Funding = 'cash' | 'credit' | 'secured' | 'partner30' | 'partner50'
export type BuyerOfferAction = 'accept' | 'reject' | 'counter5' | 'counter10' | 'counter15'

export type GameCommand =
  | { type: 'START_GAME'; professionId: string; botCount?: number; difficulty?: Difficulty; seed?: number }
  | { type: 'ROLL_DICE' }
  | { type: 'NEGOTIATE_BUSINESS'; offerPercent: 0.85 | 0.9 | 0.95 }
  | { type: 'RESPOND_SELLER_COUNTER'; action: 'acceptPrice' | 'acceptTerm' | 'keepOriginal' }
  | { type: 'INSPECT_BUSINESS'; level: 'basic' | 'full' }
  | { type: 'BUY_BUSINESS'; funding: Funding; collateralAssetId?: string; saleAssetIds?: string[] }
  | { type: 'BUY_OPPORTUNITY'; funding: Funding; collateralAssetId?: string; saleAssetIds?: string[] }
  | { type: 'SELL_ASSET'; assetId: string }
  | { type: 'SELL_ASSET_SHARE'; assetId: string; percent: 10 | 25 | 50 }
  | { type: 'LIST_ASSET'; assetId: string; askingPrice: number }
  | { type: 'CANCEL_ASSET_LISTING'; assetId: string }
  | { type: 'RESPOND_BUYER_OFFER'; offerId: string; action: BuyerOfferAction }
  | { type: 'ACCEPT_SALE_OFFER'; assetId: string }
  | { type: 'DEVELOP_ASSET'; assetId: string; developmentId: string }
  | { type: 'RESOLVE_ASSET_ISSUE'; assetId: string }
  | { type: 'BUY_PARTNER_SHARE'; assetId: string }
  | { type: 'SELL_PARTNER_SHARE'; assetId: string }
  | { type: 'SKIP_DECISION' }
  | { type: 'PAY_EXPENSE'; withCredit?: boolean }
  | { type: 'RESOLVE_EXPENSE'; optionId: ExpenseOption['id']; withCredit?: boolean }
  | { type: 'TAKE_CHANCE' }
  | { type: 'TAKE_CONTRACT'; optionId: ContractOption['id'] }
  | { type: 'AUCTION_INSPECT' }
  | { type: 'AUCTION_BID'; amount: number }
  | { type: 'AUCTION_WITHDRAW' }
  | { type: 'NEGOTIATE_PARTNERSHIP'; request: 'small' | 'bold' }
  | { type: 'ACCEPT_PARTNERSHIP'; ownership: 0.3 | 0.5 }
  | { type: 'MANAGEMENT_ACTION'; action: 'refinance' | 'insure'; assetId?: string }
  | { type: 'DEPOSIT'; amount: number }
  | { type: 'WITHDRAW_DEPOSIT'; amount: number }
  | { type: 'BUY_BONDS'; amount: number }
  | { type: 'SELL_BONDS'; amount: number }
  | { type: 'BUY_STOCK'; stockId: string; quantity: number; funding?: 'cash' | 'credit' | 'secured'; collateralAssetId?: string; saleAssetIds?: string[]; shareSaleAssetId?: string; shareSalePercent?: 10 | 25 | 50 }
  | { type: 'SELL_STOCK'; stockId: string; quantity: number }
  | { type: 'PLEDGE_STOCK'; stockId: string; percent: 25 | 50 | 75 | 100 }
  | { type: 'RESOLVE_MARGIN_CALL'; action: 'pay' | 'sell' | 'close' }
  | { type: 'TAKE_LOAN'; amount: number; collateralAssetId?: string }
  | { type: 'REPAY_LOAN'; amount: number }
  | { type: 'TRAIN'; skillId: SkillId }
  | { type: 'CHOOSE_SPECIALIZATION'; specialization: Specialization }

export interface CommandResult {
  state: GameState
  accepted: boolean
  error?: string
}
