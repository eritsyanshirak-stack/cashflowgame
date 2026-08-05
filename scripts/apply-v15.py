from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    return (ROOT / path).read_text()

def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text)

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'missing replacement: {label}')
    return text.replace(old, new, 1)

def regex_once(text: str, pattern: str, replacement: str, label: str, flags=re.S) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'missing regex replacement: {label} ({count})')
    return updated

# ---------- domain types ----------
path = 'src/game/domain/types.ts'
text = read(path)
text = replace_once(text,
"export type SkillId = 'negotiation' | 'marketing' | 'management' | 'finance' | 'brand'\n",
"export type SkillId = 'negotiation' | 'marketing' | 'management' | 'finance' | 'brand'\nexport type Specialization = 'operator' | 'negotiator' | 'investor' | 'entrepreneur'\nexport type BuyerArchetype = 'urgent' | 'strategic' | 'speculator' | 'management'\n\nexport interface DealProfile {\n  id: string\n  location: string\n  leaseMonths: number\n  equipmentCondition: 'poor' | 'fair' | 'good' | 'excellent'\n  equipmentLabel: string\n  ownerDependency: 'low' | 'medium' | 'high'\n  ownerDependencyLabel: string\n  customerRating: number\n  sellerReason: string\n  revenueMultiplier: number\n  costMultiplier: number\n  valueMultiplier: number\n  declaredRevenue: number\n  declaredCosts: number\n}\n\nexport interface SellerCounter {\n  price: number\n  term: 'transition' | 'warranty' | 'repairCredit' | 'sellerFinancing'\n  note: string\n}\n\nexport interface EventChain {\n  id: string\n  kind: 'deferredExpense' | 'equipment' | 'ownerExit'\n  title: string\n  description: string\n  resolvesMonth: number\n  assetId?: string\n  amount?: number\n}\n",
'insert v15 types')
text = replace_once(text,
"  externalRevenueMultiplier?: number\n}",
"  externalRevenueMultiplier?: number\n  dealProfile?: DealProfile\n  synergyBonus?: number\n  synergyLabel?: string\n  transitionSupportUntilMonth?: number | null\n  warrantyUntilMonth?: number | null\n}",
'extend asset')
text = replace_once(text,
"  restructuringUsed?: boolean\n}",
"  restructuringUsed?: boolean\n  specialization?: Specialization\n  jobActive?: boolean\n  rivalIntent?: string\n}",
'extend player')
text = replace_once(text,
"  expiresMonth: number\n}",
"  expiresMonth: number\n  archetype?: BuyerArchetype\n  buyerPlayerId?: string\n}",
'extend buyer offer')
text = replace_once(text,
"  | { kind: 'business'; businessId: string; askingPrice: number; negotiated: boolean; negotiationNote?: string; inspection?: DueDiligence; hiddenIssue?: BusinessIssue; issueRevealed?: boolean }",
"  | { kind: 'business'; businessId: string; askingPrice: number; originalAskingPrice?: number; negotiated: boolean; negotiationNote?: string; inspection?: DueDiligence; hiddenIssue?: BusinessIssue; issueRevealed?: boolean; profile?: DealProfile; revealedFacts?: string[]; sellerCounter?: SellerCounter; sellerTerm?: SellerCounter['term'] }",
'extend business decision')
text = replace_once(text,
"  | { kind: 'opportunity'; opportunityId: string; businessId: string; askingPrice: number; title: string; description: string; inspection?: DueDiligence; hiddenIssue?: BusinessIssue; issueRevealed?: boolean }",
"  | { kind: 'opportunity'; opportunityId: string; businessId: string; askingPrice: number; originalAskingPrice?: number; title: string; description: string; inspection?: DueDiligence; hiddenIssue?: BusinessIssue; issueRevealed?: boolean; profile?: DealProfile; revealedFacts?: string[]; sellerCounter?: SellerCounter; sellerTerm?: SellerCounter['term'] }",
'extend opportunity decision')
text = text.replace('  version: 9\n', '  version: 10\n', 1)
text = replace_once(text,
"  activeMarginCall: MarginCall | null\n  outcome: GameOutcome | null\n}",
"  activeMarginCall: MarginCall | null\n  eventChains: EventChain[]\n  outcome: GameOutcome | null\n}",
'extend game state')
text = replace_once(text,
"  | { type: 'NEGOTIATE_BUSINESS'; offerPercent: 0.85 | 0.9 | 0.95 }\n",
"  | { type: 'NEGOTIATE_BUSINESS'; offerPercent: 0.85 | 0.9 | 0.95 }\n  | { type: 'RESPOND_SELLER_COUNTER'; action: 'acceptPrice' | 'acceptTerm' | 'keepOriginal' }\n",
'add seller counter command')
text = replace_once(text,
"  | { type: 'TRAIN'; skillId: SkillId }\n",
"  | { type: 'TRAIN'; skillId: SkillId }\n  | { type: 'CHOOSE_SPECIALIZATION'; specialization: Specialization }\n",
'add specialization command')
write(path, text)

