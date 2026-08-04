import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import { executeCommand, emptyGame } from './engine'
import { assessLoan, assetCashflow, competitionStandings, freedomProgress, isFinanciallyFree, loanPayment, monthlyCashflow, monthlyExpenses, monthlyStockDividends, netWorth, passiveIncome, stockMarketValue } from '../systems/economy'
import type { Asset } from '../domain/types'
import { playerLevel, skillLevel } from '../systems/progression'

const startedGame = (seed = 7) => executeCommand(emptyGame(seed), { type: 'START_GAME', professionId: 'trainer', seed }).state
const businessCashflow = (businessId: string) => {
  const business = businesses.find((item) => item.id === businessId)!
  return business.revenue - business.operatingCosts - loanPayment(business.loan, business.loanRate, business.loanTermMonths)
}
const testAsset = (businessId: string, ownerId: string): Asset => {
  const business = businesses.find((item) => item.id === businessId)!
  return { ...business, ownerId, ownership: 1, monthlyPayment: loanPayment(business.loan, business.loanRate, business.loanTermMonths), purchaseMonth: 1, developmentLevel: 0, developments: [], totalDevelopmentCost: 0, lastDevelopedMonth: null, saleOffer: null, offerExpiresMonth: null, status: 'active', dueDiligence: 'none', launchMonthsRemaining: 0, incidentCooldown: 0, issueMonths: 0, missedPayments: 0 }
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
    const expected = businessCashflow('coffee')
    expect(assetCashflow(player.assets[0])).toBe(expected)
    expect(passiveIncome(player)).toBe(expected)
    expect(monthlyCashflow(player)).toBe(player.salary + expected - monthlyExpenses(player))
  })

  it('charges and gradually repays profession debt each month', () => {
    let game = startedGame()
    const startingDebt = game.players[0].baseDebt
    const expectedPayment = Math.round(startingDebt * 0.02)
    expect(monthlyCashflow(game.players[0])).toBe(52_000 - expectedPayment)
    for (let turn = 0; turn < 7; turn += 1) {
      game.phase = 'decision'
      game.pendingDecision = { kind: 'salary' }
      game = executeCommand(game, { type: 'SKIP_DECISION' }).state
    }
    expect(game.players[0].baseDebt).toBe(startingDebt - Math.round(startingDebt * 0.014))
    expect(game.lastMonthlyReport?.livingExpenses).toBe(128_000 + expectedPayment)
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
    expect(asset.revenue).toBe(Math.round(businesses.find((item) => item.id === 'coffee')!.revenue * 0.5))
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

  it('does not finance the entire business contribution without buyer money', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'coffee', askingPrice: 480_000, negotiated: false }
    game.players[0].cash = 20_000
    const result = executeCommand(game, { type: 'BUY_BUSINESS', funding: 'credit' })
    expect(result.accepted).toBe(false)
    expect(result.state.players[0].assets).toHaveLength(0)
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
    const financedLoan = Math.round(330_000 * (456_000 / 480_000))
    expect(purchase.state.players[0].cash).toBe(150_000 - (456_000 - financedLoan))
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
    expect(asset.revenue).toBe(Math.round(businesses.find((item) => item.id === 'coffee')!.revenue * 1.16))
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
    expect(result.state.players[0].assets[0].revenue).toBe(Math.round(businesses.find((item) => item.id === 'coffee')!.revenue * 0.6))
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

    expect(sale.state.players[0].loans[0]).toMatchObject({ balance: 20_000 })
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
    expect(sold.state.players[0].experience).toBe(0)
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

  it('trains a chosen skill and converts experience into player levels', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'growth' }

    const first = executeCommand(game, { type: 'TRAIN', skillId: 'negotiation' })
    expect(first.accepted).toBe(true)
    expect(skillLevel(first.state.players[0], 'negotiation')).toBe(1)
    expect(first.state.players[0].cash).toBe(100_000)
    expect(first.state.players[0].experience).toBe(65)

    first.state.phase = 'decision'
    first.state.pendingDecision = { kind: 'growth' }
    first.state.players[0].cash = 500_000
    const second = executeCommand(first.state, { type: 'TRAIN', skillId: 'finance' })
    expect(playerLevel(second.state.players[0])).toBe(2)
  })

  it('locks large businesses until the required player level', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'business', businessId: 'factory', askingPrice: 3_600_000, negotiated: false }
    game.players[0].cash = 2_000_000

    const result = executeCommand(game, { type: 'BUY_BUSINESS', funding: 'cash' })
    expect(result.accepted).toBe(false)
    expect(result.error).toContain('уровень 4')
  })

  it('uses negotiation skill to improve the real deal probability', () => {
    const base = startedGame(578)
    base.difficulty = 'hard'
    base.phase = 'decision'
    base.pendingDecision = { kind: 'business', businessId: 'coffee', askingPrice: 480_000, negotiated: false }
    const skilled = structuredClone(base)
    skilled.players[0].skills.negotiation = 200

    const plainResult = executeCommand(base, { type: 'NEGOTIATE_BUSINESS', offerPercent: 0.95 })
    const skilledResult = executeCommand(skilled, { type: 'NEGOTIATE_BUSINESS', offerPercent: 0.95 })
    expect(plainResult.state.pendingDecision?.kind === 'business' ? plainResult.state.pendingDecision.askingPrice : null).not.toBe(456_000)
    expect(skilledResult.state.pendingDecision).toMatchObject({ kind: 'business', askingPrice: 456_000 })
  })

  it('management skill discounts development while marketing increases its result', () => {
    const game = startedGame()
    const player = game.players[0]
    player.cash = 500_000
    player.skills.management = 200
    player.skills.marketing = 200
    player.assets.push(testAsset('coffee', player.id))

    const result = executeCommand(game, { type: 'DEVELOP_ASSET', assetId: player.assets[0].id, developmentId: 'marketing' })
    expect(result.accepted).toBe(true)
    expect(result.state.players[0].cash).toBe(500_000 - 31_488)
    expect(result.state.players[0].assets[0].revenue).toBe(Math.round(businesses.find((item) => item.id === 'coffee')!.revenue * 1.28))
  })

  it('finance skill improves real bank terms without removing underwriting', () => {
    const game = startedGame()
    const player = game.players[0]
    const ordinary = assessLoan(player, 50_000, 'normal')
    player.skills.finance = 200
    const skilled = assessLoan(player, 50_000, 'normal')

    expect(skilled.annualRate).toBeLessThan(ordinary.annualRate)
    expect(skilled.limit).toBeGreaterThan(ordinary.limit)
    expect(assessLoan(player, 50_000_000, 'normal').approved).toBe(false)
  })

  it('personal brand level increases active monthly income', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = { kind: 'growth' }
    const salary = game.players[0].salary

    const result = executeCommand(game, { type: 'TRAIN', skillId: 'brand' })
    expect(result.accepted).toBe(true)
    expect(result.state.players[0].salary).toBe(salary + 12_000)
  })

  it('finishes the race when a bot reaches financial freedom first', () => {
    const game = executeCommand(emptyGame(31), { type: 'START_GAME', professionId: 'trainer', botCount: 1, seed: 31 }).state
    const bot = game.players[1]
    bot.deposit = Math.ceil(monthlyExpenses(bot) / 0.009) + 1_000_000
    bot.freedomStreak = 3
    game.phase = 'decision'
    game.pendingDecision = { kind: 'salary' }

    const result = executeCommand(game, { type: 'SKIP_DECISION' })

    expect(result.state.phase).toBe('finished')
    expect(result.state.outcome).toEqual({ winnerId: bot.id, reason: 'freedom' })
    expect(result.state.players[1].status).toBe('free')
  })

  it('requires liquid reserve and three stable months before declaring financial freedom', () => {
    const game = startedGame()
    const player = game.players[0]
    const asset = testAsset('coffee', player.id)
    asset.marketValue = 2_000_000
    asset.revenue = monthlyExpenses(player) + asset.operatingCosts + asset.monthlyPayment + 10_000
    player.assets = [asset]
    player.freedomStreak = 3
    player.cash = 0
    expect(passiveIncome(player, game.stockMarket)).toBeGreaterThanOrEqual(monthlyExpenses(player))
    expect(isFinanciallyFree(player, game.stockMarket)).toBe(false)
    player.cash = monthlyExpenses(player) * 3
    expect(isFinanciallyFree(player, game.stockMarket)).toBe(true)
  })

  it('eliminates a bankrupt bot and stops its future turns', () => {
    let game = executeCommand(emptyGame(40), { type: 'START_GAME', professionId: 'trainer', botCount: 2, seed: 40 }).state
    const bankruptBot = game.players[1]
    bankruptBot.cash = -bankruptBot.baseExpenses * 3
    bankruptBot.salary = 0
    game.phase = 'decision'
    game.pendingDecision = { kind: 'salary' }
    game = executeCommand(game, { type: 'SKIP_DECISION' }).state
    expect(game.players[1].status).toBe('bankrupt')
    const positionAfterElimination = game.players[1].position
    const cashAfterElimination = game.players[1].cash

    for (let turn = 0; turn < 7; turn += 1) {
      game.phase = 'decision'
      game.pendingDecision = { kind: 'salary' }
      game = executeCommand(game, { type: 'SKIP_DECISION' }).state
    }
    expect(game.players[1].position).toBe(positionAfterElimination)
    expect(game.players[1].cash).toBe(cashAfterElimination)
  })

  it('ends in defeat when the human economy is insolvent', () => {
    const game = startedGame(51)
    const player = game.players[0]
    player.cash = -player.baseExpenses * 3
    player.salary = 0
    game.phase = 'decision'
    game.pendingDecision = { kind: 'salary' }

    const result = executeCommand(game, { type: 'SKIP_DECISION' })

    expect(result.state.phase).toBe('finished')
    expect(result.state.outcome).toEqual({ winnerId: null, reason: 'human-bankrupt' })
    expect(result.state.players[0].status).toBe('bankrupt')
  })

  it('ranks active players by freedom progress before capital', () => {
    const game = executeCommand(emptyGame(61), { type: 'START_GAME', professionId: 'trainer', botCount: 2, seed: 61 }).state
    const [human, firstBot, secondBot] = game.players
    human.deposit = 1_000_000
    firstBot.deposit = 2_000_000
    secondBot.cash = 10_000_000
    secondBot.status = 'bankrupt'

    const standings = competitionStandings(game.players, game.stockMarket)

    expect(standings[0].id).toBe(firstBot.id)
    expect(standings.at(-1)?.id).toBe(secondBot.id)
    expect(freedomProgress(firstBot, game.stockMarket)).toBeGreaterThan(freedomProgress(human, game.stockMarket))
  })
})
