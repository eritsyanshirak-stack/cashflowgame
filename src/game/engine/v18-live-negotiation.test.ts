import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import type { Asset, BuyerOffer, Decision } from '../domain/types'
import { loanPayment } from '../systems/economy'
import { buyerOfferMultiplier } from '../systems/v15'
import { emptyGame, executeCommand } from './engine'
import { handleDecisionV14Command, handleReadyV14Command } from './v14Core'

const startedGame = () => executeCommand(emptyGame(818), {
  type: 'START_GAME', professionId: 'trainer', botCount: 2, difficulty: 'normal', seed: 818,
}).state

const testAsset = (): Asset => {
  const business = businesses.find((item) => item.id === 'vending')!
  return {
    ...business,
    id: 'asset-v18', ownerId: 'human', ownership: 1,
    monthlyPayment: loanPayment(business.loan, business.loanRate, business.loanTermMonths),
    purchaseMonth: 1, developmentLevel: 0, developments: [], totalDevelopmentCost: 0,
    lastDevelopedMonth: null, saleOffer: null, offerExpiresMonth: null, status: 'active',
    dueDiligence: 'none', launchMonthsRemaining: 0, incidentCooldown: 0,
    issueMonths: 0, missedPayments: 0, listingPrice: 150_000,
    listingStartedMonth: 1, listingExpiresMonth: 4,
  }
}

const auctionDecision = (overrides: Partial<Extract<Decision, { kind: 'auction' }>> = {}): Extract<Decision, { kind: 'auction' }> => ({
  kind: 'auction', businessId: 'vending', title: 'Тестовый аукцион', currentBid: 100_000,
  marketValue: 200_000, minimumStep: 10_000, inspected: false, issue: 'none', issueRevealed: false,
  botCeilings: [180_000, 0], botActive: [true, false], botDropChances: [0.2, 0.2],
  bidRound: 0, leadingBot: null, ...overrides,
})

describe('balance v1.8 live negotiation', () => {
  it('awards the opening bid when no bot enters the auction', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = auctionDecision({ botCeilings: [0, 0], botActive: [false, false] })

    const result = handleDecisionV14Command(game, { type: 'AUCTION_BID', amount: 100_000 }, () => 0.5)

    expect(result.accepted).toBe(true)
    const won = game.pendingDecision as Decision | null
    expect(won?.kind).toBe('business')
    expect((won as Extract<Decision, { kind: 'business' }>).askingPrice).toBe(100_000)
  })

  it('allows a bot to quit immediately after the first raise', () => {
    const game = startedGame()
    game.phase = 'decision'
    game.pendingDecision = auctionDecision({ botDropChances: [0.9, 0.2] })

    const result = handleDecisionV14Command(game, { type: 'AUCTION_BID', amount: 110_000 }, () => 0.1)

    expect(result.accepted).toBe(true)
    const won = game.pendingDecision as Decision | null
    expect(won?.kind).toBe('business')
    expect((won as Extract<Decision, { kind: 'business' }>).askingPrice).toBe(110_000)
  })

  it('lets an aggressive bot make a random multi-step raise', () => {
    const game = startedGame()
    game.players[1].botStrategy = 'aggressive'
    game.phase = 'decision'
    game.pendingDecision = auctionDecision({ botDropChances: [0, 0.2] })
    const values = [0.99, 0, 0.99]

    const result = handleDecisionV14Command(game, { type: 'AUCTION_BID', amount: 110_000 }, () => values.shift() ?? 0.5)

    expect(result.accepted).toBe(true)
    expect(game.pendingDecision?.kind).toBe('auction')
    expect(game.pendingDecision?.kind === 'auction' && game.pendingDecision.currentBid).toBe(140_000)
  })

  it('gives speculators both low and above-market moods', () => {
    const asset = testAsset()
    const highValues = [0.1, 0.5]
    const lowValues = [0.9, 0.5]
    const high = buyerOfferMultiplier(asset, 'speculator', () => highValues.shift() ?? 0.5)
    const low = buyerOfferMultiplier(asset, 'speculator', () => lowValues.shift() ?? 0.5)
    expect(high).toBeGreaterThan(1)
    expect(low).toBeLessThan(1)
  })

  it('keeps the business until the player confirms an accepted counteroffer', () => {
    const game = startedGame()
    const asset = testAsset()
    game.players[0].assets = [asset]
    const offer: BuyerOffer = {
      id: 'offer-v18', assetId: asset.id, buyerName: 'Спекулянт', askingPrice: 150_000,
      offeredPrice: 120_000, marketValue: 140_000, round: 1, final: false, expiresMonth: 1,
      archetype: 'speculator',
    }
    game.buyerOffers = [offer]

    const counter = handleReadyV14Command(game, { type: 'RESPOND_BUYER_OFFER', offerId: offer.id, action: 'counter5' }, () => 0)
    expect(counter.accepted).toBe(true)
    expect(game.players[0].assets).toHaveLength(1)
    expect(game.buyerOffers[0].sellerApprovalRequired).toBe(true)

    const confirm = handleReadyV14Command(game, { type: 'RESPOND_BUYER_OFFER', offerId: offer.id, action: 'accept' }, () => 0)
    expect(confirm.accepted).toBe(true)
    expect(game.players[0].assets).toHaveLength(0)
  })

  it('allows negotiation on a rare opportunity', () => {
    const game = startedGame()
    game.difficulty = 'easy'
    game.players[0].skills.negotiation = 3
    game.phase = 'decision'
    game.pendingDecision = {
      kind: 'opportunity', opportunityId: 'rare-test', businessId: 'vending',
      askingPrice: 200_000, originalAskingPrice: 200_000, title: 'Редкая точка', description: 'Тест',
      negotiated: false, inspection: 'none', hiddenIssue: 'none', issueRevealed: false,
    }

    const result = executeCommand(game, { type: 'NEGOTIATE_BUSINESS', offerPercent: 0.95 })

    expect(result.accepted).toBe(true)
    expect(result.state.pendingDecision?.kind).toBe('opportunity')
    expect(result.state.pendingDecision?.kind === 'opportunity' && result.state.pendingDecision.negotiated).toBe(true)
    expect(result.state.pendingDecision?.kind === 'opportunity' && result.state.pendingDecision.askingPrice).toBe(190_000)
  })
})
