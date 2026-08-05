import type { BusinessTemplate, CellType, Difficulty, Profession, StockQuote } from '../domain/types'

export const difficultySettings: Record<Difficulty, {
  label: string
  description: string
  negotiationChance: number
  marketVolatility: number
  offerChance: number
  botActivity: number
  maxDebtLoad: number
  unsecuredRate: number
  securedRate: number
  resaleDelayChance: number
}> = {
  easy: { label: 'Спокойно', description: 'Банк мягче, рынок спокойнее', negotiationChance: 0.76, marketVolatility: 0.05, offerChance: 0.52, botActivity: 0.48, maxDebtLoad: 0.48, unsecuredRate: 0.2, securedRate: 0.14, resaleDelayChance: 0.08 },
  normal: { label: 'Баланс', description: 'Кредиты требуют запаса прочности', negotiationChance: 0.6, marketVolatility: 0.09, offerChance: 0.42, botActivity: 0.72, maxDebtLoad: 0.38, unsecuredRate: 0.25, securedRate: 0.18, resaleDelayChance: 0.15 },
  hard: { label: 'Жёстко', description: 'Дорогой долг и строгий банк', negotiationChance: 0.46, marketVolatility: 0.14, offerChance: 0.34, botActivity: 0.86, maxDebtLoad: 0.3, unsecuredRate: 0.31, securedRate: 0.23, resaleDelayChance: 0.24 },
}

export const developments = [
  { id: 'marketing', name: 'Маркетинг', description: 'Больше клиентов и выручки', costRate: 0.08, revenueRate: 0.16, costGrowthRate: 0.04, valueRate: 0.12 },
  { id: 'automation', name: 'Автоматизация', description: 'Меньше ручных расходов', costRate: 0.11, revenueRate: 0.05, costGrowthRate: -0.12, valueRate: 0.15 },
  { id: 'manager', name: 'Управляющий', description: 'Стабильнее и дороже бизнес', costRate: 0.14, revenueRate: 0.12, costGrowthRate: 0.03, valueRate: 0.2 },
  { id: 'scale', name: 'Вторая точка', description: 'Большой рост с большими расходами', costRate: 0.28, revenueRate: 0.42, costGrowthRate: 0.24, valueRate: 0.38 },
] as const

export const professions: Profession[] = [
  { id: 'trainer', name: 'Фитнес-тренер', cash: 150_000, salary: 180_000, expenses: 128_000, debt: 380_000 },
  { id: 'manager', name: 'Менеджер', cash: 210_000, salary: 240_000, expenses: 172_000, debt: 650_000 },
  { id: 'developer', name: 'Программист', cash: 300_000, salary: 340_000, expenses: 228_000, debt: 820_000 },
  { id: 'doctor', name: 'Врач', cash: 260_000, salary: 300_000, expenses: 215_000, debt: 1_050_000 },
  { id: 'designer', name: 'Дизайнер', cash: 170_000, salary: 205_000, expenses: 148_000, debt: 470_000 },
  { id: 'sales', name: 'Руководитель продаж', cash: 280_000, salary: 315_000, expenses: 230_000, debt: 740_000 },
]