# ---------- economy ----------
path = 'src/game/systems/economy.ts'
text = read(path)
text = replace_once(text,
"  Math.round(asset.revenue * assetRevenueMultiplier(asset) * (asset.externalRevenueMultiplier ?? 1))",
"  Math.round(asset.revenue * assetRevenueMultiplier(asset) * (asset.externalRevenueMultiplier ?? 1) * (1 + (asset.synergyBonus ?? 0)))",
'synergy revenue')
text = replace_once(text,
"  const freeCapacity = 3 + skillLevel(player, 'management')",
"  const freeCapacity = 3 + skillLevel(player, 'management') + (player.specialization === 'operator' ? 1 : 0)",
'operator capacity')
write(path, text)

# ---------- v14 systems ----------
path = 'src/game/systems/v14.ts'
text = read(path)
text = replace_once(text,
"import { skillLevel } from './progression'\n",
"import { skillLevel } from './progression'\nimport { buyerArchetypeLabel, buyerOfferMultiplier, chooseBuyerArchetype, contractSpecializationBonus, stockCollateralRatio } from './v15'\n",
'v14 imports')
text = replace_once(text,
"  const skillBonus = level * 0.06\n",
"  const skillBonus = level * 0.06\n  const specialization = contractSpecializationBonus(player)\n",
'contract specialization setup')
text = text.replace("payout: Math.round(card.basePayout * 0.72),", "payout: Math.round(card.basePayout * 0.72 * specialization.payout),", 1)
text = text.replace("successChance: Math.min(0.98, 0.9 + skillBonus),", "successChance: Math.min(0.99, 0.9 + skillBonus + specialization.success),", 1)
text = text.replace("payout: card.basePayout,", "payout: Math.round(card.basePayout * specialization.payout),", 1)
text = text.replace("successChance: Math.min(0.94, 0.72 + skillBonus),", "successChance: Math.min(0.98, 0.72 + skillBonus + specialization.success),", 1)
text = text.replace("payout: Math.round(card.basePayout * 2.05),", "payout: Math.round(card.basePayout * 2.05 * specialization.payout),", 1)
text = text.replace("successChance: Math.min(0.86, 0.5 + skillBonus),", "successChance: Math.min(0.94, 0.5 + skillBonus + specialization.success),", 1)
text = replace_once(text,
"export const availableStockCollateral = (player: Player, holding: StockHolding, quote: StockQuote) => {\n  if (stockCollateralLoan(player, holding.stockId)) return 0\n  return Math.floor(stockFreeQuantity(holding) * quote.price * 0.45)\n}",
"export const availableStockCollateral = (player: Player, holding: StockHolding, quote: StockQuote) => {\n  if (stockCollateralLoan(player, holding.stockId)) return 0\n  return Math.floor(stockFreeQuantity(holding) * quote.price * stockCollateralRatio(player))\n}",
'investor collateral ratio')
text = replace_once(text,
"  negotiationLevel: number,\n  random: () => number,\n): BuyerNegotiationResult => {",
"  negotiationLevel: number,\n  random: () => number,\n  specializationBonus = 0,\n): BuyerNegotiationResult => {",
'buyer negotiation signature')
text = replace_once(text,
"  const acceptanceChance = Math.max(0.07, Math.min(0.88, 0.68 + negotiationLevel * 0.06 - requestedPremium * 1.55 - jump * 1.8))",
"  const acceptanceChance = Math.max(0.07, Math.min(0.94, 0.68 + negotiationLevel * 0.06 + specializationBonus - requestedPremium * 1.55 - jump * 1.8))",
'buyer negotiation bonus')
# Buyer archetypes in listing generation.
text = replace_once(text,
"    const ratio = asset.listingPrice / marketValue\n    const fullPriceChance = ratio <= 1 ? 0.7 : ratio <= 1.1 ? 0.38 : ratio <= 1.2 ? 0.17 : 0.05\n    const acceptsAsking = random() < fullPriceChance\n    const bargainFactor = ratio <= 1 ? 0.97 + random() * 0.03 : 0.86 + random() * 0.12\n    const offeredPrice = acceptsAsking\n      ? asset.listingPrice\n      : Math.min(asset.listingPrice, Math.round(marketValue * bargainFactor))\n    const offer: BuyerOffer = {\n      id: eventId(state, `offer-${asset.id}`),\n      assetId: asset.id,\n      buyerName: buyerNames[Math.floor(random() * buyerNames.length)],",
"    const ratio = asset.listingPrice / marketValue\n    const archetype = chooseBuyerArchetype(asset, random)\n    const fullPriceChance = ratio <= 1 ? 0.7 : ratio <= 1.1 ? 0.38 : ratio <= 1.2 ? 0.17 : 0.05\n    const acceptsAsking = random() < fullPriceChance && archetype !== 'speculator'\n    const archetypePrice = Math.round(marketValue * buyerOfferMultiplier(asset, archetype, random))\n    const offeredPrice = acceptsAsking ? asset.listingPrice : Math.min(asset.listingPrice, archetypePrice)\n    const activeBots = state.players.filter((item) => item.isBot && item.status === 'active')\n    const botBuyer = activeBots.length > 0 && random() < 0.28 ? activeBots[Math.floor(random() * activeBots.length)] : undefined\n    const offer: BuyerOffer = {\n      id: eventId(state, `offer-${asset.id}`),\n      assetId: asset.id,\n      buyerName: botBuyer?.name ?? buyerArchetypeLabel[archetype],",
'buyer archetype block')
text = replace_once(text,
"      expiresMonth: state.month,\n    }",
"      expiresMonth: state.month,\n      archetype,\n      buyerPlayerId: botBuyer?.id,\n    }",
'buyer offer fields')
write(path, text)

