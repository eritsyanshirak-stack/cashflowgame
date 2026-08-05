import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import type { Asset, EventChain, GameState, Player } from '../domain/types'
import { emptyGame, executeCommand } from './engine'
import { processAssetListings } from '../systems/v14'
import { resolveEventChains } from '../systems/v15'

const makeAsset = (overrides: Partial<Asset> = {}): Asset => ({
  ...businesses[0],
  id: 'asset-1',
  ownerId: 'human',
  ownership: 1,
  monthlyPayment: 0,
  purchaseMonth: 1,
  developmentLevel: 0,
  developments: [],
  totalDevelopmentCost: 0,
  lastDevelopedMonth: null,
  saleOffer: null,
  offerExpiresMonth: null,
  status: 'active',
  marketValue: 100_000,
  loan: 0,
  ...overrides,
})

const makePlayer = (id = 'human', isBot = false): Player => ({
  id,
  name: isBot ? 'Алексей' : 'Ты',
  isBot,
  professionId: 'trainer',
  position: 0,
  cash: 500_000,
  salary: 180_000,
  baseExpenses: 128_000,
  baseDebt: 0,
  assets: [],
  loans: [],
  deposit: 0,
  bonds: 0,
  stocks: [],
  resaleDeals: [],
  activeContracts: [],
  experience: 260,
  skills: { negotiation: 0, marketing: 0, management: 0, finance: 0, brand: 0 },
  status: 'active',
  eliminatedMonth: null,
  botStrategy: isBot ? 'balanced' : undefined,
  freedomStreak: 0,
})

describe('Balance v1.5 audit regressions', () => {
  it('seller warranty absorbs the delayed equipment repair', () => {
    const state = emptyGame(10) as GameState
    const human = makePlayer()
    human.assets = [makeAsset({ warrantyUntilMonth: 3 })]
    state.players = [human]
    const chain: EventChain = {
      id: 'repair-chain',
      kind: 'equipment',
      title: 'Отложенный ремонт',
      description: 'Проверка гарантии',
      resolvesMonth: 2,
      assetId: 'asset-1',
      amount: 40_000,
    }
    state.eventChains = [chain]
    const before = human.cash
    const events: string[] = []

    resolveEventChains(state, 2, () => 0, (title) => events.push(title))

    expect(state.players[0].cash).toBe(before)
    expect(events).toContain('Гарантия продавца сработала')
    expect(state.eventChains).toHaveLength(0)
  })

  it('market buyer archetypes never impersonate a bot without a real transfer', () => {
    const state = emptyGame(11) as GameState
    const human = makePlayer()
    human.assets = [makeAsset({ listingPrice: 100_000, listingStartedMonth: 1, listingExpiresMonth: 4 })]
    state.players = [human, makePlayer('bot-1', true)]
    state.phase = 'ready'

    processAssetListings(state, () => 0)

    expect(state.buyerOffers).toHaveLength(1)
    expect(state.buyerOffers[0].buyerPlayerId).toBeUndefined()
    expect(state.buyerOffers[0].buyerName).not.toBe('Алексей')
  })

  it('rejecting a seller counter restores the original asking price', () => {
    const state = emptyGame(12) as GameState
    state.phase = 'decision'
    state.players = [makePlayer()]
    state.pendingDecision = {
      kind: 'business',
      businessId: businesses[1].id,
      askingPrice: 900_000,
      originalAskingPrice: 1_000_000,
      negotiated: true,
      sellerCounter: { price: 950_000, term: 'transition', note: 'Передача бизнеса' },
    }

    const result = executeCommand(state, { type: 'RESPOND_SELLER_COUNTER', action: 'keepOriginal' })

    expect(result.accepted).toBe(true)
    expect(result.state.pendingDecision?.kind).toBe('business')
    if (result.state.pendingDecision?.kind === 'business') {
      expect(result.state.pendingDecision.askingPrice).toBe(1_000_000)
      expect(result.state.pendingDecision.sellerCounter).toBeUndefined()
    }
  })
})
