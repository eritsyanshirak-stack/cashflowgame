import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import { executeCommand, emptyGame } from './engine'
import { assetCashflow, monthlyCashflow, passiveIncome } from '../systems/economy'

const startedGame = (seed = 7) => executeCommand(emptyGame(seed), { type: 'START_GAME', professionId: 'trainer', seed }).state

describe('game engine', () => {
  it('starts a valid game with human and bots', () => {
    const result = executeCommand(emptyGame(1), { type: 'START_GAME', professionId: 'trainer', botCount: 2, seed: 1 })
    expect(result.accepted).toBe(true)
    expect(result.state.phase).toBe('ready')
    expect(result.state.players).toHaveLength(3)
  })

  it('rejects a second roll while a decision is pending', () => {
    const first = executeCommand(startedGame(), { type: 'ROLL_DICE' })
    const second = executeCommand(first.state, { type: 'ROLL_DICE' })
    expect(first.accepted).toBe(true)
    expect(second.accepted).toBe(false)
    expect(second.state).toEqual(first.state)
  })

  it('calculates asset and total cashflow without counting business costs twice', () => {
    const game = startedGame()
    const player = game.players[0]
    const business = businesses[1]
    player.assets.push({ ...business, ownerId: player.id, ownership: 1, monthlyPayment: 4_950, purchaseMonth: 1 })
    expect(assetCashflow(player.assets[0])).toBe(41_050)
    expect(passiveIncome(player)).toBe(41_050)
    expect(monthlyCashflow(player)).toBe(93_050)
  })

  it('never allows a cash purchase with insufficient funds', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'apartment' }
    const result = executeCommand(game, { type: 'BUY_BUSINESS', funding: 'cash' })
    expect(result.accepted).toBe(false)
    expect(result.state.players[0].cash).toBe(150_000)
    expect(result.state.players[0].assets).toHaveLength(0)
  })

  it('creates proportional economics when buying with a partner', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'coffee' }
    const result = executeCommand(game, { type: 'BUY_BUSINESS', funding: 'partner50' })
    const asset = result.state.players[0].assets[0]
    expect(result.accepted).toBe(true)
    expect(asset.ownership).toBe(0.5)
    expect(asset.revenue).toBe(36_000)
    expect(result.state.players[0].cash).toBe(75_000)
  })

  it('applies an expense exactly once and advances the calendar by one turn', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'expense', title: 'Ремонт', amount: 50_000 }
    const result = executeCommand(game, { type: 'PAY_EXPENSE' })
    expect(result.state.players[0].cash).toBe(100_000)
    expect(result.state.day).toBe(5)
    expect(result.state.phase).toBe('ready')
  })

  it('finances only the missing part of a down payment', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'coffee' }
    game.players[0].cash = 100_000
    const result = executeCommand(game, { type: 'BUY_BUSINESS', funding: 'credit' })
    expect(result.accepted).toBe(true)
    expect(result.state.players[0].cash).toBe(0)
    expect(result.state.players[0].loans[0].balance).toBe(50_000)
  })

  it('keeps the market decision open for multiple operations', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'market', title: 'Рынок', description: '' }
    const deposit = executeCommand(game, { type: 'DEPOSIT', amount: 50_000 })
    const bonds = executeCommand(deposit.state, { type: 'BUY_BONDS', amount: 50_000 })
    expect(bonds.accepted).toBe(true)
    expect(bonds.state.phase).toBe('decision')
    expect(bonds.state.players[0].deposit).toBe(50_000)
    expect(bonds.state.players[0].bonds).toBe(50_000)
  })

  it('settles a month exactly after seven human turns', () => {
    const game = startedGame()
    const initialCash = game.players[0].cash
    let current = game

    for (let turn = 0; turn < 7; turn += 1) {
      current.phase = 'decision'
      current.pendingDecision = { kind: 'salary' }
      current = executeCommand(current, { type: 'SKIP_DECISION' }).state
    }

    expect(current.day).toBe(1)
    expect(current.month).toBe(2)
    expect(current.round).toBe(7)
    expect(current.players[0].cash).toBe(initialCash + monthlyCashflow(game.players[0]))
    expect(current.lastMonthlyReport).toMatchObject({
      month: 1,
      startingCash: initialCash,
      netCashflow: monthlyCashflow(game.players[0]),
      endingCash: current.players[0].cash,
    })
  })

  it('does not let bot count accelerate the calendar', () => {
    const oneBot = executeCommand(emptyGame(3), { type: 'START_GAME', professionId: 'trainer', botCount: 1, seed: 3 }).state
    const threeBots = executeCommand(emptyGame(3), { type: 'START_GAME', professionId: 'trainer', botCount: 3, seed: 3 }).state
    oneBot.phase = 'decision'
    oneBot.pendingDecision = { kind: 'salary' }
    threeBots.phase = 'decision'
    threeBots.pendingDecision = { kind: 'salary' }

    const oneBotResult = executeCommand(oneBot, { type: 'SKIP_DECISION' }).state
    const threeBotsResult = executeCommand(threeBots, { type: 'SKIP_DECISION' }).state

    expect(oneBotResult.day).toBe(5)
    expect(threeBotsResult.day).toBe(5)
    expect(oneBotResult.round).toBe(1)
    expect(threeBotsResult.round).toBe(1)
  })

  it('sells an asset, clears its debt and credits only the remaining equity', () => {
    const game = startedGame()
    const player = game.players[0]
    const business = businesses.find((item) => item.id === 'coffee')!
    player.assets.push({ ...business, ownerId: player.id, ownership: 1, monthlyPayment: 4_950, purchaseMonth: 1 })

    const result = executeCommand(game, { type: 'SELL_ASSET', assetId: player.assets[0].id })

    expect(result.accepted).toBe(true)
    expect(result.state.players[0].assets).toHaveLength(0)
    expect(result.state.players[0].cash).toBe(300_000)
  })

  it('does not allow selling an asset while another decision is open', () => {
    const game = startedGame()
    const player = game.players[0]
    const business = businesses[0]
    player.assets.push({ ...business, ownerId: player.id, ownership: 1, monthlyPayment: 0, purchaseMonth: 1 })
    game.phase = 'decision'
    game.pendingDecision = { kind: 'salary' }

    const result = executeCommand(game, { type: 'SELL_ASSET', assetId: player.assets[0].id })

    expect(result.accepted).toBe(false)
    expect(result.state.players[0].assets).toHaveLength(1)
  })
})