# ---------- v14 core ----------
path = 'src/game/engine/v14Core.ts'
text = read(path)
text = replace_once(text,
"import { createStockMarginCall, negotiateBuyerOffer, pledgeStockLoanTerms, pushSystemEvent, stockFreeQuantity } from '../systems/v14'\n",
"import { createStockMarginCall, negotiateBuyerOffer, pledgeStockLoanTerms, pushSystemEvent, stockFreeQuantity } from '../systems/v14'\nimport { buyerNegotiationSpecializationBonus, scheduleExpenseChain, stockCollateralRatio } from '../systems/v15'\n",
'v14 core imports')
text = replace_once(text,
"  const result = negotiateBuyerOffer(offer, requestedPrice, skillLevel(player, 'negotiation'), random)",
"  const result = negotiateBuyerOffer(offer, requestedPrice, skillLevel(player, 'negotiation'), random, buyerNegotiationSpecializationBonus(player))",
'buyer negotiation specialization')
text = replace_once(text,
"    const amount = Math.floor(quantity * quote.price * 0.45)",
"    const amount = Math.floor(quantity * quote.price * stockCollateralRatio(player))",
'pledge ratio')
text = replace_once(text,
"    if (option.riskChance && option.riskAmount && random() < option.riskChance) {\n      player.loans.push({\n        id: `expense-risk-${state.month}-${state.day}`,\n        name: `Последствия: ${decision.title}`,\n        balance: option.riskAmount,\n        monthlyPayment: loanPayment(option.riskAmount, 0.34, 18),\n        annualRate: 0.34,\n        termMonths: 18,\n        missedPayments: 0,\n      })\n      pushSystemEvent(state, 'Экономия обернулась долгом', `${decision.title}: последствия ${option.riskAmount.toLocaleString('ru-RU')} ₽.`, 'bad')\n    } else pushSystemEvent(state, decision.title, `Расход закрыт за ${option.amount.toLocaleString('ru-RU')} ₽.`, 'neutral')",
"    if (option.riskChance && option.riskAmount && scheduleExpenseChain(state, decision.title, option.riskAmount, option.riskChance, random)) {\n      pushSystemEvent(state, 'Решение отложило риск', `${decision.title}: последствия могут вернуться в одном из следующих месяцев.`, 'neutral')\n    } else pushSystemEvent(state, decision.title, `Расход закрыт за ${option.amount.toLocaleString('ru-RU')} ₽.`, 'neutral')",
'delayed expense chain')
write(path, text)