export const businesses: BusinessTemplate[] = [
  { id: 'vending', name: 'Вендинговый автомат', icon: '🥤', category: 'Микробизнес', price: 90_000, downPayment: 90_000, loan: 0, revenue: 10_000, operatingCosts: 5_000, requiredLevel: 1, loanRate: 0, loanTermMonths: 1, riskRating: 'low' },
  { id: 'coffee', name: 'Кофейный островок', icon: '☕', category: 'Общепит', price: 480_000, downPayment: 150_000, loan: 330_000, revenue: 52_000, operatingCosts: 34_000, requiredLevel: 1, loanRate: 0.24, loanTermMonths: 48, riskRating: 'medium' },
  { id: 'pickup', name: 'Пункт выдачи заказов', icon: '📦', category: 'Сервис', price: 620_000, downPayment: 180_000, loan: 440_000, revenue: 64_000, operatingCosts: 42_000, requiredLevel: 1, loanRate: 0.22, loanTermMonths: 60, riskRating: 'low' },
  { id: 'marketplace', name: 'Магазин на маркетплейсе', icon: '🛒', category: 'Онлайн', price: 350_000, downPayment: 200_000, loan: 150_000, revenue: 46_000, operatingCosts: 30_000, requiredLevel: 1, loanRate: 0.28, loanTermMonths: 36, riskRating: 'high' },
  { id: 'cleaning', name: 'Клининг-сервис', icon: '🧹', category: 'Услуги', price: 290_000, downPayment: 170_000, loan: 120_000, revenue: 40_000, operatingCosts: 26_000, requiredLevel: 1, loanRate: 0.24, loanTermMonths: 36, riskRating: 'medium' },
  { id: 'barber', name: 'Барбершоп', icon: '💈', category: 'Услуги', price: 850_000, downPayment: 270_000, loan: 580_000, revenue: 84_000, operatingCosts: 58_000, requiredLevel: 2, loanRate: 0.24, loanTermMonths: 60, riskRating: 'medium' },
  { id: 'fitness', name: 'Фитнес-студия', icon: '🏋️', category: 'Спорт', price: 950_000, downPayment: 290_000, loan: 660_000, revenue: 95_000, operatingCosts: 66_000, requiredLevel: 2, loanRate: 0.23, loanTermMonths: 60, riskRating: 'medium' },
  { id: 'school', name: 'Онлайн-школа', icon: '🎓', category: 'Онлайн', price: 540_000, downPayment: 260_000, loan: 280_000, revenue: 63_000, operatingCosts: 47_000, requiredLevel: 2, loanRate: 0.30, loanTermMonths: 36, riskRating: 'high' },
  { id: 'agency', name: 'SMM-агентство', icon: '📱', category: 'Услуги', price: 410_000, downPayment: 210_000, loan: 200_000, revenue: 60_000, operatingCosts: 43_000, requiredLevel: 2, loanRate: 0.28, loanTermMonths: 36, riskRating: 'medium' },
  { id: 'dark-kitchen', name: 'Кухня доставки', icon: '🍜', category: 'Общепит', price: 780_000, downPayment: 250_000, loan: 530_000, revenue: 82_000, operatingCosts: 59_000, requiredLevel: 2, loanRate: 0.26, loanTermMonths: 48, riskRating: 'high' },
  { id: 'wash', name: 'Автомойка', icon: '🚗', category: 'Авто', price: 1_600_000, downPayment: 460_000, loan: 1_140_000, revenue: 135_000, operatingCosts: 92_000, requiredLevel: 3, loanRate: 0.22, loanTermMonths: 72, riskRating: 'medium' },
  { id: 'it', name: 'IT-сервис', icon: '🖥️', category: 'IT', price: 1_400_000, downPayment: 520_000, loan: 880_000, revenue: 140_000, operatingCosts: 95_000, requiredLevel: 3, loanRate: 0.27, loanTermMonths: 48, riskRating: 'high' },
  { id: 'warehouse', name: 'Склад самообслуживания', icon: '🏗️', category: 'Недвижимость', price: 2_100_000, downPayment: 590_000, loan: 1_510_000, revenue: 170_000, operatingCosts: 112_000, requiredLevel: 3, loanRate: 0.19, loanTermMonths: 84, riskRating: 'low' },
  { id: 'apartment', name: 'Квартира под аренду', icon: '🏠', category: 'Недвижимость', price: 4_200_000, downPayment: 1_050_000, loan: 3_150_000, revenue: 110_000, operatingCosts: 35_000, requiredLevel: 4, loanRate: 0.15, loanTermMonths: 120, riskRating: 'low' },
  { id: 'factory', name: 'Мини-производство', icon: '⚙️', category: 'Производство', price: 3_600_000, downPayment: 1_100_000, loan: 2_500_000, revenue: 250_000, operatingCosts: 165_000, requiredLevel: 4, loanRate: 0.23, loanTermMonths: 84, riskRating: 'high' },
  { id: 'medical', name: 'Медицинский центр', icon: '🏥', category: 'Медицина', price: 5_100_000, downPayment: 1_450_000, loan: 3_650_000, revenue: 330_000, operatingCosts: 220_000, requiredLevel: 5, loanRate: 0.20, loanTermMonths: 96, riskRating: 'medium' },
]

