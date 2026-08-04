import type { Asset, Player, SkillId, SkillProgress } from '../domain/types'

export const skillDefinitions: Record<SkillId, { name: string; description: string; icon: string }> = {
  negotiation: { name: 'Переговоры', description: 'Повышает шанс успешного торга', icon: '🤝' },
  marketing: { name: 'Маркетинг', description: 'Усиливает рост выручки от рекламы', icon: '📣' },
  management: { name: 'Управление', description: 'Снижает стоимость развития бизнеса', icon: '⚙️' },
  finance: { name: 'Финансы', description: 'Улучшает ставки и условия банка', icon: '📊' },
  brand: { name: 'Личный бренд', description: 'Ускоряет рост активного дохода', icon: '⭐' },
}

export const emptySkills = (): SkillProgress => ({ negotiation: 0, marketing: 0, management: 0, finance: 0, brand: 0 })

const skillThresholds = [0, 45, 110, 200]
const levelThresholds = [0, 100, 260, 480, 760]

export const skillLevel = (player: Player, skillId: SkillId) => {
  const points = player.skills[skillId]
  let level = 0
  for (let index = 1; index < skillThresholds.length; index += 1) if (points >= skillThresholds[index]) level = index
  return level
}

export const playerLevel = (player: Player) => {
  let level = 1
  for (let index = 1; index < levelThresholds.length; index += 1) if (player.experience >= levelThresholds[index]) level = index + 1
  return level
}

export const nextPlayerLevelXp = (player: Player) => levelThresholds[playerLevel(player)] ?? null
export const nextSkillXp = (player: Player, skillId: SkillId) => skillThresholds[skillLevel(player, skillId) + 1] ?? null

export const grantProgress = (player: Player, experience: number, skillId?: SkillId, skillPoints = 0) => {
  player.experience += experience
  if (skillId) player.skills[skillId] += skillPoints
}

export const trainingCost = (player: Player, skillId: SkillId) => 50_000 + skillLevel(player, skillId) * 40_000

export const developmentCost = (player: Player, asset: Asset, costRate: number) =>
  Math.round(asset.price * asset.ownership * costRate * (1 - skillLevel(player, 'management') * 0.06))

export const rankName = (level: number) => ['Новичок', 'Предприниматель', 'Инвестор', 'Владелец', 'Капиталист'][level - 1] ?? 'Капиталист'