# ---------- engine ----------
path = 'src/game/engine/engine.ts'
text = read(path)
text = replace_once(text,
"import { handleDecisionV14Command, handleReadyV14Command, quickSellAssetForFunding, sellAssetShareForFunding } from './v14Core'\n",
"import { handleDecisionV14Command, handleReadyV14Command, quickSellAssetForFunding, sellAssetShareForFunding } from './v14Core'\nimport { handleDecisionV15Command, handleReadyV15Command } from './v15Core'\nimport { applyDealProfileToAsset, createDealProfile, createSellerCounter, negotiationSpecializationBonus, refreshPortfolioSynergies, refreshRivalIntents, resolveEventChains, revealedDealFacts, scheduleDealChain } from '../systems/v15'\n",
'engine imports')
text = text.replace('  version: 9,', '  version: 10,', 1)
text = replace_once(text,
"  activeMarginCall: null,\n  outcome: null,",
"  activeMarginCall: null,\n  eventChains: [],\n  outcome: null,",
'empty event chains')
text = replace_once(text,
"    restructuringUsed: false,\n  }",
"    restructuringUsed: false,\n    specialization: undefined,\n    jobActive: true,\n    rivalIntent: isBot ? 'Оценивает рынок и готовит следующий ход' : undefined,\n  }",
'player v15 fields')
text = replace_once(text,
"    const business = pickFresh(state, 'business', unlocked, (item) => item.id, () => random(state), 4)\n    return {\n      kind: 'business', businessId: business.id, askingPrice: business.price, negotiated: false,\n      inspection: 'none', hiddenIssue: rollIssue(state, business.riskRating), issueRevealed: false,\n    }",
"    const business = pickFresh(state, 'business', unlocked, (item) => item.id, () => random(state), 4)\n    const profile = createDealProfile(business, () => random(state), uid(state, `profile-${business.id}`))\n    const askingPrice = Math.round(business.price * profile.valueMultiplier / 10_000) * 10_000\n    return {\n      kind: 'business', businessId: business.id, askingPrice, originalAskingPrice: askingPrice, negotiated: false,\n      inspection: 'none', hiddenIssue: rollIssue(state, business.riskRating), issueRevealed: false, profile, revealedFacts: [],\n    }",
'unique business decision')
text = replace_once(text,
"      const business = businesses.find((item) => item.id === deal.businessId)!\n      return {\n        kind: 'opportunity', opportunityId: deal.id, businessId: business.id,\n        askingPrice: Math.round(business.price * deal.discount), title: deal.title, description: deal.description,\n        inspection: 'none', hiddenIssue: rollIssue(state, business.riskRating, deal.issueChance * 0.45), issueRevealed: false,\n      }",
"      const business = businesses.find((item) => item.id === deal.businessId)!\n      const profile = createDealProfile(business, () => random(state), uid(state, `profile-${deal.id}`))\n      const askingPrice = Math.round(business.price * deal.discount * profile.valueMultiplier / 10_000) * 10_000\n      return {\n        kind: 'opportunity', opportunityId: deal.id, businessId: business.id,\n        askingPrice, originalAskingPrice: askingPrice, title: deal.title, description: deal.description,\n        inspection: 'none', hiddenIssue: rollIssue(state, business.riskRating, deal.issueChance * 0.45), issueRevealed: false, profile, revealedFacts: [],\n      }",
'unique opportunity decision')
text = replace_once(text,
"  state.players.forEach((player) => { if (player.status === 'active') processAssetRisks(state, player) })",
"  state.players.forEach((player) => { if (player.status === 'active') processAssetRisks(state, player) })\n  resolveEventChains(state, nextMonth, () => random(state), (title, description, tone = 'neutral') => addEvent(state, title, description, tone))",
'resolve event chains')
text = replace_once(text,
"  state.players.forEach((player) => {\n    if (player.status === 'active') updateAssetMarket(state, player)\n  })",
"  state.players.forEach((player) => {\n    if (player.status === 'active') {\n      refreshPortfolioSynergies(player)\n      updateAssetMarket(state, player)\n    }\n  })",
'refresh synergies monthly')
text = replace_once(text,
"  state.activeMarginCall = createStockMarginCall(state.players[0], state.stockMarket)\n",
"  state.activeMarginCall = createStockMarginCall(state.players[0], state.stockMarket)\n  refreshRivalIntents(state)\n",
'refresh rival intents')
text = replace_once(text,
"const makeAsset = (state: GameState, player: Player, businessId: string, funding: Funding, dealPrice?: number, collateralAssetId?: string, diligence: DueDiligence = 'none', hiddenIssue: BusinessIssue = 'none'): Asset | null => {",
"const makeAsset = (state: GameState, player: Player, businessId: string, funding: Funding, dealPrice?: number, collateralAssetId?: string, diligence: DueDiligence = 'none', hiddenIssue: BusinessIssue = 'none', profile?: import('../domain/types').DealProfile, sellerTerm?: import('../domain/types').SellerCounter['term']): Asset | null => {",
'make asset signature')
text = replace_once(text,
"  applyIssueToAsset(asset, hiddenIssue)\n  return asset",
"  applyDealProfileToAsset(asset, profile, sellerTerm)\n  applyIssueToAsset(asset, hiddenIssue)\n  scheduleDealChain(state, asset)\n  return asset",
'apply deal profile')
text = replace_once(text,
"  state.activeMarginCall ??= null\n  player.activeContracts ??= []",
"  state.activeMarginCall ??= null\n  state.eventChains ??= []\n  player.activeContracts ??= []",
'initialize event chains')
text = replace_once(text,
"  if (state.phase === 'ready' || v14Anytime || stockPledgeWindow) {\n    const v14 = handleReadyV14Command(state, command, () => random(state))",
"  if (state.phase === 'ready' || v14Anytime || stockPledgeWindow) {\n    const v15 = handleReadyV15Command(state, command)\n    if (v15.handled) return v15.accepted ? { state, accepted: true } : reject(current, v15.error ?? 'Операция недоступна')\n    const v14 = handleReadyV14Command(state, command, () => random(state))",
'route ready v15')
text = replace_once(text,
"  const decision = state.pendingDecision\n  const v14Decision = handleDecisionV14Command(state, command, () => random(state))",
"  const decision = state.pendingDecision\n  const v15Decision = handleDecisionV15Command(state, command)\n  if (v15Decision.handled) {\n    if (!v15Decision.accepted) return reject(current, v15Decision.error ?? 'Операция недоступна')\n    if (v15Decision.completeTurn) completeHumanTurn(state)\n    return { state, accepted: true }\n  }\n  const v14Decision = handleDecisionV14Command(state, command, () => random(state))",
'route decision v15')
text = regex_once(text,
r"  if \(command\.type === 'NEGOTIATE_BUSINESS'\) \{.*?\n  \}\n\n  if \(command\.type === 'INSPECT_BUSINESS'\)",
"""  if (command.type === 'NEGOTIATE_BUSINESS') {
    if (decision.kind !== 'business') return reject(current, 'Сейчас нет сделки для торга')
    if (decision.negotiated) return reject(current, 'Ты уже сделал предложение')
    const settings = difficultySettings[state.difficulty]
    const boldnessPenalty = command.offerPercent === 0.85 ? 0.28 : command.offerPercent === 0.9 ? 0.13 : 0
    const successChance = settings.negotiationChance + skillLevel(player, 'negotiation') * 0.07 + negotiationSpecializationBonus(player) - boldnessPenalty
    const success = random(state) < successChance
    decision.negotiated = true
    if (success) {
      decision.askingPrice = Math.round(decision.askingPrice * command.offerPercent)
      decision.negotiationNote = `Продавец согласился на скидку ${Math.round((1 - command.offerPercent) * 100)}%`
      addEvent(state, 'Торг удался', decision.negotiationNote, 'good')
      awardProgress(state, player, 24, 'negotiation', 14)
      return { state, accepted: true }
    }
    const dealLost = random(state) < (command.offerPercent === 0.85 ? 0.34 : command.offerPercent === 0.9 ? 0.16 : 0.05)
    if (dealLost) {
      addEvent(state, 'Сделка сорвалась', 'Продавец отказался продолжать переговоры.', 'bad')
      completeHumanTurn(state)
    } else {
      decision.sellerCounter = createSellerCounter(decision.askingPrice, command.offerPercent, skillLevel(player, 'negotiation'), () => random(state))
      decision.negotiationNote = 'Продавец сделал встречное предложение: можно принять цену или оставить исходную цену с дополнительным условием.'
      addEvent(state, 'Контроффер продавца', decision.negotiationNote, 'neutral')
    }
    return { state, accepted: true }
  }

  if (command.type === 'INSPECT_BUSINESS')""",
'negotiation rewrite')
text = replace_once(text,
"    decision.inspection = command.level\n    const revealChance",
"    decision.inspection = command.level\n    if (decision.profile) decision.revealedFacts = revealedDealFacts(decision.profile, command.level)\n    const revealChance",
'reveal profile facts')
text = regex_once(text,
r"  if \(command\.type === 'SKIP_DECISION'\) \{\n    addEvent\(state, 'Решение пропущено'.*?\n    completeHumanTurn\(state\)\n    return \{ state, accepted: true \}\n  \}",
"""  if (command.type === 'SKIP_DECISION') {
    if ((decision.kind === 'business' || decision.kind === 'opportunity') && random(state) < 0.72) {
      const candidates = state.players.slice(1).filter((bot) => bot.status === 'active')
      const bot = candidates.sort((a, b) => b.cash - a.cash)[0]
      const business = businesses.find((item) => item.id === decision.businessId)
      if (bot && business) {
        const reserve = bot.baseExpenses * (bot.botStrategy === 'careful' ? 1.2 : 0.45)
        const downPayment = Math.max(0, decision.askingPrice - Math.min(decision.askingPrice, Math.round(business.loan * (decision.askingPrice / business.price))))
        if (bot.cash >= downPayment * 0.5 + reserve) {
          const funding: Funding = bot.cash >= downPayment + reserve ? 'cash' : 'partner50'
          const rivalAsset = makeAsset(state, bot, decision.businessId, funding, decision.askingPrice, undefined, 'basic', 'none', decision.profile, decision.sellerTerm)
          if (rivalAsset) {
            bot.assets.push(rivalAsset)
            refreshPortfolioSynergies(bot)
            addEvent(state, 'Соперник перехватил сделку', `${bot.name} купил ${business.name}, от которого ты отказался.`, 'bad')
          }
        }
      }
    }
    addEvent(state, 'Решение пропущено', 'Ты сохранил деньги и завершил ход.')
    completeHumanTurn(state)
    return { state, accepted: true }
  }""",
'skipped deal interception')
# Add profile and seller term to player purchase calls, then refresh synergies after pushes.
text = text.replace("decision.inspection ?? 'none', hiddenIssue)", "decision.inspection ?? 'none', hiddenIssue, decision.profile, decision.sellerTerm)")
text = text.replace("player.assets.push(asset)\n", "player.assets.push(asset)\n    refreshPortfolioSynergies(player)\n")
write(path, text)

