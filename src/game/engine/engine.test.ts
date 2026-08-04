import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import { executeCommand, emptyGame } from './engine'
import { assetCashflow, monthlyCashflow, monthlyStockDividends, netWorth, passiveIncome, stockMarketValue } from '../systems/economy'
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

  it('approves only the missing acquisition amount and records real loan terms', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'pickup', askingPrice: 620_000, negotiated: false }
    game.players[0].cash = 100_000

    const result = executeCommand(game, { type: 'BUY_BUSINESS', funding: 'credit' })

    expect(result.accepted).toBe(true)
    expect(result.state.players[0].cash).toBe(0)
    expect(result.state.players[0].loans[0]).toMatchObject({ balance: 80_000, annualRate: 0.25, termMonths: 36 })
    expect(result.state.players[0].loans[0].monthlyPayment).toBeGreaterThan(0)
  })

  it('rejects a loan larger than the bank limit without changing cash', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'bank' }

    const result = executeCommand(game, { type: 'TAKE_LOAN', amount: 5_000_000 })

    expect(result.accepted).toBe(false)
    expect(result.state.players[0].cash).toBe(150_000)
    expect(result.state.players[0].loans).toHaveLength(0)
  })

  it('prevents double collateral and settles the secured loan when the asset is sold', () => {
    const game = startedGame()
    const player = game.players[0]
    player.assets.push(testAsset('vending', player.id))
    game.phase = 'decision'
    game.pendingDecision = { kind: 'bank' }

    const firstLoan = executeCommand(game, { type: 'TAKE_LOAN', amount: 40_000, collateralAssetId: player.assets[0].id })
    const secondLoan = executeCommand(firstLoan.state, { type: 'TAKE_LOAN', amount: 10_000, collateralAssetId: player.assets[0].id })
    expect(firstLoan.accepted).toBe(true)
    expect(secondLoan.accepted).toBe(false)

    firstLoan.state.phase = 'ready'
    firstLoan.state.pendingDecision = null
    const sale = executeCommand(firstLoan.state, { type: 'SELL_ASSET', assetId: player.assets[0].id })
    expect(sale.accepted).toBe(true)
    expect(sale.state.players[0].loans).toHaveLength(0)
    expect(sale.state.players[0].cash).toBe(240_000)
  })

  it('keeps an unpaid collateral shortfall as debt after a distressed sale', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = testAsset('vending', player.id)
    player.assets.push(asset)
    game.phase = 'decision'
    game.pendingDecision = { kind: 'bank' }
    const loan = executeCommand(game, { type: 'TAKE_LOAN', amount: 40_000, collateralAssetId: asset.id }).state
    loan.players[0].assets[0].marketValue = 20_000
    loan.phase = 'ready'
    loan.pendingDecision = null

    const sale = executeCommand(loan, { type: 'SELL_ASSET', assetId: asset.id })

    expect(sale.state.players[0].loans[0]).toMatchObject({ balance: 20_000, collateralAssetId: undefined })
    expect(sale.state.players[0].cash).toBe(190_000)
  })

  it('buys and sells real stock quantities with a spread', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'market', title: 'Биржа', description: '' }
    const quote = game.stockMarket[0]
    const bought = executeCommand(game, { type: 'BUY_STOCK', stockId: quote.id, quantity: 2 })

    expect(bought.accepted).toBe(true)
    expect(bought.state.players[0].stocks[0]).toMatchObject({ stockId: quote.id, quantity: 2 })
    expect(bought.state.players[0].cash).toBe(150_000 - Math.ceil(quote.price * 2 * 1.015))

    const sold = executeCommand(bought.state, { type: 'SELL_STOCK', stockId: quote.id, quantity: 1 })
    expect(sold.accepted).toBe(true)
    expect(sold.state.players[0].stocks[0].quantity).toBe(1)
    expect(sold.state.players[0].cash).toBe(bought.state.players[0].cash + Math.floor(quote.price * 0.985))
    expect(executeCommand(sold.state, { type: 'SELL_STOCK', stockId: quote.id, quantity: 2 }).accepted).toBe(false)
  })

  it('counts stock market value and dividends in wealth and passive income', () => {
    const game = startedGame()
    const player = game.players[0]
    const quote = game.stockMarket[0]
    player.stocks.push({ stockId: quote.id, quantity: 10, averagePrice: quote.price })

    expect(stockMarketValue(player, game.stockMarket)).toBe(quote.price * 10)
    expect(monthlyStockDividends(player, game.stockMarket)).toBe(Math.round(quote.price * 10 * quote.dividendYield / 12))
    expect(netWorth(player, game.stockMarket)).toBe(netWorth({ ...player, stocks: [] }, game.stockMarket) + quote.price * 10)
  })

  it('locks resale capital instead of paying an instant guaranteed profit', () => {
    const game = startedGame(11)
    game.phase = 'decision'
    game.pendingDecision = { kind: 'chance', title: 'Партия техники', investment: 100_000, minReturn: 72_000, maxReturn: 162_000, durationMonths: 1 }

    const result = executeCommand(game, { type: 'TAKE_CHANCE' })

    expect(result.accepted).toBe(true)
    expect(result.state.players[0].cash).toBe(50_000)
    expect(result.state.players[0].resaleDeals).toHaveLength(1)
    expect(result.state.players[0].resaleDeals[0].resolvesMonth).toBe(2)
  })

  it('returns resale proceeds only when its month closes', () => {
    let game = startedGame(19)
    const player = game.players[0]
    player.resaleDeals.push({ id: 'deal-1', title: 'Товар', investment: 100_000, expectedMin: 70_000, expectedMax: 150_000, resolvesMonth: 2, outcomeAmount: 140_000, delays: 1 })
    const cashBeforeMonth = player.cash

    for (let turn = 0; turn < 7; turn += 1) {
      game.phase = 'decision'
      game.pendingDecision = { kind: 'salary' }
      game = executeCommand(game, { type: 'SKIP_DECISION' }).state
    }

    expect(game.players[0].resaleDeals).toHaveLength(0)
    expect(game.lastMonthlyReport?.resaleReturns).toBe(140_000)
    expect(game.players[0].cash).toBe(cashBeforeMonth + monthlyCashflow(player, game.stockMarket) + 140_000)
  })
})
