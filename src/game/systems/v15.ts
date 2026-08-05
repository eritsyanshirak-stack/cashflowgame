import type {
  Asset,
  BuyerArchetype,
  DealProfile,
  DueDiligence,
  EventChain,
  GameState,
  Player,
  SellerCounter,
  Specialization,
} from '../domain/types'
import type { BusinessTemplate } from '../domain/types'
import { assetMarketValue, loanPayment } from './economy'

const locations = [
  ['У метро', 1.12, 1.08],
  ['В жилом районе', 0.96, 0.92],
  ['В деловом центре', 1.08, 1.14],
  ['На первой линии', 1.16, 1.18],
  ['Во дворе', 0.88, 0.82],
  ['Рядом с крупным конкурентом', 0.92, 0.96],
] as const

const sellerReasons = [
  'Владелец переезжает в другой город',
  'Партнёры решили разделить активы',
  'Владельцу срочно нужны деньги',
  'Собственник устал заниматься операционкой',
  'Бизнес продают после неудачного сезона',
  'Владелец переключается на другой проект',
] as const

const equipmentConditions = [
  { id: 'poor', label: 'Требует вложений', cost: 1.13, value: 0.9 },
  { id: 'fair', label: 'Рабочее, но не новое', cost: 1.05, value: 0.97 },
  { id: 'good', label: 'Хорошее состояние', cost: 0.98, value: 1.03 },
  { id: 'excellent', label: 'Почти новое', cost: 0.94, value: 1.1 },
] as const

const ownerDependencies = [
  { id: 'low', label: 'Команда работает самостоятельно', revenue: 1.04 },
  { id: 'medium', label: 'Часть клиентов держится на владельце', revenue: 0.98 },
  { id: 'high', label: 'Продажи сильно завязаны на владельце', revenue: 0.86 },
] as const

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const pick = <T>(items: readonly T[], random: () => number) => items[Math.floor(random() * items.length)] ?? items[0]

export const createDealProfile = (
  business: BusinessTemplate,
  random: () => number,
  id: string,
): DealProfile => {
  const location = pick(locations, random)
  const equipment = pick(equipmentConditions, random)
  const dependency = pick(ownerDependencies, random)
  const leaseMonths = 4 + Math.floor(random() * 33)
  const customerRating = Math.round((3.7 + random() * 1.25) * 10) / 10
  const demandNoise = 0.9 + random() * 0.22
  const revenueMultiplier = clamp(location[1] * dependency.revenue * demandNoise, 0.72, 1.34)
  const costMultiplier = clamp(location[2] * equipment.cost * (0.96 + random() * 0.1), 0.78, 1.34)
  const valueMultiplier = clamp((revenueMultiplier * 0.55 + (2 - costMultiplier) * 0.25 + equipment.value * 0.2), 0.78, 1.24)

  return {
    id,
    location: location[0],
    leaseMonths,
    equipmentCondition: equipment.id,
    equipmentLabel: equipment.label,
    ownerDependency: dependency.id,
    ownerDependencyLabel: dependency.label,
    customerRating,
    sellerReason: pick(sellerReasons, random),
    revenueMultiplier,
    costMultiplier,
    valueMultiplier,
    declaredRevenue: Math.round(business.revenue * (0.94 + random() * 0.14)),
    declaredCosts: Math.round(business.operatingCosts * (0.92 + random() * 0.14)),
  }
}

export const dealVerifiedRevenue = (profile: DealProfile) =>
  Math.round(profile.declaredRevenue * profile.revenueMultiplier)

export const dealVerifiedCosts = (profile: DealProfile) =>
  Math.round(profile.declaredCosts * profile.costMultiplier)

export const dealProjectedOperatingIncome = (
  profile: DealProfile | undefined,
  diligence: DueDiligence,
  fallbackRevenue: number,
  fallbackCosts: number,
) => {
  if (!profile) return fallbackRevenue - fallbackCosts
  if (diligence === 'full') return dealVerifiedRevenue(profile) - dealVerifiedCosts(profile)
  return profile.declaredRevenue - profile.declaredCosts
}