# ---------- App UI ----------
path = 'src/App.tsx'
text = read(path)
text = replace_once(text,
"import { AssetSalesCore, BuyerOfferModal, DealFinancingCore, GlobalEventBanner, MarginCallModal, V14DecisionContent } from './V14UI'\n",
"import { AssetSalesCore, BuyerOfferModal, DealFinancingCore, GlobalEventBanner, MarginCallModal, V14DecisionContent } from './V14UI'\nimport { DealProfilePanel, EventChainPanel, PortfolioSynergyPanel, RivalIntentPanel, SellerCounterPanel, SpecializationModal } from './V15UI'\n",
'App v15 imports')
text = replace_once(text,
"    {tab === 'race' && <Race />}\n",
"    {tab === 'race' && <><Race /><RivalIntentPanel /></>}\n",
'rival panel')
text = replace_once(text,
"    <BuyerOfferModal />\n    <MarginCallModal />",
"    <BuyerOfferModal />\n    <MarginCallModal />\n    <SpecializationModal />",
'specialization modal')
text = replace_once(text,
"    {player.assets.length === 0 ? <div className=\"empty-state\"",
"    <PortfolioSynergyPanel />\n    <EventChainPanel />\n    {player.assets.length === 0 ? <div className=\"empty-state\"",
'portfolio panels')
text = replace_once(text,
"      <div className={asset.legalIssue ? \"pledge-badge\" : \"negotiation-note\"}",
"      {(asset.synergyBonus ?? 0) > 0 && <div className=\"v15-asset-synergy\">Связка портфеля +{Math.round((asset.synergyBonus ?? 0) * 100)}% к выручке · {asset.synergyLabel}</div>}\n      <div className={asset.legalIssue ? \"pledge-badge\" : \"negotiation-note\"}",
'asset synergy badge')
text = replace_once(text,
"      <div className=\"deal-grid\"><Metric label=\"Цена\" value={money(decision.askingPrice)} />",
"      <div className=\"deal-grid\"><Metric label=\"Цена\" value={money(decision.askingPrice)} />",
'deal grid anchor')
# Insert profile panel immediately after the deal grid line.
text = regex_once(text,
r"(      <div className=\"deal-grid\">.*?</div>\n)(      <div className=\"bank-verdict\">)",
r"\1      <DealProfilePanel decision={decision} />\n\2",
'deal profile panel')
text = replace_once(text,
"      {decision.negotiationNote && <div className=\"negotiation-note\">{decision.negotiationNote}</div>}\n",
"      {decision.negotiationNote && <div className=\"negotiation-note\">{decision.negotiationNote}</div>}\n      <SellerCounterPanel decision={decision} />\n",
'seller counter panel')
write(path, text)