export const rareDeals = [
  { id: 'urgent-apartment', title: 'Квартира ниже рынка', businessId: 'apartment', description: 'Собственнику срочно нужны деньги. Цена ниже рынка, но времени на решение мало.', discount: 0.72, minLevel: 2, issueChance: 0.46 },
  { id: 'partner-breakup', title: 'Доля после конфликта партнёров', businessId: 'fitness', description: 'Один из владельцев выходит из проекта и готов уступить свою долю дешевле.', discount: 0.74, minLevel: 2, issueChance: 0.42 },
  { id: 'distressed-coffee', title: 'Кофейня после неудачного сезона', businessId: 'coffee', description: 'Точка продаётся быстро. Можно дешево войти, но цифры продавца требуют проверки.', discount: 0.68, minLevel: 1, issueChance: 0.52 },
  { id: 'warehouse-auction', title: 'Склад с банковского аукциона', businessId: 'warehouse', description: 'Банк продаёт залоговый объект. Цена привлекательная, документы и арендаторы могут удивить.', discount: 0.77, minLevel: 3, issueChance: 0.38 },
] as const

export const board: { type: CellType; icon: string; label: string }[] = [
  { type: 'salary', icon: '📅', label: 'Расчёт' },
  { type: 'business', icon: '🏢', label: 'Бизнес' },
  { type: 'contract', icon: '📋', label: 'Контракт' },
  { type: 'market', icon: '📈', label: 'Рынок' },
  { type: 'expense', icon: '💸', label: 'Расход' },
  { type: 'bank', icon: '🏦', label: 'Банк' },
  { type: 'growth', icon: '🚀', label: 'Развитие' },
  { type: 'business', icon: '🏢', label: 'Бизнес' },
  { type: 'auction', icon: '🔨', label: 'Аукцион' },
  { type: 'chance', icon: '💡', label: 'Шанс' },
  { type: 'partnership', icon: '🤝', label: 'Партнёр' },
  { type: 'management', icon: '🧭', label: 'Управление' },
  { type: 'bank', icon: '🏦', label: 'Банк' },
  { type: 'expense', icon: '💸', label: 'Расход' },
  { type: 'growth', icon: '🚀', label: 'Развитие' },
  { type: 'business', icon: '🏢', label: 'Бизнес' },
  { type: 'market', icon: '📰', label: 'Рынок' },
  { type: 'contract', icon: '📋', label: 'Контракт' },
  { type: 'chance', icon: '💡', label: 'Шанс' },
  { type: 'business', icon: '🏢', label: 'Бизнес' },
]

export const expenseCards = [
  ['Ремонт автомобиля', 17_000],
  ['Стоматолог', 14_000],
  ['Сломалась техника', 11_000],
  ['Налоговая доплата', 24_000],
  ['Ремонт квартиры', 36_000],
  ['Штраф и эвакуация автомобиля', 8_400],
  ['Срочная поездка к семье', 19_000],
  ['Подорожала страховка', 12_800],
  ['Замена рабочего ноутбука', 27_000],
] as const

export const expenseScenarios = expenseCards.map(([title, amount], index) => ({
  id: `expense-${index}`,
  title,
  amount,
  options: [
    { id: 'full' as const, title: 'Решить сразу', description: 'Заплатить полную сумму без будущего риска.', amount },
    { id: 'economy' as const, title: 'Сэкономить сейчас', description: 'Заплатить 45%, но есть риск повторного расхода в следующем месяце.', amount: Math.max(3_000, Math.round(amount * 0.45)), riskChance: 0.34, riskAmount: Math.round(amount * 0.8) },
    { id: 'challenge' as const, title: 'Оспорить или сделать самому', description: 'Заплатить мало. Можно решить вопрос, а можно получить увеличенный счёт.', amount: Math.max(1_500, Math.round(amount * 0.15)), riskChance: 0.52, riskAmount: Math.round(amount * 1.15) },
  ],
}))