export const dealFactLines = (profile: DealProfile) => [
  `Локация: ${profile.location}`,
  `Срок аренды: ${profile.leaseMonths} мес.`,
  `Оборудование: ${profile.equipmentLabel}`,
  `Зависимость от владельца: ${profile.ownerDependencyLabel}`,
  `Рейтинг клиентов: ${profile.customerRating.toFixed(1)} из 5`,
  `Причина продажи: ${profile.sellerReason}`,
  `Подтверждённая выручка: ${dealVerifiedRevenue(profile).toLocaleString('ru-RU')} ₽/мес.`,
  `Подтверждённые расходы: ${dealVerifiedCosts(profile).toLocaleString('ru-RU')} ₽/мес.`,
]

export const revealedDealFacts = (profile: DealProfile, level: 'basic' | 'full') =>
  level === 'full' ? dealFactLines(profile) : dealFactLines(profile).slice(0, 4)

const sellerTermNotes: Record<SellerCounter['term'], string> = {
  transition: 'Цена без скидки, но продавец два месяца помогает передать клиентов и процессы.',
  warranty: 'Цена без скидки, но продавец даёт гарантию на скрытые проблемы на три месяца.',
  repairCredit: 'Цена без скидки, но продавец оплачивает часть ремонта и оборудования.',
  sellerFinancing: 'Цена без скидки, но часть кредита бизнеса идёт по сниженной ставке.',
}

export const createSellerCounter = (
  askingPrice: number,
  offeredPercent: number,
  negotiationLevel: number,
  random: () => number,
): SellerCounter => {
  const requested = Math.round(askingPrice * offeredPercent)
  const middle = Math.round((askingPrice + requested) / 2)
  const skillDiscount = Math.min(0.035, negotiationLevel * 0.012)
  const counterPrice = Math.round(middle * (1 - skillDiscount - random() * 0.025) / 10_000) * 10_000
  const terms = ['transition', 'warranty', 'repairCredit', 'sellerFinancing'] as const
  const term = pick(terms, random)
  return {
    price: Math.max(requested, Math.min(askingPrice, counterPrice)),
    term,
    note: sellerTermNotes[term],
  }
}

export const applyDealProfileToAsset = (
  asset: Asset,
  profile?: DealProfile,
  sellerTerm?: SellerCounter['term'],
) => {
  if (!profile) return asset
  asset.dealProfile = profile
  asset.revenue = dealVerifiedRevenue(profile)
  asset.operatingCosts = dealVerifiedCosts(profile)
  asset.marketValue = Math.round(assetMarketValue(asset) * profile.valueMultiplier)

  if (sellerTerm === 'transition') {
    asset.transitionSupportUntilMonth = asset.purchaseMonth + 2
    asset.launchMonthsRemaining = Math.max(0, (asset.launchMonthsRemaining ?? 0) - 1)
  }
  if (sellerTerm === 'warranty') asset.warrantyUntilMonth = asset.purchaseMonth + 3
  if (sellerTerm === 'repairCredit') {
    asset.operatingCosts = Math.round(asset.operatingCosts * 0.94)
    asset.marketValue = Math.round(assetMarketValue(asset) * 1.04)
  }
  if (sellerTerm === 'sellerFinancing' && asset.loan > 0) {
    asset.loanRate = Math.max(0.08, asset.loanRate - 0.035)
    asset.monthlyPayment = loanPayment(asset.loan, asset.loanRate, asset.loanTermMonths)
  }
  return asset
}