# ---------- Buyer modal labels ----------
path = 'src/V14UI.tsx'
text = read(path)
text = replace_once(text,
"import { availableStockCollateral, listingMonthsRemaining, stockFreeQuantity } from './game/systems/v14'\n",
"import { availableStockCollateral, listingMonthsRemaining, stockFreeQuantity } from './game/systems/v14'\nimport { buyerArchetypeLabel } from './game/systems/v15'\n",
'V14 UI buyer import')
text = replace_once(text,
"    <div className=\"sheet-handle\"/><span className=\"eyebrow\">ПОКУПАТЕЛЬ НАШЁЛСЯ</span><h2>{offer.buyerName} предлагает сделку</h2>",
"    <div className=\"sheet-handle\"/><span className=\"eyebrow\">ПОКУПАТЕЛЬ НАШЁЛСЯ</span><h2>{offer.buyerName} предлагает сделку</h2>{offer.archetype && <span className=\"v15-buyer-archetype\">{buyerArchetypeLabel[offer.archetype]}</span>}",
'buyer archetype label')
write(path, text)

# ---------- main css ----------
path = 'src/main.tsx'
text = read(path)
text = replace_once(text, "import './v14.css'\n", "import './v14.css'\nimport './v15.css'\n", 'v15 css import')
write(path, text)

# ---------- save ----------
path = 'src/game/persistence/save.ts'
text = read(path)
text = text.replace('version: z.literal(9)', 'version: z.literal(10)', 1)
text = replace_once(text,
"    botStrategy: z.enum(['careful', 'balanced', 'aggressive']).optional(), freedomStreak: z.number().int().nonnegative().optional(), restructuringUsed: z.boolean().optional(),",
"    botStrategy: z.enum(['careful', 'balanced', 'aggressive']).optional(), freedomStreak: z.number().int().nonnegative().optional(), restructuringUsed: z.boolean().optional(),\n    specialization: z.enum(['operator', 'negotiator', 'investor', 'entrepreneur']).optional(), jobActive: z.boolean().optional(), rivalIntent: z.string().optional(),",
'save player v15')
text = replace_once(text,
"  activeMarginCall: z.unknown().nullable(),\n  outcome:",
"  activeMarginCall: z.unknown().nullable(),\n  eventChains: z.array(z.unknown()),\n  outcome:",
'save event chains')
text = text.replace("export const SAVE_KEY = 'vyhod-iz-kruga-save-v9-v14'", "export const SAVE_KEY = 'vyhod-iz-kruga-save-v10-v15'", 1)
write(path, text)

print('v1.5 source materialized')