export const chanceCards = [
  ['Партия техники', 100_000, 72_000, 162_000, 1],
  ['Авто на перепродажу', 350_000, 270_000, 535_000, 2],
  ['Редкие кроссовки', 80_000, 48_000, 138_000, 1],
  ['Цифровой продукт', 140_000, 65_000, 285_000, 2],
  ['Мебель с закрывшегося шоурума', 190_000, 125_000, 310_000, 2],
  ['Партия кофемашин', 230_000, 155_000, 390_000, 2],
  ['Коллекционные часы', 160_000, 88_000, 295_000, 2],
  ['Остатки спортивного магазина', 120_000, 74_000, 205_000, 1],
  ['Мотоцикл на перепродажу', 420_000, 310_000, 650_000, 3],
] as const

export const contractCards = [
  { id: 'launch-campaign', title: 'Запуск рекламной кампании', description: 'Клиент платит за результат через месяц.', skillId: 'marketing' as const, baseInvestment: 24_000, basePayout: 56_000 },
  { id: 'corporate-training', title: 'Корпоративное обучение', description: 'Можно взять простой пакет или собрать большую программу.', skillId: 'brand' as const, baseInvestment: 18_000, basePayout: 48_000 },
  { id: 'automation-project', title: 'Автоматизация отдела', description: 'Чем смелее объём проекта, тем выше прибыль и риск срыва.', skillId: 'management' as const, baseInvestment: 42_000, basePayout: 96_000 },
  { id: 'sales-sprint', title: 'Спринт продаж', description: 'Нужно вложиться в команду и закрыть план клиента.', skillId: 'negotiation' as const, baseInvestment: 30_000, basePayout: 72_000 },
  { id: 'financial-audit', title: 'Финансовый аудит', description: 'Крупный заказ требует точности и хорошего навыка финансов.', skillId: 'finance' as const, baseInvestment: 36_000, basePayout: 84_000 },
  { id: 'personal-brand', title: 'Продюсирование эксперта', description: 'Можно сделать безопасный мини-запуск или рискнуть бюджетом.', skillId: 'brand' as const, baseInvestment: 28_000, basePayout: 68_000 },
] as const

