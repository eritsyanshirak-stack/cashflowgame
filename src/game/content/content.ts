import type { BusinessTemplate, CellType, Difficulty, Profession } from '../domain/types'

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
}> = {
  easy: { label: 'Спокойно', description: 'Рынок мягче, торг проще', negotiationChance: 0.76, marketVolatility: 0.05, offerChance: 0.52, botActivity: 0.48, maxDebtLoad: 0.9, unsecuredRate: 0.2, securedRate: 0.14 },
  normal: { label: 'Баланс', description: 'Честная конкуренция', negotiationChance: 0.6, marketVolatility: 0.09, offerChance: 0.42, botActivity: 0.68, maxDebtLoad: 0.82, unsecuredRate: 0.25, securedRate: 0.18 },
  hard: { label: 'Жёстко', description: 'Сильные боты и нервный рынок', negotiationChance: 0.46, marketVolatility: 0.14, offerChance: 0.34, botActivity: 0.86, maxDebtLoad: 0.76, unsecuredRate: 0.31, securedRate: 0.23 },
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
  { id: 'vending', name: 'Вендинговый автомат', icon: '🥤', category: 'Микробизнес', price: 90_000, downPayment: 90_000, loan: 0, revenue: 15_000, operatingCosts: 3_000 },
  { id: 'coffee', name: 'Кофейный островок', icon: '☕', category: 'Общепит', price: 480_000, downPayment: 150_000, loan: 330_000, revenue: 72_000, operatingCosts: 26_000 },
  { id: 'pickup', name: 'Пункт выдачи заказов', icon: '📦', category: 'Сервис', price: 620_000, downPayment: 180_000, loan: 440_000, revenue: 88_000, operatingCosts: 30_000 },
  { id: 'marketplace', name: 'Магазин на маркетплейсе', icon: '🛒', category: 'Онлайн', price: 350_000, downPayment: 200_000, loan: 150_000, revenue: 68_000, operatingCosts: 22_000 },
  { id: 'barber', name: 'Барбершоп', icon: '💈', category: 'Услуги', price: 850_000, downPayment: 270_000, loan: 580_000, revenue: 125_000, operatingCosts: 47_000 },
  { id: 'fitness', name: 'Фитнес-студия', icon: '🏋️', category: 'Спорт', price: 950_000, downPayment: 290_000, loan: 660_000, revenue: 145_000, operatingCosts: 51_000 },
  { id: 'school', name: 'Онлайн-школа', icon: '🎓', category: 'Онлайн', price: 540_000, downPayment: 260_000, loan: 280_000, revenue: 105_000, operatingCosts: 26_000 },
  { id: 'agency', name: 'SMM-агентство', icon: '📱', category: 'Услуги', price: 410_000, downPayment: 210_000, loan: 200_000, revenue: 92_000, operatingCosts: 28_000 },
  { id: 'wash', name: 'Автомойка', icon: '🚗', category: 'Авто', price: 1_600_000, downPayment: 460_000, loan: 1_140_000, revenue: 210_000, operatingCosts: 76_000 },
  { id: 'apartment', name: 'Квартира под аренду', icon: '🏠', category: 'Недвижимость', price: 4_200_000, downPayment: 1_050_000, loan: 3_150_000, revenue: 155_000, operatingCosts: 26_000 },
  { id: 'it', name: 'IT-сервис', icon: '🖥️', category: 'IT', price: 1_400_000, downPayment: 520_000, loan: 880_000, revenue: 230_000, operatingCosts: 65_000 },
  { id: 'factory', name: 'Мини-производство', icon: '⚙️', category: 'Производство', price: 3_600_000, downPayment: 1_100_000, loan: 2_500_000, revenue: 360_000, operatingCosts: 135_000 },
]

export const board: { type: CellType; icon: string; label: string }[] = [
  { type: 'salary', icon: '📅', label: 'Расчёт' },
  { type: 'business', icon: '🏢', label: 'Бизнес' },
  { type: 'market', icon: '📈', label: 'Рынок' },
  { type: 'expense', icon: '💸', label: 'Расход' },
  { type: 'chance', icon: '💡', label: 'Шанс' },
  { type: 'bank', icon: '🏦', label: 'Банк' },
  { type: 'growth', icon: '🚀', label: 'Развитие' },
  { type: 'business', icon: '🏢', label: 'Бизнес' },
  { type: 'expense', icon: '💸', label: 'Расход' },
  { type: 'market', icon: '📰', label: 'Рынок' },
  { type: 'business', icon: '🏢', label: 'Бизнес' },
  { type: 'chance', icon: '💡', label: 'Шанс' },
  { type: 'bank', icon: '🏦', label: 'Банк' },
  { type: 'expense', icon: '💸', label: 'Расход' },
  { type: 'growth', icon: '🚀', label: 'Развитие' },
  { type: 'business', icon: '🏢', label: 'Бизнес' },
  { type: 'market', icon: '📈', label: 'Рынок' },
  { type: 'chance', icon: '💡', label: 'Шанс' },
  { type: 'expense', icon: '💸', label: 'Расход' },
  { type: 'business', icon: '🏢', label: 'Бизнес' },
]

export const expenseCards = [
  ['Ремонт автомобиля', 85_000],
  ['Стоматолог', 70_000],
  ['Сломалась техника', 55_000],
  ['Налоговая доплата', 120_000],
  ['Ремонт квартиры', 180_000],
] as const

export const chanceCards = [
  ['Партия техники', 100_000, 155_000],
  ['Авто на перепродажу', 350_000, 510_000],
  ['Редкие кроссовки', 80_000, 132_000],
  ['Цифровой продукт', 140_000, 260_000],
] as const