const synergyRules = [
  { a: 'Онлайн', b: 'Сервис', bonus: 0.07, label: 'Маркетплейс + пункт выдачи' },
  { a: 'Общепит', b: 'Общепит', bonus: 0.05, label: 'Общие закупки в общепите' },
  { a: 'IT', b: 'Онлайн', bonus: 0.08, label: 'IT усиливает онлайн-бизнес' },
  { a: 'Недвижимость', b: 'Онлайн', bonus: 0.07, label: 'Склад и онлайн-торговля' },
  { a: 'Спорт', b: 'Медицина', bonus: 0.09, label: 'Совместные клиенты спорта и медицины' },
  { a: 'Услуги', b: 'IT', bonus: 0.06, label: 'Автоматизация услуг' },
] as const

export const refreshPortfolioSynergies = (player: Player) => {
  for (const asset of player.assets) {
    let bonus = player.specialization === 'operator' ? 0.04 : 0
    const labels: string[] = player.specialization === 'operator' ? ['Специализация оператора'] : []
    for (const other of player.assets) {
      if (other.id === asset.id) continue
      for (const rule of synergyRules) {
        const matches = (asset.category === rule.a && other.category === rule.b) ||
          (asset.category === rule.b && other.category === rule.a)
        if (matches) {
          bonus += rule.bonus
          labels.push(rule.label)
        }
      }
    }
    asset.synergyBonus = Math.min(0.18, bonus)
    asset.synergyLabel = [...new Set(labels)].join(' · ')
  }
}

export const scheduleDealChain = (state: GameState, asset: Asset) => {
  const profile = asset.dealProfile
  if (!profile) return
  const chains: EventChain[] = []
  if (profile.ownerDependency === 'high') chains.push({
    id: `chain-owner-${asset.id}`,
    kind: 'ownerExit',
    title: 'Клиенты после смены владельца',
    description: `${asset.name}: часть клиентов может уйти после окончательной передачи бизнеса.`,
    resolvesMonth: state.month + 2,
    assetId: asset.id,
    amount: Math.round(asset.revenue * 0.12),
  })
  if (profile.equipmentCondition === 'poor') chains.push({
    id: `chain-equipment-${asset.id}`,
    kind: 'equipment',
    title: 'Отложенный ремонт оборудования',
    description: `${asset.name}: дешёвая экономия на входе может вернуться ремонтом.`,
    resolvesMonth: state.month + 1,
    assetId: asset.id,
    amount: Math.round(asset.price * asset.ownership * 0.035),
  })
  state.eventChains.push(...chains)
}

export const scheduleExpenseChain = (
  state: GameState,
  title: string,
  amount: number,
  riskChance: number,
  random: () => number,
) => {
  if (random() >= riskChance) return false
  state.eventChains.push({
    id: `chain-expense-${state.month}-${state.day}-${state.seed}`,
    kind: 'deferredExpense',
    title: `Последствия: ${title}`,
    description: 'Экономия сработала не полностью, проблема вернётся позже.',
    resolvesMonth: state.month + 1 + Math.floor(random() * 2),
    amount,
  })
  return true
}

export const resolveEventChains = (
  state: GameState,
  nextMonth: number,
  random: () => number,
  pushEvent: (title: string, description: string, tone?: 'good' | 'bad' | 'neutral') => void,
) => {
  const player = state.players[0]
  const remaining: EventChain[] = []
  for (const chain of state.eventChains) {
    if (chain.resolvesMonth > nextMonth) {
      remaining.push(chain)
      continue
    }
    const asset = chain.assetId ? player.assets.find((item) => item.id === chain.assetId) : undefined
    if (chain.assetId && !asset) continue

    if (chain.kind === 'deferredExpense') {
      const amount = chain.amount ?? 0
      player.cash -= amount
      pushEvent(chain.title, `Пришлось доплатить ${amount.toLocaleString('ru-RU')} ₽.`, 'bad')
    } else if (chain.kind === 'equipment' && asset) {
      if ((asset.warrantyUntilMonth ?? 0) >= nextMonth) {
        pushEvent('Гарантия продавца сработала', `${asset.name}: ремонт оплатил прежний владелец.`, 'good')
      } else {
        const amount = chain.amount ?? 0
        player.cash -= amount
        asset.incidentCooldown = Math.max(asset.incidentCooldown ?? 0, 1)
        pushEvent(chain.title, `${asset.name}: ремонт обошёлся в ${amount.toLocaleString('ru-RU')} ₽.`, 'bad')
      }
    } else if (chain.kind === 'ownerExit' && asset) {
      const support = (asset.transitionSupportUntilMonth ?? 0) >= nextMonth
      if (support || random() < 0.38) {
        pushEvent('Передача клиентов прошла успешно', `${asset.name}: команда удержала клиентскую базу.`, 'good')
      } else {
        asset.revenue = Math.round(asset.revenue * 0.88)
        pushEvent(chain.title, `${asset.name}: часть клиентов ушла, выручка снизилась на 12%.`, 'bad')
      }
    }
  }
  state.eventChains = remaining
}