export const globalEvents = [
  { id: 'delivery-boom', title: 'Бум доставки', description: 'Онлайн и общепит получают больше заказов три месяца.', category: 'Онлайн', sector: 'Ритейл', revenueMultiplier: 1.14, stockImpact: 0.12, creditRateDelta: 0, duration: 3 },
  { id: 'rent-growth', title: 'Аренда дорожает', description: 'Офлайн-бизнесы теряют часть маржи два месяца.', category: 'Услуги', sector: null, revenueMultiplier: 0.88, stockImpact: 0, creditRateDelta: 0, duration: 2 },
  { id: 'cheap-credit', title: 'Ставку снизили', description: 'Новые кредиты дешевле следующие два месяца.', category: null, sector: 'Финансы', revenueMultiplier: 1, stockImpact: 0.16, creditRateDelta: -0.04, duration: 2 },
  { id: 'tight-credit', title: 'Банк ужесточил условия', description: 'Новые кредиты дороже следующие два месяца.', category: null, sector: 'Финансы', revenueMultiplier: 1, stockImpact: -0.18, creditRateDelta: 0.05, duration: 2 },
  { id: 'tech-rally', title: 'Технологический рывок', description: 'IT и технологические акции растут, но волатильность выше.', category: 'IT', sector: 'Технологии', revenueMultiplier: 1.16, stockImpact: 0.28, creditRateDelta: 0, duration: 2 },
  { id: 'consumer-slowdown', title: 'Покупатели экономят', description: 'Ритейл и общепит проседают на два месяца.', category: 'Общепит', sector: 'Ритейл', revenueMultiplier: 0.82, stockImpact: -0.26, creditRateDelta: 0, duration: 2 },
  { id: 'property-demand', title: 'Спрос на аренду вырос', description: 'Недвижимость получает больше дохода три месяца.', category: 'Недвижимость', sector: 'Финансы', revenueMultiplier: 1.12, stockImpact: 0.08, creditRateDelta: 0, duration: 3 },
  { id: 'energy-shock', title: 'Энергетический шок', description: 'Энергетика резко меняется, а расходы бизнеса растут.', category: 'Производство', sector: 'Энергетика', revenueMultiplier: 0.86, stockImpact: -0.34, creditRateDelta: 0.01, duration: 2 },
  { id: 'energy-recovery', title: 'Энергетический рынок восстановился', description: 'Экспорт и цены поддержали энергетические компании.', category: 'Производство', sector: 'Энергетика', revenueMultiplier: 1.08, stockImpact: 0.28, creditRateDelta: 0, duration: 2 },
  { id: 'tech-correction', title: 'Коррекция технологического сектора', description: 'Инвесторы фиксируют прибыль после сильного роста.', category: 'IT', sector: 'Технологии', revenueMultiplier: 0.94, stockImpact: -0.24, creditRateDelta: 0, duration: 2 },
  { id: 'biotech-breakthrough', title: 'Прорыв в биотехнологиях', description: 'Успешные испытания резко повышают интерес к сектору.', category: 'Медицина', sector: 'Биотех', revenueMultiplier: 1.1, stockImpact: 0.24, creditRateDelta: 0, duration: 2 },
  { id: 'biotech-regulation', title: 'Ужесточение правил для биотеха', description: 'Новые требования задерживают запуск препаратов.', category: 'Медицина', sector: 'Биотех', revenueMultiplier: 0.92, stockImpact: -0.24, creditRateDelta: 0, duration: 2 },
] as const

export const initialStockMarket: StockQuote[] = [
  { id: 'energy', name: 'Север Энерго', ticker: 'SEVR', sector: 'Энергетика', price: 4_600, previousPrice: 4_600, dividendYield: 0.072 },
  { id: 'tech', name: 'Нова Тех', ticker: 'NOVA', sector: 'Технологии', price: 7_950, previousPrice: 7_950, dividendYield: 0.018 },
  { id: 'retail', name: 'Город Маркет', ticker: 'CITY', sector: 'Ритейл', price: 3_150, previousPrice: 3_150, dividendYield: 0.048 },
  { id: 'bank', name: 'Первый Банк', ticker: 'BANK', sector: 'Финансы', price: 6_050, previousPrice: 6_050, dividendYield: 0.061 },
  { id: 'biotech', name: 'Вита Лаб', ticker: 'VITA', sector: 'Биотех', price: 8_500, previousPrice: 8_500, dividendYield: 0.008 },
]

export const marketHeadlines = [
  { title: 'Ставку снизили', sector: 'Финансы', impact: 0.12 },
  { title: 'Спрос на технологии ускорился', sector: 'Технологии', impact: 0.18 },
  { title: 'Потребители начали экономить', sector: 'Ритейл', impact: -0.16 },
  { title: 'Новый экспортный контракт', sector: 'Энергетика', impact: 0.17 },
  { title: 'Испытания препарата задержались', sector: 'Биотех', impact: -0.21 },
  { title: 'Рынок ждёт новых данных', sector: null, impact: 0 },
  { title: 'Банки ужесточили кредитование', sector: 'Финансы', impact: -0.15 },
  { title: 'Ритейл отчитался сильнее ожиданий', sector: 'Ритейл', impact: 0.16 },
  { title: 'Цены на энергию снизились', sector: 'Энергетика', impact: -0.18 },
  { title: 'Биотех получил государственный заказ', sector: 'Биотех', impact: 0.2 },
  { title: 'Технологический сектор перегрет', sector: 'Технологии', impact: -0.15 },
] as const
