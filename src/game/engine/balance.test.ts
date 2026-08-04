import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import type { GameCommand, GameState, SkillId } from '../domain/types'
import { monthlyExpenses } from '../systems/economy'
import { skillLevel, trainingCost } from '../systems/progression'
import { emptyGame, executeCommand } from './engine'

const playDecision = (game: GameState) => {
  const decision = game.pendingDecision
  let player = game.players[0]
  if (!decision) return game
  let command: GameCommand = { type: 'SKIP_DECISION' }

  if (decision.kind === 'business') {
    if (!decision.negotiated) {
      const negotiation = executeCommand(game, { type: 'NEGOTIATE_BUSINESS', offerPercent: 0.95 })
      game = negotiation.state
      if (game.phase !== 'decision' || game.pendingDecision?.kind !== 'business') return game
      player = game.players[0]
    }
    const currentDeal = game.pendingDecision
    if (!currentDeal || currentDeal.kind !== 'business') return game
    const business = businesses.find((item) => item.id === currentDeal.businessId)!
    const downPayment = Math.max(0, currentDeal.askingPrice - business.loan)
    const reserve = monthlyExpenses(player) * 0.45
    if (player.cash >= downPayment + reserve) command = { type: 'BUY_BUSINESS', funding: 'cash' }
    else if (player.cash >= downPayment * 0.5 + reserve) command = { type: 'BUY_BUSINESS', funding: 'partner50' }
    else if (player.cash >= reserve * 0.5) command = { type: 'BUY_BUSINESS', funding: 'credit' }
  } else if (decision.kind === 'expense') {
    command = { type: 'PAY_EXPENSE', withCredit: player.cash < decision.amount }
  } else if (decision.kind === 'chance') {
    const expected = (decision.minReturn + decision.maxReturn) / 2
    if (expected > decision.investment * 1.08 && player.cash > decision.investment + monthlyExpenses(player) * 0.5) command = { type: 'TAKE_CHANCE' }
  } else if (decision.kind === 'growth') {
    const priorities: SkillId[] = ['finance', 'management', 'marketing', 'negotiation', 'brand']
    const skillId = priorities.find((id) => skillLevel(player, id) < 3)
    if (skillId && player.cash > trainingCost(player, skillId) + monthlyExpenses(player) * 0.35) command = { type: 'TRAIN', skillId }
  } else if (decision.kind === 'market') {
    const quote = [...game.stockMarket].sort((a, b) => b.dividendYield - a.dividendYield)[0]
    if (player.cash > quote.price * 1.015 + monthlyExpenses(player) * 0.6) {
      game = executeCommand(game, { type: 'BUY_STOCK', stockId: quote.id, quantity: 1 }).state
    }
  }
  const result = executeCommand(game, command)
  return result.accepted ? result.state : executeCommand(game, { type: 'SKIP_DECISION' }).state
}

const simulate = (seed: number, maxMonths = 48) => {
  let game = executeCommand(emptyGame(seed), { type: 'START_GAME', professionId: 'trainer', botCount: 2, difficulty: 'normal', seed }).state
  let safety = 0
  while (game.phase !== 'finished' && game.month <= maxMonths && safety < 500) {
    const roll = executeCommand(game, { type: 'ROLL_DICE' })
    expect(roll.accepted).toBe(true)
    game = playDecision(roll.state)
    safety += 1
  }
  return game
}

describe('full-party balance', () => {
  it('keeps long simulations finite and economically valid', () => {
    const games = Array.from({ length: 24 }, (_, index) => simulate(100 + index))
    for (const game of games) {
      expect(game.month).toBeLessThanOrEqual(49)
      expect(game.players.every((player) => [player.cash, player.salary, player.baseExpenses, ...player.assets.flatMap((asset) => [asset.revenue, asset.operatingCosts, asset.loan])].every(Number.isFinite))).toBe(true)
      expect(game.players.every((player) => player.assets.every((asset) => asset.ownership >= 0.5 && asset.ownership <= 1))).toBe(true)
    }
    expect(games.filter((game) => game.phase === 'finished').length).toBe(24)
    expect(games.filter((game) => game.month >= 7 && game.month <= 20).length).toBeGreaterThanOrEqual(22)
    expect(games.some((game) => game.outcome?.winnerId === 'human')).toBe(true)
    expect(games.some((game) => game.outcome?.winnerId?.startsWith('bot'))).toBe(true)
  })
})
