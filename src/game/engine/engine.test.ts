import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import { executeCommand, emptyGame } from './engine'
import { assetCashflow, monthlyCashflow, passiveIncome } from '../systems/economy'
import type { Asset } from '../domain/types'

const startedGame = (seed = 7) => executeCommand(emptyGame(seed), { type: 'START_GAME', professionId: 'trainer', seed }).state
const testAsset = (businessId: string, ownerId: string): Asset => {
  const business = businesses.find((item) => item.id === businessId)!
  return { ...business, ownerId, ownership: 1, monthlyPayment: Math.round(business.loan * 0.015), purchaseMonth: 1, developmentLevel: 0, developments: [], totalDevelopmentCost: 0, lastDevelopedMonth: null, saleOffer: null, offerExpiresMonth: null }
}

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
    player.assets.push(testAsset('coffee', player.id))
    expect(assetCashflow(player.assets[0])).toBe(41_050)
    expect(passiveIncome(player)).toBe(41_050)
    expect(monthlyCashflow(player)).toBe(93_050)
  })

  it('never allows a cash purchase with insufficient funds', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'apartment', askingPrice: 4_200_000, negotiated: false }
    const result = executeCommand(game, { type: 'BUY_BUSINESS', funding: 'cash' })
    expect(result.accepted).toBe(false)
    expect(result.state.players[0].cash).toBe(150_000)
    expect(result.state.players[0].assets).toHaveLength(0)
  })

  it('creates proportional economics when buying with a partner', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'coffee', askingPrice: 480_000, negotiated: false }
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
    game.pendingDecision = { kind: 'business', businessId: 'coffee', askingPrice: 480_000, negotiated: false }
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
    player.assets.push(testAsset('coffee', player.id))

    const result = executeCommand(game, { type: 'SELL_ASSET', assetId: player.assets[0].id })

    expect(result.accepted).toBe(true)
    expect(result.state.players[0].assets).toHaveLength(0)
    expect(result.state.players[0].cash).toBe(300_000)
  })

  it('does not allow selling an asset while another decision is open', () => {
    const game = startedGame()
    const player = game.players[0]
    player.assets.push(testAsset('vending', player.id))
    game.phase = 'decision'
    game.pendingDecision = { kind: 'salary' }

    const result = executeCommand(game, { type: 'SELL_ASSET', assetId: player.assets[0].id })

    expect(result.accepted).toBe(false)
    expect(result.state.players[0].assets).toHaveLength(1)
  })

  it('applies a successful negotiated price to the purchase', () => {
    const game = startedGame(1)
    game.difficulty = 'easy'
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'coffee', askingPrice: 480_000, negotiated: false }

    const negotiation = executeCommand(game, { type: 'NEGOTIATE_BUSINESS', offerPercent: 0.95 })
    expect(negotiation.accepted).toBe(true)
    expect(negotiation.state.pendingDecision).toMatchObject({ kind: 'business', askingPrice: 456_000, negotiated: true })

    const purchase = executeCommand(negotiation.state, { type: 'BUY_BUSINESS', funding: 'cash' })
    expect(purchase.accepted).toBe(true)
    expect(purchase.state.players[0].assets[0].price).toBe(456_000)
    expect(purchase.state.players[0].cash).toBe(24_000)
  })

  it('develops a business once per month and changes its economics', () => {
    const game = startedGame()
    const player = game.players[0]
    player.cash = 500_000
    player.assets.push(testAsset('coffee', player.id))

    const result = executeCommand(game, { type: 'DEVELOP_ASSET', assetId: player.assets[0].id, developmentId: 'marketing' })
    const asset = result.state.players[0].assets[0]

    expect(result.accepted).toBe(true)
    expect(asset.developmentLevel).toBe(1)
    expect(asset.revenue).toBe(83_520)
    expect(asset.marketValue).toBeGreaterThan(480_000)
    expect(executeCommand(result.state, { type: 'DEVELOP_ASSET', assetId: asset.id, developmentId: 'automation' }).accepted).toBe(false)
  })

  it('lets a player buy back a partner share with proportional economics', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'coffee', askingPrice: 480_000, negotiated: false }
    const purchase = executeCommand(game, { type: 'BUY_BUSINESS', funding: 'partner50' })
    const asset = purchase.state.players[0].assets[0]

    const result = executeCommand(purchase.state, { type: 'BUY_PARTNER_SHARE', assetId: asset.id })

    expect(result.accepted).toBe(true)
    expect(result.state.players[0].assets[0].ownership).toBe(0.6)
    expect(result.state.players[0].assets[0].revenue).toBe(43_200)
  })

  it('starts distinct bot strategies and keeps selected difficulty', () => {
    const game = executeCommand(emptyGame(4), { type: 'START_GAME', professionId: 'trainer', botCount: 3, difficulty: 'hard', seed: 4 }).state
    expect(game.difficulty).toBe('hard')
    expect(game.players.slice(1).map((player) => player.botStrategy)).toEqual(['careful', 'balanced', 'aggressive'])
  })

  it('accepts a live buyer offer and pays off the asset debt', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = testAsset('coffee', player.id)
    asset.saleOffer = 550_000
    asset.offerExpiresMonth = game.month
    player.assets.push(asset)

    const result = executeCommand(game, { type: 'ACCEPT_SALE_OFFER', assetId: asset.id })

    expect(result.accepted).toBe(true)
    expect(result.state.players[0].assets).toHaveLength(0)
    expect(result.state.players[0].cash).toBe(370_000)
  })
})
