import { describe, expect, it } from 'vitest'
import { businesses } from '../content/content'
import type { Asset, GameState, Player } from '../domain/types'
import { emptyGame, executeCommand } from './engine'
import {
  createDealProfile,
  createSellerCounter,
  refreshPortfolioSynergies,
  resolveEventChains,
  scheduleExpenseChain,
} from '../systems/v15'

const sequence = (...values: number[]) => {
  let index = 0
  return () => values[index++ % values.length] ?? 0
}

const asset = (id: string, category: string): Asset => ({
  ...businesses[0],
  id,
  name: id,
  category,
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
})

const player = (): Player => ({
  id: 'human', name: 'Ты', isBot: false, professionId: 'trainer', position: 0,
  cash: 200_000, salary: 180_000, baseExpenses: 128_000, baseDebt: 0,
  assets: [], loans: [], deposit: 0, bonds: 0, stocks: [], resaleDeals: [], activeContracts: [],
  experience: 700, skills: { negotiation: 0, marketing: 0, management: 0, finance: 0, brand: 0 },
  status: 'active', eliminatedMonth: null, freedomStreak: 0,
})

describe('Balance v1.5', () => {
  it('creates a concrete deal profile with bounded economics', () => {
    const profile = createDealProfile(businesses[1], sequence(0, .2, .7, .4, .8, .3, .6, .1), 'deal-1')
    expect(profile.id).toBe('deal-1')
    expect(profile.leaseMonths).toBeGreaterThanOrEqual(4)
    expect(profile.revenueMultiplier).toBeGreaterThanOrEqual(.72)
    expect(profile.revenueMultiplier).toBeLessThanOrEqual(1.34)
    expect(profile.costMultiplier).toBeGreaterThanOrEqual(.78)
    expect(profile.costMultiplier).toBeLessThanOrEqual(1.34)
  })

  it('builds portfolio synergy without unlimited stacking', () => {
    const current = player()
    current.assets = [asset('market', 'Онлайн'), asset('pickup', 'Сервис'), asset('it', 'IT')]
    refreshPortfolioSynergies(current)
    expect(current.assets[0].synergyBonus).toBeGreaterThan(0)
    expect(current.assets[0].synergyBonus).toBeLessThanOrEqual(.18)
    expect(current.assets[0].synergyLabel).toContain('пункт выдачи')
  })

  it('seller counter stays between the buyer offer and asking price', () => {
    const counter = createSellerCounter(1_000_000, .85, 2, sequence(.3, .5))
    expect(counter.price).toBeGreaterThanOrEqual(850_000)
    expect(counter.price).toBeLessThanOrEqual(1_000_000)
    expect(counter.note.length).toBeGreaterThan(20)
  })

  it('delays risky expense consequences instead of hiding them in the same turn', () => {
    const state = emptyGame(1) as GameState
    state.players = [player()]
    state.eventChains = []
    expect(scheduleExpenseChain(state, 'Ремонт', 20_000, .5, () => 0)).toBe(true)
    expect(state.eventChains).toHaveLength(1)
    const before = state.players[0].cash
    resolveEventChains(state, state.eventChains[0].resolvesMonth, () => 0, () => undefined)
    expect(state.players[0].cash).toBe(before - 20_000)
    expect(state.eventChains).toHaveLength(0)
  })

  it('locks one specialization and applies entrepreneur trade-off', () => {
    let state = emptyGame(2)
    state.phase = 'ready'
    state.players = [player()]
    const result = executeCommand(state, { type: 'CHOOSE_SPECIALIZATION', specialization: 'entrepreneur' })
    expect(result.accepted).toBe(true)
    expect(result.state.players[0].specialization).toBe('entrepreneur')
    expect(result.state.players[0].salary).toBe(0)
    const second = executeCommand(result.state, { type: 'CHOOSE_SPECIALIZATION', specialization: 'operator' })
    expect(second.accepted).toBe(false)
  })
})