export const buyerArchetypeLabel: Record<BuyerArchetype, string> = {
  urgent: 'Срочный инвестор',
  strategic: 'Стратегический покупатель',
  speculator: 'Спекулянт',
  management: 'Управляющая компания',
}

export const chooseBuyerArchetype = (asset: Asset, random: () => number): BuyerArchetype => {
  if (asset.developmentLevel >= 2 && random() < 0.45) return 'strategic'
  if (asset.riskRating === 'low' && random() < 0.4) return 'management'
  return random() < 0.5 ? 'urgent' : 'speculator'
}

export const buyerOfferMultiplier = (asset: Asset, archetype: BuyerArchetype, random: () => number) => {
  if (archetype === 'strategic') return 1.01 + asset.developmentLevel * 0.025 + random() * 0.08
  if (archetype === 'management') return 0.96 + (asset.riskRating === 'low' ? 0.07 : 0) + random() * 0.05
  if (archetype === 'urgent') return 0.89 + random() * 0.08
  return 0.84 + random() * 0.11
}

export const specializationNames: Record<Specialization, string> = {
  operator: 'Оператор',
  negotiator: 'Переговорщик',
  investor: 'Инвестор',
  entrepreneur: 'Предприниматель',
}

export const specializationDescriptions: Record<Specialization, string> = {
  operator: 'Синергии портфеля сильнее, а управлять можно ещё одним бизнесом без накладных расходов.',
  negotiator: 'Выше шанс получить скидку у продавца и продавить покупателя в контроффере.',
  investor: 'Банк оценивает акции выше при залоге, а фондовый рынок становится главным инструментом.',
  entrepreneur: 'Ты уходишь с работы: зарплата исчезает, но контракты дают больше денег и чаще завершаются успешно.',
}

export const contractSpecializationBonus = (player: Player) => player.specialization === 'entrepreneur'
  ? { payout: 1.25, success: 0.08 }
  : { payout: 1, success: 0 }

export const negotiationSpecializationBonus = (player: Player) => player.specialization === 'negotiator' ? 0.12 : 0
export const buyerNegotiationSpecializationBonus = (player: Player) => player.specialization === 'negotiator' ? 0.1 : 0
export const stockCollateralRatio = (player: Player) => player.specialization === 'investor' ? 0.52 : 0.45

export const refreshRivalIntents = (state: GameState) => {
  for (const bot of state.players.filter((item) => item.isBot && item.status === 'active')) {
    const reserve = bot.baseExpenses * (bot.botStrategy === 'careful' ? 1.5 : 0.6)
    if (bot.cash < reserve) bot.rivalIntent = 'Копит резерв и избегает новых долгов'
    else if (bot.botStrategy === 'aggressive') bot.rivalIntent = 'Ищет крупный бизнес и готов идти на аукцион'
    else if (bot.botStrategy === 'careful') bot.rivalIntent = 'Собирает стабильные активы с низким риском'
    else if (bot.assets.length >= 2) bot.rivalIntent = 'Развивает портфель и ищет синергии'
    else bot.rivalIntent = 'Готовится к следующей покупке'
  }
}
